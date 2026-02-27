import type { Root } from 'mdast';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';
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

export function analyzePedagogical(text: string): Pick<ParseResult, 'ast' | 'warnings'> {
  const ast = unified().use(remarkParse).parse(text) as Root;
  const context: RuleContext = {
    fullText: text,
    ast,
  };

  const warnings = runPedagogicalRules(context);
  return { ast, warnings };
}

export async function renderMarkdownHtml(text: string): Promise<string> {
  const htmlProcessor = unified()
    .use(remarkParse)
    .use(remarkRehype)
    .use(rehypeSanitize, {
      ...defaultSchema,
      protocols: {
        ...defaultSchema.protocols,
        href: ['http', 'https', 'mailto'],
      },
    })
    .use(rehypeStringify);

  const vfile = await htmlProcessor.process(text);
  return String(vfile);
}

export async function parseMarkdown(text: string): Promise<ParseResult> {
  const analysis = analyzePedagogical(text);
  const html = await renderMarkdownHtml(text);
  return {
    ...analysis,
    html,
  };
}
