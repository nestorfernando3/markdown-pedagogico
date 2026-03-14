import type { Root, RootContent } from 'mdast';
import rehypeShiki from '@shikijs/rehype';
import { toc } from 'mdast-util-toc';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import rehypeSlug from 'rehype-slug';
import rehypeStringify from 'rehype-stringify';
import remarkDeflist from 'remark-deflist';
import remarkFrontmatter from 'remark-frontmatter';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';
import { analyzeRemarkLint, analyzeSpelling } from './markdownDiagnostics';
import {
  runPedagogicalRules,
  type PedagogicalCategory,
  type PedagogicalRule,
  type PedagogicalSeverity,
  type PedagogicalWarning,
  type RuleContext,
} from './pedagogicalRules';

export type {
  PedagogicalCategory,
  PedagogicalRule,
  PedagogicalSeverity,
  PedagogicalWarning,
  RuleContext,
};

export interface ParseResult {
  ast: Root;
  warnings: PedagogicalWarning[];
  html: string;
}

const HEADING_ID_PREFIX = 'user-content-';
const TOC_SKIP_PATTERN = 'contenido|tabla de contenido|toc';
const ALERT_VARIANTS = ['note', 'tip', 'important', 'warning', 'caution'] as const;
const SKIP_INLINE_FORMAT_TAGS = new Set(['code', 'pre', 'script', 'style']);
const EMOJI_SHORTCODE_MAP = {
  sparkles: '✨',
  warning: '⚠️',
  white_check_mark: '✅',
  heavy_check_mark: '✔️',
  x: '❌',
  bug: '🐛',
  fire: '🔥',
  rocket: '🚀',
  bulb: '💡',
  memo: '📝',
  book: '📖',
  pushpin: '📌',
  link: '🔗',
  tada: '🎉',
  question: '❓',
  exclamation: '❗',
  construction: '🚧',
  wrench: '🔧',
  hammer: '🔨',
  lock: '🔒',
  unlock: '🔓',
  seedling: '🌱',
  eyes: '👀',
  mag: '🔍',
  star: '⭐',
  stars: '🌟',
  zap: '⚡',
  gear: '⚙️',
  pencil2: '✏️',
  package: '📦',
} as const;
const SHIKI_LANGS = [
  'text',
  'plaintext',
  'md',
  'markdown',
  'js',
  'jsx',
  'ts',
  'tsx',
  'json',
  'bash',
  'sh',
  'zsh',
  'shell',
  'html',
  'css',
  'scss',
  'yaml',
  'yml',
  'toml',
  'rust',
  'python',
  'sql',
] as const;
const MARKDOWN_SANITIZE_SCHEMA = {
  ...defaultSchema,
  tagNames: [
    ...(defaultSchema.tagNames ?? []),
    'details',
    'summary',
    'u',
    'kbd',
    'video',
    'source',
    'dl',
    'dt',
    'dd',
    'blockquote',
    'mark',
    'sup',
    'sub',
  ],
  attributes: {
    ...defaultSchema.attributes,
    code: [
      ...(defaultSchema.attributes.code ?? []),
      ['className', /^language-./, 'math-inline', 'math-display'],
    ],
    div: [
      ...(defaultSchema.attributes.div ?? []),
      [
        'className',
        'math',
        'math-display',
        'markdown-alert',
        'markdown-alert-note',
        'markdown-alert-tip',
        'markdown-alert-important',
        'markdown-alert-warning',
        'markdown-alert-caution',
      ],
    ],
    p: [...(defaultSchema.attributes.p ?? []), ['className', 'markdown-alert-title']],
    span: [...(defaultSchema.attributes.span ?? []), ['className', 'math', 'math-inline']],
    details: [...(defaultSchema.attributes.details ?? []), 'open'],
    video: [...(defaultSchema.attributes.video ?? []), 'controls', 'src', 'poster'],
    source: [...(defaultSchema.attributes.source ?? []), 'src', 'type'],
  },
  protocols: {
    ...defaultSchema.protocols,
    href: ['http', 'https', 'mailto'],
    src: ['http', 'https', 'data'],
  },
} as const;

interface HastElementNode {
  type: 'element';
  tagName: string;
  properties?: Record<string, unknown>;
  children: Array<HastElementNode | HastTextNode>;
}

interface HastTextNode {
  type: 'text';
  value: string;
}

type HastNode = HastElementNode | HastTextNode;

interface HastParentNode {
  children: HastNode[];
}

const EMOJI_SHORTCODE_PATTERN = new RegExp(
  `:(${Object.keys(EMOJI_SHORTCODE_MAP)
    .map((entry) => entry.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'))
    .join('|')}):`,
  'gu'
);

function classNames(node: HastElementNode): string[] {
  const value = node.properties?.className ?? node.properties?.class;
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === 'string');
  }
  if (typeof value === 'string') {
    return value.split(/\s+/u).filter(Boolean);
  }
  return [];
}

function firstTextValue(node: HastElementNode): string {
  return node.children
    .filter((child): child is HastTextNode => child.type === 'text')
    .map((child) => child.value)
    .join('');
}

function isFrontmatterNode(node: RootContent): boolean {
  return node.type === 'yaml' || node.type === 'toml';
}

function isTocPlaceholder(node: RootContent): boolean {
  if (node.type !== 'paragraph' || node.children.length !== 1) {
    return false;
  }

  const child = node.children[0];
  return child.type === 'text' && child.value.trim().toUpperCase() === '[TOC]';
}

function replaceTocPlaceholders(tree: Root): void {
  const placeholderIndexes: number[] = [];

  tree.children.forEach((node, index) => {
    if (isTocPlaceholder(node)) {
      placeholderIndexes.push(index);
    }
  });

  if (placeholderIndexes.length === 0) {
    return;
  }

  const hasTopLevelTitle = tree.children.some((node) => node.type === 'heading' && node.depth === 1);
  const generatedToc = toc(tree, {
    minDepth: hasTopLevelTitle ? 2 : 1,
    ordered: false,
    prefix: HEADING_ID_PREFIX,
    skip: TOC_SKIP_PATTERN,
    tight: true,
  }).map;

  for (const index of placeholderIndexes.reverse()) {
    if (!generatedToc) {
      tree.children.splice(index, 1);
      continue;
    }

    tree.children.splice(index, 1, structuredClone(generatedToc));
  }
}

function remarkExtendedMarkdown() {
  return (tree: Root) => {
    tree.children = tree.children.filter((node) => !isFrontmatterNode(node));
    replaceTocPlaceholders(tree);
  };
}

function replaceEmojiShortcodes(text: string): string {
  return text.replace(EMOJI_SHORTCODE_PATTERN, (match, shortcode: keyof typeof EMOJI_SHORTCODE_MAP) => {
    return EMOJI_SHORTCODE_MAP[shortcode] ?? match;
  });
}

function isElementNode(node: HastNode | undefined): node is HastElementNode {
  return Boolean(node && node.type === 'element');
}

function isTextNode(node: HastNode | undefined): node is HastTextNode {
  return Boolean(node && node.type === 'text');
}

function isParentNode(node: unknown): node is HastParentNode {
  return typeof node === 'object' && node !== null && 'children' in node && Array.isArray((node as HastParentNode).children);
}

function isAlertVariant(value: string): value is (typeof ALERT_VARIANTS)[number] {
  return ALERT_VARIANTS.includes(value as (typeof ALERT_VARIANTS)[number]);
}

function isEmptyText(node: HastNode): boolean {
  return node.type === 'text' && node.value.trim().length === 0;
}

function isEmptyParagraph(node: HastNode): boolean {
  return node.type === 'element' && node.tagName === 'p' && node.children.every(isEmptyText);
}

function stripLeadingText(paragraph: HastElementNode, prefixLength: number): void {
  const firstChild = paragraph.children[0];
  if (!isTextNode(firstChild)) {
    return;
  }

  firstChild.value = firstChild.value.slice(prefixLength);
  if (firstChild.value.length === 0) {
    paragraph.children.shift();
  }
}

function findClosingToken(value: string, start: number, token: '==' | '^' | '~'): number {
  for (let index = start; index <= value.length - token.length; index += 1) {
    if (!value.startsWith(token, index)) {
      continue;
    }

    if (token === '~' && (value[index - 1] === '~' || value[index + 1] === '~')) {
      continue;
    }

    return index;
  }

  return -1;
}

function tokenizeInlineFormats(value: string): HastNode[] {
  const tokens: HastNode[] = [];
  let buffer = '';
  let cursor = 0;

  const flushBuffer = () => {
    if (buffer.length === 0) {
      return;
    }

    tokens.push({
      type: 'text',
      value: buffer,
    });
    buffer = '';
  };

  while (cursor < value.length) {
    if (value.startsWith('==', cursor)) {
      const closingIndex = findClosingToken(value, cursor + 2, '==');
      if (closingIndex !== -1) {
        const content = value.slice(cursor + 2, closingIndex);
        if (content.trim().length > 0 && !content.includes('\n')) {
          flushBuffer();
          tokens.push({
            type: 'element',
            tagName: 'mark',
            properties: {},
            children: tokenizeInlineFormats(content),
          });
          cursor = closingIndex + 2;
          continue;
        }
      }
    }

    if (value[cursor] === '^') {
      const closingIndex = findClosingToken(value, cursor + 1, '^');
      if (closingIndex !== -1) {
        const content = value.slice(cursor + 1, closingIndex);
        if (content.trim().length > 0 && !content.includes('\n')) {
          flushBuffer();
          tokens.push({
            type: 'element',
            tagName: 'sup',
            properties: {},
            children: tokenizeInlineFormats(content),
          });
          cursor = closingIndex + 1;
          continue;
        }
      }
    }

    if (value[cursor] === '~' && value[cursor + 1] !== '~') {
      const closingIndex = findClosingToken(value, cursor + 1, '~');
      if (closingIndex !== -1) {
        const content = value.slice(cursor + 1, closingIndex);
        if (content.trim().length > 0 && !content.includes('\n')) {
          flushBuffer();
          tokens.push({
            type: 'element',
            tagName: 'sub',
            properties: {},
            children: tokenizeInlineFormats(content),
          });
          cursor = closingIndex + 1;
          continue;
        }
      }
    }

    buffer += value[cursor];
    cursor += 1;
  }

  flushBuffer();
  return tokens;
}

function enhanceInlineFormats(node: HastElementNode): void {
  if (SKIP_INLINE_FORMAT_TAGS.has(node.tagName)) {
    return;
  }

  node.children = node.children.flatMap((child) => {
    if (isTextNode(child)) {
      return tokenizeInlineFormats(child.value);
    }

    enhanceInlineFormats(child);
    return [child];
  });
}

function rehypeInlineMarkdownEnhancements() {
  return (tree: unknown) => {
    if (!isParentNode(tree)) {
      return;
    }

    tree.children.forEach((child) => {
      if (isElementNode(child)) {
        enhanceInlineFormats(child);
      }
    });
  };
}

function rehypeAdmonitions() {
  return (tree: unknown) => {
    visit(tree, 'element', (node, index, parent) => {
      if (typeof index !== 'number' || !isParentNode(parent)) {
        return;
      }

      const blockquote = node as HastElementNode;
      if (blockquote.tagName !== 'blockquote') {
        return;
      }

      const firstParagraph = blockquote.children.find(isElementNode);
      if (!firstParagraph || firstParagraph.tagName !== 'p' || !isTextNode(firstParagraph.children[0])) {
        return;
      }

      const markerText = firstParagraph.children[0].value;
      const match = markerText.match(/^\s*\[!([A-Z]+)(?:\/([^\]]+))?\]\s*/);
      if (!match) {
        return;
      }

      const variant = match[1].toLowerCase();
      if (!isAlertVariant(variant)) {
        return;
      }

      const title = match[2]?.trim() || match[1];
      stripLeadingText(firstParagraph, match[0].length);

      const contentChildren = blockquote.children.filter((child) => !isEmptyParagraph(child));

      parent.children[index] = {
        type: 'element',
        tagName: 'div',
        properties: {
          className: ['markdown-alert', `markdown-alert-${variant}`],
        },
        children: [
          {
            type: 'element',
            tagName: 'p',
            properties: {
              className: ['markdown-alert-title'],
            },
            children: [
              {
                type: 'text',
                value: title,
              },
            ],
          },
          ...contentChildren,
        ],
      };
    });
  };
}

function rehypeMermaidBlocks() {
  return (tree: unknown) => {
    visit(tree, 'element', (node, index, parent) => {
      if (typeof index !== 'number' || !parent || typeof parent !== 'object' || parent === null || !('children' in parent)) {
        return;
      }

      const preNode = node as HastElementNode;
      if (preNode.tagName !== 'pre' || preNode.children.length !== 1) {
        return;
      }

      const codeNode = preNode.children[0];
      if (codeNode.type !== 'element' || codeNode.tagName !== 'code') {
        return;
      }

      if (!classNames(codeNode).includes('language-mermaid')) {
        return;
      }

      const source = firstTextValue(codeNode).trim();
      if (source.length === 0) {
        return;
      }

      const children = (parent as { children: unknown[] }).children;
      children[index] = {
        type: 'element',
        tagName: 'div',
        properties: {
          className: ['mermaid'],
          'data-mermaid-source': source,
        },
        children: [
          {
            type: 'text',
            value: source,
          },
        ],
      };
    });
  };
}

function extractCodeLanguage(node: HastElementNode): string | null {
  const codeNode = node.children.find(isElementNode);
  if (!codeNode || codeNode.tagName !== 'code') {
    return null;
  }

  const languageClass = classNames(codeNode).find((value) => value.startsWith('language-'));
  if (!languageClass) {
    return null;
  }

  return languageClass.replace(/^language-/u, '');
}

function rehypeCodeBlockMetadata() {
  return (tree: unknown) => {
    visit(tree, 'element', (node) => {
      const preNode = node as HastElementNode;
      if (preNode.tagName !== 'pre') {
        return;
      }

      const language = extractCodeLanguage(preNode) ?? 'text';
      preNode.properties = {
        ...(preNode.properties ?? {}),
        'data-code-block': 'true',
        'data-language': language,
      };
    });
  };
}

const markdownAnalysisParser = unified()
  .use(remarkParse)
  .use(remarkFrontmatter, ['yaml', 'toml'])
  .use(remarkGfm, { singleTilde: false })
  .use(remarkDeflist)
  .use(remarkMath);

const htmlProcessor = unified()
  .use(remarkParse)
  .use(remarkFrontmatter, ['yaml', 'toml'])
  .use(remarkGfm, { singleTilde: false })
  .use(remarkDeflist)
  .use(remarkMath)
  .use(remarkExtendedMarkdown)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeRaw)
  .use(rehypeAdmonitions)
  .use(rehypeSanitize, MARKDOWN_SANITIZE_SCHEMA)
  .use(rehypeInlineMarkdownEnhancements)
  .use(rehypeMermaidBlocks)
  .use(rehypeShiki, {
    themes: {
      light: 'github-light',
      dark: 'github-dark',
    },
    langs: [...SHIKI_LANGS],
    addLanguageClass: true,
    defaultLanguage: 'text',
  })
  .use(rehypeCodeBlockMetadata)
  .use(rehypeKatex)
  .use(rehypeSlug, { prefix: HEADING_ID_PREFIX })
  .use(rehypeStringify);

export function analyzePedagogical(text: string): Pick<ParseResult, 'ast' | 'warnings'> {
  const ast = markdownAnalysisParser.parse(text) as Root;
  const context: RuleContext = {
    fullText: text,
    ast,
  };

  const warnings = runPedagogicalRules(context);
  return { ast, warnings };
}

export async function renderMarkdownHtml(text: string): Promise<string> {
  const vfile = await htmlProcessor.process(replaceEmojiShortcodes(text));
  return String(vfile);
}

export async function parseMarkdown(text: string): Promise<ParseResult> {
  const analysis = analyzePedagogical(text);
  const [html, lintWarnings, spellingWarnings] = await Promise.all([
    renderMarkdownHtml(text),
    analyzeRemarkLint(text, analysis.ast),
    analyzeSpelling(text, analysis.ast),
  ]);

  const warnings = [...analysis.warnings, ...lintWarnings, ...spellingWarnings].sort((left, right) => {
    if (left.offset !== right.offset) {
      return left.offset - right.offset;
    }

    return left.ruleId.localeCompare(right.ruleId);
  });

  return {
    ast: analysis.ast,
    warnings,
    html,
  };
}
