import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setupTestDb } from '../testDb';
import { getDb, setDb } from '../index';
import { withTransaction } from '../transaction';

describe('withTransaction (pg-mem)', () => {
  let db: any;

  beforeEach(() => {
    db = setupTestDb().db;
    setDb(db);
  });

  afterEach(() => {
    setDb(null);
  });

  it('getDb() returns the instance passed to setDb outside a transaction', () => {
    expect(getDb()).toBe(db);
  });

  it('getDb() returns the transaction inside withTransaction, and nested calls see the same object', async () => {
    let outer: unknown;
    let inner: unknown;
    await withTransaction(async () => {
      outer = getDb();
      await withTransaction(async () => {
        inner = getDb();
      });
    });
    expect(outer).toBeDefined();
    expect(outer).not.toBe(db);
    expect(inner).toBe(outer);
  });

  it('returns the value returned by fn', async () => {
    await expect(withTransaction(async () => 42)).resolves.toBe(42);
  });

  it('rejects with the same error thrown by fn', async () => {
    const err = new Error('boom');
    await expect(
      withTransaction(async () => {
        throw err;
      })
    ).rejects.toBe(err);
  });
});
