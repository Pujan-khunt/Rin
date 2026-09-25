/**
 * DOM Utilities for Rin Extension.
 *
 * Provides typed, defensive DOM traversal and reactive mutation observation helpers.
 */

/**
 * Returns the element itself if it matches the selector, or the first matching descendant.
 *
 * @param element - The root or candidate HTMLElement.
 * @param selector - CSS selector string.
 * @returns The matching HTMLElement, or null if no match found.
 */
export function findSelfOrDescendant<T extends HTMLElement = HTMLElement>(
  element: HTMLElement,
  selector: string
): T | null {
  return element.matches(selector) ? (element as T) : element.querySelector<T>(selector);
}

export interface ObserveElementOptions<T extends HTMLElement = HTMLElement> {
  /** The root container to observe mutations on. */
  target: HTMLElement;
  /** The CSS selector to watch for. */
  selector: string;
  /** Whether to observe deep descendant mutations (subtree). Defaults to false. */
  subtree?: boolean;
  /** If true, disconnects the observer immediately upon finding the first match. Defaults to false. */
  once?: boolean;
  /** Callback invoked when a matching element is found (either existing or added). */
  onFound: (element: T) => void;
}

/**
 * Observes a container for additions matching a selector.
 *
 * Fast-paths if the matching element already exists in the DOM.
 * Returns a teardown function to cleanly disconnect the MutationObserver.
 */
export function observeElement<T extends HTMLElement = HTMLElement>(
  opts: ObserveElementOptions<T>
): () => void {
  // Fast-path: Element is already mounted
  const existing = findSelfOrDescendant<T>(opts.target, opts.selector);
  if (existing) {
    opts.onFound(existing);
    if (opts.once) return () => {};
  }

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;
        const el = node as HTMLElement;
        const match = findSelfOrDescendant<T>(el, opts.selector);
        if (match) {
          if (opts.once) observer.disconnect();
          opts.onFound(match);
          if (opts.once) return;
        }
      }
    }
  });

  observer.observe(opts.target, { childList: true, subtree: opts.subtree ?? false });
  return () => observer.disconnect();
}
