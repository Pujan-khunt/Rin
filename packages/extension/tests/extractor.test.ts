import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import {
  extractQuiz,
  normalizeWhitespace,
  extractBlockText,
  parseQuestion,
  parseOption,
} from '@/quiz/extractor';

describe('Quiz Extractor', () => {
  describe('normalizeWhitespace', () => {
    it('returns empty string for null, undefined, or whitespace-only inputs', () => {
      expect(normalizeWhitespace(null)).toBe('');
      expect(normalizeWhitespace(undefined)).toBe('');
      expect(normalizeWhitespace('')).toBe('');
      expect(normalizeWhitespace('   \n\t  ')).toBe('');
    });

    it('collapses multiple spaces, tabs, and newlines into single spaces and trims edges', () => {
      expect(normalizeWhitespace('  hello   world  ')).toBe('hello world');
      expect(normalizeWhitespace('line 1\n\n  line 2\tline 3')).toBe('line 1 line 2 line 3');
    });
  });

  describe('extractBlockText', () => {
    it('preserves formatting and whitespace for PRE blocks', () => {
      const dom = new JSDOM('<pre>  code line 1\n    code line 2  </pre>');
      const preEl = dom.window.document.querySelector('pre')!;
      expect(extractBlockText(preEl)).toBe('code line 1\n    code line 2');
    });

    it('preserves formatting for containers containing a PRE element', () => {
      const dom = new JSDOM('<div><pre>x = 10\ny = 20</pre></div>');
      const divEl = dom.window.document.querySelector('div')!;
      expect(extractBlockText(divEl)).toBe('x = 10\ny = 20');
    });

    it('normalizes whitespace for non-PRE blocks', () => {
      const dom = new JSDOM('<p>  hello   \n\n world  </p>');
      const pEl = dom.window.document.querySelector('p')!;
      expect(extractBlockText(pEl)).toBe('hello world');
    });
  });

  describe('parseQuestion', () => {
    it('returns null if question container is missing', () => {
      const dom = new JSDOM('<div class="m-quiz"></div>');
      const root = dom.window.document.querySelector('div.m-quiz') as HTMLElement;
      expect(parseQuestion(root)).toBeNull();
    });

    it('returns null if question content is empty or whitespace', () => {
      const dom = new JSDOM(`
        <div class="m-quiz">
          <div class="m-problem-description__markdown"><p>   </p></div>
        </div>
      `);
      const root = dom.window.document.querySelector('div.m-quiz') as HTMLElement;
      expect(parseQuestion(root)).toBeNull();
    });

    it('extracts single paragraph question text without children', () => {
      const dom = new JSDOM(`
        <div class="m-quiz">
          <div class="m-problem-description__markdown">Direct question text</div>
        </div>
      `);
      const root = dom.window.document.querySelector('div.m-quiz') as HTMLElement;
      expect(parseQuestion(root)).toBe('Direct question text');
    });

    it('joins multiple child blocks with newlines while preserving pre formatting', () => {
      const dom = new JSDOM(`
        <div class="m-quiz">
          <div class="m-problem-description__markdown">
            <p>Title paragraph</p>
            <pre><code>val a = 1\nval b = 2</code></pre>
            <p>Footer paragraph</p>
          </div>
        </div>
      `);
      const root = dom.window.document.querySelector('div.m-quiz') as HTMLElement;
      expect(parseQuestion(root)).toBe('Title paragraph\nval a = 1\nval b = 2\nFooter paragraph');
    });
  });

  describe('parseOption', () => {
    it('parses an option node into DetectedOption with element reference', () => {
      const dom = new JSDOM(`
        <a class="choice">
          <div class="choice__name">B</div>
          <div class="choice__text"><p>Option content</p></div>
        </a>
      `);
      const choiceEl = dom.window.document.querySelector('a.choice') as HTMLElement;
      const parsed = parseOption(choiceEl, 1);

      expect(parsed).toEqual({
        label: 'B',
        text: 'Option content',
        index: 1,
        element: choiceEl,
      });
      expect(parsed.element).toBe(choiceEl);
    });

    it('generates fallback letter label when choice__name is absent', () => {
      const dom = new JSDOM(`
        <a class="choice">
          <div class="choice__text"><p>Fallback label option</p></div>
        </a>
      `);
      const choiceEl = dom.window.document.querySelector('a.choice') as HTMLElement;
      const parsed = parseOption(choiceEl, 2);

      expect(parsed.label).toBe('C');
      expect(parsed.text).toBe('Fallback label option');
      expect(parsed.index).toBe(2);
      expect(parsed.element).toBe(choiceEl);
    });
  });

  describe('extractQuiz', () => {
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

      const choiceNodes = quizEl.querySelectorAll<HTMLElement>('a.choice');
      const data = extractQuiz(quizEl);
      expect(data).not.toBeNull();
      expect(data!.question).toBe('what is usually the size of cache line ?');
      expect(data!.containerElement).toBe(quizEl);
      expect(data!.options).toHaveLength(4);
      expect(data!.options[0]).toEqual({
        label: 'A',
        text: '64 bytes',
        index: 0,
        element: choiceNodes[0],
      });
      expect(data!.options[1]).toEqual({
        label: 'B',
        text: '64 kb',
        index: 1,
        element: choiceNodes[1],
      });
      expect(data!.options[2]).toEqual({
        label: 'C',
        text: '128 bytes',
        index: 2,
        element: choiceNodes[2],
      });
      expect(data!.options[3]).toEqual({
        label: 'D',
        text: '128 kb',
        index: 3,
        element: choiceNodes[3],
      });
      expect(data!.options[0].element).toBe(choiceNodes[0]);
      expect(data!.optionElements).toEqual([
        choiceNodes[0],
        choiceNodes[1],
        choiceNodes[2],
        choiceNodes[3],
      ]);
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
      const choiceNodes = quizEl.querySelectorAll<HTMLElement>('a.choice');

      const data = extractQuiz(quizEl);
      expect(data).not.toBeNull();
      expect(data!.question).toContain('if we declare stack based objects');
      expect(data!.options).toHaveLength(2);
      expect(data!.options[0]).toEqual({
        label: 'A',
        text: 'True',
        index: 0,
        element: choiceNodes[0],
      });
      expect(data!.options[1]).toEqual({
        label: 'B',
        text: 'False',
        index: 1,
        element: choiceNodes[1],
      });
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
      const choiceNodes = quizEl.querySelectorAll<HTMLElement>('a.choice');

      const data = extractQuiz(quizEl);
      expect(data).not.toBeNull();
      expect(data!.question).toContain('What is the alignment of this struct ?');
      expect(data!.options).toHaveLength(3);
      expect(data!.options[0].text).toBe('8');
      expect(data!.options[0].element).toBe(choiceNodes[0]);
      expect(data!.options[1].text).toBe('16');
      expect(data!.options[1].element).toBe(choiceNodes[1]);
      expect(data!.options[2].text).toBe('4');
      expect(data!.options[2].element).toBe(choiceNodes[2]);
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

    it('returns null if choices list is empty', () => {
      const dom = new JSDOM(`
        <div class="m-quiz">
          <div class="m-problem-description__markdown"><p>Some question</p></div>
          <div class="m-problem-choices__list"></div>
        </div>
      `);
      const el = dom.window.document.querySelector('div.m-quiz') as HTMLElement;
      expect(extractQuiz(el)).toBeNull();
    });

    it('returns null if options have not hydrated any text yet', () => {
      const dom = new JSDOM(`
        <div class="m-quiz">
          <div class="m-problem-description__markdown"><p>Hydration pending question</p></div>
          <div class="m-problem-choices__list">
            <a class="choice"><div class="choice__name">A</div><div class="choice__text"><p></p></div></a>
            <a class="choice"><div class="choice__name">B</div><div class="choice__text"><p>   </p></div></a>
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
      const choiceNodes = quizEl.querySelectorAll<HTMLElement>('a.choice');

      const data = extractQuiz(quizEl);
      expect(data).not.toBeNull();
      expect(data!.question).toContain('What is the output of the following code snippet?');
      expect(data!.question).toContain('x = [1, 2, 3]\nprint(x * 2)');
      expect(data!.question).toContain('Select the correct answer:');
      expect(data!.options).toHaveLength(2);
      expect(data!.options[0].element).toBe(choiceNodes[0]);
      expect(data!.options[1].element).toBe(choiceNodes[1]);
    });

    it('sets alreadyAnswered to false when no choice is selected', () => {
      const html = `
        <div class="m-quiz">
          <div class="m-problem-description__markdown"><p>Fresh quiz?</p></div>
          <div class="m-problem-choices__list">
            <a class="choice"><div class="choice__name">A</div><div class="choice__text"><p>Yes</p></div></a>
            <a class="choice"><div class="choice__name">B</div><div class="choice__text"><p>No</p></div></a>
          </div>
        </div>
      `;
      const dom = new JSDOM(html);
      const quizEl = dom.window.document.querySelector('div.m-quiz') as HTMLElement;
      const data = extractQuiz(quizEl);
      expect(data).not.toBeNull();
      expect(data!.alreadyAnswered).toBe(false);
    });

    it('sets alreadyAnswered to true when a choice has choice--selected', () => {
      const html = `
        <div class="m-quiz">
          <div class="m-problem-description__markdown"><p>Already answered quiz</p></div>
          <div class="m-problem-choices__list">
            <a class="tappable choice choice--default m-5"><div class="choice__name">A</div><div class="choice__text"><p>Opt 1</p></div></a>
            <a class="tappable choice choice--default choice--selected m-5"><div class="choice__name">B</div><div class="choice__text"><p>Opt 2</p></div></a>
          </div>
        </div>
      `;
      const dom = new JSDOM(html);
      const quizEl = dom.window.document.querySelector('div.m-quiz') as HTMLElement;
      const data = extractQuiz(quizEl);
      expect(data).not.toBeNull();
      expect(data!.alreadyAnswered).toBe(true);
    });
  });
});
