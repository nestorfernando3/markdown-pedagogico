import React from 'react';
import type { EditorHandle } from './editorHandle';

interface LegacyTextareaEditorProps {
  content: string;
  onChange: (nextValue: string, selectionStart: number) => void;
  onScroll: (scrollTop: number) => void;
  onSelect: (selectionStart: number, selectionEnd: number, nextValue: string) => void;
  onPointerUp: (selectionStart: number, selectionEnd: number, anchorPoint: { x: number; y: number }) => void;
  onKeyUp: (selectionStart: number, selectionEnd: number) => void;
  onTabIndentation: (selectionStart: number, selectionEnd: number, shiftKey: boolean) => boolean;
}

export const LegacyTextareaEditor = React.forwardRef<EditorHandle, LegacyTextareaEditorProps>(function LegacyTextareaEditor(
  {
    content,
    onChange,
    onScroll,
    onSelect,
    onPointerUp,
    onKeyUp,
    onTabIndentation,
  },
  ref
) {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  React.useImperativeHandle(
    ref,
    () => ({
      focus: () => {
        textareaRef.current?.focus();
      },
      getBoundingClientRect: () => textareaRef.current?.getBoundingClientRect() ?? new DOMRect(),
      getScrollTop: () => textareaRef.current?.scrollTop ?? 0,
      getSelection: () => ({
        start: textareaRef.current?.selectionStart ?? 0,
        end: textareaRef.current?.selectionEnd ?? 0,
      }),
      getTextMetrics: () => {
        const textarea = textareaRef.current;
        const styles = textarea ? window.getComputedStyle(textarea) : null;
        return {
          font: styles?.font ?? '16px monospace',
          fontSize: Number.parseFloat(styles?.fontSize ?? '16') || 16,
          lineHeight: Number.parseFloat(styles?.lineHeight ?? '28') || 28,
          paddingLeft: Number.parseFloat(styles?.paddingLeft ?? '0') || 0,
          paddingTop: Number.parseFloat(styles?.paddingTop ?? '0') || 0,
          paddingRight: Number.parseFloat(styles?.paddingRight ?? '0') || 0,
        };
      },
      getValue: () => textareaRef.current?.value ?? '',
      isFocused: () => document.activeElement === textareaRef.current,
      setScrollTop: (scrollTop: number) => {
        if (textareaRef.current) {
          textareaRef.current.scrollTop = scrollTop;
        }
      },
      setSelection: (start: number, end: number) => {
        textareaRef.current?.setSelectionRange(start, end);
      },
    }),
    []
  );

  return (
    <textarea
      ref={textareaRef}
      value={content}
      onChange={(event) => onChange(event.target.value, event.target.selectionStart)}
      onScroll={(event) => onScroll(event.currentTarget.scrollTop)}
      onSelect={(event) =>
        onSelect(event.currentTarget.selectionStart, event.currentTarget.selectionEnd, event.currentTarget.value)
      }
      onMouseUp={(event) =>
        onPointerUp(event.currentTarget.selectionStart, event.currentTarget.selectionEnd, {
          x: event.clientX,
          y: event.clientY,
        })
      }
      onKeyDown={(event) => {
        if (event.key !== 'Tab') {
          return;
        }

        const handled = onTabIndentation(event.currentTarget.selectionStart, event.currentTarget.selectionEnd, event.shiftKey);
        if (handled) {
          event.preventDefault();
        }
      }}
      onKeyUp={(event) => onKeyUp(event.currentTarget.selectionStart, event.currentTarget.selectionEnd)}
      className="absolute inset-0 w-full h-full bg-transparent resize-none outline-none text-lg text-slate-800 dark:text-slate-200 font-mono leading-7 py-8 pr-8 pl-[4.5rem] rounded-3xl dark:caret-indigo-400 caret-indigo-600 z-10"
      placeholder="Escribe tu idea aquí usando Markdown..."
      spellCheck={false}
      aria-label="Editor de contenido Markdown"
      aria-labelledby="editor-section-title"
    />
  );
});
