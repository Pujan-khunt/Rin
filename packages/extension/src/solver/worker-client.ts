import type { QuizInput, SolveResult } from '@rin/shared';

export const DEFAULT_WORKER_URL = 'https://rin-solver.pujankhunt2412.workers.dev/solve';

export class WorkerClient {
  constructor(
    private readonly workerUrl: string = DEFAULT_WORKER_URL,
    private readonly timeoutMs: number = 5000
  ) { }

  async solve(input: QuizInput): Promise<SolveResult> {
    const response = await fetch(this.workerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    if (!response.ok) {
      throw new Error(`Worker returned HTTP ${response.status}`);
    }

    return (await response.json()) as SolveResult;
  }
}
