import { describe, it, expect, vi, beforeEach } from 'vitest';
import { recordQuizSnapshot } from '../src/detection/recorder';
import type { QuizData } from '../src/interfaces/quiz';

describe('Dev-Only DOM Snapshot Recorder', () => {
  beforeEach(() => {
    // Mock browser.storage.local
    (global as any).browser = {
      storage: {
        local: {
          get: vi.fn().mockResolvedValue({ rinSnapshots: [] }),
          set: vi.fn().mockResolvedValue(undefined),
        },
      },
    };
  });

  it('captures and formats quiz snapshot payload into browser.storage', async () => {
    const mockQuiz: QuizData = {
      question: 'What is alignof struct?',
      options: [{ label: 'A', text: '8', index: 0 }],
      optionElements: [],
      containerElement: {} as any,
      rawHtml: '<div class="m-quiz"><p>What is alignof struct?</p></div>',
      detectedAt: 12345,
    };

    const record = await recordQuizSnapshot(mockQuiz);
    expect(record.id).toBeDefined();
    expect(record.timestamp).toBeGreaterThan(0);
    expect(record.question).toBe('What is alignof struct?');
    expect(record.optionCount).toBe(1);
    expect(record.rawHtml).toBe('<div class="m-quiz"><p>What is alignof struct?</p></div>');
    expect((global as any).browser.storage.local.set).toHaveBeenCalledTimes(1);
    const setCallArg = (global as any).browser.storage.local.set.mock.calls[0][0];
    expect(setCallArg.rinSnapshots).toHaveLength(1);
    expect(setCallArg.rinSnapshots[0].id).toBe(record.id);
  });

  it('stores snapshots without artificial capping (preserves all items)', async () => {
    const existingSnapshots = Array.from({ length: 55 }, (_, i) => ({
      id: `snapshot_old_${i}`,
      timestamp: 1000 + i,
      url: 'mock://url',
      question: `Question ${i}`,
      optionCount: 2,
      rawHtml: `<div>${i}</div>`,
    }));

    (global as any).browser.storage.local.get = vi.fn().mockResolvedValue({
      rinSnapshots: existingSnapshots,
    });

    const mockQuiz: QuizData = {
      question: 'New question',
      options: [{ label: 'A', text: '1', index: 0 }],
      optionElements: [],
      containerElement: {} as any,
      rawHtml: '<div>New</div>',
      detectedAt: 5000,
    };

    const record = await recordQuizSnapshot(mockQuiz);
    expect((global as any).browser.storage.local.set).toHaveBeenCalledTimes(1);
    const setCallArg = (global as any).browser.storage.local.set.mock.calls[0][0];
    expect(setCallArg.rinSnapshots).toHaveLength(56);
    expect(setCallArg.rinSnapshots[0].id).toBe(record.id);
  });

  it('handles storage failure gracefully without throwing', async () => {
    (global as any).browser.storage.local.get = vi.fn().mockRejectedValue(new Error('Storage failure'));

    const mockQuiz: QuizData = {
      question: 'Fail test',
      options: [],
      optionElements: [],
      containerElement: {} as any,
      rawHtml: '<div>Fail</div>',
      detectedAt: 12345,
    };

    const record = await recordQuizSnapshot(mockQuiz);
    expect(record).toBeDefined();
    expect(record.question).toBe('Fail test');
  });

  it('handles environment where browser is undefined', async () => {
    delete (global as any).browser;

    const mockQuiz: QuizData = {
      question: 'No browser test',
      options: [],
      optionElements: [],
      containerElement: {} as any,
      rawHtml: '<div>No browser</div>',
      detectedAt: 12345,
    };

    const record = await recordQuizSnapshot(mockQuiz);
    expect(record).toBeDefined();
    expect(record.question).toBe('No browser test');
  });
});
