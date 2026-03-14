// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
use std::{
    env, fs,
    path::PathBuf,
    process::Command,
    thread,
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};
use url::Url;

#[tauri::command]
fn export_document(path: String, content: String) -> Result<(), String> {
    std::fs::write(&path, content)
        .map_err(|error| format!("No se pudo guardar el archivo en '{}': {}", path, error))
}

#[tauri::command]
fn export_pdf_bytes(path: String, pdf_bytes: Vec<u8>) -> Result<(), String> {
    std::fs::write(&path, pdf_bytes)
        .map_err(|error| format!("No se pudo guardar el PDF en '{}': {}", path, error))
}

fn unique_temp_path(prefix: &str) -> PathBuf {
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or_default();

    env::temp_dir().join(format!(
        "{}-{}-{}",
        prefix,
        std::process::id(),
        timestamp
    ))
}

fn browser_candidates() -> &'static [&'static str] {
    #[cfg(target_os = "macos")]
    {
        &[
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
            "/Applications/Chromium.app/Contents/MacOS/Chromium",
            "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
            "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
        ]
    }

    #[cfg(target_os = "linux")]
    {
        &[
            "/usr/bin/google-chrome",
            "/usr/bin/google-chrome-stable",
            "/usr/bin/chromium",
            "/usr/bin/chromium-browser",
            "/usr/bin/microsoft-edge",
            "/usr/bin/brave-browser",
        ]
    }

    #[cfg(target_os = "windows")]
    {
        &[
            "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
            "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
            "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
            "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
            "C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe",
        ]
    }
}

fn find_browser_on_path() -> Option<PathBuf> {
    let executable_names = [
        "google-chrome",
        "google-chrome-stable",
        "chromium",
        "chromium-browser",
        "microsoft-edge",
        "brave-browser",
        "chrome",
        "msedge",
    ];

    let path_var = env::var_os("PATH")?;
    for directory in env::split_paths(&path_var) {
        for executable_name in executable_names {
            let candidate = directory.join(executable_name);
            if candidate.is_file() {
                return Some(candidate);
            }

            #[cfg(target_os = "windows")]
            {
                let with_extension = directory.join(format!("{}.exe", executable_name));
                if with_extension.is_file() {
                    return Some(with_extension);
                }
            }
        }
    }

    None
}

fn locate_headless_browser() -> Option<PathBuf> {
    for candidate in browser_candidates() {
        let path = PathBuf::from(candidate);
        if path.exists() {
            return Some(path);
        }
    }

    find_browser_on_path()
}

#[tauri::command]
fn export_pdf_html(path: String, html: String) -> Result<(), String> {
    let browser_path = locate_headless_browser().ok_or_else(|| {
        "No se encontró un navegador compatible para exportar PDF. Instala Google Chrome, Chromium, Edge o Brave."
            .to_string()
    })?;

    let target_path = PathBuf::from(&path);
    if let Some(parent_directory) = target_path.parent() {
        fs::create_dir_all(parent_directory).map_err(|error| {
            format!(
                "No se pudo preparar la carpeta de salida '{}': {}",
                parent_directory.display(),
                error
            )
        })?;
    }

    let temp_directory = unique_temp_path("markdown-pedagogico-pdf");
    fs::create_dir_all(&temp_directory).map_err(|error| {
        format!(
            "No se pudo preparar la carpeta temporal '{}': {}",
            temp_directory.display(),
            error
        )
    })?;

    let result = (|| {
        let html_path = temp_directory.join("documento.html");
        let profile_directory = temp_directory.join("profile");

        fs::create_dir_all(&profile_directory).map_err(|error| {
            format!(
                "No se pudo preparar el perfil temporal '{}': {}",
                profile_directory.display(),
                error
            )
        })?;

        fs::write(&html_path, html).map_err(|error| {
            format!(
                "No se pudo crear el HTML temporal '{}': {}",
                html_path.display(),
                error
            )
        })?;

        let file_url = Url::from_file_path(&html_path)
            .map_err(|_| {
                format!(
                    "No se pudo convertir '{}' en una URL de archivo válida.",
                    html_path.display()
                )
            })?
            .to_string();

        let _ = fs::remove_file(&target_path);

        let mut child = Command::new(&browser_path)
            .arg("--headless")
            .arg("--disable-gpu")
            .arg("--hide-scrollbars")
            .arg("--run-all-compositor-stages-before-draw")
            .arg("--virtual-time-budget=12000")
            .arg("--allow-file-access-from-files")
            .arg("--no-first-run")
            .arg("--no-default-browser-check")
            .arg("--no-pdf-header-footer")
            .arg("--print-to-pdf-no-header")
            .arg(format!(
                "--user-data-dir={}",
                profile_directory.as_os_str().to_string_lossy()
            ))
            .arg(format!(
                "--print-to-pdf={}",
                target_path.as_os_str().to_string_lossy()
            ))
            .arg(file_url)
            .spawn()
            .map_err(|error| {
                format!(
                    "No se pudo ejecutar '{}' para exportar el PDF: {}",
                    browser_path.display(),
                    error
                )
            })?;

        let mut last_pdf_size = 0_u64;
        let mut stable_size_checks = 0_u8;
        let timeout = Duration::from_secs(25);
        let started_at = Instant::now();

        while started_at.elapsed() <= timeout {
            if let Some(status) = child.try_wait().map_err(|error| {
                format!(
                    "No se pudo comprobar el estado del navegador '{}': {}",
                    browser_path.display(),
                    error
                )
            })? {
                if !status.success() {
                    return Err(format!(
                        "El navegador terminó antes de completar la impresión del PDF ({status})."
                    ));
                }

                break;
            }

            if let Ok(metadata) = fs::metadata(&target_path) {
                let current_size = metadata.len();
                if current_size > 0 {
                    if current_size == last_pdf_size {
                        stable_size_checks = stable_size_checks.saturating_add(1);
                    } else {
                        stable_size_checks = 0;
                        last_pdf_size = current_size;
                    }

                    if stable_size_checks >= 2 {
                        break;
                    }
                }
            }

            thread::sleep(Duration::from_millis(200));
        }

        let _ = child.kill();
        let _ = child.wait();

        if let Ok(metadata) = fs::metadata(&target_path) {
            if metadata.len() == 0 {
                return Err(format!(
                    "El PDF generado en '{}' quedó vacío.",
                    target_path.display()
                ));
            }
        } else {
            return Err(format!(
                "El navegador no terminó de generar el PDF en '{}' dentro del tiempo esperado.",
                target_path.display()
            ));
        }

        let metadata = fs::metadata(&target_path).map_err(|error| {
            format!(
                "El PDF no se generó correctamente en '{}': {}",
                target_path.display(),
                error
            )
        })?;

        if metadata.len() == 0 {
            return Err(format!(
                "El PDF generado en '{}' quedó vacío.",
                target_path.display()
            ));
        }

        Ok(())
    })();

    let _ = fs::remove_dir_all(&temp_directory);
    result
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            export_document,
            export_pdf_bytes,
            export_pdf_html
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
