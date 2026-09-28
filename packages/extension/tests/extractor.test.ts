import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { extractQuiz } from '../src/detection/extractor';

describe('Quiz Extractor', () => {
  it('extracts a standard 4-option quiz', () => {
    const html = `
      <div class="m-quiz">
        <div class="m-problem-description__markdown"><p>what is usually the size of cache line ?</p></div>
        <div class="m-problem-choices__list">
          <a class="choice"><div class="choice__name">A</div><div class="choice__text"><p>64 bytes</p></div></a>
          <a class="choice"><div class="choice__name">B</div><div class="choice__text"><p>64 kb</p></div></a>
          <a class="choice"><div class="choice__name">C</div><div class="choice__text"><p>128 bytes</p></div></a>
          <a class="choice"><div class="choice__name">D</div><div class="choice__text"><p>128 kb</p></div></a>
        </div>
      </div>
    `;
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

  it('extracts a True/False 2-option quiz', () => {
    const html = `
      <div class="m-quiz">
        <div class="m-problem-description__markdown"><p>if we declare stack based objects do we need to manually free them ?</p></div>
        <div class="m-problem-choices__list">
          <a class="choice"><div class="choice__name">A</div><div class="choice__text"><p>True</p></div></a>
          <a class="choice"><div class="choice__name">B</div><div class="choice__text"><p>False</p></div></a>
        </div>
      </div>
    `;
    const dom = new JSDOM(html);
    const quizEl = dom.window.document.querySelector('div.m-quiz') as HTMLElement;

    const data = extractQuiz(quizEl);
    expect(data).not.toBeNull();
    expect(data!.question).toContain('if we declare stack based objects');
    expect(data!.options).toHaveLength(2);
    expect(data!.options[0]).toEqual({ label: 'A', text: 'True', index: 0 });
    expect(data!.options[1]).toEqual({ label: 'B', text: 'False', index: 1 });
  });

  it('extracts a 3-option struct alignment quiz', () => {
    const html = `
      <div class="m-quiz">
        <div class="m-problem-description__markdown"><p>What is the alignment of this struct ?</p></div>
        <div class="m-problem-choices__list">
          <a class="choice"><div class="choice__name">A</div><div class="choice__text"><p>8</p></div></a>
          <a class="choice"><div class="choice__name">B</div><div class="choice__text"><p>16</p></div></a>
          <a class="choice"><div class="choice__name">C</div><div class="choice__text"><p>4</p></div></a>
        </div>
      </div>
    `;
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

  it('extracts a quiz with pre and code blocks preserving formatting', () => {
    const html = `
      <div class="m-quiz">
        <div class="m-problem-description__markdown">
          <p>What is the output of the following code snippet?</p>
          <pre><code class="language-python">x = [1, 2, 3]
print(x * 2)</code></pre>
          <p>Select the correct answer:</p>
        </div>
        <div class="m-problem-choices__list">
          <a class="choice"><div class="choice__name">A</div><div class="choice__text"><p>[1, 2, 3, 1, 2, 3]</p></div></a>
          <a class="choice"><div class="choice__name">B</div><div class="choice__text"><p>[2, 4, 6]</p></div></a>
        </div>
      </div>
    `;
    const dom = new JSDOM(html);
    const quizEl = dom.window.document.querySelector('div.m-quiz') as HTMLElement;
    const data = extractQuiz(quizEl);
    expect(data).not.toBeNull();
    expect(data!.question).toContain('What is the output of the following code snippet?');
    expect(data!.question).toContain('x = [1, 2, 3]\nprint(x * 2)');
    expect(data!.question).toContain('Select the correct answer:');
    expect(data!.options).toHaveLength(2);
  });
});

