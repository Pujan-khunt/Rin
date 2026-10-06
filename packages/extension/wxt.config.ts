import { defineConfig } from 'wxt';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  srcDir: 'src',
  manifestVersion: 3,
  zip: {
    sourcesRoot: fileURLToPath(new URL('../..', import.meta.url)),
    includeSources: [
      'package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'tsconfig.base.json',
      'README.md', 'BUILD.md',
      'packages/extension/package.json', 'packages/extension/tsconfig.json',
      'packages/extension/wxt.config.ts', 'packages/extension/src/**', 'packages/extension/public/**',
      'packages/shared/package.json', 'packages/shared/tsconfig.json', 'packages/shared/src/**',
      'packages/worker/package.json', 'packages/worker/tsconfig.json',
      'packages/worker/wrangler.jsonc', 'packages/worker/src/**',
    ],
  },
  vite: (configEnv) => {
    const isBuild = process.argv.some((arg) => ['build', 'zip'].includes(arg));
    const clientKey = process.env.RIN_CLIENT_KEY || process.env.VITE_RIN_CLIENT_KEY;

    if (isBuild && !clientKey) {
      throw new Error(
        'Build failed: RIN_CLIENT_KEY environment variable is mandatory at build time.'
      );
    }

    return {
      define: {
        'import.meta.env.RIN_CLIENT_KEY': JSON.stringify(clientKey ?? ''),
      },
    };
  },
  manifest: {
    name: 'Rin',
    description: 'Rin is an AI assistant for Scaler Quizzes',
    version: '0.2.1',
    icons: {
      16: '/icon/16.png',
      32: '/icon/32.png',
      48: '/icon/48.png',
      128: '/icon/128.png',
    },
    permissions: ['storage'],
    host_permissions: [
      'https://*.scaler.com/*',
      'https://scaler.com/*',
      'https://rin-worker.pujankhunt.me/*',
    ],
    browser_specific_settings: {
      gecko: {
        id: 'rin@scaler-quiz-assistant',
        strict_min_version: '140.0',
        data_collection_permissions: {
          required: ['websiteContent'],
        },
      },
      gecko_android: {
        strict_min_version: '142.0',
      },
    },
    action: {
      default_title: 'Rin Settings',
      default_icon: {
        16: '/icon/16.png',
        32: '/icon/32.png',
        48: '/icon/48.png',
        128: '/icon/128.png',
      },
    },
  },
});
