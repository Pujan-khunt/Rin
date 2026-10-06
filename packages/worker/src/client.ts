import { DEEPSEEK_API_URL, DEEPSEEK_TIMEOUT_MS } from '@/constants';
import type { ChatCompletionPayload } from '@/prompt';

export interface InferenceClient {
  complete(payload: ChatCompletionPayload, apiKey: string): Promise<string>;
}

export class DeepSeekTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`DeepSeek request timed out after ${timeoutMs}ms`);
    this.name = 'DeepSeekTimeoutError';
  }
}

interface DeepSeekCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

/**
 * HTTP client communicating with official DeepSeek /chat/completions.
 */
export class DeepSeekClient implements InferenceClient {
  constructor(
    private readonly endpoint: string = DEEPSEEK_API_URL,
    private readonly timeoutMs: number = DEEPSEEK_TIMEOUT_MS
  ) {}

  async complete(payload: ChatCompletionPayload, apiKey: string): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
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

      if (!res.ok) {
        const errorBody = typeof res.text === 'function' ? await res.text().catch(() => '') : '';
        const detail = errorBody.trim() ? `: ${errorBody.trim()}` : '';
        throw new Error(`DeepSeek API error: ${res.status}${detail}`);
      }

      const data = (await res.json()) as DeepSeekCompletionResponse;
      return data.choices?.[0]?.message?.content ?? '';
    } catch (err) {
      if (controller.signal.aborted) {
        throw new DeepSeekTimeoutError(this.timeoutMs);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
}
