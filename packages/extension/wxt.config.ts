import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
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
      'https://rin-solver.pujankhunt2412.workers.dev/*',
    ],
    browser_specific_settings: {
      gecko: {
        id: 'rin@scaler-quiz-assistant',
        strict_min_version: '109.0',
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
