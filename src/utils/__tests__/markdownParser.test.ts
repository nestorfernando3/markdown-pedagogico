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

    expect(result.html).toContain('<h1>Titulo</h1>');
    expect(result.html).toContain('Texto seguro');
    expect(result.html).not.toContain('<script>');
  });
});
