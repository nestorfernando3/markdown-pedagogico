import type { Content, Heading, List, Paragraph, Root, Text } from 'mdast';
import type { Point } from 'unist';
import { visit } from 'unist-util-visit';

export type PedagogicalSeverity = 'info' | 'warning' | 'error';
export type PedagogicalCategory = 'structure' | 'style' | 'clarity' | 'syntax' | 'orthography';
export type WarningSource = 'pedagogical' | 'remark-lint' | 'nspell';

export interface PedagogicalWarning {
  id: string;
  ruleId: string;
  severity: PedagogicalSeverity;
  category: PedagogicalCategory;
  source?: WarningSource;
  message: string;
  suggestion?: string;
  suggestions?: string[];
  line: number;
  column: number;
  offset: number;
  length: number;
  originalText: string;
  replacementConfig?: {
    startOffset: number;
    endOffset: number;
    newText: string;
  };
}

export interface RuleContext {
  fullText: string;
  ast: Root;
}

export interface PedagogicalRule {
  id: string;
  category: PedagogicalCategory;
  severity: PedagogicalSeverity;
  match: (ctx: RuleContext) => PedagogicalWarning[];
}

type WarningDraft = {
  startOffset: number;
  endOffset: number;
  message: string;
  suggestion?: string;
  replacementConfig?: {
    startOffset: number;
    endOffset: number;
    newText: string;
  };
};

const MAX_WARNINGS = 120;
const STOP_WORDS = new Set([
  'ante',
  'bajo',
  'cabe',
  'como',
  'con',
  'contra',
  'cual',
  'cuando',
  'desde',
  'donde',
  'el',
  'ella',
  'ellas',
  'ellos',
  'entre',
  'era',
  'eran',
  'es',
  'esa',
  'esas',
  'ese',
  'esos',
  'esta',
  'estas',
  'este',
  'estos',
  'fue',
  'fueron',
  'ha',
  'han',
  'hacia',
  'hasta',
  'la',
  'las',
  'lo',
  'los',
  'para',
  'pero',
  'por',
  'que',
  'se',
  'segun',
  'sin',
  'sobre',
  'su',
  'sus',
  'un',
  'una',
  'unas',
  'uno',
  'unos',
  'y',
]);

function buildLineStarts(text: string): number[] {
  const starts = [0];
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === '\n') {
      starts.push(index + 1);
    }
  }
  return starts;
}

function lowerBound(values: number[], target: number): number {
  let low = 0;
  let high = values.length;

  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (values[middle] <= target) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }

  return Math.max(0, low - 1);
}

function pointFromOffset(text: string, lineStarts: number[], offset: number): Point {
  const safeOffset = Math.max(0, Math.min(offset, text.length));
  const lineIndex = lowerBound(lineStarts, safeOffset);
  return {
    line: lineIndex + 1,
    column: safeOffset - lineStarts[lineIndex] + 1,
    offset: safeOffset,
  };
}

function nodeText(node: Content | Root): string {
  if ('value' in node && typeof node.value === 'string') {
    return node.value;
  }

  if ('children' in node && Array.isArray(node.children)) {
    return node.children.map((child) => nodeText(child)).join('');
  }

  return '';
}

function normalizeWord(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function extractRelevantWords(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .match(/[a-z\u00f1]{4,}/giu)
    ?.map((word) => word.trim())
    .filter((word) => word.length >= 4 && !STOP_WORDS.has(word)) ?? [];
}

function countWords(text: string): number {
  return text.trim().match(/[\p{L}\p{N}]+/gu)?.length ?? 0;
}

function createWarning(
  ctx: RuleContext,
  rule: Pick<PedagogicalRule, 'id' | 'category' | 'severity'>,
  draft: WarningDraft
): PedagogicalWarning {
  const startOffset = Math.max(0, Math.min(draft.startOffset, ctx.fullText.length));
  const rawEndOffset = Math.max(startOffset + 1, draft.endOffset);
  const endOffset = Math.max(startOffset + 1, Math.min(rawEndOffset, ctx.fullText.length));
  const lineStarts = buildLineStarts(ctx.fullText);
  const point = pointFromOffset(ctx.fullText, lineStarts, startOffset);
  const length = endOffset - startOffset;

  return {
    id: `${rule.id}:${startOffset}:${length}`,
    ruleId: rule.id,
    severity: rule.severity,
    category: rule.category,
    source: 'pedagogical',
    message: draft.message,
    suggestion: draft.suggestion,
    line: point.line,
    column: point.column,
    offset: startOffset,
    length,
    originalText: ctx.fullText.slice(startOffset, endOffset),
    replacementConfig: draft.replacementConfig,
  };
}

function paragraphNodes(ast: Root): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  visit(ast, 'paragraph', (node) => {
    paragraphs.push(node);
  });
  return paragraphs;
}

function headingNodes(ast: Root): Heading[] {
  const headings: Heading[] = [];
  visit(ast, 'heading', (node) => {
    headings.push(node);
  });
  return headings;
}

function listNodes(ast: Root): List[] {
  const lists: List[] = [];
  visit(ast, 'list', (node) => {
    lists.push(node);
  });
  return lists;
}

const ruleHeaderMissingSpace: PedagogicalRule = {
  id: 'syntax-header-missing-space',
  category: 'syntax',
  severity: 'error',
  match: (ctx) => {
    const warnings: PedagogicalWarning[] = [];

    visit(ctx.ast, 'text', (node: Text, index, parent) => {
      if (parent?.type !== 'paragraph' || index !== 0 || node.position?.start.offset === undefined) {
        return;
      }

      const match = node.value.match(/^(#{1,6})([^\s#].*)/u);
      if (!match) {
        return;
      }

      const startOffset = node.position.start.offset;
      const endOffset = startOffset + match[0].length;
      const suggestion = `${match[1]} ${match[2]}`;

      warnings.push(
        createWarning(ctx, ruleHeaderMissingSpace, {
          startOffset,
          endOffset,
          message: 'Añade un espacio después de los símbolos de encabezado (#).',
          suggestion,
          replacementConfig: {
            startOffset,
            endOffset,
            newText: suggestion,
          },
        })
      );
    });

    return warnings;
  },
};

const ruleListMissingSpace: PedagogicalRule = {
  id: 'syntax-list-missing-space',
  category: 'syntax',
  severity: 'error',
  match: (ctx) => {
    const warnings: PedagogicalWarning[] = [];

    visit(ctx.ast, 'text', (node: Text, index, parent) => {
      if (parent?.type !== 'paragraph' || index !== 0 || node.position?.start.offset === undefined) {
        return;
      }

      const match = node.value.match(/^([-*+])(\S.*)/u);
      if (!match) {
        return;
      }

      const startOffset = node.position.start.offset;
      const endOffset = startOffset + match[0].length;
      const suggestion = `${match[1]} ${match[2]}`;

      warnings.push(
        createWarning(ctx, ruleListMissingSpace, {
          startOffset,
          endOffset,
          message: 'Las listas requieren un espacio después del marcador (-, * o +).',
          suggestion,
          replacementConfig: {
            startOffset,
            endOffset,
            newText: suggestion,
          },
        })
      );
    });

    return warnings;
  },
};

const ruleHeadingHierarchy: PedagogicalRule = {
  id: 'structure-heading-hierarchy',
  category: 'structure',
  severity: 'warning',
  match: (ctx) => {
    const warnings: PedagogicalWarning[] = [];
    let previousDepth = 0;

    for (const heading of headingNodes(ctx.ast)) {
      if (heading.position?.start.offset === undefined || heading.position.end.offset === undefined) {
        previousDepth = heading.depth;
        continue;
      }

      if (previousDepth > 0 && heading.depth > previousDepth + 1) {
        warnings.push(
          createWarning(ctx, ruleHeadingHierarchy, {
            startOffset: heading.position.start.offset,
            endOffset: heading.position.end.offset,
            message: `Has saltado de H${previousDepth} a H${heading.depth}. Mantener la jerarquía mejora la estructura del documento.`,
          })
        );
      }

      previousDepth = heading.depth;
    }

    return warnings;
  },
};

const ruleDenseParagraph: PedagogicalRule = {
  id: 'structure-dense-paragraph',
  category: 'structure',
  severity: 'warning',
  match: (ctx) => {
    const warnings: PedagogicalWarning[] = [];

    for (const paragraph of paragraphNodes(ctx.ast)) {
      if (paragraph.position?.start.offset === undefined || paragraph.position.end.offset === undefined) {
        continue;
      }

      const text = nodeText(paragraph);
      const words = countWords(text);
      if (words <= 80) {
        continue;
      }

      warnings.push(
        createWarning(ctx, ruleDenseParagraph, {
          startOffset: paragraph.position.start.offset,
          endOffset: paragraph.position.end.offset,
          message: `Este párrafo tiene ${words} palabras. Considera dividirlo para mejorar la legibilidad.`,
        })
      );
    }

    return warnings;
  },
};

const ABSOLUTE_CLAIMS = /\b(siempre|nunca|todo|todos|toda|todas|nada|absolutamente)\b/giu;
const PERSUASIVE_CLICHES = /\b(el\s+mejor\s+del\s+mercado|la\s+[uú]nica\s+soluci(?:ó|o)n|como\s+por\s+arte\s+de\s+magia)\b/giu;

function matchPatternWarnings(
  ctx: RuleContext,
  rule: Pick<PedagogicalRule, 'id' | 'category' | 'severity'>,
  regex: RegExp,
  message: string
): PedagogicalWarning[] {
  const warnings: PedagogicalWarning[] = [];

  for (const match of ctx.fullText.matchAll(regex)) {
    const matchText = match[0];
    const index = match.index ?? 0;
    warnings.push(
      createWarning(ctx, rule, {
        startOffset: index,
        endOffset: index + matchText.length,
        message,
      })
    );
  }

  return warnings;
}

const ruleAbsoluteClaims: PedagogicalRule = {
  id: 'clarity-absolute-claims',
  category: 'clarity',
  severity: 'info',
  match: (ctx) =>
    matchPatternWarnings(
      ctx,
      ruleAbsoluteClaims,
      ABSOLUTE_CLAIMS,
      'Evita afirmaciones absolutas. Matizar el argumento suele hacerlo más sólido.'
    ),
};

const rulePersuasiveCliches: PedagogicalRule = {
  id: 'style-persuasive-cliches',
  category: 'style',
  severity: 'info',
  match: (ctx) =>
    matchPatternWarnings(
      ctx,
      rulePersuasiveCliches,
      PERSUASIVE_CLICHES,
      'Esta frase suena a cliché retórico. Sustituirla por evidencia mejora la credibilidad.'
    ),
};

const ruleLongSentences: PedagogicalRule = {
  id: 'clarity-long-sentences',
  category: 'clarity',
  severity: 'warning',
  match: (ctx) => {
    const warnings: PedagogicalWarning[] = [];

    for (const paragraph of paragraphNodes(ctx.ast)) {
      if (paragraph.position?.start.offset === undefined) {
        continue;
      }

      const paragraphText = nodeText(paragraph);
      const sentenceMatches = paragraphText.matchAll(/[^.!?]+[.!?]?/g);

      for (const sentenceMatch of sentenceMatches) {
        const sentenceText = sentenceMatch[0].trim();
        if (sentenceText.length === 0) {
          continue;
        }

        const wordCount = countWords(sentenceText);
        if (wordCount <= 40) {
          continue;
        }

        const sentenceStart = paragraph.position.start.offset + (sentenceMatch.index ?? 0);
        warnings.push(
          createWarning(ctx, ruleLongSentences, {
            startOffset: sentenceStart,
            endOffset: sentenceStart + sentenceMatch[0].length,
            message: `Oración muy extensa (${wordCount} palabras). Dividirla mejora la claridad.`,
          })
        );
      }
    }

    return warnings;
  },
};

const PASSIVE_VOICE =
  /\b(?:es|son|fue|fueron|era|eran|sera|serán|seran|ha\s+sido|han\s+sido|habia\s+sido|habian\s+sido)\s+[\p{L}]+(?:ado|ada|ados|adas|ido|ida|idos|idas)\b/giu;

const rulePassiveVoice: PedagogicalRule = {
  id: 'style-passive-voice',
  category: 'style',
  severity: 'warning',
  match: (ctx) =>
    matchPatternWarnings(
      ctx,
      rulePassiveVoice,
      PASSIVE_VOICE,
      'Posible voz pasiva detectada. Considera reformular en voz activa para mayor claridad.'
    ),
};

const ruleLexicalRepetition: PedagogicalRule = {
  id: 'style-lexical-repetition',
  category: 'style',
  severity: 'info',
  match: (ctx) => {
    const warnings: PedagogicalWarning[] = [];
    const paragraphs = paragraphNodes(ctx.ast)
      .filter((paragraph) => paragraph.position?.start.offset !== undefined)
      .map((paragraph) => ({
        paragraph,
        words: extractRelevantWords(nodeText(paragraph)),
      }));

    for (let index = 1; index < paragraphs.length; index += 1) {
      const previous = paragraphs[index - 1];
      const current = paragraphs[index];
      if (current.paragraph.position?.start.offset === undefined || current.words.length === 0) {
        continue;
      }

      const previousSet = new Set(previous.words);
      const repeated = current.words.filter((word) => previousSet.has(word));
      const uniqueRepeated = Array.from(new Set(repeated));

      if (uniqueRepeated.length < 2) {
        continue;
      }

      warnings.push(
        createWarning(ctx, ruleLexicalRepetition, {
          startOffset: current.paragraph.position.start.offset,
          endOffset: current.paragraph.position.end.offset ?? current.paragraph.position.start.offset + 1,
          message: `Se repiten términos clave entre párrafos consecutivos (${uniqueRepeated.slice(0, 3).join(', ')}).`,
        })
      );
    }

    return warnings;
  },
};

const CONCLUSION_PATTERN = /\b(conclusion(?:es)?|resumen|cierre|consideraciones\s+finales)\b/u;

const ruleMissingConclusion: PedagogicalRule = {
  id: 'structure-missing-conclusion',
  category: 'structure',
  severity: 'warning',
  match: (ctx) => {
    const totalWords = countWords(ctx.fullText);
    if (totalWords <= 500) {
      return [];
    }

    const hasConclusionHeading = headingNodes(ctx.ast).some((heading) =>
      CONCLUSION_PATTERN.test(normalizeWord(nodeText(heading)))
    );
    if (hasConclusionHeading) {
      return [];
    }

    const offset = Math.max(0, ctx.fullText.length - 1);
    return [
      createWarning(ctx, ruleMissingConclusion, {
        startOffset: offset,
        endOffset: offset + 1,
        message: 'El documento supera 500 palabras y no se detecta un encabezado de cierre (Conclusión/Resumen).',
      }),
    ];
  },
};

const ruleOrphanList: PedagogicalRule = {
  id: 'structure-orphan-list',
  category: 'structure',
  severity: 'warning',
  match: (ctx) => {
    const warnings: PedagogicalWarning[] = [];

    visit(ctx.ast, (node, index, parent) => {
      if (node.type !== 'list' || typeof index !== 'number' || !parent || node.position?.start.offset === undefined) {
        return;
      }

      const previousSibling = parent.children[index - 1];
      const hasIntroParagraph = previousSibling?.type === 'paragraph' && countWords(nodeText(previousSibling)) >= 4;

      if (!hasIntroParagraph) {
        warnings.push(
          createWarning(ctx, ruleOrphanList, {
            startOffset: node.position.start.offset,
            endOffset: node.position.end?.offset ?? node.position.start.offset + 1,
            message: 'La lista aparece sin contexto introductorio inmediato. Añade una frase de apertura.',
          })
        );
      }
    });

    return warnings;
  },
};

const ruleOrphanHeading: PedagogicalRule = {
  id: 'structure-orphan-heading',
  category: 'structure',
  severity: 'warning',
  match: (ctx) => {
    const warnings: PedagogicalWarning[] = [];
    const bridgeParagraph = '\n\nDesarrolla esta idea antes del siguiente título.\n\n';

    visit(ctx.ast, (node, index, parent) => {
      if (node.type !== 'heading' || typeof index !== 'number' || !parent || node.position?.start.offset === undefined) {
        return;
      }

      const nextSibling = parent.children[index + 1];
      if (nextSibling?.type !== 'heading') {
        return;
      }

      warnings.push(
        createWarning(ctx, ruleOrphanHeading, {
          startOffset: node.position.start.offset,
          endOffset: node.position.end?.offset ?? node.position.start.offset + 1,
          message: 'Encabezado sin contenido intermedio. Agrega desarrollo antes del siguiente título.',
          suggestion: 'Inserta un párrafo breve entre ambos encabezados para dar contexto.',
          replacementConfig: {
            startOffset: node.position.end?.offset ?? node.position.start.offset + 1,
            endOffset: nextSibling.position?.start.offset ?? node.position.end?.offset ?? node.position.start.offset + 1,
            newText: bridgeParagraph,
          },
        })
      );
    });

    return warnings;
  },
};

const ruleOnboarding: PedagogicalRule = {
  id: 'clarity-onboarding',
  category: 'clarity',
  severity: 'info',
  match: (ctx) => {
    const totalWords = countWords(ctx.fullText);
    const hasMarkdownTokens = /[#*\-]/.test(ctx.fullText);

    if (totalWords < 5 && totalWords > 0 && !hasMarkdownTokens) {
      return [
        createWarning(ctx, ruleOnboarding, {
          startOffset: 0,
          endOffset: Math.max(1, ctx.fullText.length),
          message: 'Puedes empezar con un título principal usando # para estructurar el documento.',
          suggestion: `# ${ctx.fullText}`,
          replacementConfig: {
            startOffset: 0,
            endOffset: ctx.fullText.length,
            newText: `# ${ctx.fullText}`,
          },
        }),
      ];
    }

    return [];
  },
};

export const PEDAGOGICAL_RULES: PedagogicalRule[] = [
  ruleHeaderMissingSpace,
  ruleListMissingSpace,
  ruleHeadingHierarchy,
  ruleDenseParagraph,
  ruleAbsoluteClaims,
  rulePersuasiveCliches,
  ruleLongSentences,
  rulePassiveVoice,
  ruleLexicalRepetition,
  ruleMissingConclusion,
  ruleOrphanList,
  ruleOrphanHeading,
  ruleOnboarding,
];

export function runPedagogicalRules(ctx: RuleContext): PedagogicalWarning[] {
  const warnings: PedagogicalWarning[] = [];
  const seenIds = new Set<string>();

  for (const rule of PEDAGOGICAL_RULES) {
    const matches = rule.match(ctx);
    for (const warning of matches) {
      if (warnings.length >= MAX_WARNINGS) {
        return warnings;
      }
      if (seenIds.has(warning.id)) {
        continue;
      }
      seenIds.add(warning.id);
      warnings.push(warning);
    }
  }

  warnings.sort((left, right) => {
    if (left.offset === right.offset) {
      return right.length - left.length;
    }
    return left.offset - right.offset;
  });

  return warnings;
}

export interface DiagnosticSnapshot {
  headingCount: number;
  paragraphCount: number;
  listCount: number;
  emphasisCount: number;
}

export function buildDiagnosticSnapshot(ast: Root): DiagnosticSnapshot {
  return {
    headingCount: headingNodes(ast).length,
    paragraphCount: paragraphNodes(ast).length,
    listCount: listNodes(ast).length,
    emphasisCount: (() => {
      let count = 0;
      visit(ast, (node) => {
        if (node.type === 'strong' || node.type === 'emphasis') {
          count += 1;
        }
      });
      return count;
    })(),
  };
}

export function estimateFernandezHuerta(text: string): number {
  const words = countWords(text);
  const sentences = Math.max(1, text.match(/[.!?]+/g)?.length ?? 1);

  if (words === 0) {
    return 100;
  }

  const syllables = (text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .match(/[aeiou]+/g) ?? []).length;

  const syllablesPerHundredWords = (syllables * 100) / words;
  const sentencesPerHundredWords = (sentences * 100) / words;
  const score = 206.84 - 0.6 * syllablesPerHundredWords - 1.02 * sentencesPerHundredWords;

  return Math.max(0, Math.min(100, Number(score.toFixed(2))));
}

export function countDocumentWords(text: string): number {
  return countWords(text);
}

export function normalizeLexeme(value: string): string {
  return normalizeWord(value);
}
