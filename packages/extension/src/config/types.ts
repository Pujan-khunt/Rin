import type { ActorMode } from '@/actors/types';

export interface RinConfig {
  enabled: boolean;
  actorMode: ActorMode;
}

export type ConfigChangeListener = (newConfig: RinConfig, oldConfig: RinConfig) => void;
