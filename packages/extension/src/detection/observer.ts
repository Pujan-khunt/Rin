import { SELECTORS } from '../config/selectors';
import { extractQuiz } from '../quiz/extractor';
import { observeElement } from '../utils/dom';
import { logger } from '../services/logger';
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
    logger.debug('Observer', 'Quiz already hydrated on initial detection', {
      optionsCount: initialData.options.length,
    });
    onHydrated(initialData);
    return () => {};
  }

  // Reactive path: Shell is mounted, wait for markdown/choices to hydrate
  logger.debug('Observer', 'Quiz shell mounted, waiting for markdown/choices hydration...');
  const observer = new MutationObserver(() => {
    if (!quizEl.isConnected) {
      logger.debug('Observer', 'Quiz element disconnected during hydration, aborting.');
      observer.disconnect();
      return;
    }

    const hydratedData = extractQuiz(quizEl);
    if (hydratedData) {
      logger.info('Observer', `Quiz hydration complete! Extracted ${hydratedData.options.length} options.`);
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
 * Attaches to the meeting activity container `.m-activity` with `subtree: true` to catch `div.m-quiz` additions.
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
    subtree: true,
    once: false,
    onFound: (quizEl) => {
      logger.info('Observer', 'Quiz root container (div.m-quiz) found in meeting.');
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
