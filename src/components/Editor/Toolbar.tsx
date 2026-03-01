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
    return 'Error al guardar';
  }
  return 'Guardar';
}

function exportLabel(isExporting: boolean, status: ToolbarProps['lastExportStatus']): string {
  if (isExporting) {
    return 'Exportando...';
  }
  if (status === 'success') {
    return 'PDF exportado';
  }
  if (status === 'error') {
    return 'Error al exportar';
  }
  return 'Exportar PDF';
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
  showReferencePanel,
  onToggleReferencePanel,
  showDiagnosticsPanel,
  onToggleDiagnosticsPanel,
}) => {
  return (
    <header className="fixed top-0 w-full z-40 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md border-b border-slate-200/50 dark:border-slate-800/50 p-4 flex justify-between items-center">
      <h1 className="text-xl font-medium text-slate-800 dark:text-slate-200 tracking-tight">Markdown Pedagógico</h1>
      <div className="flex items-center gap-2" role="toolbar" aria-label="Acciones del editor">
        <button
          type="button"
          onClick={onOpen}
          className="rounded-lg px-3 py-1.5 text-sm font-medium bg-white/60 text-slate-700 hover:bg-white/80 dark:bg-black/20 dark:text-slate-200 dark:hover:bg-black/30 transition-colors"
          title="Abrir archivo Markdown (Ctrl/Cmd+O desde menú del sistema)"
          aria-label="Abrir archivo Markdown"
          aria-keyshortcuts="Control+O Meta+O"
        >
          Abrir
        </button>

        <button
          type="button"
          onClick={onSave}
          disabled={isSaving}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
            lastSaveStatus === 'success'
              ? 'border border-emerald-600/60 bg-emerald-500/20 text-emerald-700 dark:bg-emerald-500/30 dark:text-emerald-200'
              : 'bg-indigo-500/20 text-indigo-700 hover:bg-indigo-500/30 dark:bg-indigo-500/30 dark:text-indigo-200'
          } ${isSaving ? 'cursor-not-allowed opacity-70' : ''}`}
          title="Guardar (Ctrl/Cmd+S)"
          aria-label="Guardar documento"
          aria-keyshortcuts="Control+S Meta+S"
        >
          {saveLabel(isSaving, lastSaveStatus)}
        </button>

        <button
          type="button"
          onClick={onSaveAs}
          disabled={isSaving}
          className="rounded-lg px-3 py-1.5 text-sm font-medium bg-white/60 text-slate-700 hover:bg-white/80 dark:bg-black/20 dark:text-slate-200 dark:hover:bg-black/30 transition-colors"
          title="Guardar como"
          aria-label="Guardar como"
        >
          Guardar como
        </button>

        <button
          type="button"
          onClick={onExportPdf}
          disabled={isExporting}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
            lastExportStatus === 'success'
              ? 'border border-emerald-600/60 bg-emerald-500/20 text-emerald-700 dark:bg-emerald-500/30 dark:text-emerald-200'
              : 'bg-indigo-500/20 text-indigo-700 hover:bg-indigo-500/30 dark:bg-indigo-500/30 dark:text-indigo-200'
          } ${isExporting ? 'cursor-not-allowed opacity-70' : ''}`}
          title="Exportar PDF (Ctrl/Cmd+Shift+E)"
          aria-label="Exportar PDF"
          aria-keyshortcuts="Control+Shift+E Meta+Shift+E"
        >
          {exportLabel(isExporting, lastExportStatus)}
        </button>

        <button
          type="button"
          onClick={onToggleZenMode}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
            isZenMode
              ? 'border border-slate-500/40 bg-slate-900/10 text-slate-900 dark:bg-slate-100/10 dark:text-slate-100'
              : 'bg-white/60 text-slate-700 hover:bg-white/80 dark:bg-black/20 dark:text-slate-200 dark:hover:bg-black/30'
          }`}
          title="Alternar modo zen"
          aria-label="Alternar modo zen"
        >
          {isZenMode ? 'Salir Zen' : 'Modo Zen'}
        </button>

        <button
          type="button"
          onClick={onToggleReferencePanel}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
            showReferencePanel
              ? 'border border-indigo-500/40 bg-indigo-500/20 text-indigo-700 dark:bg-indigo-500/30 dark:text-indigo-200'
              : 'bg-white/60 text-slate-700 hover:bg-white/80 dark:bg-black/20 dark:text-slate-200 dark:hover:bg-black/30'
          }`}
          title="Mostrar/Ocultar panel de referencia"
          aria-label="Alternar panel de referencia"
        >
          Referencia
        </button>

        <button
          type="button"
          onClick={onToggleDiagnosticsPanel}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
            showDiagnosticsPanel
              ? 'border border-indigo-500/40 bg-indigo-500/20 text-indigo-700 dark:bg-indigo-500/30 dark:text-indigo-200'
              : 'bg-white/60 text-slate-700 hover:bg-white/80 dark:bg-black/20 dark:text-slate-200 dark:hover:bg-black/30'
          }`}
          title="Mostrar/Ocultar panel de diagnóstico"
          aria-label="Alternar panel de diagnóstico"
        >
          Diagnóstico
        </button>

        <div className="text-sm text-slate-500 dark:text-slate-300" aria-label="Conteo de problemas detectados">
          Problemas: {warningCount}
        </div>
      </div>
    </header>
  );
};
