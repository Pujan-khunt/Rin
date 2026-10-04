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
  /** Monotonic extraction timestamp from performance.now(). */
  detectedAt: number;
  rawHtml: string;
  /** Compatibility array; actors use options[index].element. */
  optionElements?: HTMLElement[];
}

export interface QuizObserverCallbacks {
  onQuiz: (quiz: QuizData) => void;
}
