import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Editor } from '../Editor';

const { exportPdfMock, parseMarkdownMock } = vi.hoisted(() => ({
  exportPdfMock: vi.fn(),
  parseMarkdownMock: vi.fn(),
}));

vi.mock('../../../hooks/useExportPdf', () => ({
  useExportPdf: () => ({
    exportPdf: exportPdfMock,
    isExporting: false,
    lastExportStatus: 'idle',
  }),
}));

vi.mock('../../../hooks/useFileOperations', () => ({
  useFileOperations: () => ({
    openMarkdown: vi.fn(),
    saveMarkdown: vi.fn(),
    saveAsMarkdown: vi.fn(),
    currentPath: null,
    isDirty: false,
    isSaving: false,
    lastSaveStatus: 'idle',
  }),
}));

vi.mock('../../../hooks/useKeyboardShortcuts', () => ({
  useKeyboardShortcuts: () => undefined,
}));

vi.mock('../../../hooks/useTooltipState', () => ({
  useTooltipState: () => ({
    tooltipState: { visible: false, type: 'format', x: 0, y: 0, warning: null },
    hideTooltip: vi.fn(),
    showFormatTooltip: vi.fn(),
    togglePedagogyTooltip: vi.fn(),
  }),
}));

vi.mock('../../../hooks/editor/useWarningSession', () => ({
  useWarningSession: (warnings: unknown[]) => ({
    ignoredWarningIds: new Set<string>(),
    visibleWarnings: warnings,
    peakWarningCount: Array.isArray(warnings) ? warnings.length : 0,
    newWarningIds: new Set<string>(),
    ignoreWarning: vi.fn(),
  }),
}));

vi.mock('../../../hooks/editor/useEditorInteractions', () => ({
  useEditorInteractions: ({ setContent }: { setContent: (next: string) => void }) => ({
    caretPosition: { line: 1, column: 1 },
    editorScrollTop: 0,
    onEditorScroll: vi.fn(),
    handleEditorChange: (nextValue: string) => setContent(nextValue),
    handleEditorKeyUp: vi.fn(),
    handleEditorPointerUp: vi.fn(),
    handleSelect: vi.fn(),
    handleFormatAction: vi.fn(),
    handleApplyFix: vi.fn(),
    handleTabIndentation: vi.fn(),
    handleJumpToWarning: vi.fn(),
    handleToggleWarning: vi.fn(),
    handleTooltipClose: vi.fn(),
  }),
}));

vi.mock('../../../utils/markdownParser', () => ({
  parseMarkdown: parseMarkdownMock,
  renderMarkdownHtml: vi.fn(),
}));

vi.mock('../Toolbar', () => ({
  Toolbar: ({ onExportPdf }: { onExportPdf: () => void }) => (
    <button type="button" onClick={onExportPdf}>
      Exportar PDF
    </button>
  ),
}));

vi.mock('../EditorWorkspace', () => ({
  EditorWorkspace: ({
    content,
    onEditorChange,
  }: {
    content: string;
    onEditorChange: (nextValue: string, selectionStart: number) => void;
  }) => (
    <textarea
      aria-label="Editor de contenido Markdown"
      value={content}
      onChange={(event) => onEditorChange(event.target.value, event.target.value.length)}
    />
  ),
}));

vi.mock('../DiagnosticsPanel', () => ({
  DiagnosticsPanel: () => <div />,
}));

vi.mock('../StatusBar', () => ({
  StatusBar: () => <div />,
}));

function buildParseResult(text: string) {
  return {
    html: text ? `<p>${text}</p>` : '',
    ast: { type: 'root', children: [] },
    warnings: [],
  };
}

describe('Editor export wiring', () => {
  beforeEach(() => {
    parseMarkdownMock.mockReset();
    parseMarkdownMock.mockImplementation(async (text: string) => buildParseResult(text));
    exportPdfMock.mockReset();
    const storage = {
      getItem: vi.fn().mockReturnValue(null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    };

    Object.defineProperty(window, 'localStorage', {
      value: storage,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exports the latest markdown source without waiting for the debounced preview', async () => {
    render(<Editor />);

    const textarea = screen.getByLabelText('Editor de contenido Markdown') as HTMLTextAreaElement;
    const content = `# Documento

### TypeScript

\`\`\`ts
const answer = 42;
\`\`\`

### JSON

[Repositorio][repo]

[repo]: https://github.com`;

    fireEvent.change(textarea, { target: { value: content } });
    fireEvent.click(screen.getByRole('button', { name: 'Exportar PDF' }));

    await waitFor(() => {
      expect(exportPdfMock).toHaveBeenCalledWith(content, content);
    });
  });
});
