import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendToBackground } from '@/messaging/messenger';
import type { ContentMessage, BackgroundResponse } from '@/messaging/types';

describe('Messaging Bridge (sendToBackground)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    (global as any).browser = {
      runtime: {
        sendMessage: vi.fn(),
      },
    };
  });

  it('sends message via browser.runtime.sendMessage and returns response', async () => {
    const mockResponse: BackgroundResponse = {
      type: 'CONFIG',
      payload: { actorMode: 'assisted', enabled: true },
    };
    (global as any).browser.runtime.sendMessage.mockResolvedValue(mockResponse);

    const message: ContentMessage = { type: 'GET_CONFIG' };
    const response = await sendToBackground(message);

    expect(response).toEqual(mockResponse);
    expect((global as any).browser.runtime.sendMessage).toHaveBeenCalledWith(message);
  });

  it('rejects if browser.runtime.sendMessage fails', async () => {
    (global as any).browser.runtime.sendMessage.mockRejectedValue(
      new Error('Extension port disconnected')
    );

    await expect(sendToBackground({ type: 'GET_CONFIG' })).rejects.toThrow(
      'Extension port disconnected'
    );
  });
});
