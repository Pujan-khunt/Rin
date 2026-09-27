import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';
import { MeetingCoordinator } from '../src/services/meeting-coordinator.service';
import type { QuizData } from '../src/interfaces/quiz';

describe('MeetingCoordinator', () => {
  let dom: JSDOM;
  let document: Document;
  let meetingEnterCb: (container: HTMLElement) => void;
  let unmountCb: () => void;
  let quizCb: (quiz: QuizData) => void;

  let stopMeetingWatcherSpy: any;
  let stopUnmountWatcherSpy: any;
  let stopQuizObserverSpy: any;

  let mockMeetingWatcher: any;
  let mockUnmountWatcher: any;
  let mockQuizObserver: any;

  let onQuizSpy: any;
  let onMeetingEnterSpy: any;
  let onMeetingLeaveSpy: any;

  beforeEach(() => {
    dom = new JSDOM('<!DOCTYPE html><html><body><div id="root"></div></body></html>', {
      url: 'https://scaler.com',
    });
    document = dom.window.document;

    stopMeetingWatcherSpy = vi.fn();
    stopUnmountWatcherSpy = vi.fn();
    stopQuizObserverSpy = vi.fn();

    mockMeetingWatcher = vi.fn().mockImplementation((cb) => {
      meetingEnterCb = cb;
      return stopMeetingWatcherSpy;
    });

    mockUnmountWatcher = vi.fn().mockImplementation((_container, cb) => {
      unmountCb = cb;
      return stopUnmountWatcherSpy;
    });

    mockQuizObserver = vi.fn().mockImplementation((_container, cb) => {
      quizCb = cb;
      return stopQuizObserverSpy;
    });

    onQuizSpy = vi.fn();
    onMeetingEnterSpy = vi.fn();
    onMeetingLeaveSpy = vi.fn();
  });

  it('starts meeting watcher on start()', () => {
    const coordinator = new MeetingCoordinator(
      { onQuiz: onQuizSpy, onMeetingEnter: onMeetingEnterSpy, onMeetingLeave: onMeetingLeaveSpy },
      mockMeetingWatcher,
      mockUnmountWatcher,
      mockQuizObserver
    );

    coordinator.start();

    expect(mockMeetingWatcher).toHaveBeenCalledTimes(1);
    expect(coordinator.getContainer()).toBeNull();
  });

  it('initializes session when meeting container mounts and delegates detected quizzes', () => {
    const coordinator = new MeetingCoordinator(
      { onQuiz: onQuizSpy, onMeetingEnter: onMeetingEnterSpy, onMeetingLeave: onMeetingLeaveSpy },
      mockMeetingWatcher,
      mockUnmountWatcher,
      mockQuizObserver
    );

    coordinator.start();

    const fakeContainer = document.createElement('div');
    meetingEnterCb(fakeContainer);

    expect(coordinator.getContainer()).toBe(fakeContainer);
    expect(onMeetingEnterSpy).toHaveBeenCalledWith(fakeContainer);
    expect(mockUnmountWatcher).toHaveBeenCalledWith(fakeContainer, expect.any(Function));
    expect(mockQuizObserver).toHaveBeenCalledWith(fakeContainer, expect.any(Function));

    // Delegate quiz
    const fakeQuiz = { question: 'Q', options: [] } as any;
    quizCb(fakeQuiz);
    expect(onQuizSpy).toHaveBeenCalledWith(fakeQuiz);
  });

  it('handles meeting unmount by cleaning up and re-arming watcher', () => {
    const coordinator = new MeetingCoordinator(
      { onQuiz: onQuizSpy, onMeetingEnter: onMeetingEnterSpy, onMeetingLeave: onMeetingLeaveSpy },
      mockMeetingWatcher,
      mockUnmountWatcher,
      mockQuizObserver
    );

    coordinator.start();

    const fakeContainer = document.createElement('div');
    meetingEnterCb(fakeContainer);

    // Meeting unmounts
    unmountCb();

    expect(stopQuizObserverSpy).toHaveBeenCalled();
    expect(stopUnmountWatcherSpy).toHaveBeenCalled();
    expect(onMeetingLeaveSpy).toHaveBeenCalled();
    expect(coordinator.getContainer()).toBeNull();

    // Must re-arm watcher for the next class
    expect(mockMeetingWatcher).toHaveBeenCalledTimes(2);
  });

  it('stop() cleanly disconnects all observers and does not re-arm', () => {
    const coordinator = new MeetingCoordinator(
      { onQuiz: onQuizSpy, onMeetingEnter: onMeetingEnterSpy, onMeetingLeave: onMeetingLeaveSpy },
      mockMeetingWatcher,
      mockUnmountWatcher,
      mockQuizObserver
    );

    coordinator.start();

    const fakeContainer = document.createElement('div');
    meetingEnterCb(fakeContainer);

    coordinator.stop();

    expect(stopMeetingWatcherSpy).toHaveBeenCalled();
    expect(stopUnmountWatcherSpy).toHaveBeenCalled();
    expect(stopQuizObserverSpy).toHaveBeenCalled();
    expect(onMeetingLeaveSpy).toHaveBeenCalled();
    expect(coordinator.getContainer()).toBeNull();

    // Calling start after stop is ignored
    coordinator.start();
    expect(mockMeetingWatcher).toHaveBeenCalledTimes(1);
  });
});
