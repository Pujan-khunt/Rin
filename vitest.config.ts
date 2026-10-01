import { resolve } from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: [resolve(__dirname, 'vitest.setup.ts')],
  },
  define: {
    'import.meta.env.RIN_CLIENT_KEY': JSON.stringify('test-client-key'),
  },
});
