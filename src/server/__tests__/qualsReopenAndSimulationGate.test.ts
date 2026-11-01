import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Readable } from 'stream';
import { eq } from 'drizzle-orm';
import { setupTestDb } from '../../db/testDb';
import { setDb } from '../../db';
import { simulateSampleTournament, createApiMiddleware } from '../api';
import { createSessionToken } from '../pinCrypto';
import { getFullTournament } from '../../api/tournaments';
import { tournaments } from '../../db/schema';
import { isOnlineQualsOpen } from '../../features/online-quals/onlineQualsStatus';
import { isSimulationAllowed } from '../../utils/simulationEnv';

function createMockReq(options: { url: string; method?: string; body?: any }) {
  const bodyStr = options.body !== undefined ? JSON.stringify(options.body) : '';
  const req = Readable.from(bodyStr ? [bodyStr] : []) as any;
  req.url = options.url;
  req.method = options.method || 'GET';
  req.headers = {
    authorization: `Bearer ${createSessionToken({ role: 'MASTER_ADMIN' })}`,
  };
  return req;
}

function createMockRes() {
  let statusCode = 200;
  let body = '';
  return {
    setHeader() {},
    getHeader() {
      return undefined;
    },
    writeHead(code: number) {
      statusCode = code;
      return this;
    },
    set statusCode(code: number) {
      statusCode = code;
    },
    get statusCode() {
      return statusCode;
    },
    end(chunk?: string) {
      if (chunk) body += chunk;
    },
    getBody() {
      return body ? JSON.parse(body) : null;
    },
  };
}

async function call(url: string, method: string, body?: any) {
  const res = createMockRes();
  await createApiMiddleware()(createMockReq({ url, method, body }), res as any, () => {});
  return { status: res.statusCode, body: res.getBody() };
}

describe('Returning to qual mode re-enables online qualifying', () => {
  let testDb: any;

  beforeEach(() => {
    const { db } = setupTestDb();
    testDb = db;
    setDb(db);
  });

  async function expectQualModeReopenable(tournamentId: string) {
    const reloaded = await getFullTournament(tournamentId);
    expect(reloaded!.isLocked).toBe(false);
    expect(reloaded!.qualsClosed).toBe(false);
    expect(reloaded!.tiers.every(t => !t.isLocked)).toBe(true);

    const [row] = await testDb.select().from(tournaments).where(eq(tournaments.id, tournamentId));
    expect(row.qualsClosed).toBe(false);

    const opened = await call(`/api/tournaments/${tournamentId}/online-quals`, 'POST', { open: true });
    expect(opened.status).toBe(200);
    expect(isOnlineQualsOpen(opened.body)).toBe(true);
  }

  it('clearing match scores unlocks brackets and reopens quals', async () => {
    const sample = await simulateSampleTournament();
    expect(sample.isLocked).toBe(true);

    const cleared = await call(`/api/tournaments/${sample.id}/matches`, 'DELETE');
    expect(cleared.status).toBe(200);

    await expectQualModeReopenable(sample.id);
  });

  it('clearing matches then quals leaves quals reopenable', async () => {
    const sample = await simulateSampleTournament();
    await call(`/api/tournaments/${sample.id}/matches`, 'DELETE');
    const clearedQuals = await call(`/api/tournaments/${sample.id}/qualifiers`, 'DELETE');
    expect(clearedQuals.status).toBe(200);

    await expectQualModeReopenable(sample.id);
  });

  it('clear-all leaves quals reopenable', async () => {
    const sample = await simulateSampleTournament();
    const cleared = await call(`/api/tournaments/${sample.id}/clear-all`, 'POST');
    expect(cleared.status).toBe(200);

    await expectQualModeReopenable(sample.id);
  });

  it('a stale quals_closed row on an unlocked tournament is treated as open', async () => {
    const sample = await simulateSampleTournament();
    await call(`/api/tournaments/${sample.id}/matches`, 'DELETE');
    // Simulate a row latched by the old save logic before this fix.
    await testDb.update(tournaments).set({ qualsClosed: true }).where(eq(tournaments.id, sample.id));

    const reloaded = await getFullTournament(sample.id);
    expect(reloaded!.qualsClosed).toBe(false);
    expect(reloaded!.tiers.every(t => !t.isLocked)).toBe(true);
  });
});

describe('Simulation is disabled on Production', () => {
  const originalVercelEnv = process.env.VERCEL_ENV;

  afterEach(() => {
    if (originalVercelEnv === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = originalVercelEnv;
  });

  beforeEach(() => {
    const { db } = setupTestDb();
    setDb(db);
  });

  it('allows simulation locally and on preview deploys only', () => {
    expect(isSimulationAllowed({})).toBe(true);
    expect(isSimulationAllowed({ VERCEL_ENV: 'preview' })).toBe(true);
    expect(isSimulationAllowed({ VERCEL_ENV: 'development' })).toBe(true);
    expect(isSimulationAllowed({ VERCEL_ENV: 'production' })).toBe(false);
  });

  it('rejects every simulation endpoint with 403 on production', async () => {
    const sample = await simulateSampleTournament();
    process.env.VERCEL_ENV = 'production';

    for (const [url, method] of [
      ['/api/simulate/sample', 'POST'],
      [`/api/tournaments/${sample.id}/simulate/seed-quals`, 'POST'],
      [`/api/tournaments/${sample.id}/simulate/full`, 'POST'],
    ] as const) {
      const result = await call(url, method);
      expect(result.status, url).toBe(403);
      expect(result.body.error).toContain('disabled in production');
    }
  });

  it('still serves simulation endpoints on preview deploys', async () => {
    process.env.VERCEL_ENV = 'preview';
    const result = await call('/api/simulate/sample', 'POST');
    expect(result.status).toBe(201);
  });
});
