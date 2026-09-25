import { resolve } from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: [resolve(__dirname, 'vitest.setup.ts')],
  },
});
