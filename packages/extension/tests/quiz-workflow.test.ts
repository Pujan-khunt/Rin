import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';
import { QuizWorkflow } from '@/quiz/workflow';
import { extractQuiz } from '@/quiz/extractor';
import type { Actor } from '@/actors/types';
import type { QuizData } from '@/quiz/types';
import type { BackgroundResponse } from '@/messaging/types';

describe('QuizWorkflow', () => {
  let mockActor: Actor;
  let mockSolver: any;
  let mockQuiz: QuizData;
  let solvedResponse: BackgroundResponse;
  let mockOnQuizProcessed: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockActor = {
      mode: 'assisted',
      act: vi.fn().mockResolvedValue(undefined),
      cleanup: vi.fn(),
    };

    solvedResponse = {
      type: 'QUIZ_SOLVED',
      payload: {
        chosenIndex: 0,
        chosenLabel: 'A',
        source: 'llm',
        latencyMs: 100,
      },
    };
    mockSolver = vi.fn().mockResolvedValue(solvedResponse);

    mockOnQuizProcessed = vi.fn();

    const dom = new JSDOM(`
      <div class="m-quiz">
        <div class="m-problem-description__markdown"><p>Test Question</p></div>
        <div class="m-problem-choices__list">
          <a class="choice"><div class="choice__name">A</div><div class="choice__text">Option 1</div></a>
          <a class="choice"><div class="choice__name">B</div><div class="choice__text">Option 2</div></a>
        </div>
      </div>
    `);
    mockQuiz = extractQuiz(dom.window.document.querySelector<HTMLElement>('.m-quiz')!)!;
  });

  it('skips processing if Rin is disabled in config', async () => {
    const workflow = new QuizWorkflow(
      mockActor,
      { actorMode: 'assisted', enabled: false, solverMode: 'fast' },
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
      { actorMode: 'assisted', enabled: true, solverMode: 'fast' },
      mockSolver,
      mockOnQuizProcessed
    );
    mockQuiz.alreadyAnswered = true;

    await workflow.process(mockQuiz);

    expect(mockSolver).not.toHaveBeenCalled();
    expect(mockActor.act).not.toHaveBeenCalled();
    expect(mockOnQuizProcessed).not.toHaveBeenCalled();
  });

  it('skips solving if a choice was selected after extraction but before processing', async () => {
    const workflow = new QuizWorkflow(
      mockActor,
      { actorMode: 'assisted', enabled: true, solverMode: 'fast' },
      mockSolver,
      mockOnQuizProcessed
    );
    mockQuiz.options[1]!.element.classList.add('choice--selected');
    expect(mockQuiz.alreadyAnswered).toBe(false);

    await workflow.process(mockQuiz);

    expect(mockSolver).not.toHaveBeenCalled();
    expect(mockActor.act).not.toHaveBeenCalled();
    expect(mockOnQuizProcessed).not.toHaveBeenCalled();
  });

  it.each([
    { mode: 'assisted', selectedIndex: 0 },
    { mode: 'assisted', selectedIndex: 1 },
    { mode: 'auto', selectedIndex: 0 },
    { mode: 'auto', selectedIndex: 1 },
  ] as const)(
    'skips $mode action if option $selectedIndex is selected while inference is pending',
    async ({ mode, selectedIndex }) => {
      let resolveSolve!: (response: BackgroundResponse) => void;
      mockSolver.mockReturnValue(new Promise<BackgroundResponse>((resolve) => {
        resolveSolve = resolve;
      }));
      const actor: Actor = { ...mockActor, mode };
      const workflow = new QuizWorkflow(
        actor,
        { actorMode: mode, enabled: true, solverMode: 'fast' },
        mockSolver,
        mockOnQuizProcessed
      );

      const processing = workflow.process(mockQuiz);
      expect(mockSolver).toHaveBeenCalledTimes(1);
      expect(actor.act).not.toHaveBeenCalled();

      const selected = mockQuiz.options[selectedIndex]!.element;
      selected.classList.add('choice--selected');
      expect(mockQuiz.alreadyAnswered).toBe(false);
      resolveSolve(solvedResponse);
      await processing;

      expect(actor.act).not.toHaveBeenCalled();
      expect(mockOnQuizProcessed).not.toHaveBeenCalled();
      expect(selected.classList.contains('choice--selected')).toBe(true);
    }
  );

  it('acts after pending inference resolves if no option has been selected', async () => {
    let resolveSolve!: (response: BackgroundResponse) => void;
    mockSolver.mockReturnValue(new Promise<BackgroundResponse>((resolve) => {
      resolveSolve = resolve;
    }));
    const workflow = new QuizWorkflow(
      mockActor,
      { actorMode: 'assisted', enabled: true, solverMode: 'fast' },
      mockSolver,
      mockOnQuizProcessed
    );

    const processing = workflow.process(mockQuiz);
    expect(mockSolver).toHaveBeenCalledTimes(1);
    expect(mockActor.act).not.toHaveBeenCalled();

    resolveSolve(solvedResponse);
    await processing;

    expect(mockActor.act).toHaveBeenCalledTimes(1);
    expect(mockOnQuizProcessed).toHaveBeenCalledWith(mockQuiz);
  });

  it('ignores a selected choice outside the current quiz', async () => {
    const document = mockQuiz.containerElement.ownerDocument;
    const otherChoice = document.createElement('a');
    otherChoice.className = 'choice choice--selected';
    document.body.appendChild(otherChoice);
    const workflow = new QuizWorkflow(
      mockActor,
      { actorMode: 'assisted', enabled: true, solverMode: 'fast' },
      mockSolver,
      mockOnQuizProcessed
    );

    await workflow.process(mockQuiz);

    expect(mockActor.act).toHaveBeenCalledTimes(1);
    expect(mockOnQuizProcessed).toHaveBeenCalledWith(mockQuiz);
  });

  it('sends solve request with mapped options, invokes actor and onQuizProcessed on QUIZ_SOLVED', async () => {
    const workflow = new QuizWorkflow(
      mockActor,
      { actorMode: 'assisted', enabled: true, solverMode: 'fast' },
      mockSolver,
      mockOnQuizProcessed
    );

    await workflow.process(mockQuiz);

    expect(mockSolver).toHaveBeenCalledWith({
      type: 'SOLVE_QUIZ',
      payload: {
        question: 'Test Question',
        options: [
          { label: 'A', text: 'Option 1' },
          { label: 'B', text: 'Option 2' },
        ],
        mode: 'fast',
      },
    });
    expect(mockActor.act).toHaveBeenCalledWith({
      quiz: mockQuiz,
      result: expect.objectContaining({ chosenLabel: 'A' }),
    });
    expect(mockOnQuizProcessed).toHaveBeenCalledWith(mockQuiz);
  });

  it('passes configured solverMode in SOLVE_QUIZ payload', async () => {
    const workflow = new QuizWorkflow(
      mockActor,
      { actorMode: 'assisted', enabled: true, solverMode: 'reasoning' },
      mockSolver,
      mockOnQuizProcessed
    );

    await workflow.process(mockQuiz);

    expect(mockSolver).toHaveBeenCalledWith({
      type: 'SOLVE_QUIZ',
      payload: expect.objectContaining({
        question: mockQuiz.question,
        mode: 'reasoning',
      }),
    });
  });

  it('handles background solver ERROR response without crashing or calling actor', async () => {
    mockSolver.mockResolvedValue({
      type: 'ERROR',
      payload: { message: 'Inference timeout' },
    });
    const workflow = new QuizWorkflow(
      mockActor,
      { actorMode: 'assisted', enabled: true, solverMode: 'fast' },
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
      { actorMode: 'assisted', enabled: true, solverMode: 'fast' },
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
      { actorMode: 'assisted', enabled: true, solverMode: 'fast' },
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
      { actorMode: 'assisted', enabled: true, solverMode: 'fast' },
      mockSolver
    );
    workflow.setActor(newActor);

    expect(mockActor.cleanup).toHaveBeenCalled();
    expect(workflow.getActor()).toBe(newActor);
  });

  it('cleans up actor when setConfig changes enabled to false', () => {
    const workflow = new QuizWorkflow(
      mockActor,
      { actorMode: 'assisted', enabled: true, solverMode: 'fast' },
      mockSolver
    );
    workflow.setConfig({ actorMode: 'assisted', enabled: false, solverMode: 'fast' });

    expect(mockActor.cleanup).toHaveBeenCalled();
    expect(workflow.getConfig()).toEqual({ actorMode: 'assisted', enabled: false, solverMode: 'fast' });
  });

  it('cleanup delegates to current actor cleanup', () => {
    const workflow = new QuizWorkflow(
      mockActor,
      { actorMode: 'assisted', enabled: true, solverMode: 'fast' },
      mockSolver
    );
    workflow.cleanup();

    expect(mockActor.cleanup).toHaveBeenCalled();
  });

  it('does not act if quiz container was detached while solver was in flight', async () => {
    const workflow = new QuizWorkflow(
      mockActor,
      { actorMode: 'assisted', enabled: true, solverMode: 'fast' },
      mockSolver,
      mockOnQuizProcessed
    );
    mockSolver.mockImplementation(async () => {
      mockQuiz.containerElement.remove();
      return solvedResponse;
    });

    await workflow.process(mockQuiz);

    expect(mockSolver).toHaveBeenCalled();
    expect(mockActor.act).not.toHaveBeenCalled();
    expect(mockOnQuizProcessed).not.toHaveBeenCalled();
  });

  it('does not act if extension was disabled while solver was in flight', async () => {
    let workflow: QuizWorkflow;
    mockSolver.mockImplementation(async () => {
      workflow.setConfig({ actorMode: 'assisted', enabled: false, solverMode: 'fast' });
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
      { actorMode: 'assisted', enabled: true, solverMode: 'fast' },
      mockSolver,
      mockOnQuizProcessed
    );

    await workflow.process(mockQuiz);

    expect(mockSolver).toHaveBeenCalled();
    expect(mockActor.act).not.toHaveBeenCalled();
    expect(mockOnQuizProcessed).not.toHaveBeenCalled();
  });
});
