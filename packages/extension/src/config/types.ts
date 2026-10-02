import type { ActorMode } from '../actors/types';

export interface RinConfig {
  enabled: boolean;
  actorMode: ActorMode;
  model?: string;
}

export type ConfigChangeListener = (newConfig: RinConfig) => void;
