import type { QuizInput, SolveResult } from '@rin/shared';
import { DEFAULT_MODEL_ID } from './constants';
import { buildChatPayload } from './prompt';
import { parseQuizChoice } from './parser';
import { OpenRouterClient, type InferenceClient } from './client';
import {
  handleOptions,
  jsonResponse,
  errorResponse,
  validateQuizInput,
  validateClientKey,
  isAllowedOrigin,
} from './http';

export interface Env {
  OPENROUTER_API_KEY?: string;
  RIN_CLIENT_KEY?: string;
}

const defaultClient = new OpenRouterClient();

/**
 * Coordinates end-to-end quiz solving:
 * 1. Builds chat completion prompt payload
 * 2. Invokes inference client
 * 3. Parses choice from output
 * 4. Measures latency and returns normalized SolveResult
 */
export async function solve(
  quiz: QuizInput,
  apiKey: string,
  client: InferenceClient = defaultClient
): Promise<SolveResult> {
  const model = quiz.model?.trim() || DEFAULT_MODEL_ID;
  const start = performance.now();

  const payload = buildChatPayload(quiz, model);
  const rawContent = await client.complete(payload, apiKey);
  const choice = parseQuizChoice(rawContent, quiz.options);

  return {
    chosenIndex: choice.chosenIndex,
    chosenLabel: choice.chosenLabel,
    source: model,
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
      return errorResponse('Forbidden: Origin header required and must belong to an authorized extension or localhost', request, 403);
    }

    if (!validateClientKey(request, env.RIN_CLIENT_KEY)) {
      return errorResponse('Unauthorized: Invalid or missing X-Rin-Client header', request, 401);
    }

    try {
      const input = (await request.json()) as unknown;
      if (!validateQuizInput(input)) {
        return errorResponse('Invalid QuizInput payload', request, 400);
      }

      const apiKey = env.OPENROUTER_API_KEY || 'mock-key';
      const result = await solve(input, apiKey);

      return jsonResponse(result, request);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Internal solver error';
      return errorResponse(message, request, 500);
    }
  },
};
