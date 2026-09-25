import type { Actor, ActPayload, ActorMode } from '../interfaces/actor';

export class HudActor implements Actor {
  readonly mode: ActorMode = 'assisted';
  private highlightedElement: HTMLElement | null = null;
  private originalBackground: string = '';

  async act(payload: ActPayload): Promise<void> {
    this.cleanup();

    const target = payload.quiz.optionElements[payload.result.chosenIndex];
    if (!target) return;

    this.highlightedElement = target;
    this.originalBackground = target.style.backgroundColor;

    // Light purple #e8d5f5 soft highlight
    target.style.backgroundColor = '#e8d5f5';
    target.style.transition = 'background-color 0.25s ease-in-out';
  }

  cleanup(): void {
    if (this.highlightedElement) {
      this.highlightedElement.style.backgroundColor = this.originalBackground;
      this.highlightedElement = null;
    }
  }
}
