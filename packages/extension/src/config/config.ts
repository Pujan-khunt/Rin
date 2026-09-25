import type { RinConfig } from '../interfaces/messages';

declare const browser: any;

export const DEFAULT_CONFIG: RinConfig = {
  actorMode: 'assisted',
  enabled: true,
};

export async function loadConfig(): Promise<RinConfig> {
  try {
    const stored = await browser.storage.local.get('rinConfig');
    return { ...DEFAULT_CONFIG, ...(stored?.rinConfig || {}) };
  } catch (err) {
    console.error('[Rin Config] Failed to load config:', err);
  }
  return DEFAULT_CONFIG;
}

export async function saveConfig(config: RinConfig): Promise<void> {
  try {
    await browser.storage.local.set({ rinConfig: config });
  } catch (err) {
    console.error('[Rin Config] Failed to save config:', err);
  }
}
