export interface DetectedOption {
  label: string;
  text: string;
  index: number;
  element: HTMLElement;
}

export interface QuizData {
  question: string;
  options: DetectedOption[];
  containerElement: HTMLElement;
  alreadyAnswered: boolean;
  detectedAt: number;
  rawHtml: string;
  optionElements?: HTMLElement[];
}

export interface QuizObserverCallbacks {
  onQuiz: (quiz: QuizData) => void;
}
