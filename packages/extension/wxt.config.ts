import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  manifest: {
    name: 'Rin is an AI Assistant for Scaler Quizzes',
    description: 'Smart in-class learning assistant that highlights quiz solutions during Scaler Drona sessions.',
    version: '0.1.0',
    permissions: ['storage'],
    host_permissions: [
      'https://*.scaler.com/*',
      'https://scaler.com/*',
    ],
    action: {
      default_title: 'Rin Settings',
    },
  },
});
