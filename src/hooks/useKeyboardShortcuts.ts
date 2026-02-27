import { useEffect } from 'react';
import type { RefObject } from 'react';

interface UseKeyboardShortcutsOptions {
  editorRef: RefObject<HTMLTextAreaElement | null>;
  onBold: () => void;
  onItalic: () => void;
  onSave: () => void;
  onExportPdf: () => void;
}

export function useKeyboardShortcuts({
  editorRef,
  onBold,
  onItalic,
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
      const isEditorFocused = document.activeElement === editorRef.current;

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
  }, [editorRef, onBold, onExportPdf, onItalic, onSave]);
}
