import type { QuizInput, SolveResult, WorkerErrorResponse } from '@rin/shared';
import { CLIENT_HEADER_NAME } from '@rin/shared';
import { logger } from '../services/logger';

export const DEFAULT_WORKER_URL = 'https://rin-worker.pujankhunt.me/solve';

export class WorkerClient {
  private readonly clientKey: string;

  constructor(
    private readonly workerUrl: string = DEFAULT_WORKER_URL,
    private readonly timeoutMs: number = 5000,
    clientKey?: string
  ) {
    const key = clientKey || import.meta.env.RIN_CLIENT_KEY;
    if (!key) {
      throw new Error(
        'WorkerClient initialization failed: RIN_CLIENT_KEY is missing. Provide RIN_CLIENT_KEY at build time or pass it to constructor.'
      );
    }
    this.clientKey = key;
  }

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
      const errorData = (await response.json()) as WorkerErrorResponse;
      const errorMessage = errorData?.error
        ? `Worker returned HTTP ${response.status}: ${errorData.error}`
        : `Worker returned HTTP ${response.status}`;
      logger.error('WorkerClient', errorMessage);
      throw new Error(errorMessage);
    }

    const result = (await response.json()) as SolveResult;
    logger.debug('WorkerClient', `Solver returned successfully in ${result.latencyMs}ms`);
    return result;
  }
}

