import type { QuizInput, SolveResult } from '@rin/shared';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogPayload {
  level: LogLevel;
  tag: string;
  message: string;
  data?: unknown;
  timestamp: number;
}

export interface MessagePayloads {
  SOLVE_QUIZ: QuizInput;
  LOG: LogPayload;
}

export type MessageType = keyof MessagePayloads;

export type ContentMessage =
  | { type: 'SOLVE_QUIZ'; payload: QuizInput }
  | { type: 'LOG'; payload: LogPayload };

export type BackgroundResponse =
  | { type: 'QUIZ_SOLVED'; payload: SolveResult }
  | { type: 'ACK' }
  | { type: 'ERROR'; payload: { message: string } };
