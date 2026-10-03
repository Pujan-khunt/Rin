import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';
import { QuizObserver } from '@/quiz/observer';
import type { QuizObserverCallbacks, QuizData } from '@/quiz/types';

describe('QuizObserver', () => {
  let dom: JSDOM;
  let document: Document;
  let root: HTMLElement;
  let meetingContainer: HTMLElement;
  let callbacks: QuizObserverCallbacks;

  const createHydratedQuizHtml = (questionText = 'What is 2+2?', optionTexts = ['3', '4', '5']) => `
    <div class="m-quiz">
      <div class="m-problem-description__markdown">
        <p>${questionText}</p>
      </div>
      <div class="m-problem-choices__list">
        ${optionTexts
          .map(
            (opt, idx) => `
          <a class="choice">
            <span class="choice__name">${String.fromCharCode(65 + idx)}</span>
            <span class="choice__text">${opt}</span>
          </a>
        `
          )
          .join('')}
      </div>
    </div>
  `;

  beforeEach(() => {
    dom = new JSDOM('<!DOCTYPE html><html><body><div id="root"></div></body></html>');
    document = dom.window.document;
    global.MutationObserver = dom.window.MutationObserver;
    global.Node = dom.window.Node;
    global.HTMLElement = dom.window.HTMLElement;
    global.document = dom.window.document;

    root = document.getElementById('root')!;
    meetingContainer = document.createElement('div');
    meetingContainer.className = 'm-activity';
    root.appendChild(meetingContainer);

    callbacks = {
      onQuiz: vi.fn(),
    };
  });

  it('triggers onQuiz immediately via fast-path if quiz is already hydrated', () => {
    meetingContainer.innerHTML = createHydratedQuizHtml('What is capital of France?', ['Paris', 'London']);

    const observer = new QuizObserver(callbacks);
    observer.start(meetingContainer);

    expect(callbacks.onQuiz).toHaveBeenCalledTimes(1);
    const emittedQuiz = (callbacks.onQuiz as any).mock.calls[0][0] as QuizData;
    expect(emittedQuiz.question).toBe('What is capital of France?');
    expect(emittedQuiz.options).toHaveLength(2);
    expect(emittedQuiz.options[0].text).toBe('Paris');
  });

  it('emits fast-path quiz and continues observing so subsequent quizzes are also emitted', async () => {
    meetingContainer.innerHTML = createHydratedQuizHtml('Quiz 1: What is 1+1?', ['2', '3']);

    const observer = new QuizObserver(callbacks);
    observer.start(meetingContainer);

    expect(callbacks.onQuiz).toHaveBeenCalledTimes(1);
    expect((callbacks.onQuiz as any).mock.calls[0][0].question).toBe('Quiz 1: What is 1+1?');

    // Simulate next quiz appearing in the meeting container
    meetingContainer.innerHTML = createHydratedQuizHtml('Quiz 2: What is 2*3?', ['5', '6']);

    await new Promise((r) => setTimeout(r, 10));

    expect(callbacks.onQuiz).toHaveBeenCalledTimes(2);
    expect((callbacks.onQuiz as any).mock.calls[1][0].question).toBe('Quiz 2: What is 2*3?');
  });

  it('reactively extracts quiz when question and choices hydrate asynchronously', async () => {
    // Initially: empty quiz shell mounted without question or choices
    const quizShell = document.createElement('div');
    quizShell.className = 'm-quiz';
    meetingContainer.appendChild(quizShell);

    const observer = new QuizObserver(callbacks);
    observer.start(meetingContainer);

    expect(callbacks.onQuiz).not.toHaveBeenCalled();

    // Micro-step 1: Question markdown hydrates, but no choices yet
    const markdownEl = document.createElement('div');
    markdownEl.className = 'm-problem-description__markdown';
    markdownEl.innerHTML = '<p>Solve for x: x = 10 * 5</p>';
    quizShell.appendChild(markdownEl);

    await new Promise((r) => setTimeout(r, 10));
    expect(callbacks.onQuiz).not.toHaveBeenCalled();

    // Micro-step 2: Choices list hydrates
    const choicesList = document.createElement('div');
    choicesList.className = 'm-problem-choices__list';
    choicesList.innerHTML = `
      <a class="choice"><span class="choice__name">A</span><span class="choice__text">40</span></a>
      <a class="choice"><span class="choice__name">B</span><span class="choice__text">50</span></a>
    `;
    quizShell.appendChild(choicesList);

    await new Promise((r) => setTimeout(r, 10));

    expect(callbacks.onQuiz).toHaveBeenCalledTimes(1);
    const emittedQuiz = (callbacks.onQuiz as any).mock.calls[0][0] as QuizData;
    expect(emittedQuiz.question).toBe('Solve for x: x = 10 * 5');
    expect(emittedQuiz.options).toHaveLength(2);
    expect(emittedQuiz.options[1].text).toBe('50');
  });

  it('does not re-emit duplicate onQuiz calls for subsequent DOM mutations of the same quiz', async () => {
    const quizWrapper = document.createElement('div');
    quizWrapper.innerHTML = createHydratedQuizHtml('Static question', ['Opt 1', 'Opt 2']);
    meetingContainer.appendChild(quizWrapper);

    const observer = new QuizObserver(callbacks);
    observer.start(meetingContainer);

    expect(callbacks.onQuiz).toHaveBeenCalledTimes(1);

    // Simulate DOM mutation inside meetingContainer (e.g. countdown timer or class change)
    const choiceEl = meetingContainer.querySelector('a.choice')!;
    choiceEl.classList.add('choice--selected');

    await new Promise((r) => setTimeout(r, 10));

    expect(callbacks.onQuiz).toHaveBeenCalledTimes(1);
  });

  it('disconnects and stops if meetingContainer is detached during observation', async () => {
    const observer = new QuizObserver(callbacks);
    observer.start(meetingContainer);

    expect(observer.getContainer()).toBe(meetingContainer);

    // Detach container from DOM
    meetingContainer.remove();

    // Mutate container while detached
    const quizShell = document.createElement('div');
    quizShell.innerHTML = createHydratedQuizHtml('Detached Q', ['1', '2']);
    meetingContainer.appendChild(quizShell);

    await new Promise((r) => setTimeout(r, 10));

    expect(callbacks.onQuiz).not.toHaveBeenCalled();
    expect(observer.getContainer()).toBeNull();
  });

  it('cleanly stops observation and prevents subsequent emissions on stop()', async () => {
    const observer = new QuizObserver(callbacks);
    observer.start(meetingContainer);

    expect(observer.getContainer()).toBe(meetingContainer);

    observer.stop();
    expect(observer.getContainer()).toBeNull();

    // Adding a quiz after stop() must NOT trigger onQuiz
    meetingContainer.innerHTML = createHydratedQuizHtml('Post-stop Q', ['A', 'B']);
    await new Promise((r) => setTimeout(r, 10));

    expect(callbacks.onQuiz).not.toHaveBeenCalled();
  });

  it('cleans up previous observer if start() is called with a new container', async () => {
    const observer = new QuizObserver(callbacks);
    observer.start(meetingContainer);

    const container2 = document.createElement('div');
    container2.className = 'm-activity';
    root.appendChild(container2);

    observer.start(container2);
    expect(observer.getContainer()).toBe(container2);

    // Mutate container 1 - should not trigger
    meetingContainer.innerHTML = createHydratedQuizHtml('Container 1 Q', ['X', 'Y']);
    await new Promise((r) => setTimeout(r, 10));
    expect(callbacks.onQuiz).not.toHaveBeenCalled();

    // Mutate container 2 - should trigger
    container2.innerHTML = createHydratedQuizHtml('Container 2 Q', ['M', 'N']);
    await new Promise((r) => setTimeout(r, 10));
    expect(callbacks.onQuiz).toHaveBeenCalledTimes(1);
  });
});
