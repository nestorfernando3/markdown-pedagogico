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

  if (trainingState.collapsed) {
    return (
      <div
        aria-labelledby="training-coach-title"
        className="pointer-events-auto inline-flex w-full max-w-[17rem] items-center justify-between gap-3 rounded-2xl border border-indigo-200/70 bg-white/92 px-3.5 py-3 text-slate-900 shadow-[0_18px_42px_rgba(79,70,229,0.12)] backdrop-blur-xl dark:border-indigo-400/18 dark:bg-slate-950/86 dark:text-slate-50"
      >
        <div className="min-w-0">
          <div className="mb-1 inline-flex rounded-full bg-indigo-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-indigo-700 dark:text-indigo-200">
            Guía activa
          </div>
          <h3 id="training-coach-title" className="truncate text-sm font-semibold">
            {trainingState.isComplete ? 'Ruta completada' : currentStep?.title ?? 'Siguiente paso'}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-300">{trainingState.progressPercent}%</span>
          <button
            type="button"
            onClick={onToggleCollapsed}
            className="rounded-xl px-2 py-1 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-slate-50"
            aria-label="Expandir coach de training"
          >
            Abrir
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      aria-labelledby="training-coach-title"
      className="pointer-events-auto w-full max-w-[20rem] rounded-[1.75rem] border border-indigo-200/70 bg-white/94 p-4 text-slate-900 shadow-[0_24px_72px_rgba(79,70,229,0.14)] backdrop-blur-xl dark:border-indigo-400/16 dark:bg-slate-950/88 dark:text-slate-50"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-2 inline-flex rounded-full border border-indigo-200/80 bg-indigo-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-indigo-700 dark:border-indigo-400/18 dark:text-indigo-200">
            Guía activa
          </div>
          <h3 id="training-coach-title" className="text-[1.05rem] font-semibold leading-tight">
            {trainingState.isComplete ? 'Documento listo para seguir por tu cuenta' : currentStep?.title ?? 'Siguiente paso'}
          </h3>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onToggleCollapsed}
            className="rounded-xl px-2 py-1 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-slate-50"
            aria-label="Contraer coach de training"
          >
            Compacto
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-2 py-1 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-slate-50"
            aria-label="Cerrar training mode"
          >
            Cerrar
          </button>
        </div>
      </div>

      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-slate-500 dark:text-slate-300">
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
          <div className="mt-4 rounded-2xl border border-emerald-200/80 bg-emerald-500/8 px-4 py-3 text-sm leading-6 text-emerald-800 dark:border-emerald-500/20 dark:text-emerald-200">
            Ya completaste la ruta visible. Puedes seguir escribiendo o exportar otra versión del documento.
          </div>
        ) : currentStep ? (
          <>
          <div className="mt-4 rounded-2xl border border-slate-200/80 bg-white/80 px-4 py-4 dark:border-white/6 dark:bg-slate-900/64">
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-indigo-700 dark:text-indigo-200">
              Paso actual
            </div>
            <p className="text-[0.95rem] leading-6 text-slate-700 dark:text-slate-200">{currentStep.instruction}</p>
            <div className="mt-3 rounded-xl bg-slate-100/90 px-3 py-2 text-[11px] leading-5 text-slate-600 dark:bg-slate-900/80 dark:text-slate-300">
              Para completarlo: {currentStep.successCriteria}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {primaryActionLabel ? (
              <button
                type="button"
                onClick={onInsertExample}
                className="rounded-2xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-500"
              >
                {primaryActionLabel}
              </button>
            ) : null}
            <button
              type="button"
              onClick={onSkipStep}
              className="rounded-2xl border border-slate-200/80 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-800 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-200 dark:hover:border-slate-600"
            >
              Saltar paso
            </button>
          </div>
        </>
      ) : null}

      <div className="mt-4 flex items-center justify-between gap-4 border-t border-slate-200/80 pt-3 text-[11px] text-slate-500 dark:border-white/8 dark:text-slate-300">
        <span>{trainingState.signals.warningCount} alertas activas</span>
        <span>{unlockedAdvanced} pasos avanzados visibles</span>
      </div>
    </div>
  );
};
