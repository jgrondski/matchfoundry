import { AsyncLocalStorage } from 'node:async_hooks';

// The drizzle transaction the current async call chain is running inside, if any.
const storage = new AsyncLocalStorage<unknown>();

export function getActiveTransaction(): unknown | null {
  return storage.getStore() ?? null;
}

export function runInTransactionContext<T>(tx: unknown, fn: () => Promise<T>): Promise<T> {
  return storage.run(tx, fn);
}
