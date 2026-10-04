/**
 * Represents a single selectable choice in a multiple-choice quiz question.
 *
 * This interface defines the core semantic data of an option (its identifier
 * and text) independent of any browser DOM environment. It is used in network
 * payloads sent to the Cloudflare Worker and upstream AI inference models.
 */
export interface QuizChoice {
  /**
   * The identifier label of the choice (e.g. "A", "B", "C", "D" or "True", "False").
   * Matches the visual indicator shown next to the option in the UI.
   */
  label: string;

  /**
   * The plaintext content of the choice option.
   */
  text: string;
}

/**
 * Serializable choice with a zero-based position. The extension's DOM-bound
 * DetectedOption also holds an element reference used by its actors.
 */
export interface QuizOption extends QuizChoice {
  /**
   * Zero-based index of this option within the quiz's option list.
   */
  index: number;
}

/**
 * Normalized network payload transmitted to the solver proxy (`POST /solve`).
 *
 * Contains the extracted problem statement and list of choices required by the
 * AI decision model to determine the correct answer.
 */
export interface QuizInput {
  /**
   * The question or problem statement text extracted from the quiz modal.
   */
  question: string;

  /**
   * The list of available choices for the question.
   */
  options: QuizChoice[];

  /**
   * Optional inference model identifier (e.g. "deepseek/deepseek-v4-flash" or "google/gemini-2.5-flash").
   * Defaults to "deepseek/deepseek-v4-flash" on the worker if omitted.
   */
  model?: string;
}
