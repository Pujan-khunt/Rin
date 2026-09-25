import type { QuizInput, SolveResult } from '@rin/shared';
import { OPENROUTER_DECISIONS_URL, JEV_MODEL_ID } from './constants';

export interface Env {
  OPENROUTER_API_KEY?: string;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Rin-Client',
};

async function solveWithJev(quiz: QuizInput, apiKey: string): Promise<SolveResult> {
  const start = performance.now();
  const criteria: Record<string, string> = {};
  for (const opt of quiz.options) {
    criteria[opt.label] = opt.text;
  }

  const res = await fetch(OPENROUTER_DECISIONS_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: JEV_MODEL_ID,
      state: quiz.question,
      questions: {
        answer: {
          type: 'choice',
          instructions: 'Which option correctly answers the question?',
          criteria,
        },
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`Jev API error: ${res.status}`);
  }

  const data = (await res.json()) as any;
  const choice = data.answers?.answer?.choice;
  const confidence = data.answers?.answer?.confidence ?? null;
  const chosenIndex = quiz.options.findIndex((o) => o.label === choice);

  return {
    chosenIndex: chosenIndex >= 0 ? chosenIndex : 0,
    chosenLabel: choice ?? quiz.options[0].label,
    confidence,
    source: 'jev',
    latencyMs: Math.round(performance.now() - start),
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405, headers: CORS_HEADERS });
    }

    try {
      const input = (await request.json()) as QuizInput;
      if (!input?.question || !Array.isArray(input.options) || input.options.length === 0) {
        return Response.json({ error: 'Invalid QuizInput payload' }, { status: 400, headers: CORS_HEADERS });
      }

      const apiKey = env.OPENROUTER_API_KEY || 'mock-key';
      const result = await solveWithJev(input, apiKey);

      return Response.json(result, { headers: CORS_HEADERS });
    } catch (err: any) {
      return Response.json({ error: err.message || 'Internal solver error' }, { status: 500, headers: CORS_HEADERS });
    }
  },
};
