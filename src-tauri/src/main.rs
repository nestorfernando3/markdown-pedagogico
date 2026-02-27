// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
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

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![export_document, export_pdf_bytes])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
