import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq, like } from 'drizzle-orm';
import type pg from 'pg';
import { getDb, setDb } from '../index';
import { players } from '../schema';
import { withTransaction } from '../transaction';
import { RUN_PG_TESTS, connectLocalPostgres } from './pgTestDb';

const PREFIX = 'PGT_';
const uniqueName = () => `${PREFIX}${crypto.randomUUID()}`;
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe.skipIf(!RUN_PG_TESTS)('withTransaction on real PostgreSQL', () => {
  let db: any;
  let pool: pg.Pool;

  beforeAll(() => {
    const conn = connectLocalPostgres();
    db = conn.db;
    pool = conn.pool;
    setDb(db);
  });

  afterAll(async () => {
    await db.delete(players).where(like(players.name, `${PREFIX}%`));
    setDb(null);
    await pool.end();
  });

  async function findByName(name: string) {
    return db.select().from(players).where(eq(players.name, name));
  }

  it('rolls back when fn throws', async () => {
    const name = uniqueName();
    await expect(
      withTransaction(async () => {
        await getDb().insert(players).values({ name });
        throw new Error('rollback');
      })
    ).rejects.toThrow('rollback');
    expect(await findByName(name)).toHaveLength(0);
  });

  it('commits when fn returns', async () => {
    const name = uniqueName();
    await withTransaction(async () => {
      await getDb().insert(players).values({ name });
    });
    expect(await findByName(name)).toHaveLength(1);
  });

  it('a nested withTransaction joins the outer one and rolls back with it', async () => {
    const name = uniqueName();
    await expect(
      withTransaction(async () => {
        await withTransaction(async () => {
          await getDb().insert(players).values({ name });
        });
        throw new Error('outer');
      })
    ).rejects.toThrow('outer');
    expect(await findByName(name)).toHaveLength(0);
  });

  it('select ... for update blocks a second transaction until the first commits', async () => {
    const name = uniqueName();
    const [row] = await db.insert(players).values({ name }).returning({ id: players.id });

    const aStart = Date.now();
    const a = withTransaction(async () => {
      await getDb().select().from(players).where(eq(players.id, row.id)).for('update');
      await sleep(300);
      await getDb().update(players).set({ notes: 'A' }).where(eq(players.id, row.id));
    });

    await sleep(50);
    let bSelectReturnedAt = 0;
    const b = withTransaction(async () => {
      await getDb().select().from(players).where(eq(players.id, row.id)).for('update');
      bSelectReturnedAt = Date.now();
      await getDb().update(players).set({ notes: 'B' }).where(eq(players.id, row.id));
    });

    await Promise.all([a, b]);

    expect(bSelectReturnedAt - aStart).toBeGreaterThanOrEqual(250);
    const [final] = await db.select({ notes: players.notes }).from(players).where(eq(players.id, row.id));
    expect(final.notes).toBe('B');
  });
});
