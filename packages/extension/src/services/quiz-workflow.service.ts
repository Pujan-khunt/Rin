import { sendToBackground } from '../messaging/messenger';
import { recordQuizSnapshot } from '../detection/recorder';
import type { Actor } from '../interfaces/actor';
import type { QuizData } from '../interfaces/quiz';
import type { RinConfig, ContentMessage, BackgroundResponse } from '../interfaces/messages';

export type SolverSender = (message: ContentMessage) => Promise<BackgroundResponse>;

/**
 * Coordinates the complete lifecycle of a single detected quiz.
 *
 * Adheres to:
 * - Single Responsibility Principle (SRP): Focuses strictly on pipeline execution
 *   (guard check -> snapshot -> background solve -> actor execution).
 * - Dependency Inversion Principle (DIP): Injects actor, config, and solver dependencies.
 */
export class QuizWorkflowCoordinator {
  constructor(
    private actor: Actor,
    private config: RinConfig,
    private readonly solver: SolverSender = sendToBackground
  ) {}

  getActor(): Actor {
    return this.actor;
  }

  setActor(actor: Actor): void {
    this.actor.cleanup();
    this.actor = actor;
  }

  getConfig(): RinConfig {
    return this.config;
  }

  setConfig(config: RinConfig): void {
    const wasEnabled = this.config.enabled;
    this.config = config;

    // If extension was disabled, ensure actor cleans up any active highlight
    if (wasEnabled && !config.enabled) {
      this.actor.cleanup();
    }
  }

  async processQuiz(quiz: QuizData): Promise<void> {
    if (!this.config.enabled) {
      console.info('[Rin] Quiz detected, but Rin is disabled in settings.');
      return;
    }

    console.info('[Rin] Quiz detected!', quiz.question, `(${quiz.options.length} options)`);

    // Dev-only snapshot record
    if (import.meta.env.DEV) {
      recordQuizSnapshot(quiz).catch(() => {});
    }

    try {
      console.info('[Rin] Requesting solution from background service worker...');
      const res = await this.solver({
        type: 'SOLVE_QUIZ',
        payload: { question: quiz.question, options: quiz.options },
      });

      if (res.type === 'QUIZ_SOLVED' && this.config.enabled) {
        console.info(`[Rin] Solved! Choice: ${res.payload.chosenLabel} (index ${res.payload.chosenIndex}) in ${res.payload.latencyMs}ms`);
        await this.actor.act({ quiz, result: res.payload });
      } else if (res.type === 'ERROR') {
        console.error('[Rin] Background solver error:', res.payload.message);
      }
    } catch (err) {
      console.error('[Rin] Failed to solve quiz:', err);
    }
  }

  cleanup(): void {
    this.actor.cleanup();
  }
}
