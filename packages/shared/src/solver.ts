/**
 * Standard client authentication header sent by the Rin extension to the Cloudflare Worker.
 */
export const CLIENT_HEADER_NAME = 'X-Rin-Client';

/**
 * Error response payload returned by the Cloudflare Worker when a request fails.
 */
export interface WorkerErrorResponse {
  error: string;
}

/**
 * Normalized result payload produced by the solver engine.
 *
 * Returned by the Cloudflare Worker and consumed by the extension background
 * and actors to highlight or select the recommended option.
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
   * (e.g. "deepseek-flash" or "mock").
   */
  source: string;

  /**
   * Rounded worker-side duration for prompt construction, upstream inference,
   * and answer parsing. Excludes extension transport and browser actions.
   */
  latencyMs: number;
}
