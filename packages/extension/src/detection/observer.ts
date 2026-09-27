import { SELECTORS } from '../config/selectors';
import { extractQuiz } from './extractor';
import { observeElement } from '../utils/dom';
import type { QuizData } from '../interfaces/quiz';

/**
 * Waits for an ephemeral quiz element to finish hydrating its asynchronous
 * markdown question and choices, then invokes onHydrated and disconnects.
 */
function waitForQuizHydration(
  quizEl: HTMLElement,
  onHydrated: (quiz: QuizData) => void
): () => void {
  // Fast-path: Quiz is already fully hydrated
  const initialData = extractQuiz(quizEl);
  if (initialData) {
    onHydrated(initialData);
    return () => { };
  }

  // Reactive path: Shell is mounted, wait for markdown/choices to hydrate
  const observer = new MutationObserver(() => {
    if (!quizEl.isConnected) {
      observer.disconnect();
      return;
    }

    const hydratedData = extractQuiz(quizEl);
    if (hydratedData) {
      observer.disconnect();
      onHydrated(hydratedData);
    }
  });

  observer.observe(quizEl, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  return () => observer.disconnect();
}

/**
 * Targeted quiz observer.
 *
 * Attaches strictly to the meeting container `.vp-container` with a shallow scope (`subtree: false`)
 * to catch `div.m-quiz` additions.
 * Once a quiz element is detected, it delegates to `waitForQuizHydration` to wait
 * for markdown and choices before firing `onQuiz`.
 */
export function startQuizObserver(
  container: HTMLElement,
  onQuiz: (quiz: QuizData) => void
): () => void {
  let stopHydration: (() => void) | null = null;

  const stopContainerObserver = observeElement({
    target: container,
    selector: SELECTORS.quiz.root,
    subtree: false,
    once: false,
    // Once we find `div.m-quiz` we wait for the question and options to get hydrated before firing `onQuiz`.
    onFound: (quizEl) => {
      stopHydration?.();
      stopHydration = waitForQuizHydration(quizEl, onQuiz);
    },
  });

  return () => {
    stopHydration?.();
    stopHydration = null;
    stopContainerObserver();
  };
}
