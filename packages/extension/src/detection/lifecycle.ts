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
