import type { ServerResponse } from 'http';
import { eq, or } from 'drizzle-orm';
import { getDb, tournaments } from '../db';
import { withTransaction } from '../db/transaction';
import { isUuid } from '../api/tournaments';

/** Returned by a tournament route handler when no route matched (the router then sends its 404). */
export const NOT_HANDLED = Symbol('NOT_HANDLED');

/** Non-GET tournament sub-routes that never take the lock: competitor draft autosave and webhook tests write no tournament state. */
export const UNLOCKED_SUBACTIONS = new Set(['qualify/draft', 'discord-webhook/test']);

export interface LockedWrite<T> {
  /** Resolved tournament UUID, or null when no tournament matched the id or slug. */
  tournamentId: string | null;
  /** The tournament's revision after this write's bump, or null when no tournament matched. */
  revision: number | null;
  result: T;
}

/**
 * Runs fn in a transaction holding a row lock on the tournament, after bumping its revision.
 * Other writes to the same tournament wait until this transaction commits or rolls back.
 */
export async function withTournamentWriteLock<T>(idOrSlug: string, fn: () => Promise<T>): Promise<LockedWrite<T>> {
  return withTransaction(async () => {
    const db = getDb();
    const condition = isUuid(idOrSlug)
      ? or(eq(tournaments.id, idOrSlug), eq(tournaments.slug, idOrSlug))
      : eq(tournaments.slug, idOrSlug);
    const [row] = await db
      .select({ id: tournaments.id, metadata: tournaments.metadata })
      .from(tournaments)
      .where(condition)
      .limit(1)
      .for('update');
    if (!row) {
      return { tournamentId: null, revision: null, result: await fn() };
    }
    const meta = (row.metadata as Record<string, unknown> | null) || {};
    const revision = Number(meta.revision ?? 0) + 1;
    await db.update(tournaments).set({ metadata: { ...meta, revision } }).where(eq(tournaments.id, row.id));
    return { tournamentId: row.id, revision, result: await fn() };
  });
}

/**
 * Runs a tournament write under the lock and holds back res.end() until the transaction commits,
 * so no client sees a success that is then rolled back. On a throw, the held response is discarded
 * and the error propagates (the router's catch sends the error response).
 */
export async function runLockedTournamentWrite<T>(
  res: ServerResponse,
  idOrSlug: string,
  fn: () => Promise<T>
): Promise<LockedWrite<T>> {
  const realEnd = res.end.bind(res) as (...args: unknown[]) => ServerResponse;
  let heldEnd: unknown[] | null = null;
  (res as unknown as { end: (...args: unknown[]) => ServerResponse }).end = (...args: unknown[]) => {
    heldEnd = args;
    return res;
  };
  try {
    const locked = await withTournamentWriteLock(idOrSlug, fn);
    (res as unknown as { end: typeof realEnd }).end = realEnd;
    if (heldEnd) realEnd(...(heldEnd as unknown[]));
    return locked;
  } catch (err) {
    (res as unknown as { end: typeof realEnd }).end = realEnd;
    throw err;
  }
}
