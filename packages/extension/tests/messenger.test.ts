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
      type: 'ACK',
    };
    (global as any).browser.runtime.sendMessage.mockResolvedValue(mockResponse);

    const message: ContentMessage = { type: 'SOLVE_QUIZ', payload: { question: 'Test?', options: [{ label: 'A', text: 'Answer' }] } };
    const response = await sendToBackground(message);

    expect(response).toEqual(mockResponse);
    expect((global as any).browser.runtime.sendMessage).toHaveBeenCalledWith(message);
  });

  it('rejects if browser.runtime.sendMessage fails', async () => {
    (global as any).browser.runtime.sendMessage.mockRejectedValue(
      new Error('Extension port disconnected')
    );

    await expect(sendToBackground({ type: 'SOLVE_QUIZ', payload: { question: 'Test?', options: [{ label: 'A', text: 'Answer' }] } })).rejects.toThrow(
      'Extension port disconnected'
    );
  });
});
