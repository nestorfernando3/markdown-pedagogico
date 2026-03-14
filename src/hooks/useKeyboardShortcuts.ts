import { useEffect } from 'react';
import type { RefObject } from 'react';
import type { EditorHandle } from '../components/Editor/editorHandle';

interface UseKeyboardShortcutsOptions {
  editorRef: RefObject<EditorHandle | null>;
  onBold: () => void;
  onItalic: () => void;
  onOpen: () => void;
  onSave: () => void;
  onExportPdf: () => void;
}

export function useKeyboardShortcuts({
  editorRef,
  onBold,
  onItalic,
  onOpen,
  onSave,
  onExportPdf,
}: UseKeyboardShortcutsOptions): void {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isModifierPressed = event.metaKey || event.ctrlKey;
      if (!isModifierPressed) {
        return;
      }

      const key = event.key.toLowerCase();
      const isEditorFocused = editorRef.current?.isFocused() ?? false;

      if (key === 'b' && isEditorFocused) {
        event.preventDefault();
        onBold();
        return;
      }

      if (key === 'i' && isEditorFocused) {
        event.preventDefault();
        onItalic();
        return;
      }

      if (key === 'o') {
        event.preventDefault();
        onOpen();
        return;
      }

      if (key === 's') {
        event.preventDefault();
        onSave();
        return;
      }

      if (key === 'e' && event.shiftKey) {
        event.preventDefault();
        onExportPdf();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editorRef, onBold, onExportPdf, onItalic, onOpen, onSave]);
}
