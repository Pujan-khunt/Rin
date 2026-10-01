import type { QuizInput, SolveResult } from '@rin/shared';
import {
  OPENROUTER_DECISIONS_URL,
  OPENROUTER_CHAT_URL,
  DEFAULT_MODEL_ID,
  JEV_MODEL_ID,
} from './constants';

export interface Env {
  OPENROUTER_API_KEY?: string;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Rin-Client',
};

export function isJevModel(model: string): boolean {
  const normalized = model.trim().toLowerCase();
  return (
    normalized === 'jev' ||
    normalized.startsWith('typesafe/jev') ||
    normalized.includes('/jev')
  );
}

async function solveWithJev(
  quiz: QuizInput,
  apiKey: string,
  model: string = JEV_MODEL_ID
): Promise<SolveResult> {
  const start = performance.now();
  const criteria: Record<string, string> = {};
  for (const opt of quiz.options) {
    criteria[opt.label] = opt.text;
  }

  const res = await fetch(OPENROUTER_DECISIONS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
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

async function solveWithChatCompletions(
  quiz: QuizInput,
  apiKey: string,
  model: string
): Promise<SolveResult> {
  const start = performance.now();
  const optionsText = quiz.options.map((opt) => `${opt.label}: ${opt.text}`).join('\n');

  const res = await fetch(OPENROUTER_CHAT_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content:
            'You are an expert quiz solver. You will receive a multiple-choice question from a technical course (topics include C++, DSA, system design, databases, finance, etc.).\n\nThink step by step:\n1. Identify what the question is asking.\n2. Evaluate each option — briefly reason why it is correct or incorrect.\n3. Select the single correct answer.\n\nRespond with a JSON object: {"reasoning": "<your brief step-by-step analysis>", "choice": "<correct option letter>"}',
        },
        {
          role: 'user',
          content: `Question: ${quiz.question}\n\nOptions:\n${optionsText}`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0,
      max_tokens: 1024,
    }),
  });

  if (!res.ok) {
    throw new Error(`OpenRouter Chat API error: ${res.status}`);
  }

  const data = (await res.json()) as any;
  const rawContent = data.choices?.[0]?.message?.content ?? '';

  let choiceLabel = '';
  try {
    const parsed = JSON.parse(rawContent);
    choiceLabel = (parsed.choice || parsed.chosenLabel || parsed.label || '').trim();
  } catch {
    const match = rawContent.match(/"(?:choice|chosenLabel|label)"\s*:\s*"([A-Za-z0-9]+)"/i);
    if (match) {
      choiceLabel = match[1].trim();
    }
  }

  const chosenIndex = quiz.options.findIndex(
    (o) => o.label.toUpperCase() === choiceLabel.toUpperCase()
  );

  return {
    chosenIndex: chosenIndex >= 0 ? chosenIndex : 0,
    chosenLabel: chosenIndex >= 0 ? quiz.options[chosenIndex].label : quiz.options[0].label,
    confidence: 1.0,
    source: model,
    latencyMs: Math.round(performance.now() - start),
  };
}

export async function solve(quiz: QuizInput, apiKey: string): Promise<SolveResult> {
  const model = quiz.model?.trim() || DEFAULT_MODEL_ID;
  if (isJevModel(model)) {
    return solveWithJev(quiz, apiKey, model);
  }
  return solveWithChatCompletions(quiz, apiKey, model);
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
      const result = await solve(input, apiKey);

      return Response.json(result, { headers: CORS_HEADERS });
    } catch (err: any) {
      return Response.json({ error: err.message || 'Internal solver error' }, { status: 500, headers: CORS_HEADERS });
    }
  },
};
