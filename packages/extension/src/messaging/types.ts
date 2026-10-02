import type { QuizInput, SolveResult } from '@rin/shared';
import type { RinConfig } from '../config/types';
export type { RinConfig };

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogPayload {
  level: LogLevel;
  tag: string;
  message: string;
  context?: unknown;
  data?: unknown;
  timestamp: number;
}

export interface MessagePayloads {
  SOLVE_QUIZ: QuizInput;
  GET_CONFIG: void;
  LOG: LogPayload;
}

export type MessageType = keyof MessagePayloads;

export type ContentMessage =
  | { type: 'SOLVE_QUIZ'; payload: QuizInput }
  | { type: 'GET_CONFIG' }
  | { type: 'LOG'; payload: LogPayload };

export type BackgroundResponse =
  | { type: 'QUIZ_SOLVED'; payload: SolveResult }
  | { type: 'CONFIG'; payload: RinConfig }
  | { type: 'ACK' }
  | { type: 'ERROR'; payload: { message: string } };
