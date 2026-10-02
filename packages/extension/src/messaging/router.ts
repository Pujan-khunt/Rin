import type { BackgroundResponse, ContentMessage, MessagePayloads, MessageType } from './types';
import { logger } from './logger';

export type MessageHandler = (payload: any) => Promise<BackgroundResponse>;

export class MessageRouter {
  private handlers = new Map<MessageType, MessageHandler>();

  register<K extends MessageType>(
    type: K,
    handler: (payload: MessagePayloads[K]) => Promise<BackgroundResponse>
  ): this {
    this.handlers.set(type, handler as MessageHandler);
    return this;
  }

  listen(): void {
    browser.runtime.onMessage.addListener(
      (msg: unknown, _sender: unknown, sendResponse: (res: BackgroundResponse) => void) => {
        const message = msg as ContentMessage;
        const handler = message?.type ? this.handlers.get(message.type) : undefined;
        if (!handler) return false;

        const payload = message && typeof message === 'object' && 'payload' in message ? message.payload : undefined;
        handler(payload)
          .then(sendResponse)
          .catch((err) => {
            logger.error('MessageRouter', `Error handling message ${message.type}: ${(err as Error)?.message ?? err}`);
            sendResponse({
              type: 'ERROR',
              payload: { message: (err as Error)?.message ?? String(err) },
            });
          });
        return true;
      }
    );
  }
}
