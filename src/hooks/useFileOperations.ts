import { open as openDialog, save as saveDialog } from '@tauri-apps/api/dialog';
import { readTextFile } from '@tauri-apps/api/fs';
import { invoke } from '@tauri-apps/api/tauri';
import { useCallback, useEffect, useRef, useState } from 'react';

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

  const persistToPath = useCallback(async (path: string, nextContent: string) => {
    await invoke('export_document', {
      path,
      content: nextContent,
    });
  }, []);

  const saveAsMarkdown = useCallback(async (nextContent: string) => {
    setIsSaving(true);
    setLastSaveStatus('idle');

    try {
      const path = await saveDialog({
        title: 'Guardar archivo Markdown',
        defaultPath: 'documento.md',
        filters: [{ name: 'Markdown', extensions: ['md'] }],
      });

      if (!path) {
        setLastSaveStatus('idle');
        return;
      }

      await persistToPath(path, nextContent);
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
  }, [commitPersistedState, persistToPath]);

  const saveMarkdown = useCallback(async (nextContent: string) => {
    if (!currentPath) {
      await saveAsMarkdown(nextContent);
      return;
    }

    setIsSaving(true);
    setLastSaveStatus('idle');

    try {
      await persistToPath(currentPath, nextContent);
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
      const selected = await openDialog({
        title: 'Abrir archivo Markdown',
        multiple: false,
        filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }],
      });

      if (!selected || Array.isArray(selected)) {
        return;
      }

      const loadedContent = await readTextFile(selected);
      onContentChange(loadedContent);
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
