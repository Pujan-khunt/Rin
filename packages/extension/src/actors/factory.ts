import { HudActor } from '@/actors/hud';
import { ClickActor } from '@/actors/click';
import type { Actor, ActorMode } from '@/actors/types';

export const ACTOR_STRATEGIES: Record<ActorMode, new () => Actor> = {
  assisted: HudActor,
  auto: ClickActor,
};

export function createActor(mode: ActorMode): Actor {
  const Strategy = ACTOR_STRATEGIES[mode] ?? HudActor;
  return new Strategy();
}
