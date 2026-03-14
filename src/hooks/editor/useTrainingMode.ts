import { useCallback, useEffect, useMemo, useState } from 'react';
import type { TrainingSignals } from '../../utils/trainingMode';

type TrainingTrack = 'base' | 'advanced';
type TrainingHighlightTarget = 'editor' | 'preview';

export type TrainingExampleAction =
  | {
      kind: 'snippet';
      snippet: string;
      label: string;
      placement?: 'selection' | 'append';
      selectionStartOffset?: number;
      selectionEndOffset?: number;
    }
  | { kind: 'export'; label: string };

export interface TrainingProgress {
  active: boolean;
  collapsed: boolean;
  currentStepId: string | null;
  completedStepIds: string[];
  dismissedStepIds: string[];
  lastSeenAt: number | null;
  activationExportCount: number;
}

export interface TrainingStepContext {
  active: boolean;
  signals: TrainingSignals;
  completedStepIds: Set<string>;
  dismissedStepIds: Set<string>;
  successfulExportCount: number;
  activationExportCount: number;
}

export interface TrainingStep {
  id: string;
  track: TrainingTrack;
  title: string;
  instruction: string;
  successCriteria: string;
  exampleAction: TrainingExampleAction | null;
  highlightTarget: TrainingHighlightTarget;
  unlockWhen: (context: TrainingStepContext) => boolean;
  completeWhen: (context: TrainingStepContext) => boolean;
}

export interface TrainingState {
  active: boolean;
  collapsed: boolean;
  currentStep: TrainingStep | null;
  currentStepId: string | null;
  visibleSteps: TrainingStep[];
  completedStepIds: string[];
  dismissedStepIds: string[];
  progressPercent: number;
  completedVisibleCount: number;
  totalVisibleCount: number;
  lastSeenAt: number | null;
  signals: TrainingSignals;
  isComplete: boolean;
  highlightTarget: TrainingHighlightTarget;
}

export interface UseTrainingModeResult {
  trainingState: TrainingState;
  toggleTrainingMode: () => void;
  closeTrainingMode: () => void;
  skipCurrentStep: () => void;
  toggleTrainingCollapsed: () => void;
}

const TRAINING_STORAGE_KEY = 'markdown-pedagogico:training-progress';

const BASE_STEP_IDS = [
  'title-main',
  'intro-paragraph',
  'basic-emphasis',
  'basic-list',
  'basic-link',
  'useful-block',
  'export-final',
] as const;

function createDefaultProgress(): TrainingProgress {
  return {
    active: false,
    collapsed: false,
    currentStepId: null,
    completedStepIds: [],
    dismissedStepIds: [],
    lastSeenAt: null,
    activationExportCount: 0,
  };
}

function normalizeProgress(value: unknown): TrainingProgress {
  if (typeof value !== 'object' || value === null) {
    return createDefaultProgress();
  }

  const candidate = value as Partial<TrainingProgress>;
  return {
    active: candidate.active === true,
    collapsed: candidate.collapsed === true,
    currentStepId: typeof candidate.currentStepId === 'string' ? candidate.currentStepId : null,
    completedStepIds: Array.isArray(candidate.completedStepIds)
      ? candidate.completedStepIds.filter((entry): entry is string => typeof entry === 'string')
      : [],
    dismissedStepIds: Array.isArray(candidate.dismissedStepIds)
      ? candidate.dismissedStepIds.filter((entry): entry is string => typeof entry === 'string')
      : [],
    lastSeenAt: typeof candidate.lastSeenAt === 'number' ? candidate.lastSeenAt : null,
    activationExportCount: typeof candidate.activationExportCount === 'number' ? candidate.activationExportCount : 0,
  };
}

function uniqueIds(value: Iterable<string>): string[] {
  return Array.from(new Set(value));
}

const TRAINING_STEPS: TrainingStep[] = [
  {
    id: 'title-main',
    track: 'base',
    title: 'Crea un título principal',
    instruction: 'Empieza el documento con un encabezado H1 para decir de qué trata.',
    successCriteria: 'Debe existir un título principal usando `#`.',
    exampleAction: {
      kind: 'snippet',
      snippet: '# Mi documento\n',
      label: 'Insertar ejemplo',
      placement: 'append',
      selectionStartOffset: 2,
      selectionEndOffset: 14,
    },
    highlightTarget: 'editor',
    unlockWhen: () => true,
    completeWhen: ({ signals }) => signals.hasH1,
  },
  {
    id: 'intro-paragraph',
    track: 'base',
    title: 'Añade un primer párrafo',
    instruction: 'Escribe una idea corta que explique el objetivo del documento.',
    successCriteria: 'Debe existir al menos un párrafo con contenido.',
    exampleAction: {
      kind: 'snippet',
      snippet: '\nEste documento resume la idea principal y organiza el contenido paso a paso.\n',
      label: 'Insertar ejemplo',
      placement: 'append',
      selectionStartOffset: 1,
      selectionEndOffset: 71,
    },
    highlightTarget: 'editor',
    unlockWhen: ({ completedStepIds }) => completedStepIds.has('title-main'),
    completeWhen: ({ signals }) => signals.hasParagraph && signals.wordCount >= 8,
  },
  {
    id: 'basic-emphasis',
    track: 'base',
    title: 'Resalta una idea importante',
    instruction: 'Usa negrita o cursiva para destacar una palabra o concepto clave.',
    successCriteria: 'Debe existir al menos un énfasis en el documento.',
    exampleAction: {
      kind: 'snippet',
      snippet: '\n**idea clave**\n',
      label: 'Insertar ejemplo',
      placement: 'append',
      selectionStartOffset: 3,
      selectionEndOffset: 13,
    },
    highlightTarget: 'editor',
    unlockWhen: ({ completedStepIds }) => completedStepIds.has('intro-paragraph'),
    completeWhen: ({ signals }) => signals.hasEmphasis,
  },
  {
    id: 'basic-list',
    track: 'base',
    title: 'Convierte ideas en una lista',
    instruction: 'Agrupa varios puntos relacionados usando una lista Markdown.',
    successCriteria: 'Debe existir al menos una lista.',
    exampleAction: {
      kind: 'snippet',
      snippet: '\n- Punto uno\n- Punto dos\n',
      label: 'Insertar ejemplo',
      placement: 'append',
      selectionStartOffset: 3,
      selectionEndOffset: 12,
    },
    highlightTarget: 'editor',
    unlockWhen: ({ completedStepIds }) => completedStepIds.has('basic-emphasis'),
    completeWhen: ({ signals }) => signals.hasList,
  },
  {
    id: 'basic-link',
    track: 'base',
    title: 'Añade un enlace',
    instruction: 'Conecta el documento con una fuente, referencia o recurso externo.',
    successCriteria: 'Debe existir al menos un enlace.',
    exampleAction: {
      kind: 'snippet',
      snippet: '\n[Recurso útil](https://ejemplo.com)\n',
      label: 'Insertar ejemplo',
      placement: 'append',
      selectionStartOffset: 16,
      selectionEndOffset: 35,
    },
    highlightTarget: 'editor',
    unlockWhen: ({ completedStepIds }) => completedStepIds.has('basic-list'),
    completeWhen: ({ signals }) => signals.hasLink,
  },
  {
    id: 'useful-block',
    track: 'base',
    title: 'Inserta un bloque útil',
    instruction: 'Prueba un bloque que añada valor al documento, como código, cita o imagen.',
    successCriteria: 'Debe existir un bloque de código, una cita o una imagen.',
    exampleAction: {
      kind: 'snippet',
      snippet: '\n```md\ncodigo\n```\n',
      label: 'Insertar ejemplo',
      placement: 'append',
      selectionStartOffset: 7,
      selectionEndOffset: 13,
    },
    highlightTarget: 'editor',
    unlockWhen: ({ completedStepIds }) => completedStepIds.has('basic-link'),
    completeWhen: ({ signals }) => signals.hasCodeFence || signals.hasQuote || signals.hasImage,
  },
  {
    id: 'export-final',
    track: 'base',
    title: 'Exporta tu documento',
    instruction: 'Haz una primera exportación para comprobar que el documento ya está listo para salir.',
    successCriteria: 'Se debe ejecutar una exportación PDF después de activar el training.',
    exampleAction: {
      kind: 'export',
      label: 'Exportar ahora',
    },
    highlightTarget: 'preview',
    unlockWhen: ({ completedStepIds }) => completedStepIds.has('useful-block'),
    completeWhen: ({ active, successfulExportCount, activationExportCount }) =>
      active && successfulExportCount > activationExportCount,
  },
  {
    id: 'sections-structure',
    track: 'advanced',
    title: 'Organiza secciones',
    instruction: 'Divide el documento en secciones con subtítulos para mejorar la navegación.',
    successCriteria: 'Debe existir más de un encabezado y profundidad mínima H2.',
    exampleAction: {
      kind: 'snippet',
      snippet: '\n## Nueva sección\n',
      label: 'Insertar ejemplo',
      placement: 'append',
      selectionStartOffset: 4,
      selectionEndOffset: 17,
    },
    highlightTarget: 'editor',
    unlockWhen: ({ completedStepIds, signals }) =>
      BASE_STEP_IDS.every((stepId) => completedStepIds.has(stepId)) && signals.wordCount >= 12,
    completeWhen: ({ signals }) => signals.headingCount >= 2 && signals.headingDepth >= 2,
  },
  {
    id: 'table-data',
    track: 'advanced',
    title: 'Presenta datos en tabla',
    instruction: 'Cuando comparas datos o atributos, una tabla suele ser más clara que un párrafo largo.',
    successCriteria: 'Debe existir una tabla Markdown.',
    exampleAction: {
      kind: 'snippet',
      snippet: '\n| Campo | Valor |\n| --- | --- |\n| Ejemplo | Dato |\n',
      label: 'Insertar ejemplo',
      placement: 'append',
      selectionStartOffset: 3,
      selectionEndOffset: 17,
    },
    highlightTarget: 'editor',
    unlockWhen: ({ completedStepIds, signals }) =>
      completedStepIds.has('sections-structure') || (BASE_STEP_IDS.every((stepId) => completedStepIds.has(stepId)) && signals.hasList),
    completeWhen: ({ signals }) => signals.hasTable,
  },
  {
    id: 'admonition-callout',
    track: 'advanced',
    title: 'Destaca una nota importante',
    instruction: 'Usa una admonition cuando quieras resaltar una advertencia, tip o nota clave.',
    successCriteria: 'Debe existir una admonition válida.',
    exampleAction: {
      kind: 'snippet',
      snippet: '\n> [!NOTE]\n> Nota importante.\n',
      label: 'Insertar ejemplo',
      placement: 'append',
      selectionStartOffset: 13,
      selectionEndOffset: 28,
    },
    highlightTarget: 'editor',
    unlockWhen: ({ completedStepIds }) => completedStepIds.has('sections-structure'),
    completeWhen: ({ signals }) => signals.hasAdmonition,
  },
  {
    id: 'code-language',
    track: 'advanced',
    title: 'Etiqueta el lenguaje del código',
    instruction: 'Si incluyes código, define el lenguaje para activar resaltado y mejor lectura.',
    successCriteria: 'Debe existir al menos un bloque de código con lenguaje.',
    exampleAction: {
      kind: 'snippet',
      snippet: '\n```ts\nconst ejemplo = true;\n```\n',
      label: 'Insertar ejemplo',
      placement: 'append',
      selectionStartOffset: 7,
      selectionEndOffset: 28,
    },
    highlightTarget: 'editor',
    unlockWhen: ({ completedStepIds, signals }) =>
      completedStepIds.has('useful-block') && (signals.isTechnicalDocument || signals.hasCodeFence),
    completeWhen: ({ signals }) => signals.hasCodeLanguage,
  },
  {
    id: 'footnote-reference',
    track: 'advanced',
    title: 'Añade una nota al pie',
    instruction: 'Usa notas al pie para ampliar detalles sin interrumpir la lectura principal.',
    successCriteria: 'Debe existir una nota al pie.',
    exampleAction: {
      kind: 'snippet',
      snippet: '\nDato importante[^1]\n\n[^1]: Amplía este detalle.\n',
      label: 'Insertar ejemplo',
      placement: 'append',
      selectionStartOffset: 1,
      selectionEndOffset: 15,
    },
    highlightTarget: 'editor',
    unlockWhen: ({ completedStepIds, signals }) =>
      completedStepIds.has('basic-link') && (signals.wordCount >= 20 || signals.hasLink),
    completeWhen: ({ signals }) => signals.hasFootnote,
  },
  {
    id: 'toc-navigation',
    track: 'advanced',
    title: 'Activa una tabla de contenido',
    instruction: 'Cuando el documento crece, la tabla de contenido mejora la navegación.',
    successCriteria: 'Debe existir un placeholder `[TOC]`.',
    exampleAction: {
      kind: 'snippet',
      snippet: '\n[TOC]\n',
      label: 'Insertar ejemplo',
      placement: 'append',
      selectionStartOffset: 2,
      selectionEndOffset: 5,
    },
    highlightTarget: 'preview',
    unlockWhen: ({ completedStepIds, signals }) => completedStepIds.has('sections-structure') && signals.headingCount >= 3,
    completeWhen: ({ signals }) => signals.hasToc,
  },
  {
    id: 'emoji-shortcode',
    track: 'advanced',
    title: 'Usa un emoji shortcode',
    instruction: 'Puedes dar tono visual rápido con shortcodes como `:sparkles:` sin romper el Markdown.',
    successCriteria: 'Debe existir al menos un emoji shortcode.',
    exampleAction: {
      kind: 'snippet',
      snippet: '\n:sparkles:\n',
      label: 'Insertar ejemplo',
      placement: 'append',
      selectionStartOffset: 1,
      selectionEndOffset: 11,
    },
    highlightTarget: 'preview',
    unlockWhen: ({ completedStepIds, signals }) =>
      completedStepIds.has('intro-paragraph') && signals.wordCount >= 10,
    completeWhen: ({ signals }) => signals.hasEmojiShortcode,
  },
  {
    id: 'technical-diagram',
    track: 'advanced',
    title: 'Añade una fórmula o diagrama',
    instruction: 'Si el documento es técnico, puedes enriquecerlo con Mermaid o matemáticas.',
    successCriteria: 'Debe existir Mermaid o un bloque matemático.',
    exampleAction: {
      kind: 'snippet',
      snippet: '\n```mermaid\ngraph TD\n  A[Idea] --> B[Resultado]\n```\n',
      label: 'Insertar ejemplo',
      placement: 'append',
      selectionStartOffset: 12,
      selectionEndOffset: 51,
    },
    highlightTarget: 'preview',
    unlockWhen: ({ completedStepIds, signals }) =>
      BASE_STEP_IDS.every((stepId) => completedStepIds.has(stepId)) && signals.isTechnicalDocument,
    completeWhen: ({ signals }) => signals.hasMermaid || signals.hasMath,
  },
];

function buildContext(
  signals: TrainingSignals,
  progress: TrainingProgress,
  successfulExportCount: number
): TrainingStepContext {
  return {
    active: progress.active,
    signals,
    completedStepIds: new Set(progress.completedStepIds),
    dismissedStepIds: new Set(progress.dismissedStepIds),
    successfulExportCount,
    activationExportCount: progress.activationExportCount,
  };
}

export function resolveObservedCompletedSteps(
  signals: TrainingSignals,
  progress: Pick<TrainingProgress, 'active' | 'completedStepIds' | 'dismissedStepIds' | 'activationExportCount'>,
  successfulExportCount: number
): string[] {
  const context = buildContext(
    signals,
    {
      ...createDefaultProgress(),
      ...progress,
    },
    successfulExportCount
  );

  const completedIds = new Set(progress.completedStepIds);
  for (const step of TRAINING_STEPS) {
    if (step.completeWhen(context)) {
      completedIds.add(step.id);
      context.completedStepIds.add(step.id);
    }
  }

  return Array.from(completedIds);
}

export function resolveVisibleTrainingSteps(
  signals: TrainingSignals,
  progress: Pick<TrainingProgress, 'active' | 'completedStepIds' | 'dismissedStepIds' | 'activationExportCount'>,
  successfulExportCount: number
): TrainingStep[] {
  const context = buildContext(
    signals,
    {
      ...createDefaultProgress(),
      ...progress,
    },
    successfulExportCount
  );

  return TRAINING_STEPS.filter((step) => {
    return step.unlockWhen(context) || context.completedStepIds.has(step.id) || context.dismissedStepIds.has(step.id);
  });
}

export function resolveCurrentTrainingStep(
  signals: TrainingSignals,
  progress: Pick<TrainingProgress, 'active' | 'completedStepIds' | 'dismissedStepIds' | 'activationExportCount'>,
  successfulExportCount: number
): TrainingStep | null {
  const visibleSteps = resolveVisibleTrainingSteps(signals, progress, successfulExportCount);
  const completedIds = new Set(progress.completedStepIds);
  const dismissedIds = new Set(progress.dismissedStepIds);

  for (const step of visibleSteps) {
    if (completedIds.has(step.id) || dismissedIds.has(step.id)) {
      continue;
    }
    return step;
  }

  return null;
}

export function useTrainingMode(signals: TrainingSignals, successfulExportCount: number): UseTrainingModeResult {
  const [progress, setProgress] = useState<TrainingProgress>(() => {
    if (typeof window === 'undefined') {
      return createDefaultProgress();
    }

    try {
      const raw = window.localStorage.getItem(TRAINING_STORAGE_KEY);
      return raw ? normalizeProgress(JSON.parse(raw)) : createDefaultProgress();
    } catch {
      return createDefaultProgress();
    }
  });

  const completedStepIds = useMemo(
    () =>
      uniqueIds(
        resolveObservedCompletedSteps(
          signals,
          {
            active: progress.active,
            completedStepIds: progress.completedStepIds,
            dismissedStepIds: progress.dismissedStepIds,
            activationExportCount: progress.activationExportCount,
          },
          successfulExportCount
        )
      ),
    [progress.activationExportCount, progress.completedStepIds, progress.dismissedStepIds, signals, successfulExportCount]
  );

  const visibleSteps = useMemo(
    () =>
      resolveVisibleTrainingSteps(
        signals,
        {
          active: progress.active,
          completedStepIds,
          dismissedStepIds: progress.dismissedStepIds,
          activationExportCount: progress.activationExportCount,
        },
        successfulExportCount
      ),
    [completedStepIds, progress.activationExportCount, progress.dismissedStepIds, signals, successfulExportCount]
  );

  const currentStep = useMemo(
    () =>
      resolveCurrentTrainingStep(
        signals,
        {
          active: progress.active,
          completedStepIds,
          dismissedStepIds: progress.dismissedStepIds,
          activationExportCount: progress.activationExportCount,
        },
        successfulExportCount
      ),
    [completedStepIds, progress.activationExportCount, progress.dismissedStepIds, signals, successfulExportCount]
  );

  const completedVisibleCount = useMemo(
    () => visibleSteps.filter((step) => completedStepIds.includes(step.id)).length,
    [completedStepIds, visibleSteps]
  );

  const totalVisibleCount = visibleSteps.length;
  const progressPercent = totalVisibleCount === 0 ? 100 : Math.round((completedVisibleCount / totalVisibleCount) * 100);
  const isComplete = totalVisibleCount > 0 && currentStep === null;

  useEffect(() => {
    const previousIds = progress.completedStepIds.join('|');
    const nextIds = completedStepIds.join('|');
    if (previousIds === nextIds) {
      return;
    }

    setProgress((previous) => ({
      ...previous,
      completedStepIds,
    }));
  }, [completedStepIds, progress.completedStepIds]);

  useEffect(() => {
    const currentStepId = currentStep?.id ?? null;
    if (progress.currentStepId === currentStepId) {
      return;
    }

    setProgress((previous) => ({
      ...previous,
      currentStepId,
      lastSeenAt: previous.active ? Date.now() : previous.lastSeenAt,
    }));
  }, [currentStep?.id, progress.currentStepId, progress.active]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }

    const storage = window.localStorage as Partial<Storage>;
    if (typeof storage.setItem !== 'function') {
      return;
    }

    storage.setItem(TRAINING_STORAGE_KEY, JSON.stringify(progress));
  }, [progress]);

  const toggleTrainingMode = useCallback(() => {
    setProgress((previous) => {
      if (previous.active) {
        return {
          ...previous,
          active: false,
          lastSeenAt: Date.now(),
        };
      }

      return {
        ...previous,
        active: true,
        collapsed: false,
        activationExportCount: successfulExportCount,
        lastSeenAt: Date.now(),
      };
    });
  }, [successfulExportCount]);

  const closeTrainingMode = useCallback(() => {
    setProgress((previous) => ({
      ...previous,
      active: false,
      lastSeenAt: Date.now(),
    }));
  }, []);

  const skipCurrentStep = useCallback(() => {
    if (!currentStep) {
      return;
    }

    setProgress((previous) => ({
      ...previous,
      dismissedStepIds: uniqueIds([...previous.dismissedStepIds, currentStep.id]),
      lastSeenAt: Date.now(),
    }));
  }, [currentStep]);

  const toggleTrainingCollapsed = useCallback(() => {
    setProgress((previous) => ({
      ...previous,
      collapsed: !previous.collapsed,
      lastSeenAt: Date.now(),
    }));
  }, []);

  return {
    trainingState: {
      active: progress.active,
      collapsed: progress.collapsed,
      currentStep,
      currentStepId: currentStep?.id ?? null,
      visibleSteps,
      completedStepIds,
      dismissedStepIds: progress.dismissedStepIds,
      progressPercent,
      completedVisibleCount,
      totalVisibleCount,
      lastSeenAt: progress.lastSeenAt,
      signals: {
        ...signals,
        warningCount: signals.warningCount,
      },
      isComplete,
      highlightTarget: currentStep?.highlightTarget ?? 'editor',
    },
    toggleTrainingMode,
    closeTrainingMode,
    skipCurrentStep,
    toggleTrainingCollapsed,
  };
}
