import type { QuizChoice } from '@rin/shared';

export interface ModelAnswer {
  reasoning?: string;
  choice: string;
}

export interface ParsedQuizChoice {
  chosenIndex: number;
  chosenLabel: string;
}

/**
 * Extracts the choice from the LLM's response and finds its corresponding option index.
 *
 * Assumes the happy path: parses the raw content as JSON and strictly expects
 * the "choice" property. Strips optional markdown code fence wrappers if present.
 *
 * Throws a descriptive error if the output cannot be parsed or if the selected
 * choice does not exist in the options list (no guessing or silent fallbacks).
 */
export function parseQuizChoice(rawContent: string, options: QuizChoice[]): ParsedQuizChoice {
  let answer: ModelAnswer;

  try {
    // Strip optional markdown code fences (e.g. ```json ... ```)
    const cleaned = rawContent.replace(/```(?:json)?/gi, '').trim();
    answer = JSON.parse(cleaned);
  } catch {
    throw new Error(`Failed to parse LLM response as JSON: "${rawContent}"`);
  }

  if (!answer || typeof answer.choice !== 'string' || !answer.choice.trim()) {
    throw new Error(`LLM response missing "choice" field: "${rawContent}"`);
  }

  const choiceLabel = answer.choice.trim().toUpperCase();
  const chosenIndex = options.findIndex((o) => o.label.toUpperCase() === choiceLabel);

  if (chosenIndex === -1) {
    const available = options.map((o) => o.label).join(', ');
    throw new Error(
      `Model selected unknown choice "${answer.choice}". Available options: [${available}]`
    );
  }

  return {
    chosenIndex,
    chosenLabel: options[chosenIndex].label,
  };
}
