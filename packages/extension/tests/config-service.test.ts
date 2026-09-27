import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConfigService } from '../src/services/config.service';
import * as configModule from '../src/config/config';

describe('ConfigService', () => {
  let service: ConfigService;
  let storageListener: Function;
  let removeListenerSpy: any;

  beforeEach(() => {
    vi.restoreAllMocks();
    service = new ConfigService();
    removeListenerSpy = vi.fn();
    (global as any).browser = {
      storage: {
        onChanged: {
          addListener: vi.fn((listener) => {
            storageListener = listener;
          }),
          removeListener: removeListenerSpy,
        },
      },
    };
  });

  it('loads config from storage and returns it', async () => {
    vi.spyOn(configModule, 'loadConfig').mockResolvedValue({
      actorMode: 'auto',
      enabled: false,
    });

    const config = await service.load();
    expect(config.actorMode).toBe('auto');
    expect(config.enabled).toBe(false);
    expect(service.getConfig()).toEqual({ actorMode: 'auto', enabled: false });
  });

  it('saves config and updates internal cache', async () => {
    const saveSpy = vi.spyOn(configModule, 'saveConfig').mockResolvedValue();

    await service.save({ actorMode: 'auto', enabled: true });
    expect(saveSpy).toHaveBeenCalledWith({ actorMode: 'auto', enabled: true });
    expect(service.getConfig()).toEqual({ actorMode: 'auto', enabled: true });
  });

  it('subscribes to storage changes and notifies listener with updated config', () => {
    const listener = vi.fn();
    const unsubscribe = service.subscribe(listener);

    expect((global as any).browser.storage.onChanged.addListener).toHaveBeenCalled();

    // Trigger storage event
    storageListener(
      {
        rinConfig: {
          newValue: { actorMode: 'auto', enabled: false },
        },
      },
      'local'
    );

    expect(listener).toHaveBeenCalledWith({ actorMode: 'auto', enabled: false });
    expect(service.getConfig()).toEqual({ actorMode: 'auto', enabled: false });

    // Unsubscribe
    unsubscribe();
    expect(removeListenerSpy).toHaveBeenCalledWith(storageListener);
  });

  it('ignores storage changes from other areas or keys', () => {
    const listener = vi.fn();
    service.subscribe(listener);

    // Sync area (ignored)
    storageListener({ rinConfig: { newValue: { actorMode: 'auto' } } }, 'sync');
    expect(listener).not.toHaveBeenCalled();

    // Other key (ignored)
    storageListener({ otherKey: { newValue: 123 } }, 'local');
    expect(listener).not.toHaveBeenCalled();
  });
});
