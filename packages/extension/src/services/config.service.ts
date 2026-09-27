import { loadConfig, saveConfig, DEFAULT_CONFIG } from '../config/config';
import type { RinConfig } from '../interfaces/messages';

export type ConfigChangeListener = (config: RinConfig) => void;

/**
 * Service managing user settings persistence and real-time reactive updates.
 *
 * Adheres to the Single Responsibility Principle (SRP) by isolating browser storage
 * events and configuration caching away from content script orchestration.
 */
export class ConfigService {
  private config: RinConfig = { ...DEFAULT_CONFIG };

  getConfig(): RinConfig {
    return this.config;
  }

  async load(): Promise<RinConfig> {
    this.config = await loadConfig();
    return this.config;
  }

  async save(newConfig: RinConfig): Promise<void> {
    this.config = newConfig;
    await saveConfig(newConfig);
  }

  /**
   * Subscribes to real-time configuration changes from browser.storage.
   * Returns an unsubscribe function to cleanly detach the listener.
   */
  subscribe(listener: ConfigChangeListener): () => void {
    const storageHandler = (changes: Record<string, { newValue?: any }>, area: string) => {
      if (area === 'local' && changes.rinConfig) {
        this.config = {
          ...DEFAULT_CONFIG,
          ...(changes.rinConfig.newValue || {}),
        };
        listener(this.config);
      }
    };

    if (typeof browser !== 'undefined' && browser.storage?.onChanged?.addListener) {
      browser.storage.onChanged.addListener(storageHandler);
    }

    return () => {
      if (typeof browser !== 'undefined' && browser.storage?.onChanged?.removeListener) {
        browser.storage.onChanged.removeListener(storageHandler);
      }
    };
  }
}
