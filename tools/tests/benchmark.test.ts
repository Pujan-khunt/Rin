import { describe, it, expect } from 'vitest';
import { join } from 'path';
import { loadFixtures, runMockBenchmark } from '../benchmark';

describe('Offline Benchmark & Calibration Harness', () => {
  const fixturesDir = join(__dirname, '../../test-fixtures');

  it('loads all 17 quiz fixtures from test-fixtures across subjects', () => {
    const fixtures = loadFixtures(fixturesDir);
    expect(fixtures).toHaveLength(17);
  });

  it('correctly extracts questions and options from each fixture', () => {
    const fixtures = loadFixtures(fixturesDir);
    for (const f of fixtures) {
      expect(f.path).toMatch(/\.html$/);
      expect(f.input.question.length).toBeGreaterThan(0);
      expect(f.input.options.length).toBeGreaterThanOrEqual(2);
      for (const opt of f.input.options) {
        expect(opt.label).toBeTruthy();
        expect(opt.text.length).toBeGreaterThan(0);
      }
    }
  });

  it('correctly handles 2, 3, and 4 option fixture variations', () => {
    const fixtures = loadFixtures(fixturesDir);
    const optionCounts = new Set(fixtures.map((f) => f.input.options.length));
    expect(optionCounts.has(2)).toBe(true);
    expect(optionCounts.has(3)).toBe(true);
    expect(optionCounts.has(4)).toBe(true);
  });

  it('executes runMockBenchmark and produces 17 benchmark rows', async () => {
    const rows = await runMockBenchmark(fixturesDir);
    expect(rows).toHaveLength(17);
    for (const row of rows) {
      expect(row.fixture).toBeTruthy();
      expect(row.question).toContain('...');
      expect(row.options).toBeGreaterThanOrEqual(2);
      expect(row.choice).toBeTruthy();
      expect(row.latencyMs).toBeGreaterThanOrEqual(0);
    }
  });
});
