import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';
import { MeetingWatcher } from '@/meeting/watcher';
import type { MeetingCallbacks } from '@/meeting/types';

describe('MeetingWatcher', () => {
  let dom: JSDOM;
  let document: Document;
  let callbacks: MeetingCallbacks;

  beforeEach(() => {
    dom = new JSDOM('<!DOCTYPE html><html><body><div id="root"></div></body></html>');
    document = dom.window.document;
    global.MutationObserver = dom.window.MutationObserver;
    global.Node = dom.window.Node;
    global.HTMLElement = dom.window.HTMLElement;
    global.document = dom.window.document;

    callbacks = {
      onEnter: vi.fn(),
      onLeave: vi.fn(),
    };
  });

  it('triggers onEnter immediately via fast-path if .m-activity already exists', () => {
    const root = document.getElementById('root')!;
    const activity = document.createElement('div');
    activity.className = 'm-activity';
    root.appendChild(activity);

    const watcher = new MeetingWatcher(callbacks);
    watcher.start();

    expect(callbacks.onEnter).toHaveBeenCalledTimes(1);
    expect(callbacks.onEnter).toHaveBeenCalledWith(activity);
    expect(watcher.getContainer()).toBe(activity);
  });

  it('triggers onEnter immediately via fast-path if .vp-container already exists in dev', () => {
    const root = document.getElementById('root')!;
    const vpContainer = document.createElement('div');
    vpContainer.className = 'vp-container';
    root.appendChild(vpContainer);

    const watcher = new MeetingWatcher(callbacks);
    watcher.start();

    expect(callbacks.onEnter).toHaveBeenCalledTimes(1);
    expect(callbacks.onEnter).toHaveBeenCalledWith(vpContainer);
    expect(watcher.getContainer()).toBe(vpContainer);
  });

  it('detects .m-activity added reactively to #root and invokes onEnter', async () => {
    const root = document.getElementById('root')!;
    const watcher = new MeetingWatcher(callbacks);
    watcher.start();

    expect(callbacks.onEnter).not.toHaveBeenCalled();

    const activity = document.createElement('div');
    activity.className = 'm-activity';
    root.appendChild(activity);

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(callbacks.onEnter).toHaveBeenCalledTimes(1);
    expect(callbacks.onEnter).toHaveBeenCalledWith(activity);
    expect(watcher.getContainer()).toBe(activity);
  });

  it('detects container nested inside an added wrapper element', async () => {
    const root = document.getElementById('root')!;
    const watcher = new MeetingWatcher(callbacks);
    watcher.start();

    const wrapper = document.createElement('div');
    wrapper.className = 'session-wrapper';
    const activity = document.createElement('div');
    activity.className = 'm-activity';
    wrapper.appendChild(activity);
    root.appendChild(wrapper);

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(callbacks.onEnter).toHaveBeenCalledTimes(1);
    expect(callbacks.onEnter).toHaveBeenCalledWith(activity);
  });

  it('invokes onLeave, resets container, and automatically re-arms when container unmounts', async () => {
    const root = document.getElementById('root')!;
    const activity1 = document.createElement('div');
    activity1.className = 'm-activity';
    root.appendChild(activity1);

    const watcher = new MeetingWatcher(callbacks);
    watcher.start();

    expect(callbacks.onEnter).toHaveBeenCalledWith(activity1);
    expect(watcher.getContainer()).toBe(activity1);

    // 1. Container unmounts
    activity1.remove();

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(callbacks.onLeave).toHaveBeenCalledTimes(1);
    expect(watcher.getContainer()).toBeNull();

    // 2. Self-rearmed: A subsequent meeting mounts in the same session
    const activity2 = document.createElement('div');
    activity2.className = 'm-activity';
    root.appendChild(activity2);

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(callbacks.onEnter).toHaveBeenCalledTimes(2);
    expect(callbacks.onEnter).toHaveBeenLastCalledWith(activity2);
    expect(watcher.getContainer()).toBe(activity2);
  });

  it('detects unmount when an ancestor of the container is removed from #root', async () => {
    const root = document.getElementById('root')!;
    const modal = document.createElement('div');
    modal.className = 'me-cr-lecture-modal';
    const activity = document.createElement('div');
    activity.className = 'm-activity';
    modal.appendChild(activity);
    root.appendChild(modal);

    const watcher = new MeetingWatcher(callbacks);
    watcher.start();

    expect(callbacks.onEnter).toHaveBeenCalledWith(activity);
    expect(watcher.getContainer()).toBe(activity);

    // Remove ancestor modal from #root
    modal.remove();

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(callbacks.onLeave).toHaveBeenCalledTimes(1);
    expect(watcher.getContainer()).toBeNull();

    // Verify self-rearming: subsequent meeting mounts in new modal
    const newModal = document.createElement('div');
    newModal.className = 'me-cr-lecture-modal';
    const newActivity = document.createElement('div');
    newActivity.className = 'm-activity';
    newModal.appendChild(newActivity);
    root.appendChild(newModal);

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(callbacks.onEnter).toHaveBeenCalledTimes(2);
    expect(callbacks.onEnter).toHaveBeenLastCalledWith(newActivity);
    expect(watcher.getContainer()).toBe(newActivity);
  });

  it('cleanly stops and disconnects all observers without firing onLeave', async () => {
    const root = document.getElementById('root')!;
    const activity = document.createElement('div');
    activity.className = 'm-activity';
    root.appendChild(activity);

    const watcher = new MeetingWatcher(callbacks);
    watcher.start();

    expect(callbacks.onEnter).toHaveBeenCalledTimes(1);

    // Stop cleanly
    watcher.stop();
    expect(watcher.getContainer()).toBeNull();
    expect(callbacks.onLeave).not.toHaveBeenCalled();

    // Unmount after stop should NOT trigger onLeave or re-arm
    activity.remove();
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(callbacks.onLeave).not.toHaveBeenCalled();

    // New element added after stop should NOT trigger onEnter
    const newActivity = document.createElement('div');
    newActivity.className = 'm-activity';
    root.appendChild(newActivity);
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(callbacks.onEnter).toHaveBeenCalledTimes(1);
  });

  it('can be restarted after stop()', async () => {
    const root = document.getElementById('root')!;
    const watcher = new MeetingWatcher(callbacks);
    watcher.start();
    watcher.stop();

    const activity = document.createElement('div');
    activity.className = 'm-activity';
    root.appendChild(activity);

    watcher.start();
    expect(callbacks.onEnter).toHaveBeenCalledTimes(1);
    expect(callbacks.onEnter).toHaveBeenCalledWith(activity);
  });

  it('handles missing root element gracefully', () => {
    const emptyDom = new JSDOM('<!DOCTYPE html><html></html>');
    global.document = emptyDom.window.document;

    const watcher = new MeetingWatcher(callbacks);
    expect(() => watcher.start()).not.toThrow();
    expect(callbacks.onEnter).not.toHaveBeenCalled();
  });
});
