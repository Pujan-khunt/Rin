import { DEEPSEEK_API_URL, DEEPSEEK_TIMEOUT_MS } from '@/constants';
import type { ChatCompletionPayload } from '@/prompt';
import { workerLogger } from '@/logger';

export interface InferenceClient {
  complete(payload: ChatCompletionPayload, apiKey: string, requestId?: string): Promise<string>;
}

export class DeepSeekTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`DeepSeek request timed out after ${timeoutMs}ms`);
    this.name = 'DeepSeekTimeoutError';
  }
}

interface DeepSeekCompletionResponse {
  id?: string;
  choices?: Array<{
    message?: {
      content?: string;
      reasoning_content?: string;
    };
    finish_reason?: string;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

/**
 * HTTP client communicating with official DeepSeek /chat/completions.
 */
export class DeepSeekClient implements InferenceClient {
  constructor(
    private readonly endpoint: string = DEEPSEEK_API_URL,
    private readonly timeoutMs: number = DEEPSEEK_TIMEOUT_MS
  ) {}

  async complete(
    payload: ChatCompletionPayload,
    apiKey: string,
    requestId?: string
  ): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    const start = performance.now();

    workerLogger.info(
      'INFERENCE_DISPATCH',
      `Dispatching inference request to ${payload.model}`,
      {
        endpoint: this.endpoint,
        model: payload.model,
        max_tokens: payload.max_tokens,
      },
      requestId
    );

    try {
      const res = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      const durationMs = Math.round(performance.now() - start);

      if (!res.ok) {
        const errorBody = typeof res.text === 'function' ? await res.text().catch(() => '') : '';
        const detail = errorBody.trim() ? `: ${errorBody.trim()}` : '';
        workerLogger.error(
          'INFERENCE_FAILED',
          `DeepSeek API returned HTTP ${res.status}: ${errorBody.trim() || 'error'}`,
          {
            status: res.status,
            error: errorBody.trim(),
            durationMs,
          },
          requestId
        );
        throw new Error(`DeepSeek API error: ${res.status}${detail}`);
      }

      const data = (await res.json()) as DeepSeekCompletionResponse;
      const choice = data.choices?.[0];
      const content = choice?.message?.content?.trim();
      const reasoning = choice?.message?.reasoning_content?.trim();

      workerLogger.info(
        'INFERENCE_RESPONSE',
        `DeepSeek returned HTTP ${res.status} in ${durationMs}ms`,
        {
          status: res.status,
          durationMs,
          finishReason: choice?.finish_reason,
          usage: data.usage,
          hasContent: Boolean(content),
          hasReasoning: Boolean(reasoning),
        },
        requestId
      );

      if (!content) {
        const finishReason = choice?.finish_reason || 'unknown';
        workerLogger.error(
          'INFERENCE_EMPTY_CONTENT',
          `DeepSeek returned empty content (finish_reason: ${finishReason})`,
          {
            finishReason,
            hasReasoning: Boolean(reasoning),
            usage: data.usage,
          },
          requestId
        );
        throw new Error(`DeepSeek returned empty content (finish_reason: ${finishReason})`);
      }

      return content;
    } catch (err) {
      if (controller.signal.aborted) {
        workerLogger.error(
          'INFERENCE_TIMEOUT',
          `DeepSeek request timed out after ${this.timeoutMs}ms`,
          { timeoutMs: this.timeoutMs },
          requestId
        );
        throw new DeepSeekTimeoutError(this.timeoutMs);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
}
