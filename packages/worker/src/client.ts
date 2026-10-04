import { OPENROUTER_CHAT_URL, OPENROUTER_TIMEOUT_MS } from '@/constants';
import type { ChatCompletionPayload } from '@/prompt';

export interface InferenceClient {
  complete(payload: ChatCompletionPayload, apiKey: string): Promise<string>;
}

export class OpenRouterTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`OpenRouter request timed out after ${timeoutMs}ms`);
    this.name = 'OpenRouterTimeoutError';
  }
}

/**
 * HTTP client communicating with OpenRouter /v1/chat/completions.
 */
export class OpenRouterClient implements InferenceClient {
  constructor(
    private readonly endpoint: string = OPENROUTER_CHAT_URL,
    private readonly timeoutMs: number = OPENROUTER_TIMEOUT_MS
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
        throw new Error(`OpenRouter Chat API error: ${res.status}`);
      }

      const data = (await res.json()) as any;
      return data.choices?.[0]?.message?.content ?? '';
    } catch (err) {
      if (controller.signal.aborted) {
        throw new OpenRouterTimeoutError(this.timeoutMs);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
}
