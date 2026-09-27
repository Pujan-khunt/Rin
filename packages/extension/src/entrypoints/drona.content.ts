import { defineContentScript } from 'wxt/utils/define-content-script';
import { waitForMeeting, watchMeetingUnmount } from '../detection/lifecycle';
import { startQuizObserver } from '../detection/observer';
import { HudActor } from '../actors/hud-actor';
import { ClickActor } from '../actors/click-actor';
import { sendToBackground } from '../messaging/messenger';
import { loadConfig, DEFAULT_CONFIG } from '../config/config';
import { recordQuizSnapshot } from '../detection/recorder';
import type { Actor, ActorMode } from '../interfaces/actor';
import type { QuizData } from '../interfaces/quiz';
import type { RinConfig } from '../interfaces/messages';


export default defineContentScript({
  matches: ['*://*.scaler.com/*', '*://scaler.com/*'],
  allFrames: true,
  runAt: 'document_idle',

  async main(ctx) {
    const currentUrl = typeof window !== 'undefined' ? window.location.href : 'unknown';
    console.info('[Rin] Content script active on:', currentUrl);

    let currentConfig: RinConfig = await loadConfig();
    let currentActor: Actor | null = null;
    let stopQuizObserver: (() => void) | null = null;
    let stopUnmountWatcher: (() => void) | null = null;
    let stopMeetingWatcher: (() => void) | null = null;
    let meetingContainer: HTMLElement | null = null;
    let isTerminated = false;

    const updateActor = (mode: ActorMode) => {
      currentActor?.cleanup();
      currentActor = mode === 'auto' ? new ClickActor() : new HudActor();
      console.info(`[Rin] Actor mode updated: ${mode}`);
    };

    const startObservingQuizzes = (container: HTMLElement) => {
      stopQuizObserver?.();
      stopQuizObserver = startQuizObserver(container, async (quiz: QuizData) => {
        if (!currentConfig.enabled) {
          console.info('[Rin] Quiz detected, but Rin is disabled in settings.');
          return;
        }

        console.info('[Rin] Quiz detected!', quiz.question, `(${quiz.options.length} options)`);

        // Dev-only snapshot record
        if (import.meta.env.DEV) {
          recordQuizSnapshot(quiz).catch(() => { });
        }

        try {
          console.info('[Rin] Requesting solution from background service worker...');
          const res = await sendToBackground({
            type: 'SOLVE_QUIZ',
            payload: { question: quiz.question, options: quiz.options },
          });

          if (res.type === 'QUIZ_SOLVED' && currentActor && currentConfig.enabled) {
            console.info(`[Rin] Solved! Choice: ${res.payload.chosenLabel} (index ${res.payload.chosenIndex}) in ${res.payload.latencyMs}ms`);
            await currentActor.act({ quiz, result: res.payload });
          } else if (res.type === 'ERROR') {
            console.error('[Rin] Background solver error:', res.payload.message);
          }
        } catch (err) {
          console.error('[Rin] Failed to solve quiz:', err);
        }
      });
    };

    const storageListener = (changes: any, area: string) => {
      if (area === 'local' && changes.rinConfig) {
        const newConfig: RinConfig = {
          ...DEFAULT_CONFIG,
          ...(changes.rinConfig.newValue || {}),
        };
        console.info('[Rin] Settings updated in real-time:', newConfig);

        const modeChanged = newConfig.actorMode !== currentConfig.actorMode;
        const enabledChanged = newConfig.enabled !== currentConfig.enabled;
        currentConfig = newConfig;

        if (modeChanged) {
          updateActor(currentConfig.actorMode);
        }

        if (enabledChanged) {
          if (!currentConfig.enabled) {
            console.info('[Rin] Extension disabled.');
            currentActor?.cleanup();
            stopQuizObserver?.();
            stopQuizObserver = null;
          } else if (meetingContainer) {
            console.info('[Rin] Extension enabled, starting quiz observer...');
            startObservingQuizzes(meetingContainer);
          }
        }
      }
    };

    if (typeof browser !== 'undefined' && browser.storage?.onChanged?.addListener) {
      browser.storage.onChanged.addListener(storageListener);
    }

    const teardownSession = () => {
      console.info('[Rin] Meeting ended (.vp-container unmounted). Cleaning up session...');
      stopQuizObserver?.();
      stopQuizObserver = null;
      stopUnmountWatcher?.();
      stopUnmountWatcher = null;
      currentActor?.cleanup();
      meetingContainer = null;
    };

    async function initSession(container: HTMLElement) {
      meetingContainer = container;
      console.info('[Rin] Meeting container (.vp-container) found! Initializing session...');
      currentConfig = await loadConfig();
      updateActor(currentConfig.actorMode);

      // Watch for the meeting unmounting/ending
      stopUnmountWatcher?.();
      stopUnmountWatcher = watchMeetingUnmount(container, () => {
        teardownSession();
        // Re-arm meeting watcher for subsequent classes in this tab
        if (!isTerminated) {
          startWatchingForMeeting();
        }
      });

      if (!currentConfig.enabled) {
        console.info('[Rin] Extension is disabled in settings.');
        return;
      }

      startObservingQuizzes(container);
    }

    function startWatchingForMeeting() {
      stopMeetingWatcher?.();
      console.info('[Rin] Watching for meeting container (.vp-container)...');
      stopMeetingWatcher = waitForMeeting((container) => {
        initSession(container);
      });
    }

    startWatchingForMeeting();

    ctx.onInvalidated(() => {
      console.info('[Rin] Context invalidated, cleaning up...');
      isTerminated = true;
      if (typeof browser !== 'undefined' && browser.storage?.onChanged?.removeListener) {
        browser.storage.onChanged.removeListener(storageListener);
      }
      teardownSession();
      stopMeetingWatcher?.();
      stopMeetingWatcher = null;
    });
  },
});
