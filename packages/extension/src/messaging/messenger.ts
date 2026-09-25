import type { ContentMessage, BackgroundResponse } from '../interfaces/messages';

declare const browser: any;

export async function sendToBackground(message: ContentMessage): Promise<BackgroundResponse> {
  return (await browser.runtime.sendMessage(message)) as BackgroundResponse;
}
