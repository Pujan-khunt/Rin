import { SELECTORS } from '../config/selectors';
import { extractQuiz } from './extractor';
import { observeElement } from '../utils/dom';
import type { QuizData } from '../interfaces/quiz';

/**
 * Targeted quiz observer.
 *
 * Attaches strictly to the meeting container with a shallow scope (`subtree: false`)
 * to catch `div.m-quiz` additions. Remains active across multiple quizzes during a lecture.
 */
export function startQuizObserver(
  container: HTMLElement,
  onQuiz: (quiz: QuizData) => void
): () => void {
  return observeElement({
    target: container,
    selector: SELECTORS.quiz.root,
    subtree: false,
    once: false,
    onFound: (el) => {
      const data = extractQuiz(el);
      if (data) onQuiz(data);
    },
  });
}
