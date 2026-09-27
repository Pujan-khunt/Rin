import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';
import { waitForMeeting, watchMeetingUnmount } from '../src/detection/lifecycle';
import { startQuizObserver } from '../src/detection/observer';

describe('Drona Lifecycle & Targeted Observer', () => {
  let dom: JSDOM;
  let document: Document;

  beforeEach(() => {
    dom = new JSDOM('<!DOCTYPE html><html><body><div id="root"></div></body></html>');
    document = dom.window.document;
    // Polyfill MutationObserver and DOM types using JSDOM window
    global.MutationObserver = dom.window.MutationObserver;
    global.Node = dom.window.Node;
    global.HTMLElement = dom.window.HTMLElement;
    global.document = dom.window.document;
  });

  it('triggers onReady immediately if .vp-container already exists', () => {
    const root = document.getElementById('root')!;
    const vp = document.createElement('div');
    vp.className = 'vp-container';
    root.appendChild(vp);

    const onReady = vi.fn();
    waitForMeeting(onReady, root);

    expect(onReady).toHaveBeenCalledWith(vp);
  });

  it('detects .vp-container added to #root reactively and disconnects ephemeral watcher', async () => {
    const root = document.getElementById('root')!;
    const onReady = vi.fn();
    const disconnect = waitForMeeting(onReady, root);

    // Simulate React mounting .vp-container into #root
    const vp = document.createElement('div');
    vp.className = 'vp-container';
    root.appendChild(vp);

    // Wait for MutationObserver microtask
    await new Promise((r) => setTimeout(r, 10));

    expect(onReady).toHaveBeenCalledWith(vp);
    disconnect();
  });

  it('detects .vp-container nested inside added subtree', async () => {
    const root = document.getElementById('root')!;
    const onReady = vi.fn();
    waitForMeeting(onReady, root);

    const wrapper = document.createElement('div');
    wrapper.className = 'wrapper';
    const vp = document.createElement('div');
    vp.className = 'vp-container';
    wrapper.appendChild(vp);
    root.appendChild(wrapper);

    await new Promise((r) => setTimeout(r, 10));

    expect(onReady).toHaveBeenCalledWith(vp);
  });

  it('handles missing root gracefully', () => {
    const onReady = vi.fn();
    const cleanup = waitForMeeting(onReady, null);

    // document has #root by default from beforeEach, but passing null explicitly
    // If querySelector fails or returns null
    const noRootDom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
    global.document = noRootDom.window.document;
    waitForMeeting(onReady);

    expect(onReady).not.toHaveBeenCalled();
    cleanup();
  });

  it('does not trigger onReady if disconnected before container is added', async () => {
    const root = document.getElementById('root')!;
    const onReady = vi.fn();
    const disconnect = waitForMeeting(onReady, root);

    disconnect();

    const vp = document.createElement('div');
    vp.className = 'vp-container';
    root.appendChild(vp);

    await new Promise((r) => setTimeout(r, 10));

    expect(onReady).not.toHaveBeenCalled();
  });

  it('targeted observer catches div.m-quiz added to .vp-container', async () => {
    const vp = document.createElement('div');
    vp.className = 'vp-container';
    document.getElementById('root')!.appendChild(vp);

    const onQuiz = vi.fn();
    const disconnectQuiz = startQuizObserver(vp, onQuiz);

    // Add quiz markup
    const quiz = document.createElement('div');
    quiz.className = 'm-quiz';
    quiz.innerHTML = `
      <div class="m-problem-description__markdown"><p>Question 1</p></div>
      <div class="m-problem-choices__list">
        <a class="choice"><div class="choice__name">A</div><div class="choice__text"><p>Ans</p></div></a>
      </div>
    `;
    vp.appendChild(quiz);

    await new Promise((r) => setTimeout(r, 10));

    expect(onQuiz).toHaveBeenCalledTimes(1);
    expect(onQuiz.mock.calls[0][0].question).toBe('Question 1');

    disconnectQuiz();
  });

  it('targeted observer triggers immediately if quiz is already present', () => {
    const vp = document.createElement('div');
    vp.className = 'vp-container';
    const quiz = document.createElement('div');
    quiz.className = 'm-quiz';
    quiz.innerHTML = `
      <div class="m-problem-description__markdown"><p>Existing Question</p></div>
      <div class="m-problem-choices__list">
        <a class="choice"><div class="choice__name">A</div><div class="choice__text"><p>Ans</p></div></a>
      </div>
    `;
    vp.appendChild(quiz);
    document.getElementById('root')!.appendChild(vp);

    const onQuiz = vi.fn();
    const disconnectQuiz = startQuizObserver(vp, onQuiz);

    expect(onQuiz).toHaveBeenCalledTimes(1);
    expect(onQuiz.mock.calls[0][0].question).toBe('Existing Question');

    disconnectQuiz();
  });

  it('does not trigger onQuiz after disconnect is called', async () => {
    const vp = document.createElement('div');
    vp.className = 'vp-container';
    document.getElementById('root')!.appendChild(vp);

    const onQuiz = vi.fn();
    const disconnectQuiz = startQuizObserver(vp, onQuiz);
    disconnectQuiz();

    const quiz = document.createElement('div');
    quiz.className = 'm-quiz';
    quiz.innerHTML = `
      <div class="m-problem-description__markdown"><p>Question After Disconnect</p></div>
      <div class="m-problem-choices__list">
        <a class="choice"><div class="choice__name">A</div><div class="choice__text"><p>Ans</p></div></a>
      </div>
    `;
    vp.appendChild(quiz);

    await new Promise((r) => setTimeout(r, 10));

    expect(onQuiz).not.toHaveBeenCalled();
  });

  it('waits for asynchronous markdown hydration inside div.m-quiz', async () => {
    const vp = document.createElement('div');
    vp.className = 'vp-container';
    document.getElementById('root')!.appendChild(vp);

    const onQuiz = vi.fn();
    const disconnectQuiz = startQuizObserver(vp, onQuiz);

    // 1. Mount unhydrated quiz shell (empty markdown div without <p> yet)
    const quiz = document.createElement('div');
    quiz.className = 'm-quiz';
    quiz.innerHTML = `
      <div class="m-problem-description__markdown"></div>
      <div class="m-problem-choices__list">
        <a class="choice"><div class="choice__name">A</div><div class="choice__text"><p>Ans</p></div></a>
      </div>
    `;
    vp.appendChild(quiz);

    await new Promise((r) => setTimeout(r, 10));

    // Must not trigger while question text is empty
    expect(onQuiz).not.toHaveBeenCalled();

    // 2. React asynchronously renders markdown paragraph into the shell
    const markdownEl = quiz.querySelector('.m-problem-description__markdown')!;
    const p = document.createElement('p');
    p.textContent = 'Asynchronously Rendered Question';
    markdownEl.appendChild(p);

    await new Promise((r) => setTimeout(r, 10));

    // Now onQuiz must be triggered with hydrated question
    expect(onQuiz).toHaveBeenCalledTimes(1);
    expect(onQuiz.mock.calls[0][0].question).toBe('Asynchronously Rendered Question');

    disconnectQuiz();
  });

  it('waits for asynchronous choice hydration inside div.m-quiz', async () => {
    const vp = document.createElement('div');
    vp.className = 'vp-container';
    document.getElementById('root')!.appendChild(vp);

    const onQuiz = vi.fn();
    const disconnectQuiz = startQuizObserver(vp, onQuiz);

    // Mount quiz shell with populated question but unhydrated choices
    const quiz = document.createElement('div');
    quiz.className = 'm-quiz';
    quiz.innerHTML = `
      <div class="m-problem-description__markdown"><p>Hydrated Question</p></div>
      <div class="m-problem-choices__list">
        <a class="choice"><div class="choice__name">A</div><div class="choice__text"></div></a>
      </div>
    `;
    vp.appendChild(quiz);

    await new Promise((r) => setTimeout(r, 10));
    expect(onQuiz).not.toHaveBeenCalled();

    // Hydrate choice text
    const choiceTextEl = quiz.querySelector('.choice__text')!;
    choiceTextEl.innerHTML = '<p>Hydrated Choice</p>';

    await new Promise((r) => setTimeout(r, 10));

    expect(onQuiz).toHaveBeenCalledTimes(1);
    expect(onQuiz.mock.calls[0][0].question).toBe('Hydrated Question');
    expect(onQuiz.mock.calls[0][0].options[0].text).toBe('Hydrated Choice');

    disconnectQuiz();
  });

  it('watchMeetingUnmount triggers onLeave when .vp-container is removed from its parent', async () => {
    const root = document.getElementById('root')!;
    const vp = document.createElement('div');
    vp.className = 'vp-container';
    root.appendChild(vp);

    const onLeave = vi.fn();
    const disconnect = watchMeetingUnmount(vp, onLeave);

    expect(onLeave).not.toHaveBeenCalled();

    // Simulate React unmounting the container
    root.removeChild(vp);

    await new Promise((r) => setTimeout(r, 10));

    expect(onLeave).toHaveBeenCalledTimes(1);
    disconnect();
  });

  it('watchMeetingUnmount does not trigger onLeave if disconnected before unmount', async () => {
    const root = document.getElementById('root')!;
    const vp = document.createElement('div');
    vp.className = 'vp-container';
    root.appendChild(vp);

    const onLeave = vi.fn();
    const disconnect = watchMeetingUnmount(vp, onLeave);

    disconnect();

    root.removeChild(vp);

    await new Promise((r) => setTimeout(r, 10));

    expect(onLeave).not.toHaveBeenCalled();
  });
});
