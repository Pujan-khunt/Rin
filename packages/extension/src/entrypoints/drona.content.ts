import { defineContentScript } from 'wxt/utils/define-content-script';
import { configStore } from '../config/store';
import { createActor } from '../actors/factory';
import { QuizWorkflowCoordinator } from '../services/quiz-workflow.service';
import { MeetingCoordinator } from '../services/meeting-coordinator.service';
import { setupDevSnapshotHotkey } from '../detection/recorder';
import { logger } from '../services/logger';

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

    // 2. Initialize Workflow Coordinator with Initial Actor
    const workflow = new QuizWorkflowCoordinator(
      createActor(initialConfig.actorMode),
      initialConfig
    );

    // 3. React to Real-Time Configuration Updates
    const unsubscribeConfig = configStore.subscribe((newConfig) => {
      logger.info('ContentScript', 'Settings updated in real-time', newConfig);
      workflow.setConfig(newConfig);
      workflow.setActor(createActor(newConfig.actorMode));
    });

    // 4. Initialize Meeting Session Coordinator
    const meetingCoordinator = new MeetingCoordinator({
      onQuiz: (quiz) => workflow.processQuiz(quiz),
      onMeetingLeave: () => workflow.cleanup(),
    });

    logger.debug('ContentScript', 'Starting meeting coordinator...');
    meetingCoordinator.start();

    // 5. Dev-Only DOM Snapshot Hotkey (Alt+Shift+S / Ctrl+Alt+S)
    if (import.meta.env.DEV) {
      const teardownDevHotkey = setupDevSnapshotHotkey((snapshot) => {
        logger.info('ContentScript', `Dev snapshot captured [${snapshot.id}] and downloaded.`);
      });
      ctx.onInvalidated(() => {
        teardownDevHotkey();
      });
    }

    // 6. Clean Teardown on Extension Reload or Context Invalidation
    ctx.onInvalidated(() => {
      logger.warn('ContentScript', 'Context invalidated or reloaded, cleaning up...');
      unsubscribeConfig();
      meetingCoordinator.stop();
      workflow.cleanup();
    });
  },
});
