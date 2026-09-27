import { SELECTORS } from '../config/selectors';
import { observeElement } from '../utils/dom';

/**
 * Ephemeral meeting watcher.
 *
 * Observes the root application element (or document.body as an SPA fallback)
 * for the arrival of the Drona meeting container (`.vp-container`).
 * Disconnects immediately once the container is detected (zero ongoing overhead).
 */
export function waitForMeeting(
  onReady: (container: HTMLElement) => void,
  rootElement?: HTMLElement | null
): () => void {
  const root = rootElement !== undefined
    ? rootElement
    : (document.querySelector<HTMLElement>(SELECTORS.app.root) ?? (typeof document !== 'undefined' ? document.body : null));

  if (!root) {
    console.warn('[Rin] Root element not found.');
    return () => {};
  }

  return observeElement({
    target: root,
    selector: SELECTORS.meeting.container,
    subtree: true,
    once: true,
    onFound: onReady,
  });
}

/**
 * Watches a mounted meeting container for removal from the DOM.
 *
 * Attaches a shallow observer (`subtree: false`) to the container's parent element.
 * When the meeting container is detached/removed (e.g. user leaves the lecture or
 * SPA routes away), invokes onLeave and cleanly disconnects itself.
 */
export function watchMeetingUnmount(
  container: HTMLElement,
  onLeave: () => void
): () => void {
  const parent = container.parentElement ?? (container.parentNode as HTMLElement | null);
  if (!parent) {
    if (!container.isConnected) {
      onLeave();
    }
    return () => {};
  }

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.removedNodes) {
        if (node === container || !container.isConnected) {
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
