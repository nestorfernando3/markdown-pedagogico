import { useCallback, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { EditorHandle } from '../../components/Editor/editorHandle';
import type { MarkdownAction } from '../../components/Editor/TooltipContextual';
import type { PedagogicalWarning } from '../../utils/markdownParser';
import type { TooltipState } from '../useTooltipState';

const LINE_HEIGHT_PX = 28;

interface SelectionRange {
  start: number;
  end: number;
}

interface AnchorPoint {
  x: number;
  y: number;
}

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

function estimateFormatTooltipAnchor(editor: EditorHandle, selectionEnd: number): AnchorPoint {
  const rect = editor.getBoundingClientRect();
  const metrics = editor.getTextMetrics();
  const { line, column } = caretFromOffset(editor.getValue(), selectionEnd);
  const lineHeight = metrics.lineHeight || LINE_HEIGHT_PX;
  const paddingLeft = metrics.paddingLeft || 0;
  const paddingTop = metrics.paddingTop || 0;
  const paddingRight = metrics.paddingRight || 0;
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  if (context) {
    context.font = metrics.font;
  }

  const measuredWidth = context?.measureText('0').width ?? 0;
  const characterWidth = measuredWidth > 0 ? measuredWidth : metrics.fontSize * 0.6;
  const contentWidth = rect.width - paddingLeft - paddingRight;
  const x = rect.left + paddingLeft + Math.min(Math.max(0, contentWidth - 16), Math.max(0, column - 1) * characterWidth);
  const y = rect.top + paddingTop + (line - 1) * lineHeight - editor.getScrollTop() + lineHeight;

  return {
    x,
    y,
  };
}

interface UseEditorInteractionsOptions {
  editorRef: RefObject<EditorHandle | null>;
  content: string;
  setContent: (next: string) => void;
  tooltipState: TooltipState;
  hideTooltip: () => void;
  showFormatTooltip: (anchorPoint: AnchorPoint) => void;
  togglePedagogyTooltip: (warning: PedagogicalWarning, markerRect: DOMRect) => void;
}

export interface UseEditorInteractionsResult {
  caretPosition: { line: number; column: number };
  editorScrollTop: number;
  onEditorScroll: (scrollTop: number) => void;
  handleEditorChange: (nextValue: string, selectionStart: number) => void;
  handleEditorKeyUp: (selectionStart: number, selectionEnd: number) => void;
  handleEditorPointerUp: (selectionStart: number, selectionEnd: number, anchorPoint: AnchorPoint) => void;
  handleSelect: (selectionStart: number, selectionEnd: number, nextValue: string) => void;
  handleFormatAction: (action: MarkdownAction) => void;
  handleInsertSnippet: (
    snippet: string,
    options?: {
      placement?: 'selection' | 'append';
      selectionStartOffset?: number;
      selectionEndOffset?: number;
    }
  ) => void;
  handleApplyFix: () => void;
  handleTabIndentation: (selectionStart: number, selectionEnd: number, shiftKey: boolean) => boolean;
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
  const lastSelectionRef = useRef<SelectionRange>({ start: 0, end: 0 });

  const updateCaretFromSelection = useCallback(
    (selectionStart: number, nextText: string = content) => {
      setCaretPosition(caretFromOffset(nextText, selectionStart));
    },
    [content]
  );

  const rememberSelection = useCallback((start: number, end: number) => {
    lastSelectionRef.current = { start, end };
  }, []);

  const replaceSelection = useCallback(
    (
      editor: EditorHandle,
      selectionRange: SelectionRange,
      replacement: string,
      selectionStartAfter: number,
      selectionEndAfter: number
    ) => {
      const { start, end } = selectionRange;
      const nextContent = content.slice(0, start) + replacement + content.slice(end);

      setContent(nextContent);

      requestAnimationFrame(() => {
        editor.focus();
        editor.setSelection(selectionStartAfter, selectionEndAfter);
        rememberSelection(selectionStartAfter, selectionEndAfter);
        updateCaretFromSelection(selectionEndAfter, nextContent);
      });
    },
    [content, rememberSelection, setContent, updateCaretFromSelection]
  );

  const handleFormatAction = useCallback(
    (action: MarkdownAction) => {
      const textarea = editorRef.current;
      if (!textarea) {
        return;
      }

      const { start, end } = lastSelectionRef.current;
      const selectedText = content.slice(start, end);

      const wrapInline = (leftToken: string, rightToken: string, placeholder: string) => {
        if (selectedText.length === 0) {
          return {
            replacement: `${leftToken}${placeholder}${rightToken}`,
            selectionStartAfter: start + leftToken.length,
            selectionEndAfter: start + leftToken.length + placeholder.length,
          };
        }

        return {
          replacement: `${leftToken}${selectedText}${rightToken}`,
          selectionStartAfter: start + leftToken.length,
          selectionEndAfter: start + leftToken.length + selectedText.length,
        };
      };

      const blockList = (
        prefixBuilder: (line: string, index: number) => string,
        fallbackText: string
      ): { replacement: string; selectionStartAfter: number; selectionEndAfter: number } => {
        const lines = (selectedText || fallbackText)
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter((line) => line.length > 0);

        const safeLines = lines.length > 0 ? lines : [fallbackText];
        const formatted = safeLines.map((line, index) => prefixBuilder(line, index)).join('\n');
        const replacement = `\n${formatted}\n`;

        return {
          replacement,
          selectionStartAfter: start + 1,
          selectionEndAfter: start + replacement.length - 1,
        };
      };

      let replacement = selectedText;
      let selectionStartAfter = start;
      let selectionEndAfter = start;

      switch (action) {
        case 'bold': {
          ({ replacement, selectionStartAfter, selectionEndAfter } = wrapInline('**', '**', 'texto'));
          break;
        }
        case 'italic': {
          ({ replacement, selectionStartAfter, selectionEndAfter } = wrapInline('*', '*', 'texto'));
          break;
        }
        case 'strikethrough': {
          ({ replacement, selectionStartAfter, selectionEndAfter } = wrapInline('~~', '~~', 'texto'));
          break;
        }
        case 'underline': {
          ({ replacement, selectionStartAfter, selectionEndAfter } = wrapInline('<u>', '</u>', 'texto'));
          break;
        }
        case 'highlight': {
          ({ replacement, selectionStartAfter, selectionEndAfter } = wrapInline('==', '==', 'resaltado'));
          break;
        }
        case 'inlineCode': {
          ({ replacement, selectionStartAfter, selectionEndAfter } = wrapInline('`', '`', 'codigo'));
          break;
        }
        case 'inlineMath': {
          ({ replacement, selectionStartAfter, selectionEndAfter } = wrapInline('$', '$', 'x + y'));
          break;
        }
        case 'superscript': {
          ({ replacement, selectionStartAfter, selectionEndAfter } = wrapInline('^', '^', 'super'));
          break;
        }
        case 'subscript': {
          ({ replacement, selectionStartAfter, selectionEndAfter } = wrapInline('~', '~', 'sub'));
          break;
        }
        case 'kbd': {
          ({ replacement, selectionStartAfter, selectionEndAfter } = wrapInline('<kbd>', '</kbd>', 'Ctrl+S'));
          break;
        }
        case 'link': {
          const linkText = selectedText || 'texto';
          const linkTarget = 'https://ejemplo.com';
          replacement = `[${linkText}](${linkTarget})`;
          selectionStartAfter = start + linkText.length + 3;
          selectionEndAfter = selectionStartAfter + linkTarget.length;
          break;
        }
        case 'linkReference': {
          const referenceText = selectedText || 'texto';
          const referenceId = 'ref';
          const referenceUrl = 'https://ejemplo.com';
          const prefix = `[${referenceText}][${referenceId}]\n\n[${referenceId}]: `;

          replacement = `${prefix}${referenceUrl}`;
          selectionStartAfter = start + prefix.length;
          selectionEndAfter = selectionStartAfter + referenceUrl.length;
          break;
        }
        case 'image': {
          const altText = selectedText || 'descripcion';
          const imageTarget = 'https://ejemplo.com/imagen.png';
          replacement = `![${altText}](${imageTarget})`;
          selectionStartAfter = start + altText.length + 4;
          selectionEndAfter = selectionStartAfter + imageTarget.length;
          break;
        }
        case 'video': {
          const videoTarget = 'https://ejemplo.com/video.mp4';
          replacement = `<video controls src="${videoTarget}">\n  Tu navegador no soporta video.\n</video>`;
          const offset = replacement.indexOf(videoTarget);
          selectionStartAfter = start + offset;
          selectionEndAfter = selectionStartAfter + videoTarget.length;
          break;
        }
        case 'footnote': {
          const noteText = selectedText || 'texto';
          const noteDefinition = 'Nota al pie.';
          const prefix = `${noteText}[^1]\n\n[^1]: `;

          replacement = `${prefix}${noteDefinition}`;
          selectionStartAfter = start + prefix.length;
          selectionEndAfter = selectionStartAfter + noteDefinition.length;
          break;
        }
        case 'h1':
        case 'h2':
        case 'h3':
        case 'h4':
        case 'h5':
        case 'h6': {
          const depth =
            action === 'h1' ? 1 : action === 'h2' ? 2 : action === 'h3' ? 3 : action === 'h4' ? 4 : action === 'h5' ? 5 : 6;
          const prefix = `${'#'.repeat(depth)} `;
          const headingText = selectedText.trim() || 'Titulo';
          replacement = `\n${prefix}${headingText}\n`;
          selectionStartAfter = start + 1 + prefix.length;
          selectionEndAfter = selectionStartAfter + headingText.length;
          break;
        }
        case 'quote': {
          ({ replacement, selectionStartAfter, selectionEndAfter } = blockList((line) => `> ${line}`, 'Cita'));
          break;
        }
        case 'codeBlock': {
          const blockContent = selectedText || 'codigo';
          const opening = '\n```md\n';
          const closing = '\n```\n';
          replacement = `${opening}${blockContent}${closing}`;
          selectionStartAfter = start + opening.length;
          selectionEndAfter = selectionStartAfter + blockContent.length;
          break;
        }
        case 'mathBlock': {
          const mathContent = selectedText || 'E = mc^2';
          const opening = '\n$$\n';
          const closing = '\n$$\n';
          replacement = `${opening}${mathContent}${closing}`;
          selectionStartAfter = start + opening.length;
          selectionEndAfter = selectionStartAfter + mathContent.length;
          break;
        }
        case 'admonition': {
          const noteContent = selectedText || 'Nota importante.';
          const prefix = '\n> [!NOTE]\n> ';
          replacement = `${prefix}${noteContent}\n`;
          selectionStartAfter = start + prefix.length;
          selectionEndAfter = selectionStartAfter + noteContent.length;
          break;
        }
        case 'details': {
          const summary = 'Detalle';
          const detailContent = selectedText || 'Contenido adicional.';
          const opening = `\n<details>\n<summary>${summary}</summary>\n\n`;
          const closing = '\n\n</details>\n';
          replacement = `${opening}${detailContent}${closing}`;
          selectionStartAfter = start + opening.length;
          selectionEndAfter = selectionStartAfter + detailContent.length;
          break;
        }
        case 'unorderedList': {
          ({ replacement, selectionStartAfter, selectionEndAfter } = blockList((line) => `- ${line}`, 'Item'));
          break;
        }
        case 'orderedList': {
          ({ replacement, selectionStartAfter, selectionEndAfter } = blockList((line, index) => `${index + 1}. ${line}`, 'Item'));
          break;
        }
        case 'taskList': {
          ({ replacement, selectionStartAfter, selectionEndAfter } = blockList((line) => `- [ ] ${line}`, 'Tarea'));
          break;
        }
        case 'definitionList': {
          const term = selectedText.trim() || 'Termino';
          const definition = 'Definicion breve.';
          replacement = `\n${term}\n\n: ${definition}\n`;
          selectionStartAfter = start + 1 + term.length + 4;
          selectionEndAfter = selectionStartAfter + definition.length;
          break;
        }
        case 'table': {
          replacement = '\n| Columna | Valor | Notas |\n| --- | --- | --- |\n| Dato 1 | Dato 2 | Dato 3 |\n';
          selectionStartAfter = start + 1;
          selectionEndAfter = start + replacement.length - 1;
          break;
        }
        case 'toc': {
          replacement = '\n## Contenido\n\n[TOC]\n';
          selectionStartAfter = start + replacement.length;
          selectionEndAfter = selectionStartAfter;
          break;
        }
        case 'frontMatter': {
          replacement = '---\ntitle: "Nuevo documento"\nauthor: "Autor"\ndate: "2026-02-27"\n---\n\n';
          selectionStartAfter = start + replacement.length;
          selectionEndAfter = selectionStartAfter;
          break;
        }
        case 'pageBreak': {
          replacement = '\n<div style="page-break-after: always;"></div>\n';
          selectionStartAfter = start + replacement.length;
          selectionEndAfter = selectionStartAfter;
          break;
        }
        case 'emoji': {
          replacement = ':sparkles:';
          selectionStartAfter = start + replacement.length;
          selectionEndAfter = selectionStartAfter;
          break;
        }
        case 'htmlComment': {
          const comment = 'comentario';
          const opening = '\n<!-- ';
          const closing = ' -->\n';
          replacement = `${opening}${comment}${closing}`;
          selectionStartAfter = start + opening.length;
          selectionEndAfter = selectionStartAfter + comment.length;
          break;
        }
        case 'mermaid': {
          const diagram = 'graph TD\n  A[Inicio] --> B[Fin]';
          const opening = '\n```mermaid\n';
          const closing = '\n```\n';
          replacement = `${opening}${diagram}${closing}`;
          selectionStartAfter = start + opening.length;
          selectionEndAfter = selectionStartAfter + diagram.length;
          break;
        }
        case 'horizontalRule': {
          replacement = '\n\n---\n\n';
          selectionStartAfter = start + replacement.length;
          selectionEndAfter = selectionStartAfter;
          break;
        }
      }

      replaceSelection(textarea, { start, end }, replacement, selectionStartAfter, selectionEndAfter);
      hideTooltip();
    },
    [content, editorRef, hideTooltip, replaceSelection]
  );

  const handleInsertSnippet = useCallback(
    (
      snippet: string,
      options?: {
        placement?: 'selection' | 'append';
        selectionStartOffset?: number;
        selectionEndOffset?: number;
      }
    ) => {
      const editor = editorRef.current;
      if (!editor) {
        return;
      }

      const placement = options?.placement ?? 'selection';
      const selectionRange =
        placement === 'append'
          ? {
              start: content.length,
              end: content.length,
            }
          : lastSelectionRef.current;

      const selectionStartOffset = options?.selectionStartOffset ?? snippet.length;
      const selectionEndOffset = options?.selectionEndOffset ?? selectionStartOffset;

      replaceSelection(
        editor,
        selectionRange,
        snippet,
        selectionRange.start + selectionStartOffset,
        selectionRange.start + selectionEndOffset
      );
      hideTooltip();
    },
    [content.length, editorRef, hideTooltip, replaceSelection]
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
      textarea.setSelection(caretOffset, caretOffset);
      rememberSelection(caretOffset, caretOffset);
      const nextScrollTop = Math.max(0, (tooltipState.warning?.line ?? 1) * LINE_HEIGHT_PX - LINE_HEIGHT_PX * 2);
      textarea.setScrollTop(nextScrollTop);
      setEditorScrollTop(nextScrollTop);
      updateCaretFromSelection(caretOffset, nextContent);
    });
  }, [content, editorRef, hideTooltip, rememberSelection, setContent, tooltipState.warning, updateCaretFromSelection]);

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

  const handleSelect = useCallback((selectionStart: number, selectionEnd: number, nextValue: string) => {
    rememberSelection(selectionStart, selectionEnd);
    updateCaretFromSelection(selectionStart, nextValue);

    if (tooltipState.type === 'format' && selectionStart === selectionEnd) {
      hideTooltip();
    }
  }, [hideTooltip, rememberSelection, tooltipState.type, updateCaretFromSelection]);

  const handleTabIndentation = useCallback(
    (selectionStart: number, selectionEnd: number, shiftKey: boolean) => {
      const textarea = editorRef.current;
      if (!textarea) {
        return false;
      }
      const blockStart = content.lastIndexOf('\n', Math.max(0, selectionStart - 1)) + 1;
      const blockEndBreak = content.indexOf('\n', selectionEnd);
      const blockEnd = blockEndBreak === -1 ? content.length : blockEndBreak;
      const block = content.slice(blockStart, blockEnd);
      const lines = block.split('\n');

      let nextLines = lines;
      let nextSelectionStart = selectionStart;
      let nextSelectionEnd = selectionEnd;

      if (!shiftKey) {
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
        textarea.setSelection(nextSelectionStart, nextSelectionEnd);
        rememberSelection(nextSelectionStart, nextSelectionEnd);
        updateCaretFromSelection(nextSelectionEnd, nextContent);
      });

      return true;
    },
    [content, editorRef, rememberSelection, setContent, updateCaretFromSelection]
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
      textarea.setSelection(start, end);
      rememberSelection(start, end);
      const nextScrollTop = Math.max(0, (warning.line - 1) * LINE_HEIGHT_PX - LINE_HEIGHT_PX * 2);
      textarea.setScrollTop(nextScrollTop);
      setEditorScrollTop(nextScrollTop);
      updateCaretFromSelection(start, content);

      hideTooltip();
    },
    [content, editorRef, hideTooltip, rememberSelection, updateCaretFromSelection]
  );

  const focusTooltipTrigger = useCallback(() => {
    tooltipTriggerRef.current?.focus();
  }, []);

  const handleTooltipClose = useCallback(() => {
    hideTooltip();
    if (tooltipState.type === 'pedagogy') {
      focusTooltipTrigger();
      return;
    }

    const textarea = editorRef.current;
    if (!textarea) {
      return;
    }

    const { start, end } = lastSelectionRef.current;
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelection(start, end);
    });
  }, [editorRef, focusTooltipTrigger, hideTooltip, tooltipState.type]);

  const onEditorScroll = useCallback((scrollTop: number) => {
    setEditorScrollTop(scrollTop);
  }, []);

  const handleEditorChange = useCallback(
    (nextValue: string, selectionStart: number) => {
      rememberSelection(selectionStart, selectionStart);
      if (tooltipState.visible && tooltipState.type === 'format') {
        hideTooltip();
      }

      setContent(nextValue);
      updateCaretFromSelection(selectionStart, nextValue);
    },
    [hideTooltip, rememberSelection, setContent, tooltipState.type, tooltipState.visible, updateCaretFromSelection]
  );

  const handleEditorKeyUp = useCallback(
    (selectionStart: number, selectionEnd: number) => {
      const textarea = editorRef.current;
      if (!textarea) {
        return;
      }

      rememberSelection(selectionStart, selectionEnd);
      updateCaretFromSelection(selectionStart, textarea.getValue());

      const hasSelection = selectionStart !== selectionEnd;
      if (hasSelection && !(tooltipState.visible && tooltipState.type === 'pedagogy')) {
        showFormatTooltip(estimateFormatTooltipAnchor(textarea, selectionEnd));
        return;
      }

      if (tooltipState.type === 'format' && !hasSelection) {
        hideTooltip();
      }
    },
    [editorRef, hideTooltip, rememberSelection, showFormatTooltip, tooltipState.type, tooltipState.visible, updateCaretFromSelection]
  );

  const handleEditorPointerUp = useCallback(
    (selectionStart: number, selectionEnd: number, anchorPoint: AnchorPoint) => {
      rememberSelection(selectionStart, selectionEnd);
      updateCaretFromSelection(selectionStart);
      const hasSelection = selectionStart !== selectionEnd;
      if (hasSelection && !(tooltipState.visible && tooltipState.type === 'pedagogy')) {
        showFormatTooltip(anchorPoint);
        return;
      }

      if (tooltipState.visible && !hasSelection) {
        hideTooltip();
      }
    },
    [hideTooltip, rememberSelection, showFormatTooltip, tooltipState.type, tooltipState.visible, updateCaretFromSelection]
  );

  return {
    caretPosition,
    editorScrollTop,
    onEditorScroll,
    handleEditorChange,
    handleEditorKeyUp,
    handleEditorPointerUp,
    handleSelect,
    handleFormatAction,
    handleInsertSnippet,
    handleApplyFix,
    handleTabIndentation,
    handleJumpToWarning,
    handleToggleWarning,
    handleTooltipClose,
    focusTooltipTrigger,
  };
}
