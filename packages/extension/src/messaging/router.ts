import type { BackgroundResponse, ContentMessage, MessagePayloads, MessageType } from '@/messaging/types';
import { logger } from '@/messaging/logger';

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

        void this.dispatch(handler, message, sendResponse);
        return true;
      }
    );
  }

  private async dispatch(
    handler: MessageHandler,
    message: ContentMessage,
    sendResponse: (res: BackgroundResponse) => void
  ): Promise<void> {
    try {
      const payload = 'payload' in message ? message.payload : undefined;
      const response = await handler(payload);
      sendResponse(response);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.error('MessageRouter', `Error handling message ${message.type}: ${errorMessage}`);
      sendResponse({
        type: 'ERROR',
        payload: { message: errorMessage },
      });
    }
  }
}
