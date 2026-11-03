import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '../schema';

/** True only under `npm run test:pg` (npm sets npm_lifecycle_event on every platform). */
export const RUN_PG_TESTS = process.env.npm_lifecycle_event === 'test:pg';

/** Connects to the local Docker database from .env. Refuses any cloud (Neon) URL. */
export function connectLocalPostgres() {
  if (!process.env.DATABASE_URL) {
    try {
      process.loadEnvFile();
    } catch {
      // no .env; fall through to the check below
    }
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set; npm run test:pg needs the local Docker database.');
  if (url.includes('neon.tech')) throw new Error('npm run test:pg must never run against Neon.');
  const pool = new pg.Pool({ connectionString: url });
  return { db: drizzle(pool, { schema }), pool };
}
