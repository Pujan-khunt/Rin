import type { QuizInput, SolveResult } from '@rin/shared';
import { CLIENT_HEADER_NAME, DEFAULT_CLIENT_KEY } from '@rin/shared';
import { logger } from '../services/logger';

export const DEFAULT_WORKER_URL = 'https://rin-worker.pujankhunt.me/solve';

export class WorkerClient {
  constructor(
    private readonly workerUrl: string = DEFAULT_WORKER_URL,
    private readonly timeoutMs: number = 5000,
    private readonly clientKey: string = DEFAULT_CLIENT_KEY
  ) {}

  async solve(input: QuizInput): Promise<SolveResult> {
    logger.debug('WorkerClient', `Dispatching POST to Cloudflare Worker solver: ${this.workerUrl}`);
    const response = await fetch(this.workerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        [CLIENT_HEADER_NAME]: this.clientKey,
      },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    if (!response.ok) {
      logger.error('WorkerClient', `Solver returned HTTP error ${response.status}`);
      throw new Error(`Worker returned HTTP ${response.status}`);
    }

    const result = (await response.json()) as SolveResult;
    logger.debug('WorkerClient', `Solver returned successfully in ${result.latencyMs}ms`);
    return result;
  }
}
