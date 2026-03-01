import React from 'react';
import type { RefObject } from 'react';
import type { TooltipState } from '../../hooks/useTooltipState';
import type { PedagogicalWarning } from '../../utils/markdownParser';
import { PedagogicalOverlay } from './PedagogicalOverlay';
import { ReferencePanel } from './ReferencePanel';
import { TooltipContextual, type MarkdownAction } from './TooltipContextual';

const SHELL_LAYOUT = {
  both: 'grid-cols-1 2xl:grid-cols-[minmax(280px,320px)_minmax(0,1fr)_minmax(300px,340px)]',
  reference: 'grid-cols-1 xl:grid-cols-[minmax(280px,320px)_minmax(0,1fr)]',
  diagnostics: 'grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(300px,340px)]',
  none: 'grid-cols-1',
} as const;

interface EditorWorkspaceProps {
  content: string;
  htmlPreview: string;
  lineNumbers: number[];
  editorRef: RefObject<HTMLTextAreaElement | null>;
  editorScrollTop: number;
  isZenMode: boolean;
  showReferencePanel: boolean;
  showDiagnosticsPanel: boolean;
  referenceText: string;
  referenceImageDataUrl: string | null;
  visibleWarnings: PedagogicalWarning[];
  newWarningIds: Set<string>;
  tooltipState: TooltipState;
  activeWarningId: string | null;
  activeTooltipId: string | null;
  onReferenceTextChange: (next: string) => void;
  onReferenceImageDataUrlChange: (next: string | null) => void;
  onEditorChange: (nextValue: string, selectionStart: number) => void;
  onEditorScroll: (scrollTop: number) => void;
  onEditorSelect: () => void;
  onEditorClick: (selectionStart: number, selectionEnd: number) => void;
  onEditorKeyUp: (selectionStart: number) => void;
  onEditorTab: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onToggleWarning: (warning: PedagogicalWarning | null, markerRect?: DOMRect, trigger?: HTMLElement) => void;
  onFormatAction: (action: MarkdownAction) => void;
  onFixAction: () => void;
  onIgnoreWarning: (warningId: string) => void;
  onTooltipClose: () => void;
  diagnosticsPanel?: React.ReactNode;
}

export const EditorWorkspace: React.FC<EditorWorkspaceProps> = ({
  content,
  htmlPreview,
  lineNumbers,
  editorRef,
  editorScrollTop,
  isZenMode,
  showReferencePanel,
  showDiagnosticsPanel,
  referenceText,
  referenceImageDataUrl,
  visibleWarnings,
  newWarningIds,
  tooltipState,
  activeWarningId,
  activeTooltipId,
  onReferenceTextChange,
  onReferenceImageDataUrlChange,
  onEditorChange,
  onEditorScroll,
  onEditorSelect,
  onEditorClick,
  onEditorKeyUp,
  onEditorTab,
  onToggleWarning,
  onFormatAction,
  onFixAction,
  onIgnoreWarning,
  onTooltipClose,
  diagnosticsPanel,
}) => {
  const layoutClass = showReferencePanel
    ? showDiagnosticsPanel
      ? SHELL_LAYOUT.both
      : SHELL_LAYOUT.reference
    : showDiagnosticsPanel
      ? SHELL_LAYOUT.diagnostics
      : SHELL_LAYOUT.none;

  return (
    <main className={`flex-1 grid pt-24 pb-14 px-8 gap-8 max-w-[1800px] mx-auto w-full ${layoutClass}`}>
      {showReferencePanel && (
        <ReferencePanel
          referenceText={referenceText}
          onReferenceTextChange={onReferenceTextChange}
          referenceImageDataUrl={referenceImageDataUrl}
          onReferenceImageDataUrlChange={onReferenceImageDataUrlChange}
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        <section className="relative flex flex-col group" aria-labelledby="editor-section-title">
          <h2 id="editor-section-title" className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">
            Escritura (Markdown)
          </h2>

          <div className="relative flex-1 bg-white/50 dark:bg-[#1a1c23]/40 rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.04)] backdrop-blur-xl border border-white/60 dark:border-white/5 focus-within:ring-2 focus-within:ring-indigo-500/30 transition-all group-hover:shadow-[0_8px_32px_rgba(0,0,0,0.08)] z-10 overflow-hidden">
            <div
              aria-hidden="true"
              className="absolute inset-y-0 left-0 w-14 border-r border-slate-200/60 dark:border-slate-700/60 bg-white/40 dark:bg-black/20 pointer-events-none z-20 overflow-hidden"
            >
              <div style={{ transform: `translateY(-${editorScrollTop}px)` }} className="pt-8">
                {lineNumbers.map((lineNumber) => (
                  <div
                    key={lineNumber}
                    className="h-7 px-2 text-right text-xs text-slate-400 dark:text-slate-500 leading-7 font-mono"
                  >
                    {lineNumber}
                  </div>
                ))}
              </div>
            </div>

            <textarea
              ref={editorRef}
              value={content}
              onChange={(event) => onEditorChange(event.target.value, event.target.selectionStart)}
              onScroll={(event) => onEditorScroll(event.currentTarget.scrollTop)}
              onSelect={onEditorSelect}
              onClick={(event) => onEditorClick(event.currentTarget.selectionStart, event.currentTarget.selectionEnd)}
              onKeyDown={onEditorTab}
              onKeyUp={(event) => onEditorKeyUp(event.currentTarget.selectionStart)}
              className="absolute inset-0 w-full h-full bg-transparent resize-none outline-none text-lg text-slate-800 dark:text-slate-200 font-mono leading-7 py-8 pr-8 pl-[4.5rem] rounded-3xl dark:caret-indigo-400 caret-indigo-600 z-10"
              placeholder="Escribe tu idea aquí usando Markdown..."
              spellCheck={false}
              aria-label="Editor de contenido Markdown"
              aria-labelledby="editor-section-title"
            />

            <PedagogicalOverlay
              warnings={visibleWarnings}
              onToggleWarning={onToggleWarning}
              isZenMode={isZenMode}
              scrollTop={editorScrollTop}
              newWarningIds={newWarningIds}
              activeWarningId={activeWarningId}
              tooltipId={activeTooltipId}
            />
          </div>

          <TooltipContextual
            x={tooltipState.x}
            y={tooltipState.y}
            visible={tooltipState.visible}
            type={tooltipState.type}
            warning={tooltipState.warning}
            tooltipId={activeTooltipId}
            onFormatAction={onFormatAction}
            onFixAction={onFixAction}
            onIgnoreWarning={onIgnoreWarning}
            onClose={onTooltipClose}
          />
        </section>

        <section className="flex flex-col" aria-labelledby="preview-section-title">
          <h2 id="preview-section-title" className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">
            Vista Previa Real
          </h2>
          <div className="flex-1 bg-white/50 dark:bg-black/10 rounded-3xl p-8 shadow-[0_4px_30px_rgba(0,0,0,0.02)] border border-slate-100 dark:border-slate-800/50 overflow-auto prose prose-slate dark:prose-invert prose-lg max-w-none backdrop-blur-sm transition-all selection:bg-indigo-100 dark:selection:bg-indigo-900">
            {content.trim() === '' ? (
              <p className="text-slate-400 italic font-light">
                Comienza a escribir a la izquierda y el documento se renderizará automáticamente.
              </p>
            ) : (
              <div dangerouslySetInnerHTML={{ __html: htmlPreview }} />
            )}
          </div>
        </section>
      </div>

      {showDiagnosticsPanel && diagnosticsPanel}
    </main>
  );
};
