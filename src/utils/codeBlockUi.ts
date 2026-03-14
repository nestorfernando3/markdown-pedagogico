const COPY_LABEL_DEFAULT = 'Copiar';
const COPY_LABEL_SUCCESS = 'Copiado';
const COPY_LABEL_ERROR = 'Error';

async function writeClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.error('No se pudo copiar el bloque de código:', error);
    return false;
  }
}

export function enhanceCodeBlocks(root: ParentNode): void {
  const blocks = Array.from(root.querySelectorAll<HTMLElement>('pre.shiki, pre[data-code-block="true"]'));

  for (const block of blocks) {
    if (!block.dataset.language) {
      const code = block.querySelector('code');
      const languageClass = Array.from(code?.classList ?? []).find((value) => value.startsWith('language-'));
      block.dataset.language = languageClass ? languageClass.replace(/^language-/u, '') : 'text';
    }

    if (block.querySelector('[data-code-copy-button="true"]')) {
      continue;
    }

    const copyButton = document.createElement('button');
    copyButton.type = 'button';
    copyButton.dataset.codeCopyButton = 'true';
    copyButton.className =
      'code-copy-button absolute right-3 top-3 rounded-md border border-slate-300/70 bg-white/80 px-2 py-1 text-[11px] font-semibold text-slate-700 shadow-sm transition-colors hover:bg-white dark:border-slate-600/70 dark:bg-slate-900/80 dark:text-slate-100';
    copyButton.textContent = COPY_LABEL_DEFAULT;

    copyButton.onclick = async () => {
      const code = block.querySelector('code');
      const ok = await writeClipboard(code?.textContent ?? '');
      copyButton.textContent = ok ? COPY_LABEL_SUCCESS : COPY_LABEL_ERROR;
      window.setTimeout(() => {
        copyButton.textContent = COPY_LABEL_DEFAULT;
      }, 1600);
    };

    block.appendChild(copyButton);
  }
}
