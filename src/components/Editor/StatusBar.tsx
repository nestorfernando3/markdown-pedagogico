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
      role="status"
      className="fixed bottom-0 left-0 right-0 z-30 bg-white/80 dark:bg-slate-900/80 border-t border-slate-200/50 dark:border-slate-800/50 backdrop-blur-md px-4 py-2 text-xs text-slate-600 dark:text-slate-300 flex items-center justify-between"
      aria-live="polite"
    >
      <div className="flex items-center gap-4">
        <span>Palabras: {words}</span>
        <span>Caracteres: {characters}</span>
        <span>Lectura: {readingMinutes} min</span>
        <span>Cursor: {line}:{column}</span>
      </div>
      <div className="flex items-center gap-4">
        <span>Alertas: {warningCount}</span>
        <span className="truncate max-w-72" title={currentPath ?? 'Sin archivo'}>
          Archivo: {currentPath ?? 'Sin archivo'}
        </span>
        <span className={isDirty ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}>
          {isDirty ? 'Cambios sin guardar' : 'Guardado'}
        </span>
      </div>
    </footer>
  );
};
