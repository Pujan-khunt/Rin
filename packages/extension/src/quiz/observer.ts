import { extractQuiz } from '@/quiz/extractor';
import { logger } from '@/messaging/logger';
import type { QuizObserverCallbacks } from '@/quiz/types';

/**
 * Targeted quiz observer for classroom meetings.
 *
 * Observes the meeting container for live quiz appearances and asynchronous
 * markdown/choices hydration:
 * - Fast-paths if a fully hydrated quiz is already present in the container.
 * - Reactively observes subtree mutations (childList, subtree, characterData)
 *   to catch dynamically mounted questions and choices.
 * - Deduplicates emissions to prevent redundant processing for the same quiz.
 * - Automatically disconnects if the container is detached from the DOM.
 */
export class QuizObserver {
  private container: HTMLElement | null = null;
  private observer: MutationObserver | null = null;
  private lastEmittedElement: HTMLElement | null = null;
  private lastEmittedQuestion: string | null = null;

  constructor(private readonly callbacks: QuizObserverCallbacks) {}

  /**
   * Returns the currently observed meeting container, or null if stopped.
   */
  getContainer(): HTMLElement | null {
    return this.container;
  }

  /**
   * Starts observing the meeting container for quizzes.
   * Fast-paths if a quiz is already fully hydrated; otherwise attaches a MutationObserver.
   */
  start(meetingContainer: HTMLElement): void {
    this.stop();
    this.container = meetingContainer;

    if (!meetingContainer.isConnected) {
      this.container = null;
      return;
    }

    // Fast-path: Check if a fully hydrated quiz already exists in the container
    const initialQuiz = extractQuiz(meetingContainer);
    if (initialQuiz) {
      logger.info('QuizObserver', 'Quiz already hydrated on initial detection.', {
        optionsCount: initialQuiz.options.length,
      });
      this.lastEmittedElement = initialQuiz.containerElement;
      this.lastEmittedQuestion = initialQuiz.question;
      this.callbacks.onQuiz(initialQuiz);
    }

    // Reactive path: Observe meeting container for quiz mounting & hydration
    logger.debug('QuizObserver', 'Attaching MutationObserver to meeting container for quiz hydration...');
    this.observer = new MutationObserver(() => {
      if (!this.container || !this.container.isConnected) {
        logger.debug('QuizObserver', 'Meeting container disconnected during observation, stopping.');
        this.stop();
        return;
      }

      const quiz = extractQuiz(this.container);
      if (quiz) {
        const isSameQuiz =
          quiz.containerElement === this.lastEmittedElement &&
          quiz.question === this.lastEmittedQuestion;

        if (!isSameQuiz) {
          this.lastEmittedElement = quiz.containerElement;
          this.lastEmittedQuestion = quiz.question;
          logger.info('QuizObserver', `Quiz hydration complete! Extracted ${quiz.options.length} options.`);
          this.callbacks.onQuiz(quiz);
        }
      }
    });

    this.observer.observe(meetingContainer, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }

  /**
   * Cleanly disconnects the MutationObserver and clears all internal state.
   */
  stop(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    this.container = null;
    this.lastEmittedElement = null;
    this.lastEmittedQuestion = null;
  }
}
