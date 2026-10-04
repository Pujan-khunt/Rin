import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { SELECTORS } from '@/dom/selectors';
import { normalizeWhitespace, findSelfOrDescendant } from '@/dom/utils';

describe('DOM Selectors', () => {
  it('exports expected selector structure and constants', () => {
    expect(SELECTORS.app.root).toBe('#root');
    expect(SELECTORS.meeting.container).toBeDefined();
    expect(SELECTORS.quiz.root).toBe('div.m-quiz');
    expect(SELECTORS.quiz.questionMarkdown).toBe('.m-problem-description__markdown');
    expect(SELECTORS.quiz.choiceItem).toBe('.m-problem-choices__list > a.choice');
    expect(SELECTORS.quiz.choiceLabel).toBe('.choice__name');
    expect(SELECTORS.quiz.choiceText).toBe('.choice__text');
    expect(SELECTORS.quiz.choiceSelected).toBe('.choice--selected');
  });
});

describe('DOM Utils - normalizeWhitespace', () => {
  it('returns empty string for null, undefined, or empty string', () => {
    expect(normalizeWhitespace()).toBe('');
    expect(normalizeWhitespace(undefined)).toBe('');
    expect(normalizeWhitespace(null)).toBe('');
    expect(normalizeWhitespace('')).toBe('');
  });

  it('trims leading and trailing whitespace', () => {
    expect(normalizeWhitespace('  hello world  ')).toBe('hello world');
  });

  it('collapses multiple whitespace characters including tabs and newlines', () => {
    expect(normalizeWhitespace('hello \n\t  beautiful   world\n')).toBe('hello beautiful world');
  });

  it('returns empty string for whitespace-only input', () => {
    expect(normalizeWhitespace('   \t\n  ')).toBe('');
  });
});

describe('DOM Utils - findSelfOrDescendant', () => {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
  const document = dom.window.document;

  it('returns the root element itself if root matches the selector', () => {
    const root = document.createElement('div');
    root.className = 'target-class';

    const match = findSelfOrDescendant(root, '.target-class');
    expect(match).toBe(root);
  });

  it('returns matching descendant if child matches the selector', () => {
    const root = document.createElement('div');
    const child = document.createElement('span');
    child.className = 'target-child';
    root.appendChild(child);

    const match = findSelfOrDescendant(root, '.target-child');
    expect(match).toBe(child);
  });

  it('returns null when neither root nor descendants match', () => {
    const root = document.createElement('div');
    const child = document.createElement('span');
    root.appendChild(child);

    const match = findSelfOrDescendant(root, '.non-existent');
    expect(match).toBeNull();
  });
});
