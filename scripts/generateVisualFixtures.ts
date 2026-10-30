/**
 * Builds the frozen API responses for the visual regression suite, from code alone.
 * No database, dev server or .env is needed: the real API middleware runs in-process
 * against an in-memory pg-mem database, with randomness, UUIDs and the clock seeded,
 * so every run on every machine writes byte-identical fixtures.
 * Usage: npm run visual:fixtures
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'e2e', 'visual', 'fixtures');
const FIXED_NOW = Date.parse('2026-06-01T12:00:00Z');
const RANDOM_SEED = 20260601;
const SECRET_KEY = /pin|token|secret|webhook/i;

/** mulberry32: small, fast, seedable PRNG. */
function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function installDeterminism(): void {
  const random = seededRandom(RANDOM_SEED);
  Math.random = random;

  const hex = () => Math.floor(random() * 16).toString(16);
  const seededUuid = () =>
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c =>
      c === 'x' ? hex() : ((Math.floor(random() * 4) | 0x8).toString(16))
    ) as `${string}-${string}-${string}-${string}-${string}`;
  Object.defineProperty(globalThis.crypto, 'randomUUID', { value: seededUuid, configurable: true });

  // Frozen clock: `new Date()` and `Date.now()` always return FIXED_NOW.
  const RealDate = Date;
  class FrozenDate extends RealDate {
    constructor(...args: unknown[]) {
      if (args.length === 0) super(FIXED_NOW);
      else super(...(args as [string | number | Date]));
    }
    static now(): number {
      return FIXED_NOW;
    }
  }
  globalThis.Date = FrozenDate as DateConstructor;
}

function scrub(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(scrub);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      if (SECRET_KEY.test(key)) continue;
      out[key] = scrub(val);
    }
    return out;
  }
  return value;
}

type Middleware = (req: any, res: any, next: () => void) => Promise<void>;

async function getJson(middleware: Middleware, url: string, token?: string): Promise<any> {
  let status = 0;
  let body = '';
  const req = { url, method: 'GET', headers: token ? { authorization: `Bearer ${token}` } : {} };
  const res = {
    setHeader: () => {},
    end: (chunk: string) => {
      body = chunk;
    },
    set statusCode(val: number) {
      status = val;
    },
    get statusCode() {
      return status;
    },
  };
  await middleware(req, res, () => {});
  if (status !== 200) throw new Error(`GET ${url} returned ${status}: ${body}`);
  return JSON.parse(body);
}

function write(name: string, data: unknown): void {
  fs.writeFileSync(path.join(OUT_DIR, `${name}.json`), `${JSON.stringify(scrub(data), null, 2)}\n`);
  console.log(`  wrote fixtures/${name}.json`);
}

async function main(): Promise<void> {
  installDeterminism();

  // Imported after installDeterminism so module-level ids and timestamps are seeded too.
  const { setupTestDb } = await import('../src/db/testDb');
  const { setDb } = await import('../src/db');
  const { simulateSampleTournament, createApiMiddleware } = await import('../src/server/api');
  const { createSessionToken } = await import('../src/server/pinCrypto');

  setDb(setupTestDb().db);
  const tournament = await simulateSampleTournament();
  if (!tournament.isLocked || !tournament.tiers.some(t => t.bracket)) {
    throw new Error('Simulated tournament must be locked with a generated bracket.');
  }

  const middleware = createApiMiddleware() as Middleware;
  const token = createSessionToken({ role: 'SYSTEM_ADMIN' });

  fs.mkdirSync(OUT_DIR, { recursive: true });
  write('health', await getJson(middleware, '/api/health'));
  write('tournaments', await getJson(middleware, '/api/tournaments'));
  write('tournament', await getJson(middleware, `/api/tournaments/${tournament.slug}`));
  write('organizations', await getJson(middleware, '/api/organizations'));
  write('players', await getJson(middleware, '/api/players'));
  write('sessions', await getJson(middleware, `/api/tournaments/${tournament.id}/qualify/sessions`, token));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
