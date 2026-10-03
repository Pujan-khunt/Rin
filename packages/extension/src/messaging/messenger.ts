import type { ContentMessage, BackgroundResponse } from '@/messaging/types';
import { logger } from '@/messaging/logger';

export async function sendToBackground(message: ContentMessage): Promise<BackgroundResponse> {
  if (import.meta.env.DEV && message.type !== 'LOG') {
    logger.debug(
      'Messenger',
      `Sending message to background: ${message.type}`,
      'payload' in message ? message.payload : undefined
    );
  }

  const start = Date.now();
  try {
    const res = (await browser.runtime.sendMessage(message)) as BackgroundResponse;
    if (import.meta.env.DEV && message.type !== 'LOG') {
      logger.debug('Messenger', `Received response for ${message.type} in ${Date.now() - start}ms`, res);
    }
    return res;
  } catch (err) {
    if (import.meta.env.DEV && message.type !== 'LOG') {
      logger.error('Messenger', `Failed sending message ${message.type}: ${(err as Error).message}`);
    }
    throw err;
  }
}
