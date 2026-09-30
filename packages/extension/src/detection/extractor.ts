import { SELECTORS } from '../config/selectors';
import { findSelfOrDescendant } from '../utils/dom';
import { logger } from '../services/logger';
import type { QuizData } from '../interfaces/quiz';
import type { QuizOption } from '@rin/shared';

function normalizeText(text: string | null | undefined): string {
  return text?.replace(/\s+/g, ' ').trim() ?? '';
}

function extractQuestion(root: HTMLElement): string | null {
  const questionEl = root.querySelector<HTMLElement>(SELECTORS.quiz.questionMarkdown);
  if (!questionEl) return null;

  const children = Array.from(questionEl.children);
  const question =
    children.length > 0
      ? children
          .map((child) => {
            if (child.tagName === 'PRE' || child.querySelector('pre')) {
              return child.textContent?.trim() ?? '';
            }
            return normalizeText(child.textContent);
          })
          .filter(Boolean)
          .join('\n')
      : normalizeText(questionEl.textContent);

  return question || null;
}

function extractOptions(
  root: HTMLElement
): { options: QuizOption[]; optionElements: HTMLElement[] } | null {
  const choiceNodes = root.querySelectorAll<HTMLElement>(SELECTORS.quiz.choiceItem);
  if (choiceNodes.length === 0) return null;

  const options: QuizOption[] = [];
  const optionElements: HTMLElement[] = [];

  choiceNodes.forEach((node, index) => {
    const rawLabel = node.querySelector(SELECTORS.quiz.choiceLabel)?.textContent?.trim();
    const label = rawLabel || String.fromCharCode(65 + index);
    const text = normalizeText(node.querySelector(SELECTORS.quiz.choiceText)?.textContent);

    options.push({ label, text, index });
    optionElements.push(node);
  });

  // Fail-fast: If options are completely empty of text, they haven't finished hydrating yet
  if (options.every((opt) => !opt.text)) return null;

  return { options, optionElements };
}

/**
 * Extracts quiz questions, options, and container references from a quiz DOM node.
 * Returns null if the element is not a quiz, has no options, or has empty question text.
 */
export function extractQuiz(container: HTMLElement): QuizData | null {
  const root = findSelfOrDescendant(container, SELECTORS.quiz.root);
  if (!root) return null;

  const question = extractQuestion(root);
  if (!question) {
    logger.debug('Extractor', 'Question markdown not yet hydrated.');
    return null;
  }

  const parsedOptions = extractOptions(root);
  if (!parsedOptions) {
    logger.debug('Extractor', 'Options list not yet hydrated.');
    return null;
  }

  const alreadyAnswered = root.querySelector(SELECTORS.quiz.choiceSelected) !== null;

  logger.info(
    'Extractor',
    `Extracted quiz with ${parsedOptions.options.length} options: "${question.slice(0, 60)}..."`,
    { options: parsedOptions.options.map((o) => `${o.label}: ${o.text}`), alreadyAnswered }
  );

  return {
    question,
    options: parsedOptions.options,
    optionElements: parsedOptions.optionElements,
    containerElement: root,
    rawHtml: root.outerHTML,
    detectedAt: performance.now(),
    alreadyAnswered,
  };
}
