import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';
import {
  recordQuizSnapshot,
  recordManualSnapshot,
  triggerSnapshotDownload,
  captureRootHtml,
} from '@/diagnostics/recorder';
import { setupDevSnapshotHotkey } from '@/diagnostics/hotkeys';
import type { QuizData } from '@/quiz/types';

describe('Dev-Only DOM Snapshot Recorder', () => {
  let dom: JSDOM;

  beforeEach(() => {
    dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
      url: 'https://scaler.com',
    });
    global.window = dom.window as any;
    global.document = dom.window.document;
    global.KeyboardEvent = dom.window.KeyboardEvent as any;

    vi.spyOn(dom.window.HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

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
      options: [{ label: 'A', text: '8', index: 0, element: {} as HTMLElement }],
      optionElements: [],
      containerElement: {} as any,
      rawHtml: '<div class="m-quiz"><p>What is alignof struct?</p></div>',
      detectedAt: 12345,
      alreadyAnswered: false,
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
      options: [{ label: 'A', text: '1', index: 0, element: {} as HTMLElement }],
      optionElements: [],
      containerElement: {} as any,
      rawHtml: '<div>New</div>',
      detectedAt: 5000,
      alreadyAnswered: false,
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
      alreadyAnswered: false,
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
      alreadyAnswered: false,
    };

    const record = await recordQuizSnapshot(mockQuiz);
    expect(record).toBeDefined();
    expect(record.question).toBe('No browser test');
  });

  it('captures full #root outerHTML in recordQuizSnapshot when #root exists', async () => {
    const rootEl = document.createElement('div');
    rootEl.id = 'root';
    rootEl.innerHTML = '<div class="react-app"><div class="m-activity"><span>Live Class</span></div></div>';
    document.body.appendChild(rootEl);

    const mockQuiz: QuizData = {
      question: 'Root capture test',
      options: [],
      optionElements: [],
      containerElement: {} as any,
      rawHtml: '<div>Quiz</div>',
      detectedAt: 100,
      alreadyAnswered: false,
    };

    const record = await recordQuizSnapshot(mockQuiz);
    expect(record.rootHtml).toContain('<div id="root">');
    expect(record.rootHtml).toContain('Live Class');
    expect(record.trigger).toBe('auto_quiz');

    document.body.removeChild(rootEl);
  });

  it('records manual snapshot capturing full page from #root', async () => {
    const rootEl = document.createElement('div');
    rootEl.id = 'root';
    rootEl.innerHTML = '<div class="meeting-app"><div class="m-activity"><span>Manual capture</span></div></div>';
    document.body.appendChild(rootEl);

    const record = await recordManualSnapshot();
    expect(record.id).toBeDefined();
    expect(record.trigger).toBe('manual_hotkey');
    expect(record.rootHtml).toContain('<div id="root">');
    expect(record.rootHtml).toContain('Manual capture');
    expect(record.rawHtml).toBe(record.rootHtml);

    expect((global as any).browser.storage.local.set).toHaveBeenCalledTimes(1);
    const setCallArg = (global as any).browser.storage.local.set.mock.calls[0][0];
    expect(setCallArg.rinSnapshots[0].id).toBe(record.id);

    document.body.removeChild(rootEl);
  });

  it('setupDevSnapshotHotkey listens for Alt+Shift+S, triggers snapshot, and disconnects', async () => {
    const rootEl = document.createElement('div');
    rootEl.id = 'root';
    rootEl.innerHTML = '<div class="m-activity">Hotkey Test</div>';
    document.body.appendChild(rootEl);

    const onCapture = vi.fn();
    const cleanup = setupDevSnapshotHotkey(onCapture);

    // Pressing un-related key does not trigger
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', code: 'KeyA', bubbles: true }));
    expect(onCapture).not.toHaveBeenCalled();

    // Pressing Alt+Shift+S triggers capture and prevents default
    const altShiftSEvent = new KeyboardEvent('keydown', {
      key: 'S',
      code: 'KeyS',
      altKey: true,
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    const preventDefaultSpy = vi.spyOn(altShiftSEvent, 'preventDefault');

    window.dispatchEvent(altShiftSEvent);
    expect(preventDefaultSpy).toHaveBeenCalled();
    expect(onCapture).toHaveBeenCalledTimes(1);
    expect(onCapture.mock.calls[0][0].trigger).toBe('manual_hotkey');

    // Pressing Ctrl+Alt+S also triggers capture
    const ctrlAltSEvent = new KeyboardEvent('keydown', {
      key: 's',
      code: 'KeyS',
      altKey: true,
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    window.dispatchEvent(ctrlAltSEvent);
    expect(onCapture).toHaveBeenCalledTimes(2);

    // Cleanup stops listening
    cleanup();
    window.dispatchEvent(altShiftSEvent);
    expect(onCapture).toHaveBeenCalledTimes(2);

    document.body.removeChild(rootEl);
  });

  it('captureRootHtml falls back to document.body when #root is missing', () => {
    document.body.innerHTML = '<div class="body-content">Body test</div>';
    const html = captureRootHtml();
    expect(html).toContain('Body test');
    expect(html).toContain('<body');
  });

  it('triggerSnapshotDownload creates an anchor and triggers download', () => {
    const createObjectURLMock = vi.fn().mockReturnValue('blob:mock-url');
    const revokeObjectURLMock = vi.fn();
    (global as any).URL.createObjectURL = createObjectURLMock;
    (global as any).URL.revokeObjectURL = revokeObjectURLMock;

    const appendChildSpy = vi.spyOn(document.body, 'appendChild');
    const removeChildSpy = vi.spyOn(document.body, 'removeChild');

    triggerSnapshotDownload('<div>Test download</div>', 'test.html');

    expect(createObjectURLMock).toHaveBeenCalledTimes(1);
    expect(appendChildSpy).toHaveBeenCalled();
    expect(removeChildSpy).toHaveBeenCalled();
  });

  it('recordQuizSnapshot saves to storage without triggering automatic file download', async () => {
    const createObjectURLMock = vi.fn().mockReturnValue('blob:mock-url');
    (global as any).URL.createObjectURL = createObjectURLMock;

    const mockQuiz: QuizData = {
      question: 'No auto-download question',
      options: [],
      optionElements: [],
      containerElement: {} as any,
      rawHtml: '<div>Quiz</div>',
      detectedAt: 12345,
      alreadyAnswered: false,
    };

    await recordQuizSnapshot(mockQuiz);
    expect(createObjectURLMock).not.toHaveBeenCalled();
  });

  it('recordManualSnapshot triggers file download', async () => {
    const createObjectURLMock = vi.fn().mockReturnValue('blob:mock-url');
    (global as any).URL.createObjectURL = createObjectURLMock;

    await recordManualSnapshot();
    expect(createObjectURLMock).toHaveBeenCalledTimes(1);
  });
});

