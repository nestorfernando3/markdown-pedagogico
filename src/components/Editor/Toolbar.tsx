import type { EditorEngine } from './EditorWorkspace';
import React from 'react';

interface ToolbarProps {
  warningCount: number;
  onOpen: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onExportPdf: () => void;
  isSaving: boolean;
  isExporting: boolean;
  lastSaveStatus: 'idle' | 'success' | 'error';
  lastExportStatus: 'idle' | 'success' | 'error';
  isZenMode: boolean;
  onToggleZenMode: () => void;
  isTrainingMode: boolean;
  onToggleTrainingMode: () => void;
  editorEngine: EditorEngine;
  onToggleEditorEngine: () => void;
  showReferencePanel: boolean;
  onToggleReferencePanel: () => void;
  showDiagnosticsPanel: boolean;
  onToggleDiagnosticsPanel: () => void;
}

function saveLabel(isSaving: boolean, status: ToolbarProps['lastSaveStatus']): string {
  if (isSaving) {
    return 'Guardando...';
  }
  if (status === 'success') {
    return 'Guardado';
  }
  if (status === 'error') {
    return 'Reintentar guardado';
  }
  return 'Guardar';
}

function exportLabel(isExporting: boolean, status: ToolbarProps['lastExportStatus']): string {
  if (isExporting) {
    return 'Exportando...';
  }
  if (status === 'success') {
    return 'PDF listo';
  }
  if (status === 'error') {
    return 'Reintentar PDF';
  }
  return 'Exportar PDF';
}

function groupClassName(): string {
  return [
    'inline-flex items-center gap-1 rounded-2xl border border-slate-200/80 bg-white/72 px-1.5 py-1',
    'shadow-[0_10px_30px_rgba(15,23,42,0.06)] backdrop-blur-lg',
    'dark:border-white/10 dark:bg-slate-950/40 dark:shadow-[0_10px_30px_rgba(0,0,0,0.22)]',
  ].join(' ');
}

function baseButtonClassName(): string {
  return [
    'inline-flex min-h-10 items-center justify-center rounded-xl px-3.5 py-2 text-sm font-medium transition-all duration-200',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-white',
    'dark:focus-visible:ring-offset-slate-950',
  ].join(' ');
}

function neutralButtonClassName(isActive = false): string {
  return [
    baseButtonClassName(),
    isActive
      ? 'border border-indigo-400/50 bg-indigo-500/12 text-indigo-700 shadow-[inset_0_0_0_1px_rgba(99,102,241,0.08)] dark:border-indigo-400/35 dark:bg-indigo-500/18 dark:text-indigo-100'
      : 'text-slate-700 hover:bg-slate-100/90 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-white/8 dark:hover:text-white',
  ].join(' ');
}

function primaryButtonClassName(status: 'idle' | 'success' | 'error'): string {
  return [
    baseButtonClassName(),
    status === 'success'
      ? 'bg-emerald-500/16 text-emerald-700 border border-emerald-400/40 dark:bg-emerald-500/22 dark:text-emerald-100 dark:border-emerald-400/25'
      : status === 'error'
        ? 'bg-rose-500/16 text-rose-700 border border-rose-400/40 dark:bg-rose-500/22 dark:text-rose-100 dark:border-rose-400/25'
        : 'bg-indigo-600 text-white shadow-[0_10px_24px_rgba(79,70,229,0.22)] hover:bg-indigo-500 dark:bg-indigo-500 dark:hover:bg-indigo-400',
  ].join(' ');
}

function subtlePrimaryButtonClassName(status: 'idle' | 'success' | 'error'): string {
  return [
    baseButtonClassName(),
    status === 'success'
      ? 'text-emerald-700 bg-emerald-500/10 dark:text-emerald-100 dark:bg-emerald-500/16'
      : status === 'error'
        ? 'text-rose-700 bg-rose-500/10 dark:text-rose-100 dark:bg-rose-500/16'
        : 'text-indigo-700 bg-indigo-500/12 hover:bg-indigo-500/18 dark:text-indigo-100 dark:bg-indigo-500/18 dark:hover:bg-indigo-500/24',
  ].join(' ');
}

export const Toolbar: React.FC<ToolbarProps> = ({
  warningCount,
  onOpen,
  onSave,
  onSaveAs,
  onExportPdf,
  isSaving,
  isExporting,
  lastSaveStatus,
  lastExportStatus,
  isZenMode,
  onToggleZenMode,
  isTrainingMode,
  onToggleTrainingMode,
  editorEngine,
  onToggleEditorEngine,
  showReferencePanel,
  onToggleReferencePanel,
  showDiagnosticsPanel,
  onToggleDiagnosticsPanel,
}) => {
  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-slate-200/70 bg-white/78 backdrop-blur-xl dark:border-white/8 dark:bg-slate-950/74">
      <div className="mx-auto flex w-full max-w-[1880px] flex-wrap items-center justify-between gap-3 px-5 py-4">
        <div className="min-w-[14rem]">
          <h1 className="text-[1.85rem] font-semibold tracking-[-0.04em] text-slate-900 dark:text-slate-50">
            Markdown Pedagógico
          </h1>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Escribe, aprende y exporta sin salir del documento.</p>
        </div>

        <div className="flex flex-1 flex-wrap items-center justify-end gap-2" role="toolbar" aria-label="Acciones del editor">
          <div className={groupClassName()}>
            <button
              type="button"
              onClick={onOpen}
              className={neutralButtonClassName(false)}
              title="Abrir archivo Markdown (Ctrl/Cmd+O desde menú del sistema)"
              aria-label="Abrir archivo Markdown"
              aria-keyshortcuts="Control+O Meta+O"
            >
              Abrir
            </button>

            <button
              type="button"
              onClick={onSaveAs}
              disabled={isSaving}
              className={`${neutralButtonClassName(false)} ${isSaving ? 'cursor-not-allowed opacity-60' : ''}`}
              title="Guardar como"
              aria-label="Guardar como"
            >
              Guardar como
            </button>

            <button
              type="button"
              onClick={onSave}
              disabled={isSaving}
              className={`${primaryButtonClassName(lastSaveStatus)} ${isSaving ? 'cursor-not-allowed opacity-70' : ''}`}
              title="Guardar (Ctrl/Cmd+S)"
              aria-label="Guardar documento"
              aria-keyshortcuts="Control+S Meta+S"
            >
              {saveLabel(isSaving, lastSaveStatus)}
            </button>

            <button
              type="button"
              onClick={onExportPdf}
              disabled={isExporting}
              className={`${subtlePrimaryButtonClassName(lastExportStatus)} ${isExporting ? 'cursor-not-allowed opacity-70' : ''}`}
              title="Exportar PDF (Ctrl/Cmd+Shift+E)"
              aria-label="Exportar PDF"
              aria-keyshortcuts="Control+Shift+E Meta+Shift+E"
            >
              {exportLabel(isExporting, lastExportStatus)}
            </button>
          </div>

          <div className={groupClassName()}>
            <button
              type="button"
              onClick={onToggleZenMode}
              className={neutralButtonClassName(isZenMode)}
              title="Alternar modo zen"
              aria-label="Alternar modo zen"
            >
              {isZenMode ? 'Salir Zen' : 'Modo Zen'}
            </button>

            <button
              type="button"
              onClick={onToggleTrainingMode}
              className={neutralButtonClassName(isTrainingMode)}
              title={isTrainingMode ? 'Desactivar training mode' : 'Activar training mode'}
              aria-label={isTrainingMode ? 'Desactivar training mode' : 'Activar training mode'}
            >
              Training
            </button>

            <button
              type="button"
              onClick={onToggleEditorEngine}
              className={neutralButtonClassName(editorEngine === 'codemirror')}
              title={editorEngine === 'codemirror' ? 'Volver al editor clásico' : 'Activar editor CodeMirror'}
              aria-label={editorEngine === 'codemirror' ? 'Volver al editor clásico' : 'Activar editor CodeMirror'}
            >
              {editorEngine === 'codemirror' ? 'Clásico' : 'CodeMirror'}
            </button>
          </div>

          <div className={groupClassName()}>
            <button
              type="button"
              onClick={onToggleReferencePanel}
              className={neutralButtonClassName(showReferencePanel)}
              title="Mostrar u ocultar panel de referencia"
              aria-label="Alternar panel de referencia"
            >
              Referencia
            </button>

            <button
              type="button"
              onClick={onToggleDiagnosticsPanel}
              className={`${neutralButtonClassName(showDiagnosticsPanel)} gap-2`}
              title="Mostrar u ocultar panel de diagnóstico"
              aria-label="Alternar panel de diagnóstico"
              aria-expanded={showDiagnosticsPanel}
            >
              <span>Diagnóstico</span>
              <span
                className={`inline-flex min-w-6 items-center justify-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  warningCount > 0
                    ? 'bg-amber-500/18 text-amber-700 dark:bg-amber-500/24 dark:text-amber-100'
                    : 'bg-slate-200/90 text-slate-600 dark:bg-white/10 dark:text-slate-300'
                }`}
                aria-label={warningCount === 1 ? '1 problema detectado' : `${warningCount} problemas detectados`}
              >
                {warningCount}
              </span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
