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
 * Represents a choice extracted directly from the browser DOM.
 *
 * Extends {@link QuizChoice} by adding client-side positional metadata
 * needed by UI execution actors (`HudActor` and `ClickActor`) to locate
 * the corresponding HTML element in the DOM tree.
 */
export interface QuizOption extends QuizChoice {
  /**
   * Zero-based index of this option within the quiz's option list.
   * Directly correlates with `optionElements[index]` in the extension DOM layer,
   * enabling actors to highlight or click the target element without DOM rescans.
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
   * Optional inference model identifier (e.g. "typesafe/jev-1.13" or "google/gemini-2.5-flash-lite").
   * Defaults to "typesafe/jev-1.13" on the worker if omitted.
   */
  model?: string;
}

