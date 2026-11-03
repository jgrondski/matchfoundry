import { AsyncLocalStorage } from 'node:async_hooks';

interface RequestMetricsState {
  startedAt: number;
  queryCount: number;
}

const storage = new AsyncLocalStorage<RequestMetricsState>();

/** Runs one API request with its own query counter and clock. */
export function runWithRequestMetrics<T>(fn: () => Promise<T>): Promise<T> {
  return storage.run({ startedAt: performance.now(), queryCount: 0 }, fn);
}

/** Counts one database query against the current request (no-op outside a request). */
export function recordQuery(): void {
  const state = storage.getStore();
  if (state) state.queryCount += 1;
}

export function getRequestMetrics(): { elapsedMs: number; queryCount: number } | null {
  const state = storage.getStore();
  if (!state) return null;
  return { elapsedMs: Math.round(performance.now() - state.startedAt), queryCount: state.queryCount };
}

export function formatServerTiming(metrics: { elapsedMs: number; queryCount: number }): string {
  return `app;dur=${metrics.elapsedMs}, db;desc="${metrics.queryCount} queries"`;
}

/** Drizzle logger that counts queries. Pass as `logger` to every drizzle() call in src/db/index.ts. */
export const queryCounterLogger = {
  logQuery(): void {
    recordQuery();
  },
};
