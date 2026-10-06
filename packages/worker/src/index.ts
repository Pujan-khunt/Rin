import type { QuizInput, SolveResult } from '@rin/shared';
import { DEEPSEEK_MODEL_ID } from '@rin/shared';
import { buildChatPayload, type ChatCompletionPayload } from '@/prompt';
import { parseQuizChoice, type ParsedQuizChoice } from '@/parser';
import { DeepSeekClient, DeepSeekTimeoutError, type InferenceClient } from '@/client';
import {
  handleOptions,
  jsonResponse,
  errorResponse,
  validateQuizInput,
  authenticateRequest,
  isAllowedOrigin,
  type Env,
} from '@/http';

export type { Env };

const defaultClient = new DeepSeekClient();

/**
 * Coordinates worker-side quiz solving:
 * 1. Builds chat completion prompt payload
 * 2. Invokes inference client
 * 3. Parses choice from output
 * 4. Returns the choice and worker-side duration, excluding client transport
 */
export async function solve(
  quiz: QuizInput,
  apiKey: string,
  client: InferenceClient = defaultClient
): Promise<SolveResult> {
  const start = performance.now();

  const payload: ChatCompletionPayload = buildChatPayload(quiz);
  const rawContent: string = await client.complete(payload, apiKey);
  const choice: ParsedQuizChoice = parseQuizChoice(rawContent, quiz.options);

  return {
    chosenIndex: choice.chosenIndex,
    chosenLabel: choice.chosenLabel,
    source: DEEPSEEK_MODEL_ID,
    latencyMs: Math.round(performance.now() - start),
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return handleOptions(request);
    }

    if (request.method !== 'POST') {
      return errorResponse('Method Not Allowed', request, 405);
    }

    const origin = request.headers.get('Origin');
    if (!isAllowedOrigin(origin)) {
      return errorResponse(
        'Forbidden: Origin header required and must belong to an authorized extension or localhost',
        request,
        403
      );
    }

    const authError = authenticateRequest(request, env);
    if (authError) {
      return authError;
    }

    try {
      const input = (await request.json()) as unknown;
      if (!validateQuizInput(input)) {
        return errorResponse('Invalid QuizInput payload', request, 400);
      }

      const apiKey = env.DEEPSEEK_API_KEY as string;
      const result = await solve(input, apiKey);

      return jsonResponse(result, request);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Internal solver error';
      return errorResponse(message, request, err instanceof DeepSeekTimeoutError ? 504 : 500);
    }
  },
};
