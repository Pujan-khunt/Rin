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
   * Confidence score reported by the model (ranging from 0.0 to 1.0).
   * Will be `null` if the inference provider does not supply confidence metrics.
   */
  confidence: number | null;

  /**
   * Identifier of the solver source or model that evaluated the quiz
   * (e.g. "jev", "typesafe/jev-1.13", or "mock").
   */
  source: string;

  /**
   * End-to-end inference latency measured in milliseconds.
   */
  latencyMs: number;
}

