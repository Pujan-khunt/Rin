import { defineContentScript } from 'wxt/utils/define-content-script';
import { configStore } from '@/config/store';
import { createActor } from '@/actors/factory';
import { QuizWorkflow } from '@/quiz/workflow';
import { QuizObserver } from '@/quiz/observer';
import { MeetingWatcher } from '@/meeting/watcher';
import { setupDevSnapshotHotkey } from '@/diagnostics/hotkeys';
import { recordQuizSnapshot } from '@/diagnostics/recorder';
import { logger } from '@/messaging/logger';
import { sendToBackground } from '@/messaging/messenger';
import type { QuizData } from '@/quiz/types';

/**
 * Rin Content Script Entrypoint for Scaler (Drona).
 *
 * Serves strictly as a Composition Root (SOLID Architecture):
 * Instantiates domain services and wires them together, keeping the
 * entrypoint itself lean, declarative, and free of procedural business logic.
 */
export default defineContentScript({
  matches: ['*://*.scaler.com/*', '*://scaler.com/*'],
  allFrames: true,
  runAt: 'document_idle',

  async main(ctx) {
    const currentUrl = typeof window !== 'undefined' ? window.location.href : 'unknown';
    logger.info('ContentScript', `Rin content script mounted on: ${currentUrl}`);

    // 1. Initialize Configuration Store
    const initialConfig = await configStore.load();
    logger.info('ContentScript', 'Initial configuration loaded', initialConfig);

    // 2. Optional Dev-Only Snapshot Recorder for Workflow
    const onQuizProcessed = import.meta.env.DEV
      ? (quiz: QuizData) => {
          recordQuizSnapshot(quiz).catch((err) => {
            logger.error('ContentScript', 'Failed to record dev snapshot', err);
          });
        }
      : undefined;

    // 3. Initialize Workflow Pipeline with Initial Actor
    const workflow = new QuizWorkflow(
      createActor(initialConfig.actorMode),
      initialConfig,
      sendToBackground,
      onQuizProcessed
    );

    const quizObserver = new QuizObserver({
      onQuiz: (quiz) => workflow.process(quiz),
    });

    // 4. React to Real-Time Configuration Updates
    const unsubscribeConfig = configStore.subscribe((newConfig, oldConfig) => {
      logger.info('ContentScript', 'Settings updated in real-time', newConfig);
      workflow.setConfig(newConfig);
      if (newConfig.actorMode !== oldConfig.actorMode) {
        workflow.setActor(createActor(newConfig.actorMode));
      }
      if (newConfig.enabled && !oldConfig.enabled) {
        const meetingContainer = quizObserver.getContainer();
        if (meetingContainer) {
          quizObserver.start(meetingContainer);
        }
      }
    });

    // 5. Initialize Symmetrical Lifecycle Watchers
    const meetingWatcher = new MeetingWatcher({
      onEnter: (meetingContainer) => quizObserver.start(meetingContainer),
      onLeave: () => {
        quizObserver.stop();
        workflow.cleanup();
      },
    });

    logger.debug('ContentScript', 'Starting meeting watcher...');
    meetingWatcher.start();

    // 6. Dev-Only DOM Snapshot Hotkey (Alt+Shift+S / Ctrl+Alt+S)
    if (import.meta.env.DEV) {
      const teardownDevHotkey = setupDevSnapshotHotkey((snapshot) => {
        logger.info('ContentScript', `Dev snapshot captured [${snapshot.id}] and downloaded.`);
      });
      ctx.onInvalidated(() => {
        teardownDevHotkey();
      });
    }

    // 7. Clean Teardown on Extension Reload or Context Invalidation
    ctx.onInvalidated(() => {
      logger.warn('ContentScript', 'Context invalidated or reloaded, cleaning up...');
      unsubscribeConfig();
      meetingWatcher.stop();
      quizObserver.stop();
      workflow.cleanup();
    });
  },
});
