import { OPENROUTER_CHAT_URL } from '@/constants';
import type { ChatCompletionPayload } from '@/prompt';

export interface InferenceClient {
  complete(payload: ChatCompletionPayload, apiKey: string): Promise<string>;
}

/**
 * HTTP client communicating with OpenRouter /v1/chat/completions.
 */
export class OpenRouterClient implements InferenceClient {
  constructor(private readonly endpoint: string = OPENROUTER_CHAT_URL) {}

  async complete(payload: ChatCompletionPayload, apiKey: string): Promise<string> {
    const res = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error(`OpenRouter Chat API error: ${res.status}`);
    }

    const data = (await res.json()) as any;
    return data.choices?.[0]?.message?.content ?? '';
  }
}
