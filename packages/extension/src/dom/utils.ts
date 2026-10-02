/**
 * Collapses multiple whitespace characters into a single space and trims edges.
 *
 * @param text - Raw input text, null, or undefined.
 * @returns Cleaned text, or empty string if input is falsy or whitespace-only.
 */
export function normalizeWhitespace(text?: string | null): string {
  return text ? text.replace(/\s+/g, ' ').trim() : '';
}

/**
 * Returns the root element itself if it matches the selector, or the first matching descendant.
 *
 * @param root - The candidate root HTMLElement.
 * @param selector - CSS selector string.
 * @returns The matching HTMLElement, or null if no match found.
 */
export function findSelfOrDescendant<T extends HTMLElement = HTMLElement>(
  root: HTMLElement,
  selector: string
): T | null {
  return root.matches(selector) ? (root as T) : root.querySelector<T>(selector);
}
