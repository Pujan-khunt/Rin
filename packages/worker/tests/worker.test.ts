import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SolveResult } from '@rin/shared';
import worker from '../src/index';
import { OPENROUTER_DECISIONS_URL, JEV_MODEL_ID } from '../src/constants';

describe('Cloudflare Worker Edge Proxy (OpenRouter Jev)', () => {
  beforeEach(() => {
    // Mock global fetch for AI provider
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'gen-dec-12345',
        model: 'typesafe/jev-1.13-20260917',
        provider: 'TypeSafe',
        answers: {
          answer: {
            type: 'choice',
            choice: 'B',
            confidence: 0.94,
            probabilities: { A: 0.06, B: 0.94 },
          },
        },
        usage: { input_tokens: 120, output_tokens: 10, cost: 0.000005 },
      }),
    });
  });

  it('handles CORS OPTIONS preflight', async () => {
    const request = new Request('http://localhost:8787/solve', { method: 'OPTIONS' });
    const response = await worker.fetch(request, { OPENROUTER_API_KEY: 'test-key' });

    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });

  it('processes POST /solve and dispatches to OpenRouter Decisions API', async () => {
    const request = new Request('http://localhost:8787/solve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: 'What is usually cache line size?',
        options: [
          { label: 'A', text: '64 bytes' },
          { label: 'B', text: '64 kb' },
        ],
      }),
    });

    const response = await worker.fetch(request, { OPENROUTER_API_KEY: 'sk-or-v1-test' });
    expect(response.status).toBe(200);

    expect(global.fetch).toHaveBeenCalledWith(
      OPENROUTER_DECISIONS_URL,
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer sk-or-v1-test',
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({
          model: JEV_MODEL_ID,
          state: 'What is usually cache line size?',
          questions: {
            answer: {
              type: 'choice',
              instructions: 'Which option correctly answers the question?',
              criteria: {
                A: '64 bytes',
                B: '64 kb',
              },
            },
          },
        }),
      })
    );

    const data = (await response.json()) as SolveResult;
    expect(data.chosenIndex).toBe(1);
    expect(data.chosenLabel).toBe('B');
    expect(data.confidence).toBe(0.94);
    expect(data.source).toBe('jev');
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

  it('handles upstream OpenRouter service errors with 500', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
    });

    const request = new Request('http://localhost:8787/solve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: 'What is usually cache line size?',
        options: [{ label: 'A', text: '64 bytes' }],
      }),
    });

    const response = await worker.fetch(request, { OPENROUTER_API_KEY: 'test-key' });
    expect(response.status).toBe(500);
    const data = (await response.json()) as { error: string };
    expect(data.error).toContain('Jev API error: 502');
  });

  it('dispatches to OpenRouter Chat Completions when a non-Jev model is specified', async () => {
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
        model: 'google/gemini-2.5-flash-lite',
      }),
    });

    const response = await worker.fetch(request, { OPENROUTER_API_KEY: 'sk-or-v1-test' });
    expect(response.status).toBe(200);

    expect(global.fetch).toHaveBeenCalledWith(
      'https://openrouter.ai/api/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer sk-or-v1-test',
          'Content-Type': 'application/json',
        }),
        body: expect.stringContaining('"model":"google/gemini-2.5-flash-lite"'),
      })
    );

    const data = (await response.json()) as SolveResult;
    expect(data.chosenIndex).toBe(1);
    expect(data.chosenLabel).toBe('B');
    expect(data.source).toBe('google/gemini-2.5-flash-lite');
  });

  it('handles regex fallback when chat model returns wrapped or slightly malformed JSON', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: 'The answer is: ```json\n{"choice": "A"}\n```',
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
      status: 401,
    });

    const request = new Request('http://localhost:8787/solve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: 'Test question',
        options: [{ label: 'A', text: 'Option A' }],
        model: 'google/gemini-2.5-flash-lite',
      }),
    });

    const response = await worker.fetch(request, { OPENROUTER_API_KEY: 'test-key' });
    expect(response.status).toBe(500);
    const data = (await response.json()) as { error: string };
    expect(data.error).toContain('OpenRouter Chat API error: 401');
  });
});
