import type { QuizInput } from '@rin/shared';
import { CLIENT_HEADER_NAME } from '@rin/shared';

export interface Env {
  OPENROUTER_API_KEY?: string;
  RIN_CLIENT_KEY?: string;
}

/**
 * Validates whether an incoming HTTP Origin belongs to a browser extension or local development.
 *
 * Strictly requires the Origin header to be present and to match an allowed scheme.
 * Returns false if the Origin header is missing or disallowed.
 */
export function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;

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
