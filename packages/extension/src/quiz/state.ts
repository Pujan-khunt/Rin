import { SELECTORS } from '@/dom/selectors';

export function isQuizAnswered(root: HTMLElement): boolean {
  return root.querySelector(SELECTORS.quiz.choiceSelected) !== null;
}
