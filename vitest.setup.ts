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

// Emulate standard browser globals in test environments
if (typeof (globalThis as any).PointerEvent === 'undefined') {
  (globalThis as any).PointerEvent = class PointerEvent extends ((globalThis as any).MouseEvent || class {}) {};
}
