import type { ContentMessage, BackgroundResponse, LogLevel } from '@/messaging/types';
import { logger } from '@/messaging/logger';

function logMessage(
  message: ContentMessage,
  level: LogLevel,
  text: string,
  data?: unknown
): void {
  if (Boolean(import.meta.env.DEV) && message.type !== 'LOG') {
    logger[level]('Messenger', text, data);
  }
}

export async function sendToBackground(message: ContentMessage): Promise<BackgroundResponse> {
  logMessage(
    message,
    'debug',
    `Sending message to background: ${message.type}`,
    'payload' in message ? message.payload : undefined
  );

  const start = Date.now();
  try {
    const res = (await browser.runtime.sendMessage(message)) as BackgroundResponse;
    logMessage(message, 'debug', `Received response for ${message.type} in ${Date.now() - start}ms`, res);
    return res;
  } catch (err) {
    logMessage(message, 'error', `Failed sending message ${message.type}: ${(err as Error).message}`);
    throw err;
  }
}
