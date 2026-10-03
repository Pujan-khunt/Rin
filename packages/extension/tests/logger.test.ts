import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger, formatTimestamp, prettyPrintLog, isBackgroundContext } from '@/messaging/logger';

describe('Logger Service', () => {
  let consoleSpy: Record<string, ReturnType<typeof vi.spyOn>>;
  const originalBrowser = (globalThis as any).browser;

  beforeEach(() => {
    consoleSpy = {
      debug: vi.spyOn(console, 'debug').mockImplementation(() => {}),
      info: vi.spyOn(console, 'info').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
    (globalThis as any).browser = originalBrowser;
  });

  it('formats timestamp into HH:mm:ss.SSS correctly', () => {
    const ts = new Date(2026, 8, 28, 11, 25, 30, 450).getTime();
    expect(formatTimestamp(ts)).toMatch(/^\d{2}:\d{2}:\d{2}\.450$/);
  });

  it('detects background context correctly', () => {
    expect(isBackgroundContext()).toBe(false);

    (globalThis as any).ServiceWorkerGlobalScope = class {};
    expect(isBackgroundContext()).toBe(true);
    delete (globalThis as any).ServiceWorkerGlobalScope;
  });

  it('pretty-prints log messages with styled format in browser-like environment', () => {
    const payload = {
      level: 'info' as const,
      tag: 'TestTag',
      message: 'Test message',
      timestamp: Date.now(),
    };

    prettyPrintLog(payload, true);
    expect(consoleSpy.info).toHaveBeenCalledWith(
      expect.stringContaining('[INFO]%c [TestTag]%c Test message'),
      expect.any(String),
      expect.any(String),
      expect.any(String),
      expect.any(String)
    );
  });

  it('pretty-prints log messages with plain text format in non-browser environment', () => {
    const payload = {
      level: 'warn' as const,
      tag: 'PlainTag',
      message: 'Plain message',
      timestamp: Date.now(),
    };

    prettyPrintLog(payload, false);
    expect(consoleSpy.warn).toHaveBeenCalledWith(
      expect.stringMatching(/\[\d{2}:\d{2}:\d{2}\.\d{3}\] \[WARN\] \[PlainTag\] Plain message/)
    );
  });

  it('pretty-prints log messages with extra data payload when provided', () => {
    const data = { foo: 'bar', count: 42 };
    const payload = {
      level: 'debug' as const,
      tag: 'DataTag',
      message: 'Data message',
      data,
      timestamp: Date.now(),
    };

    prettyPrintLog(payload, true);
    expect(consoleSpy.debug).toHaveBeenCalledWith(
      expect.stringContaining('[DEBUG]%c [DataTag]%c Data message'),
      expect.any(String),
      expect.any(String),
      expect.any(String),
      expect.any(String),
      data
    );
  });

  it('proxies log to background worker via browser.runtime.sendMessage in content script context', () => {
    const sendMessageMock = vi.fn().mockReturnValue(Promise.resolve());
    (globalThis as any).browser = {
      runtime: {
        sendMessage: sendMessageMock,
      },
    };

    logger.info('ContentTag', 'Hello from content script', { key: 'value' });

    expect(sendMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'LOG',
        payload: expect.objectContaining({
          level: 'info',
          tag: 'ContentTag',
          message: 'Hello from content script',
          data: { key: 'value' },
        }),
      })
    );
  });

  it('safely handles missing or failing browser.runtime without throwing', () => {
    (globalThis as any).browser = {
      runtime: {
        sendMessage: vi.fn().mockRejectedValue(new Error('Channel closed')),
      },
    };

    expect(() => {
      logger.error('ErrorTag', 'Background unreachable');
      logger.warn('WarnTag', 'Warning test');
      logger.debug('DebugTag', 'Debug test');
    }).not.toThrow();
  });
});
