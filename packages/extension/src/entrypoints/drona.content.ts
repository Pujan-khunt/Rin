import { defineContentScript } from 'wxt/utils/define-content-script';
import { ConfigService } from '../services/config.service';
import { ActorFactory } from '../actors/actor-factory';
import { QuizWorkflowCoordinator } from '../services/quiz-workflow.service';
import { MeetingCoordinator } from '../services/meeting-coordinator.service';

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
    // 1. Initialize Configuration Service
    const configService = new ConfigService();
    const initialConfig = await configService.load();

    // 2. Initialize Workflow Coordinator with Initial Actor
    const workflow = new QuizWorkflowCoordinator(
      ActorFactory.create(initialConfig.actorMode),
      initialConfig
    );

    // 3. React to Real-Time Configuration Updates
    const unsubscribeConfig = configService.subscribe((newConfig) => {
      workflow.setConfig(newConfig);
      workflow.setActor(ActorFactory.create(newConfig.actorMode));
    });

    // 4. Initialize Meeting Session Coordinator
    const meetingCoordinator = new MeetingCoordinator({
      onQuiz: (quiz) => workflow.processQuiz(quiz),
      onMeetingLeave: () => workflow.cleanup(),
    });

    meetingCoordinator.start();

    // 5. Clean Teardown on Extension Reload or Context Invalidation
    ctx.onInvalidated(() => {
      unsubscribeConfig();
      meetingCoordinator.stop();
      workflow.cleanup();
    });
  },
});
