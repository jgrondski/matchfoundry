import { getBaseDb } from './index';
import { getActiveTransaction, runInTransactionContext } from './txContext';

/**
 * Runs fn inside one database transaction. Every getDb() call made by fn (directly or through any
 * function it calls) uses that transaction. A throw rolls everything back. Nested calls join the
 * outer transaction.
 */
export async function withTransaction<T>(fn: () => Promise<T>): Promise<T> {
  if (getActiveTransaction()) return fn();
  return getBaseDb().transaction((tx: unknown) => runInTransactionContext(tx, fn));
}
