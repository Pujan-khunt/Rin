import type { QuizInput } from '@rin/shared';
import { DEEPSEEK_MODEL_ID } from '@rin/shared';
import { QUIZ_SOLVER_SYSTEM_PROMPT } from '@/constants';

export interface ChatCompletionPayload {
  model: string;
  messages: Array<{ role: 'system' | 'user'; content: string }>;
  response_format: { type: 'json_object' };
  temperature: number;
  max_tokens: number;
  thinking?: { type: 'enabled' | 'disabled' };
}

/**
 * Formats question choices into a readable text list:
 * A: Option 1
 * B: Option 2
 */
export function formatOptionsText(options: QuizInput['options']): string {
  return options.map((opt) => `${opt.label}: ${opt.text}`).join('\n');
}

/**
 * Constructs the standardized DeepSeek Chat Completions request payload.
 */
export function buildChatPayload(quiz: QuizInput): ChatCompletionPayload {
  const optionsText = formatOptionsText(quiz.options);

  return {
    model: DEEPSEEK_MODEL_ID,
    messages: [
      {
        role: 'system',
        content: QUIZ_SOLVER_SYSTEM_PROMPT,
      },
      {
        role: 'user',
        content: `Question: ${quiz.question}\n\nOptions:\n${optionsText}\n\nRespond with a JSON object containing "choice" and "reasoning".`,
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0,
    max_tokens: 1024,
    thinking: { type: 'disabled' },
  };
}
