import { SELECTORS } from '../dom/selectors';
import { findSelfOrDescendant } from '../dom/utils';
import { logger } from '../services/logger';
import type { MeetingCallbacks } from './types';

/**
 * Ephemeral meeting watcher and session lifecycle manager.
 *
 * Implements symmetrical lifecycle observation for classroom meetings:
 * - Fast-paths existing DOM meeting containers (.m-activity or .vp-container).
 * - Reactively observes root element (#root / body) for container insertion.
 * - Attaches unmount observer to container's parent to detect detachment.
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
    this.isStopped = false;
    this.cleanupObservers();

    if (typeof document === 'undefined') {
      return;
    }

    // Fast-path: Check if meeting or recorded container is already present in DOM
    const existing = document.querySelector<HTMLElement>(SELECTORS.meeting.container);
    if (existing) {
      logger.info('MeetingWatcher', 'Meeting container already present in DOM on start.');
      this.handleEnter(existing);
      return;
    }

    // Reactive path: Observe root element (#root or document.body)
    const root =
      document.querySelector<HTMLElement>(SELECTORS.app.root) ??
      (typeof document !== 'undefined' ? document.body : null);

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
   * and attaches a shallow observer to parent to watch for unmount.
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

    if (this.unmountObserver) {
      this.unmountObserver.disconnect();
      this.unmountObserver = null;
    }

    const parent = container.parentElement ?? (typeof document !== 'undefined' ? document.body : null);
    if (!parent) {
      if (!container.isConnected) {
        this.handleLeave();
      }
      return;
    }

    logger.debug('MeetingWatcher', 'Attaching unmount MutationObserver to meeting container parent');
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

    const isBody = typeof document !== 'undefined' && parent === document.body;
    this.unmountObserver.observe(parent, {
      childList: true,
      subtree: isBody,
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
