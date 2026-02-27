import React from 'react';
import type { PedagogicalWarning } from '../../utils/markdownParser';

interface PedagogicalOverlayProps {
    warnings: PedagogicalWarning[];
    onToggleWarning: (warning: PedagogicalWarning | null, rect?: DOMRect) => void;
    isZenMode: boolean;
    scrollTop: number;
}

/**
 * PedagogicalOverlay se posiciona *exactamente* encima/debajo del textarea.
 * Dibuja los resaltados translúcidos (Soft Highlight) y los indicadores de margen (Gutter).
 */
export const PedagogicalOverlay: React.FC<PedagogicalOverlayProps> = ({
    warnings,
    onToggleWarning,
    isZenMode,
    scrollTop
}) => {
    const LINE_HEIGHT_PX = 28;
    const uniqueLineWarnings = React.useMemo(() => {
        const warningByLine = new Map<number, PedagogicalWarning>();
        for (const warning of warnings) {
            const line = Math.max(1, warning.line);
            if (!warningByLine.has(line)) {
                warningByLine.set(line, warning);
            }
        }
        return Array.from(warningByLine.values()).slice(0, 160);
    }, [warnings]);

    return (
        <div className="absolute inset-0 pointer-events-none p-8 font-mono text-lg leading-relaxed z-20 overflow-hidden">
            <div
                className="relative w-full h-full"
                style={{ transform: `translateY(-${scrollTop}px)` }}
            >
                {uniqueLineWarnings.map((warning) => {
                    const top = (Math.max(1, warning.line) - 1) * LINE_HEIGHT_PX;
                    return (
                        <div
                            key={warning.id}
                            className="absolute left-0 right-0"
                            style={{ top }}
                        >
                            <div className="h-7 bg-blue-500/10 dark:bg-amber-500/10 rounded-md border-b-2 border-transparent transition-colors pointer-events-none" />

                            <button
                                type="button"
                                className={`absolute -left-5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white/70 dark:bg-[#1a1c23]/90 border border-indigo-400/80 dark:border-amber-400/80 backdrop-blur-md shadow-[0_2px_15px_rgba(99,102,241,0.5)] flex items-center justify-center pointer-events-auto group cursor-pointer transition-all hover:scale-125 ${
                                    isZenMode ? 'opacity-0 hover:opacity-100' : ''
                                }`}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onToggleWarning(warning, e.currentTarget.getBoundingClientRect());
                                }}
                            >
                                <div className="w-2 h-2 bg-indigo-500 dark:bg-amber-500 rounded-full group-hover:bg-indigo-600 transition-colors" />
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
