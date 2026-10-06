import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { workerLogger, log } from '@/logger';

describe('Worker Structured Logger', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('outputs structured JSON payload to console.log for info level', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    workerLogger.info('TEST_EVENT', 'Sample info message', { foo: 'bar' }, 'req-123');

    expect(logSpy).toHaveBeenCalledTimes(1);
    const raw = logSpy.mock.calls[0]![0] as string;
    const parsed = JSON.parse(raw);

    expect(parsed).toMatchObject({
      level: 'info',
      event: 'TEST_EVENT',
      message: '[TEST_EVENT] Sample info message',
      requestId: 'req-123',
      foo: 'bar',
    });
    expect(parsed.timestamp).toBeDefined();
  });

  it('outputs to console.warn for warn level', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    workerLogger.warn('WARN_EVENT', 'Warning occurred', { count: 3 });

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(warnSpy.mock.calls[0]![0] as string);
    expect(parsed.level).toBe('warn');
    expect(parsed.event).toBe('WARN_EVENT');
    expect(parsed.message).toBe('[WARN_EVENT] Warning occurred');
    expect(parsed.count).toBe(3);
  });

  it('outputs to console.error for error level', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    workerLogger.error('ERROR_EVENT', 'Fatal error message', { err: 'Fatal' }, 'req-999');

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(errorSpy.mock.calls[0]![0] as string);
    expect(parsed.level).toBe('error');
    expect(parsed.event).toBe('ERROR_EVENT');
    expect(parsed.message).toBe('[ERROR_EVENT] Fatal error message');
    expect(parsed.requestId).toBe('req-999');
    expect(parsed.err).toBe('Fatal');
  });

  it('redacts sensitive keys in logs', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    log('info', 'AUTH_CHECK', 'Checking auth headers', {
      authorization: 'Bearer secret-token',
      'X-Rin-Client': 'super-secret',
      deepseek_api_key: 'sk-12345',
      nested: {
        apiKey: 'secret-api-key',
        safeProperty: 'visible',
      },
    });

    const parsed = JSON.parse(logSpy.mock.calls[0]![0] as string);
    expect(parsed.authorization).toBe('[REDACTED]');
    expect(parsed['X-Rin-Client']).toBe('[REDACTED]');
    expect(parsed.deepseek_api_key).toBe('[REDACTED]');
    expect(parsed.nested.apiKey).toBe('[REDACTED]');
    expect(parsed.nested.safeProperty).toBe('visible');
    expect(parsed.message).toBe('[AUTH_CHECK] Checking auth headers');
  });
});
