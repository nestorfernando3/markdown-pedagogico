// @vitest-environment node

import { describe, expect, it } from 'vitest';
import { analyzePedagogical, parseMarkdown } from '../markdownParser';

function ruleIds(text: string): string[] {
  return analyzePedagogical(text).warnings.map((warning) => warning.ruleId);
}

describe('markdownParser', () => {
  it('returns no warnings for empty documents and whitespace-only documents', () => {
    expect(analyzePedagogical('').warnings).toHaveLength(0);
    expect(analyzePedagogical('   \n\n  ').warnings).toHaveLength(0);
  });

  it('returns no warnings for a healthy markdown document', () => {
    const text = `# Introducción

Este documento presenta una guía breve y clara.

## Desarrollo

Se explican los pasos con ejemplos concretos.

## Conclusión

Se resume el resultado final.`;

    expect(analyzePedagogical(text).warnings).toHaveLength(0);
  });

  it('produces stable deterministic warning ids', () => {
    const text = `#Titulo\n\nEste texto siempre promete que es el mejor del mercado.`;

    const first = analyzePedagogical(text).warnings.map((warning) => warning.id);
    const second = analyzePedagogical(text).warnings.map((warning) => warning.id);

    expect(first).toEqual(second);
    expect(new Set(first).size).toBe(first.length);
  });

  it('detects header missing space and does not trigger for valid headers', () => {
    expect(ruleIds('#Titulo\n\nContenido')).toContain('syntax-header-missing-space');
    expect(ruleIds('# Titulo\n\nContenido')).not.toContain('syntax-header-missing-space');
  });

  it('detects list missing space and does not trigger for valid lists', () => {
    expect(ruleIds('-Item\n')).toContain('syntax-list-missing-space');
    expect(ruleIds('- Item\n')).not.toContain('syntax-list-missing-space');
  });

  it('detects heading hierarchy jumps and not sequential headers', () => {
    expect(ruleIds('# Titulo\n\n### Salto')).toContain('structure-heading-hierarchy');
    expect(ruleIds('# Titulo\n\n## Subtitulo')).not.toContain('structure-heading-hierarchy');
  });

  it('detects dense paragraphs and ignores short paragraphs', () => {
    const denseParagraph = `${'palabra '.repeat(81)}`;
    expect(ruleIds(denseParagraph)).toContain('structure-dense-paragraph');
    expect(ruleIds('Parrafo breve con pocas palabras.')).not.toContain('structure-dense-paragraph');
  });

  it('detects absolute claims and ignores neutral language', () => {
    expect(ruleIds('Este enfoque siempre funciona para todos.')).toContain('clarity-absolute-claims');
    expect(ruleIds('Este enfoque funciona en varios contextos.')).not.toContain('clarity-absolute-claims');
  });

  it('detects persuasive cliches and ignores grounded statements', () => {
    expect(ruleIds('Este es el mejor del mercado para cualquier persona.')).toContain('style-persuasive-cliches');
    expect(ruleIds('Esta solución se apoya en resultados medibles.')).not.toContain('style-persuasive-cliches');
  });

  it('detects long sentences and ignores concise sentences', () => {
    const longSentence = `${'palabra '.repeat(41)}.`;
    expect(ruleIds(longSentence)).toContain('clarity-long-sentences');
    expect(ruleIds('Esta oración es corta y directa.')).not.toContain('clarity-long-sentences');
  });

  it('detects passive voice and ignores active voice', () => {
    expect(ruleIds('El protocolo fue aprobado por el comité.')).toContain('style-passive-voice');
    expect(ruleIds('El comité aprobó el protocolo.')).not.toContain('style-passive-voice');
  });

  it('detects lexical repetition across consecutive paragraphs', () => {
    const text = `La arquitectura modular mejora la arquitectura técnica y la trazabilidad.

La arquitectura modular facilita pruebas y mejora la arquitectura del servicio.`;

    expect(ruleIds(text)).toContain('style-lexical-repetition');
    expect(ruleIds('Primer párrafo con términos distintos.\n\nSegundo párrafo sin coincidencias relevantes.')).not.toContain(
      'style-lexical-repetition'
    );
  });

  it('detects missing conclusion in long documents', () => {
    const longTextWithoutConclusion = `${'palabra '.repeat(520)}`;
    const longTextWithConclusion = `# Introducción\n\n${'palabra '.repeat(510)}\n\n## Conclusión\n\nCierre.`;

    expect(ruleIds(longTextWithoutConclusion)).toContain('structure-missing-conclusion');
    expect(ruleIds(longTextWithConclusion)).not.toContain('structure-missing-conclusion');
  });

  it('detects orphan lists and does not trigger with intro paragraph', () => {
    expect(ruleIds('- item uno\n- item dos')).toContain('structure-orphan-list');
    expect(ruleIds('Contexto previo de la lista.\n\n- item uno\n- item dos')).not.toContain('structure-orphan-list');
  });

  it('detects orphan headings and does not trigger when heading has content', () => {
    expect(ruleIds('# Titulo\n## Subtitulo')).toContain('structure-orphan-heading');
    expect(ruleIds('# Titulo\n\nContenido\n\n## Subtitulo\n\nContenido')).not.toContain('structure-orphan-heading');
  });

  it('triggers onboarding on very short plain text and not on markdown text', () => {
    expect(ruleIds('hola mundo')).toContain('clarity-onboarding');
    expect(ruleIds('# hola mundo')).not.toContain('clarity-onboarding');
  });

  it('renders sanitized html', async () => {
    const result = await parseMarkdown('# Titulo\n\n<script>alert(1)</script>\n\nTexto seguro');

    expect(result.html).toContain('<h1 id="user-content-titulo">Titulo</h1>');
    expect(result.html).toContain('Texto seguro');
    expect(result.html).not.toContain('<script>');
  });

  it('renders GFM tables, task lists and footnotes', async () => {
    const markdown = `# Documento

| Columna | Valor |
| --- | --- |
| Uno | Dos |

- [ ] Pendiente
- [x] Hecho

Texto con nota[^1]

[^1]: Nota ampliada.`;

    const result = await parseMarkdown(markdown);

    expect(result.html).toContain('<table>');
    expect(result.html).toContain('contains-task-list');
    expect(result.html).toContain('task-list-item');
    expect(result.html).toContain('data-footnote-ref');
    expect(result.html).toContain('data-footnotes');
    expect(result.html).toContain('Nota ampliada.');
  });

  it('parses front matter without rendering it in the html preview', async () => {
    const markdown = `---
title: "Guia"
author: "Nestor"
---

# Titulo`;

    const result = await parseMarkdown(markdown);

    expect(result.html).toContain('<h1 id="user-content-titulo">Titulo</h1>');
    expect(result.html).not.toContain('title: "Guia"');
    expect(result.html).not.toContain('author: "Nestor"');
  });

  it('parses TOML front matter without rendering it in the html preview', async () => {
    const markdown = `+++
title = "Guia"
author = "Nestor"
+++

# Titulo`;

    const result = await parseMarkdown(markdown);

    expect(result.html).toContain('<h1 id="user-content-titulo">Titulo</h1>');
    expect(result.html).not.toContain('title = "Guia"');
    expect(result.html).not.toContain('author = "Nestor"');
  });

  it('replaces TOC placeholders with anchored links to headings', async () => {
    const markdown = `# Documento

## Contenido

[TOC]

## Seccion principal

### Subtema`;

    const result = await parseMarkdown(markdown);

    expect(result.html).toContain('<h2 id="user-content-seccion-principal">Seccion principal</h2>');
    expect(result.html).toContain('<h3 id="user-content-subtema">Subtema</h3>');
    expect(result.html).toContain('href="#user-content-seccion-principal"');
    expect(result.html).toContain('href="#user-content-subtema"');
    expect(result.html).not.toContain('[TOC]');
  });

  it('resolves reference-style links before export', async () => {
    const markdown = `Ir al [Repositorio][repo].

[repo]: https://github.com`;

    const result = await parseMarkdown(markdown);

    expect(result.html).toContain('<a href="https://github.com">Repositorio</a>');
    expect(result.html).not.toContain('[Repositorio][repo]');
  });

  it('renders common emoji shortcodes in preview html', async () => {
    const markdown = 'Señal :warning: y brillo :sparkles:';

    const result = await parseMarkdown(markdown);

    expect(result.html).toContain('⚠️');
    expect(result.html).toContain('✨');
    expect(result.html).not.toContain(':warning:');
    expect(result.html).not.toContain(':sparkles:');
  });

  it('renders inline and block math with katex markup', async () => {
    const markdown = `La formula es $E = mc^2$.

$$
\\int_0^1 x^2 dx
$$`;

    const result = await parseMarkdown(markdown);

    expect(result.html).toContain('class="katex"');
    expect(result.html).toContain('class="katex-display"');
    expect(result.html).not.toContain('$E = mc^2$');
  });

  it('converts mermaid code fences into renderable mermaid containers', async () => {
    const markdown = `# Diagrama

\`\`\`mermaid
graph TD
  A[Inicio] --> B[Fin]
\`\`\``;

    const result = await parseMarkdown(markdown);

    expect(result.html).toContain('class="mermaid"');
    expect(result.html).toContain('data-mermaid-source=');
    expect(result.html).toContain('graph TD');
    expect(result.html).not.toContain('<pre><code class="language-mermaid">');
  });

  it('highlights fenced code blocks with shiki metadata for preview and export', async () => {
    const markdown = '```ts\nconst answer = 42;\n```\n';

    const result = await parseMarkdown(markdown);

    expect(result.html).toContain('class="shiki');
    expect(result.html).toContain('data-code-block="true"');
    expect(result.html).toContain('data-language="ts"');
    expect(result.html).toContain('language-ts');
  });

  it('renders inline markdown extensions used by the format menu', async () => {
    const markdown = '<kbd>Cmd+S</kbd> ==tiempo== ^2^ ~n~ <u>subrayado</u>';

    const result = await parseMarkdown(markdown);

    expect(result.html).toContain('<kbd>Cmd+S</kbd>');
    expect(result.html).toContain('<mark>tiempo</mark>');
    expect(result.html).toContain('<sup>2</sup>');
    expect(result.html).toContain('<sub>n</sub>');
    expect(result.html).toContain('<u>subrayado</u>');
  });

  it('renders definition lists inserted from the editor actions', async () => {
    const markdown = `Termino

: Definicion breve.`;

    const result = await parseMarkdown(markdown);

    expect(result.html).toContain('<dl>');
    expect(result.html).toContain('<dt>Termino</dt>');
    expect(result.html).toContain('<dd>Definicion breve.</dd>');
  });

  it('renders admonition blockquotes as alert containers', async () => {
    const markdown = `> [!NOTE]
> Recuerda validar el flujo.`;

    const result = await parseMarkdown(markdown);

    expect(result.html).toContain('class="markdown-alert markdown-alert-note"');
    expect(result.html).toContain('class="markdown-alert-title"');
    expect(result.html).toContain('NOTE');
    expect(result.html).toContain('Recuerda validar el flujo.');
    expect(result.html).not.toContain('[!NOTE]');
  });

  it('surfaces remark-lint warnings with source metadata', async () => {
    const markdown = `# Titulo

- item
-  item
`;

    const result = await parseMarkdown(markdown);
    const warning = result.warnings.find((entry) => entry.ruleId === 'list-item-indent');

    expect(warning).toMatchObject({
      source: 'remark-lint',
      category: 'syntax',
      line: 4,
      column: 4,
    });
    expect(warning?.message).toContain('expected `1` space');
  });

  it('adds an applicable correction for missing final newline warnings', async () => {
    const markdown = '# Titulo\n\nTexto sin salto final';

    const result = await parseMarkdown(markdown);
    const warning = result.warnings.find((entry) => entry.ruleId === 'final-newline');

    expect(warning).toMatchObject({
      source: 'remark-lint',
      suggestion: 'Agrega un salto de línea al final del documento.',
    });
    expect(warning?.replacementConfig).toEqual({
      startOffset: markdown.length,
      endOffset: markdown.length,
      newText: '\n',
    });
  });

  it('surfaces nspell warnings with replacement suggestions', async () => {
    const markdown = `# Documento

El tiempp cambia.
`;

    const result = await parseMarkdown(markdown);
    const warning = result.warnings.find((entry) => entry.source === 'nspell' && entry.originalText === 'tiempp');

    expect(warning).toMatchObject({
      category: 'orthography',
      source: 'nspell',
      originalText: 'tiempp',
    });
    expect(warning?.suggestions).toContain('tiempo');
    expect(warning?.replacementConfig?.newText).toBe('tiempo');
  });

  it('renders a composed acceptance sample with later sections, references, footnotes and emoji', async () => {
    const markdown = `# Documento

Prueba de emoji :sparkles:

Prueba de enlace por referencia: [Repositorio][repo]

Texto con nota[^1].

### TypeScript

\`\`\`ts
const answer = 42;
\`\`\`

### Python

\`\`\`python
print("hola")
\`\`\`

### JSON

\`\`\`json
{"ok": true}
\`\`\`

# Segunda página de prueba

## Resultados y conclusiones

[^1]: Esta es una nota al pie de prueba.

[repo]: https://github.com`;

    const result = await parseMarkdown(markdown);

    expect(result.html).toContain('✨');
    expect(result.html).toContain('<a href="https://github.com">Repositorio</a>');
    expect(result.html).toContain('Esta es una nota al pie de prueba.');
    expect(result.html).toContain('Segunda página de prueba');
    expect(result.html).toContain('Resultados y conclusiones');
    expect(result.html).toContain('language-python');
    expect(result.html).toContain('language-json');
  });
});
