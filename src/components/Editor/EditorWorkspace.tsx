import React from 'react';
import type { RefObject } from 'react';
import type { TooltipState } from '../../hooks/useTooltipState';
import { enhanceCodeBlocks } from '../../utils/codeBlockUi';
import { isExternalResourceHref, openExternalResource } from '../../utils/externalLinks';
import type { PedagogicalWarning } from '../../utils/markdownParser';
import { getPreferredMermaidTheme, renderMermaidDiagrams } from '../../utils/mermaidRenderer';
import type { EditorHandle } from './editorHandle';
import { LegacyTextareaEditor } from './LegacyTextareaEditor';
import { MarkdownCodeMirror } from './MarkdownCodeMirror';
import { PedagogicalOverlay } from './PedagogicalOverlay';
import { ReferencePanel } from './ReferencePanel';
import { TrainingCoach } from './TrainingCoach';
import { TooltipContextual, type MarkdownAction } from './TooltipContextual';
import type { TrainingState } from '../../hooks/editor/useTrainingMode';

export type EditorEngine = 'legacy' | 'codemirror';

const SHELL_LAYOUT = {
  reference: 'grid-cols-1 xl:grid-cols-[minmax(280px,320px)_minmax(0,1fr)]',
  none: 'grid-cols-1',
} as const;

interface EditorWorkspaceProps {
  content: string;
  htmlPreview: string;
  lineNumbers: number[];
  editorRef: RefObject<EditorHandle | null>;
  editorScrollTop: number;
  editorEngine: EditorEngine;
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
  onEditorSelect: (selectionStart: number, selectionEnd: number, nextValue: string) => void;
  onEditorPointerUp: (selectionStart: number, selectionEnd: number, anchorPoint: { x: number; y: number }) => void;
  onEditorKeyUp: (selectionStart: number, selectionEnd: number) => void;
  onEditorTab: (selectionStart: number, selectionEnd: number, shiftKey: boolean) => boolean;
  onToggleWarning: (warning: PedagogicalWarning | null, markerRect?: DOMRect, trigger?: HTMLElement) => void;
  onFormatAction: (action: MarkdownAction) => void;
  onFixAction: () => void;
  onIgnoreWarning: (warningId: string) => void;
  onTooltipClose: () => void;
  onCloseDiagnosticsPanel: () => void;
  diagnosticsPanel?: React.ReactNode;
  trainingState: TrainingState;
  onTrainingInsertExample: () => void;
  onTrainingSkipStep: () => void;
  onTrainingClose: () => void;
  onTrainingToggleCollapsed: () => void;
}

export const EditorWorkspace: React.FC<EditorWorkspaceProps> = ({
  content,
  htmlPreview,
  lineNumbers,
  editorRef,
  editorScrollTop,
  editorEngine,
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
  onEditorPointerUp,
  onEditorKeyUp,
  onEditorTab,
  onToggleWarning,
  onFormatAction,
  onFixAction,
  onIgnoreWarning,
  onTooltipClose,
  onCloseDiagnosticsPanel,
  diagnosticsPanel,
  trainingState,
  onTrainingInsertExample,
  onTrainingSkipStep,
  onTrainingClose,
  onTrainingToggleCollapsed,
}) => {
  const previewContentRef = React.useRef<HTMLDivElement>(null);
  const layoutClass = showReferencePanel ? SHELL_LAYOUT.reference : SHELL_LAYOUT.none;

  React.useLayoutEffect(() => {
    if (!previewContentRef.current || htmlPreview.trim() === '') {
      return;
    }

    let cancelled = false;
    const previewNode = previewContentRef.current;

    void (async () => {
      if (cancelled) {
        return;
      }

      await renderMermaidDiagrams(previewNode, getPreferredMermaidTheme());
      if (cancelled) {
        return;
      }

      enhanceCodeBlocks(previewNode);
    })();

    return () => {
      cancelled = true;
    };
  }, [htmlPreview]);

  const handlePreviewClick = React.useCallback(async (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const link = target.closest('a');
    if (!link) {
      return;
    }

    const href = link.getAttribute('href');
    if (!href) {
      return;
    }

    if (href.startsWith('#')) {
      event.preventDefault();
      const targetId = decodeURIComponent(href.slice(1));
      const previewRoot = previewContentRef.current;
      const destination = previewRoot?.ownerDocument.getElementById(targetId);
      destination?.scrollIntoView({ block: 'start', behavior: 'smooth' });
      return;
    }

    if (!isExternalResourceHref(href)) {
      return;
    }

    event.preventDefault();
    await openExternalResource(href);
  }, []);

  const showTrainingHighlight = trainingState.active && !trainingState.collapsed && !trainingState.isComplete;
  const reservePreviewCoachSpace = trainingState.active && !trainingState.collapsed;

  return (
    <main className={`relative flex-1 grid pt-[6.9rem] pb-14 px-6 lg:px-8 gap-8 max-w-[1800px] mx-auto w-full ${layoutClass}`}>
      {showReferencePanel && (
        <ReferencePanel
          referenceText={referenceText}
          onReferenceTextChange={onReferenceTextChange}
          referenceImageDataUrl={referenceImageDataUrl}
          onReferenceImageDataUrlChange={onReferenceImageDataUrlChange}
        />
      )}

      <div className="relative grid grid-cols-1 xl:grid-cols-[minmax(0,1.04fr)_minmax(0,0.96fr)] gap-8 xl:gap-10">
        <section className="relative flex flex-col group" aria-labelledby="editor-section-title">
          <h2 id="editor-section-title" className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">
            Escritura (Markdown)
          </h2>

          <div
            className={`relative flex-1 bg-white/50 dark:bg-[#1a1c23]/40 rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.04)] backdrop-blur-xl border border-white/60 dark:border-white/5 focus-within:ring-2 focus-within:ring-indigo-500/30 transition-all group-hover:shadow-[0_8px_32px_rgba(0,0,0,0.08)] z-10 overflow-hidden ${
              showTrainingHighlight && trainingState.highlightTarget === 'editor'
                ? 'ring-2 ring-indigo-500/30 shadow-[0_12px_40px_rgba(79,70,229,0.14)]'
                : ''
            }`}
          >
            {showTrainingHighlight && trainingState.highlightTarget === 'editor' ? (
              <div className="pointer-events-none absolute right-4 top-4 z-30 rounded-full bg-indigo-500/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-indigo-700 dark:text-indigo-200">
                Paso guiado activo
              </div>
            ) : null}
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

            {editorEngine === 'codemirror' ? (
              <MarkdownCodeMirror
                ref={editorRef}
                content={content}
                onChange={onEditorChange}
                onScroll={onEditorScroll}
                onSelect={onEditorSelect}
                onPointerUp={onEditorPointerUp}
                onKeyUp={onEditorKeyUp}
                onTabIndentation={onEditorTab}
              />
            ) : (
              <LegacyTextareaEditor
                ref={editorRef}
                content={content}
                onChange={onEditorChange}
                onScroll={onEditorScroll}
                onSelect={onEditorSelect}
                onPointerUp={onEditorPointerUp}
                onKeyUp={onEditorKeyUp}
                onTabIndentation={onEditorTab}
              />
            )}

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

        <section className="relative flex flex-col" aria-labelledby="preview-section-title">
          <h2 id="preview-section-title" className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">
            Vista Previa Real
          </h2>
          <div
            className={`flex-1 bg-white/50 dark:bg-black/10 rounded-3xl p-8 shadow-[0_4px_30px_rgba(0,0,0,0.02)] border border-slate-100 dark:border-slate-800/50 overflow-auto prose prose-slate dark:prose-invert prose-lg max-w-none backdrop-blur-sm transition-all selection:bg-indigo-100 dark:selection:bg-indigo-900 ${
              showTrainingHighlight && trainingState.highlightTarget === 'preview' ? 'ring-2 ring-indigo-500/30' : ''
            } ${reservePreviewCoachSpace ? (showDiagnosticsPanel ? 'lg:pb-64' : 'lg:pb-72') : ''}`}
          >
            {content.trim() === '' ? (
              <p className="text-slate-400 italic font-light">
                Comienza a escribir a la izquierda y el documento se renderizará automáticamente.
              </p>
            ) : (
              <div ref={previewContentRef} onClick={handlePreviewClick} dangerouslySetInnerHTML={{ __html: htmlPreview }} />
            )}
          </div>

          <div
            className={`pointer-events-none z-30 mt-4 xl:mt-0 xl:absolute xl:bottom-5 ${
              showDiagnosticsPanel ? 'xl:left-5 xl:right-auto' : 'xl:right-5'
            } ${
              reservePreviewCoachSpace
                ? showDiagnosticsPanel
                  ? 'xl:w-[min(17rem,calc(100%-2.5rem))]'
                  : 'xl:w-[min(22rem,calc(100%-2.5rem))]'
                : 'xl:w-[min(17rem,calc(100%-2.5rem))]'
            }`}
          >
            <TrainingCoach
              trainingState={trainingState}
              onInsertExample={onTrainingInsertExample}
              onSkipStep={onTrainingSkipStep}
              onClose={onTrainingClose}
              onToggleCollapsed={onTrainingToggleCollapsed}
            />
          </div>
        </section>
      </div>

      {showDiagnosticsPanel && (
        <>
          <div className="pointer-events-none fixed inset-0 z-30 bg-[radial-gradient(circle_at_right,rgba(15,23,42,0.12),transparent_38%)] dark:bg-[radial-gradient(circle_at_right,rgba(0,0,0,0.3),transparent_42%)]" />
          <div
            role="dialog"
            aria-modal="false"
            aria-labelledby="diagnostics-panel-title"
            className="fixed inset-y-[5.35rem] right-4 z-40 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white/92 shadow-[0_28px_80px_rgba(15,23,42,0.16)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/88 dark:shadow-[0_28px_80px_rgba(0,0,0,0.38)]"
          >
            <div className="flex items-center justify-between border-b border-slate-200/80 px-5 py-4 dark:border-white/8">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-300">Panel contextual</div>
              <button
                type="button"
                onClick={onCloseDiagnosticsPanel}
                className="rounded-xl px-2.5 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-slate-50"
                aria-label="Cerrar panel de diagnóstico"
              >
                Cerrar
              </button>
            </div>
            <div className="h-full overflow-auto px-5 py-5">{diagnosticsPanel}</div>
          </div>
        </>
      )}
    </main>
  );
};
