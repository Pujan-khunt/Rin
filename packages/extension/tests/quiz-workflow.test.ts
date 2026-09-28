import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QuizWorkflowCoordinator } from '../src/services/quiz-workflow.service';
import type { Actor } from '../src/interfaces/actor';
import type { QuizData } from '../src/interfaces/quiz';
import type { BackgroundResponse } from '../src/interfaces/messages';

describe('QuizWorkflowCoordinator', () => {
  let mockActor: Actor;
  let mockSolver: any;
  let mockQuiz: QuizData;

  beforeEach(() => {
    mockActor = {
      mode: 'assisted',
      act: vi.fn().mockResolvedValue(undefined),
      cleanup: vi.fn(),
    };

    mockSolver = vi.fn().mockResolvedValue({
      type: 'QUIZ_SOLVED',
      payload: {
        chosenIndex: 0,
        chosenLabel: 'A',
        confidence: 0.95,
        source: 'llm',
        latencyMs: 100,
      },
    } as BackgroundResponse);

    mockQuiz = {
      question: 'Test Question',
      options: [{ label: 'A', text: 'Option 1', index: 0 }],
      containerElement: {} as any,
      optionElements: [{} as any],
      rawHtml: '',
      detectedAt: Date.now(),
    };
  });

  it('skips processing if Rin is disabled in config', async () => {
    const coordinator = new QuizWorkflowCoordinator(mockActor, { actorMode: 'assisted', enabled: false }, mockSolver);

    await coordinator.processQuiz(mockQuiz);

    expect(mockSolver).not.toHaveBeenCalled();
    expect(mockActor.act).not.toHaveBeenCalled();
  });

  it('sends solve request and invokes actor on QUIZ_SOLVED', async () => {
    const coordinator = new QuizWorkflowCoordinator(mockActor, { actorMode: 'assisted', enabled: true }, mockSolver);

    await coordinator.processQuiz(mockQuiz);

    expect(mockSolver).toHaveBeenCalledWith({
      type: 'SOLVE_QUIZ',
      payload: { question: 'Test Question', options: mockQuiz.options },
    });
    expect(mockActor.act).toHaveBeenCalledWith({
      quiz: mockQuiz,
      result: expect.objectContaining({ chosenLabel: 'A' }),
    });
  });

  it('handles background solver ERROR response without crashing', async () => {
    mockSolver.mockResolvedValue({
      type: 'ERROR',
      payload: { message: 'Inference timeout' },
    });
    const coordinator = new QuizWorkflowCoordinator(mockActor, { actorMode: 'assisted', enabled: true }, mockSolver);

    await coordinator.processQuiz(mockQuiz);

    expect(mockActor.act).not.toHaveBeenCalled();
  });

  it('setActor cleans up previous actor and replaces with new one', () => {
    const newActor: Actor = {
      mode: 'auto',
      act: vi.fn().mockResolvedValue(undefined),
      cleanup: vi.fn(),
    };

    const coordinator = new QuizWorkflowCoordinator(mockActor, { actorMode: 'assisted', enabled: true }, mockSolver);
    coordinator.setActor(newActor);

    expect(mockActor.cleanup).toHaveBeenCalled();
    expect(coordinator.getActor()).toBe(newActor);
  });

  it('cleans up actor when setConfig changes enabled from true to false', () => {
    const coordinator = new QuizWorkflowCoordinator(mockActor, { actorMode: 'assisted', enabled: true }, mockSolver);
    coordinator.setConfig({ actorMode: 'assisted', enabled: false });

    expect(mockActor.cleanup).toHaveBeenCalled();
  });

  it('cleanup delegates to current actor cleanup', () => {
    const coordinator = new QuizWorkflowCoordinator(mockActor, { actorMode: 'assisted', enabled: true }, mockSolver);
    coordinator.cleanup();

    expect(mockActor.cleanup).toHaveBeenCalled();
  });

  it('does not act if quiz container was detached while solver was in flight', async () => {
    const coordinator = new QuizWorkflowCoordinator(mockActor, { actorMode: 'assisted', enabled: true }, mockSolver);
    mockQuiz.containerElement = { isConnected: false } as any;

    await coordinator.processQuiz(mockQuiz);

    expect(mockSolver).toHaveBeenCalled();
    expect(mockActor.act).not.toHaveBeenCalled();
  });
});
