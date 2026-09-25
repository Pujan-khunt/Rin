import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';
import backgroundEntry from '../src/entrypoints/background';
import dronaEntry from '../src/entrypoints/drona.content';
import * as configModule from '../src/config/config';
import * as messengerModule from '../src/messaging/messenger';
import * as lifecycleModule from '../src/detection/lifecycle';
import * as observerModule from '../src/detection/observer';
import { HudActor } from '../src/actors/hud-actor';
import { ClickActor } from '../src/actors/click-actor';
import { WorkerClient } from '../src/solver/worker-client';

describe('Background Entrypoint', () => {
  let messageListener: Function;

  beforeEach(() => {
    vi.restoreAllMocks();
    (global as any).browser = {
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
      confidence: 0.95,
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
    expect(solveSpy).toHaveBeenCalledWith({
      question: 'What is 2+2?',
      options: ['1', '2', '4', '5'],
    });

    await Promise.resolve();
    await Promise.resolve();

    expect(sendResponse).toHaveBeenCalledWith({
      type: 'QUIZ_SOLVED',
      payload: mockResult,
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

    await Promise.resolve();
    await Promise.resolve();

    expect(sendResponse).toHaveBeenCalledWith({
      type: 'ERROR',
      payload: { message: 'Network error' },
    });
  });

  it('handles GET_CONFIG successfully', async () => {
    vi.spyOn(configModule, 'loadConfig').mockResolvedValue({
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

    invalidatedCallbacks = [];
    mockCtx = {
      onInvalidated: vi.fn((cb) => {
        invalidatedCallbacks.push(cb);
      }),
    };
  });

  it('registers meeting watcher and handles meeting lifecycle with HudActor', async () => {
    let meetingCallback: (container: HTMLElement) => void = () => {};
    const stopWatcher = vi.fn();
    vi.spyOn(lifecycleModule, 'waitForMeeting').mockImplementation((cb) => {
      meetingCallback = cb;
      return stopWatcher;
    });

    let observerCallback: (quiz: any) => void = () => {};
    const stopObserver = vi.fn();
    vi.spyOn(observerModule, 'startQuizObserver').mockImplementation((_el, cb) => {
      observerCallback = cb;
      return stopObserver;
    });

    vi.spyOn(configModule, 'loadConfig').mockResolvedValue({
      actorMode: 'assisted',
      enabled: true,
    });

    const actSpy = vi.spyOn(HudActor.prototype, 'act').mockResolvedValue();
    const cleanupSpy = vi.spyOn(HudActor.prototype, 'cleanup').mockImplementation(() => {});

    const mockSolveResult = {
      chosenIndex: 1,
      chosenLabel: 'B',
      confidence: 0.9,
      source: 'llm',
      latencyMs: 150,
    };
    vi.spyOn(messengerModule, 'sendToBackground').mockResolvedValue({
      type: 'QUIZ_SOLVED',
      payload: mockSolveResult,
    });

    await dronaEntry.main(mockCtx as any);

    expect(lifecycleModule.waitForMeeting).toHaveBeenCalled();

    // Trigger meeting container discovery
    const fakeContainer = document.createElement('div');
    await meetingCallback(fakeContainer);

    expect(observerModule.startQuizObserver).toHaveBeenCalledWith(
      fakeContainer,
      expect.any(Function)
    );

    // Trigger quiz detection
    const fakeQuiz = {
      question: 'Test question',
      options: ['A', 'B'],
      element: document.createElement('div'),
      optionElements: [document.createElement('div'), document.createElement('div')],
    };
    await observerCallback(fakeQuiz);

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
    expect(stopObserver).toHaveBeenCalled();
    expect(stopWatcher).toHaveBeenCalled();
    expect(cleanupSpy).toHaveBeenCalled();
  });

  it('does not observe or act when extension is disabled in config', async () => {
    let meetingCallback: (container: HTMLElement) => void = () => {};
    vi.spyOn(lifecycleModule, 'waitForMeeting').mockImplementation((cb) => {
      meetingCallback = cb;
      return vi.fn();
    });
    const observerSpy = vi.spyOn(observerModule, 'startQuizObserver');

    vi.spyOn(configModule, 'loadConfig').mockResolvedValue({
      actorMode: 'assisted',
      enabled: false,
    });

    await dronaEntry.main(mockCtx as any);
    await meetingCallback(document.createElement('div'));

    expect(observerSpy).not.toHaveBeenCalled();
  });

  it('uses ClickActor when actorMode is auto', async () => {
    let meetingCallback: (container: HTMLElement) => void = () => {};
    vi.spyOn(lifecycleModule, 'waitForMeeting').mockImplementation((cb) => {
      meetingCallback = cb;
      return vi.fn();
    });

    let observerCallback: (quiz: any) => Promise<void> = async () => {};
    vi.spyOn(observerModule, 'startQuizObserver').mockImplementation((_el, cb: any) => {
      observerCallback = cb;
      return vi.fn();
    });

    vi.spyOn(configModule, 'loadConfig').mockResolvedValue({
      actorMode: 'auto',
      enabled: true,
    });

    const clickActSpy = vi.spyOn(ClickActor.prototype, 'act').mockResolvedValue();
    vi.spyOn(messengerModule, 'sendToBackground').mockResolvedValue({
      type: 'QUIZ_SOLVED',
      payload: {
        chosenIndex: 0,
        chosenLabel: 'X',
        confidence: 1.0,
        source: 'llm',
        latencyMs: 90,
      },
    });

    await dronaEntry.main(mockCtx as any);
    await meetingCallback(document.createElement('div'));
    await observerCallback({
      question: 'Auto Q',
      options: ['X', 'Y'],
      element: document.createElement('div'),
      optionElements: [document.createElement('div'), document.createElement('div')],
    });

    expect(clickActSpy).toHaveBeenCalled();
  });
});
