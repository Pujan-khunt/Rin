import type { Actor, ActPayload, ActorMode } from './types';
import { logger } from '../messaging/logger';

interface ModifiedElement {
  element: HTMLElement;
  originalCssText: string;
}

/**
 * HudActor — Execution strategy for 'assisted' mode (default).
 *
 * Visually highlights the solver's recommended option by applying a soft purple
 * background (#e8d5f5) and an accent border ring (#a855f7).
 *
 * To ensure visibility against host application styles:
 * 1. Uses `!important` declarations to override existing CSS specificity.
 * 2. Temporarily makes all child elements transparent so opaque containers
 *    (e.g., Markdown renders, text spans) do not occlude the option background.
 * 3. Preserves original `cssText` across all modified elements to guarantee
 *    a clean, zero-artifact restoration when `cleanup()` is called.
 */
export class HudActor implements Actor {
  readonly mode: ActorMode = 'assisted';
  private highlightedElement: HTMLElement | null = null;
  private originalTargetCssText: string = '';
  private modifiedChildren: ModifiedElement[] = [];

  /**
   * Applies the visual highlight to the chosen option element and records
   * pre-existing styles for subsequent cleanup.
   */
  async act(payload: ActPayload): Promise<void> {
    // Cleaning up before every act() call ensures that at most one option
    // is highlighted at any given time. This achieves idempotency.
    this.cleanup();

    const target = payload.quiz.options[payload.result.chosenIndex]?.element;
    if (!target) {
      logger.warn(
        'HudActor',
        `Target option element at index ${payload.result.chosenIndex} (${payload.result.chosenLabel}) not found in DOM`
      );
      return;
    }

    this.highlightedElement = target;
    this.originalTargetCssText = target.style.cssText;

    logger.info(
      'HudActor',
      `Applying visual HUD highlight to choice ${payload.result.chosenLabel} (index ${payload.result.chosenIndex})`
    );

    // Force override through stylesheets using !important and an accent ring
    target.style.setProperty('background-color', '#e8d5f5', 'important');
    target.style.setProperty('background', '#e8d5f5', 'important');
    target.style.setProperty('box-shadow', '0 0 0 2px #a855f7', 'important');
    target.style.setProperty('transition', 'background-color 0.25s ease-in-out', 'important');

    // Make all inner child elements (e.g. .choice__text, .md-renderer) transparent
    // so any opaque white backgrounds do not obscure the light purple highlight.
    const children = Array.from(target.querySelectorAll('*')) as HTMLElement[];
    children.forEach((child: HTMLElement) => {
      this.modifiedChildren.push({
        element: child,
        originalCssText: child.style.cssText,
      });
      child.style.setProperty('background', 'transparent', 'important');
      child.style.setProperty('background-color', 'transparent', 'important');
    });
  }

  /**
   * Reverts all modified elements (target option and child nodes) back to their
   * original inline styles and resets internal tracking state.
   */
  cleanup(): void {
    if (this.highlightedElement) {
      logger.debug('HudActor', 'Cleaned up visual highlight and restored original styles.');
      this.highlightedElement.style.cssText = this.originalTargetCssText;
      this.highlightedElement = null;
      this.originalTargetCssText = '';
    }

    for (const item of this.modifiedChildren) {
      item.element.style.cssText = item.originalCssText;
    }
    this.modifiedChildren = [];
  }
}
