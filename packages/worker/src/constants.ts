export const OPENROUTER_CHAT_URL = 'https://openrouter.ai/api/v1/chat/completions';
export const OPENROUTER_TIMEOUT_MS = 10000;
export const DEEPSEEK_MODEL_ID = 'deepseek/deepseek-v4-flash';
export const DEFAULT_MODEL_ID = DEEPSEEK_MODEL_ID;

export const QUIZ_SOLVER_SYSTEM_PROMPT =
  'You are an expert quiz solver. You will receive a multiple-choice question from a technical course (topics include C++, DSA, system design, databases, finance, etc.).\n\n' +
  'Think step by step:\n' +
  '1. Identify what the question is asking.\n' +
  '2. Evaluate each option — briefly reason why it is correct or incorrect.\n' +
  '3. Select the single correct answer.\n\n' +
  'Respond with a JSON object: {"reasoning": "<your brief step-by-step analysis>", "choice": "<correct option letter>"}';
