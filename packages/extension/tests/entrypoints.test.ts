import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';
import backgroundEntry from '../src/entrypoints/background';
import dronaEntry from '../src/entrypoints/drona.content';
import { configStore } from '../src/config/store';
import * as messengerModule from '../src/messaging/messenger';
import { MeetingWatcher } from '../src/meeting/watcher';
import { QuizObserver } from '../src/quiz/observer';
import { HudActor } from '../src/actors/hud';
import { ClickActor } from '../src/actors/click';
import { WorkerClient } from '../src/solver/worker-client';

describe('Background Entrypoint', () => {
  let messageListener: Function;

  beforeEach(() => {
    vi.restoreAllMocks();
    (global as any).browser = {
      storage: {
        local: {
          get: vi.fn().mockResolvedValue({}),
          set: vi.fn().mockResolvedValue(undefined),
        },
        onChanged: {
          addListener: vi.fn(),
          removeListener: vi.fn(),
        },
      },
      runtime: {
        onMessage: {
          addListener: vi.fn((listener) => {
            messageListener = listener;
          }),
        },
      },
    };
  });

  it('registers runtime.onMessage listener on init', () => {
    backgroundEntry.main();
    expect((global as any).browser.runtime.onMessage.addListener).toHaveBeenCalledTimes(1);
    expect(typeof messageListener).toBe('function');
  });

  it('handles SOLVE_QUIZ successfully', async () => {
    const mockResult = {
      chosenIndex: 2,
      chosenLabel: 'C',
      source: 'llm',
      latencyMs: 120,
    };
    const solveSpy = vi.spyOn(WorkerClient.prototype, 'solve').mockResolvedValue(mockResult);

    backgroundEntry.main();

    const sendResponse = vi.fn();
    const keepChannel = messageListener(
      {
        type: 'SOLVE_QUIZ',
        payload: { question: 'What is 2+2?', options: ['1', '2', '4', '5'] },
      },
      {},
      sendResponse
    );

    expect(keepChannel).toBe(true);

    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(solveSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        question: 'What is 2+2?',
        options: ['1', '2', '4', '5'],
      })
    );

    await vi.waitFor(() => {
      expect(sendResponse).toHaveBeenCalledWith({
        type: 'QUIZ_SOLVED',
        payload: mockResult,
      });
    });
  });

  it('handles SOLVE_QUIZ failure', async () => {
    vi.spyOn(WorkerClient.prototype, 'solve').mockRejectedValue(new Error('Network error'));

    backgroundEntry.main();

    const sendResponse = vi.fn();
    messageListener(
      {
        type: 'SOLVE_QUIZ',
        payload: { question: 'What is 2+2?', options: ['1', '2', '4', '5'] },
      },
      {},
      sendResponse
    );

    await vi.waitFor(() => {
      expect(sendResponse).toHaveBeenCalledWith({
        type: 'ERROR',
        payload: { message: 'Network error' },
      });
    });
  });

  it('handles GET_CONFIG successfully', async () => {
    vi.spyOn(configStore, 'load').mockResolvedValue({
      actorMode: 'auto',
      enabled: true,
    });

    backgroundEntry.main();

    const sendResponse = vi.fn();
    const keepChannel = messageListener({ type: 'GET_CONFIG' }, {}, sendResponse);

    expect(keepChannel).toBe(true);

    await Promise.resolve();
    await Promise.resolve();

    expect(sendResponse).toHaveBeenCalledWith({
      type: 'CONFIG',
      payload: { actorMode: 'auto', enabled: true },
    });
  });
});

describe('Drona Content Script Entrypoint', () => {
  let dom: JSDOM;
  let document: Document;
  let mockCtx: { onInvalidated: (cb: () => void) => void };
  let invalidatedCallbacks: (() => void)[];

  beforeEach(() => {
    vi.restoreAllMocks();
    dom = new JSDOM('<!DOCTYPE html><html><body><div id="root"></div></body></html>');
    document = dom.window.document;
    (global as any).document = document;
    (global as any).window = dom.window;
    (global as any).HTMLElement = dom.window.HTMLElement;
    (global as any).Node = dom.window.Node;
    (global as any).MutationObserver = dom.window.MutationObserver;
    vi.spyOn(dom.window.HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    invalidatedCallbacks = [];
    mockCtx = {
      onInvalidated: vi.fn((cb) => {
        invalidatedCallbacks.push(cb);
      }),
    };

    (global as any).browser = {
      storage: {
        local: {
          get: vi.fn().mockResolvedValue({}),
          set: vi.fn().mockResolvedValue(undefined),
        },
        onChanged: {
          addListener: vi.fn(),
          removeListener: vi.fn(),
        },
      },
      runtime: {
        sendMessage: vi.fn().mockResolvedValue({ success: true }),
      },
    };
  });

  it('registers meeting watcher and handles meeting lifecycle with HudActor', async () => {
    let meetingCallbacks: any = null;
    const watcherStartSpy = vi.spyOn(MeetingWatcher.prototype, 'start').mockImplementation(function (this: any) {
      meetingCallbacks = this.callbacks;
    });
    const watcherStopSpy = vi.spyOn(MeetingWatcher.prototype, 'stop');

    let quizCallbacks: any = null;
    const observerStartSpy = vi.spyOn(QuizObserver.prototype, 'start').mockImplementation(function (this: any) {
      quizCallbacks = this.callbacks;
    });
    const observerStopSpy = vi.spyOn(QuizObserver.prototype, 'stop');

    vi.spyOn(configStore, 'load').mockResolvedValue({
      actorMode: 'assisted',
      enabled: true,
    });

    const actSpy = vi.spyOn(HudActor.prototype, 'act').mockResolvedValue();
    const cleanupSpy = vi.spyOn(HudActor.prototype, 'cleanup').mockImplementation(() => {});

    const mockSolveResult = {
      chosenIndex: 1,
      chosenLabel: 'B',
      source: 'llm',
      latencyMs: 150,
    };
    vi.spyOn(messengerModule, 'sendToBackground').mockResolvedValue({
      type: 'QUIZ_SOLVED',
      payload: mockSolveResult,
    });

    await dronaEntry.main(mockCtx as any);

    expect(watcherStartSpy).toHaveBeenCalledTimes(1);

    // Trigger meeting container discovery
    const fakeContainer = document.createElement('div');
    meetingCallbacks.onEnter(fakeContainer);

    expect(observerStartSpy).toHaveBeenCalledWith(fakeContainer);

    // Trigger quiz detection
    const fakeQuiz = {
      question: 'Test question',
      options: ['A', 'B'],
      element: document.createElement('div'),
      optionElements: [document.createElement('div'), document.createElement('div')],
    };
    await quizCallbacks.onQuiz(fakeQuiz);

    expect(messengerModule.sendToBackground).toHaveBeenCalledWith({
      type: 'SOLVE_QUIZ',
      payload: { question: 'Test question', options: ['A', 'B'] },
    });
    expect(actSpy).toHaveBeenCalledWith({
      quiz: fakeQuiz,
      result: mockSolveResult,
    });

    // Invalidation cleanup
    invalidatedCallbacks.forEach((cb) => cb());
    expect(watcherStopSpy).toHaveBeenCalled();
    expect(observerStopSpy).toHaveBeenCalled();
    expect(cleanupSpy).toHaveBeenCalled();
  });

  it('does not solve or act when extension is disabled in config', async () => {
    let meetingCallbacks: any = null;
    vi.spyOn(MeetingWatcher.prototype, 'start').mockImplementation(function (this: any) {
      meetingCallbacks = this.callbacks;
    });

    let quizCallbacks: any = null;
    vi.spyOn(QuizObserver.prototype, 'start').mockImplementation(function (this: any) {
      quizCallbacks = this.callbacks;
    });

    const sendSpy = vi.spyOn(messengerModule, 'sendToBackground');

    vi.spyOn(configStore, 'load').mockResolvedValue({
      actorMode: 'assisted',
      enabled: false,
    });

    await dronaEntry.main(mockCtx as any);
    meetingCallbacks.onEnter(document.createElement('div'));
    await quizCallbacks.onQuiz({ question: 'Test Q', options: [] });

    expect(sendSpy).not.toHaveBeenCalled();
  });

  it('uses ClickActor when actorMode is auto', async () => {
    let meetingCallbacks: any = null;
    vi.spyOn(MeetingWatcher.prototype, 'start').mockImplementation(function (this: any) {
      meetingCallbacks = this.callbacks;
    });

    let quizCallbacks: any = null;
    vi.spyOn(QuizObserver.prototype, 'start').mockImplementation(function (this: any) {
      quizCallbacks = this.callbacks;
    });

    vi.spyOn(configStore, 'load').mockResolvedValue({
      actorMode: 'auto',
      enabled: true,
    });

    const clickActSpy = vi.spyOn(ClickActor.prototype, 'act').mockResolvedValue();
    vi.spyOn(messengerModule, 'sendToBackground').mockResolvedValue({
      type: 'QUIZ_SOLVED',
      payload: {
        chosenIndex: 0,
        chosenLabel: 'X',
        source: 'llm',
        latencyMs: 90,
      },
    });

    await dronaEntry.main(mockCtx as any);
    meetingCallbacks.onEnter(document.createElement('div'));
    await quizCallbacks.onQuiz({
      question: 'Auto Q',
      options: ['X', 'Y'],
      element: document.createElement('div'),
      optionElements: [document.createElement('div'), document.createElement('div')],
    });

    expect(clickActSpy).toHaveBeenCalled();
  });

  it('reacts dynamically to storage changes and hot-swaps between HudActor and ClickActor', async () => {
    let meetingCallbacks: any = null;
    vi.spyOn(MeetingWatcher.prototype, 'start').mockImplementation(function (this: any) {
      meetingCallbacks = this.callbacks;
    });

    let quizCallbacks: any = null;
    vi.spyOn(QuizObserver.prototype, 'start').mockImplementation(function (this: any) {
      quizCallbacks = this.callbacks;
    });

    // Start with assisted mode
    vi.spyOn(configStore, 'load').mockResolvedValue({
      actorMode: 'assisted',
      enabled: true,
    });

    let storageListener: any;
    (global as any).browser = {
      storage: {
        onChanged: {
          addListener: vi.fn((listener) => {
            storageListener = listener;
          }),
          removeListener: vi.fn(),
        },
      },
    };

    const hudActSpy = vi.spyOn(HudActor.prototype, 'act').mockResolvedValue();
    const clickActSpy = vi.spyOn(ClickActor.prototype, 'act').mockResolvedValue();

    vi.spyOn(messengerModule, 'sendToBackground').mockResolvedValue({
      type: 'QUIZ_SOLVED',
      payload: {
        chosenIndex: 0,
        chosenLabel: 'A',
        source: 'llm',
        latencyMs: 50,
      },
    });

    await dronaEntry.main(mockCtx as any);
    meetingCallbacks.onEnter(document.createElement('div'));

    const fakeQuiz = {
      question: 'Q1',
      options: ['A', 'B'],
      element: document.createElement('div'),
      optionElements: [document.createElement('div'), document.createElement('div')],
    };

    // Quiz 1 under assisted mode
    await quizCallbacks.onQuiz(fakeQuiz);
    expect(hudActSpy).toHaveBeenCalledTimes(1);
    expect(clickActSpy).not.toHaveBeenCalled();

    // Hot-swap via storage change event
    storageListener(
      {
        rinConfig: {
          newValue: { actorMode: 'auto', enabled: true },
        },
      },
      'local'
    );

    // Quiz 2 under auto mode
    await quizCallbacks.onQuiz(fakeQuiz);
    expect(clickActSpy).toHaveBeenCalledTimes(1);
  });

  it('handles multiple consecutive meetings in the same session without page reload', async () => {
    let meetingCallbacks: any = null;
    const watcherStartSpy = vi.spyOn(MeetingWatcher.prototype, 'start').mockImplementation(function (this: any) {
      meetingCallbacks = this.callbacks;
    });

    const observerStartSpy = vi.spyOn(QuizObserver.prototype, 'start').mockImplementation(() => {});
    const observerStopSpy = vi.spyOn(QuizObserver.prototype, 'stop').mockImplementation(() => {});

    vi.spyOn(configStore, 'load').mockResolvedValue({
      actorMode: 'assisted',
      enabled: true,
    });

    await dronaEntry.main(mockCtx as any);
    expect(watcherStartSpy).toHaveBeenCalledTimes(1);

    // 1. Meeting 1 joins
    const meeting1 = document.createElement('div');
    meetingCallbacks.onEnter(meeting1);
    expect(observerStartSpy).toHaveBeenCalledWith(meeting1);

    // 2. Meeting 1 leaves
    meetingCallbacks.onLeave();
    expect(observerStopSpy).toHaveBeenCalledTimes(1);

    // 3. Meeting 2 joins in same session
    const meeting2 = document.createElement('div');
    meetingCallbacks.onEnter(meeting2);
    expect(observerStartSpy).toHaveBeenCalledWith(meeting2);
  });
});
