import { useEffect, useMemo, useRef, useState } from 'react';
import type { Root } from 'mdast';
import { parseMarkdown, type PedagogicalWarning } from '../../utils/markdownParser';
import {
  buildDiagnosticSnapshot,
  countDocumentWords,
  type DiagnosticSnapshot,
} from '../../utils/pedagogicalRules';
import { buildTrainingSignals, type TrainingSignals } from '../../utils/trainingMode';

const DRAFT_STORAGE_KEY = 'markdown-pedagogico:draft';
const DRAFT_DEBOUNCE_MS = 180;
const PARSE_DEBOUNCE_MS = 220;

export const EMPTY_DIAGNOSTIC_SNAPSHOT: DiagnosticSnapshot = {
  headingCount: 0,
  paragraphCount: 0,
  listCount: 0,
  emphasisCount: 0,
};

export interface UseEditorDocumentResult {
  content: string;
  setContent: (next: string) => void;
  htmlPreview: string;
  ast: Root | null;
  warnings: PedagogicalWarning[];
  diagnosticSnapshot: DiagnosticSnapshot;
  trainingSignals: TrainingSignals;
  words: number;
  characters: number;
  readingMinutes: number;
  lineNumbers: number[];
}

export function useEditorDocument(): UseEditorDocumentResult {
  const [content, setContent] = useState('');
  const [htmlPreview, setHtmlPreview] = useState('');
  const [ast, setAst] = useState<Root | null>(null);
  const [warnings, setWarnings] = useState<PedagogicalWarning[]>([]);
  const [diagnosticSnapshot, setDiagnosticSnapshot] = useState<DiagnosticSnapshot>(EMPTY_DIAGNOSTIC_SNAPSHOT);
  const parseRequestIdRef = useRef(0);

  const storage = useMemo(() => {
    if (typeof window === 'undefined' || !window.localStorage) {
      return null;
    }

    const candidate = window.localStorage as Partial<Storage>;
    if (typeof candidate.getItem !== 'function' || typeof candidate.setItem !== 'function') {
      return null;
    }

    return candidate as Storage;
  }, []);

  useEffect(() => {
    if (!storage) {
      return;
    }

    const savedDraft = storage.getItem(DRAFT_STORAGE_KEY);
    if (savedDraft !== null) {
      setContent(savedDraft);
    }
  }, [storage]);

  useEffect(() => {
    if (!storage) {
      return;
    }

    const timer = setTimeout(() => {
      storage.setItem(DRAFT_STORAGE_KEY, content);
    }, DRAFT_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [content, storage]);

  useEffect(() => {
    const requestId = ++parseRequestIdRef.current;
    let cancelled = false;

    const timer = setTimeout(() => {
      void (async () => {
        try {
          const { html, warnings: nextWarnings, ast: nextAst } = await parseMarkdown(content);

          if (cancelled || requestId !== parseRequestIdRef.current) {
            return;
          }

          setHtmlPreview(html);
          setWarnings(nextWarnings);
          setAst(nextAst);
          setDiagnosticSnapshot(buildDiagnosticSnapshot(nextAst));
        } catch (error) {
          if (!cancelled && requestId === parseRequestIdRef.current) {
            console.error('Error parsing markdown:', error);
          }
        }
      })();
    }, PARSE_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [content]);

  const words = useMemo(() => countDocumentWords(content), [content]);
  const characters = content.length;
  const readingMinutes = words === 0 ? 0 : Math.max(1, Math.ceil(words / 200));

  const lineNumbers = useMemo(() => {
    const lineCount = Math.max(1, content.split('\n').length);
    return Array.from({ length: lineCount }, (_, index) => index + 1);
  }, [content]);

  const trainingSignals = useMemo(() => buildTrainingSignals(content, ast, warnings), [ast, content, warnings]);

  return {
    content,
    setContent,
    htmlPreview,
    ast,
    warnings,
    diagnosticSnapshot,
    trainingSignals,
    words,
    characters,
    readingMinutes,
    lineNumbers,
  };
}
