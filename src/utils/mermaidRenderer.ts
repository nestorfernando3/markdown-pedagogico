import mermaid from 'mermaid';

export type MermaidTheme = 'default' | 'dark';

let configuredTheme: MermaidTheme | null = null;
let mermaidRenderSequence = 0;

async function ensureMermaidConfiguration(theme: MermaidTheme) {
  if (configuredTheme === theme) {
    return mermaid;
  }

  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    suppressErrorRendering: true,
    theme,
  });

  configuredTheme = theme;
  return mermaid;
}

export function getPreferredMermaidTheme(): MermaidTheme {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'default';
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'default';
}

export async function renderMermaidDiagrams(root: ParentNode, theme: MermaidTheme): Promise<void> {
  const nodes = Array.from(root.querySelectorAll<HTMLElement>('.mermaid'));
  if (nodes.length === 0) {
    return;
  }

  const mermaid = await ensureMermaidConfiguration(theme);

  for (const node of nodes) {
    const source = node.getAttribute('data-mermaid-source') ?? node.textContent ?? '';
    const renderId = `mermaid-diagram-${++mermaidRenderSequence}`;

    try {
      node.setAttribute('data-processed', 'rendering');
      const { svg, bindFunctions } = await mermaid.render(renderId, source);
      node.innerHTML = svg;
      node.setAttribute('data-processed', 'true');
      bindFunctions?.(node);
    } catch (error) {
      console.error('Error rendering mermaid:', error);
      node.textContent = source;
      node.removeAttribute('data-processed');
    }
  }
}
