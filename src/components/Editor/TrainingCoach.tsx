import React from 'react';
import type { TrainingState } from '../../hooks/editor/useTrainingMode';

interface TrainingCoachProps {
  trainingState: TrainingState;
  onInsertExample: () => void;
  onSkipStep: () => void;
  onClose: () => void;
  onToggleCollapsed: () => void;
}

function actionLabel(trainingState: TrainingState): string | null {
  return trainingState.currentStep?.exampleAction?.label ?? null;
}

export const TrainingCoach: React.FC<TrainingCoachProps> = ({
  trainingState,
  onInsertExample,
  onSkipStep,
  onClose,
  onToggleCollapsed,
}) => {
  if (!trainingState.active) {
    return null;
  }

  const currentStep = trainingState.currentStep;
  const primaryActionLabel = actionLabel(trainingState);
  const unlockedAdvanced = trainingState.visibleSteps.filter((step) => step.track === 'advanced').length;

  return (
    <aside
      aria-labelledby="training-coach-title"
      className="pointer-events-auto w-full max-w-sm rounded-3xl border border-indigo-200/70 bg-white/85 p-4 text-slate-800 shadow-[0_24px_80px_rgba(79,70,229,0.18)] backdrop-blur-xl animate-in fade-in zoom-in-95 slide-in-from-bottom-2 dark:border-indigo-400/15 dark:bg-slate-900/88 dark:text-slate-100"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="mb-1 inline-flex rounded-full border border-indigo-300/70 bg-indigo-500/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-700 dark:border-indigo-300/20 dark:text-indigo-200">
            Training mode
          </div>
          <h3 id="training-coach-title" className="text-base font-semibold">
            {trainingState.isComplete ? 'Documento guiado completado' : currentStep?.title ?? 'Progreso de aprendizaje'}
          </h3>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onToggleCollapsed}
            className="rounded-xl px-2 py-1 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            aria-label={trainingState.collapsed ? 'Expandir coach de training' : 'Contraer coach de training'}
          >
            {trainingState.collapsed ? 'Abrir' : 'Compacto'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-2 py-1 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            aria-label="Cerrar training mode"
          >
            Cerrar
          </button>
        </div>
      </div>

      {trainingState.collapsed ? (
        <div className="mt-4 space-y-2">
          <div className="text-sm text-slate-600 dark:text-slate-300">
            {trainingState.isComplete
              ? 'Ya completaste la ruta guiada.'
              : `Paso actual: ${currentStep?.title ?? 'Sin pasos activos'}`}
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-800">
            <div
              className="h-full rounded-full bg-indigo-500 transition-all"
              style={{ width: `${trainingState.progressPercent}%` }}
            />
          </div>
        </div>
      ) : (
        <>
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-300">
              <span>
                Progreso {trainingState.completedVisibleCount}/{trainingState.totalVisibleCount}
              </span>
              <span>{trainingState.progressPercent}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-800">
              <div
                className="h-full rounded-full bg-indigo-500 transition-all"
                style={{ width: `${trainingState.progressPercent}%` }}
              />
            </div>
          </div>

          {trainingState.isComplete ? (
            <div className="mt-4 rounded-2xl border border-emerald-200/70 bg-emerald-500/10 p-3 text-sm text-emerald-800 dark:border-emerald-500/20 dark:text-emerald-200">
              La ruta base y los pasos avanzados desbloqueados ya están completados. Puedes cerrar el coach y seguir escribiendo o exportar otra versión del documento.
            </div>
          ) : currentStep ? (
            <>
              <div className="mt-4 rounded-2xl border border-white/70 bg-white/70 p-4 dark:border-white/5 dark:bg-slate-950/35">
                <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-indigo-700 dark:text-indigo-200">
                  Paso actual
                </div>
                <p className="text-sm leading-6 text-slate-700 dark:text-slate-200">{currentStep.instruction}</p>
                <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-slate-900/60 dark:text-slate-300">
                  Criterio de éxito: {currentStep.successCriteria}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {primaryActionLabel ? (
                  <button
                    type="button"
                    onClick={onInsertExample}
                    className="rounded-2xl bg-indigo-500 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-600"
                  >
                    {primaryActionLabel}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={onSkipStep}
                  className="rounded-2xl border border-slate-200/80 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-800 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200 dark:hover:border-slate-600"
                >
                  Saltar paso
                </button>
              </div>
            </>
          ) : null}

          <div className="mt-4 flex items-center justify-between text-xs text-slate-500 dark:text-slate-300">
            <span>Alertas activas: {trainingState.signals.warningCount}</span>
            <span>Avanzados desbloqueados: {unlockedAdvanced}</span>
          </div>
        </>
      )}
    </aside>
  );
};
