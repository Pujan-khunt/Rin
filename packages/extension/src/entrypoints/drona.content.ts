import { defineContentScript } from 'wxt/utils/define-content-script';
import { waitForMeeting } from '../detection/lifecycle';
import { startQuizObserver } from '../detection/observer';
import { HudActor } from '../actors/hud-actor';
import { ClickActor } from '../actors/click-actor';
import { sendToBackground } from '../messaging/messenger';
import { loadConfig } from '../config/config';
import { recordQuizSnapshot } from '../detection/recorder';
import type { Actor } from '../interfaces/actor';
import type { QuizData } from '../interfaces/quiz';

export default defineContentScript({
  matches: ['*://*.scaler.com/*', '*://scaler.com/*'],
  allFrames: true,
  runAt: 'document_idle',

  async main(ctx) {
    const currentUrl = typeof window !== 'undefined' ? window.location.href : 'unknown';
    console.info('[Rin] Content script active on:', currentUrl);

    let currentActor: Actor | null = null;
    let stopQuizObserver: (() => void) | null = null;

    async function initSession(container: HTMLElement) {
      console.info('[Rin] Meeting container (.vp-container) found! Initializing session...');
      const config = await loadConfig();
      if (!config.enabled) {
        console.info('[Rin] Extension is disabled in settings.');
        return;
      }

      currentActor = config.actorMode === 'auto' ? new ClickActor() : new HudActor();
      console.info(`[Rin] Actor mode: ${config.actorMode}`);

      stopQuizObserver = startQuizObserver(container, async (quiz: QuizData) => {
        console.info('[Rin] Quiz detected!', quiz.question, `(${quiz.options.length} options)`);

        // Dev-only snapshot record
        if (import.meta.env.DEV) {
          recordQuizSnapshot(quiz).catch(() => {});
        }

        try {
          console.info('[Rin] Requesting solution from background service worker...');
          const res = await sendToBackground({
            type: 'SOLVE_QUIZ',
            payload: { question: quiz.question, options: quiz.options },
          });

          if (res.type === 'QUIZ_SOLVED' && currentActor) {
            console.info(`[Rin] Solved! Choice: ${res.payload.chosenLabel} (index ${res.payload.chosenIndex}) in ${res.payload.latencyMs}ms`);
            await currentActor.act({ quiz, result: res.payload });
          } else if (res.type === 'ERROR') {
            console.error('[Rin] Background solver error:', res.payload.message);
          }
        } catch (err) {
          console.error('[Rin] Failed to solve quiz:', err);
        }
      });
    }

    console.info('[Rin] Watching for meeting container (.vp-container)...');
    const stopMeetingWatcher = waitForMeeting((container) => {
      initSession(container);
    });

    ctx.onInvalidated(() => {
      console.info('[Rin] Context invalidated, cleaning up...');
      stopQuizObserver?.();
      stopMeetingWatcher();
      currentActor?.cleanup();
    });
  },
});
