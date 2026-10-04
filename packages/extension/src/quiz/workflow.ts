import type { QuizInput } from '@rin/shared';
import type { Actor } from '@/actors/types';
import type { RinConfig } from '@/config/types';
import type { QuizData } from '@/quiz/types';
import type { BackgroundResponse } from '@/messaging/types';
import { sendToBackground } from '@/messaging/messenger';
import { logger } from '@/messaging/logger';

export type SolverSender = (msg: { type: 'SOLVE_QUIZ'; payload: QuizInput }) => Promise<BackgroundResponse>;

/**
 * Coordinates guards, the injected solver sender, current actor, and processed hook.
 * After solving, checks enablement and quiz connectivity; selected-choice state
 * remains the snapshot taken during extraction.
 */
export class QuizWorkflow {
  constructor(
    private actor: Actor,
    private config: RinConfig,
    private solver: SolverSender = sendToBackground,
    private onQuizProcessed?: (quiz: QuizData) => void
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
    this.config = config;

    if (!config.enabled) {
      this.actor.cleanup();
    }
  }

  async process(quiz: QuizData): Promise<void> {
    if (!this.config.enabled) {
      logger.info('QuizWorkflow', 'Quiz detected, but Rin is disabled in settings.');
      return;
    }

    if (quiz.alreadyAnswered) {
      logger.info('QuizWorkflow', 'Quiz already answered by user, skipping solve.');
      return;
    }

    logger.info(
      'QuizWorkflow',
      `Processing quiz (${quiz.options.length} options): "${quiz.question.slice(0, 60)}..."`
    );

    try {
      const response = await this.solver({
        type: 'SOLVE_QUIZ',
        payload: {
          question: quiz.question,
          options: quiz.options.map((o) => ({
            label: o.label,
            text: o.text,
            index: o.index,
          })),
          model: this.config.model,
        },
      });

      if (response.type !== 'QUIZ_SOLVED') {
        if (response.type === 'ERROR') {
          logger.error('QuizWorkflow', `Background solver error: ${response.payload.message}`);
        } else {
          logger.error('QuizWorkflow', `Unexpected solver response: ${response.type}`);
        }
        return;
      }

      if (!this.config.enabled || quiz.containerElement?.isConnected === false) {
        logger.info('QuizWorkflow', 'Aborting actor execution: disabled or container detached.');
        return;
      }

      logger.info(
        'QuizWorkflow',
        `Quiz solved! Mode: ${this.config.actorMode}, Choice: ${response.payload.chosenLabel} (index ${response.payload.chosenIndex}) in ${response.payload.latencyMs}ms`
      );

      await this.actor.act({ quiz, result: response.payload });
      this.onQuizProcessed?.(quiz);
    } catch (err) {
      logger.error('QuizWorkflow', `Failed to solve quiz: ${(err as Error)?.message ?? err}`, err);
    }
  }

  cleanup(): void {
    this.actor.cleanup();
  }
}
