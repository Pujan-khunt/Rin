import type { QuizChoice } from '@rin/shared';

export interface ParsedQuizChoice {
  chosenIndex: number;
  chosenLabel: string;
}

/**
 * Extracts and resolves the selected quiz option from raw LLM output.
 *
 * Supports structured JSON object parsing as well as markdown-wrapped or
 * partial JSON regex fallback.
 */
export function parseQuizChoice(rawContent: string, options: QuizChoice[]): ParsedQuizChoice {
  let choiceLabel = '';

  try {
    const parsed = JSON.parse(rawContent);
    choiceLabel = (parsed.choice || parsed.chosenLabel || parsed.label || '').trim();
  } catch {
    const match = rawContent.match(/"(?:choice|chosenLabel|label)"\s*:\s*"([A-Za-z0-9]+)"/i);
    if (match) {
      choiceLabel = match[1].trim();
    }
  }

  const chosenIndex = options.findIndex(
    (o) => o.label.toUpperCase() === choiceLabel.toUpperCase()
  );

  if (chosenIndex >= 0) {
    return {
      chosenIndex,
      chosenLabel: options[chosenIndex].label,
    };
  }

  // Graceful fallback to first option if model returned unknown or empty label
  const fallbackLabel = options[0]?.label ?? 'A';
  return {
    chosenIndex: 0,
    chosenLabel: fallbackLabel,
  };
}
