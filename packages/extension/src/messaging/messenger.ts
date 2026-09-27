import type { ContentMessage, BackgroundResponse } from '../interfaces/messages';

export async function sendToBackground(message: ContentMessage): Promise<BackgroundResponse> {
  return (await browser.runtime.sendMessage(message)) as BackgroundResponse;
}
