import { logger } from '@/messaging/logger';
import { DEFAULT_CONFIG } from '@/config/defaults';
import type { ConfigChangeListener, RinConfig } from '@/config/types';

/**
 * Unified Configuration Store managing persistence, caching, and real-time pub/sub.
 *
 * Adheres to:
 * - Single Responsibility Principle (SRP): Isolates configuration lifecycle, storage, and caching.
 * - Transactional Integrity: Never mutates in-memory cache until storage write succeeds (zero state drift).
 */
export class ConfigStore {
  private cachedConfig: RinConfig;

  constructor(initialConfig: RinConfig = { ...DEFAULT_CONFIG }) {
    this.cachedConfig = { ...initialConfig };
  }

  /**
   * Loads configuration from browser.storage.local.
   * Gracefully falls back to DEFAULT_CONFIG if storage is inaccessible or uninitialized.
   */
  async load(): Promise<RinConfig> {
    try {
      if (typeof browser === 'undefined' || !browser?.storage?.local) {
        throw new Error('browser.storage.local is unavailable');
      }
      const stored = await browser.storage.local.get('rinConfig');
      this.cachedConfig = {
        ...DEFAULT_CONFIG,
        ...((stored as { rinConfig?: Partial<RinConfig> })?.rinConfig || {}),
      };
      logger.debug('ConfigStore', 'Loaded configuration from storage', this.cachedConfig);
    } catch (err) {
      logger.error('ConfigStore', `Failed to load config from storage: ${(err as Error)?.message ?? err}`);
      this.cachedConfig = { ...DEFAULT_CONFIG };
    }
    return this.cachedConfig;
  }

  /**
   * Persists configuration to browser.storage.local.
   * Transactional: only updates in-memory cache upon confirmed disk write.
   * Rethrows errors so callers (e.g. UI toggles) know the persistence failed.
   */
  async save(newConfig: RinConfig): Promise<void> {
    try {
      if (typeof browser === 'undefined' || !browser?.storage?.local) {
        throw new Error('browser.storage.local is unavailable');
      }
      await browser.storage.local.set({ rinConfig: newConfig });
      // Transaction complete: update in-memory cache only after successful persistence
      this.cachedConfig = { ...newConfig };
      logger.debug('ConfigStore', 'Saved configuration to storage', this.cachedConfig);
    } catch (err) {
      logger.error('ConfigStore', `Failed to persist config to storage: ${(err as Error)?.message ?? err}`);
      throw err;
    }
  }

  /**
   * Returns the current in-memory cached configuration.
   */
  get(): RinConfig {
    return this.cachedConfig;
  }

  /**
   * Backward-compatible alias for get().
   */
  getConfig(): RinConfig {
    return this.get();
  }

  /**
   * Subscribes to real-time configuration changes from browser.storage.
   * Returns an unsubscribe function to cleanly detach the listener.
   */
  subscribe(listener: ConfigChangeListener): () => void {
    if (typeof browser === 'undefined' || !browser?.storage?.onChanged) {
      return () => {};
    }

    const handler = (changes: Record<string, { newValue?: any }>, area: string) => {
      if (area === 'local' && changes.rinConfig) {
        const oldConfig = this.cachedConfig;
        this.cachedConfig = {
          ...DEFAULT_CONFIG,
          ...(changes.rinConfig.newValue || {}),
        };
        listener(this.cachedConfig, oldConfig);
      }
    };

    browser.storage.onChanged.addListener(handler);
    return () => {
      browser.storage.onChanged.removeListener(handler);
    };
  }
}

export const configStore = new ConfigStore();
