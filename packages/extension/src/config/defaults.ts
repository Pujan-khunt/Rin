import type { RinConfig } from '@/config/types';
import { DEFAULT_MODEL_ID } from '@rin/shared';

export const DEFAULT_CONFIG: RinConfig = {
  enabled: true,
  actorMode: 'assisted',
  model: DEFAULT_MODEL_ID,
};
