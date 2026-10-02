import { HudActor } from './hud';
import { ClickActor } from './click';
import type { Actor, ActorMode } from './types';

export const ACTOR_STRATEGIES: Record<ActorMode, new () => Actor> = {
  assisted: HudActor,
  auto: ClickActor,
};

export function createActor(mode: ActorMode): Actor {
  const Strategy = ACTOR_STRATEGIES[mode] ?? HudActor;
  return new Strategy();
}
