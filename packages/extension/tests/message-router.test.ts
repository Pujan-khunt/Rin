import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MessageRouter } from '../src/messaging/router';
import { logger } from '../src/messaging/logger';
import type { QuizInput, SolveResult } from '@rin/shared';

describe('MessageRouter', () => {
  let messageListener: (
    msg: unknown,
    sender: unknown,
    sendResponse: (res: any) => void
  ) => boolean | undefined;

  beforeEach(() => {
    vi.restoreAllMocks();
    (globalThis as any).browser = {
      runtime: {
        onMessage: {
          addListener: vi.fn((listener) => {
            messageListener = listener;
          }),
        },
      },
    };
  });

  it('supports method chaining when registering handlers', () => {
    const router = new MessageRouter();
    const result = router
      .register('GET_CONFIG', async () => ({
        type: 'CONFIG',
        payload: { enabled: true, actorMode: 'auto' },
      }))
      .register('LOG', async () => ({
        type: 'ACK',
      }));

    expect(result).toBe(router);
  });

  it('attaches listener to browser.runtime.onMessage on listen()', () => {
    const router = new MessageRouter();
    router.listen();

    expect((globalThis as any).browser.runtime.onMessage.addListener).toHaveBeenCalledTimes(1);
    expect(typeof messageListener).toBe('function');
  });

  it('routes registered message and resolves asynchronously', async () => {
    const router = new MessageRouter();
    const mockResult: SolveResult = {
      chosenIndex: 1,
      chosenLabel: 'B',
      source: 'llm',
      latencyMs: 85,
    };
    const solveQuizHandler = vi.fn(async (_payload: QuizInput) => ({
      type: 'QUIZ_SOLVED' as const,
      payload: mockResult,
    }));

    router.register('SOLVE_QUIZ', solveQuizHandler);
    router.listen();

    const sendResponse = vi.fn();
    const inputQuiz: QuizInput = {
      question: 'What is 1+1?',
      options: [
        { label: 'A', text: '1' },
        { label: 'B', text: '2' },
      ],
    };

    const keepOpen = messageListener(
      { type: 'SOLVE_QUIZ', payload: inputQuiz },
      { id: 'fake-sender' },
      sendResponse
    );

    expect(keepOpen).toBe(true);
    expect(solveQuizHandler).toHaveBeenCalledWith(inputQuiz);

    await vi.waitFor(() => {
      expect(sendResponse).toHaveBeenCalledWith({
        type: 'QUIZ_SOLVED',
        payload: mockResult,
      });
    });
  });

  it('swallows sender parameter and passes only payload to handler', async () => {
    const router = new MessageRouter();
    let receivedArgCount = -1;
    let receivedPayload: any = null;

    router.register('LOG', async function (...args: any[]) {
      receivedArgCount = args.length;
      receivedPayload = args[0];
      return { type: 'ACK' };
    });
    router.listen();

    const logPayload = {
      level: 'info' as const,
      tag: 'Test',
      message: 'Hello',
      timestamp: Date.now(),
    };

    const sendResponse = vi.fn();
    messageListener(
      { type: 'LOG', payload: logPayload },
      { id: 'sender-to-swallow', url: 'https://meet.google.com' },
      sendResponse
    );

    await vi.waitFor(() => {
      expect(sendResponse).toHaveBeenCalledWith({ type: 'ACK' });
    });

    expect(receivedArgCount).toBe(1);
    expect(receivedPayload).toEqual(logPayload);
  });

  it('catches handler error and formats { type: "ERROR", payload: { message } }', async () => {
    const router = new MessageRouter();
    const loggerErrorSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});

    router.register('SOLVE_QUIZ', async () => {
      throw new Error('LLM rate limit reached');
    });
    router.listen();

    const sendResponse = vi.fn();
    const keepOpen = messageListener(
      {
        type: 'SOLVE_QUIZ',
        payload: { question: 'fail?', options: [{ label: 'A', text: 'a' }] },
      },
      {},
      sendResponse
    );

    expect(keepOpen).toBe(true);

    await vi.waitFor(() => {
      expect(sendResponse).toHaveBeenCalledWith({
        type: 'ERROR',
        payload: { message: 'LLM rate limit reached' },
      });
    });

    expect(loggerErrorSpy).toHaveBeenCalledWith(
      'MessageRouter',
      expect.stringContaining('LLM rate limit reached')
    );
  });

  it('formats non-Error rejections safely into string payload message', async () => {
    const router = new MessageRouter();
    vi.spyOn(logger, 'error').mockImplementation(() => {});

    router.register('GET_CONFIG', async () => {
      return Promise.reject('Unexpected string failure');
    });
    router.listen();

    const sendResponse = vi.fn();
    messageListener({ type: 'GET_CONFIG' }, {}, sendResponse);

    await vi.waitFor(() => {
      expect(sendResponse).toHaveBeenCalledWith({
        type: 'ERROR',
        payload: { message: 'Unexpected string failure' },
      });
    });
  });

  it('returns false and does not call sendResponse for unregistered or unknown message types', () => {
    const router = new MessageRouter();
    router.register('LOG', async () => ({ type: 'ACK' }));
    router.listen();

    const sendResponse = vi.fn();
    const handledUnknown = messageListener(
      { type: 'UNKNOWN_TYPE' as any },
      {},
      sendResponse
    );

    expect(handledUnknown).toBe(false);
    expect(sendResponse).not.toHaveBeenCalled();
  });

  it('returns false gracefully when message is null, undefined, or missing type', () => {
    const router = new MessageRouter();
    router.listen();

    const sendResponse = vi.fn();

    expect(messageListener(null, {}, sendResponse)).toBe(false);
    expect(messageListener(undefined, {}, sendResponse)).toBe(false);
    expect(messageListener({}, {}, sendResponse)).toBe(false);
    expect(sendResponse).not.toHaveBeenCalled();
  });
});
