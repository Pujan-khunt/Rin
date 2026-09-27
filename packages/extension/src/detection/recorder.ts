import type { QuizData } from '../interfaces/quiz';

export interface QuizSnapshot {
  id: string;
  timestamp: number;
  url: string;
  question: string;
  optionCount: number;
  rawHtml: string;
}


export async function recordQuizSnapshot(quiz: QuizData): Promise<QuizSnapshot> {
  const snapshot: QuizSnapshot = {
    id: `snapshot_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: Date.now(),
    url: typeof window !== 'undefined' ? window.location.href : 'mock://url',
    question: quiz.question,
    optionCount: quiz.options.length,
    rawHtml: quiz.rawHtml,
  };

  try {
    const stored = await browser.storage.local.get('rinSnapshots');
    const snapshots: QuizSnapshot[] = Array.isArray(stored?.rinSnapshots) ? stored.rinSnapshots : [];
    snapshots.unshift(snapshot);
    // Store all snapshots without artificial capping for developer inspection
    await browser.storage.local.set({ rinSnapshots: snapshots });
  } catch (err) {
    console.error('[Rin Recorder] Failed to persist snapshot:', err);
  }

  if (typeof console !== 'undefined' && console.info) {
    console.info(`[Rin Recorder] Captured quiz snapshot (${snapshot.id}):`, snapshot.question);
  }

  return snapshot;
}
