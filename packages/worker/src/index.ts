import type { QuizInput, SolveResult } from '@rin/shared';
import { DEEPSEEK_MODEL_ID } from '@rin/shared';
import { buildChatPayload, type ChatCompletionPayload } from '@/prompt';
import { parseQuizChoice, type ParsedQuizChoice } from '@/parser';
import { DeepSeekClient, DeepSeekTimeoutError, type InferenceClient } from '@/client';
import { workerLogger } from '@/logger';
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
  client: InferenceClient = defaultClient,
  requestId?: string
): Promise<SolveResult> {
  const start = performance.now();

  workerLogger.info(
    'SOLVE_START',
    `Solving quiz (${quiz.options.length} options): "${quiz.question.slice(0, 60)}"`,
    {
      questionPreview: quiz.question.slice(0, 60),
      optionsCount: quiz.options.length,
    },
    requestId
  );

  const payload: ChatCompletionPayload = buildChatPayload(quiz);
  const rawContent: string = await client.complete(payload, apiKey, requestId);
  const choice: ParsedQuizChoice = parseQuizChoice(rawContent, quiz.options);

  const latencyMs = Math.round(performance.now() - start);
  workerLogger.info(
    'PARSE_SUCCESS',
    `Quiz solved: selected option ${choice.chosenLabel} (index ${choice.chosenIndex}) in ${latencyMs}ms`,
    {
      chosenIndex: choice.chosenIndex,
      chosenLabel: choice.chosenLabel,
      latencyMs,
    },
    requestId
  );

  return {
    chosenIndex: choice.chosenIndex,
    chosenLabel: choice.chosenLabel,
    source: DEEPSEEK_MODEL_ID,
    latencyMs,
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

    const requestId = request.headers.get('cf-ray') || crypto.randomUUID();
    const origin = request.headers.get('Origin');

    workerLogger.info(
      'REQUEST_START',
      `Ingress ${request.method} ${request.url} from ${origin || 'unknown'}`,
      {
        method: request.method,
        url: request.url,
        origin,
      },
      requestId
    );

    if (!isAllowedOrigin(origin)) {
      workerLogger.warn(
        'AUTH_FAILED',
        `Origin header unauthorized or missing: ${origin || 'null'}`,
        {
          reason: 'Origin header missing or unauthorized',
          origin,
        },
        requestId
      );
      return errorResponse(
        'Forbidden: Origin header required and must belong to an authorized extension or localhost',
        request,
        403
      );
    }

    const authError = authenticateRequest(request, env);
    if (authError) {
      workerLogger.warn(
        'AUTH_FAILED',
        'Client authentication failed (missing or invalid X-Rin-Client)',
        {
          reason: 'Authentication failed',
        },
        requestId
      );
      return authError;
    }

    try {
      const input = (await request.json()) as unknown;
      if (!validateQuizInput(input)) {
        workerLogger.warn(
          'INVALID_PAYLOAD',
          'Rejected malformed QuizInput payload',
          { reason: 'Malformed QuizInput' },
          requestId
        );
        return errorResponse('Invalid QuizInput payload', request, 400);
      }

      const apiKey = env.DEEPSEEK_API_KEY as string;
      const result = await solve(input, apiKey, defaultClient, requestId);

      workerLogger.info(
        'REQUEST_COMPLETE',
        `Finished /solve: option ${result.chosenLabel} in ${result.latencyMs}ms`,
        {
          chosenLabel: result.chosenLabel,
          latencyMs: result.latencyMs,
        },
        requestId
      );

      return jsonResponse(result, request);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Internal solver error';
      const stack = err instanceof Error ? err.stack : undefined;
      workerLogger.error(
        'REQUEST_FAILED',
        `Request failed: ${message}`,
        {
          error: message,
          stack,
          isTimeout: err instanceof DeepSeekTimeoutError,
        },
        requestId
      );
      return errorResponse(message, request, err instanceof DeepSeekTimeoutError ? 504 : 500);
    }
  },
};
