import { drizzle as drizzleNeon } from 'drizzle-orm/neon-serverless';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import { Pool as NeonPool, neonConfig } from '@neondatabase/serverless';
import { attachDatabasePool } from '@vercel/functions';
import ws from 'ws';
import pg from 'pg';
import * as schema from './schema';
import { queryCounterLogger } from '../server/requestMetrics';
import { getActiveTransaction } from './txContext';

let pgPool: pg.Pool | null = null;
let neonPool: NeonPool | null = null;
let currentDbInstance: any = null;

export { assertDatabaseConfig } from './config';
import { assertDatabaseConfig } from './config';

export function setDb(dbInstance: any) {
  currentDbInstance = dbInstance;
}

/** The database handle: the active transaction when inside withTransaction, else the shared instance. */
export function getDb(connectionString?: string) {
  const tx = getActiveTransaction();
  if (tx) return tx as any;
  return getBaseDb(connectionString);
}

/** The shared (non-transaction) instance. Only src/db/transaction.ts should call this directly. */
export function getBaseDb(connectionString?: string) {
  if (currentDbInstance) {
    return currentDbInstance;
  }

  const url = connectionString || assertDatabaseConfig();

  if (url.includes('neon.tech')) {
    neonConfig.webSocketConstructor = ws;
    neonPool = new NeonPool({ connectionString: url, max: 5, idleTimeoutMillis: 10_000 });
    neonPool.on('error', (err: Error) => console.error('[DB] Idle Neon connection error:', err));
    if (process.env.VERCEL) {
      // Keeps the function instance alive long enough to close idle connections cleanly.
      attachDatabasePool(neonPool as unknown as Parameters<typeof attachDatabasePool>[0]);
    }
    currentDbInstance = drizzleNeon({ client: neonPool, schema, logger: queryCounterLogger });
    return currentDbInstance;
  }

  if (!pgPool) {
    pgPool = new pg.Pool({ connectionString: url });
  }
  currentDbInstance = drizzlePg(pgPool, { schema, logger: queryCounterLogger });
  return currentDbInstance;
}

export * from './schema';
