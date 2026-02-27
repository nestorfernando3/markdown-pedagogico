import { useCallback, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, RefObject } from 'react';
import type { MarkdownAction } from '../../components/Editor/TooltipContextual';
import type { PedagogicalWarning } from '../../utils/markdownParser';
import type { TooltipState } from '../useTooltipState';

const LINE_HEIGHT_PX = 28;

function caretFromOffset(text: string, offset: number): { line: number; column: number } {
  const safeOffset = Math.max(0, Math.min(offset, text.length));
  const before = text.slice(0, safeOffset);
  const line = before.split('\n').length;
  const lastBreak = before.lastIndexOf('\n');
  const column = safeOffset - lastBreak;

  return {
    line,
    column,
  };
}

interface UseEditorInteractionsOptions {
  editorRef: RefObject<HTMLTextAreaElement | null>;
  content: string;
  setContent: (next: string) => void;
  tooltipState: TooltipState;
  hideTooltip: () => void;
  showFormatTooltip: (anchorRect: DOMRect) => void;
  togglePedagogyTooltip: (warning: PedagogicalWarning, markerRect: DOMRect) => void;
}

export interface UseEditorInteractionsResult {
  caretPosition: { line: number; column: number };
  editorScrollTop: number;
  onEditorScroll: (scrollTop: number) => void;
  handleEditorChange: (nextValue: string, selectionStart: number) => void;
  handleEditorKeyUp: (selectionStart: number) => void;
  handleEditorClick: (selectionStart: number, selectionEnd: number) => void;
  handleSelect: () => void;
  handleFormatAction: (action: MarkdownAction) => void;
  handleApplyFix: () => void;
  handleTabIndentation: (event: ReactKeyboardEvent<HTMLTextAreaElement>) => void;
  handleJumpToWarning: (warning: PedagogicalWarning) => void;
  handleToggleWarning: (warning: PedagogicalWarning | null, markerRect?: DOMRect, trigger?: HTMLElement) => void;
  handleTooltipClose: () => void;
  focusTooltipTrigger: () => void;
}

export function useEditorInteractions({
  editorRef,
  content,
  setContent,
  tooltipState,
  hideTooltip,
  showFormatTooltip,
  togglePedagogyTooltip,
}: UseEditorInteractionsOptions): UseEditorInteractionsResult {
  const [caretPosition, setCaretPosition] = useState({ line: 1, column: 1 });
  const [editorScrollTop, setEditorScrollTop] = useState(0);
  const tooltipTriggerRef = useRef<HTMLElement | null>(null);

  const updateCaretFromSelection = useCallback(
    (selectionStart: number, nextText: string = content) => {
      setCaretPosition(caretFromOffset(nextText, selectionStart));
    },
    [content]
  );

  const replaceSelection = useCallback(
    (
      textarea: HTMLTextAreaElement,
      replacement: string,
      selectionStartAfter: number,
      selectionEndAfter: number
    ) => {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const nextContent = content.slice(0, start) + replacement + content.slice(end);

      setContent(nextContent);

      requestAnimationFrame(() => {
        textarea.focus();
        textarea.setSelectionRange(selectionStartAfter, selectionEndAfter);
        updateCaretFromSelection(selectionEndAfter, nextContent);
      });
    },
    [content, setContent, updateCaretFromSelection]
  );

  const handleFormatAction = useCallback(
    (action: MarkdownAction) => {
      const textarea = editorRef.current;
      if (!textarea) {
        return;
      }

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selectedText = content.slice(start, end);

      let replacement = selectedText;
      let selectionStartAfter = start;
      let selectionEndAfter = start;

      switch (action) {
        case 'bold': {
          if (selectedText.length === 0) {
            replacement = '**texto**';
            selectionStartAfter = start + 2;
            selectionEndAfter = start + 7;
          } else {
            replacement = `**${selectedText}**`;
            selectionStartAfter = start + 2;
            selectionEndAfter = start + 2 + selectedText.length;
          }
          break;
        }
        case 'italic': {
          if (selectedText.length === 0) {
            replacement = '*texto*';
            selectionStartAfter = start + 1;
            selectionEndAfter = start + 6;
          } else {
            replacement = `*${selectedText}*`;
            selectionStartAfter = start + 1;
            selectionEndAfter = start + 1 + selectedText.length;
          }
          break;
        }
        case 'header': {
          replacement = `\n# ${selectedText || 'Título'}\n`;
          selectionStartAfter = start + 3;
          selectionEndAfter = start + 3 + (selectedText.length || 'Título'.length);
          break;
        }
        case 'list': {
          const lines = (selectedText || 'Ítem')
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter((line) => line.length > 0);

          replacement = `\n${lines.map((line) => (/^[-*+]\s+/.test(line) ? line : `- ${line}`)).join('\n')}\n`;
          selectionStartAfter = start + 1;
          selectionEndAfter = start + replacement.length - 1;
          break;
        }
      }

      replaceSelection(textarea, replacement, selectionStartAfter, selectionEndAfter);
      hideTooltip();
    },
    [content, editorRef, hideTooltip, replaceSelection]
  );

  const handleApplyFix = useCallback(() => {
    if (!tooltipState.warning?.replacementConfig) {
      return;
    }

    const textarea = editorRef.current;
    if (!textarea) {
      return;
    }

    const { startOffset, endOffset, newText } = tooltipState.warning.replacementConfig;
    const nextContent = content.slice(0, startOffset) + newText + content.slice(endOffset);
    const caretOffset = startOffset + newText.length;

    setContent(nextContent);
    hideTooltip();

    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(caretOffset, caretOffset);
      textarea.scrollTop = Math.max(0, (tooltipState.warning?.line ?? 1) * LINE_HEIGHT_PX - LINE_HEIGHT_PX * 2);
      setEditorScrollTop(textarea.scrollTop);
      updateCaretFromSelection(caretOffset, nextContent);
    });
  }, [content, editorRef, hideTooltip, setContent, tooltipState.warning, updateCaretFromSelection]);

  const handleToggleWarning = useCallback(
    (warning: PedagogicalWarning | null, markerRect?: DOMRect, trigger?: HTMLElement) => {
      if (!warning || !markerRect) {
        hideTooltip();
        return;
      }

      tooltipTriggerRef.current = trigger ?? null;
      togglePedagogyTooltip(warning, markerRect);
    },
    [hideTooltip, togglePedagogyTooltip]
  );

  const handleSelect = useCallback(() => {
    const textarea = editorRef.current;
    if (!textarea) {
      return;
    }

    updateCaretFromSelection(textarea.selectionStart, textarea.value);

    const hasSelection = textarea.selectionStart !== textarea.selectionEnd;
    if (hasSelection && !(tooltipState.visible && tooltipState.type === 'pedagogy')) {
      showFormatTooltip(textarea.getBoundingClientRect());
      return;
    }

    if (tooltipState.type === 'format' && !hasSelection) {
      hideTooltip();
    }
  }, [editorRef, hideTooltip, showFormatTooltip, tooltipState.type, tooltipState.visible, updateCaretFromSelection]);

  const handleTabIndentation = useCallback(
    (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
      const textarea = editorRef.current;
      if (!textarea || event.key !== 'Tab') {
        return;
      }

      event.preventDefault();

      const selectionStart = textarea.selectionStart;
      const selectionEnd = textarea.selectionEnd;
      const blockStart = content.lastIndexOf('\n', Math.max(0, selectionStart - 1)) + 1;
      const blockEndBreak = content.indexOf('\n', selectionEnd);
      const blockEnd = blockEndBreak === -1 ? content.length : blockEndBreak;
      const block = content.slice(blockStart, blockEnd);
      const lines = block.split('\n');

      let nextLines = lines;
      let nextSelectionStart = selectionStart;
      let nextSelectionEnd = selectionEnd;

      if (!event.shiftKey) {
        nextLines = lines.map((line) => `  ${line}`);
        nextSelectionStart = selectionStart + 2;
        nextSelectionEnd = selectionEnd + 2 * lines.length;
      } else {
        const removedByLine = lines.map((line) => {
          if (line.startsWith('  ')) {
            return 2;
          }
          if (line.startsWith('\t') || line.startsWith(' ')) {
            return 1;
          }
          return 0;
        });

        nextLines = lines.map((line, index) => line.slice(removedByLine[index]));
        const totalRemoved = removedByLine.reduce((sum, value) => sum + value, 0);
        nextSelectionStart = Math.max(blockStart, selectionStart - removedByLine[0]);
        nextSelectionEnd = Math.max(nextSelectionStart, selectionEnd - totalRemoved);
      }

      const replacement = nextLines.join('\n');
      const nextContent = content.slice(0, blockStart) + replacement + content.slice(blockEnd);

      setContent(nextContent);

      requestAnimationFrame(() => {
        textarea.focus();
        textarea.setSelectionRange(nextSelectionStart, nextSelectionEnd);
        updateCaretFromSelection(nextSelectionEnd, nextContent);
      });
    },
    [content, editorRef, setContent, updateCaretFromSelection]
  );

  const handleJumpToWarning = useCallback(
    (warning: PedagogicalWarning) => {
      const textarea = editorRef.current;
      if (!textarea) {
        return;
      }

      const start = warning.offset;
      const end = warning.offset + warning.length;

      textarea.focus();
      textarea.setSelectionRange(start, end);
      const nextScrollTop = Math.max(0, (warning.line - 1) * LINE_HEIGHT_PX - LINE_HEIGHT_PX * 2);
      textarea.scrollTop = nextScrollTop;
      setEditorScrollTop(nextScrollTop);
      updateCaretFromSelection(start, content);

      hideTooltip();
    },
    [content, editorRef, hideTooltip, updateCaretFromSelection]
  );

  const focusTooltipTrigger = useCallback(() => {
    tooltipTriggerRef.current?.focus();
  }, []);

  const handleTooltipClose = useCallback(() => {
    hideTooltip();
    focusTooltipTrigger();
  }, [focusTooltipTrigger, hideTooltip]);

  const onEditorScroll = useCallback((scrollTop: number) => {
    setEditorScrollTop(scrollTop);
  }, []);

  const handleEditorChange = useCallback(
    (nextValue: string, selectionStart: number) => {
      setContent(nextValue);
      updateCaretFromSelection(selectionStart, nextValue);
    },
    [setContent, updateCaretFromSelection]
  );

  const handleEditorKeyUp = useCallback(
    (selectionStart: number) => {
      updateCaretFromSelection(selectionStart);
    },
    [updateCaretFromSelection]
  );

  const handleEditorClick = useCallback(
    (selectionStart: number, selectionEnd: number) => {
      if (tooltipState.visible && selectionStart === selectionEnd) {
        hideTooltip();
      }
    },
    [hideTooltip, tooltipState.visible]
  );

  return {
    caretPosition,
    editorScrollTop,
    onEditorScroll,
    handleEditorChange,
    handleEditorKeyUp,
    handleEditorClick,
    handleSelect,
    handleFormatAction,
    handleApplyFix,
    handleTabIndentation,
    handleJumpToWarning,
    handleToggleWarning,
    handleTooltipClose,
    focusTooltipTrigger,
  };
}
