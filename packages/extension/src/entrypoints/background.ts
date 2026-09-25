import { defineBackground } from 'wxt/utils/define-background';
import { WorkerClient } from '../solver/worker-client';
import { loadConfig } from '../config/config';
import type { ContentMessage, BackgroundResponse } from '../interfaces/messages';

export default defineBackground(() => {
  console.info('[Rin Background] Service worker initialized and listening.');
  const solver = new WorkerClient();

  browser.runtime.onMessage.addListener(
    (msg: unknown, _sender: unknown, sendResponse: (res: BackgroundResponse) => void) => {
      const message = msg as ContentMessage;
      console.info('[Rin Background] Received message:', message.type);

      if (message.type === 'SOLVE_QUIZ') {
        console.info('[Rin Background] Forwarding quiz to Cloudflare Worker solver...');
        solver
          .solve(message.payload)
          .then((result) => {
            console.info('[Rin Background] Solver response received:', result);
            sendResponse({ type: 'QUIZ_SOLVED', payload: result });
          })
          .catch((err) => {
            console.error('[Rin Background] Solver error:', err);
            sendResponse({ type: 'ERROR', payload: { message: err.message } });
          });
        return true; // Keep channel open
      }

      if (message.type === 'GET_CONFIG') {
        loadConfig().then((config) => sendResponse({ type: 'CONFIG', payload: config }));
        return true;
      }
    }
  );
});
