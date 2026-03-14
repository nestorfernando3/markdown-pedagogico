import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import remarkDeflist from 'remark-deflist';
import remarkFrontmatter from 'remark-frontmatter';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { Editor } from '../Editor';

const { openDialogMock, saveDialogMock, readTextFileMock, invokeMock, openExternalMock, parseMarkdownMock, renderMarkdownHtmlMock } =
  vi.hoisted(() => ({
  openDialogMock: vi.fn(),
  saveDialogMock: vi.fn(),
  readTextFileMock: vi.fn(),
  invokeMock: vi.fn(),
  openExternalMock: vi.fn(),
  parseMarkdownMock: vi.fn(),
  renderMarkdownHtmlMock: vi.fn(),
}));

vi.mock('@tauri-apps/api/dialog', () => ({
  open: openDialogMock,
  save: saveDialogMock,
}));

vi.mock('@tauri-apps/api/fs', () => ({
  readTextFile: readTextFileMock,
}));

vi.mock('@tauri-apps/api/tauri', () => ({
  invoke: invokeMock,
}));

vi.mock('@tauri-apps/api/shell', () => ({
  open: openExternalMock,
}));

vi.mock('../../../utils/markdownParser', () => ({
  parseMarkdown: parseMarkdownMock,
  renderMarkdownHtml: renderMarkdownHtmlMock,
}));

const WARNING_TOKEN = 'siempre';
const WARNING_MESSAGE = 'Evita afirmaciones absolutas. Matizar el argumento suele hacerlo más sólido.';

function lineAndColumn(text: string, offset: number): { line: number; column: number } {
  const before = text.slice(0, offset);
  const line = before.split('\n').length;
  const lastBreak = before.lastIndexOf('\n');
  return {
    line,
    column: offset - lastBreak,
  };
}

function buildParseResult(text: string) {
  const ast = unified()
    .use(remarkParse)
    .use(remarkFrontmatter, ['yaml', 'toml'])
    .use(remarkGfm, { singleTilde: false })
    .use(remarkDeflist)
    .use(remarkMath)
    .parse(text);
  const offset = text.indexOf(WARNING_TOKEN);

  if (offset === -1) {
    return {
      html: text ? `<p>${text}</p>` : '',
      ast,
      warnings: [],
    };
  }

  const { line, column } = lineAndColumn(text, offset);
  const length = WARNING_TOKEN.length;

  return {
    html: `<p>${text}</p>`,
    ast,
    warnings: [
      {
        id: `clarity-absolute-claims:${offset}:${length}`,
        ruleId: 'clarity-absolute-claims',
        severity: 'info',
        category: 'clarity',
        message: WARNING_MESSAGE,
        line,
        column,
        offset,
        length,
        originalText: text.slice(offset, offset + length),
      },
    ],
  };
}

async function flushParserCycle(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 280));
  });
}

describe('Editor integration', () => {
  beforeEach(() => {
    if (typeof window.localStorage.clear === 'function') {
      window.localStorage.clear();
    } else if (typeof window.localStorage.removeItem === 'function') {
      window.localStorage.removeItem('markdown-pedagogico:draft');
    }

    parseMarkdownMock.mockReset();
    parseMarkdownMock.mockImplementation(async (text: string) => buildParseResult(text));
    renderMarkdownHtmlMock.mockReset();
    renderMarkdownHtmlMock.mockImplementation(async (text: string) => (text ? `<p>${text}</p>` : ''));

    openDialogMock.mockReset();
    saveDialogMock.mockReset();
    readTextFileMock.mockReset();
    invokeMock.mockReset();
    openExternalMock.mockReset();

    openDialogMock.mockResolvedValue(null);
    saveDialogMock.mockResolvedValue('/tmp/integration.md');
    readTextFileMock.mockResolvedValue('');
    invokeMock.mockResolvedValue(undefined);
    openExternalMock.mockResolvedValue(undefined);

    vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.stubGlobal('__TAURI_IPC__', vi.fn());
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('does not expose the format tooltip before a text selection exists', () => {
    render(<Editor />);

    expect(screen.queryByText('Formato Markdown')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Texto' })).not.toBeInTheDocument();
  });

  it('jumps to the expected selection when clicking a warning in diagnostics panel', async () => {
    render(<Editor />);

    const textarea = screen.getByLabelText('Editor de contenido Markdown') as HTMLTextAreaElement;
    const content = 'Primera línea\nsiempre hay un problema aquí';

    fireEvent.change(textarea, { target: { value: content } });
    await flushParserCycle();

    fireEvent.click(screen.getByRole('button', { name: 'Alternar panel de diagnóstico' }));

    const warningMessage = await screen.findByText(WARNING_MESSAGE);
    fireEvent.click(warningMessage.closest('button') as HTMLButtonElement);

    const offset = content.indexOf(WARNING_TOKEN);
    expect(textarea.selectionStart).toBe(offset);
    expect(textarea.selectionEnd).toBe(offset + WARNING_TOKEN.length);
  });

  it('hides warning from overlay and diagnostics when ignored in session', async () => {
    render(<Editor />);

    const textarea = screen.getByLabelText('Editor de contenido Markdown') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'Texto con siempre para disparar alerta.' } });
    await flushParserCycle();

    fireEvent.click(screen.getByRole('button', { name: 'Alternar panel de diagnóstico' }));
    expect(screen.getByText(WARNING_MESSAGE)).toBeInTheDocument();

    const marker = screen.getByRole('button', {
      name: /Advertencia info en línea/i,
    });

    fireEvent.click(marker);
    fireEvent.click(await screen.findByRole('button', { name: 'Ignorar esta alerta' }));

    await waitFor(() => {
      expect(screen.queryByText(WARNING_MESSAGE)).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Advertencia info en línea/i })).not.toBeInTheDocument();
    });
  });

  it('links active marker and tooltip with aria-controls/aria-describedby', async () => {
    render(<Editor />);

    const textarea = screen.getByLabelText('Editor de contenido Markdown') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'Texto con siempre para revisar a11y.' } });
    await flushParserCycle();

    const marker = screen.getByRole('button', {
      name: /Advertencia info en línea/i,
    });

    fireEvent.click(marker);

    const ignoreButton = await screen.findByRole('button', { name: 'Ignorar esta alerta' });
    const tooltip = ignoreButton.closest('[role=\"tooltip\"]') as HTMLElement;

    expect(tooltip).toBeTruthy();
    expect(marker).toHaveAttribute('aria-controls', tooltip.id);
    expect(marker).toHaveAttribute('aria-describedby', tooltip.id);
    expect(marker).toHaveAttribute('aria-expanded', 'true');
  });

  it('applies a remark-lint correction from the tooltip when a safe autofix exists', async () => {
    parseMarkdownMock.mockImplementationOnce(async (text: string) => {
      const ast = unified()
        .use(remarkParse)
        .use(remarkFrontmatter, ['yaml', 'toml'])
        .use(remarkGfm, { singleTilde: false })
        .use(remarkDeflist)
        .use(remarkMath)
        .parse(text);

      return {
        html: `<p>${text}</p>`,
        ast,
        warnings: [
          {
            id: `remark-lint:final-newline:${text.length}:0`,
            ruleId: 'final-newline',
            severity: 'warning',
            category: 'structure',
            source: 'remark-lint',
            message: 'Unexpected missing final newline character, expected line feed (`\\n`) at end of file',
            suggestion: 'Agrega un salto de línea al final del documento.',
            line: 2,
            column: 26,
            offset: text.length,
            length: 0,
            originalText: '',
            replacementConfig: {
              startOffset: text.length,
              endOffset: text.length,
              newText: '\n',
            },
          },
        ],
      };
    });

    render(<Editor />);

    const textarea = screen.getByLabelText('Editor de contenido Markdown') as HTMLTextAreaElement;
    const content = '## es ahora\nel tiempo parece imposible';
    fireEvent.change(textarea, { target: { value: content } });
    await flushParserCycle();

    const marker = screen.getByRole('button', {
      name: /Advertencia warning en línea/i,
    });

    fireEvent.click(marker);
    fireEvent.click(await screen.findByRole('button', { name: 'Aplicar corrección' }));

    await waitFor(() => {
      expect(textarea.value).toBe(`${content}\n`);
    });
  });

  it('applies a pedagogical correction from the tooltip when the warning provides one', async () => {
    parseMarkdownMock.mockImplementationOnce(async (text: string) => {
      const ast = unified()
        .use(remarkParse)
        .use(remarkFrontmatter, ['yaml', 'toml'])
        .use(remarkGfm, { singleTilde: false })
        .use(remarkDeflist)
        .use(remarkMath)
        .parse(text);

      return {
        html: `<p>${text}</p>`,
        ast,
        warnings: [
          {
            id: 'structure-orphan-heading:0:8',
            ruleId: 'structure-orphan-heading',
            severity: 'warning',
            category: 'structure',
            source: 'pedagogical',
            message: 'Encabezado sin contenido intermedio. Agrega desarrollo antes del siguiente título.',
            suggestion: 'Inserta un párrafo breve entre ambos encabezados para dar contexto.',
            line: 1,
            column: 1,
            offset: 0,
            length: 8,
            originalText: '# Titulo',
            replacementConfig: {
              startOffset: '# Titulo'.length,
              endOffset: '# Titulo\n'.length,
              newText: '\n\nDesarrolla esta idea antes del siguiente título.\n\n',
            },
          },
        ],
      };
    });

    render(<Editor />);

    const textarea = screen.getByLabelText('Editor de contenido Markdown') as HTMLTextAreaElement;
    const content = '# Titulo\n## Subtitulo';
    fireEvent.change(textarea, { target: { value: content } });
    await flushParserCycle();

    const marker = screen.getByRole('button', {
      name: /Advertencia warning en línea/i,
    });

    fireEvent.click(marker);
    fireEvent.click(await screen.findByRole('button', { name: 'Aplicar corrección' }));

    await waitFor(() => {
      expect(textarea.value).toBe('# Titulo\n\nDesarrolla esta idea antes del siguiente título.\n\n## Subtitulo');
    });
  });

  it('saves with keyboard shortcut without conflicting with editor selection state', async () => {
    render(<Editor />);

    const textarea = screen.getByLabelText('Editor de contenido Markdown') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'contenido para guardar' } });
    await flushParserCycle();

    fireEvent.keyDown(window, { key: 's', ctrlKey: true });

    await waitFor(() => {
      expect(saveDialogMock).toHaveBeenCalledTimes(1);
      expect(invokeMock).toHaveBeenCalledWith('export_document', {
        path: '/tmp/integration.md',
        content: 'contenido para guardar',
      });
    });
  });

  it('applies Tab and Shift+Tab indentation to multiline selections', async () => {
    render(<Editor />);

    const textarea = screen.getByLabelText('Editor de contenido Markdown') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'uno\ndos' } });
    await flushParserCycle();

    textarea.focus();
    textarea.setSelectionRange(0, textarea.value.length);
    fireEvent.keyDown(textarea, { key: 'Tab' });

    await waitFor(() => {
      expect(textarea.value).toBe('  uno\n  dos');
    });

    textarea.setSelectionRange(0, textarea.value.length);
    fireEvent.keyDown(textarea, { key: 'Tab', shiftKey: true });

    await waitFor(() => {
      expect(textarea.value).toBe('uno\ndos');
    });
  });

  it('applies ordered list from the extended contextual menu', async () => {
    render(<Editor />);

    const textarea = screen.getByLabelText('Editor de contenido Markdown') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'uno\ndos' } });
    await flushParserCycle();

    textarea.focus();
    textarea.setSelectionRange(0, textarea.value.length);
    fireEvent.select(textarea, {
      target: {
        selectionStart: 0,
        selectionEnd: textarea.value.length,
      },
    });
    fireEvent.mouseUp(textarea, { clientX: 280, clientY: 220 });

    expect(await screen.findByText('Formato Markdown')).toBeInTheDocument();
    expect(textarea).toHaveFocus();

    const listsMenuTrigger = await screen.findByRole('button', { name: 'Listas' });
    fireEvent.click(listsMenuTrigger);

    const orderedListButton = await screen.findByRole('menuitem', { name: 'Aplicar Lista ordenada' });
    fireEvent.click(orderedListButton);

    await waitFor(() => {
      expect(textarea.value).toBe('\n1. uno\n2. dos\n');
    });
  });

  it('shows a compact format picker before expanding any category', async () => {
    render(<Editor />);

    const textarea = screen.getByLabelText('Editor de contenido Markdown') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'uno\ndos' } });
    await flushParserCycle();

    textarea.focus();
    textarea.setSelectionRange(0, textarea.value.length);
    fireEvent.select(textarea, {
      target: {
        selectionStart: 0,
        selectionEnd: textarea.value.length,
      },
    });
    fireEvent.mouseUp(textarea, { clientX: 280, clientY: 220 });

    expect(await screen.findByText('Formato Markdown')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Texto' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem')).not.toBeInTheDocument();
  });

  it('applies advanced mermaid block from dropdown menu', async () => {
    render(<Editor />);

    const textarea = screen.getByLabelText('Editor de contenido Markdown') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'x' } });
    await flushParserCycle();

    textarea.focus();
    textarea.setSelectionRange(0, 1);
    fireEvent.select(textarea, {
      target: {
        selectionStart: 0,
        selectionEnd: 1,
      },
    });
    fireEvent.mouseUp(textarea, { clientX: 280, clientY: 220 });

    const advancedMenuTrigger = await screen.findByRole('button', { name: 'Avanzado' });
    fireEvent.click(advancedMenuTrigger);

    const mermaidItem = await screen.findByRole('menuitem', { name: 'Aplicar Diagrama Mermaid' });
    fireEvent.click(mermaidItem);

    await waitFor(() => {
      expect(textarea.value).toContain('```mermaid');
      expect(textarea.value).toContain('graph TD');
    });
  });

  it('supports keyboard navigation across format groups and menu items', async () => {
    render(<Editor />);

    const textarea = screen.getByLabelText('Editor de contenido Markdown') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'texto de prueba' } });
    await flushParserCycle();

    textarea.focus();
    textarea.setSelectionRange(0, textarea.value.length);
    fireEvent.select(textarea, {
      target: {
        selectionStart: 0,
        selectionEnd: textarea.value.length,
      },
    });
    fireEvent.mouseUp(textarea, { clientX: 280, clientY: 220 });

    await screen.findByText('Formato Markdown');

    const textTrigger = screen.getByRole('button', { name: 'Texto' });
    expect(textTrigger).toHaveAttribute('aria-haspopup', 'menu');
    textTrigger.focus();

    fireEvent.keyDown(textTrigger, { key: 'ArrowRight' });

    const titlesTrigger = screen.getByRole('button', { name: 'Titulos' });
    expect(titlesTrigger).toHaveFocus();
    expect(titlesTrigger).toHaveAttribute('aria-expanded', 'true');

    fireEvent.keyDown(titlesTrigger, { key: 'ArrowDown' });

    await waitFor(() => {
      expect(screen.getByRole('menuitem', { name: 'Aplicar Titulo H1' })).toHaveFocus();
    });
  });

  it('opens the file picker with the keyboard shortcut', async () => {
    render(<Editor />);

    fireEvent.keyDown(window, { key: 'o', ctrlKey: true });

    await waitFor(() => {
      expect(openDialogMock).toHaveBeenCalledTimes(1);
    });
  });

  it('persists the selected editor engine when toggling CodeMirror mode', async () => {
    const storageEntries = new Map<string, string>();
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: vi.fn((key: string) => storageEntries.get(key) ?? null),
        setItem: vi.fn((key: string, value: string) => {
          storageEntries.set(key, value);
        }),
        removeItem: vi.fn((key: string) => {
          storageEntries.delete(key);
        }),
        clear: vi.fn(() => {
          storageEntries.clear();
        }),
      },
    });

    render(<Editor />);

    fireEvent.click(screen.getByRole('button', { name: 'Activar editor CodeMirror' }));

    expect(screen.getByRole('button', { name: 'Volver al editor clásico' })).toBeInTheDocument();
    expect(window.localStorage.getItem('markdown-pedagogico:editor-engine')).toBe('codemirror');
  });

  it('activates training mode from the toolbar and advances when the user writes the required steps', async () => {
    render(<Editor />);

    fireEvent.click(screen.getByRole('button', { name: 'Activar training mode' }));
    expect(await screen.findByText('Guía activa')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Crea un título principal' })).toBeInTheDocument();

    const textarea = screen.getByLabelText('Editor de contenido Markdown') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: '# Documento\n\nPrimer párrafo con varias palabras para avanzar.\n' } });
    await flushParserCycle();

    expect(screen.getByRole('heading', { name: 'Resalta una idea importante' })).toBeInTheDocument();
  });

  it('inserts training examples without mutating an existing text selection', async () => {
    render(<Editor />);

    fireEvent.click(screen.getByRole('button', { name: 'Activar training mode' }));

    const textarea = screen.getByLabelText('Editor de contenido Markdown') as HTMLTextAreaElement;
    const content = '# Documento\n\nPrimer párrafo con varias palabras para avanzar.\n';
    fireEvent.change(textarea, { target: { value: content } });
    await flushParserCycle();

    const selectedWord = 'Documento';
    const selectionStart = textarea.value.indexOf(selectedWord);
    const selectionEnd = selectionStart + selectedWord.length;
    textarea.focus();
    textarea.setSelectionRange(selectionStart, selectionEnd);
    fireEvent.select(textarea, {
      target: {
        selectionStart,
        selectionEnd,
      },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Insertar ejemplo' }));

    await waitFor(() => {
      expect(textarea.value).toBe(`${content}\n**idea clave**\n`);
    });
  });

  it('inserts training examples and keeps the coach stable in CodeMirror mode', async () => {
    render(<Editor />);

    fireEvent.click(screen.getByRole('button', { name: 'Activar editor CodeMirror' }));
    fireEvent.click(screen.getByRole('button', { name: 'Activar training mode' }));

    fireEvent.click(await screen.findByRole('button', { name: 'Insertar ejemplo' }));
    await flushParserCycle();

    const editor = screen.getByLabelText('Editor de contenido Markdown');
    expect(editor.textContent ?? '').toContain('# Mi documento');
    expect(screen.getByRole('heading', { name: 'Añade un primer párrafo' })).toBeInTheDocument();
  });

  it('opens external links from preview without navigating away from the editor shell', async () => {
    parseMarkdownMock.mockImplementation(async (text: string) => {
      if (text.includes('[OpenAI]')) {
        return {
          html: '<p><a href="https://openai.com">OpenAI</a></p>',
          ast: { type: 'root', children: [] },
          warnings: [],
        };
      }

      return buildParseResult(text);
    });

    render(<Editor />);

    const textarea = screen.getByLabelText('Editor de contenido Markdown') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: '[OpenAI](https://openai.com)' } });
    await flushParserCycle();

    fireEvent.click(await screen.findByRole('link', { name: 'OpenAI' }));

    await waitFor(() => {
      expect(openExternalMock).toHaveBeenCalledWith('https://openai.com');
      expect(screen.getByRole('heading', { name: 'Markdown Pedagógico' })).toBeInTheDocument();
    });
  });

  it('exposes labeled landmarks and a single live status region', async () => {
    render(<Editor />);

    fireEvent.click(screen.getByRole('button', { name: 'Alternar panel de referencia' }));
    fireEvent.click(screen.getByRole('button', { name: 'Alternar panel de diagnóstico' }));

    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: 'Panel de Referencia' })).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Diagnóstico' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Vista Previa Real' })).toBeInTheDocument();
    expect(screen.getAllByRole('status')).toHaveLength(1);
  });
});
