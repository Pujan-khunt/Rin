import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QuizWorkflow } from '../src/quiz/workflow';
import type { Actor } from '../src/actors/types';
import type { QuizData } from '../src/quiz/types';
import type { BackgroundResponse } from '../src/messaging/types';

describe('QuizWorkflow', () => {
  let mockActor: Actor;
  let mockSolver: any;
  let mockQuiz: QuizData;
  let mockOnQuizProcessed: ReturnType<typeof vi.fn>;

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
        source: 'llm',
        latencyMs: 100,
      },
    } as BackgroundResponse);

    mockOnQuizProcessed = vi.fn();

    mockQuiz = {
      question: 'Test Question',
      options: [
        { label: 'A', text: 'Option 1', index: 0, element: {} as HTMLElement },
        { label: 'B', text: 'Option 2', index: 1, element: {} as HTMLElement },
      ],
      containerElement: { isConnected: true } as any,
      rawHtml: '',
      detectedAt: Date.now(),
      alreadyAnswered: false,
    };
  });

  it('skips processing if Rin is disabled in config', async () => {
    const workflow = new QuizWorkflow(
      mockActor,
      { actorMode: 'assisted', enabled: false },
      mockSolver,
      mockOnQuizProcessed
    );

    await workflow.process(mockQuiz);

    expect(mockSolver).not.toHaveBeenCalled();
    expect(mockActor.act).not.toHaveBeenCalled();
    expect(mockOnQuizProcessed).not.toHaveBeenCalled();
  });

  it('skips processing if quiz is already answered', async () => {
    const workflow = new QuizWorkflow(
      mockActor,
      { actorMode: 'assisted', enabled: true },
      mockSolver,
      mockOnQuizProcessed
    );
    mockQuiz.alreadyAnswered = true;

    await workflow.process(mockQuiz);

    expect(mockSolver).not.toHaveBeenCalled();
    expect(mockActor.act).not.toHaveBeenCalled();
    expect(mockOnQuizProcessed).not.toHaveBeenCalled();
  });

  it('sends solve request with mapped options and model, invokes actor and onQuizProcessed on QUIZ_SOLVED', async () => {
    const workflow = new QuizWorkflow(
      mockActor,
      { actorMode: 'assisted', enabled: true, model: 'deepseek/deepseek-v4-flash' },
      mockSolver,
      mockOnQuizProcessed
    );

    await workflow.process(mockQuiz);

    expect(mockSolver).toHaveBeenCalledWith({
      type: 'SOLVE_QUIZ',
      payload: {
        question: 'Test Question',
        options: [
          { label: 'A', text: 'Option 1', index: 0 },
          { label: 'B', text: 'Option 2', index: 1 },
        ],
        model: 'deepseek/deepseek-v4-flash',
      },
    });
    expect(mockActor.act).toHaveBeenCalledWith({
      quiz: mockQuiz,
      result: expect.objectContaining({ chosenLabel: 'A' }),
    });
    expect(mockOnQuizProcessed).toHaveBeenCalledWith(mockQuiz);
  });

  it('handles background solver ERROR response without crashing or calling actor', async () => {
    mockSolver.mockResolvedValue({
      type: 'ERROR',
      payload: { message: 'Inference timeout' },
    });
    const workflow = new QuizWorkflow(
      mockActor,
      { actorMode: 'assisted', enabled: true },
      mockSolver,
      mockOnQuizProcessed
    );

    await workflow.process(mockQuiz);

    expect(mockActor.act).not.toHaveBeenCalled();
    expect(mockOnQuizProcessed).not.toHaveBeenCalled();
  });

  it('handles unexpected solver response type without crashing or calling actor', async () => {
    mockSolver.mockResolvedValue({
      type: 'ACK',
    } as any);
    const workflow = new QuizWorkflow(
      mockActor,
      { actorMode: 'assisted', enabled: true },
      mockSolver,
      mockOnQuizProcessed
    );

    await workflow.process(mockQuiz);

    expect(mockActor.act).not.toHaveBeenCalled();
    expect(mockOnQuizProcessed).not.toHaveBeenCalled();
  });

  it('catches and logs solver rejection without unhandled rejection', async () => {
    mockSolver.mockRejectedValue(new Error('Network offline'));
    const workflow = new QuizWorkflow(
      mockActor,
      { actorMode: 'assisted', enabled: true },
      mockSolver,
      mockOnQuizProcessed
    );

    await expect(workflow.process(mockQuiz)).resolves.toBeUndefined();
    expect(mockActor.act).not.toHaveBeenCalled();
    expect(mockOnQuizProcessed).not.toHaveBeenCalled();
  });

  it('setActor cleans up previous actor and replaces with new one', () => {
    const newActor: Actor = {
      mode: 'auto',
      act: vi.fn().mockResolvedValue(undefined),
      cleanup: vi.fn(),
    };

    const workflow = new QuizWorkflow(
      mockActor,
      { actorMode: 'assisted', enabled: true },
      mockSolver
    );
    workflow.setActor(newActor);

    expect(mockActor.cleanup).toHaveBeenCalled();
    expect(workflow.getActor()).toBe(newActor);
  });

  it('cleans up actor when setConfig changes enabled to false', () => {
    const workflow = new QuizWorkflow(
      mockActor,
      { actorMode: 'assisted', enabled: true },
      mockSolver
    );
    workflow.setConfig({ actorMode: 'assisted', enabled: false });

    expect(mockActor.cleanup).toHaveBeenCalled();
    expect(workflow.getConfig()).toEqual({ actorMode: 'assisted', enabled: false });
  });

  it('cleanup delegates to current actor cleanup', () => {
    const workflow = new QuizWorkflow(
      mockActor,
      { actorMode: 'assisted', enabled: true },
      mockSolver
    );
    workflow.cleanup();

    expect(mockActor.cleanup).toHaveBeenCalled();
  });

  it('does not act if quiz container was detached while solver was in flight', async () => {
    const workflow = new QuizWorkflow(
      mockActor,
      { actorMode: 'assisted', enabled: true },
      mockSolver,
      mockOnQuizProcessed
    );
    mockQuiz.containerElement = { isConnected: false } as any;

    await workflow.process(mockQuiz);

    expect(mockSolver).toHaveBeenCalled();
    expect(mockActor.act).not.toHaveBeenCalled();
    expect(mockOnQuizProcessed).not.toHaveBeenCalled();
  });

  it('does not act if extension was disabled while solver was in flight', async () => {
    let workflow: QuizWorkflow;
    mockSolver.mockImplementation(async () => {
      workflow.setConfig({ actorMode: 'assisted', enabled: false });
      return {
        type: 'QUIZ_SOLVED',
        payload: {
          chosenIndex: 0,
          chosenLabel: 'A',
          source: 'llm',
          latencyMs: 50,
        },
      };
    });

    workflow = new QuizWorkflow(
      mockActor,
      { actorMode: 'assisted', enabled: true },
      mockSolver,
      mockOnQuizProcessed
    );

    await workflow.process(mockQuiz);

    expect(mockSolver).toHaveBeenCalled();
    expect(mockActor.act).not.toHaveBeenCalled();
    expect(mockOnQuizProcessed).not.toHaveBeenCalled();
  });
});
