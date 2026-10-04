import type { QuizChoice } from '@rin/shared';

export interface DetectedOption extends QuizChoice {
  index: number;
  element: HTMLElement;
}

export interface QuizData {
  question: string;
  options: DetectedOption[];
  containerElement: HTMLElement;
  alreadyAnswered: boolean;
  /** Monotonic extraction timestamp from performance.now(). */
  detectedAt: number;
  /** Quiz HTML captured at extraction only in development. */
  rawHtml?: string;
}

export interface QuizObserverCallbacks {
  onQuiz: (quiz: QuizData) => void;
}
