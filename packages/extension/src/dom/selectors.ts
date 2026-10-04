export const SELECTORS = {
  app: {
    root: '#root',
  },
  meeting: {
    /** Live classroom container (.m-activity), with dev-only support for recorded video player (.vp-container) */
    container: import.meta.env.DEV ? '.m-activity, .vp-container' : '.m-activity',
  },
  quiz: {
    root: 'div.m-quiz',
    questionMarkdown: '.m-problem-description__markdown',
    choiceItem: '.m-problem-choices__list > a.choice',
    choiceLabel: '.choice__name',
    choiceText: '.choice__text',
    choiceSelected: '.choice--selected',
  },
} as const;

export type Selectors = typeof SELECTORS;
