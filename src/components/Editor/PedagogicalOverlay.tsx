import React from 'react';
import type { PedagogicalWarning } from '../../utils/markdownParser';

interface PedagogicalOverlayProps {
  warnings: PedagogicalWarning[];
  onToggleWarning: (warning: PedagogicalWarning | null, rect?: DOMRect, trigger?: HTMLElement) => void;
  isZenMode: boolean;
  scrollTop: number;
  newWarningIds: Set<string>;
  activeWarningId: string | null;
  tooltipId: string | null;
}

const LINE_HEIGHT_PX = 28;

const HIGHLIGHT_CLASS: Record<PedagogicalWarning['severity'], string> = {
  info: 'bg-sky-500/10 dark:bg-sky-400/10',
  warning: 'bg-amber-500/10 dark:bg-amber-400/10',
  error: 'bg-rose-500/10 dark:bg-rose-400/10',
};

const DOT_CLASS: Record<PedagogicalWarning['severity'], string> = {
  info: 'bg-sky-500 dark:bg-sky-300',
  warning: 'bg-amber-500 dark:bg-amber-300',
  error: 'bg-rose-500 dark:bg-rose-300',
};

const BORDER_CLASS: Record<PedagogicalWarning['severity'], string> = {
  info: 'border-sky-400/80 dark:border-sky-300/80',
  warning: 'border-amber-400/80 dark:border-amber-300/80',
  error: 'border-rose-400/80 dark:border-rose-300/80',
};

export const PedagogicalOverlay: React.FC<PedagogicalOverlayProps> = ({
  warnings,
  onToggleWarning,
  isZenMode,
  scrollTop,
  newWarningIds,
  activeWarningId,
  tooltipId,
}) => {
  const uniqueLineWarnings = React.useMemo(() => {
    const warningByLine = new Map<number, PedagogicalWarning>();
    for (const warning of warnings) {
      const line = Math.max(1, warning.line);
      if (!warningByLine.has(line)) {
        warningByLine.set(line, warning);
      }
    }
    return Array.from(warningByLine.values()).slice(0, 180);
  }, [warnings]);

  return (
    <div className="absolute inset-0 pointer-events-none py-8 pr-8 pl-[4.5rem] font-mono text-lg leading-7 z-20 overflow-hidden">
      <div className="relative w-full h-full" style={{ transform: `translateY(-${scrollTop}px)` }}>
        {uniqueLineWarnings.map((warning) => {
          const top = (Math.max(1, warning.line) - 1) * LINE_HEIGHT_PX;
          const isNewError = warning.severity === 'error' && newWarningIds.has(warning.id);
          const isActive = activeWarningId === warning.id;
          const markerId = `warning-marker-${warning.id.replace(/[^a-zA-Z0-9_-]/g, '-')}`;

          return (
            <div key={warning.id} className="absolute left-0 right-0" style={{ top }}>
              <div
                aria-hidden="true"
                className={`h-7 rounded-md border-b-2 border-transparent transition-colors pointer-events-none ${HIGHLIGHT_CLASS[warning.severity]}`}
              />

              <button
                type="button"
                id={markerId}
                className={`absolute -left-10 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white/80 dark:bg-[#1a1c23]/95 border backdrop-blur-md shadow-[0_2px_15px_rgba(99,102,241,0.35)] flex items-center justify-center pointer-events-auto group cursor-pointer transition-all hover:scale-125 ${
                  BORDER_CLASS[warning.severity]
                } ${isZenMode ? 'opacity-0 hover:opacity-100 focus:opacity-100' : ''} ${isNewError ? 'animate-pulse' : ''}`}
                onClick={(event) => {
                  event.stopPropagation();
                  onToggleWarning(warning, event.currentTarget.getBoundingClientRect(), event.currentTarget);
                }}
                aria-controls={isActive ? tooltipId ?? undefined : undefined}
                aria-describedby={isActive ? tooltipId ?? undefined : undefined}
                aria-expanded={isActive}
                aria-label={`Advertencia ${warning.severity} en línea ${warning.line}: ${warning.message}`}
                title={`Línea ${warning.line}: ${warning.message}`}
              >
                <div aria-hidden="true" className={`w-2 h-2 rounded-full transition-colors ${DOT_CLASS[warning.severity]}`} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
