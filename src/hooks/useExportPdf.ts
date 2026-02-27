import { save } from '@tauri-apps/api/dialog';
import { invoke } from '@tauri-apps/api/tauri';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { useCallback, useEffect, useRef, useState } from 'react';

export interface UseExportPdfResult {
  exportPdf: (html: string, fallbackText: string) => Promise<void>;
  isExporting: boolean;
  lastExportStatus: 'idle' | 'success' | 'error';
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

  const exportPdf = useCallback(async (html: string, fallbackText: string) => {
    if (isExporting) {
      return;
    }

    setIsExporting(true);
    setLastExportStatus('idle');

    try {
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
        exportRoot.style.padding = '56px';
        exportRoot.style.background = '#ffffff';
        exportRoot.style.color = '#0f172a';
        exportRoot.style.boxSizing = 'border-box';
        exportRoot.innerHTML = `<article>${html.trim() === '' ? `<p>${fallbackText || 'Sin contenido'}</p>` : html}</article>`;

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
          await new Promise((resolve) => setTimeout(resolve, 50));

          const pageWidthPt = pdf.internal.pageSize.getWidth();
          const pageHeightPt = pdf.internal.pageSize.getHeight();
          const pageHeightPx = Math.floor(794 * (pageHeightPt / pageWidthPt));
          const totalHeightPx = Math.max(exportRoot.scrollHeight, pageHeightPx);
          const totalPages = Math.max(1, Math.ceil(totalHeightPx / pageHeightPx));

          for (let pageIndex = 0; pageIndex < totalPages; pageIndex += 1) {
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
        filters: [{ name: 'PDF', extensions: ['pdf'] }],
      });

      if (!filePath) {
        setLastExportStatus('idle');
        return;
      }

      await invoke('export_pdf_bytes', {
        path: filePath,
        pdfBytes,
      });

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
