import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useExportPdf } from '../../hooks/useExportPdf';
import { useFileOperations } from '../../hooks/useFileOperations';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { useTooltipState } from '../../hooks/useTooltipState';
import { useEditorDocument } from '../../hooks/editor/useEditorDocument';
import { useEditorInteractions } from '../../hooks/editor/useEditorInteractions';
import { useTrainingMode } from '../../hooks/editor/useTrainingMode';
import { useWarningSession } from '../../hooks/editor/useWarningSession';
import type { EditorHandle } from './editorHandle';
import { DiagnosticsPanel } from './DiagnosticsPanel';
import { EditorWorkspace, type EditorEngine } from './EditorWorkspace';
import { StatusBar } from './StatusBar';
import { Toolbar } from './Toolbar';

function toTooltipId(warningId: string): string {
  return `pedagogy-tooltip-${warningId.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
}

const EDITOR_ENGINE_STORAGE_KEY = 'markdown-pedagogico:editor-engine';

function readEditorEngine(): EditorEngine {
  if (typeof window === 'undefined') {
    return 'legacy';
  }

  const storedValue = window.localStorage.getItem(EDITOR_ENGINE_STORAGE_KEY);
  return storedValue === 'codemirror' ? 'codemirror' : 'legacy';
}

export const Editor: React.FC = () => {
  const [isZenMode, setIsZenMode] = useState(false);
  const [editorEngine, setEditorEngine] = useState<EditorEngine>(() => readEditorEngine());
  const [showReferencePanel, setShowReferencePanel] = useState(false);
  const [showDiagnosticsPanel, setShowDiagnosticsPanel] = useState(false);
  const [successfulExportCount, setSuccessfulExportCount] = useState(0);
  const [referenceText, setReferenceText] = useState('');
  const [referenceImageDataUrl, setReferenceImageDataUrl] = useState<string | null>(null);

  const editorRef = useRef<EditorHandle>(null);

  const {
    content,
    setContent,
    htmlPreview,
    warnings,
    diagnosticSnapshot,
    ast,
    words,
    characters,
    readingMinutes,
    lineNumbers,
    trainingSignals,
  } = useEditorDocument();

  const { ignoredWarningIds, visibleWarnings, peakWarningCount, newWarningIds, ignoreWarning } = useWarningSession(warnings);

  const { tooltipState, hideTooltip, showFormatTooltip, togglePedagogyTooltip } = useTooltipState();

  const {
    caretPosition,
    editorScrollTop,
    onEditorScroll,
    handleEditorChange,
    handleEditorKeyUp,
    handleEditorPointerUp,
    handleSelect,
    handleFormatAction,
    handleInsertSnippet,
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

  const { trainingState, toggleTrainingMode, closeTrainingMode, skipCurrentStep, toggleTrainingCollapsed } =
    useTrainingMode(content, ast, warnings, editorEngine, successfulExportCount);

  const activeWarningId =
    tooltipState.visible && tooltipState.type === 'pedagogy' && tooltipState.warning ? tooltipState.warning.id : null;

  const activeTooltipId = useMemo(() => {
    if (!activeWarningId) {
      return null;
    }
    return toTooltipId(activeWarningId);
  }, [activeWarningId]);

  useEffect(() => {
    window.localStorage.setItem(EDITOR_ENGINE_STORAGE_KEY, editorEngine);
  }, [editorEngine]);

  useEffect(() => {
    if (lastExportStatus !== 'success') {
      return;
    }

    setSuccessfulExportCount((previous) => previous + 1);
  }, [lastExportStatus]);

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
    onOpen: () => {
      void openMarkdown();
    },
    onSave: () => {
      void saveMarkdown(content);
    },
    onExportPdf: () => {
      void exportPdf(content, content || 'Sin contenido');
    },
  });

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }

      if (tooltipState.visible) {
        event.preventDefault();
        handleTooltipClose();
        return;
      }

      if (showDiagnosticsPanel) {
        event.preventDefault();
        setShowDiagnosticsPanel(false);
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [handleTooltipClose, showDiagnosticsPanel, tooltipState.visible]);

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
    void exportPdf(content, content || 'Sin contenido');
  };

  const handleIgnoreWarning = (warningId: string) => {
    ignoreWarning(warningId);
    handleTooltipClose();
  };

  const handleTrainingInsertExample = () => {
    const exampleAction = trainingState.currentStep?.exampleAction;
    if (!exampleAction) {
      return;
    }

    if (exampleAction.kind === 'format') {
      handleFormatAction(exampleAction.action);
      return;
    }

    if (exampleAction.kind === 'snippet') {
      handleInsertSnippet(exampleAction.snippet, {
        placement: exampleAction.placement,
        selectionStartOffset: exampleAction.selectionStartOffset,
        selectionEndOffset: exampleAction.selectionEndOffset,
      });
      return;
    }

    void exportPdf(content, content || 'Sin contenido');
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
        isTrainingMode={trainingState.active}
        onToggleTrainingMode={toggleTrainingMode}
        editorEngine={editorEngine}
        onToggleEditorEngine={() =>
          setEditorEngine((previous) => (previous === 'codemirror' ? 'legacy' : 'codemirror'))
        }
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
        editorEngine={editorEngine}
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
        onEditorPointerUp={handleEditorPointerUp}
        onEditorKeyUp={handleEditorKeyUp}
        onEditorTab={handleTabIndentation}
        onToggleWarning={handleToggleWarning}
        onFormatAction={handleFormatAction}
        onFixAction={handleApplyFix}
        onIgnoreWarning={handleIgnoreWarning}
        onTooltipClose={handleTooltipClose}
        onCloseDiagnosticsPanel={() => setShowDiagnosticsPanel(false)}
        trainingState={{
          ...trainingState,
          signals: trainingSignals,
        }}
        onTrainingInsertExample={handleTrainingInsertExample}
        onTrainingSkipStep={skipCurrentStep}
        onTrainingClose={closeTrainingMode}
        onTrainingToggleCollapsed={toggleTrainingCollapsed}
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
