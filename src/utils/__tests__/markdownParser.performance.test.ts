// @vitest-environment node

import { describe, expect, it } from 'vitest';
import { MEDIUM_MARKDOWN } from '../../test/fixtures/mediumMarkdown';
import { parseMarkdown } from '../markdownParser';

function percentile(values: number[], value: number): number {
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.max(0, Math.ceil(value * sorted.length) - 1);
  return sorted[index];
}

describe('markdownParser performance', () => {
  it('keeps parseMarkdown p95 below 400ms for medium documents', async () => {
    const warmups = 3;
    const runs = 12;
    const samples: number[] = [];

    for (let index = 0; index < warmups; index += 1) {
      await parseMarkdown(MEDIUM_MARKDOWN);
    }

    for (let index = 0; index < runs; index += 1) {
      const start = performance.now();
      await parseMarkdown(MEDIUM_MARKDOWN);
      samples.push(performance.now() - start);
    }

    const p95 = percentile(samples, 0.95);
    expect(p95).toBeLessThan(400);
  }, 20000);
});
