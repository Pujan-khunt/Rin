import { describe, it, expect } from 'vitest';
import { parseQuizChoice } from '../src/parser';
import type { QuizChoice } from '@rin/shared';

describe('Worker Choice Parser', () => {
  const options: QuizChoice[] = [
    { label: 'A', text: 'Option A' },
    { label: 'B', text: 'Option B' },
    { label: 'C', text: 'Option C' },
    { label: 'D', text: 'Option D' },
  ];

  it('parses valid structured JSON with reasoning and choice', () => {
    const raw = JSON.stringify({
      reasoning: 'Option B is correct because of struct alignment rules.',
      choice: 'B',
    });

    const result = parseQuizChoice(raw, options);
    expect(result.chosenIndex).toBe(1);
    expect(result.chosenLabel).toBe('B');
  });

  it('handles lowercase choice labels case-insensitively', () => {
    const raw = JSON.stringify({ choice: 'c' });
    const result = parseQuizChoice(raw, options);
    expect(result.chosenIndex).toBe(2);
    expect(result.chosenLabel).toBe('C');
  });

  it('supports alternative keys such as chosenLabel and label', () => {
    expect(parseQuizChoice(JSON.stringify({ chosenLabel: 'D' }), options)).toEqual({
      chosenIndex: 3,
      chosenLabel: 'D',
    });
    expect(parseQuizChoice(JSON.stringify({ label: 'A' }), options)).toEqual({
      chosenIndex: 0,
      chosenLabel: 'A',
    });
  });

  it('extracts choice via regex when wrapped in markdown code blocks', () => {
    const raw = 'Here is the answer:\n```json\n{"reasoning": "Simple math", "choice": "C"}\n```';
    const result = parseQuizChoice(raw, options);
    expect(result.chosenIndex).toBe(2);
    expect(result.chosenLabel).toBe('C');
  });

  it('extracts choice via regex when JSON is preceded and followed by arbitrary text', () => {
    const raw = 'Thinking: C++ padding.\n{"choice": "B"}\nEnd of explanation.';
    const result = parseQuizChoice(raw, options);
    expect(result.chosenIndex).toBe(1);
    expect(result.chosenLabel).toBe('B');
  });

  it('gracefully falls back to first option when model output is completely unrecognized', () => {
    const raw = 'I am not sure what the answer is.';
    const result = parseQuizChoice(raw, options);
    expect(result.chosenIndex).toBe(0);
    expect(result.chosenLabel).toBe('A');
  });

  it('handles 2-option quizzes (True/False)', () => {
    const tfOptions: QuizChoice[] = [
      { label: 'A', text: 'True' },
      { label: 'B', text: 'False' },
    ];
    const raw = JSON.stringify({ choice: 'B' });
    const result = parseQuizChoice(raw, tfOptions);
    expect(result.chosenIndex).toBe(1);
    expect(result.chosenLabel).toBe('B');
  });
});
