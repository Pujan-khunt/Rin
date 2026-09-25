import type { QuizInput, SolveResult } from '@rin/shared';
import type { ActorMode } from './actor';

export interface RinConfig {
  actorMode: ActorMode;
  enabled: boolean;
}

export type ContentMessage =
  | { type: 'SOLVE_QUIZ'; payload: QuizInput }
  | { type: 'GET_CONFIG' };

export type BackgroundResponse =
  | { type: 'QUIZ_SOLVED'; payload: SolveResult }
  | { type: 'CONFIG'; payload: RinConfig }
  | { type: 'ERROR'; payload: { message: string } };
