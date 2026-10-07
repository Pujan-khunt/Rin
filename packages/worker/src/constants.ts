export const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';
export const DEEPSEEK_TIMEOUT_MS = 10000;

export const FAST_MODE_SYSTEM_PROMPT =
  'You are an expert quiz solver. You will be given a multiple-choice question and options labeled with letters (e.g., A, B, C, D).\n' +
  'Respond with a JSON object: {"choice": "<correct option letter>"}';

export const REASONING_MODE_SYSTEM_PROMPT =
  'You are an expert quiz solver. You will be given a multiple-choice question and options labeled with letters (e.g., A, B, C, D).\n' +
  'Respond with a JSON object: {"reasoning": "<your brief step-by-step analysis>", "choice": "<correct option letter>"}';

export const QUIZ_SOLVER_SYSTEM_PROMPT = FAST_MODE_SYSTEM_PROMPT;
