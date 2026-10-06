import { defineBackground } from 'wxt/utils/define-background';
import { WorkerClient } from '@/solver/client';
import { logger, prettyPrintLog } from '@/messaging/logger';
import { MessageRouter } from '@/messaging/router';

export default defineBackground(() => {
  logger.info('Background', 'Rin service worker initialized and listening');
  const solver = new WorkerClient();

  const router = new MessageRouter()
    .register('LOG', async (payload) => {
      prettyPrintLog(payload);
      return { type: 'ACK' };
    })
    .register('SOLVE_QUIZ', async (payload) => {
      const result = await solver.solve(payload);
      return { type: 'QUIZ_SOLVED', payload: result };
    });

  router.listen();
});
