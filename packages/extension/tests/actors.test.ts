import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';
import { HudActor } from '../src/actors/hud-actor';
import { ClickActor } from '../src/actors/click-actor';
import type { QuizData } from '../src/interfaces/quiz';
import type { SolveResult } from '@rin/shared';

describe('Actor Implementations', () => {
  let dom: JSDOM;
  let document: Document;
  let mockOption: HTMLElement;
  let mockOption2: HTMLElement;
  let mockQuiz: QuizData;
  let mockResult: SolveResult;

  beforeEach(() => {
    dom = new JSDOM(
      '<!DOCTYPE html><html><body><a class="choice" style="background-color: rgb(255, 255, 255);"></a><a class="choice" style="background-color: rgb(200, 200, 200);"></a></body></html>'
    );
    document = dom.window.document;
    const choices = document.querySelectorAll('a.choice');
    mockOption = choices[0] as HTMLElement;
    mockOption2 = choices[1] as HTMLElement;

    global.window = dom.window as any;
    global.document = dom.window.document;
    global.MouseEvent = dom.window.MouseEvent as any;
    global.PointerEvent = (dom.window.PointerEvent || class PointerEvent extends dom.window.MouseEvent {}) as any;

    mockQuiz = {
      question: 'Test Question',
      options: [
        { label: 'A', text: 'Option A', index: 0 },
        { label: 'B', text: 'Option B', index: 1 },
      ],
      optionElements: [mockOption, mockOption2],
      containerElement: document.body,
      rawHtml: '',
      detectedAt: 0,
    };

    mockResult = {
      chosenIndex: 0,
      chosenLabel: 'A',
      confidence: 0.9,
      source: 'test',
      latencyMs: 10,
    };
  });

  describe('HudActor', () => {
    it('has mode set to assisted', () => {
      const actor = new HudActor();
      expect(actor.mode).toBe('assisted');
    });

    it('highlights chosen option in light purple and restores original style on cleanup', async () => {
      const actor = new HudActor();
      await actor.act({ quiz: mockQuiz, result: mockResult });

      expect(mockOption.style.backgroundColor).toBe('rgb(232, 213, 245)'); // #e8d5f5 in rgb
      expect(mockOption.style.transition).toBe('background-color 0.25s ease-in-out');

      actor.cleanup();
      expect(mockOption.style.backgroundColor).toBe('rgb(255, 255, 255)');
    });

    it('cleans up previous highlight when act is called again', async () => {
      const actor = new HudActor();
      await actor.act({ quiz: mockQuiz, result: mockResult });
      expect(mockOption.style.backgroundColor).toBe('rgb(232, 213, 245)');

      const secondResult: SolveResult = {
        ...mockResult,
        chosenIndex: 1,
        chosenLabel: 'B',
      };
      await actor.act({ quiz: mockQuiz, result: secondResult });

      expect(mockOption.style.backgroundColor).toBe('rgb(255, 255, 255)');
      expect(mockOption2.style.backgroundColor).toBe('rgb(232, 213, 245)');

      actor.cleanup();
      expect(mockOption2.style.backgroundColor).toBe('rgb(200, 200, 200)');
    });

    it('cleanup is safe to call multiple times', async () => {
      const actor = new HudActor();
      await actor.act({ quiz: mockQuiz, result: mockResult });
      actor.cleanup();
      expect(() => actor.cleanup()).not.toThrow();
      expect(mockOption.style.backgroundColor).toBe('rgb(255, 255, 255)');
    });

    it('handles invalid chosenIndex gracefully without crashing', async () => {
      const actor = new HudActor();
      const invalidResult: SolveResult = {
        ...mockResult,
        chosenIndex: 99,
      };

      await expect(actor.act({ quiz: mockQuiz, result: invalidResult })).resolves.toBeUndefined();
      expect(mockOption.style.backgroundColor).toBe('rgb(255, 255, 255)');
    });
  });

  describe('ClickActor', () => {
    it('has mode set to auto', () => {
      const actor = new ClickActor();
      expect(actor.mode).toBe('auto');
    });

    it('dispatches pointerdown, mousedown, pointerup, mouseup, and click sequence', async () => {
      const actor = new ClickActor();
      const eventsDispatched: string[] = [];

      ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach((type) => {
        mockOption.addEventListener(type, () => eventsDispatched.push(type));
      });

      await actor.act({ quiz: mockQuiz, result: mockResult });

      expect(eventsDispatched).toEqual(['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']);
    });

    it('cleanup is a no-op and does not throw', () => {
      const actor = new ClickActor();
      expect(() => actor.cleanup()).not.toThrow();
    });

    it('handles invalid chosenIndex gracefully without crashing', async () => {
      const actor = new ClickActor();
      const invalidResult: SolveResult = {
        ...mockResult,
        chosenIndex: 99,
      };

      await expect(actor.act({ quiz: mockQuiz, result: invalidResult })).resolves.toBeUndefined();
    });
  });
});
