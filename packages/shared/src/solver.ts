/**
 * Normalized result payload produced by the solver engine.
 *
 * Returned by the Cloudflare Worker proxy (`POST /solve`) and offline benchmark
 * harness, then consumed by the extension background script and actors
 * (`HudActor`, `ClickActor`) to highlight or select the answer.
 */
export interface SolveResult {
  /**
   * Zero-based index of the recommended option corresponding to the original
   * `options` array passed in {@link QuizInput}.
   */
  chosenIndex: number;

  /**
   * Visual label of the chosen option (e.g. "A", "B", "C", "D").
   */
  chosenLabel: string;


  /**
   * Identifier of the solver source or model that evaluated the quiz
   * (e.g. "deepseek/deepseek-v4-flash", "google/gemini-2.5-flash", or "mock").
   */
  source: string;

  /**
   * End-to-end inference latency measured in milliseconds.
   */
  latencyMs: number;
}

