export const SELECTORS = {
  app: {
    root: '#root',
  },
  meeting: {
    /** Live classroom activity container hosting meeting interactions and quizzes */
    container: '.m-activity',
  },
  quiz: {
    root: 'div.m-quiz',
    title: 'h1.dark.bold',
    questionMarkdown: '.m-problem-description__markdown',
    choicesList: '.m-problem-choices__list',
    choiceItem: '.m-problem-choices__list > a.choice',
    choiceLabel: '.choice__name',
    choiceText: '.choice__text',
  },
} as const;

export type Selectors = typeof SELECTORS;
