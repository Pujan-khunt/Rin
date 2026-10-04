import type { QuizSnapshot } from '@/diagnostics/recorder';
import { recordManualSnapshot } from '@/diagnostics/recorder';

/**
 * Sets up a dev-only hotkey listener on the window.
 * Listens for Alt+Shift+S (or Ctrl+Alt+S) to capture #root or body HTML.
 * Returns a teardown function to unbind the listener.
 */
export function setupDevSnapshotHotkey(
  onCapture?: (snapshot: QuizSnapshot) => void
): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handleKeyDown = (event: KeyboardEvent) => {
    const isSKey = event.key?.toLowerCase() === 's' || event.code === 'KeyS';
    const isAltShiftS = event.altKey && event.shiftKey && isSKey;
    const isCtrlAltS = event.ctrlKey && event.altKey && isSKey;

    if (isAltShiftS || isCtrlAltS) {
      event.preventDefault();
      event.stopPropagation();

      recordManualSnapshot().then((snapshot) => onCapture?.(snapshot)).catch(() => {});
    }
  };

  window.addEventListener('keydown', handleKeyDown, true);

  return () => {
    window.removeEventListener('keydown', handleKeyDown, true);
  };
}
