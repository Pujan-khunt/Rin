import { SELECTORS } from '@/dom/selectors';
import { findSelfOrDescendant } from '@/dom/utils';
import { logger } from '@/messaging/logger';
import type { MeetingCallbacks } from '@/meeting/types';

/**
 * Ephemeral meeting watcher and session lifecycle manager.
 *
 * Implements symmetrical lifecycle observation for classroom meetings:
 * - Fast-paths .m-activity, plus .vp-container in development.
 * - Reactively observes root element (#root / body) for container insertion.
 * - Watches root container for detachment of the meeting or its ancestors.
 * - Automatically self-rearms upon unmount for seamless subsequent sessions.
 */
export class MeetingWatcher {
  private isStopped = false;
  private container: HTMLElement | null = null;
  private mountObserver: MutationObserver | null = null;
  private unmountObserver: MutationObserver | null = null;

  constructor(private readonly callbacks: MeetingCallbacks) {}

  /**
   * Returns the currently active meeting container element, or null if none mounted.
   */
  getContainer(): HTMLElement | null {
    return this.container;
  }

  /**
   * Starts watching for the meeting container.
   * Fast-paths if container is already mounted; otherwise observes the root container.
   */
  start(): void {
    if (this.container?.isConnected) return;

    this.isStopped = false;
    this.cleanupObservers();

    // Fast-path: Check for a container using the environment's selectors.
    const existing = document.querySelector<HTMLElement>(SELECTORS.meeting.container);
    if (existing) {
      logger.info('MeetingWatcher', 'Meeting container already present in DOM on start.');
      this.handleEnter(existing);
      return;
    }

    // Reactive path: Observe root element (#root or document.body)
    const root =
      document.querySelector<HTMLElement>(SELECTORS.app.root) ?? document.body;

    if (!root) {
      logger.warn('MeetingWatcher', 'Root element (#root or body) not found, unable to watch for meeting');
      return;
    }

    logger.debug('MeetingWatcher', 'Attaching mount MutationObserver to root container...');
    this.mountObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== Node.ELEMENT_NODE) continue;
          const el = node as HTMLElement;
          const match = findSelfOrDescendant<HTMLElement>(el, SELECTORS.meeting.container);
          if (match) {
            logger.info('MeetingWatcher', 'Meeting container mounted reactively.');
            this.mountObserver?.disconnect();
            this.mountObserver = null;
            this.handleEnter(match);
            return;
          }
        }
      }
    });

    this.mountObserver.observe(root, { childList: true, subtree: true });
  }

  /**
   * Handles container entry: stores container reference, notifies callbacks,
   * and attaches an unmount observer to root to watch for container detachment.
   */
  private handleEnter(container: HTMLElement): void {
    if (this.isStopped) return;
    if (!container.isConnected) return;

    if (this.mountObserver) {
      this.mountObserver.disconnect();
      this.mountObserver = null;
    }

    this.container = container;
    this.callbacks.onEnter(container);
    if (this.isStopped) return;

    if (this.unmountObserver) {
      this.unmountObserver.disconnect();
      this.unmountObserver = null;
    }

    const root =
      document.querySelector<HTMLElement>(SELECTORS.app.root) ??
      container.parentElement ??
      document.body;
    if (!root) {
      if (!container.isConnected) {
        this.handleLeave();
      }
      return;
    }

    logger.debug('MeetingWatcher', 'Attaching unmount MutationObserver to root container');
    this.unmountObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.removedNodes) {
          if (node === container || (node.nodeType === Node.ELEMENT_NODE && (node as HTMLElement).contains(container))) {
            this.handleLeave();
            return;
          }
        }
      }
      if (!container.isConnected) {
        this.handleLeave();
      }
    });

    this.unmountObserver.observe(root, {
      childList: true,
      subtree: true,
    });
  }

  /**
   * Handles container leave: cleans up unmount observer, resets state,
   * notifies callbacks, and re-arms watcher if not explicitly stopped.
   */
  private handleLeave(): void {
    logger.info('MeetingWatcher', 'Meeting ended (container detached). Cleaning up session...');
    if (this.unmountObserver) {
      this.unmountObserver.disconnect();
      this.unmountObserver = null;
    }

    this.container = null;
    this.callbacks.onLeave();

    if (!this.isStopped) {
      logger.debug('MeetingWatcher', 'Re-arming meeting watcher for next session...');
      this.start();
    }
  }

  /**
   * Stops watching, cleanly disconnects all observers, and clears state.
   */
  stop(): void {
    logger.info('MeetingWatcher', 'Meeting watcher stopped.');
    this.isStopped = true;
    this.cleanupObservers();
    this.container = null;
  }

  private cleanupObservers(): void {
    if (this.mountObserver) {
      this.mountObserver.disconnect();
      this.mountObserver = null;
    }
    if (this.unmountObserver) {
      this.unmountObserver.disconnect();
      this.unmountObserver = null;
    }
  }
}
