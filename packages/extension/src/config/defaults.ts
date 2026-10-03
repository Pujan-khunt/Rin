import type { RinConfig } from '@/config/types';

export const DEFAULT_MODEL = 'deepseek/deepseek-v4-flash';

export const DEFAULT_CONFIG: RinConfig = {
  enabled: true,
  actorMode: 'assisted',
  model: DEFAULT_MODEL,
};
