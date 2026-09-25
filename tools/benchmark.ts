import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { JSDOM } from 'jsdom';
import type { QuizInput } from '@rin/shared';

export interface BenchmarkRow {
  fixture: string;
  question: string;
  options: number;
  choice: string;
  latencyMs: number;
}

export function loadFixtures(dir: string): Array<{ path: string; input: QuizInput }> {
  const results: Array<{ path: string; input: QuizInput }> = [];

  function scan(current: string) {
    const entries = readdirSync(current, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const fullPath = join(current, entry.name);
      if (entry.isDirectory()) {
        scan(fullPath);
      } else if (entry.name.endsWith('.html') && !entry.name.includes('container')) {
        const html = readFileSync(fullPath, 'utf-8');
        const dom = new JSDOM(html);
        const doc = dom.window.document;
        const qEl = doc.querySelector('.m-problem-description__markdown');
        const choiceNodes = doc.querySelectorAll(
          '.m-problem-choices__list > a.choice, .m-problem-responses__list a.choice'
        );
        if (qEl && choiceNodes.length > 0) {
          results.push({
            path: entry.name,
            input: {
              question: qEl.textContent?.replace(/\s+/g, ' ').trim() ?? '',
              options: Array.from(choiceNodes).map((node, i) => ({
                label: node.querySelector('.choice__name')?.textContent?.trim() ?? String.fromCharCode(65 + i),
                text: node.querySelector('.choice__text')?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
              })),
            },
          });
        }
      }
    }
  }

  scan(dir);
  return results;
}

export async function runMockBenchmark(fixturesDir = join(__dirname, '../test-fixtures')) {
  const fixtures = loadFixtures(fixturesDir);
  console.log(`Loaded ${fixtures.length} quiz fixtures.\n`);

  const rows: BenchmarkRow[] = [];
  for (const f of fixtures) {
    const start = performance.now();
    // Deterministic mock solver pick for verification
    const choice = f.input.options[0].label;
    const latency = Math.round(performance.now() - start);

    rows.push({
      fixture: f.path,
      question: f.input.question.substring(0, 45) + '...',
      options: f.input.options.length,
      choice,
      latencyMs: latency,
    });
  }

  console.table(rows);
  console.log('\nBenchmark completed successfully across all fixtures.');
  return rows;
}

if (process.env.NODE_ENV !== 'test') {
  runMockBenchmark();
}
