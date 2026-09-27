import { SELECTORS } from '../config/selectors';
import { findSelfOrDescendant } from '../utils/dom';
import type { QuizData } from '../interfaces/quiz';
import type { QuizOption } from '@rin/shared';

/**
 * Extracts quiz questions, options, and container references from a quiz DOM node.
 * Returns null if the element is not a quiz, has no options, or has empty question text.
 */
export function extractQuiz(container: HTMLElement): QuizData | null {
  const root = findSelfOrDescendant(container, SELECTORS.quiz.root);
  if (!root) return null;

  const questionEl = root.querySelector<HTMLElement>(SELECTORS.quiz.questionMarkdown);
  const choiceNodes = root.querySelectorAll<HTMLElement>(SELECTORS.quiz.choiceItem);

  if (!questionEl || choiceNodes.length === 0) return null;

  const paragraphNodes = questionEl.querySelectorAll<HTMLElement>('p');
  const question = paragraphNodes.length > 0
    ? Array.from(paragraphNodes)
        .map((p) => p.textContent?.replace(/\s+/g, ' ').trim())
        .filter(Boolean)
        .join('\n')
    : questionEl.textContent?.replace(/\s+/g, ' ').trim();

  // Fail-fast: Empty or unrendered question text indicates an invalid/unhydrated quiz state
  if (!question) return null;

  const options: QuizOption[] = [];
  const optionElements: HTMLElement[] = [];

  choiceNodes.forEach((node, index) => {
    const label = node.querySelector(SELECTORS.quiz.choiceLabel)?.textContent?.trim() ?? String.fromCharCode(65 + index);
    const text = node.querySelector(SELECTORS.quiz.choiceText)?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    options.push({ label, text, index });
    optionElements.push(node);
  });

  // Fail-fast: If options are completely empty of text, they haven't finished hydrating yet
  if (options.every((opt) => !opt.text)) return null;

  return {
    question,
    options,
    optionElements,
    containerElement: root,
    rawHtml: root.outerHTML,
    detectedAt: performance.now(),
  };
}
