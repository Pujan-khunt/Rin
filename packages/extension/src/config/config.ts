import type { RinConfig } from '../interfaces/messages';
import { logger } from '../services/logger';

export const DEFAULT_MODEL = 'deepseek/deepseek-v4-flash';

export const DEFAULT_CONFIG: RinConfig = {
  actorMode: 'assisted',
  enabled: true,
  model: DEFAULT_MODEL,
};

export async function loadConfig(): Promise<RinConfig> {
  try {
    const stored = await browser.storage.local.get('rinConfig');
    const config = { ...DEFAULT_CONFIG, ...(stored?.rinConfig || {}) };
    logger.debug('Config', 'Loaded configuration from storage', config);
    return config;
  } catch (err) {
    logger.error('Config', `Failed to load config from storage: ${(err as Error)?.message ?? err}`);
    // Fail gracefully with defaults
  }
  return DEFAULT_CONFIG;
}

export async function saveConfig(config: RinConfig): Promise<void> {
  try {
    await browser.storage.local.set({ rinConfig: config });
    logger.debug('Config', 'Saved configuration to storage', config);
  } catch (err) {
    logger.error('Config', `Failed to save config to storage: ${(err as Error)?.message ?? err}`);
    // Fail gracefully
  }
}
