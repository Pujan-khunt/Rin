import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SolveResult } from '@rin/shared';
import worker, { solve } from '../src/index';
import { OPENROUTER_CHAT_URL, DEEPSEEK_MODEL_ID } from '../src/constants';

describe('Cloudflare Worker Edge Proxy (OpenRouter Chat)', () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'gen-chat-default',
        choices: [
          {
            message: {
              content: '{"reasoning": "64 bytes is standard cache line size.", "choice": "B"}',
            },
          },
        ],
      }),
    });
  });

  it('handles CORS OPTIONS preflight', async () => {
    const request = new Request('http://localhost:8787/solve', { method: 'OPTIONS' });
    const response = await worker.fetch(request, { OPENROUTER_API_KEY: 'test-key' });

    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });

  it('processes POST /solve with default model via Chat Completions API', async () => {
    const request = new Request('http://localhost:8787/solve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: 'What is usually cache line size?',
        options: [
          { label: 'A', text: '64 kb' },
          { label: 'B', text: '64 bytes' },
        ],
      }),
    });

    const response = await worker.fetch(request, { OPENROUTER_API_KEY: 'sk-or-v1-test' });
    expect(response.status).toBe(200);

    expect(global.fetch).toHaveBeenCalledWith(
      OPENROUTER_CHAT_URL,
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer sk-or-v1-test',
        }),
        body: expect.stringContaining(`"model":"${DEEPSEEK_MODEL_ID}"`),
      })
    );

    const data = (await response.json()) as SolveResult;
    expect(data.chosenIndex).toBe(1);
    expect(data.chosenLabel).toBe('B');
    expect(data.source).toBe(DEEPSEEK_MODEL_ID);
  });

  it('rejects invalid payloads with 400', async () => {
    const request = new Request('http://localhost:8787/solve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const response = await worker.fetch(request, { OPENROUTER_API_KEY: 'test-key' });
    expect(response.status).toBe(400);
  });

  it('rejects unsupported HTTP methods with 405', async () => {
    const request = new Request('http://localhost:8787/solve', { method: 'GET' });
    const response = await worker.fetch(request, { OPENROUTER_API_KEY: 'test-key' });
    expect(response.status).toBe(405);
  });

  it('dispatches to OpenRouter Chat Completions when an explicit model is specified', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'gen-chat-12345',
        choices: [
          {
            message: {
              content: '{"choice": "B"}',
            },
          },
        ],
      }),
    });

    const request = new Request('http://localhost:8787/solve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: 'What is alignof(double) on x86_64?',
        options: [
          { label: 'A', text: '4' },
          { label: 'B', text: '8' },
        ],
        model: 'google/gemini-2.5-flash',
      }),
    });

    const response = await worker.fetch(request, { OPENROUTER_API_KEY: 'sk-or-v1-test' });
    expect(response.status).toBe(200);

    expect(global.fetch).toHaveBeenCalledWith(
      OPENROUTER_CHAT_URL,
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer sk-or-v1-test',
          'Content-Type': 'application/json',
        }),
        body: expect.stringContaining('"model":"google/gemini-2.5-flash"'),
      })
    );

    const data = (await response.json()) as SolveResult;
    expect(data.chosenIndex).toBe(1);
    expect(data.chosenLabel).toBe('B');
    expect(data.source).toBe('google/gemini-2.5-flash');
  });

  it('parses markdown code block wrapped JSON from chat model', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: '```json\n{"choice": "A"}\n```',
            },
          },
        ],
      }),
    });

    const request = new Request('http://localhost:8787/solve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: 'Test question',
        options: [
          { label: 'A', text: 'Option A' },
          { label: 'B', text: 'Option B' },
        ],
        model: 'openai/gpt-4o-mini',
      }),
    });

    const response = await worker.fetch(request, { OPENROUTER_API_KEY: 'test-key' });
    expect(response.status).toBe(200);
    const data = (await response.json()) as SolveResult;
    expect(data.chosenIndex).toBe(0);
    expect(data.chosenLabel).toBe('A');
    expect(data.source).toBe('openai/gpt-4o-mini');
  });

  it('handles upstream chat API error with 500', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
    });

    const request = new Request('http://localhost:8787/solve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: 'Test question',
        options: [{ label: 'A', text: 'Option A' }],
      }),
    });

    const response = await worker.fetch(request, { OPENROUTER_API_KEY: 'test-key' });
    expect(response.status).toBe(500);
    const data = (await response.json()) as { error: string };
    expect(data.error).toContain('OpenRouter Chat API error: 502');
  });

  it('solves quiz with custom injected InferenceClient without network fetch', async () => {
    const mockClient = {
      complete: vi.fn().mockResolvedValue('{"reasoning": "A is correct", "choice": "A"}'),
    };

    const result = await solve(
      {
        question: 'Injected client test',
        options: [
          { label: 'A', text: 'Option 1' },
          { label: 'B', text: 'Option 2' },
        ],
      },
      'test-api-key',
      mockClient
    );

    expect(result.chosenIndex).toBe(0);
    expect(result.chosenLabel).toBe('A');
    expect(result.source).toBe(DEEPSEEK_MODEL_ID);
    expect(mockClient.complete).toHaveBeenCalled();
  });
});
