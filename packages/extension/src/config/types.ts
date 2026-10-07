import type { ActorMode } from '@/actors/types';
import type { SolverMode } from '@rin/shared';

export interface RinConfig {
  enabled: boolean;
  actorMode: ActorMode;
  solverMode: SolverMode;
}

export type ConfigChangeListener = (newConfig: RinConfig, oldConfig: RinConfig) => void;
