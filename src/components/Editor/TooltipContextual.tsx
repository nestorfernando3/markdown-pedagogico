import React, { useEffect, useMemo, useRef } from 'react';
import type { PedagogicalWarning } from '../../utils/markdownParser';

export type MarkdownAction = 'bold' | 'italic' | 'header' | 'list';

interface TooltipContextualProps {
  x: number;
  y: number;
  visible: boolean;
  type: 'format' | 'pedagogy';
  warning: PedagogicalWarning | null;
  tooltipId: string | null;
  onFormatAction: (action: MarkdownAction) => void;
  onFixAction: () => void;
  onIgnoreWarning: (warningId: string) => void;
  onClose: () => void;
}

interface FormatButtonProps {
  action: MarkdownAction;
  onAction: (action: MarkdownAction) => void;
  label: string;
  shortcut: string;
  description: string;
}

const CATEGORY_LABEL: Record<PedagogicalWarning['category'], string> = {
  structure: 'Estructura',
  style: 'Estilo',
  clarity: 'Claridad',
  syntax: 'Sintaxis',
};

const SEVERITY_BADGE_CLASS: Record<PedagogicalWarning['severity'], string> = {
  info: 'bg-sky-500/20 text-sky-700 dark:bg-sky-500/30 dark:text-sky-200',
  warning: 'bg-amber-500/20 text-amber-700 dark:bg-amber-500/30 dark:text-amber-200',
  error: 'bg-rose-500/20 text-rose-700 dark:bg-rose-500/30 dark:text-rose-200',
};

export const TooltipContextual: React.FC<TooltipContextualProps> = ({
  x,
  y,
  visible,
  type,
  warning,
  tooltipId,
  onFormatAction,
  onFixAction,
  onIgnoreWarning,
  onClose,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const estimatedWidth = type === 'pedagogy' ? 320 : 250;
  const halfWidth = estimatedWidth / 2;
  const screenWidth = typeof window !== 'undefined' ? window.innerWidth : 1000;

  const clampedX = useMemo(() => {
    let nextX = x;
    if (nextX - halfWidth < 16) {
      nextX = halfWidth + 16;
    }
    if (nextX + halfWidth > screenWidth - 16) {
      nextX = screenWidth - halfWidth - 16;
    }
    return nextX;
  }, [halfWidth, screenWidth, x]);

  const arrowOffset = x - clampedX;

  useEffect(() => {
    if (!visible || type !== 'pedagogy') {
      return;
    }

    const focusable = containerRef.current?.querySelector<HTMLElement>('button');
    focusable?.focus();
  }, [type, visible]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }

    if (event.key !== 'Tab' || !visible || type !== 'pedagogy') {
      return;
    }

    const focusableElements = containerRef.current?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    if (!focusableElements || focusableElements.length === 0) {
      event.preventDefault();
      return;
    }

    const first = focusableElements[0];
    const last = focusableElements[focusableElements.length - 1];
    const active = document.activeElement as HTMLElement | null;

    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      ref={containerRef}
      id={type === 'pedagogy' ? tooltipId ?? undefined : undefined}
      role={type === 'pedagogy' ? 'tooltip' : undefined}
      aria-hidden={!visible}
      onKeyDown={handleKeyDown}
      className={`
        fixed z-50 flex flex-col gap-2 px-5 py-4
        bg-white/80 dark:bg-[#1a1c23]/85
        backdrop-blur-2xl saturate-150
        border border-white/80 dark:border-white/10
        shadow-[0_8px_32px_0_rgba(99,102,241,0.15)] dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.5)]
        rounded-2xl transition-all duration-300 ease-out pointer-events-auto
        ${visible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-95 pointer-events-none'}
      `}
      style={{ top: y, left: clampedX, transform: 'translateX(-50%)' }}
    >
      {type === 'format' && (
        <div className="flex items-center gap-1.5">
          <FormatButton action="bold" onAction={onFormatAction} label="B" shortcut="Ctrl/Cmd+B" description="Negrita" />
          <FormatButton action="italic" onAction={onFormatAction} label="I" shortcut="Ctrl/Cmd+I" description="Cursiva" />
          <div className="w-px h-8 bg-slate-300/50 dark:bg-slate-700/50 mx-1" />
          <FormatButton action="header" onAction={onFormatAction} label="H" shortcut="# Título" description="Título" />
          <FormatButton action="list" onAction={onFormatAction} label="≡" shortcut="- Ítem" description="Lista" />
        </div>
      )}

      {type === 'pedagogy' && warning && (
        <div className="flex flex-col gap-3 max-w-72" aria-describedby={`warning-${warning.id}`}>
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">Advertencia pedagógica</div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10"
              aria-label="Cerrar tooltip"
              title="Cerrar"
            >
              Cerrar
            </button>
          </div>

          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide">
            <span className="rounded-md px-2 py-1 bg-slate-200/70 text-slate-700 dark:bg-slate-700/70 dark:text-slate-200">
              {CATEGORY_LABEL[warning.category]}
            </span>
            <span className={`rounded-md px-2 py-1 ${SEVERITY_BADGE_CLASS[warning.severity]}`}>{warning.severity}</span>
          </div>

          <p id={`warning-${warning.id}`} className="text-xs text-slate-600 dark:text-slate-300">
            {warning.message}
          </p>

          <div className="flex flex-wrap gap-2">
            {warning.replacementConfig && (
              <button
                type="button"
                onClick={onFixAction}
                className="rounded-lg py-1.5 px-3 bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 dark:bg-indigo-500/30 hover:bg-indigo-500/30 transition-colors text-xs font-semibold"
              >
                Aplicar sugerencia
              </button>
            )}

            <button
              type="button"
              onClick={() => onIgnoreWarning(warning.id)}
              className="rounded-lg py-1.5 px-3 bg-slate-500/20 text-slate-700 dark:text-slate-200 dark:bg-slate-500/30 hover:bg-slate-500/30 transition-colors text-xs font-semibold"
            >
              Ignorar en sesión
            </button>
          </div>
        </div>
      )}

      <div
        className="absolute -top-2 w-4 h-4 -translate-x-1/2 rotate-45 bg-white/70 dark:bg-[#1a1c23]/85 backdrop-blur-xl border-t border-l border-white/40 dark:border-white/10 -z-10 transition-all duration-200"
        style={{ left: `calc(50% + ${arrowOffset}px)` }}
      />
    </div>
  );
};

const FormatButton: React.FC<FormatButtonProps> = ({ action, onAction, label, shortcut, description }) => {
  const [isHovered, setIsHovered] = React.useState(false);

  return (
    <button
      type="button"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onAction(action)}
      className="flex flex-col items-center justify-center p-2 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors relative min-w-[3.5rem]"
      aria-label={description}
      title={shortcut}
    >
      <span className={`text-lg mb-0.5 ${action === 'bold' || action === 'header' ? 'font-bold' : action === 'italic' ? 'italic font-serif' : ''}`}>
        {label}
      </span>
      <span className="text-[10px] uppercase font-semibold opacity-60 tracking-wider">{description}</span>

      <div
        className={`
          absolute -top-12 transition-all duration-200 z-50
          ${isHovered ? 'opacity-100 visible translate-y-0' : 'opacity-0 invisible translate-y-2'}
          bg-slate-800 dark:bg-slate-100 dark:text-slate-900 text-white text-xs py-1.5 px-3 rounded-lg whitespace-nowrap pointer-events-none shadow-xl border border-slate-700 dark:border-slate-200 font-medium
        `}
      >
        {shortcut}
        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-800 dark:bg-slate-100 rotate-45 border-b border-r border-slate-700 dark:border-slate-200" />
      </div>
    </button>
  );
};
