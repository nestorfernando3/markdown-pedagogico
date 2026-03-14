import type { Root, Text } from 'mdast';
import nspell from 'nspell';
import remarkPresetLintRecommended from 'remark-preset-lint-recommended';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';
import { VFile } from 'vfile';
import type { VFileMessage } from 'vfile-message';
import type { PedagogicalCategory, PedagogicalWarning, PedagogicalSeverity } from './pedagogicalRules';
import spanishAff from '../../node_modules/dictionary-es/index.aff?raw';
import spanishDic from '../../node_modules/dictionary-es/index.dic?raw';

const MAX_LINT_WARNINGS = 40;
const MAX_SPELL_WARNINGS = 60;
const MAX_SPELL_SUGGESTIONS = 12;
const SPELLCHECK_WORD_PATTERN = /[\p{L}][\p{L}\p{M}'’-]*/gu;
const IGNORED_ALL_CAPS_PATTERN = /^[A-ZÁÉÍÓÚÜÑ]{2,}$/u;
const PROJECT_WORDS = [
  'Markdown',
  'Pedagógico',
  'Mermaid',
  'KaTeX',
  'Shiki',
  'Tauri',
  'Codex',
  'OpenAI',
  'TypeScript',
  'JavaScript',
  'frontmatter',
  'rehype',
  'remark',
];

const lintProcessor = unified().use(remarkPresetLintRecommended);

interface SpellChecker {
  add: (word: string, model?: string) => SpellChecker;
  correct: (word: string) => boolean;
  suggest: (word: string) => string[];
}

let dictionaryPromise: Promise<SpellChecker> | null = null;

function getSpanishDictionary() {
  dictionaryPromise ??= Promise.resolve().then(() => {
    const spell = nspell({
      aff: spanishAff,
      dic: spanishDic,
    }) as unknown as SpellChecker;

    for (const word of PROJECT_WORDS) {
      spell.add(word);
    }

    return spell;
  });
  return dictionaryPromise;
}

function buildLineStarts(text: string): number[] {
  const starts = [0];
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === '\n') {
      starts.push(index + 1);
    }
  }
  return starts;
}

function offsetFromLineColumn(lineStarts: number[], line: number, column: number): number {
  const lineStart = lineStarts[Math.max(0, line - 1)] ?? 0;
  return lineStart + Math.max(0, column - 1);
}

function pointFromPlace(place: VFileMessage['place']): { line: number; column: number; offset?: number } | null {
  if (!place) {
    return null;
  }

  if ('start' in place && place.start?.line && place.start.column) {
    return {
      line: place.start.line,
      column: place.start.column,
      offset: place.start.offset,
    };
  }

  if ('line' in place && typeof place.line === 'number' && typeof place.column === 'number') {
    return {
      line: place.line,
      column: place.column,
      offset: place.offset,
    };
  }

  return null;
}

function endPointFromPlace(place: VFileMessage['place']): { line: number; column: number; offset?: number } | null {
  if (!place || !('end' in place) || !place.end?.line || !place.end.column) {
    return null;
  }

  return {
    line: place.end.line,
    column: place.end.column,
    offset: place.end.offset,
  };
}

function inferLintCategory(ruleId: string): PedagogicalCategory {
  if (/(heading|list|fence|code|link|table|emphasis|rule|blockquote|definition)/u.test(ruleId)) {
    return 'syntax';
  }

  if (/(newline|blank-lines|indent|ordered-list-marker-value|no-duplicate-headings)/u.test(ruleId)) {
    return 'structure';
  }

  return 'style';
}

function inferLintSeverity(message: VFileMessage): PedagogicalSeverity {
  if (message.fatal === true) {
    return 'error';
  }

  return 'warning';
}

function deriveLintSuggestion(
  text: string,
  ruleId: string,
  message: VFileMessage,
  startOffset: number
): Pick<PedagogicalWarning, 'suggestion' | 'replacementConfig'> {
  if (
    ruleId === 'final-newline' ||
    /missing final newline character/u.test(message.reason)
  ) {
    return {
      suggestion: 'Agrega un salto de línea al final del documento.',
      replacementConfig: {
        startOffset: text.length,
        endOffset: text.length,
        newText: '\n',
      },
    };
  }

  if (
    ruleId === 'no-trailing-spaces' ||
    /trailing spaces?/u.test(message.reason)
  ) {
    const lineStart = text.lastIndexOf('\n', Math.max(0, startOffset - 1)) + 1;
    const nextBreak = text.indexOf('\n', startOffset);
    const lineEnd = nextBreak === -1 ? text.length : nextBreak;
    const lineText = text.slice(lineStart, lineEnd);
    const trimmedLine = lineText.replace(/[ \t]+$/u, '');

    if (trimmedLine !== lineText) {
      return {
        suggestion: 'Elimina los espacios sobrantes al final de la línea.',
        replacementConfig: {
          startOffset: lineStart,
          endOffset: lineEnd,
          newText: trimmedLine,
        },
      };
    }
  }

  return {};
}

function warningFromLintMessage(text: string, lineStarts: number[], message: VFileMessage): PedagogicalWarning | null {
  const start = pointFromPlace(message.place);
  if (!start) {
    return null;
  }

  const startOffset = start.offset ?? offsetFromLineColumn(lineStarts, start.line, start.column);
  const end = endPointFromPlace(message.place);
  const endOffset = end
    ? (end.offset ?? offsetFromLineColumn(lineStarts, end.line, end.column))
    : startOffset + Math.max(1, String(message.actual ?? '').length || 1);
  const safeEndOffset = Math.min(text.length, Math.max(startOffset + 1, endOffset));
  const ruleId = message.ruleId ?? 'remark-lint';
  const lintSuggestion = deriveLintSuggestion(text, ruleId, message, startOffset);

  return {
    id: `remark-lint:${ruleId}:${startOffset}:${safeEndOffset - startOffset}`,
    ruleId,
    severity: inferLintSeverity(message),
    category: inferLintCategory(ruleId),
    source: 'remark-lint',
    message: message.reason,
    line: start.line,
    column: start.column,
    offset: startOffset,
    length: safeEndOffset - startOffset,
    originalText: text.slice(startOffset, safeEndOffset),
    suggestion: lintSuggestion.suggestion,
    replacementConfig: lintSuggestion.replacementConfig,
  };
}

function isSpellcheckCandidate(word: string): boolean {
  if (word.length < 4) {
    return false;
  }

  if (IGNORED_ALL_CAPS_PATTERN.test(word)) {
    return false;
  }

  if (PROJECT_WORDS.includes(word)) {
    return false;
  }

  return true;
}

async function getSuggestions(word: string, dictionary: SpellChecker): Promise<string[]> {
  return dictionary
    .suggest(word)
    .filter((entry, index, collection) => collection.indexOf(entry) === index)
    .slice(0, 6);
}

export async function analyzeRemarkLint(text: string, ast: Root): Promise<PedagogicalWarning[]> {
  const file = new VFile({ path: 'document.md', value: text });
  await lintProcessor.run(structuredClone(ast), file);
  const lineStarts = buildLineStarts(text);

  return file.messages
    .map((message) => warningFromLintMessage(text, lineStarts, message))
    .filter((warning): warning is PedagogicalWarning => Boolean(warning))
    .slice(0, MAX_LINT_WARNINGS);
}

export async function analyzeSpelling(text: string, ast: Root): Promise<PedagogicalWarning[]> {
  const dictionary = await getSpanishDictionary();
  const warnings: PedagogicalWarning[] = [];
  const seen = new Set<string>();
  const lineStarts = buildLineStarts(text);

  visit(ast, 'text', (node: Text) => {
    if (warnings.length >= MAX_SPELL_WARNINGS || node.position?.start.offset === undefined) {
      return;
    }

    for (const match of node.value.matchAll(SPELLCHECK_WORD_PATTERN)) {
      const word = match[0];
      const relativeOffset = match.index ?? 0;
      const startOffset = node.position.start.offset + relativeOffset;
      const key = `${startOffset}:${word}`;

      if (seen.has(key) || !isSpellcheckCandidate(word)) {
        continue;
      }

      seen.add(key);

      if (dictionary.correct(word)) {
        continue;
      }
      const lineIndex = lineStarts.findLastIndex((value) => value <= startOffset);
      const startLine = Math.max(1, lineIndex + 1);
      const startColumn = startOffset - (lineStarts[lineIndex] ?? 0) + 1;

      warnings.push({
        id: `nspell:${startOffset}:${word.length}`,
        ruleId: 'orthography-nspell',
        severity: 'warning',
        category: 'orthography',
        source: 'nspell',
        message: `Posible error ortográfico: "${word}".`,
        line: startLine,
        column: startColumn,
        offset: startOffset,
        length: word.length,
        originalText: word,
      });

      if (warnings.length >= MAX_SPELL_WARNINGS) {
        return;
      }
    }
  });

  if (warnings.length > MAX_SPELL_SUGGESTIONS) {
    return warnings;
  }

  for (const warning of warnings) {
    const suggestions = await getSuggestions(warning.originalText, dictionary);
    const replacement = suggestions[0];

    warning.suggestions = suggestions;
    warning.suggestion = replacement;
    warning.replacementConfig = replacement
      ? {
          startOffset: warning.offset,
          endOffset: warning.offset + warning.length,
          newText: replacement,
        }
      : undefined;
  }

  return warnings;
}
