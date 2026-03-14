import type { Root } from 'mdast';
import { visit } from 'unist-util-visit';
import { countDocumentWords, type PedagogicalWarning } from './pedagogicalRules';

export interface TrainingSignals {
  hasH1: boolean;
  hasParagraph: boolean;
  hasEmphasis: boolean;
  hasList: boolean;
  hasLink: boolean;
  hasQuote: boolean;
  hasImage: boolean;
  hasCodeFence: boolean;
  hasCodeLanguage: boolean;
  hasTable: boolean;
  hasFootnote: boolean;
  hasToc: boolean;
  hasEmojiShortcode: boolean;
  hasAdmonition: boolean;
  hasMermaid: boolean;
  hasMath: boolean;
  headingCount: number;
  headingDepth: number;
  wordCount: number;
  warningCount: number;
  isTechnicalDocument: boolean;
}

export function buildTrainingSignals(
  content: string,
  ast: Root | null,
  warnings: PedagogicalWarning[]
): TrainingSignals {
  let headingCount = 0;
  let headingDepth = 0;
  let hasH1 = false;
  let hasParagraph = false;
  let hasEmphasis = false;
  let hasList = false;
  let hasLink = false;
  let hasQuote = false;
  let hasImage = false;
  let hasCodeFence = false;
  let hasCodeLanguage = false;
  let hasTable = false;
  let hasFootnote = false;
  let hasMath = false;

  if (ast) {
    visit(ast, (node) => {
      if (node.type === 'heading') {
        headingCount += 1;
        headingDepth = Math.max(headingDepth, node.depth);
        if (node.depth === 1) {
          hasH1 = true;
        }
      }

      if (node.type === 'paragraph') {
        hasParagraph = true;
      }

      if (node.type === 'emphasis' || node.type === 'strong') {
        hasEmphasis = true;
      }

      if (node.type === 'list') {
        hasList = true;
      }

      if (node.type === 'link') {
        hasLink = true;
      }

      if (node.type === 'blockquote') {
        hasQuote = true;
      }

      if (node.type === 'image') {
        hasImage = true;
      }

      if (node.type === 'code') {
        hasCodeFence = true;
        if (typeof node.lang === 'string' && node.lang.trim().length > 0) {
          hasCodeLanguage = true;
        }
      }

      if (node.type === 'table') {
        hasTable = true;
      }

      if (node.type === 'footnoteDefinition' || node.type === 'footnoteReference') {
        hasFootnote = true;
      }

      if (node.type === 'math' || node.type === 'inlineMath') {
        hasMath = true;
      }
    });
  }

  const hasToc = /\[TOC\]/iu.test(content);
  const hasEmojiShortcode = /:[a-z0-9_+-]+:/iu.test(content);
  const hasAdmonition = /^\s*>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/imu.test(content);
  const hasMermaid = /```mermaid[\s\S]*?```/iu.test(content);
  const wordCount = countDocumentWords(content);

  return {
    hasH1,
    hasParagraph,
    hasEmphasis,
    hasList,
    hasLink,
    hasQuote,
    hasImage,
    hasCodeFence,
    hasCodeLanguage,
    hasTable,
    hasFootnote,
    hasToc,
    hasEmojiShortcode,
    hasAdmonition,
    hasMermaid,
    hasMath,
    headingCount,
    headingDepth,
    wordCount,
    warningCount: warnings.length,
    isTechnicalDocument: hasCodeFence || hasMath || hasMermaid,
  };
}
