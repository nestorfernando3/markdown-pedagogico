import React, { useState, useRef, useEffect } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { save } from '@tauri-apps/api/dialog';
import { invoke } from '@tauri-apps/api/tauri';
import { TooltipContextual, type MarkdownAction } from './TooltipContextual';
import { PedagogicalOverlay } from './PedagogicalOverlay';
import { parseMarkdown, type PedagogicalWarning } from '../../utils/markdownParser';

const DRAFT_STORAGE_KEY = 'markdown-pedagogico:draft';

export const Editor: React.FC = () => {
    const [content, setContent] = useState('');
    const [htmlPreview, setHtmlPreview] = useState('');
    const [warnings, setWarnings] = useState<PedagogicalWarning[]>([]);
    const [editorScrollTop, setEditorScrollTop] = useState(0);
    const [isSaving, setIsSaving] = useState(false);
    const [isSaved, setIsSaved] = useState(false);
    const [isExportingPdf, setIsExportingPdf] = useState(false);
    const [isPdfExported, setIsPdfExported] = useState(false);
    const [isZenMode, setIsZenMode] = useState(false);
    const [showReferencePanel, setShowReferencePanel] = useState(false);
    const [referenceText, setReferenceText] = useState('');
    const [referenceImageDataUrl, setReferenceImageDataUrl] = useState<string | null>(null);

    // Tooltip UI state
    const [tooltipState, setTooltipState] = useState({
        visible: false,
        x: 0,
        y: 0,
        type: 'format' as 'format' | 'pedagogy',
        warning: null as PedagogicalWarning | null
    });

    const editorRef = useRef<HTMLTextAreaElement>(null);
    const previewContentRef = useRef<HTMLDivElement>(null);
    const referenceImageInputRef = useRef<HTMLInputElement>(null);
    const parseRequestIdRef = useRef(0);
    const saveFeedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const exportPdfFeedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        const savedDraft = window.localStorage.getItem(DRAFT_STORAGE_KEY);
        if (savedDraft !== null) {
            setContent(savedDraft);
        }
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => {
            window.localStorage.setItem(DRAFT_STORAGE_KEY, content);
        }, 180);
        return () => clearTimeout(timer);
    }, [content]);

    // AST Parsing on every keystroke (Efficient enough for real-time with plain text)
    useEffect(() => {
        const requestId = ++parseRequestIdRef.current;
        let cancelled = false;
        const debounceMs = 220;

        const updateAST = async () => {
            try {
                const { html, warnings: nextWarnings } = await parseMarkdown(content);
                if (cancelled || requestId !== parseRequestIdRef.current) return;

                setHtmlPreview(html);
                setWarnings(nextWarnings);

                // Cierra el tooltip pedagógico si su advertencia ya no existe tras el nuevo parse.
                setTooltipState((prev) => {
                    if (prev.type !== 'pedagogy' || !prev.warning) return prev;
                    const stillExists = nextWarnings.some((warning) => warning.id === prev.warning?.id);
                    return stillExists ? prev : { ...prev, visible: false, warning: null };
                });
            } catch (err) {
                if (!cancelled && requestId === parseRequestIdRef.current) {
                    console.error('Error parsing markdown:', err);
                }
            }
        };

        const timer = setTimeout(() => {
            updateAST();
        }, debounceMs);

        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [content]);

    useEffect(() => {
        return () => {
            if (saveFeedbackTimeoutRef.current) {
                clearTimeout(saveFeedbackTimeoutRef.current);
            }
            if (exportPdfFeedbackTimeoutRef.current) {
                clearTimeout(exportPdfFeedbackTimeoutRef.current);
            }
        };
    }, []);

    // Selección de texto estándar para formato
    const handleSelect = () => {
        if (!editorRef.current) return;
        const start = editorRef.current.selectionStart;
        const end = editorRef.current.selectionEnd;

        // Solo mostramos tooltip de formato si seleccionó algo de texto y no hay tooltip pedagógico abierto visible
        if (start !== end && !(tooltipState.visible && tooltipState.type === 'pedagogy')) {
            // Conseguimos la posición real del textarea para lanzar el tooltip genéricamente cerca del mouse
            // o en el centro superior si es solo teclado. Para simplificar, lo colocaremos en el centro superior
            // del editor.
            const rect = editorRef.current.getBoundingClientRect();
            setTooltipState({
                type: 'format',
                warning: null,
                visible: true,
                x: rect.left + (rect.width / 2),
                y: rect.top + 40, // Lo movemos más arriba para que sea muy visible
            });
        } else if (tooltipState.type === 'format' && start === end) {
            setTooltipState((prev) => ({ ...prev, visible: false }));
        }
    };

    // Aplica el formato Markdown estándar
    const handleFormatAction = (action: MarkdownAction) => {
        if (!editorRef.current) return;
        const start = editorRef.current.selectionStart;
        const end = editorRef.current.selectionEnd;
        const selectedText = content.substring(start, end);

        let replacement = '';
        switch (action) {
            case 'bold': replacement = `**${selectedText}**`; break;
            case 'italic': replacement = `*${selectedText}*`; break;
            case 'header': replacement = `\n# ${selectedText}\n`; break;
            case 'list': {
                const lines = selectedText
                    .split(/\r?\n/)
                    .map((line) => line.trim())
                    .filter((line) => line.length > 0);

                if (lines.length === 0) {
                    replacement = '\n- \n';
                } else {
                    const listItems = lines.map((line) => (
                        /^[-*+]\s+/.test(line) ? line : `- ${line}`
                    ));
                    replacement = `\n${listItems.join('\n')}\n`;
                }
                break;
            }
            default: replacement = selectedText;
        }

        const newContent = content.substring(0, start) + replacement + content.substring(end);
        setContent(newContent);
        setTooltipState(prev => ({ ...prev, visible: false }));
    };

    // Toggle over a AST Warning Marker
    const handleToggleWarning = (warning: PedagogicalWarning | null, markerRect?: DOMRect) => {
        if (warning && markerRect) {
            setTooltipState(prev => {
                if (prev.visible && prev.warning?.id === warning.id) {
                    return { ...prev, visible: false };
                }
                return {
                    type: 'pedagogy',
                    warning: warning,
                    visible: true,
                    x: markerRect.left + (markerRect.width / 2),
                    y: markerRect.bottom + 15, // exactly below the marker
                };
            });
        }
    };

    const handleApplyFix = (start: number, end: number, newText: string) => {
        const newContent = content.substring(0, start) + newText + content.substring(end);
        setContent(newContent);
    };

    const handleReferenceImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = () => {
            if (typeof reader.result === 'string') {
                setReferenceImageDataUrl(reader.result);
            }
        };
        reader.onerror = () => {
            console.error('Error al cargar imagen de referencia');
            alert('No se pudo cargar la imagen de referencia.');
        };
        reader.readAsDataURL(file);
        event.target.value = '';
    };

    const handleSaveFile = async () => {
        setIsSaving(true);
        setIsSaved(false);
        try {
            const filePath = await save({
                title: 'Guardar archivo Markdown',
                defaultPath: 'documento.md',
                filters: [
                    { name: 'Markdown', extensions: ['md'] },
                ],
            });

            if (!filePath) return;

            await invoke('export_document', {
                path: filePath,
                content,
            });

            setIsSaved(true);
            if (saveFeedbackTimeoutRef.current) {
                clearTimeout(saveFeedbackTimeoutRef.current);
            }
            saveFeedbackTimeoutRef.current = setTimeout(() => {
                setIsSaved(false);
            }, 3000);
        } catch (error) {
            console.error('Error al guardar archivo:', error);
            setIsSaved(false);
            alert('No se pudo guardar el archivo. Revisa la ruta e inténtalo de nuevo.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleExportPdf = async () => {
        setIsExportingPdf(true);
        setIsPdfExported(false);
        try {
            if (!previewContentRef.current) {
                throw new Error('No se encontró el contenedor de vista previa para exportar.');
            }

            const buildPdfBytes = async (): Promise<number[]> => {
                const pdf = new jsPDF({
                    orientation: 'portrait',
                    unit: 'pt',
                    format: 'a4',
                    compress: true,
                    putOnlyUsedFonts: true,
                });

                const exportRoot = document.createElement('div');
                exportRoot.style.position = 'fixed';
                exportRoot.style.left = '-10000px';
                exportRoot.style.top = '0';
                exportRoot.style.width = '794px';
                exportRoot.style.padding = '56px'; // Increased margin for better print look
                exportRoot.style.background = '#ffffff';
                exportRoot.style.color = '#0f172a';
                exportRoot.style.boxSizing = 'border-box';
                exportRoot.innerHTML = `
                    <article>${content === '' ? '<p>Sin contenido</p>' : htmlPreview}</article>
                `;

                const exportStyle = document.createElement('style');
                exportStyle.textContent = `
                    article { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.65; font-size: 16px; color: #0f172a; }
                    article h1 { font-size: 36px; line-height: 1.2; margin: 0 0 16px; font-weight: 700; }
                    article h2 { font-size: 28px; line-height: 1.25; margin: 28px 0 14px; font-weight: 700; }
                    article h3 { font-size: 22px; line-height: 1.3; margin: 24px 0 12px; font-weight: 600; }
                    article p { margin: 0 0 14px; }
                    article ul, article ol { margin: 0 0 14px 0; padding-left: 24px; }
                    article li { margin: 0 0 6px; }
                    article blockquote { margin: 0 0 14px; padding-left: 14px; border-left: 3px solid #94a3b8; color: #334155; }
                    article code { background: #f1f5f9; padding: 2px 5px; border-radius: 4px; font-family: Menlo, Monaco, Consolas, "Courier New", monospace; font-size: 14px; }
                    article pre { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; overflow: hidden; margin: 0 0 14px; }
                    article pre code { background: transparent; padding: 0; border-radius: 0; }
                    article a { color: #1d4ed8; text-decoration: underline; }
                `;
                exportRoot.prepend(exportStyle);

                document.body.appendChild(exportRoot);

                try {
                    // Esperar 1 frame para que el navegador aplique correctamente el CSS de Tailwind al nuevo nodo
                    await new Promise(resolve => setTimeout(resolve, 50));

                    const pageWidthPt = pdf.internal.pageSize.getWidth();
                    const pageHeightPt = pdf.internal.pageSize.getHeight();
                    const pageHeightPx = Math.floor(794 * (pageHeightPt / pageWidthPt));
                    const totalHeightPx = Math.max(exportRoot.scrollHeight, pageHeightPx);
                    const totalPages = Math.max(1, Math.ceil(totalHeightPx / pageHeightPx));

                    for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
                        const pageViewport = document.createElement('div');
                        pageViewport.style.position = 'fixed';
                        pageViewport.style.left = '-10000px';
                        pageViewport.style.top = '0';
                        pageViewport.style.width = '794px';
                        pageViewport.style.height = `${pageHeightPx}px`;
                        pageViewport.style.overflow = 'hidden';
                        pageViewport.style.background = '#ffffff';

                        const pageContent = exportRoot.cloneNode(true) as HTMLDivElement;
                        pageContent.style.position = 'relative';
                        pageContent.style.left = '0';
                        pageContent.style.top = `-${pageIndex * pageHeightPx}px`;

                        pageViewport.appendChild(pageContent);
                        document.body.appendChild(pageViewport);

                        try {
                            const canvas = await html2canvas(pageViewport, {
                                scale: 1.5, // Scale for better text crispness
                                useCORS: true,
                                backgroundColor: '#ffffff',
                                logging: false,
                                onclone: (clonedDocument) => {
                                    // html2canvas todavía no soporta oklch; removemos hojas globales
                                    // que incluyen Tailwind v4 para evitar fallos de parseo.
                                    const styleNodes = clonedDocument.querySelectorAll('style');
                                    styleNodes.forEach((node) => {
                                        if (node.textContent?.includes('oklch(')) {
                                            node.remove();
                                        }
                                    });
                                    clonedDocument
                                        .querySelectorAll('link[rel="stylesheet"]')
                                        .forEach((node) => node.remove());
                                },
                            });

                            const imageData = canvas.toDataURL('image/jpeg', 0.9);
                            if (pageIndex > 0) {
                                pdf.addPage();
                            }
                            pdf.addImage(imageData, 'JPEG', 0, 0, pageWidthPt, pageHeightPt, undefined, 'FAST');
                        } finally {
                            document.body.removeChild(pageViewport);
                        }
                    }

                    return Array.from(new Uint8Array(pdf.output('arraybuffer')));
                } finally {
                    document.body.removeChild(exportRoot);
                }
            };

            const pdfBytes = await buildPdfBytes();

            const filePath = await save({
                title: 'Exportar a PDF',
                defaultPath: 'documento.pdf',
                filters: [
                    { name: 'PDF', extensions: ['pdf'] },
                ],
            });

            if (!filePath) return;

            await invoke('export_pdf_bytes', {
                path: filePath,
                pdfBytes,
            });

            setIsPdfExported(true);
            if (exportPdfFeedbackTimeoutRef.current) {
                clearTimeout(exportPdfFeedbackTimeoutRef.current);
            }
            exportPdfFeedbackTimeoutRef.current = setTimeout(() => {
                setIsPdfExported(false);
            }, 3000);
        } catch (error) {
            console.error('Error al exportar PDF:', error);
            setIsPdfExported(false);
            alert('No se pudo exportar a PDF. Intenta nuevamente con otra ruta o contenido.');
        } finally {
            setIsExportingPdf(false);
        }
    };

    return (
        <div className="flex flex-col h-full min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-500 font-sans">
            <header
                className={`fixed top-0 w-full z-40 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md border-b border-slate-200/50 dark:border-slate-800/50 p-4 flex justify-between items-center transition-opacity duration-300 ${isZenMode ? 'opacity-10 hover:opacity-100' : 'opacity-100'
                    }`}
            >
                <h1 className="text-xl font-medium text-slate-800 dark:text-slate-200 tracking-tight">
                    Markdown Pedagógico
                </h1>
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleSaveFile}
                        disabled={isSaving}
                        className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${isSaved
                                ? 'border border-emerald-600/60 bg-emerald-500/20 text-emerald-700 dark:bg-emerald-500/30 dark:text-emerald-200'
                                : 'bg-indigo-500/20 text-indigo-700 hover:bg-indigo-500/30 dark:bg-indigo-500/30 dark:text-indigo-200'
                            } ${isSaving ? 'cursor-not-allowed opacity-70' : ''}`}
                    >
                        {isSaving ? 'Guardando...' : isSaved ? '¡Archivo guardado!' : 'Guardar .md'}
                    </button>
                    <button
                        onClick={handleExportPdf}
                        disabled={isExportingPdf}
                        className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${isPdfExported
                                ? 'border border-emerald-600/60 bg-emerald-500/20 text-emerald-700 dark:bg-emerald-500/30 dark:text-emerald-200'
                                : 'bg-indigo-500/20 text-indigo-700 hover:bg-indigo-500/30 dark:bg-indigo-500/30 dark:text-indigo-200'
                            } ${isExportingPdf ? 'cursor-not-allowed opacity-70' : ''}`}
                    >
                        {isExportingPdf ? 'Exportando...' : isPdfExported ? '¡PDF generado!' : 'Exportar a PDF'}
                    </button>
                    <button
                        onClick={() => setIsZenMode((prev) => !prev)}
                        className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${isZenMode
                                ? 'border border-slate-500/40 bg-slate-900/10 text-slate-900 dark:bg-slate-100/10 dark:text-slate-100'
                                : 'bg-white/40 text-slate-700 hover:bg-white/60 dark:bg-black/20 dark:text-slate-200 dark:hover:bg-black/30'
                            }`}
                    >
                        {isZenMode ? 'Salir Zen' : 'Modo Zen'}
                    </button>
                    <button
                        onClick={() => setShowReferencePanel((prev) => !prev)}
                        className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${showReferencePanel
                                ? 'border border-indigo-500/40 bg-indigo-500/20 text-indigo-700 dark:bg-indigo-500/30 dark:text-indigo-200'
                                : 'bg-white/40 text-slate-700 hover:bg-white/60 dark:bg-black/20 dark:text-slate-200 dark:hover:bg-black/30'
                            }`}
                    >
                        {showReferencePanel ? 'Ocultar Referencia' : 'Mostrar Referencia'}
                    </button>
                    <div className="text-sm text-slate-500">
                        Problemas detectados: {warnings.length}
                    </div>
                </div>
            </header>

            <main
                className={`flex-1 grid pt-24 pb-12 px-8 gap-8 max-w-screen-2xl mx-auto w-full ${showReferencePanel ? 'grid-cols-1 xl:grid-cols-[minmax(300px,1fr)_2fr]' : 'grid-cols-1'
                    }`}
            >

                {showReferencePanel && (
                    <aside className="bg-white/50 dark:bg-[#1a1c23]/40 rounded-3xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.04)] border border-white/60 dark:border-white/5 backdrop-blur-xl flex flex-col gap-4 min-h-[70vh]">
                        <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Panel de Referencia</label>
                        <textarea
                            value={referenceText}
                            onChange={(event) => setReferenceText(event.target.value)}
                            className="w-full min-h-56 bg-white/40 dark:bg-black/20 rounded-2xl border border-slate-200/50 dark:border-slate-700/50 p-4 resize-y outline-none focus:border-indigo-500/50 text-sm text-slate-700 dark:text-slate-200"
                            placeholder="Pega aquí un texto de referencia para compararlo mientras escribes..."
                        />
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => referenceImageInputRef.current?.click()}
                                className="rounded-lg px-3 py-1.5 text-sm font-medium bg-indigo-500/20 text-indigo-700 hover:bg-indigo-500/30 transition-colors dark:bg-indigo-500/30 dark:text-indigo-200"
                            >
                                Cargar imagen
                            </button>
                            <button
                                onClick={() => setReferenceImageDataUrl(null)}
                                className="rounded-lg px-3 py-1.5 text-sm font-medium bg-white/50 text-slate-700 hover:bg-white/70 transition-colors dark:bg-black/20 dark:text-slate-200 dark:hover:bg-black/30"
                            >
                                Limpiar imagen
                            </button>
                        </div>
                        <input
                            ref={referenceImageInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleReferenceImageChange}
                        />

                        {referenceImageDataUrl ? (
                            <img
                                src={referenceImageDataUrl}
                                alt="Referencia"
                                className="w-full rounded-2xl border border-slate-200/50 dark:border-slate-700/50 object-contain max-h-[360px] bg-white/30 dark:bg-black/20"
                            />
                        ) : (
                            <div className="rounded-2xl border border-dashed border-slate-300/70 dark:border-slate-700/60 p-6 text-sm text-slate-500 text-center">
                                Puedes cargar una imagen local para usarla como referencia visual.
                            </div>
                        )}
                    </aside>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                    {/* Zona de Edición en Texto Plano + AST Overlays */}
                    <section className="relative flex flex-col group">
                        <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">Escritura (Markdown)</label>

                        <div className="relative flex-1 bg-white/50 dark:bg-[#1a1c23]/40 rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.04)] backdrop-blur-xl border border-white/60 dark:border-white/5 focus-within:ring-2 focus-within:ring-indigo-500/30 transition-all group-hover:shadow-[0_8px_32px_rgba(0,0,0,0.08)] z-10">
                            {/* Textarea puro */}
                            <textarea
                                ref={editorRef}
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                onScroll={(e) => setEditorScrollTop(e.currentTarget.scrollTop)}
                                onSelect={handleSelect}
                                onClick={() => {
                                    if (tooltipState.visible && editorRef.current?.selectionStart === editorRef.current?.selectionEnd) {
                                        setTooltipState(prev => ({ ...prev, visible: false }));
                                    }
                                }}
                                className="absolute inset-0 w-full h-full bg-transparent resize-none outline-none text-lg text-slate-800 dark:text-slate-200 font-mono leading-relaxed p-8 rounded-3xl dark:caret-indigo-400 caret-indigo-600 z-10"
                                placeholder="Escribe tu idea aquí usando Markdown..."
                                spellCheck="false"
                            />

                            {/* Capa SUPERIOR de advertencias (pointer-events-none, pero sus hijos tendrán pointer-events-auto) */}
                            <PedagogicalOverlay
                                warnings={warnings}
                                onToggleWarning={handleToggleWarning}
                                isZenMode={isZenMode}
                                scrollTop={editorScrollTop}
                            />
                        </div>

                        <TooltipContextual
                            x={tooltipState.x}
                            y={tooltipState.y}
                            visible={tooltipState.visible}
                            type={tooltipState.type}
                            warning={tooltipState.warning}
                            onFormatAction={handleFormatAction}
                            onFixAction={() => {
                                if (tooltipState.warning?.replacementConfig) {
                                    handleApplyFix(
                                        tooltipState.warning.replacementConfig.startOffset,
                                        tooltipState.warning.replacementConfig.endOffset,
                                        tooltipState.warning.replacementConfig.newText
                                    );
                                    setTooltipState(prev => ({ ...prev, visible: false }));
                                }
                            }}
                        />
                    </section>

                    {/* Zona de Renderizado en Vivo HTML usando el AST */}
                    <section className="flex flex-col">
                        <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">Vista Previa Real</label>
                        <div className="flex-1 bg-white/50 dark:bg-black/10 rounded-3xl p-8 shadow-[0_4px_30px_rgba(0,0,0,0.02)] border border-slate-100 dark:border-slate-800/50 overflow-auto prose prose-slate dark:prose-invert prose-lg max-w-none backdrop-blur-sm transition-all selection:bg-indigo-100 dark:selection:bg-indigo-900">
                            <div ref={previewContentRef}>
                                {content === '' ? (
                                    <p className="text-slate-400 italic font-light">Comienza a escribir a la izquierda y el documento se renderizará automáticamente.</p>
                                ) : (
                                    <div dangerouslySetInnerHTML={{ __html: htmlPreview }} />
                                )}
                            </div>
                        </div>
                    </section>
                </div>
            </main>
        </div>
    );
};
