import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DeepSeekClient, DeepSeekTimeoutError } from '@/client';
import { DEEPSEEK_TIMEOUT_MS } from '@/constants';
import { buildChatPayload } from '@/prompt';

describe('DeepSeek request timeout and client', () => {
  const payload = buildChatPayload({
    question: 'Question',
    options: [{ label: 'A', text: 'Answer' }],
  });

  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it.each(['fetch', 'body'])('aborts a stalled %s and rejects with a timeout error', async (stage) => {
    let signal!: AbortSignal;
    const fetchMock = vi.fn((_url: string, init: RequestInit) => {
      signal = init.signal as AbortSignal;
      const stalled = new Promise<never>((_resolve, reject) => {
        signal?.addEventListener('abort', () => reject(signal.reason), { once: true });
      });
      return stage === 'fetch' ? stalled : Promise.resolve({ ok: true, json: () => stalled });
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = new DeepSeekClient().complete(payload, 'test-key');
    const rejection = expect(result).rejects.toThrow('DeepSeek request timed out after 10000ms');
    expect(signal).toBeInstanceOf(AbortSignal);
    await vi.advanceTimersByTimeAsync(DEEPSEEK_TIMEOUT_MS - 1);
    expect(signal.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);

    await rejection;
    expect(signal.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('returns a successful response and clears the timer', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '{"choice":"A"}' } }] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(new DeepSeekClient().complete(payload, 'test-key')).resolves.toBe('{"choice":"A"}');
    const signal = fetchMock.mock.calls[0]![1].signal as AbortSignal;
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(DEEPSEEK_TIMEOUT_MS);
    expect(signal.aborted).toBe(false);
  });

  it.each([
    { ok: false, status: 502 },
    { ok: true, json: async () => { throw new Error('Invalid upstream JSON'); } },
  ])('clears the timer when the upstream response fails', async (response) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));

    await expect(new DeepSeekClient().complete(payload, 'test-key')).rejects.toThrow();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('includes error response body text in error message when upstream returns non-ok status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => '{"error": {"message": "Insufficient Balance"}}',
      })
    );

    await expect(new DeepSeekClient().complete(payload, 'test-key')).rejects.toThrow(
      'DeepSeek API error: 400: {"error": {"message": "Insufficient Balance"}}'
    );
    expect(vi.getTimerCount()).toBe(0);
  });

  it('formats error without detail when error response body is empty or whitespace', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => '   ',
      })
    );

    await expect(new DeepSeekClient().complete(payload, 'test-key')).rejects.toThrow(
      'DeepSeek API error: 500'
    );
    expect(vi.getTimerCount()).toBe(0);
  });

  it('preserves network errors and clears the timer', async () => {
    const error = new Error('Connection failed');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(error));

    await expect(new DeepSeekClient().complete(payload, 'test-key')).rejects.toBe(error);
    expect(vi.getTimerCount()).toBe(0);
  });
});
