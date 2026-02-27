import React, { useMemo } from 'react';
import {
  countDocumentWords,
  estimateFernandezHuerta,
  type DiagnosticSnapshot,
  type PedagogicalCategory,
  type PedagogicalWarning,
} from '../../utils/pedagogicalRules';

interface DiagnosticsPanelProps {
  warnings: PedagogicalWarning[];
  ignoredCount: number;
  peakWarningCount: number;
  content: string;
  snapshot: DiagnosticSnapshot;
  onJumpToWarning: (warning: PedagogicalWarning) => void;
}

const CATEGORY_LABEL: Record<PedagogicalCategory, string> = {
  structure: 'Estructura',
  style: 'Estilo',
  clarity: 'Claridad',
  syntax: 'Sintaxis',
};

export const DiagnosticsPanel: React.FC<DiagnosticsPanelProps> = ({
  warnings,
  ignoredCount,
  peakWarningCount,
  content,
  snapshot,
  onJumpToWarning,
}) => {
  const words = countDocumentWords(content);
  const readability = estimateFernandezHuerta(content);

  const warningsByCategory = useMemo(() => {
    const map = new Map<PedagogicalCategory, PedagogicalWarning[]>();

    for (const warning of warnings) {
      const current = map.get(warning.category) ?? [];
      current.push(warning);
      map.set(warning.category, current);
    }

    return map;
  }, [warnings]);

  const resolution = useMemo(() => {
    if (peakWarningCount <= 0) {
      return { resolved: 0, percent: 100 };
    }

    const resolved = Math.max(0, peakWarningCount - warnings.length);
    const percent = Math.round((resolved / peakWarningCount) * 100);
    return { resolved, percent };
  }, [peakWarningCount, warnings.length]);

  const paragraphListRatio = snapshot.listCount === 0 ? snapshot.paragraphCount : snapshot.paragraphCount / snapshot.listCount;
  const emphasisDensity = words === 0 ? 0 : Number(((snapshot.emphasisCount / words) * 100).toFixed(2));

  return (
    <aside className="bg-white/50 dark:bg-[#1a1c23]/40 rounded-3xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.04)] border border-white/60 dark:border-white/5 backdrop-blur-xl min-h-[70vh] overflow-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-300">Diagnóstico</h2>
        <span className="text-xs text-slate-500 dark:text-slate-300">Ignoradas: {ignoredCount}</span>
      </div>

      <section className="mb-6">
        <div className="text-xs text-slate-500 dark:text-slate-300 mb-1">Progreso de resolución</div>
        <div className="h-2 bg-slate-200/80 dark:bg-slate-700/60 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500 transition-all"
            style={{ width: `${resolution.percent}%` }}
            aria-label={`Progreso de resolución ${resolution.percent}%`}
          />
        </div>
        <div className="mt-2 text-xs text-slate-600 dark:text-slate-300">
          Resueltas: {resolution.resolved}/{peakWarningCount} ({resolution.percent}%)
        </div>
      </section>

      <section className="mb-6 text-sm text-slate-700 dark:text-slate-200 space-y-1">
        <h3 className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-300 mb-2">Métricas</h3>
        <div>Índice Fernández-Huerta: {readability}</div>
        <div>Encabezados: {snapshot.headingCount}</div>
        <div>Párrafos/Listas (ratio): {paragraphListRatio.toFixed(2)}</div>
        <div>Densidad de énfasis: {emphasisDensity}%</div>
      </section>

      <section>
        <h3 className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-300 mb-3">Advertencias</h3>
        {warnings.length === 0 ? (
          <p className="text-sm text-emerald-700 dark:text-emerald-300">No hay advertencias activas.</p>
        ) : (
          <div className="space-y-4">
            {(Array.from(warningsByCategory.entries()) as Array<[PedagogicalCategory, PedagogicalWarning[]]>).map(
              ([category, categoryWarnings]) => (
                <div key={category}>
                  <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-300 uppercase tracking-wide mb-2">
                    {CATEGORY_LABEL[category]} ({categoryWarnings.length})
                  </h4>
                  <ul className="space-y-2">
                    {categoryWarnings.map((warning) => (
                      <li key={warning.id}>
                        <button
                          type="button"
                          onClick={() => onJumpToWarning(warning)}
                          className="w-full text-left rounded-lg border border-slate-200/60 dark:border-slate-700/70 bg-white/40 dark:bg-black/20 p-2 hover:border-indigo-400/70 transition-colors"
                          title={`Ir a línea ${warning.line}`}
                        >
                          <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                            Línea {warning.line} · {warning.severity}
                          </div>
                          <div className="text-xs text-slate-600 dark:text-slate-300">{warning.message}</div>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            )}
          </div>
        )}
      </section>
    </aside>
  );
};
