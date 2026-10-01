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

  it('parses JSON wrapped inside markdown code blocks', () => {
    const raw = '```json\n{"reasoning": "Simple math", "choice": "C"}\n```';
    const result = parseQuizChoice(raw, options);
    expect(result.chosenIndex).toBe(2);
    expect(result.chosenLabel).toBe('C');
  });

  it('throws an error when JSON cannot be parsed', () => {
    const raw = 'I think the answer is B';
    expect(() => parseQuizChoice(raw, options)).toThrow(
      'Failed to parse LLM response as JSON'
    );
  });

  it('throws an error when "choice" field is missing from JSON', () => {
    const raw = JSON.stringify({ reasoning: 'Missing choice property' });
    expect(() => parseQuizChoice(raw, options)).toThrow(
      'LLM response missing "choice" field'
    );
  });

  it('throws an error when choice is not among available options', () => {
    const raw = JSON.stringify({ choice: 'Z' });
    expect(() => parseQuizChoice(raw, options)).toThrow(
      'Model selected unknown choice "Z". Available options: [A, B, C, D]'
    );
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
