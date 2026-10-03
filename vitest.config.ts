import { resolve } from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: [resolve(__dirname, 'vitest.setup.ts')],
  },
  resolve: {
    alias: [
      {
        find: /^@\/(.*)$/,
        replacement: '$1',
        async customResolver(source, importer, options) {
          const isWorker = importer && importer.includes('packages/worker');
          const rootDir = isWorker
            ? resolve(__dirname, 'packages/worker/src')
            : resolve(__dirname, 'packages/extension/src');
          const target = resolve(rootDir, source);
          return this.resolve(target, importer, { skipSelf: true, ...options });
        },
      },
    ],
  },
  define: {
    'import.meta.env.RIN_CLIENT_KEY': JSON.stringify('test-client-key'),
  },
});
