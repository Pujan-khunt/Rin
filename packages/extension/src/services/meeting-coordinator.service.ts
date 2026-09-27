import { waitForMeeting, watchMeetingUnmount } from '../detection/lifecycle';
import { startQuizObserver } from '../detection/observer';
import type { QuizData } from '../interfaces/quiz';

export interface MeetingCoordinatorCallbacks {
  onQuiz: (quiz: QuizData) => void;
  onMeetingEnter?: (container: HTMLElement) => void;
  onMeetingLeave?: () => void;
}

/**
 * Coordinates the DOM meeting lifecycle state machine.
 *
 * Adheres to:
 * - Single Responsibility Principle (SRP): Solely responsible for meeting mounting,
 *   quiz observation attachment, unmount detection, and session re-arming.
 * - Dependency Inversion Principle (DIP): Injects lifecycle and observer functions.
 */
export class MeetingCoordinator {
  private isStopped = false;
  private container: HTMLElement | null = null;
  private stopMeetingWatcher: (() => void) | null = null;
  private stopUnmountWatcher: (() => void) | null = null;
  private stopQuizObserver: (() => void) | null = null;

  constructor(
    private readonly callbacks: MeetingCoordinatorCallbacks,
    private readonly meetingWatcher = waitForMeeting,
    private readonly unmountWatcher = watchMeetingUnmount,
    private readonly quizObserver = startQuizObserver
  ) {}

  getContainer(): HTMLElement | null {
    return this.container;
  }

  start(): void {
    if (this.isStopped) return;

    this.stopMeetingWatcher?.();
    this.stopMeetingWatcher = this.meetingWatcher((container) => {
      this.handleMeetingEnter(container);
    });
  }

  private handleMeetingEnter(container: HTMLElement): void {
    if (this.isStopped) return;

    this.container = container;
    this.callbacks.onMeetingEnter?.(container);

    // Watch for meeting unmount
    this.stopUnmountWatcher?.();
    this.stopUnmountWatcher = this.unmountWatcher(container, () => {
      this.handleMeetingLeave();
    });

    // Start watching for quizzes inside the container
    this.stopQuizObserver?.();
    this.stopQuizObserver = this.quizObserver(container, (quiz) => {
      this.callbacks.onQuiz(quiz);
    });
  }

  private handleMeetingLeave(): void {
    this.stopQuizObserver?.();
    this.stopQuizObserver = null;

    this.stopUnmountWatcher?.();
    this.stopUnmountWatcher = null;

    this.container = null;
    this.callbacks.onMeetingLeave?.();

    // Re-arm for subsequent lectures in this tab
    if (!this.isStopped) {
      this.start();
    }
  }

  stop(): void {
    this.isStopped = true;

    this.stopMeetingWatcher?.();
    this.stopMeetingWatcher = null;

    this.stopUnmountWatcher?.();
    this.stopUnmountWatcher = null;

    this.stopQuizObserver?.();
    this.stopQuizObserver = null;

    this.container = null;
    this.callbacks.onMeetingLeave?.();
  }
}
