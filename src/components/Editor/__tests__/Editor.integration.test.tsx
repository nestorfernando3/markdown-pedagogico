import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Editor } from '../Editor';

const { openDialogMock, saveDialogMock, readTextFileMock, invokeMock, parseMarkdownMock } = vi.hoisted(() => ({
  openDialogMock: vi.fn(),
  saveDialogMock: vi.fn(),
  readTextFileMock: vi.fn(),
  invokeMock: vi.fn(),
  parseMarkdownMock: vi.fn(),
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

vi.mock('../../../utils/markdownParser', () => ({
  parseMarkdown: parseMarkdownMock,
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
  const offset = text.indexOf(WARNING_TOKEN);

  if (offset === -1) {
    return {
      html: text ? `<p>${text}</p>` : '',
      ast: { type: 'root', children: [] },
      warnings: [],
    };
  }

  const { line, column } = lineAndColumn(text, offset);
  const length = WARNING_TOKEN.length;

  return {
    html: `<p>${text}</p>`,
    ast: { type: 'root', children: [] },
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

    openDialogMock.mockReset();
    saveDialogMock.mockReset();
    readTextFileMock.mockReset();
    invokeMock.mockReset();

    openDialogMock.mockResolvedValue(null);
    saveDialogMock.mockResolvedValue('/tmp/integration.md');
    readTextFileMock.mockResolvedValue('');
    invokeMock.mockResolvedValue(undefined);

    vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
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
    fireEvent.click(await screen.findByRole('button', { name: 'Ignorar en sesión' }));

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

    const ignoreButton = await screen.findByRole('button', { name: 'Ignorar en sesión' });
    const tooltip = ignoreButton.closest('[role=\"tooltip\"]') as HTMLElement;

    expect(tooltip).toBeTruthy();
    expect(marker).toHaveAttribute('aria-controls', tooltip.id);
    expect(marker).toHaveAttribute('aria-describedby', tooltip.id);
    expect(marker).toHaveAttribute('aria-expanded', 'true');
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
});
