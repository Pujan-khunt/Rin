import type { QuizInput } from '@rin/shared';
import { CLIENT_HEADER_NAME, DEFAULT_CLIENT_KEY } from '@rin/shared';

/**
 * Validates whether an incoming HTTP Origin belongs to a browser extension or local development.
 *
 * Disallows requests originating from untrusted web pages. If no Origin header is present
 * (such as background workers or server-to-server calls), returns true.
 */
export function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return true;

  return (
    origin.startsWith('chrome-extension://') ||
    origin.startsWith('moz-extension://') ||
    origin.startsWith('http://localhost') ||
    origin.startsWith('http://127.0.0.1')
  );
}

/**
 * Dynamically computes CORS headers based on the validated Origin.
 */
export function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowed = isAllowedOrigin(origin);
  const allowOrigin = allowed ? (origin ?? '*') : 'null';

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': `Content-Type, ${CLIENT_HEADER_NAME}`,
  };
}

/**
 * Responds to CORS preflight OPTIONS requests.
 */
export function handleOptions(request: Request): Response {
  const origin = request.headers.get('Origin');
  if (origin && !isAllowedOrigin(origin)) {
    return new Response(null, { status: 403, headers: getCorsHeaders(origin) });
  }

  return new Response(null, { status: 204, headers: getCorsHeaders(origin) });
}

/**
 * Creates a CORS-enabled JSON response.
 */
export function jsonResponse(data: unknown, request?: Request, status = 200): Response {
  const origin = request?.headers.get('Origin') ?? null;
  return Response.json(data, { status, headers: getCorsHeaders(origin) });
}

/**
 * Creates a CORS-enabled JSON error response.
 */
export function errorResponse(message: string, request?: Request, status = 500): Response {
  const origin = request?.headers.get('Origin') ?? null;
  return Response.json({ error: message }, { status, headers: getCorsHeaders(origin) });
}

/**
 * Validates the presence and validity of the X-Rin-Client header.
 */
export function validateClientKey(request: Request, clientSecret?: string): boolean {
  const expectedKey = clientSecret?.trim() || DEFAULT_CLIENT_KEY;
  const clientKey = request.headers.get(CLIENT_HEADER_NAME);
  return clientKey === expectedKey;
}

/**
 * Validates whether an incoming parsed JSON payload satisfies the QuizInput schema.
 */
export function validateQuizInput(input: unknown): input is QuizInput {
  if (!input || typeof input !== 'object') return false;
  const candidate = input as Record<string, unknown>;

  return (
    typeof candidate.question === 'string' &&
    candidate.question.trim().length > 0 &&
    Array.isArray(candidate.options) &&
    candidate.options.length > 0
  );
}
