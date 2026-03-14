interface TauriWindow extends Window {
  __TAURI_IPC__?: unknown;
}

export interface BrowserOpenedFile {
  name: string;
  content: string;
  handle?: FileSystemFileHandle;
}

export interface BrowserSavedFile {
  name: string;
  handle?: FileSystemFileHandle;
}

function safeFilename(pathOrName: string | null | undefined, fallback: string): string {
  if (!pathOrName) {
    return fallback;
  }

  const normalized = pathOrName.split(/[\\/]/u).pop()?.trim();
  return normalized && normalized.length > 0 ? normalized : fallback;
}

export function isTauriRuntime(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return typeof (window as TauriWindow).__TAURI_IPC__ === 'function';
}

export function downloadBlob(blob: Blob, filename: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.rel = 'noopener';
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
}

function supportsBrowserSavePicker(): boolean {
  return typeof window !== 'undefined' && 'showSaveFilePicker' in window;
}

function supportsBrowserOpenPicker(): boolean {
  return typeof window !== 'undefined' && 'showOpenFilePicker' in window;
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

async function writeToFileHandle(handle: FileSystemFileHandle, data: Blob | string): Promise<void> {
  const writable = await handle.createWritable();
  try {
    await writable.write(data);
  } finally {
    await writable.close();
  }
}

export function downloadTextFile(content: string, pathOrName?: string | null, fallback = 'documento.md'): string {
  const filename = safeFilename(pathOrName, fallback);
  downloadBlob(new Blob([content], { type: 'text/markdown;charset=utf-8' }), filename);
  return filename;
}

export function downloadBinaryFile(bytes: Uint8Array, pathOrName?: string | null, fallback = 'documento.pdf'): string {
  const filename = safeFilename(pathOrName, fallback);
  downloadBlob(new Blob([bytes], { type: 'application/pdf' }), filename);
  return filename;
}

export async function saveTextFileInBrowser(
  content: string,
  pathOrName?: string | null,
  fallback = 'documento.md'
): Promise<BrowserSavedFile | null> {
  const filename = safeFilename(pathOrName, fallback);

  if (supportsBrowserSavePicker()) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [
          {
            description: 'Markdown',
            accept: {
              'text/markdown': ['.md', '.markdown'],
              'text/plain': ['.txt'],
            },
          },
        ],
      });

      await writeToFileHandle(handle, content);
      return { name: handle.name, handle };
    } catch (error) {
      if (isAbortError(error)) {
        return null;
      }

      throw error;
    }
  }

  return {
    name: downloadTextFile(content, filename, fallback),
  };
}

export async function saveBinaryFileInBrowser(
  bytes: Uint8Array,
  pathOrName?: string | null,
  fallback = 'documento.pdf'
): Promise<BrowserSavedFile | null> {
  const filename = safeFilename(pathOrName, fallback);

  if (supportsBrowserSavePicker()) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [
          {
            description: 'PDF',
            accept: {
              'application/pdf': ['.pdf'],
            },
          },
        ],
      });

      await writeToFileHandle(handle, new Blob([bytes], { type: 'application/pdf' }));
      return { name: handle.name, handle };
    } catch (error) {
      if (isAbortError(error)) {
        return null;
      }

      throw error;
    }
  }

  return {
    name: downloadBinaryFile(bytes, filename, fallback),
  };
}

export async function writeTextToBrowserFile(handle: FileSystemFileHandle, content: string): Promise<void> {
  await writeToFileHandle(handle, content);
}

export function openMarkdownFileInBrowser(): Promise<BrowserOpenedFile | null> {
  if (supportsBrowserOpenPicker()) {
    return window
      .showOpenFilePicker({
        multiple: false,
        types: [
          {
            description: 'Markdown',
            accept: {
              'text/markdown': ['.md', '.markdown'],
              'text/plain': ['.txt'],
            },
          },
        ],
      })
      .then(async (handles) => {
        const handle = handles[0];
        if (!handle) {
          return null;
        }

        const file = await handle.getFile();
        return {
          name: file.name,
          content: await file.text(),
          handle,
        };
      })
      .catch((error) => {
        if (isAbortError(error)) {
          return null;
        }

        throw error;
      });
  }

  return new Promise((resolve) => {
    const input = document.createElement('input');
    let settled = false;
    input.type = 'file';
    input.accept = '.md,.markdown,text/markdown,text/plain';
    input.style.display = 'none';

    const cleanup = () => {
      settled = true;
      window.removeEventListener('focus', handleWindowFocus);
      input.value = '';
      input.remove();
    };

    const handleWindowFocus = () => {
      window.setTimeout(() => {
        if (settled || input.files?.length) {
          return;
        }

        cleanup();
        resolve(null);
      }, 0);
    };

    input.addEventListener(
      'change',
      async () => {
        try {
          const file = input.files?.[0];
          if (!file) {
            resolve(null);
            return;
          }

          const content = await file.text();
          resolve({
            name: file.name,
            content,
          });
        } finally {
          cleanup();
        }
      },
      { once: true }
    );

    window.addEventListener('focus', handleWindowFocus, { once: true });
    document.body.appendChild(input);
    input.click();
  });
}
