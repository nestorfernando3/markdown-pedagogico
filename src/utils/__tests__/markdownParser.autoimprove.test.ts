// @vitest-environment node

import { describe, expect, it } from 'vitest';
import { MARKDOWN_BENCHMARK_FIXTURES } from '../../test/fixtures/markdownBenchmarkSet';
import { parseMarkdown } from '../markdownParser';

function percentile(values: number[], quantile: number): number {
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.max(0, Math.ceil(quantile * sorted.length) - 1);
  return sorted[index];
}

describe('markdownParser autoimprove benchmark', () => {
  it('prints a stable benchmark score across representative markdown fixtures', async () => {
    const warmups = 2;
    const runs = 8;
    const allSamples: number[] = [];
    const fixtureScores: Array<{ name: string; p95: number }> = [];
    let lastResult: Awaited<ReturnType<typeof parseMarkdown>> | null = null;

    for (const fixture of MARKDOWN_BENCHMARK_FIXTURES) {
      for (let index = 0; index < warmups; index += 1) {
        lastResult = await parseMarkdown(fixture.markdown);
      }

      const fixtureSamples: number[] = [];
      for (let index = 0; index < runs; index += 1) {
        const start = performance.now();
        lastResult = await parseMarkdown(fixture.markdown);
        const duration = performance.now() - start;
        fixtureSamples.push(duration);
        allSamples.push(duration);
      }

      fixtureScores.push({
        name: fixture.name,
        p95: percentile(fixtureSamples, 0.95),
      });
    }

    expect(lastResult).not.toBeNull();
    expect(lastResult?.html.length).toBeGreaterThan(0);
    expect(Array.isArray(lastResult?.warnings)).toBe(true);

    const score = percentile(
      fixtureScores.map((fixture) => fixture.p95),
      0.5,
    );
    const mean = allSamples.reduce((sum, sample) => sum + sample, 0) / allSamples.length;

    console.log(
      `FIXTURES: ${fixtureScores
        .map((fixture) => `${fixture.name}=${fixture.p95.toFixed(2)}`)
        .join(', ')}`,
    );
    console.log(`SCORE: ${score.toFixed(2)}`);
    console.log(`MEAN: ${mean.toFixed(2)}`);
  }, 20000);
});
