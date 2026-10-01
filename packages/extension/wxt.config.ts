import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  manifestVersion: 3,
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
    version: '0.1.0',
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
