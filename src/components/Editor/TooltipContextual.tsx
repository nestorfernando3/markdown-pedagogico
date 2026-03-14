import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { PedagogicalWarning } from '../../utils/markdownParser';

export type MarkdownAction =
  | 'bold'
  | 'italic'
  | 'strikethrough'
  | 'underline'
  | 'highlight'
  | 'inlineCode'
  | 'inlineMath'
  | 'superscript'
  | 'subscript'
  | 'kbd'
  | 'link'
  | 'linkReference'
  | 'image'
  | 'video'
  | 'table'
  | 'footnote'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'h4'
  | 'h5'
  | 'h6'
  | 'quote'
  | 'codeBlock'
  | 'mathBlock'
  | 'admonition'
  | 'details'
  | 'horizontalRule'
  | 'unorderedList'
  | 'orderedList'
  | 'taskList'
  | 'definitionList'
  | 'toc'
  | 'frontMatter'
  | 'pageBreak'
  | 'emoji'
  | 'htmlComment'
  | 'mermaid';

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

interface FormatActionItem {
  action: MarkdownAction;
  description: string;
  shortcut: string;
  compact: boolean;
}

interface FormatGroup {
  id: string;
  title: string;
  items: FormatActionItem[];
}

type FormatDensity = 'compact' | 'complete';

const FORMAT_DENSITY_STORAGE_KEY = 'markdown-pedagogico:format-density';

function readStoredFormatDensity(): FormatDensity | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const storage = window.localStorage;
  if (!storage || typeof storage.getItem !== 'function') {
    return null;
  }

  const storedDensity = storage.getItem(FORMAT_DENSITY_STORAGE_KEY);
  return storedDensity === 'compact' || storedDensity === 'complete' ? storedDensity : null;
}

function persistFormatDensity(nextDensity: FormatDensity): void {
  if (typeof window === 'undefined') {
    return;
  }

  const storage = window.localStorage;
  if (!storage || typeof storage.setItem !== 'function') {
    return;
  }

  storage.setItem(FORMAT_DENSITY_STORAGE_KEY, nextDensity);
}

function triggerIdFor(groupId: string): string {
  return `format-group-trigger-${groupId}`;
}

const FORMAT_GROUPS: FormatGroup[] = [
  {
    id: 'texto',
    title: 'Texto',
    items: [
      { action: 'bold', description: 'Negrita', shortcut: 'Ctrl/Cmd+B', compact: true },
      { action: 'italic', description: 'Cursiva', shortcut: 'Ctrl/Cmd+I', compact: true },
      { action: 'strikethrough', description: 'Tachado', shortcut: '~~texto~~', compact: false },
      { action: 'underline', description: 'Subrayado', shortcut: '<u>texto</u>', compact: false },
      { action: 'highlight', description: 'Resaltado', shortcut: '==texto==', compact: true },
      { action: 'inlineCode', description: 'Codigo inline', shortcut: '`codigo`', compact: true },
      { action: 'inlineMath', description: 'Formula inline', shortcut: '$x + y$', compact: false },
      { action: 'superscript', description: 'Superindice', shortcut: '^x^', compact: false },
      { action: 'subscript', description: 'Subindice', shortcut: '~x~', compact: false },
      { action: 'kbd', description: 'Atajo de teclado', shortcut: '<kbd>Ctrl+S</kbd>', compact: false },
    ],
  },
  {
    id: 'titulos',
    title: 'Titulos',
    items: [
      { action: 'h1', description: 'Titulo H1', shortcut: '# Titulo', compact: true },
      { action: 'h2', description: 'Titulo H2', shortcut: '## Titulo', compact: true },
      { action: 'h3', description: 'Titulo H3', shortcut: '### Titulo', compact: true },
      { action: 'h4', description: 'Titulo H4', shortcut: '#### Titulo', compact: false },
      { action: 'h5', description: 'Titulo H5', shortcut: '##### Titulo', compact: false },
      { action: 'h6', description: 'Titulo H6', shortcut: '###### Titulo', compact: false },
    ],
  },
  {
    id: 'listas',
    title: 'Listas',
    items: [
      { action: 'unorderedList', description: 'Lista no ordenada', shortcut: '- item', compact: true },
      { action: 'orderedList', description: 'Lista ordenada', shortcut: '1. item', compact: true },
      { action: 'taskList', description: 'Checklist', shortcut: '- [ ] tarea', compact: true },
      { action: 'definitionList', description: 'Lista de definiciones', shortcut: 'Termino\n: Definicion', compact: false },
    ],
  },
  {
    id: 'bloques',
    title: 'Bloques',
    items: [
      { action: 'quote', description: 'Bloque de cita', shortcut: '> cita', compact: true },
      { action: 'codeBlock', description: 'Bloque de codigo', shortcut: '```md', compact: true },
      { action: 'mathBlock', description: 'Bloque matematico', shortcut: '$$ formula $$', compact: false },
      { action: 'admonition', description: 'Nota destacada', shortcut: '> [!NOTE]', compact: true },
      { action: 'details', description: 'Contenido desplegable', shortcut: '<details>', compact: true },
      { action: 'horizontalRule', description: 'Separador', shortcut: '---', compact: false },
    ],
  },
  {
    id: 'insertar',
    title: 'Insertar',
    items: [
      { action: 'link', description: 'Enlace', shortcut: '[texto](url)', compact: true },
      { action: 'linkReference', description: 'Enlace por referencia', shortcut: '[texto][ref]', compact: false },
      { action: 'image', description: 'Imagen', shortcut: '![alt](url)', compact: true },
      { action: 'video', description: 'Video HTML5', shortcut: '<video controls>', compact: false },
      { action: 'table', description: 'Tabla', shortcut: '| col | col |', compact: true },
      { action: 'footnote', description: 'Nota al pie', shortcut: 'texto[^1]', compact: false },
    ],
  },
  {
    id: 'avanzado',
    title: 'Avanzado',
    items: [
      { action: 'toc', description: 'Tabla de contenido', shortcut: '[TOC]', compact: true },
      { action: 'frontMatter', description: 'Front Matter YAML', shortcut: '--- metadata ---', compact: false },
      { action: 'pageBreak', description: 'Salto de pagina', shortcut: '<div page-break>', compact: false },
      { action: 'emoji', description: 'Emoji', shortcut: ':sparkles:', compact: true },
      { action: 'htmlComment', description: 'Comentario HTML', shortcut: '<!-- comentario -->', compact: false },
      { action: 'mermaid', description: 'Diagrama Mermaid', shortcut: '```mermaid', compact: true },
    ],
  },
];

const CATEGORY_LABEL: Record<PedagogicalWarning['category'], string> = {
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
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);
  const [formatDensity, setFormatDensity] = useState<FormatDensity>(() => {
    if (typeof window === 'undefined') {
      return 'complete';
    }

    const storedDensity = readStoredFormatDensity();
    if (storedDensity) {
      return storedDensity;
    }

    return window.innerWidth < 1280 ? 'compact' : 'complete';
  });

  const screenWidth = typeof window !== 'undefined' ? window.innerWidth : 1000;
  const screenHeight = typeof window !== 'undefined' ? window.innerHeight : 800;
  const estimatedWidth = type === 'pedagogy' ? 292 : Math.min(680, screenWidth - 24);
  const estimatedHeight = type === 'pedagogy' ? 250 : 520;
  const halfWidth = estimatedWidth / 2;

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

  const placeAbove = useMemo(
    () => y + estimatedHeight > screenHeight - 16,
    [estimatedHeight, screenHeight, y]
  );

  const clampedY = useMemo(() => {
    const top = placeAbove ? y - estimatedHeight - 12 : y + 12;
    return Math.max(16, Math.min(screenHeight - estimatedHeight - 16, top));
  }, [estimatedHeight, placeAbove, screenHeight, y]);

  const arrowOffset = x - clampedX;
  const isFormatPanelExpanded = type === 'format' && openGroupId !== null;
  const activeGroup = useMemo(
    () => FORMAT_GROUPS.find((group) => group.id === openGroupId) ?? FORMAT_GROUPS[0],
    [openGroupId]
  );
  const visibleItems = useMemo(() => {
    if (formatDensity === 'complete') {
      return activeGroup.items;
    }

    const compactItems = activeGroup.items.filter((item) => item.compact);
    return compactItems.length > 0 ? compactItems : activeGroup.items;
  }, [activeGroup.items, formatDensity]);
  const hiddenItemsCount = activeGroup.items.length - visibleItems.length;

  useEffect(() => {
    persistFormatDensity(formatDensity);
  }, [formatDensity]);

  useEffect(() => {
    if (!visible) {
      setOpenGroupId(null);
      return;
    }

    if (type === 'format') {
      return;
    }

    if (type === 'pedagogy') {
      const focusable = containerRef.current?.querySelector<HTMLElement>('[data-tooltip-focus]');
      focusable?.focus();
      return;
    }
  }, [type, visible]);

  useEffect(() => {
    if (!visible) {
      return;
    }

    const handlePointerDownOutside = (event: MouseEvent) => {
      if (containerRef.current?.contains(event.target as Node)) {
        return;
      }

      onClose();
    };

    document.addEventListener('mousedown', handlePointerDownOutside);
    return () => {
      document.removeEventListener('mousedown', handlePointerDownOutside);
    };
  }, [onClose, visible]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (type === 'format' && visible) {
      const triggerButtons = Array.from(
        containerRef.current?.querySelectorAll<HTMLElement>('[data-format-trigger]') ?? []
      );
      const menuItems = Array.from(containerRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
      const activeElement = document.activeElement as HTMLElement | null;
      const activeTriggerIndex = triggerButtons.findIndex((button) => button === activeElement);
      const activeMenuIndex = menuItems.findIndex((item) => item === activeElement);
      const focusTrigger = (index: number) => {
        const nextIndex = (index + triggerButtons.length) % triggerButtons.length;
        const nextTrigger = triggerButtons[nextIndex];
        const nextGroupId = FORMAT_GROUPS[nextIndex]?.id;

        if (!nextTrigger || !nextGroupId) {
          return;
        }

        setOpenGroupId(nextGroupId);
        nextTrigger.focus();
      };
      const focusMenuItem = (index: number) => {
        if (menuItems.length === 0) {
          return;
        }

        const nextIndex = (index + menuItems.length) % menuItems.length;
        menuItems[nextIndex]?.focus();
      };
      const focusFirstItemOfGroup = (groupIndex: number) => {
        const nextGroupId = FORMAT_GROUPS[groupIndex]?.id;
        if (!nextGroupId) {
          return;
        }

        setOpenGroupId(nextGroupId);
        requestAnimationFrame(() => {
          const nextMenuItems = Array.from(
            containerRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []
          );
          nextMenuItems[0]?.focus();
        });
      };

      if (triggerButtons.length > 0 && activeTriggerIndex !== -1) {
        if (event.key === 'ArrowRight') {
          event.preventDefault();
          focusTrigger(activeTriggerIndex + 1);
          return;
        }

        if (event.key === 'ArrowLeft') {
          event.preventDefault();
          focusTrigger(activeTriggerIndex - 1);
          return;
        }

        if (event.key === 'Home') {
          event.preventDefault();
          focusTrigger(0);
          return;
        }

        if (event.key === 'End') {
          event.preventDefault();
          focusTrigger(triggerButtons.length - 1);
          return;
        }

        if (event.key === 'ArrowDown') {
          event.preventDefault();
          focusFirstItemOfGroup(activeTriggerIndex);
          return;
        }
      }

      if (menuItems.length > 0 && activeMenuIndex !== -1) {
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          focusMenuItem(activeMenuIndex + 1);
          return;
        }

        if (event.key === 'ArrowUp') {
          event.preventDefault();
          if (activeMenuIndex === 0) {
            const activeGroupIndex = FORMAT_GROUPS.findIndex((group) => group.id === openGroupId);
            if (activeGroupIndex !== -1) {
              triggerButtons[activeGroupIndex]?.focus();
            }
            return;
          }
          focusMenuItem(activeMenuIndex - 1);
          return;
        }

        if (event.key === 'Home') {
          event.preventDefault();
          focusMenuItem(0);
          return;
        }

        if (event.key === 'End') {
          event.preventDefault();
          focusMenuItem(menuItems.length - 1);
          return;
        }

        if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
          const activeGroupIndex = FORMAT_GROUPS.findIndex((group) => group.id === openGroupId);
          if (activeGroupIndex !== -1) {
            event.preventDefault();
            const nextIndex = event.key === 'ArrowRight' ? activeGroupIndex + 1 : activeGroupIndex - 1;
            focusFirstItemOfGroup((nextIndex + FORMAT_GROUPS.length) % FORMAT_GROUPS.length);
            return;
          }
        }
      }
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      if (type === 'format' && openGroupId) {
        setOpenGroupId(null);
        return;
      }
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

  if (!visible) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      id={type === 'pedagogy' ? tooltipId ?? undefined : undefined}
      role={type === 'pedagogy' ? 'tooltip' : undefined}
      onKeyDown={handleKeyDown}
      onMouseDown={(event) => {
        if (type === 'format') {
          event.preventDefault();
        }
      }}
      className={[
        'fixed z-50 flex flex-col gap-2 px-5 py-4',
        'bg-white/72 dark:bg-[#141821]/72',
        'backdrop-blur-xl saturate-150',
        'border border-white/70 dark:border-white/12',
        'ring-1 ring-slate-200/60 dark:ring-white/6',
        'shadow-[0_18px_48px_0_rgba(15,23,42,0.18)] dark:shadow-[0_18px_48px_0_rgba(0,0,0,0.5)]',
        'rounded-2xl transition-all duration-200 ease-out pointer-events-auto opacity-100 scale-100',
      ].join(' ')}
      style={{
        top: clampedY,
        left: clampedX,
        transform: 'translateX(-50%)',
        width: type === 'format' ? (isFormatPanelExpanded ? 'min(520px, calc(100vw - 24px))' : 'min(460px, calc(100vw - 24px))') : undefined,
        maxHeight: isFormatPanelExpanded ? 'min(78vh, 620px)' : undefined,
        overflowY: isFormatPanelExpanded ? 'auto' : undefined,
      }}
    >
      {type === 'format' && (
        <div className="w-full">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="text-[11px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-300">
              Formato Markdown
            </div>
            <div className="flex items-center gap-2">
              <div className="inline-flex rounded-lg border border-slate-200/80 bg-white/70 p-1 dark:border-slate-700/70 dark:bg-black/20">
                <button
                  type="button"
                  onClick={() => setFormatDensity('compact')}
                  className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                    formatDensity === 'compact'
                      ? 'bg-indigo-500/20 text-indigo-700 dark:bg-indigo-500/30 dark:text-indigo-100'
                      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10'
                  }`}
                  aria-pressed={formatDensity === 'compact'}
                >
                  Compacto
                </button>
                <button
                  type="button"
                  onClick={() => setFormatDensity('complete')}
                  className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                    formatDensity === 'complete'
                      ? 'bg-indigo-500/20 text-indigo-700 dark:bg-indigo-500/30 dark:text-indigo-100'
                      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10'
                  }`}
                  aria-pressed={formatDensity === 'complete'}
                >
                  Completo
                </button>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="rounded-md px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10"
                aria-label="Cerrar menu de formato"
              >
                Cerrar
              </button>
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 pr-1 [scrollbar-width:thin]">
            {FORMAT_GROUPS.map((group) => {
              const isOpen = openGroupId === group.id;
              const menuId = `format-group-${group.id}`;

              return (
                <button
                  key={group.id}
                  type="button"
                  id={triggerIdFor(group.id)}
                  data-format-trigger
                  onClick={() => setOpenGroupId((prev) => (prev === group.id ? null : group.id))}
                  className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors border ${
                    isOpen
                      ? 'bg-indigo-500/20 border-indigo-400/60 text-indigo-800 dark:bg-indigo-500/30 dark:text-indigo-100 dark:border-indigo-400/40'
                      : 'bg-white/70 border-slate-300/70 text-slate-700 hover:bg-slate-100 dark:bg-black/20 dark:border-slate-600/70 dark:text-slate-200 dark:hover:bg-black/30'
                  }`}
                  aria-label={group.title}
                  aria-haspopup="menu"
                  aria-expanded={isOpen}
                  aria-controls={isOpen ? menuId : undefined}
                >
                  {group.title}
                  <span className={`text-xs transition-transform ${isOpen ? 'rotate-180' : ''}`}>▾</span>
                </button>
              );
            })}
          </div>

          {!openGroupId && (
            <div className="mt-3 text-[11px] text-slate-500 dark:text-slate-300">
              Selecciona una categoria para aplicar formato sin abrir un panel grande por defecto.
            </div>
          )}

          {openGroupId && (
            <div
              className="mt-3 rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-white/85 dark:bg-[#11141a]/85 p-2 shadow-lg"
            >
              <div className="mb-2 flex items-center justify-between px-1 text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-300">
                <span>{activeGroup.title}</span>
                <div className="flex items-center gap-2">
                  <span>
                    {visibleItems.length} de {activeGroup.items.length} acciones
                  </span>
                  {hiddenItemsCount > 0 && formatDensity === 'compact' && (
                    <button
                      type="button"
                      onClick={() => setFormatDensity('complete')}
                      className="rounded-md px-2 py-1 text-[10px] font-semibold text-indigo-700 hover:bg-indigo-500/10 dark:text-indigo-200 dark:hover:bg-indigo-500/20"
                    >
                      Ver todas
                    </button>
                  )}
                </div>
              </div>
              <ul
                id={`format-group-${activeGroup.id}`}
                role="menu"
                aria-labelledby={triggerIdFor(activeGroup.id)}
                aria-label={`Acciones de ${activeGroup.title}`}
                aria-orientation="vertical"
                className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-[42vh] overflow-y-auto pr-1"
              >
                {visibleItems.map((item) => (
                  <li key={item.action} role="none">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        onFormatAction(item.action);
                        setOpenGroupId(null);
                      }}
                      className="w-full rounded-lg px-2.5 py-2 text-left hover:bg-indigo-500/10 dark:hover:bg-indigo-500/20 transition-colors"
                      aria-label={`Aplicar ${item.description}`}
                    >
                      <div className="text-sm font-medium text-slate-800 dark:text-slate-100">{item.description}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-300 mt-0.5">{item.shortcut}</div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-3 text-[11px] text-slate-500 dark:text-slate-300">
            Alterna entre una vista compacta para escribir mas rapido y una completa para acceso total a Markdown.
          </div>
        </div>
      )}

      {type === 'pedagogy' && warning && (
        <div className="flex max-w-[16.5rem] flex-col gap-3" aria-describedby={`warning-${warning.id}`}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-300">
                Qué conviene ajustar
              </div>
              <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-50">
                {warning.replacementConfig ? 'Puedes resolverlo ahora' : 'Revísalo antes de seguir'}
              </div>
            </div>
            <button
              type="button"
              data-tooltip-focus
              onClick={onClose}
              className="rounded-md px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10"
              aria-label="Cerrar tooltip"
              title="Cerrar"
            >
              Cerrar
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em]">
            <span className="rounded-full px-2.5 py-1 bg-slate-200/70 text-slate-700 dark:bg-slate-700/70 dark:text-slate-200">
              {CATEGORY_LABEL[warning.category]}
            </span>
            <span className={`rounded-full px-2.5 py-1 ${SEVERITY_BADGE_CLASS[warning.severity]}`}>{warning.severity}</span>
            <span className="rounded-full px-2.5 py-1 bg-indigo-500/10 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-200">
              {SOURCE_LABEL[warning.source ?? 'pedagogical']}
            </span>
          </div>

          <p id={`warning-${warning.id}`} className="text-sm leading-6 text-slate-700 dark:text-slate-200">
            {warning.message}
          </p>

          {warning.suggestion && (!warning.suggestions || warning.suggestions.length === 0) && (
            <div className="rounded-xl border border-indigo-200/70 bg-indigo-500/6 px-3 py-2 text-xs leading-5 text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-200">
              {warning.suggestion}
            </div>
          )}

          {warning.suggestions && warning.suggestions.length > 0 && (
            <div className="flex flex-wrap gap-2 text-[11px] text-slate-500 dark:text-slate-300">
              {warning.suggestions.slice(0, 3).map((suggestion) => (
                <span key={suggestion} className="rounded-full border border-slate-200/70 px-2 py-1 dark:border-slate-700/70">
                  {suggestion}
                </span>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            {warning.replacementConfig && (
              <button
                type="button"
                onClick={onFixAction}
                className="rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-indigo-500"
              >
                Aplicar corrección
              </button>
            )}

            <button
              type="button"
              onClick={() => onIgnoreWarning(warning.id)}
              className="rounded-xl border border-slate-200/80 bg-white/75 px-3 py-2 text-xs font-semibold text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-800 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-200 dark:hover:border-slate-600"
            >
              Ignorar esta alerta
            </button>
          </div>
        </div>
      )}

      {type === 'pedagogy' && (
        <div
          className={`absolute w-4 h-4 -translate-x-1/2 rotate-45 bg-white/85 dark:bg-[#1a1c23]/95 backdrop-blur-xl border-white/40 dark:border-white/10 -z-10 transition-all duration-200 ${
            placeAbove ? '-bottom-2 border-r border-b' : '-top-2 border-t border-l'
          }`}
          style={{ left: `calc(50% + ${arrowOffset}px)` }}
        />
      )}
    </div>
  );
};
