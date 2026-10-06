export type LogLevel = 'info' | 'warn' | 'error';

export interface StructuredLogPayload {
  timestamp: string;
  level: LogLevel;
  event: string;
  message: string;
  requestId?: string;
  [key: string]: unknown;
}

const REDACTED_KEYS = new Set([
  'authorization',
  'x-rin-client',
  'deepseek_api_key',
  'rin_client_key',
  'apikey',
  'secret',
]);

function sanitize(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value !== 'object') return value;

  if (Array.isArray(value)) {
    return value.map(sanitize);
  }

  const sanitized: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (REDACTED_KEYS.has(k.toLowerCase())) {
      sanitized[k] = '[REDACTED]';
    } else {
      sanitized[k] = sanitize(v);
    }
  }
  return sanitized;
}

export function log(
  level: LogLevel,
  event: string,
  message: string,
  data?: Record<string, unknown>,
  requestId?: string
): void {
  const payload: StructuredLogPayload = {
    timestamp: new Date().toISOString(),
    level,
    event,
    message: `[${event}] ${message}`,
    ...(requestId ? { requestId } : {}),
    ...(data ? (sanitize(data) as Record<string, unknown>) : {}),
  };

  const output = JSON.stringify(payload);
  if (level === 'error') {
    console.error(output);
  } else if (level === 'warn') {
    console.warn(output);
  } else {
    console.log(output);
  }
}

export const workerLogger = {
  info: (event: string, message: string, data?: Record<string, unknown>, requestId?: string) =>
    log('info', event, message, data, requestId),
  warn: (event: string, message: string, data?: Record<string, unknown>, requestId?: string) =>
    log('warn', event, message, data, requestId),
  error: (event: string, message: string, data?: Record<string, unknown>, requestId?: string) =>
    log('error', event, message, data, requestId),
};
