import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useExportPdf } from '../../hooks/useExportPdf';
import { useFileOperations } from '../../hooks/useFileOperations';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { useTooltipState } from '../../hooks/useTooltipState';
import { useEditorDocument } from '../../hooks/editor/useEditorDocument';
import { useEditorInteractions } from '../../hooks/editor/useEditorInteractions';
import { useWarningSession } from '../../hooks/editor/useWarningSession';
import { DiagnosticsPanel } from './DiagnosticsPanel';
import { EditorWorkspace } from './EditorWorkspace';
import { StatusBar } from './StatusBar';
import { Toolbar } from './Toolbar';

function toTooltipId(warningId: string): string {
  return `pedagogy-tooltip-${warningId.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
}

export const Editor: React.FC = () => {
  const [isZenMode, setIsZenMode] = useState(false);
  const [showReferencePanel, setShowReferencePanel] = useState(false);
  const [showDiagnosticsPanel, setShowDiagnosticsPanel] = useState(false);
  const [referenceText, setReferenceText] = useState('');
  const [referenceImageDataUrl, setReferenceImageDataUrl] = useState<string | null>(null);

  const editorRef = useRef<HTMLTextAreaElement>(null);

  const {
    content,
    setContent,
    htmlPreview,
    warnings,
    diagnosticSnapshot,
    words,
    characters,
    readingMinutes,
    lineNumbers,
  } = useEditorDocument();

  const { ignoredWarningIds, visibleWarnings, peakWarningCount, newWarningIds, ignoreWarning } = useWarningSession(warnings);

  const { tooltipState, hideTooltip, showFormatTooltip, togglePedagogyTooltip } = useTooltipState();

  const {
    caretPosition,
    editorScrollTop,
    onEditorScroll,
    handleEditorChange,
    handleEditorKeyUp,
    handleEditorClick,
    handleSelect,
    handleFormatAction,
    handleApplyFix,
    handleTabIndentation,
    handleJumpToWarning,
    handleToggleWarning,
    handleTooltipClose,
  } = useEditorInteractions({
    editorRef,
    content,
    setContent,
    tooltipState,
    hideTooltip,
    showFormatTooltip,
    togglePedagogyTooltip,
  });

  const { openMarkdown, saveMarkdown, saveAsMarkdown, currentPath, isDirty, isSaving, lastSaveStatus } = useFileOperations({
    content,
    onContentChange: setContent,
  });

  const { exportPdf, isExporting, lastExportStatus } = useExportPdf();

  const activeWarningId =
    tooltipState.visible && tooltipState.type === 'pedagogy' && tooltipState.warning ? tooltipState.warning.id : null;

  const activeTooltipId = useMemo(() => {
    if (!activeWarningId) {
      return null;
    }
    return toTooltipId(activeWarningId);
  }, [activeWarningId]);

  useEffect(() => {
    if (tooltipState.type !== 'pedagogy' || !tooltipState.warning) {
      return;
    }

    const stillExists = visibleWarnings.some((warning) => warning.id === tooltipState.warning?.id);
    if (!stillExists) {
      handleTooltipClose();
    }
  }, [handleTooltipClose, tooltipState.type, tooltipState.warning, visibleWarnings]);

  useKeyboardShortcuts({
    editorRef,
    onBold: () => handleFormatAction('bold'),
    onItalic: () => handleFormatAction('italic'),
    onSave: () => {
      void saveMarkdown(content);
    },
    onExportPdf: () => {
      void exportPdf(htmlPreview, content || 'Sin contenido');
    },
  });

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !tooltipState.visible) {
        return;
      }

      event.preventDefault();
      handleTooltipClose();
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [handleTooltipClose, tooltipState.visible]);

  const handleSave = () => {
    void saveMarkdown(content);
  };

  const handleSaveAs = () => {
    void saveAsMarkdown(content);
  };

  const handleOpen = () => {
    void openMarkdown();
  };

  const handleExport = () => {
    void exportPdf(htmlPreview, content || 'Sin contenido');
  };

  const handleIgnoreWarning = (warningId: string) => {
    ignoreWarning(warningId);
    handleTooltipClose();
  };

  return (
    <div className="flex flex-col h-full min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-500 font-sans">
      <Toolbar
        warningCount={visibleWarnings.length}
        onOpen={handleOpen}
        onSave={handleSave}
        onSaveAs={handleSaveAs}
        onExportPdf={handleExport}
        isSaving={isSaving}
        isExporting={isExporting}
        lastSaveStatus={lastSaveStatus}
        lastExportStatus={lastExportStatus}
        isZenMode={isZenMode}
        onToggleZenMode={() => setIsZenMode((previous) => !previous)}
        showReferencePanel={showReferencePanel}
        onToggleReferencePanel={() => setShowReferencePanel((previous) => !previous)}
        showDiagnosticsPanel={showDiagnosticsPanel}
        onToggleDiagnosticsPanel={() => setShowDiagnosticsPanel((previous) => !previous)}
      />

      <EditorWorkspace
        content={content}
        htmlPreview={htmlPreview}
        lineNumbers={lineNumbers}
        editorRef={editorRef}
        editorScrollTop={editorScrollTop}
        isZenMode={isZenMode}
        showReferencePanel={showReferencePanel}
        showDiagnosticsPanel={showDiagnosticsPanel}
        referenceText={referenceText}
        referenceImageDataUrl={referenceImageDataUrl}
        visibleWarnings={visibleWarnings}
        newWarningIds={newWarningIds}
        tooltipState={tooltipState}
        activeWarningId={activeWarningId}
        activeTooltipId={activeTooltipId}
        onReferenceTextChange={setReferenceText}
        onReferenceImageDataUrlChange={setReferenceImageDataUrl}
        onEditorChange={handleEditorChange}
        onEditorScroll={onEditorScroll}
        onEditorSelect={handleSelect}
        onEditorClick={handleEditorClick}
        onEditorKeyUp={handleEditorKeyUp}
        onEditorTab={handleTabIndentation}
        onToggleWarning={handleToggleWarning}
        onFormatAction={handleFormatAction}
        onFixAction={handleApplyFix}
        onIgnoreWarning={handleIgnoreWarning}
        onTooltipClose={handleTooltipClose}
        diagnosticsPanel={
          <DiagnosticsPanel
            warnings={visibleWarnings}
            ignoredCount={ignoredWarningIds.size}
            peakWarningCount={peakWarningCount}
            content={content}
            snapshot={diagnosticSnapshot}
            onJumpToWarning={handleJumpToWarning}
          />
        }
      />

      <StatusBar
        words={words}
        characters={characters}
        readingMinutes={readingMinutes}
        line={caretPosition.line}
        column={caretPosition.column}
        warningCount={visibleWarnings.length}
        currentPath={currentPath}
        isDirty={isDirty}
      />
    </div>
  );
};
