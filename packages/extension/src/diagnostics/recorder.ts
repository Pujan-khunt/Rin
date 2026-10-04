import type { QuizData } from '@/quiz/types';

export interface QuizSnapshot {
  id: string;
  timestamp: number;
  url: string;
  question: string;
  optionCount: number;
  rawHtml: string;
  rootHtml?: string;
  trigger?: 'auto_quiz' | 'manual_hotkey';
}

export const MAX_SNAPSHOTS = 20;
export const MAX_SNAPSHOT_BYTES = 2 * 1024 * 1024;

/**
 * Extracts the outerHTML of the React application root (#root).
 * Falls back to document.body if #root is not mounted.
 */
export function captureRootHtml(): string {
  if (typeof document === 'undefined') {
    return '';
  }
  const rootEl = document.getElementById('root');
  if (rootEl) {
    return rootEl.outerHTML;
  }
  if (document.body) {
    return document.body.outerHTML;
  }
  return '';
}

/**
 * Formats body HTML into a standalone HTML5 document.
 */
export function formatDownloadableHtml(bodyContent: string, title: string = 'Rin DOM Snapshot'): string {
  if (
    bodyContent.trim().toLowerCase().startsWith('<!doctype') ||
    bodyContent.trim().toLowerCase().startsWith('<html')
  ) {
    return bodyContent;
  }
  return `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="utf-8">\n  <title>${title}</title>\n</head>\n<body>\n${bodyContent}\n</body>\n</html>`;
}

/**
 * Automatically triggers a browser download for the snapshot HTML file via an in-memory Blob.
 * Non-destructive and requires no extra browser permissions.
 */
export function triggerSnapshotDownload(html: string, filename: string): void {
  if (
    typeof document === 'undefined' ||
    typeof Blob === 'undefined' ||
    typeof URL === 'undefined' ||
    typeof URL.createObjectURL !== 'function'
  ) {
    return;
  }
  try {
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => {
      try {
        URL.revokeObjectURL(url);
      } catch {
        // Ignore revocation errors
      }
    }, 5000);
  } catch {
    // Graceful error handling in dev-only snapshot downloader
  }
}

/**
 * Keeps newest snapshots within the entry and serialized UTF-8 byte limits.
 * Storage failures are swallowed.
 */
export async function saveSnapshotToStorage(snapshot: QuizSnapshot): Promise<void> {
  try {
    if (typeof browser !== 'undefined' && browser.storage?.local) {
      const stored = await browser.storage.local.get('rinSnapshots');
      const existing: QuizSnapshot[] = Array.isArray(stored?.rinSnapshots) ? stored.rinSnapshots : [];
      const snapshots = [snapshot, ...existing].slice(0, MAX_SNAPSHOTS);
      const encoder = new TextEncoder();
      while (snapshots.length && encoder.encode(JSON.stringify(snapshots)).byteLength > MAX_SNAPSHOT_BYTES) {
        snapshots.pop();
      }
      await browser.storage.local.set({ rinSnapshots: snapshots });
    }
  } catch {
    // Graceful error handling in dev-only snapshot recorder
  }
}

/**
 * Creates a snapshot object capturing the current DOM state manually.
 */
export function createManualSnapshot(): QuizSnapshot {
  const rootHtml = captureRootHtml();
  return {
    id: `snapshot_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: Date.now(),
    url: typeof window !== 'undefined' ? window.location.href : 'mock://url',
    question: '[Manual Snapshot] Full React Root Capture',
    optionCount: 0,
    rawHtml: rootHtml,
    rootHtml,
    trigger: 'manual_hotkey',
  };
}

/**
 * Stores quiz HTML captured at extraction and current root/body HTML.
 * The development workflow calls this after the actor resolves; no download occurs.
 */
export async function recordQuizSnapshot(quiz: QuizData): Promise<QuizSnapshot> {
  const rootHtml = captureRootHtml();
  const rawHtml = quiz.rawHtml ?? quiz.containerElement.outerHTML;
  const snapshot: QuizSnapshot = {
    id: `snapshot_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: Date.now(),
    url: typeof window !== 'undefined' ? window.location.href : 'mock://url',
    question: quiz.question,
    optionCount: quiz.options.length,
    rawHtml,
    rootHtml: rootHtml || rawHtml,
    trigger: 'auto_quiz',
  };

  await saveSnapshotToStorage(snapshot);
  return snapshot;
}

/**
 * Manually captures a full DOM snapshot from #root and downloads it.
 */
export async function recordManualSnapshot(): Promise<QuizSnapshot> {
  const snapshot = createManualSnapshot();
  triggerSnapshotDownload(
    formatDownloadableHtml(snapshot.rootHtml ?? snapshot.rawHtml, `Rin Manual Snapshot - ${snapshot.timestamp}`),
    `rin-manual-snapshot-${snapshot.timestamp}.html`
  );
  await saveSnapshotToStorage(snapshot);
  return snapshot;
}
