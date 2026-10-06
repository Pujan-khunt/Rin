import type { LogLevel, LogPayload } from '@/messaging/types';

const LEVEL_COLORS: Record<LogLevel, string> = {
  debug: 'color: #9e9e9e',
  info: 'color: #00bcd4; font-weight: bold',
  warn: 'color: #ff9800; font-weight: bold',
  error: 'color: #f44336; font-weight: bold',
};

const TIME_STYLE = 'color: #757575';
const TAG_STYLE = 'color: #9c27b0; font-weight: bold';
const RESET_STYLE = 'color: inherit';

/**
 * Formats a Unix timestamp into human-readable HH:mm:ss.SSS format.
 */
export function formatTimestamp(timestamp: number): string {
  const d = new Date(timestamp);
  const pad = (n: number, z = 2) => String(n).padStart(z, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
}

/**
 * Checks if the current execution context is the background service worker or page.
 */
export function isBackgroundContext(): boolean {
  return (
    'ServiceWorkerGlobalScope' in globalThis ||
    (typeof location !== 'undefined' && location.pathname.includes('background'))
  );
}

/**
 * Formats and outputs structured log entries in the background service worker console.
 */
export function prettyPrintLog(payload: LogPayload, forceBrowserStyle?: boolean): void {
  const { level, tag, message, timestamp, data } = payload;
  const timeStr = formatTimestamp(timestamp);
  const isStyled = forceBrowserStyle ?? (typeof window !== 'undefined' || typeof navigator !== 'undefined');

  const args: unknown[] = isStyled
    ? [
        `%c[${timeStr}] %c[${level.toUpperCase()}]%c [${tag}]%c ${message}`,
        TIME_STYLE,
        LEVEL_COLORS[level],
        TAG_STYLE,
        RESET_STYLE,
      ]
    : [`[${timeStr}] [${level.toUpperCase()}] [${tag}] ${message}`];

  if (data !== undefined) {
    args.push(data);
  }

  const consoleMethod = console[level] ?? console.log;
  consoleMethod(...args);
}

/**
 * Dispatches a structured log entry.
 * - In background worker: pretty-prints directly to console.
 * - In content script or popup: proxies via browser.runtime.sendMessage to background worker.
 * - In production mode: no-op.
 */
function dispatch(level: LogLevel, tag: string, message: string, data?: unknown): void {
  if (!import.meta.env.DEV) return;

  const payload: LogPayload = {
    level,
    tag,
    message,
    data,
    timestamp: Date.now(),
  };

  if (isBackgroundContext()) {
    prettyPrintLog(payload);
    return;
  }

  try {
    browser.runtime.sendMessage({ type: 'LOG', payload }).catch(() => {
      // Graceful silence: ignore when worker is sleeping, invalid, or re-arming
    });
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
