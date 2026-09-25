import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { JSDOM } from 'jsdom';
import { extractQuiz } from '../src/detection/extractor';

describe('Quiz Extractor against Real Fixtures', () => {
  it('extracts a standard 4-option quiz (CPP 1.html)', () => {
    const html = readFileSync(resolve(__dirname, '../../../test-fixtures/cpp-for-hft/atomics-and-concurrency/1.html'), 'utf-8');
    const dom = new JSDOM(html);
    const quizEl = dom.window.document.querySelector('div.m-quiz') as HTMLElement;
    expect(quizEl).not.toBeNull();

    const data = extractQuiz(quizEl);
    expect(data).not.toBeNull();
    expect(data!.question).toBe('what is usually the size of cache line ?');
    expect(data!.options).toHaveLength(4);
    expect(data!.options[0]).toEqual({ label: 'A', text: '64 bytes', index: 0 });
    expect(data!.options[1]).toEqual({ label: 'B', text: '64 kb', index: 1 });
    expect(data!.options[2]).toEqual({ label: 'C', text: '128 bytes', index: 2 });
    expect(data!.options[3]).toEqual({ label: 'D', text: '128 kb', index: 3 });
  });

  it('extracts a True/False 2-option quiz (CPP 4.html)', () => {
    const html = readFileSync(resolve(__dirname, '../../../test-fixtures/cpp-for-hft/atomics-and-concurrency/4.html'), 'utf-8');
    const dom = new JSDOM(html);
    const quizEl = dom.window.document.querySelector('div.m-quiz') as HTMLElement;

    const data = extractQuiz(quizEl);
    expect(data).not.toBeNull();
    expect(data!.question).toContain('if we declare stack based objects');
    expect(data!.options).toHaveLength(2);
    expect(data!.options[0]).toEqual({ label: 'A', text: 'True', index: 0 });
    expect(data!.options[1]).toEqual({ label: 'B', text: 'False', index: 1 });
  });

  it('extracts a 3-option struct alignment quiz (CPP 7.html)', () => {
    const html = readFileSync(resolve(__dirname, '../../../test-fixtures/cpp-for-hft/atomics-and-concurrency/7.html'), 'utf-8');
    const dom = new JSDOM(html);
    const quizEl = dom.window.document.querySelector('div.m-quiz') as HTMLElement;

    const data = extractQuiz(quizEl);
    expect(data).not.toBeNull();
    expect(data!.question).toContain('What is the alignment of this struct ?');
    expect(data!.options).toHaveLength(3);
    expect(data!.options[0].text).toBe('8');
    expect(data!.options[1].text).toBe('16');
    expect(data!.options[2].text).toBe('4');
  });

  it('returns null if given element is not a quiz', () => {
    const dom = new JSDOM('<div><p>Not a quiz</p></div>');
    const el = dom.window.document.querySelector('div') as HTMLElement;
    expect(extractQuiz(el)).toBeNull();
  });

  it('returns null if question text is empty or whitespace', () => {
    const dom = new JSDOM(`
      <div class="m-quiz">
        <div class="m-problem-description__markdown"><p>   </p></div>
        <div class="m-problem-choices__list">
          <a class="choice"><div class="choice__name">A</div><div class="choice__text"><p>Ans</p></div></a>
        </div>
      </div>
    `);
    const el = dom.window.document.querySelector('div.m-quiz') as HTMLElement;
    expect(extractQuiz(el)).toBeNull();
  });
});

