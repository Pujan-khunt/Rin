import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WorkerClient, DEFAULT_WORKER_URL } from '@/solver/client';

describe('Extension WorkerClient', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        chosenIndex: 0,
        chosenLabel: 'A',
        source: 'deepseek/deepseek-v4-flash',
        latencyMs: 35,
      }),
    });
  });

  it('sends QuizInput to configured worker endpoint and returns SolveResult', async () => {
    const client = new WorkerClient('https://mock-worker.workers.dev/solve');
    const result = await client.solve({
      question: 'Test?',
      options: [{ label: 'A', text: 'Ans' }],
    });

    expect(result.chosenIndex).toBe(0);
    expect(result.chosenLabel).toBe('A');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://mock-worker.workers.dev/solve',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Rin-Client': 'test-client-key',
        },
        body: JSON.stringify({
          question: 'Test?',
          options: [{ label: 'A', text: 'Ans' }],
        }),
      })
    );
  });

  it('uses explicitly provided clientKey when passed to constructor', async () => {
    const client = new WorkerClient('https://mock-worker.workers.dev/solve', 5000, 'custom-key');
    await client.solve({
      question: 'Custom key test?',
      options: [{ label: 'A', text: 'Ans' }],
    });

    expect(global.fetch).toHaveBeenCalledWith(
      'https://mock-worker.workers.dev/solve',
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-Rin-Client': 'custom-key',
        }),
      })
    );
  });

  it('throws an error if clientKey is missing from constructor and import.meta.env', () => {
    const originalKey = import.meta.env.RIN_CLIENT_KEY;
    try {
      (import.meta.env as any).RIN_CLIENT_KEY = '';
      expect(() => new WorkerClient('https://mock-worker.workers.dev/solve', 5000, '')).toThrow(
        'WorkerClient initialization failed: RIN_CLIENT_KEY is missing'
      );
    } finally {
      (import.meta.env as any).RIN_CLIENT_KEY = originalKey;
    }
  });

  it('uses DEFAULT_WORKER_URL when no endpoint is provided', async () => {
    const client = new WorkerClient();
    await client.solve({
      question: 'Default URL test?',
      options: [{ label: 'A', text: 'Ans' }],
    });

    expect(global.fetch).toHaveBeenCalledWith(
      DEFAULT_WORKER_URL,
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('throws an error with worker message when worker returns non-ok response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Internal Server Error' }),
    });

    const client = new WorkerClient();
    await expect(
      client.solve({
        question: 'Error test',
        options: [{ label: 'A', text: '1' }],
      })
    ).rejects.toThrow('Worker returned HTTP 500: Internal Server Error');
  });

  it('throws an error with status code when worker error body has no error property', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => ({}),
    });

    const client = new WorkerClient();
    await expect(
      client.solve({
        question: 'Error test',
        options: [{ label: 'A', text: '1' }],
      })
    ).rejects.toThrow('Worker returned HTTP 502');
  });

  it('passes AbortSignal to fetch and rejects on timeout', async () => {
    global.fetch = vi.fn().mockImplementation((_url, init) => {
      expect(init.signal).toBeInstanceOf(AbortSignal);
      return Promise.reject(new DOMException('The operation was aborted due to timeout', 'TimeoutError'));
    });

    const client = new WorkerClient(DEFAULT_WORKER_URL, 5000);
    await expect(
      client.solve({
        question: 'Timeout test',
        options: [{ label: 'A', text: '1' }],
      })
    ).rejects.toThrow('The operation was aborted due to timeout');
  });
});
