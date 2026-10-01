import type { QuizInput } from '@rin/shared';

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Rin-Client',
} as const;

/**
 * Responds to CORS preflight OPTIONS requests.
 */
export function handleOptions(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

/**
 * Creates a CORS-enabled JSON response.
 */
export function jsonResponse(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: CORS_HEADERS });
}

/**
 * Creates a CORS-enabled JSON error response.
 */
export function errorResponse(message: string, status = 500): Response {
  return Response.json({ error: message }, { status, headers: CORS_HEADERS });
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
