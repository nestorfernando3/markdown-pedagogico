import React from 'react';
import type { PedagogicalWarning } from '../../utils/markdownParser';

export type MarkdownAction = 'bold' | 'italic' | 'header' | 'list';

interface TooltipContextualProps {
    x: number;
    y: number;
    visible: boolean;
    type: 'format' | 'pedagogy';
    warning: PedagogicalWarning | null;
    onFormatAction: (action: MarkdownAction) => void;
    onFixAction: () => void;
}

interface FormatButtonProps {
    action: MarkdownAction;
    onAction: (action: MarkdownAction) => void;
    label: string;
    shortcut: string;
    description: string;
}

/**
 * Tooltip contextual adaptable.
 * Si type === 'format', muestra botones de negrita/cursiva (como originalmente).
 * Si type === 'pedagogy', muestra el mensaje de error del AST y cómo arreglarlo.
 */
export const TooltipContextual: React.FC<TooltipContextualProps> = ({
    x, y, visible, type, warning, onFormatAction, onFixAction
}) => {
    // Permitimos renderizar para que las animaciones de CSS entren y salgan suavemente
    // en lugar de desmontar el componente bruscamente.

    // Evitar que el tooltip se salga de la pantalla (especialmente en los bordes izquierdos como el Gutter)
    const screenWidth = typeof window !== 'undefined' ? window.innerWidth : 1000;
    const estimatedWidth = type === 'pedagogy' ? 280 : 250;
    const halfWidth = estimatedWidth / 2;

    let clampedX = x;
    if (x - halfWidth < 16) clampedX = halfWidth + 16;
    if (x + halfWidth > screenWidth - 16) clampedX = screenWidth - halfWidth - 16;

    // Desplazar la flecha de cristal para que siga apuntando al sitio original aunque la caja cambie de centro
    const arrowOffset = x - clampedX;

    return (
        <div
            className={`
        fixed z-50 flex flex-col gap-2 px-5 py-4 
        bg-white/70 dark:bg-[#1a1c23]/80 
        backdrop-blur-2xl saturate-150
        border border-white/80 dark:border-white/10
        shadow-[0_8px_32px_0_rgba(99,102,241,0.15)] dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.5)]
        rounded-2xl transition-all duration-300 ease-out pointer-events-auto
        ${visible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-95 pointer-events-none'}
      `}
            style={{ top: y, left: clampedX, transform: 'translateX(-50%)' }}
        >

            {/* Modo de Formato Estándar */}
            {type === 'format' && (
                <div className="flex items-center gap-1.5">
                    <FormatButton action="bold" onAction={onFormatAction} label="B" shortcut="**texto**" description="Negrita" />
                    <FormatButton action="italic" onAction={onFormatAction} label="I" shortcut="*texto*" description="Cursiva" />
                    <div className="w-px h-8 bg-slate-300/50 dark:bg-slate-700/50 mx-1"></div>
                    <FormatButton action="header" onAction={onFormatAction} label="H" shortcut="# Título" description="Título" />
                    <FormatButton action="list" onAction={onFormatAction} label="≡" shortcut="- Item" description="Lista" />
                </div>
            )}

            {/* Modo Pedagógico */}
            {type === 'pedagogy' && warning && (
                <div className="flex flex-col gap-2 max-w-64">
                    <div className="text-sm font-medium text-slate-800 dark:text-slate-200">
                        💡 Oportunidad de Mejora
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                        {warning.message}
                    </p>
                    {warning.replacementConfig && (
                        <button
                            onClick={onFixAction}
                            className="mt-1 flex items-center justify-center py-1.5 px-3 bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 dark:bg-indigo-500/30 hover:bg-indigo-500/30 transition-colors rounded-lg text-xs font-semibold backdrop-blur-sm"
                        >
                            Aplicar: "{warning.suggestion}"
                        </button>
                    )}
                </div>
            )}

            {/* Triángulo/Flecha estilo Glassmorphism apuntando al texto */}
            <div
                className="absolute -top-2 w-4 h-4 -translate-x-1/2 rotate-45 bg-white/60 dark:bg-[#1a1c23]/80 backdrop-blur-xl border-t border-l border-white/40 dark:border-white/10 -z-10 transition-all duration-200"
                style={{ left: `calc(50% + ${arrowOffset}px)` }}
            ></div>
        </div>
    );
};

const FormatButton: React.FC<FormatButtonProps> = ({ action, onAction, label, shortcut, description }) => {
    const [isHovered, setIsHovered] = React.useState(false);
    return (
        <button
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onClick={() => onAction(action)}
            className="flex flex-col items-center justify-center p-2 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors relative min-w-[3.5rem]"
        >
            <span className={`text-lg mb-0.5 ${action === 'bold' || action === 'header' ? 'font-bold' : action === 'italic' ? 'italic font-serif' : ''}`}>{label}</span>
            <span className="text-[10px] uppercase font-semibold opacity-60 tracking-wider">{description}</span>

            <div className={`
                absolute -top-12 transition-all duration-200 z-50
                ${isHovered ? 'opacity-100 visible translate-y-0' : 'opacity-0 invisible translate-y-2'}
                bg-slate-800 dark:bg-slate-100 dark:text-slate-900 text-white text-xs py-1.5 px-3 rounded-lg whitespace-nowrap pointer-events-none shadow-xl border border-slate-700 dark:border-slate-200 font-medium
            `}>
                Usa {shortcut}
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-800 dark:bg-slate-100 rotate-45 border-b border-r border-slate-700 dark:border-slate-200"></div>
            </div>
        </button>
    );
};
