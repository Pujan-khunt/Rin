import type { Actor, ActPayload, ActorMode } from '@/actors/types';
import { logger } from '@/messaging/logger';

/**
 * Dispatches pointerdown, mousedown, pointerup, mouseup, and click.
 * These synthetic events do not confirm that the host accepted an answer.
 */
export function simulateClick(target: HTMLElement): void {
  const eventOpts: MouseEventInit = { bubbles: true, cancelable: true, view: window, button: 0 };

  target.dispatchEvent(new PointerEvent('pointerdown', eventOpts));
  target.dispatchEvent(new MouseEvent('mousedown', eventOpts));
  target.dispatchEvent(new PointerEvent('pointerup', eventOpts));
  target.dispatchEvent(new MouseEvent('mouseup', eventOpts));
  target.dispatchEvent(new MouseEvent('click', eventOpts));
}

/**
 * ClickActor — Execution strategy for 'auto' mode.
 *
 * Dispatches synthetic events on the recommended option. The host application
 * controls selection and submission.
 */
export class ClickActor implements Actor {
  readonly mode: ActorMode = 'auto';

  /**
   * Resolves the target DOM element for the chosen option and dispatches
   * the synthetic click sequence.
   */
  async act(payload: ActPayload): Promise<void> {
    const target = payload.quiz.options[payload.result.chosenIndex]?.element;
    if (!target?.isConnected) {
      logger.warn(
        'ClickActor',
        `Target option element at index ${payload.result.chosenIndex} (${payload.result.chosenLabel}) not found in DOM`
      );
      return;
    }

    logger.info(
      'ClickActor',
      `Dispatched synthetic click sequence on choice ${payload.result.chosenLabel} (index ${payload.result.chosenIndex})`
    );
    simulateClick(target);
  }

  /**
   * Cleanup lifecycle hook.
   *
   * ClickActor only dispatches transient DOM events and does not modify persistent
   * element styles or add persistent DOM nodes, so cleanup is a no-op.
   */
  cleanup(): void { }
}
