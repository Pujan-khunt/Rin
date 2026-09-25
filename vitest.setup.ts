import { vi } from 'vitest';

// Emulate WebExtension browser global for test environments
(globalThis as any).browser = {
  storage: {
    local: {
      get: vi.fn().mockResolvedValue({}),
      set: vi.fn().mockResolvedValue(undefined),
    },
  },
  runtime: {
    sendMessage: vi.fn().mockResolvedValue({ success: true }),
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
      hasListener: vi.fn(),
    },
  },
};
