import React from 'react';
import { autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap } from '@codemirror/autocomplete';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';
import { bracketMatching, defaultHighlightStyle, indentOnInput, syntaxHighlighting } from '@codemirror/language';
import { EditorState } from '@codemirror/state';
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search';
import { drawSelection, EditorView, highlightActiveLine, highlightSpecialChars, keymap, placeholder, rectangularSelection } from '@codemirror/view';
import type { EditorHandle } from './editorHandle';

interface MarkdownCodeMirrorProps {
  content: string;
  onChange: (nextValue: string, selectionStart: number) => void;
  onScroll: (scrollTop: number) => void;
  onSelect: (selectionStart: number, selectionEnd: number, nextValue: string) => void;
  onPointerUp: (selectionStart: number, selectionEnd: number, anchorPoint: { x: number; y: number }) => void;
  onKeyUp: (selectionStart: number, selectionEnd: number) => void;
  onTabIndentation: (selectionStart: number, selectionEnd: number, shiftKey: boolean) => boolean;
}

const codeMirrorTheme = EditorView.theme({
  '&': {
    height: '100%',
    backgroundColor: 'transparent',
    color: 'inherit',
    fontFamily: 'inherit',
    fontSize: '1.125rem',
  },
  '.cm-scroller': {
    overflow: 'auto',
    padding: '2rem 2rem 2rem 4.5rem',
    fontFamily: 'inherit',
    lineHeight: '28px',
  },
  '.cm-content': {
    minHeight: '100%',
    caretColor: '#4f46e5',
  },
  '.cm-line': {
    padding: '0',
  },
  '.cm-focused': {
    outline: 'none',
  },
  '.cm-selectionBackground, .cm-content ::selection': {
    backgroundColor: 'rgba(99, 102, 241, 0.18)',
  },
  '.cm-placeholder': {
    color: '#94a3b8',
    fontStyle: 'italic',
  },
});

function anchorPointFromView(view: EditorView, selectionEnd: number): { x: number; y: number } {
  const safePosition = Math.max(0, Math.min(selectionEnd, view.state.doc.length));
  const coordinates = view.coordsAtPos(safePosition) ?? view.coordsAtPos(Math.max(0, safePosition - 1));
  const rect = view.dom.getBoundingClientRect();

  if (!coordinates) {
    return {
      x: rect.left + 96,
      y: rect.top + 72,
    };
  }

  return {
    x: coordinates.right,
    y: coordinates.bottom,
  };
}

export const MarkdownCodeMirror = React.forwardRef<EditorHandle, MarkdownCodeMirrorProps>(function MarkdownCodeMirror(
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
  const isJsdomEnvironment = typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const viewRef = React.useRef<EditorView | null>(null);
  const applyingExternalChangeRef = React.useRef(false);
  const callbacksRef = React.useRef({
    onChange,
    onScroll,
    onSelect,
    onPointerUp,
    onKeyUp,
    onTabIndentation,
  });

  React.useEffect(() => {
    callbacksRef.current = {
      onChange,
      onScroll,
      onSelect,
      onPointerUp,
      onKeyUp,
      onTabIndentation,
    };
  }, [onChange, onKeyUp, onPointerUp, onScroll, onSelect, onTabIndentation]);

  React.useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const state = EditorState.create({
      doc: content,
      extensions: [
        EditorState.allowMultipleSelections.of(true),
        markdown(),
        history(),
        highlightSpecialChars(),
        ...(isJsdomEnvironment ? [] : [drawSelection(), rectangularSelection(), highlightActiveLine()]),
        indentOnInput(),
        bracketMatching(),
        closeBrackets(),
        autocompletion(),
        ...(isJsdomEnvironment ? [] : [highlightSelectionMatches()]),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        EditorView.lineWrapping,
        placeholder('Escribe tu idea aquí usando Markdown...'),
        keymap.of([
          ...defaultKeymap,
          ...historyKeymap,
          ...searchKeymap,
          ...closeBracketsKeymap,
          ...completionKeymap,
          {
            key: 'Tab',
            preventDefault: true,
            run: (view) =>
              callbacksRef.current.onTabIndentation(view.state.selection.main.from, view.state.selection.main.to, false),
            shift: (view) =>
              callbacksRef.current.onTabIndentation(view.state.selection.main.from, view.state.selection.main.to, true),
          },
          indentWithTab,
        ]),
        EditorView.contentAttributes.of({
          'aria-label': 'Editor de contenido Markdown',
          'aria-labelledby': 'editor-section-title',
          spellcheck: 'false',
        }),
        EditorView.domEventHandlers({
          mouseup: (_event, view) => {
            const selection = view.state.selection.main;
            callbacksRef.current.onPointerUp(selection.from, selection.to, anchorPointFromView(view, selection.to));
            return false;
          },
          keyup: (_event, view) => {
            const selection = view.state.selection.main;
            callbacksRef.current.onKeyUp(selection.from, selection.to);
            return false;
          },
          scroll: (_event, view) => {
            callbacksRef.current.onScroll(view.scrollDOM.scrollTop);
            return false;
          },
        }),
        EditorView.updateListener.of((update) => {
          const selection = update.state.selection.main;
          const nextValue = update.state.doc.toString();

          if (update.selectionSet || update.docChanged) {
            callbacksRef.current.onSelect(selection.from, selection.to, nextValue);
          }

          if (update.docChanged && !applyingExternalChangeRef.current) {
            callbacksRef.current.onChange(nextValue, selection.head);
          }
        }),
        codeMirrorTheme,
      ],
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;
    callbacksRef.current.onScroll(view.scrollDOM.scrollTop);

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [isJsdomEnvironment]);

  React.useEffect(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }

    const currentValue = view.state.doc.toString();
    if (content === currentValue) {
      return;
    }

    const selection = view.state.selection.main;
    const maxOffset = content.length;
    const nextAnchor = Math.min(selection.anchor, maxOffset);
    const nextHead = Math.min(selection.head, maxOffset);

    applyingExternalChangeRef.current = true;
    view.dispatch({
      changes: {
        from: 0,
        to: currentValue.length,
        insert: content,
      },
      selection: {
        anchor: nextAnchor,
        head: nextHead,
      },
    });
    applyingExternalChangeRef.current = false;
  }, [content]);

  React.useImperativeHandle(
    ref,
    () => ({
      focus: () => {
        viewRef.current?.focus();
      },
      getBoundingClientRect: () => viewRef.current?.dom.getBoundingClientRect() ?? new DOMRect(),
      getScrollTop: () => viewRef.current?.scrollDOM.scrollTop ?? 0,
      getSelection: () => {
        const selection = viewRef.current?.state.selection.main;
        return {
          start: selection?.from ?? 0,
          end: selection?.to ?? 0,
        };
      },
      getTextMetrics: () => {
        const contentNode = viewRef.current?.contentDOM;
        const scrollerNode = viewRef.current?.scrollDOM;
        const styles = contentNode ? window.getComputedStyle(contentNode) : null;
        const scrollerStyles = scrollerNode ? window.getComputedStyle(scrollerNode) : null;

        return {
          font: styles?.font ?? scrollerStyles?.font ?? '16px monospace',
          fontSize: Number.parseFloat(styles?.fontSize ?? scrollerStyles?.fontSize ?? '16') || 16,
          lineHeight: Number.parseFloat(styles?.lineHeight ?? scrollerStyles?.lineHeight ?? '28') || 28,
          paddingLeft: Number.parseFloat(scrollerStyles?.paddingLeft ?? '0') || 0,
          paddingTop: Number.parseFloat(scrollerStyles?.paddingTop ?? '0') || 0,
          paddingRight: Number.parseFloat(scrollerStyles?.paddingRight ?? '0') || 0,
        };
      },
      getValue: () => viewRef.current?.state.doc.toString() ?? '',
      isFocused: () => viewRef.current?.hasFocus ?? false,
      setScrollTop: (scrollTop: number) => {
        if (viewRef.current) {
          viewRef.current.scrollDOM.scrollTop = scrollTop;
        }
      },
      setSelection: (start: number, end: number) => {
        const view = viewRef.current;
        if (!view) {
          return;
        }

        const maxOffset = view.state.doc.length;
        const safeStart = Math.max(0, Math.min(start, maxOffset));
        const safeEnd = Math.max(safeStart, Math.min(end, maxOffset));

        view.dispatch({
          selection: {
            anchor: safeStart,
            head: safeEnd,
          },
          scrollIntoView: true,
        });
      },
    }),
    []
  );

  return <div ref={containerRef} className="absolute inset-0 z-10" data-editor-engine="codemirror" />;
});
