import { defineBackground } from 'wxt/utils/define-background';
import { WorkerClient } from '../solver/worker-client';
import { loadConfig } from '../config/config';
import type { ContentMessage, BackgroundResponse } from '../interfaces/messages';

export default defineBackground(() => {
  const solver = new WorkerClient();

  browser.runtime.onMessage.addListener(
    (msg: unknown, _sender: unknown, sendResponse: (res: BackgroundResponse) => void) => {
      const message = msg as ContentMessage;

      if (message.type === 'SOLVE_QUIZ') {
        solver
          .solve(message.payload)
          .then((result) => {
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
