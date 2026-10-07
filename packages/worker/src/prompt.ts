import type { QuizInput, SolverMode } from '@rin/shared';
import { DEEPSEEK_MODEL_ID } from '@rin/shared';
import { FAST_MODE_SYSTEM_PROMPT, REASONING_MODE_SYSTEM_PROMPT } from '@/constants';

export interface ChatCompletionPayload {
  model: string;
  messages: Array<{ role: 'system' | 'user'; content: string }>;
  response_format: { type: 'json_object' };
  temperature: number;
  max_tokens: number;
  thinking?: { type: 'enabled' | 'disabled' };
}

interface ModeSettings {
  systemPrompt: string;
  promptSuffix: string;
  maxTokens: number;
  thinking: 'enabled' | 'disabled';
}

const MODE_CONFIGS: Record<SolverMode, ModeSettings> = {
  fast: {
    systemPrompt: FAST_MODE_SYSTEM_PROMPT,
    promptSuffix: 'Respond with a JSON object containing "choice".',
    maxTokens: 128,
    thinking: 'disabled',
  },
  reasoning: {
    systemPrompt: REASONING_MODE_SYSTEM_PROMPT,
    promptSuffix: 'Respond with a JSON object containing "choice" and "reasoning".',
    maxTokens: 4096,
    thinking: 'enabled',
  },
};

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
  const mode: SolverMode = quiz.mode ?? 'fast';
  const config = MODE_CONFIGS[mode] ?? MODE_CONFIGS.fast;
  const optionsText = formatOptionsText(quiz.options);

  return {
    model: DEEPSEEK_MODEL_ID,
    messages: [
      {
        role: 'system',
        content: config.systemPrompt,
      },
      {
        role: 'user',
        content: `Question: ${quiz.question}\n\nOptions:\n${optionsText}\n\n${config.promptSuffix}`,
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0,
    max_tokens: config.maxTokens,
    thinking: { type: config.thinking },
  };
}

