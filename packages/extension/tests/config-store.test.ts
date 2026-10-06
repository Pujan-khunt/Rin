import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConfigStore, configStore } from '@/config/store';
import { DEFAULT_CONFIG } from '@/config/defaults';
import { SELECTORS } from '@/dom/selectors';

describe('ConfigStore', () => {
  let store: ConfigStore;
  let mockStorage: Record<string, any>;
  let storageListener: ((changes: Record<string, { newValue?: any }>, area: string) => void) | null;
  let removeListenerSpy: any;

  beforeEach(() => {
    vi.restoreAllMocks();
    mockStorage = {};
    storageListener = null;
    removeListenerSpy = vi.fn();

    (global as any).browser = {
      storage: {
        local: {
          get: vi.fn().mockImplementation((key: string) =>
            Promise.resolve({ [key]: mockStorage[key] })
          ),
          set: vi.fn().mockImplementation((obj: Record<string, any>) => {
            Object.assign(mockStorage, obj);
            return Promise.resolve();
          }),
        },
        onChanged: {
          addListener: vi.fn((listener) => {
            storageListener = listener;
          }),
          removeListener: removeListenerSpy,
        },
      },
    };

    store = new ConfigStore();
  });

  describe('initial state and get()', () => {
    it('initializes with DEFAULT_CONFIG', () => {
      expect(store.get()).toEqual(DEFAULT_CONFIG);
    });

    it('can be initialized with custom initial config', () => {
      const customStore = new ConfigStore({
        enabled: false,
        actorMode: 'auto',
      });
      expect(customStore.get()).toEqual({
        enabled: false,
        actorMode: 'auto',
      });
    });
  });

  describe('load()', () => {
    it('loads default config when storage is empty', async () => {
      const config = await store.load();
      expect(config).toEqual(DEFAULT_CONFIG);
      expect(store.get()).toEqual(DEFAULT_CONFIG);
    });

    it('merges stored config with defaults when partially specified', async () => {
      mockStorage['rinConfig'] = { enabled: false };
      const config = await store.load();

      expect(config).toEqual({
        ...DEFAULT_CONFIG,
        enabled: false,
      });
      expect(store.get()).toEqual({
        ...DEFAULT_CONFIG,
        enabled: false,
      });
    });

    it('loads fully specified config from storage', async () => {
      mockStorage['rinConfig'] = {
        enabled: false,
        actorMode: 'auto',
      };
      const config = await store.load();

      expect(config).toEqual({
        enabled: false,
        actorMode: 'auto',
      });
      expect(store.get()).toEqual(config);
    });

    it('falls back gracefully to DEFAULT_CONFIG on storage read failure', async () => {
      (global as any).browser.storage.local.get = vi.fn().mockRejectedValue(new Error('Storage failure'));

      const config = await store.load();
      expect(config).toEqual(DEFAULT_CONFIG);
      expect(store.get()).toEqual(DEFAULT_CONFIG);
    });
  });

  describe('save() - Transactional Integrity', () => {
    it('persists configuration to storage and updates in-memory cache', async () => {
      const newConfig = {
        enabled: false,
        actorMode: 'auto' as const,
      };

      await store.save(newConfig);

      expect((global as any).browser.storage.local.set).toHaveBeenCalledWith({
        rinConfig: newConfig,
      });
      expect(mockStorage['rinConfig']).toEqual(newConfig);
      expect(store.get()).toEqual(newConfig);
    });

    it('re-throws error and DOES NOT mutate in-memory cache when storage write fails (zero drift)', async () => {
      const initialConfig = { ...store.get() };
      (global as any).browser.storage.local.set = vi
        .fn()
        .mockRejectedValue(new Error('Disk write error: quota exceeded'));

      const failingConfig = {
        enabled: false,
        actorMode: 'auto' as const,
      };

      await expect(store.save(failingConfig)).rejects.toThrow('Disk write error: quota exceeded');

      // Crucial assertion: in-memory cache must NOT have mutated!
      expect(store.get()).toEqual(initialConfig);
      expect(store.get().enabled).toBe(initialConfig.enabled);
      expect(store.get().actorMode).toBe(initialConfig.actorMode);
    });
  });

  describe('subscribe() - Real-Time Pub/Sub', () => {
    it('attaches storage listener and notifies subscriber on rinConfig update', () => {
      const listener = vi.fn();
      const unsubscribe = store.subscribe(listener);

      expect((global as any).browser.storage.onChanged.addListener).toHaveBeenCalledTimes(1);

      // Simulate browser.storage.onChanged event
      storageListener!(
        {
          rinConfig: {
            newValue: { actorMode: 'auto', enabled: false },
          },
        },
        'local'
      );

      const expectedConfig = {
        ...DEFAULT_CONFIG,
        actorMode: 'auto',
        enabled: false,
      };

      expect(listener).toHaveBeenCalledWith(expectedConfig, DEFAULT_CONFIG);
      expect(store.get()).toEqual(expectedConfig);

      // Trigger second update and verify oldConfig reflects previous state
      storageListener!(
        {
          rinConfig: {
            newValue: { actorMode: 'assisted', enabled: true },
          },
        },
        'local'
      );

      const nextExpectedConfig = {
        ...DEFAULT_CONFIG,
        actorMode: 'assisted',
        enabled: true,
      };
      expect(listener).toHaveBeenLastCalledWith(nextExpectedConfig, expectedConfig);

      // Unsubscribe cleanly
      unsubscribe();
      expect(removeListenerSpy).toHaveBeenCalledWith(expect.any(Function));
    });

    it('ignores storage changes from other areas (e.g. sync)', () => {
      const listener = vi.fn();
      store.subscribe(listener);

      storageListener!(
        {
          rinConfig: {
            newValue: { actorMode: 'auto', enabled: false },
          },
        },
        'sync'
      );

      expect(listener).not.toHaveBeenCalled();
      expect(store.get()).toEqual(DEFAULT_CONFIG);
    });

    it('ignores storage changes for unrelated keys', () => {
      const listener = vi.fn();
      store.subscribe(listener);

      storageListener!(
        {
          otherSetting: {
            newValue: 'someValue',
          },
        },
        'local'
      );

      expect(listener).not.toHaveBeenCalled();
      expect(store.get()).toEqual(DEFAULT_CONFIG);
    });
  });

  describe('configStore singleton', () => {
    it('is an instance of ConfigStore', () => {
      expect(configStore).toBeInstanceOf(ConfigStore);
    });
  });

  describe('Selectors Configuration', () => {
    it('defines live meeting container (.m-activity) with dev-only .vp-container support', () => {
      expect(SELECTORS.meeting.container).toContain('.m-activity');
      if (import.meta.env.DEV) {
        expect(SELECTORS.meeting.container).toBe('.m-activity, .vp-container');
      } else {
        expect(SELECTORS.meeting.container).toBe('.m-activity');
      }
    });
  });
});
