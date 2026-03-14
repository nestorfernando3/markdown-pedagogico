import { describe, expect, it } from 'vitest';
import remarkDeflist from 'remark-deflist';
import remarkFrontmatter from 'remark-frontmatter';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { buildTrainingSignals } from '../trainingMode';
import { resolveCurrentTrainingStep, resolveObservedCompletedSteps, resolveVisibleTrainingSteps } from '../../hooks/editor/useTrainingMode';

function parseAst(markdown: string) {
  return unified()
    .use(remarkParse)
    .use(remarkFrontmatter, ['yaml', 'toml'])
    .use(remarkGfm, { singleTilde: false })
    .use(remarkDeflist)
    .use(remarkMath)
    .parse(markdown);
}

describe('training mode signals', () => {
  it('detects the main markdown building blocks from the existing AST', () => {
    const markdown = `# Documento

Parrafo con **énfasis** y un [enlace](https://example.com) :sparkles:

- item

| Col | Val |
| --- | --- |
| A | B |

> [!NOTE]
> Nota

\`\`\`ts
const answer = 42;
\`\`\`

[^1]: Pie

[TOC]
`;

    const signals = buildTrainingSignals(markdown, parseAst(markdown), []);

    expect(signals.hasH1).toBe(true);
    expect(signals.hasParagraph).toBe(true);
    expect(signals.hasEmphasis).toBe(true);
    expect(signals.hasList).toBe(true);
    expect(signals.hasLink).toBe(true);
    expect(signals.hasCodeFence).toBe(true);
    expect(signals.hasCodeLanguage).toBe(true);
    expect(signals.hasTable).toBe(true);
    expect(signals.hasFootnote).toBe(true);
    expect(signals.hasToc).toBe(true);
    expect(signals.hasEmojiShortcode).toBe(true);
    expect(signals.hasAdmonition).toBe(true);
  });

  it('detects mermaid and math as technical signals', () => {
    const markdown = `## Técnico

\`\`\`mermaid
graph TD
  A --> B
\`\`\`

$$
x + y = 2
$$
`;

    const signals = buildTrainingSignals(markdown, parseAst(markdown), []);

    expect(signals.hasMermaid).toBe(true);
    expect(signals.hasMath).toBe(true);
    expect(signals.isTechnicalDocument).toBe(true);
  });

  it('does not count nested blockquote text as the first body paragraph', () => {
    const markdown = `# Documento

> Esta cita no debería completar el paso de párrafo inicial.
`;

    const signals = buildTrainingSignals(markdown, parseAst(markdown), []);

    expect(signals.hasH1).toBe(true);
    expect(signals.hasParagraph).toBe(false);
  });
});

describe('training route resolution', () => {
  it('keeps the route on the first missing base step', () => {
    const markdown = '# Documento\n\nPrimer párrafo con suficiente texto para avanzar.\n';
    const signals = buildTrainingSignals(markdown, parseAst(markdown), []);
    const completedStepIds = resolveObservedCompletedSteps(
      signals,
      {
        active: true,
        completedStepIds: [],
        dismissedStepIds: [],
        activationExportCount: 0,
      },
      0
    );

    const currentStep = resolveCurrentTrainingStep(
      signals,
      {
        active: true,
        completedStepIds,
        dismissedStepIds: [],
        activationExportCount: 0,
      },
      0
    );

    expect(completedStepIds).toContain('title-main');
    expect(completedStepIds).toContain('intro-paragraph');
    expect(currentStep?.id).toBe('basic-emphasis');
  });

  it('unlocks advanced steps only after the base route is completed', () => {
    const markdown = `# Documento

Parrafo con **énfasis** y un [enlace](https://example.com)

- uno
- dos

\`\`\`ts
const answer = 42;
\`\`\`

## Sección

### Detalle
`;

    const signals = buildTrainingSignals(markdown, parseAst(markdown), []);
    const visibleBeforeExport = resolveVisibleTrainingSteps(
      signals,
      {
        active: true,
        completedStepIds: [
          'title-main',
          'intro-paragraph',
          'basic-emphasis',
          'basic-list',
          'basic-link',
          'useful-block',
        ],
        dismissedStepIds: [],
        activationExportCount: 0,
      },
      0
    );

    expect(visibleBeforeExport.some((step) => step.id === 'sections-structure')).toBe(false);

    const visibleAfterExport = resolveVisibleTrainingSteps(
      signals,
      {
        active: true,
        completedStepIds: [
          'title-main',
          'intro-paragraph',
          'basic-emphasis',
          'basic-list',
          'basic-link',
          'useful-block',
          'export-final',
        ],
        dismissedStepIds: [],
        activationExportCount: 0,
      },
      1
    );

    expect(visibleAfterExport.some((step) => step.id === 'sections-structure')).toBe(true);
  });

  it('does not complete the export step while training is inactive', () => {
    const markdown = `# Documento

Parrafo con **énfasis** y un [enlace](https://example.com)

- uno
- dos

\`\`\`md
codigo
\`\`\`
`;

    const signals = buildTrainingSignals(markdown, parseAst(markdown), []);
    const completedWhileInactive = resolveObservedCompletedSteps(
      signals,
      {
        active: false,
        completedStepIds: [
          'title-main',
          'intro-paragraph',
          'basic-emphasis',
          'basic-list',
          'basic-link',
          'useful-block',
        ],
        dismissedStepIds: [],
        activationExportCount: 0,
      },
      1
    );

    expect(completedWhileInactive).not.toContain('export-final');
  });
});
