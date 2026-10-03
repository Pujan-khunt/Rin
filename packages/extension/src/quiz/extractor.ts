import { SELECTORS } from '@/dom/selectors';
import { findSelfOrDescendant, normalizeWhitespace } from '@/dom/utils';
import { logger } from '@/messaging/logger';
import type { DetectedOption, QuizData } from '@/quiz/types';

export { normalizeWhitespace };

/**
 * Extracts inner text for a block element.
 * Preserves whitespace and newlines for PRE and PRE-containing blocks,
 * otherwise normalizes whitespace for paragraphs and inline blocks.
 */
export function extractBlockText(node: Element): string {
  if (node.tagName === 'PRE' || node.querySelector('pre')) {
    return node.textContent?.trim() ?? '';
  }
  return normalizeWhitespace(node.textContent);
}

/**
 * Extracts and formats the markdown question text from the quiz root container.
 * Returns null if the markdown element is missing or results in empty text.
 */
export function parseQuestion(root: HTMLElement): string | null {
  const questionEl = root.querySelector<HTMLElement>(SELECTORS.quiz.questionMarkdown);
  if (!questionEl) return null;

  const children = Array.from(questionEl.children);
  const question =
    children.length > 0
      ? children
          .map((child) => extractBlockText(child))
          .filter(Boolean)
          .join('\n')
      : normalizeWhitespace(questionEl.textContent);

  return question || null;
}

/**
 * Parses a single option node into a DetectedOption containing its label, text, index,
 * and direct reference to its HTMLElement.
 */
export function parseOption(node: HTMLElement, index: number): DetectedOption {
  const rawLabel = node.querySelector(SELECTORS.quiz.choiceLabel)?.textContent?.trim();
  const label = rawLabel || String.fromCharCode(65 + index);
  const text = normalizeWhitespace(node.querySelector(SELECTORS.quiz.choiceText)?.textContent);

  return {
    label,
    text,
    index,
    element: node,
  };
}

/**
 * Extracts quiz questions, options, and container references from a quiz DOM node.
 * Returns null if the element is not a quiz, has no options, or fails hydration guards
 * (question is empty or no options have text yet).
 */
export function extractQuiz(container: HTMLElement): QuizData | null {
  const root = findSelfOrDescendant(container, SELECTORS.quiz.root);
  if (!root) return null;

  const question = parseQuestion(root);
  if (!question) {
    logger.debug('Extractor', 'Question markdown not yet hydrated.');
    return null;
  }

  const choiceNodes = Array.from(root.querySelectorAll<HTMLElement>(SELECTORS.quiz.choiceItem));
  if (choiceNodes.length === 0) {
    logger.debug('Extractor', 'Options list not yet hydrated.');
    return null;
  }

  const options = choiceNodes.map((node, index) => parseOption(node, index));

  const isHydrated = question.length > 0 && options.some((opt) => opt.text.length > 0);
  if (!isHydrated) {
    logger.debug('Extractor', 'Quiz markdown or options not yet hydrated.');
    return null;
  }

  const alreadyAnswered = root.querySelector(SELECTORS.quiz.choiceSelected) !== null;

  logger.info(
    'Extractor',
    `Extracted quiz with ${options.length} options: "${question.slice(0, 60)}..."`,
    { options: options.map((o) => `${o.label}: ${o.text}`), alreadyAnswered }
  );

  return {
    question,
    options,
    containerElement: root,
    alreadyAnswered,
    detectedAt: performance.now(),
    rawHtml: root.outerHTML,
    optionElements: options.map((opt) => opt.element),
  };
}
