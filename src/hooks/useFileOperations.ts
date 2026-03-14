import { useCallback, useEffect, useRef, useState } from 'react';
import { isTauriRuntime, openMarkdownFileInBrowser, saveTextFileInBrowser, writeTextToBrowserFile } from '../utils/runtime';

export interface UseFileOperationsOptions {
  content: string;
  onContentChange: (next: string) => void;
}

export interface UseFileOperationsResult {
  openMarkdown: () => Promise<void>;
  saveMarkdown: (nextContent: string) => Promise<void>;
  saveAsMarkdown: (nextContent: string) => Promise<void>;
  currentPath: string | null;
  isDirty: boolean;
  isSaving: boolean;
  lastSaveStatus: 'idle' | 'success' | 'error';
}

export function useFileOperations({ content, onContentChange }: UseFileOperationsOptions): UseFileOperationsResult {
  const [currentPath, setCurrentPath] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaveStatus, setLastSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const lastPersistedContentRef = useRef(content);
  const browserFileHandleRef = useRef<FileSystemFileHandle | null>(null);
  const saveFeedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setIsDirty(content !== lastPersistedContentRef.current);
  }, [content]);

  useEffect(() => {
    return () => {
      if (saveFeedbackTimeoutRef.current) {
        clearTimeout(saveFeedbackTimeoutRef.current);
      }
    };
  }, []);

  const commitPersistedState = useCallback((nextPath: string | null, nextContent: string) => {
    setCurrentPath(nextPath);
    lastPersistedContentRef.current = nextContent;
    setIsDirty(false);
  }, []);

  const persistToPath = useCallback(async (path: string, nextContent: string): Promise<boolean> => {
    if (isTauriRuntime()) {
      const { invoke } = await import('@tauri-apps/api/tauri');
      await invoke('export_document', {
        path,
        content: nextContent,
      });
      return true;
    }

    if (browserFileHandleRef.current) {
      await writeTextToBrowserFile(browserFileHandleRef.current, nextContent);
      return true;
    }

    const savedFile = await saveTextFileInBrowser(nextContent, path, 'documento.md');
    if (!savedFile) {
      return false;
    }

    if (savedFile?.handle) {
      browserFileHandleRef.current = savedFile.handle;
    }
    return true;
  }, []);

  const saveAsMarkdown = useCallback(async (nextContent: string) => {
    setIsSaving(true);
    setLastSaveStatus('idle');

    try {
      const path = isTauriRuntime()
        ? await (await import('@tauri-apps/api/dialog')).save({
            title: 'Guardar archivo Markdown',
            defaultPath: 'documento.md',
            filters: [{ name: 'Markdown', extensions: ['md'] }],
          })
        : null;

      if (!isTauriRuntime()) {
        const savedFile = await saveTextFileInBrowser(nextContent, currentPath ?? 'documento.md', 'documento.md');
        if (!savedFile) {
          setLastSaveStatus('idle');
          return;
        }

        browserFileHandleRef.current = savedFile.handle ?? null;
        commitPersistedState(savedFile.name, nextContent);
        setLastSaveStatus('success');

        if (saveFeedbackTimeoutRef.current) {
          clearTimeout(saveFeedbackTimeoutRef.current);
        }
        saveFeedbackTimeoutRef.current = setTimeout(() => {
          setLastSaveStatus('idle');
        }, 3000);
        return;
      }

      if (!path) {
        setLastSaveStatus('idle');
        return;
      }

      const saved = await persistToPath(path, nextContent);
      if (!saved) {
        setLastSaveStatus('idle');
        return;
      }

      commitPersistedState(path, nextContent);
      setLastSaveStatus('success');

      if (saveFeedbackTimeoutRef.current) {
        clearTimeout(saveFeedbackTimeoutRef.current);
      }
      saveFeedbackTimeoutRef.current = setTimeout(() => {
        setLastSaveStatus('idle');
      }, 3000);
    } catch (error) {
      console.error('Error al guardar archivo:', error);
      setLastSaveStatus('error');
      window.alert('No se pudo guardar el archivo. Revisa la ruta e inténtalo de nuevo.');
    } finally {
      setIsSaving(false);
    }
  }, [commitPersistedState, currentPath, persistToPath]);

  const saveMarkdown = useCallback(async (nextContent: string) => {
    if (!currentPath) {
      await saveAsMarkdown(nextContent);
      return;
    }

    setIsSaving(true);
    setLastSaveStatus('idle');

    try {
      const saved = await persistToPath(currentPath, nextContent);
      if (!saved) {
        setLastSaveStatus('idle');
        return;
      }

      commitPersistedState(currentPath, nextContent);
      setLastSaveStatus('success');

      if (saveFeedbackTimeoutRef.current) {
        clearTimeout(saveFeedbackTimeoutRef.current);
      }
      saveFeedbackTimeoutRef.current = setTimeout(() => {
        setLastSaveStatus('idle');
      }, 3000);
    } catch (error) {
      console.error('Error al guardar archivo:', error);
      setLastSaveStatus('error');
      window.alert('No se pudo guardar el archivo. Revisa la ruta e inténtalo de nuevo.');
    } finally {
      setIsSaving(false);
    }
  }, [commitPersistedState, currentPath, persistToPath, saveAsMarkdown]);

  const openMarkdown = useCallback(async () => {
    if (isDirty) {
      const shouldDiscard = window.confirm('Tienes cambios sin guardar. ¿Deseas descartarlos y abrir otro archivo?');
      if (!shouldDiscard) {
        return;
      }
    }

    try {
      if (!isTauriRuntime()) {
        const openedFile = await openMarkdownFileInBrowser();
        if (!openedFile) {
          return;
        }

        onContentChange(openedFile.content);
        browserFileHandleRef.current = openedFile.handle ?? null;
        commitPersistedState(openedFile.name, openedFile.content);
        setLastSaveStatus('idle');
        return;
      }

      const { open: openDialog } = await import('@tauri-apps/api/dialog');
      const selected = await openDialog({
        title: 'Abrir archivo Markdown',
        multiple: false,
        filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }],
      });

      if (!selected || Array.isArray(selected)) {
        return;
      }

      const { readTextFile } = await import('@tauri-apps/api/fs');
      const loadedContent = await readTextFile(selected);
      onContentChange(loadedContent);
      browserFileHandleRef.current = null;
      commitPersistedState(selected, loadedContent);
      setLastSaveStatus('idle');
    } catch (error) {
      console.error('Error al abrir archivo:', error);
      window.alert('No se pudo abrir el archivo seleccionado.');
    }
  }, [commitPersistedState, isDirty, onContentChange]);

  return {
    openMarkdown,
    saveMarkdown,
    saveAsMarkdown,
    currentPath,
    isDirty,
    isSaving,
    lastSaveStatus,
  };
}
