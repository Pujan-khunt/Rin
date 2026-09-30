import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadConfig, saveConfig, DEFAULT_CONFIG } from '../src/config/config';
import { SELECTORS } from '../src/config/selectors';

describe('Config Storage', () => {
  let mockStorage: Record<string, any>;

  beforeEach(() => {
    mockStorage = {};
    (global as any).browser = {
      storage: {
        local: {
          get: vi.fn().mockImplementation((key: string) => Promise.resolve({ [key]: mockStorage[key] })),
          set: vi.fn().mockImplementation((obj: Record<string, any>) => {
            Object.assign(mockStorage, obj);
            return Promise.resolve();
          }),
        },
      },
    };
  });

  it('loads default config when storage is empty (assisted mode default)', async () => {
    const config = await loadConfig();
    expect(config.actorMode).toBe('assisted');
    expect(config.enabled).toBe(true);
    expect(config.model).toBe(DEFAULT_CONFIG.model);
  });

  it('saves and reloads modified config', async () => {
    await saveConfig({ actorMode: 'auto', enabled: false });
    const config = await loadConfig();
    expect(config.actorMode).toBe('auto');
    expect(config.enabled).toBe(false);
  });

  it('handles partial config in storage by merging with defaults', async () => {
    mockStorage['rinConfig'] = { enabled: false };
    const config = await loadConfig();
    expect(config.actorMode).toBe('assisted');
    expect(config.enabled).toBe(false);
  });

  it('handles storage get error gracefully and returns default config', async () => {
    (global as any).browser.storage.local.get = vi.fn().mockRejectedValue(new Error('Storage failure'));

    const config = await loadConfig();
    expect(config).toEqual(DEFAULT_CONFIG);
  });

  it('handles storage set error gracefully without throwing', async () => {
    (global as any).browser.storage.local.set = vi.fn().mockRejectedValue(new Error('Storage set failure'));

    await expect(saveConfig({ actorMode: 'auto', enabled: false })).resolves.toBeUndefined();
  });

  it('handles environment where browser is undefined', async () => {
    delete (global as any).browser;

    const config = await loadConfig();
    expect(config).toEqual(DEFAULT_CONFIG);

    await expect(saveConfig({ actorMode: 'auto', enabled: false })).resolves.toBeUndefined();
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

