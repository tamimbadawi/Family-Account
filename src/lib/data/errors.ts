/** Thrown by a save when there is no connection. Nothing was written; the screen keeps its input. */
export class OfflineError extends Error {
  constructor() {
    super('No connection');
    this.name = 'OfflineError';
  }
}

export function isOfflineError(err: unknown): err is OfflineError {
  return err instanceof OfflineError || (err as { name?: unknown } | null)?.name === 'OfflineError';
}
