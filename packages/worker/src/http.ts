import type { QuizInput } from '@rin/shared';
import { CLIENT_HEADER_NAME } from '@rin/shared';

export interface Env {
  OPENROUTER_API_KEY?: string;
  RIN_CLIENT_KEY?: string;
}

/**
 * Validates a serialized extension or local-development origin.
 * Extension hostnames must be valid IDs, but are not restricted to Rin's ID.
 */
export function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;

  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }

  // Origin headers contain only scheme and authority, never a full resource URL.
  if (origin !== `${url.protocol}//${url.host}` || url.username || url.password) {
    return false;
  }

  if (url.protocol === 'http:') {
    return url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  }

  if (url.port) return false;
  if (url.protocol === 'chrome-extension:') {
    return /^[a-p]{32}$/.test(url.hostname);
  }
  if (url.protocol === 'moz-extension:') {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(url.hostname);
  }
  return false;
}

/**
 * Computes CORS headers using the validated Origin.
 */
export function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowed = isAllowedOrigin(origin);
  const allowOrigin = allowed && origin ? origin : 'null';

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': `Content-Type, ${CLIENT_HEADER_NAME}`,
    Vary: 'Origin',
  };
}

/**
 * Responds to CORS preflight OPTIONS requests.
 */
export function handleOptions(request: Request): Response {
  const origin = request.headers.get('Origin');
  if (!isAllowedOrigin(origin)) {
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
 * Middleware validating server environment configuration and request client authentication.
 *
 * 1. Strictly requires RIN_CLIENT_KEY in env (returns 500 if missing).
 * 2. Strictly requires OPENROUTER_API_KEY in env (returns 500 if missing).
 * 3. Validates X-Rin-Client header matches RIN_CLIENT_KEY (returns 401 if missing or invalid).
 *
 * Returns an error Response if any check fails, or null if authentication succeeds.
 */
export function authenticateRequest(request: Request, env: Env): Response | null {
  const clientSecret = env.RIN_CLIENT_KEY?.trim();
  if (!clientSecret) {
    return errorResponse('Server configuration error: RIN_CLIENT_KEY is missing', request, 500);
  }

  const openRouterKey = env.OPENROUTER_API_KEY?.trim();
  if (!openRouterKey) {
    return errorResponse('Server configuration error: OPENROUTER_API_KEY is missing', request, 500);
  }

  const clientHeader = request.headers.get(CLIENT_HEADER_NAME);
  if (clientHeader !== clientSecret) {
    return errorResponse('Unauthorized: Invalid or missing X-Rin-Client header', request, 401);
  }

  return null;
}

/**
 * Checks for a nonblank string question and a nonempty options array.
 * Individual options and the optional model are not validated here.
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
