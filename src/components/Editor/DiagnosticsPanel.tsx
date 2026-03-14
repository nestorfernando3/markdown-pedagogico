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
  className?: string;
}

const CATEGORY_LABEL: Record<PedagogicalCategory, string> = {
  structure: 'Estructura',
  style: 'Estilo',
  clarity: 'Claridad',
  syntax: 'Sintaxis',
  orthography: 'Ortografía',
};

const SOURCE_LABEL: Record<NonNullable<PedagogicalWarning['source']>, string> = {
  pedagogical: 'Editor',
  'remark-lint': 'remark-lint',
  nspell: 'nspell',
};

export const DiagnosticsPanel: React.FC<DiagnosticsPanelProps> = ({
  warnings,
  ignoredCount,
  peakWarningCount,
  content,
  snapshot,
  onJumpToWarning,
  className,
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
    <div className={className}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="diagnostics-panel-title" className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-300">
            Diagnóstico
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Prioriza qué conviene corregir primero.</p>
        </div>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600 dark:bg-white/8 dark:text-slate-300">
          Ignoradas: {ignoredCount}
        </span>
      </div>

      <section className="mt-5 rounded-2xl border border-slate-200/80 bg-white/78 p-4 dark:border-white/8 dark:bg-white/4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500 dark:text-slate-300">Progreso de resolución</div>
            <div className="mt-1 text-sm font-medium text-slate-700 dark:text-slate-100">
              {resolution.resolved}/{peakWarningCount} alertas resueltas
            </div>
          </div>
          <div className="text-lg font-semibold text-slate-900 dark:text-slate-50">{resolution.percent}%</div>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-800">
          <div
            role="progressbar"
            aria-label="Progreso de resolución"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={resolution.percent}
            className="h-full rounded-full bg-emerald-500 transition-all"
            style={{ width: `${resolution.percent}%` }}
          />
        </div>
      </section>

      <section className="mt-4 grid grid-cols-2 gap-3 text-sm text-slate-700 dark:text-slate-200">
        <div className="rounded-2xl border border-slate-200/80 bg-white/78 p-3 dark:border-white/8 dark:bg-white/4">
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500 dark:text-slate-300">Lectura</div>
          <div className="mt-1 text-[13px] font-medium leading-5">Índice Fernández-Huerta: {readability}</div>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white/78 p-3 dark:border-white/8 dark:bg-white/4">
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500 dark:text-slate-300">Estructura</div>
          <div className="mt-1 text-[13px] font-medium leading-5">Encabezados: {snapshot.headingCount}</div>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white/78 p-3 dark:border-white/8 dark:bg-white/4">
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500 dark:text-slate-300">Ritmo</div>
          <div className="mt-1 text-[13px] font-medium leading-5">Párrafos/Listas: {paragraphListRatio.toFixed(2)}</div>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white/78 p-3 dark:border-white/8 dark:bg-white/4">
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500 dark:text-slate-300">Énfasis</div>
          <div className="mt-1 text-[13px] font-medium leading-5">Densidad: {emphasisDensity}%</div>
        </div>
      </section>

      <section className="mt-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-300">Alertas activas</h3>
          {warnings.length > 0 ? (
            <span className="text-xs text-slate-500 dark:text-slate-400">{warnings.length} por revisar</span>
          ) : null}
        </div>

        {warnings.length === 0 ? (
          <div className="rounded-2xl border border-emerald-200/80 bg-emerald-500/8 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-500/20 dark:text-emerald-200">
            No hay alertas activas. El documento está listo para seguir escribiendo o exportar.
          </div>
        ) : (
          <div className="space-y-4">
            {(Array.from(warningsByCategory.entries()) as Array<[PedagogicalCategory, PedagogicalWarning[]]>).map(
              ([category, categoryWarnings]) => (
                <div key={category}>
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-300">
                    {CATEGORY_LABEL[category]} ({categoryWarnings.length})
                  </h4>
                  <ul className="space-y-2">
                    {categoryWarnings.map((warning) => (
                      <li key={warning.id}>
                        <button
                          type="button"
                          onClick={() => onJumpToWarning(warning)}
                          className="w-full rounded-2xl border border-slate-200/80 bg-white/78 p-3 text-left transition-colors hover:border-indigo-400/60 hover:bg-indigo-500/5 dark:border-white/8 dark:bg-white/4 dark:hover:border-indigo-400/35 dark:hover:bg-indigo-500/8"
                          title={`Ir a línea ${warning.line}`}
                          aria-label={`Ir a la advertencia ${warning.severity} de la línea ${warning.line}: ${warning.message}`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-xs font-semibold text-slate-700 dark:text-slate-100">
                              Línea {warning.line}
                            </div>
                            <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                              {SOURCE_LABEL[warning.source ?? 'pedagogical']}
                            </div>
                          </div>
                          <div className="mt-2 text-[13px] leading-6 text-slate-700 dark:text-slate-200">{warning.message}</div>
                          {warning.suggestion ? (
                            <div className="mt-2 text-[11px] leading-5 text-slate-500 dark:text-slate-300">Sugerencia: {warning.suggestion}</div>
                          ) : null}
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
    </div>
  );
};
