// @vitest-environment node

import { describe, expect, it } from 'vitest';
import { MEDIUM_MARKDOWN } from '../../test/fixtures/mediumMarkdown';
import { parseMarkdown } from '../markdownParser';

function percentile(values: number[], quantile: number): number {
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.max(0, Math.ceil(quantile * sorted.length) - 1);
  return sorted[index];
}

describe('markdownParser autoimprove benchmark', () => {
  it('prints a stable benchmark score for medium documents', async () => {
    const warmups = 3;
    const runs = 12;
    const samples: number[] = [];
    let lastResult: Awaited<ReturnType<typeof parseMarkdown>> | null = null;

    for (let index = 0; index < warmups; index += 1) {
      lastResult = await parseMarkdown(MEDIUM_MARKDOWN);
    }

    for (let index = 0; index < runs; index += 1) {
      const start = performance.now();
      lastResult = await parseMarkdown(MEDIUM_MARKDOWN);
      samples.push(performance.now() - start);
    }

    expect(lastResult).not.toBeNull();
    expect(lastResult?.html).toContain('Documento de Prueba');
    expect(Array.isArray(lastResult?.warnings)).toBe(true);

    const p95 = percentile(samples, 0.95);
    const mean = samples.reduce((sum, sample) => sum + sample, 0) / samples.length;

    console.log(`SCORE: ${p95.toFixed(2)}`);
    console.log(`MEAN: ${mean.toFixed(2)}`);
  }, 20000);
});
