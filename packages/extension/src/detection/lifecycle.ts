import { SELECTORS } from '../config/selectors';
import { observeElement } from '../utils/dom';
import { logger } from '../services/logger';

/**
 * Ephemeral meeting watcher.
 *
 * Observes the root application element (or document.body as an SPA fallback)
 * for the arrival of the Drona meeting container (`.m-activity`).
 * Disconnects immediately once the container is detected (zero ongoing overhead).
 */
export function waitForMeeting(
  onReady: (container: HTMLElement) => void,
  rootElement?: HTMLElement | null
): () => void {
  const root =
    rootElement !== undefined
      ? rootElement
      : (document.querySelector<HTMLElement>(SELECTORS.app.root) ??
        (typeof document !== 'undefined' ? document.body : null));

  if (!root) {
    logger.warn('Lifecycle', 'Root element (#root or body) not found, unable to watch for meeting');
    return () => {};
  }

  // Fast-path: Check if meeting or recorded container is already mounted
  const existingContainer = root.querySelector<HTMLElement>(SELECTORS.meeting.container);
  if (existingContainer) {
    const isVp = existingContainer.matches('.vp-container');
    logger.info(
      'Lifecycle',
      `Detected ${isVp ? 'dev recorded player (.vp-container)' : 'live meeting container (.m-activity)'}.`
    );
    onReady(existingContainer);
    return () => {};
  }

  logger.debug('Lifecycle', 'Attaching ephemeral meeting observer to root container...');
  return observeElement({
    target: root,
    selector: SELECTORS.meeting.container,
    subtree: true,
    once: true,
    onFound: (container) => {
      const isVp = container.matches('.vp-container');
      logger.info(
        'Lifecycle',
        `Detected ${isVp ? 'dev recorded player (.vp-container)' : 'live meeting container (.m-activity)'}. Disconnecting watcher.`
      );
      onReady(container);
    },
  });
}

/**
 * Watches a mounted meeting container for removal from the DOM.
 *
 * Attaches a shallow observer (`subtree: false`) to the container's parent element.
 * When the meeting container is detached/removed (e.g. user leaves the lecture or
 * SPA routes away), invokes onLeave and cleanly disconnects itself.
 */
export function watchMeetingUnmount(container: HTMLElement, onLeave: () => void): () => void {
  const parent = container.parentElement ?? (container.parentNode as HTMLElement | null);
  if (!parent) {
    if (!container.isConnected) {
      logger.info('Lifecycle', 'Meeting container already disconnected from parent upon mount check.');
      onLeave();
    }
    return () => {};
  }

  logger.debug('Lifecycle', 'Attaching unmount MutationObserver to meeting container parent');
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.removedNodes) {
        if (node === container || !container.isConnected) {
          logger.info('Lifecycle', 'Meeting container detached from DOM.');
          observer.disconnect();
          onLeave();
          return;
        }
      }
    }
  });

  observer.observe(parent, { childList: true, subtree: false });
  return () => observer.disconnect();
}
