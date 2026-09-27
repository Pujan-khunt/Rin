import type { QuizInput, SolveResult } from '@rin/shared';
import type { ActorMode } from './actor';

export interface RinConfig {
  actorMode: ActorMode;
  enabled: boolean;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogPayload {
  level: LogLevel;
  tag: string;
  message: string;
  data?: unknown;
  timestamp: number;
}

export type ContentMessage =
  | { type: 'SOLVE_QUIZ'; payload: QuizInput }
  | { type: 'GET_CONFIG' }
  | { type: 'LOG'; payload: LogPayload };

export type BackgroundResponse =
  | { type: 'QUIZ_SOLVED'; payload: SolveResult }
  | { type: 'CONFIG'; payload: RinConfig }
  | { type: 'ERROR'; payload: { message: string } };
