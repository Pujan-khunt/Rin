import type { QuizOption } from '@rin/shared';

export interface QuizData {
  question: string;
  options: QuizOption[];
  optionElements: HTMLElement[];
  containerElement: HTMLElement;
  rawHtml: string;
  detectedAt: number;
}
