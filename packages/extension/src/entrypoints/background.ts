import { defineBackground } from 'wxt/utils/define-background';
import { WorkerClient } from '../solver/worker-client';
import { configStore } from '../config/store';
import { logger, prettyPrintLog } from '../services/logger';
import type { ContentMessage, BackgroundResponse } from '../interfaces/messages';

export default defineBackground(() => {
  logger.info('Background', 'Rin service worker initialized and listening');
  const solver = new WorkerClient();

  browser.runtime.onMessage.addListener(
    (msg: unknown, _sender: unknown, sendResponse: (res: BackgroundResponse) => void) => {
      const message = msg as ContentMessage;

      if (message.type === 'LOG') {
        prettyPrintLog(message.payload);
        return;
      }

      if (message.type === 'SOLVE_QUIZ') {
        const start = Date.now();
        configStore
          .load()
          .then((config) => {
            const solvePayload = {
              ...message.payload,
              model: import.meta.env.DEV && config.model ? config.model : message.payload.model,
            };
            logger.info(
              'Background',
              `Forwarding SOLVE_QUIZ to worker (model: ${solvePayload.model || 'default'})...`,
              solvePayload
            );
            return solver.solve(solvePayload);
          })
          .then((result) => {
            logger.info(
              'Background',
              `Solver response received in ${Date.now() - start}ms: Choice ${result.chosenLabel} (index ${result.chosenIndex}, model: ${result.source})`,
              result
            );
            sendResponse({ type: 'QUIZ_SOLVED', payload: result });
          })
          .catch((err) => {
            logger.error('Background', `Solver failed after ${Date.now() - start}ms: ${err.message}`, err);
            sendResponse({ type: 'ERROR', payload: { message: err.message } });
          });
        return true; // Keep channel open
      }

      if (message.type === 'GET_CONFIG') {
        logger.debug('Background', 'Received GET_CONFIG request');
        configStore.load().then((config) => {
          logger.debug('Background', 'Returning loaded config', config);
          sendResponse({ type: 'CONFIG', payload: config });
        });
        return true;
      }
    }
  );
});
