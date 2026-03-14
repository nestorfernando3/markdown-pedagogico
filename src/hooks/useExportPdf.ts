import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { useCallback, useEffect, useRef, useState } from 'react';
import { KATEX_INLINE_STYLES } from '../utils/katexInlineStyles';
import { renderMarkdownHtml } from '../utils/markdownParser';
import { renderMermaidDiagrams } from '../utils/mermaidRenderer';
import { isTauriRuntime, saveBinaryFileInBrowser } from '../utils/runtime';

export interface UseExportPdfResult {
  exportPdf: (markdownSource: string, fallbackText: string) => Promise<void>;
  isExporting: boolean;
  lastExportStatus: 'idle' | 'success' | 'error';
}

interface PreparedExportRoot {
  article: HTMLElement;
  exportRoot: HTMLDivElement;
  exportStyle: HTMLStyleElement;
}

const EXPORT_ARTICLE_CSS = `
  article {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    line-height: 1.65;
    font-size: 16px;
    color: #0f172a;
    overflow-wrap: break-word;
    word-break: normal;
  }
  article h1 { font-size: 36px; line-height: 1.2; margin: 0 0 16px; font-weight: 700; }
  article h2 { font-size: 28px; line-height: 1.25; margin: 28px 0 14px; font-weight: 700; }
  article h3 { font-size: 22px; line-height: 1.3; margin: 24px 0 12px; font-weight: 600; }
  article h4 { font-size: 18px; line-height: 1.35; margin: 20px 0 10px; font-weight: 600; }
  article p { margin: 0 0 14px; }
  article ul, article ol { margin: 0 0 14px; padding-left: 24px; }
  article li { margin: 0 0 6px; }
  article blockquote { margin: 0 0 14px; padding-left: 14px; border-left: 3px solid #94a3b8; color: #334155; }
  article code { background: #f1f5f9; padding: 2px 5px; border-radius: 4px; font-family: Menlo, Monaco, Consolas, "Courier New", monospace; font-size: 14px; }
  article pre { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; overflow: hidden; margin: 0 0 14px; }
  article pre code { background: transparent; padding: 0; border-radius: 0; }
  article pre.shiki, article pre[data-code-block="true"] { position: relative; padding-top: 36px; box-shadow: 0 14px 28px rgba(15, 23, 42, 0.08); }
  article pre.shiki::before, article pre[data-code-block="true"]::before {
    content: attr(data-language);
    position: absolute;
    top: 10px;
    left: 12px;
    padding: 2px 8px;
    border-radius: 999px;
    background: rgba(226, 232, 240, 0.95);
    color: #334155;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  article pre.shiki code, article pre[data-code-block="true"] code { display: grid; min-width: fit-content; }
  article a { color: #1d4ed8; text-decoration: underline; }
  article table { width: 100%; border-collapse: collapse; margin: 0 0 16px; font-size: 14px; }
  article th, article td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: left; vertical-align: top; }
  article th { background: #f8fafc; font-weight: 600; }
  article input[type="checkbox"] { margin-right: 8px; }
  article mark { background: rgba(254, 240, 138, 0.78); border-radius: 4px; padding: 1px 4px; }
  article kbd {
    display: inline-block;
    padding: 2px 7px;
    border: 1px solid #cbd5e1;
    border-radius: 7px;
    background: #ffffff;
    box-shadow: inset 0 -1px 0 rgba(148, 163, 184, 0.35);
    font-family: Menlo, Monaco, Consolas, "Courier New", monospace;
    font-size: 13px;
  }
  article sup, article sub { font-size: 11px; }
  article dl { margin: 0 0 14px; }
  article dt { font-weight: 700; margin: 12px 0 2px; }
  article dd { margin: 0 0 8px 18px; padding-left: 10px; border-left: 2px solid #c7d2fe; }
  article details { margin: 0 0 14px; padding: 12px 14px; border: 1px solid #cbd5e1; border-radius: 10px; background: rgba(248, 250, 252, 0.9); }
  article summary { font-weight: 600; }
  article .markdown-alert { margin: 0 0 16px; padding: 14px 16px; border-left: 4px solid #6366f1; border-radius: 12px; background: rgba(238, 242, 255, 0.82); }
  article .markdown-alert-title { margin: 0 0 6px; font-size: 12px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; }
  article .markdown-alert-tip { border-left-color: #0ea5e9; background: rgba(224, 242, 254, 0.9); }
  article .markdown-alert-important { border-left-color: #a855f7; background: rgba(243, 232, 255, 0.9); }
  article .markdown-alert-warning, article .markdown-alert-caution { border-left-color: #f59e0b; background: rgba(254, 243, 199, 0.92); }
  article .mermaid { display: flex; justify-content: center; margin: 18px 0; overflow: hidden; }
  article .mermaid svg { max-width: 100%; height: auto; }
  article .katex-display { overflow-x: auto; overflow-y: hidden; padding: 6px 0; }
  article .footnotes { margin-top: 24px; padding-top: 12px; border-top: 1px solid #cbd5e1; font-size: 13px; }
  article .footnotes ol { padding-left: 20px; }
  article img, article video, article svg { max-width: 100%; }
  ${KATEX_INLINE_STYLES}
`;

const EXPORT_PRINT_CSS = `
  @page {
    size: A4;
    margin: 16mm 16mm 18mm;
  }

  html {
    background: #ffffff;
  }

  body {
    margin: 0;
    padding: 0;
    background: #ffffff;
    color: #0f172a;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  main {
    box-sizing: border-box;
  }

  article h1,
  article h2,
  article h3,
  article h4,
  article h5,
  article h6 {
    break-after: avoid-page;
    page-break-after: avoid;
  }

  article pre,
  article blockquote,
  article table,
  article details,
  article .markdown-alert,
  article .mermaid,
  article img,
  article svg {
    break-inside: avoid-page;
    page-break-inside: avoid;
  }

  ${EXPORT_ARTICLE_CSS}
`;

function numericStyleValue(styles: CSSStyleDeclaration, property: string): number {
  return Number.parseFloat(styles.getPropertyValue(property)) || 0;
}

function blockOuterHeight(node: HTMLElement): number {
  const styles = window.getComputedStyle(node);
  const bounds = node.getBoundingClientRect();
  return bounds.height + numericStyleValue(styles, 'margin-top') + numericStyleValue(styles, 'margin-bottom');
}

function shouldKeepWithNext(node: HTMLElement): boolean {
  return /^H[1-6]$/u.test(node.tagName);
}

function createPageViewport(exportRoot: HTMLDivElement, exportStyle: HTMLStyleElement, pageHeightPx: number): {
  viewport: HTMLDivElement;
  article: HTMLElement;
} {
  const viewport = document.createElement('div');
  viewport.style.position = 'fixed';
  viewport.style.left = '-10000px';
  viewport.style.top = '0';
  viewport.style.width = '794px';
  viewport.style.height = `${pageHeightPx}px`;
  viewport.style.overflow = 'hidden';
  viewport.style.background = '#ffffff';

  const pageRoot = document.createElement('div');
  pageRoot.style.cssText = exportRoot.style.cssText;
  pageRoot.style.position = 'relative';
  pageRoot.style.left = '0';
  pageRoot.style.top = '0';
  pageRoot.style.minHeight = `${pageHeightPx}px`;
  pageRoot.style.width = '794px';

  pageRoot.appendChild(exportStyle.cloneNode(true));

  const article = document.createElement('article');
  pageRoot.appendChild(article);
  viewport.appendChild(pageRoot);

  return { viewport, article };
}

function paginateExportBlocks(exportRoot: HTMLDivElement, exportStyle: HTMLStyleElement, pageHeightPx: number): HTMLDivElement[] {
  const article = exportRoot.querySelector('article');
  if (!(article instanceof HTMLElement)) {
    const { viewport } = createPageViewport(exportRoot, exportStyle, pageHeightPx);
    return [viewport];
  }

  const blocks = Array.from(article.children).filter((node): node is HTMLElement => node instanceof HTMLElement);
  if (blocks.length === 0) {
    const { viewport, article: pageArticle } = createPageViewport(exportRoot, exportStyle, pageHeightPx);
    pageArticle.innerHTML = article.innerHTML;
    return [viewport];
  }

  const rootStyles = window.getComputedStyle(exportRoot);
  const pageContentLimit =
    pageHeightPx - numericStyleValue(rootStyles, 'padding-top') - numericStyleValue(rootStyles, 'padding-bottom');
  const viewports: HTMLDivElement[] = [];

  let current = createPageViewport(exportRoot, exportStyle, pageHeightPx);
  let currentHeight = 0;

  const pushCurrentPage = () => {
    if (current.article.childElementCount === 0 && viewports.length > 0) {
      return;
    }

    viewports.push(current.viewport);
  };

  blocks.forEach((block, index) => {
    const blockHeight = blockOuterHeight(block);
    const nextBlock = blocks[index + 1];
    const nextBlockHeight = nextBlock ? blockOuterHeight(nextBlock) : 0;
    const groupHeight = shouldKeepWithNext(block) ? blockHeight + nextBlockHeight : blockHeight;

    if (currentHeight > 0 && currentHeight + groupHeight > pageContentLimit) {
      pushCurrentPage();
      current = createPageViewport(exportRoot, exportStyle, pageHeightPx);
      currentHeight = 0;
    }

    current.article.appendChild(block.cloneNode(true));
    currentHeight += blockHeight;
  });

  pushCurrentPage();
  return viewports;
}

function createExportRoot(html: string, fallbackText: string): PreparedExportRoot {
  const exportRoot = document.createElement('div');
  exportRoot.style.position = 'fixed';
  exportRoot.style.left = '-10000px';
  exportRoot.style.top = '0';
  exportRoot.style.width = '794px';
  exportRoot.style.padding = '56px';
  exportRoot.style.background = '#ffffff';
  exportRoot.style.color = '#0f172a';
  exportRoot.style.boxSizing = 'border-box';

  const exportStyle = document.createElement('style');
  exportStyle.textContent = EXPORT_ARTICLE_CSS;
  exportRoot.appendChild(exportStyle);

  const article = document.createElement('article');
  if (html.trim() === '') {
    const paragraph = document.createElement('p');
    paragraph.textContent = fallbackText || 'Sin contenido';
    article.appendChild(paragraph);
  } else {
    article.innerHTML = html;
  }

  exportRoot.appendChild(article);
  return { article, exportRoot, exportStyle };
}

function waitForEvent(target: EventTarget, successEvents: string[], timeoutMs = 4000): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    let timeoutId = 0;

    const cleanup = () => {
      if (settled) {
        return;
      }

      settled = true;
      successEvents.forEach((eventName) => target.removeEventListener(eventName, handleDone));
      target.removeEventListener('error', handleDone);
      if (timeoutId > 0) {
        window.clearTimeout(timeoutId);
      }
      resolve();
    };

    const handleDone = () => cleanup();

    successEvents.forEach((eventName) => target.addEventListener(eventName, handleDone, { once: true }));
    target.addEventListener('error', handleDone, { once: true });
    timeoutId = window.setTimeout(cleanup, timeoutMs);
  });
}

async function waitForExportAssets(root: ParentNode): Promise<void> {
  const pendingTasks: Promise<void>[] = [];

  if (document.fonts?.ready) {
    pendingTasks.push(
      Promise.race([
        document.fonts.ready.then(() => undefined).catch(() => undefined),
        new Promise<void>((resolve) => window.setTimeout(resolve, 1200)),
      ])
    );
  }

  root.querySelectorAll('img').forEach((image) => {
    if (!image.complete) {
      pendingTasks.push(waitForEvent(image, ['load']));
    }
  });

  root.querySelectorAll('video').forEach((video) => {
    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      pendingTasks.push(waitForEvent(video, ['loadeddata', 'loadedmetadata']));
    }
  });

  await Promise.all(pendingTasks);
}

async function withPreparedExportRoot<T>(
  html: string,
  fallbackText: string,
  callback: (prepared: PreparedExportRoot) => Promise<T>
): Promise<T> {
  const prepared = createExportRoot(html, fallbackText);
  document.body.appendChild(prepared.exportRoot);

  try {
    prepared.exportRoot.querySelectorAll('details').forEach((node) => {
      node.setAttribute('open', '');
    });

    await renderMermaidDiagrams(prepared.exportRoot, 'default');
    await waitForExportAssets(prepared.exportRoot);
    await new Promise((resolve) => window.setTimeout(resolve, 50));
    return await callback(prepared);
  } finally {
    if (prepared.exportRoot.parentNode) {
      prepared.exportRoot.parentNode.removeChild(prepared.exportRoot);
    }
  }
}

function buildPrintableHtmlDocument(articleInnerHtml: string): string {
  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <title>documento.pdf</title>
    <style>${EXPORT_PRINT_CSS}</style>
  </head>
  <body>
    <main>
      <article>${articleInnerHtml}</article>
    </main>
  </body>
</html>`;
}

async function buildRasterPdfBytes(prepared: PreparedExportRoot): Promise<Uint8Array> {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
    compress: true,
    putOnlyUsedFonts: true,
  });

  const pageWidthPt = pdf.internal.pageSize.getWidth();
  const pageHeightPt = pdf.internal.pageSize.getHeight();
  const pageHeightPx = Math.floor(794 * (pageHeightPt / pageWidthPt));
  const pageViewports = paginateExportBlocks(prepared.exportRoot, prepared.exportStyle, pageHeightPx);

  for (let pageIndex = 0; pageIndex < pageViewports.length; pageIndex += 1) {
    const pageViewport = pageViewports[pageIndex];
    document.body.appendChild(pageViewport);

    try {
      const canvas = await html2canvas(pageViewport, {
        scale: 1.5,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        onclone: (clonedDocument) => {
          clonedDocument.querySelectorAll('style').forEach((node) => {
            if (node.textContent?.includes('oklch(')) {
              node.remove();
            }
          });
          clonedDocument.querySelectorAll('link[rel="stylesheet"]').forEach((node) => node.remove());
        },
      });

      const imageData = canvas.toDataURL('image/jpeg', 0.9);
      if (pageIndex > 0) {
        pdf.addPage();
      }
      pdf.addImage(imageData, 'JPEG', 0, 0, pageWidthPt, pageHeightPt, undefined, 'FAST');
    } finally {
      if (pageViewport.parentNode) {
        pageViewport.parentNode.removeChild(pageViewport);
      }
    }
  }

  return new Uint8Array(pdf.output('arraybuffer'));
}

export function useExportPdf(): UseExportPdfResult {
  const [isExporting, setIsExporting] = useState(false);
  const [lastExportStatus, setLastExportStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (feedbackTimeoutRef.current) {
        clearTimeout(feedbackTimeoutRef.current);
      }
    };
  }, []);

  const exportPdf = useCallback(async (markdownSource: string, fallbackText: string) => {
    if (isExporting) {
      return;
    }

    setIsExporting(true);
    setLastExportStatus('idle');

    try {
      const html = await renderMarkdownHtml(markdownSource);

      if (isTauriRuntime()) {
        const { save } = await import('@tauri-apps/api/dialog');
        const filePath = await save({
          title: 'Exportar a PDF',
          defaultPath: 'documento.pdf',
          filters: [{ name: 'PDF', extensions: ['pdf'] }],
        });

        if (!filePath) {
          setLastExportStatus('idle');
          return;
        }

        await withPreparedExportRoot(html, fallbackText, async (prepared) => {
          const { invoke } = await import('@tauri-apps/api/tauri');
          const printableHtml = buildPrintableHtmlDocument(prepared.article.innerHTML);

          try {
            await invoke('export_pdf_html', {
              path: filePath,
              html: printableHtml,
            });
          } catch (nativeExportError) {
            console.warn('La exportacion PDF nativa fallo. Se intentara el modo compatible.', nativeExportError);
            const pdfBytes = await buildRasterPdfBytes(prepared);
            await invoke('export_pdf_bytes', {
              path: filePath,
              pdfBytes: Array.from(pdfBytes),
            });
          }
        });
      } else {
        const pdfBytes = await withPreparedExportRoot(html, fallbackText, async (prepared) => buildRasterPdfBytes(prepared));
        const savedFile = await saveBinaryFileInBrowser(pdfBytes, 'documento.pdf', 'documento.pdf');
        if (!savedFile) {
          setLastExportStatus('idle');
          return;
        }
      }

      setLastExportStatus('success');
      if (feedbackTimeoutRef.current) {
        clearTimeout(feedbackTimeoutRef.current);
      }
      feedbackTimeoutRef.current = setTimeout(() => {
        setLastExportStatus('idle');
      }, 3000);
    } catch (error) {
      console.error('Error al exportar PDF:', error);
      setLastExportStatus('error');
      window.alert('No se pudo exportar a PDF. Intenta nuevamente con otra ruta o contenido.');
    } finally {
      setIsExporting(false);
    }
  }, [isExporting]);

  return {
    exportPdf,
    isExporting,
    lastExportStatus,
  };
}
