import type { QuizData } from '../quiz/types';
import type { SolveResult } from '@rin/shared';

export type ActorMode = 'assisted' | 'auto';

export interface ActPayload {
  quiz: QuizData;
  result: SolveResult;
}

export interface Actor {
  readonly mode: ActorMode;
  act(payload: ActPayload): Promise<void>;
  cleanup(): void;
}
