import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import remarkDeflist from 'remark-deflist';
import remarkFrontmatter from 'remark-frontmatter';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { runAxe, formatViolations } from '../../../test/axe';
import { Editor } from '../Editor';

const { openDialogMock, saveDialogMock, readTextFileMock, invokeMock, parseMarkdownMock, renderMarkdownHtmlMock } = vi.hoisted(
  () => ({
  openDialogMock: vi.fn(),
  saveDialogMock: vi.fn(),
  readTextFileMock: vi.fn(),
  invokeMock: vi.fn(),
  parseMarkdownMock: vi.fn(),
    renderMarkdownHtmlMock: vi.fn(),
  })
);

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

async function expectNoViolations(baseElement: HTMLElement): Promise<void> {
  const results = await runAxe(baseElement);
  expect(results.violations, formatViolations(results)).toHaveLength(0);
}

describe('Editor accessibility', () => {
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

    openDialogMock.mockResolvedValue(null);
    saveDialogMock.mockResolvedValue('/tmp/a11y.md');
    readTextFileMock.mockResolvedValue('');
    invokeMock.mockResolvedValue(undefined);

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

  it('has no axe violations in the default editor shell', async () => {
    const { baseElement } = render(<Editor />);
    await flushParserCycle();

    await expectNoViolations(baseElement);
  });

  it('has no axe violations with reference and diagnostics panels visible', async () => {
    const { baseElement } = render(<Editor />);

    fireEvent.click(screen.getByRole('button', { name: 'Alternar panel de referencia' }));
    fireEvent.click(screen.getByRole('button', { name: 'Alternar panel de diagnóstico' }));
    await flushParserCycle();

    await expectNoViolations(baseElement);
  });

  it('has no axe violations with the format tooltip open', async () => {
    const { baseElement } = render(<Editor />);
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
    await expectNoViolations(baseElement);
  });

  it('has no axe violations with an active pedagogical tooltip', async () => {
    const { baseElement } = render(<Editor />);
    const textarea = screen.getByLabelText('Editor de contenido Markdown') as HTMLTextAreaElement;

    fireEvent.change(textarea, { target: { value: 'Texto con siempre para disparar alerta.' } });
    await flushParserCycle();

    fireEvent.click(
      await screen.findByRole('button', {
        name: /Advertencia info en línea/i,
      })
    );

    expect(await screen.findByRole('button', { name: 'Ignorar en sesión' })).toBeInTheDocument();
    await expectNoViolations(baseElement);
  });

  it('has no axe violations with the training coach visible', async () => {
    const { baseElement } = render(<Editor />);

    fireEvent.click(screen.getByRole('button', { name: 'Activar training mode' }));
    await flushParserCycle();

    expect(await screen.findByText('Training mode')).toBeInTheDocument();
    await expectNoViolations(baseElement);
  });
});
