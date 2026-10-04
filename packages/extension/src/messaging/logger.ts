import type { LogLevel, LogPayload } from '@/messaging/types';

/**
 * Formats a Unix timestamp into human-readable HH:mm:ss.SSS format.
 */
export function formatTimestamp(timestamp: number): string {
  const d = new Date(timestamp);
  const pad = (n: number, z = 2) => String(n).padStart(z, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
}

/**
 * Checks if the current execution context is the background worker/page.
 */
export function isBackgroundContext(): boolean {
  if (typeof (globalThis as Record<string, unknown>).ServiceWorkerGlobalScope !== 'undefined') return true;
  if (typeof location !== 'undefined' && location.pathname.includes('background')) return true;
  return false;
}

/**
 * Human-readable pretty-printer for the background service worker console.
 * Uses DevTools styling with distinct badges, timestamps, and component tags.
 */
export function prettyPrintLog(payload: LogPayload, forceBrowserStyle?: boolean): void {
  const { level, tag, message, timestamp } = payload;
  const data = payload.data !== undefined ? payload.data : payload.context;
  const timeStr = formatTimestamp(timestamp);

  const isBrowser =
    forceBrowserStyle ??
    (typeof window !== 'undefined' ||
      (typeof navigator !== 'undefined' && /Chrome|Firefox|Safari/.test(navigator.userAgent)));

  if (isBrowser) {
    const levelColors: Record<LogLevel, string> = {
      debug: 'color: #9e9e9e',
      info: 'color: #00bcd4; font-weight: bold',
      warn: 'color: #ff9800; font-weight: bold',
      error: 'color: #f44336; font-weight: bold',
    };
    const timeStyle = 'color: #757575';
    const tagStyle = 'color: #9c27b0; font-weight: bold';
    const resetStyle = 'color: inherit';

    const format = `%c[${timeStr}] %c[${level.toUpperCase()}]%c [${tag}]%c ${message}`;
    const consoleMethod = console[level] ?? console.log;

    if (data !== undefined) {
      consoleMethod(format, timeStyle, levelColors[level], tagStyle, resetStyle, data);
    } else {
      consoleMethod(format, timeStyle, levelColors[level], tagStyle, resetStyle);
    }
  } else {
    const header = `[${timeStr}] [${level.toUpperCase()}] [${tag}] ${message}`;
    const consoleMethod = console[level] ?? console.log;
    if (data !== undefined) {
      consoleMethod(header, data);
    } else {
      consoleMethod(header);
    }
  }
}

/**
 * Dispatches a structured log entry.
 *
 * In DEV mode:
 * - If in background service worker, pretty-prints directly to background console.
 * - If in content script or popup, proxies via browser.runtime.sendMessage to background worker.
 *
 * In PROD mode:
 * - Returns without printing or forwarding a log. Call-site arguments may still
 *   be evaluated; prettyPrintLog remains callable by the background LOG route.
 */
function dispatch(level: LogLevel, tag: string, message: string, data?: unknown): void {
  if (!import.meta.env.DEV) return;

  const payload: LogPayload = {
    level,
    tag,
    message,
    data,
    context: data,
    timestamp: Date.now(),
  };

  if (isBackgroundContext()) {
    prettyPrintLog(payload);
    return;
  }

  // Content script or extension UI: proxy to background worker
  try {
    if (typeof browser !== 'undefined' && browser.runtime?.sendMessage) {
      browser.runtime
        .sendMessage({
          type: 'LOG',
          payload,
        })
        .catch(() => {
          // Graceful silence: ignore when worker is sleeping, invalid, or re-arming
        });
    }
  } catch {
    // Graceful silence: logging must never crash content script or application flow
  }
}

export const logger = {
  debug: (tag: string, message: string, data?: unknown) => dispatch('debug', tag, message, data),
  info: (tag: string, message: string, data?: unknown) => dispatch('info', tag, message, data),
  warn: (tag: string, message: string, data?: unknown) => dispatch('warn', tag, message, data),
  error: (tag: string, message: string, data?: unknown) => dispatch('error', tag, message, data),
};
