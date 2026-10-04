import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SolveResult } from '@rin/shared';
import { CLIENT_HEADER_NAME } from '@rin/shared';
import worker, { solve } from '@/index';
import { OPENROUTER_CHAT_URL, DEEPSEEK_MODEL_ID } from '@/constants';

const TEST_CLIENT_KEY = 'test-client-key';

describe('Cloudflare Worker Edge Proxy (OpenRouter Chat)', () => {
  const authHeaders = {
    'Content-Type': 'application/json',
    [CLIENT_HEADER_NAME]: TEST_CLIENT_KEY,
    Origin: 'chrome-extension://abcdefghijklmnopabcdefghijklmnop',
  };

  const defaultEnv = {
    OPENROUTER_API_KEY: 'test-key',
    RIN_CLIENT_KEY: TEST_CLIENT_KEY,
  };

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

  it('handles CORS OPTIONS preflight from extension origin', async () => {
    const request = new Request('http://localhost:8787/solve', {
      method: 'OPTIONS',
      headers: { Origin: 'chrome-extension://abcdefghijklmnopabcdefghijklmnop' },
    });
    const response = await worker.fetch(request, defaultEnv);

    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(
      'chrome-extension://abcdefghijklmnopabcdefghijklmnop'
    );
    expect(response.headers.get('Access-Control-Allow-Headers')).toContain(CLIENT_HEADER_NAME);
    expect(response.headers.get('Vary')).toBe('Origin');
  });

  it('rejects CORS OPTIONS preflight from untrusted web origin with 403', async () => {
    const request = new Request('http://localhost:8787/solve', {
      method: 'OPTIONS',
      headers: { Origin: 'https://malicious-website.com' },
    });
    const response = await worker.fetch(request, defaultEnv);

    expect(response.status).toBe(403);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('null');
  });

  it.each(['OPTIONS', 'POST'])('rejects localhost lookalike hosts for %s before inference', async (method) => {
    const request = new Request('http://localhost:8787/solve', {
      method,
      headers: { ...authHeaders, Origin: 'http://localhost.example.com' },
      ...(method === 'POST' ? {
        body: JSON.stringify({ question: 'Test?', options: [{ label: 'A', text: '1' }] }),
      } : {}),
    });

    const response = await worker.fetch(request, defaultEnv);

    expect(response.status).toBe(403);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('null');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('rejects CORS OPTIONS preflight missing Origin header with 403', async () => {
    const request = new Request('http://localhost:8787/solve', {
      method: 'OPTIONS',
    });
    const response = await worker.fetch(request, defaultEnv);

    expect(response.status).toBe(403);
  });

  it('rejects POST missing Origin header with 403', async () => {
    const request = new Request('http://localhost:8787/solve', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        [CLIENT_HEADER_NAME]: TEST_CLIENT_KEY,
      },
      body: JSON.stringify({ question: 'Test?', options: [{ label: 'A', text: '1' }] }),
    });

    const response = await worker.fetch(request, defaultEnv);
    expect(response.status).toBe(403);
    const data = (await response.json()) as { error: string };
    expect(data.error).toContain('Origin header required');
  });

  it('rejects POST from untrusted origin with 403', async () => {
    const request = new Request('http://localhost:8787/solve', {
      method: 'POST',
      headers: {
        ...authHeaders,
        Origin: 'https://malicious-website.com',
      },
      body: JSON.stringify({ question: 'Test?', options: [{ label: 'A', text: '1' }] }),
    });

    const response = await worker.fetch(request, defaultEnv);
    expect(response.status).toBe(403);
    const data = (await response.json()) as { error: string };
    expect(data.error).toContain('Origin header required');
  });

  it('rejects request with 500 when RIN_CLIENT_KEY is missing from worker env', async () => {
    const request = new Request('http://localhost:8787/solve', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        question: 'What is usually cache line size?',
        options: [{ label: 'A', text: '64 bytes' }],
      }),
    });

    const response = await worker.fetch(request, { OPENROUTER_API_KEY: 'test-key' });
    expect(response.status).toBe(500);
    const data = (await response.json()) as { error: string };
    expect(data.error).toContain('RIN_CLIENT_KEY is missing');
  });

  it('rejects request with 500 when OPENROUTER_API_KEY is missing from worker env', async () => {
    const request = new Request('http://localhost:8787/solve', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        question: 'What is usually cache line size?',
        options: [{ label: 'A', text: '64 bytes' }],
      }),
    });

    const response = await worker.fetch(request, { RIN_CLIENT_KEY: TEST_CLIENT_KEY });
    expect(response.status).toBe(500);
    const data = (await response.json()) as { error: string };
    expect(data.error).toContain('OPENROUTER_API_KEY is missing');
  });

  it('rejects request missing X-Rin-Client header with 401', async () => {
    const request = new Request('http://localhost:8787/solve', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'chrome-extension://abcdefghijklmnopabcdefghijklmnop',
      },
      body: JSON.stringify({
        question: 'What is usually cache line size?',
        options: [{ label: 'A', text: '64 bytes' }],
      }),
    });

    const response = await worker.fetch(request, defaultEnv);
    expect(response.status).toBe(401);
    const data = (await response.json()) as { error: string };
    expect(data.error).toContain('Unauthorized');
  });

  it('rejects request with invalid X-Rin-Client header with 401', async () => {
    const request = new Request('http://localhost:8787/solve', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'chrome-extension://abcdefghijklmnopabcdefghijklmnop',
        [CLIENT_HEADER_NAME]: 'wrong-key',
      },
      body: JSON.stringify({
        question: 'What is usually cache line size?',
        options: [{ label: 'A', text: '64 bytes' }],
      }),
    });

    const response = await worker.fetch(request, defaultEnv);
    expect(response.status).toBe(401);
  });

  it('accepts custom configured RIN_CLIENT_KEY from worker env', async () => {
    const request = new Request('http://localhost:8787/solve', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'chrome-extension://abcdefghijklmnopabcdefghijklmnop',
        [CLIENT_HEADER_NAME]: 'my-production-secret',
      },
      body: JSON.stringify({
        question: 'What is usually cache line size?',
        options: [
          { label: 'A', text: '64 kb' },
          { label: 'B', text: '64 bytes' },
        ],
      }),
    });

    const response = await worker.fetch(request, {
      OPENROUTER_API_KEY: 'test-key',
      RIN_CLIENT_KEY: 'my-production-secret',
    });
    expect(response.status).toBe(200);
  });

  it('processes POST /solve with default model via Chat Completions API', async () => {
    const request = new Request('http://localhost:8787/solve', {
      method: 'POST',
      headers: {
        ...authHeaders,
        Origin: 'moz-extension://e7f53a99-4d92-4f3d-82d1-039c647b5921',
      },
      body: JSON.stringify({
        question: 'What is usually cache line size?',
        options: [
          { label: 'A', text: '64 kb' },
          { label: 'B', text: '64 bytes' },
        ],
      }),
    });

    const response = await worker.fetch(request, {
      OPENROUTER_API_KEY: 'sk-or-v1-test',
      RIN_CLIENT_KEY: TEST_CLIENT_KEY,
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(
      'moz-extension://e7f53a99-4d92-4f3d-82d1-039c647b5921'
    );

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
      headers: authHeaders,
      body: JSON.stringify({}),
    });

    const response = await worker.fetch(request, defaultEnv);
    expect(response.status).toBe(400);
  });

  it('rejects unsupported HTTP methods with 405', async () => {
    const request = new Request('http://localhost:8787/solve', {
      method: 'GET',
      headers: authHeaders,
    });
    const response = await worker.fetch(request, defaultEnv);
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
      headers: authHeaders,
      body: JSON.stringify({
        question: 'What is alignof(double) on x86_64?',
        options: [
          { label: 'A', text: '4' },
          { label: 'B', text: '8' },
        ],
        model: 'google/gemini-2.5-flash',
      }),
    });

    const response = await worker.fetch(request, {
      OPENROUTER_API_KEY: 'sk-or-v1-test',
      RIN_CLIENT_KEY: TEST_CLIENT_KEY,
    });
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
      headers: authHeaders,
      body: JSON.stringify({
        question: 'Test question',
        options: [
          { label: 'A', text: 'Option A' },
          { label: 'B', text: 'Option B' },
        ],
        model: 'openai/gpt-4o-mini',
      }),
    });

    const response = await worker.fetch(request, defaultEnv);
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
      headers: authHeaders,
      body: JSON.stringify({
        question: 'Test question',
        options: [{ label: 'A', text: 'Option A' }],
      }),
    });

    const response = await worker.fetch(request, defaultEnv);
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
