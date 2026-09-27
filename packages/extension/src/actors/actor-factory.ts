import { HudActor } from './hud-actor';
import { ClickActor } from './click-actor';
import type { Actor, ActorMode } from '../interfaces/actor';

/**
 * Factory for creating execution strategy Actors based on user mode.
 *
 * Adheres to the Open/Closed Principle (OCP): new actors can be registered
 * without modifying consumers.
 */
export class ActorFactory {
  static create(mode: ActorMode): Actor {
    switch (mode) {
      case 'auto':
        return new ClickActor();
      case 'assisted':
      default:
        return new HudActor();
    }
  }
}
