import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useFileOperations } from '../useFileOperations';

const { openDialogMock, saveDialogMock, readTextFileMock, invokeMock } = vi.hoisted(() => ({
  openDialogMock: vi.fn(),
  saveDialogMock: vi.fn(),
  readTextFileMock: vi.fn(),
  invokeMock: vi.fn(),
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

describe('useFileOperations', () => {
  beforeEach(() => {
    openDialogMock.mockReset();
    saveDialogMock.mockReset();
    readTextFileMock.mockReset();
    invokeMock.mockReset();
    vi.stubGlobal('__TAURI_IPC__', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('opens markdown files and updates current path', async () => {
    const onContentChange = vi.fn();
    openDialogMock.mockResolvedValue('/tmp/file.md');
    readTextFileMock.mockResolvedValue('# titulo');

    const { result } = renderHook(({ content }) =>
      useFileOperations({ content, onContentChange }),
    {
      initialProps: { content: '' },
    });

    await act(async () => {
      await result.current.openMarkdown();
    });

    expect(openDialogMock).toHaveBeenCalledTimes(1);
    expect(readTextFileMock).toHaveBeenCalledWith('/tmp/file.md');
    expect(onContentChange).toHaveBeenCalledWith('# titulo');
    expect(result.current.currentPath).toBe('/tmp/file.md');
    expect(result.current.isDirty).toBe(false);
  });

  it('prevents opening when unsaved changes are rejected by user', async () => {
    const onContentChange = vi.fn();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    const { result, rerender } = renderHook(({ content }) =>
      useFileOperations({ content, onContentChange }),
    {
      initialProps: { content: '' },
    });

    rerender({ content: 'cambio local' });

    await act(async () => {
      await result.current.openMarkdown();
    });

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(openDialogMock).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('saves using saveAs when no current path exists', async () => {
    const onContentChange = vi.fn();
    saveDialogMock.mockResolvedValue('/tmp/notes.md');
    invokeMock.mockResolvedValue(undefined);

    const { result, rerender } = renderHook(({ content }) =>
      useFileOperations({ content, onContentChange }),
    {
      initialProps: { content: '' },
    });

    rerender({ content: 'nuevo texto' });

    await act(async () => {
      await result.current.saveMarkdown('nuevo texto');
    });

    expect(saveDialogMock).toHaveBeenCalledTimes(1);
    expect(invokeMock).toHaveBeenCalledWith('export_document', {
      path: '/tmp/notes.md',
      content: 'nuevo texto',
    });
    expect(result.current.currentPath).toBe('/tmp/notes.md');
    expect(result.current.lastSaveStatus).toBe('success');
  });

  it('saves directly to existing path and clears dirty state after rerender', async () => {
    const onContentChange = vi.fn();
    saveDialogMock.mockResolvedValue('/tmp/notes.md');
    invokeMock.mockResolvedValue(undefined);

    const { result, rerender } = renderHook(({ content }) =>
      useFileOperations({ content, onContentChange }),
    {
      initialProps: { content: '' },
    });

    rerender({ content: 'primera versión' });
    await act(async () => {
      await result.current.saveMarkdown('primera versión');
    });

    rerender({ content: 'segunda versión' });
    expect(result.current.isDirty).toBe(true);

    await act(async () => {
      await result.current.saveMarkdown('segunda versión');
    });

    expect(saveDialogMock).toHaveBeenCalledTimes(1);
    expect(invokeMock).toHaveBeenLastCalledWith('export_document', {
      path: '/tmp/notes.md',
      content: 'segunda versión',
    });

    rerender({ content: 'segunda versión' });
    expect(result.current.isDirty).toBe(false);
  });

  it('keeps idle state when saveAs is cancelled', async () => {
    const onContentChange = vi.fn();
    saveDialogMock.mockResolvedValue(null);

    const { result } = renderHook(({ content }) =>
      useFileOperations({ content, onContentChange }),
    {
      initialProps: { content: 'texto' },
    });

    await act(async () => {
      await result.current.saveAsMarkdown('texto');
    });

    expect(invokeMock).not.toHaveBeenCalled();
    expect(result.current.lastSaveStatus).toBe('idle');
  });

  it('sets error status when save fails due to IO error', async () => {
    const onContentChange = vi.fn();
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    saveDialogMock.mockResolvedValue('/tmp/error.md');
    invokeMock.mockRejectedValue(new Error('disk full'));

    const { result } = renderHook(({ content }) =>
      useFileOperations({ content, onContentChange }),
    {
      initialProps: { content: 'texto con error' },
    });

    await act(async () => {
      await result.current.saveAsMarkdown('texto con error');
    });

    expect(result.current.lastSaveStatus).toBe('error');
    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    consoleErrorSpy.mockRestore();
    alertSpy.mockRestore();
  });

  it('shows alert and keeps path when opening file fails', async () => {
    const onContentChange = vi.fn();
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    openDialogMock.mockResolvedValue('/tmp/fail-open.md');
    readTextFileMock.mockRejectedValue(new Error('permission denied'));

    const { result } = renderHook(({ content }) =>
      useFileOperations({ content, onContentChange }),
    {
      initialProps: { content: '' },
    });

    await act(async () => {
      await result.current.openMarkdown();
    });

    expect(onContentChange).not.toHaveBeenCalled();
    expect(result.current.currentPath).toBeNull();
    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    consoleErrorSpy.mockRestore();
    alertSpy.mockRestore();
  });
});
