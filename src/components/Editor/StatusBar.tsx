import React from 'react';

interface StatusBarProps {
  words: number;
  characters: number;
  readingMinutes: number;
  line: number;
  column: number;
  warningCount: number;
  currentPath: string | null;
  isDirty: boolean;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  words,
  characters,
  readingMinutes,
  line,
  column,
  warningCount,
  currentPath,
  isDirty,
}) => {
  return (
    <footer
      aria-label="Barra de estado del editor"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200/70 bg-white/78 px-4 py-2.5 text-xs text-slate-600 backdrop-blur-xl dark:border-white/8 dark:bg-slate-950/74 dark:text-slate-300"
    >
      <div className="mx-auto flex w-full max-w-[1880px] flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2" aria-label="Metricas del documento">
          <span className="rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-medium shadow-[0_6px_18px_rgba(15,23,42,0.04)] dark:bg-white/6">
            Palabras: {words}
          </span>
          <span className="rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-medium shadow-[0_6px_18px_rgba(15,23,42,0.04)] dark:bg-white/6">
            Caracteres: {characters}
          </span>
          <span className="rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-medium shadow-[0_6px_18px_rgba(15,23,42,0.04)] dark:bg-white/6">
            Lectura: {readingMinutes} min
          </span>
          <span className="rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-medium shadow-[0_6px_18px_rgba(15,23,42,0.04)] dark:bg-white/6">
            Cursor: {line}:{column}
          </span>
        </div>
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-2" aria-label="Estado del documento">
          <span className="rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-medium shadow-[0_6px_18px_rgba(15,23,42,0.04)] dark:bg-white/6">
            Alertas: {warningCount}
          </span>
          <span className="max-w-72 truncate rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-medium shadow-[0_6px_18px_rgba(15,23,42,0.04)] dark:bg-white/6" title={currentPath ?? 'Sin archivo'}>
            Archivo: {currentPath ?? 'Sin archivo'}
          </span>
          <span
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
              isDirty
                ? 'bg-amber-500/12 text-amber-700 dark:bg-amber-500/18 dark:text-amber-300'
                : 'bg-emerald-500/12 text-emerald-700 dark:bg-emerald-500/18 dark:text-emerald-300'
            }`}
          >
            {isDirty ? 'Cambios sin guardar' : 'Guardado'}
          </span>
        </div>
      </div>
    </footer>
  );
};
