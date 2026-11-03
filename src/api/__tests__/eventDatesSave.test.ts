import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Readable } from 'stream';
import { drizzle } from 'drizzle-orm/node-postgres';
import { setupTestDb } from '../../db/testDb';
import { setDb } from '../../db';
import * as schema from '../../db/schema';
import {
  EventDateError,
  getFullTournament,
  listTournamentSummaries,
  saveFullTournament,
} from '../tournaments';
import { createEmptyTournament } from '../../features/tournament/defaults';
import { createApiMiddleware } from '../../server/api';
import { createSessionToken } from '../../server/pinCrypto';
import type { Tournament } from '../../features/tournament/types';

describe('Event dates on tournament save (pg-mem)', () => {
  let middleware: any;

  beforeEach(() => {
    vi.stubEnv('DISCORD_WEBHOOK_OVERRIDE_URL', '');
    vi.stubEnv('VERCEL_ENV', '');
    const { pool } = setupTestDb();
    setDb(drizzle(pool as any, { schema }));
    middleware = createApiMiddleware();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  async function buildTournament(dates: Partial<Tournament> = {}): Promise<Tournament> {
    const runId = crypto.randomUUID().slice(0, 8);
    const saved = await saveFullTournament(
      createEmptyTournament({
        name: `Dates ${runId}`,
        slug: `dates-${runId}`,
        qualFormat: 'HIGH_SCORE',
        ...dates,
      } as Partial<Tournament>)
    );
    const loaded = await getFullTournament(saved.id);
    if (!loaded) throw new Error('tournament not found');
    return loaded;
  }

  async function reload(id: string): Promise<Tournament> {
    const loaded = await getFullTournament(id);
    if (!loaded) throw new Error('tournament not found');
    return loaded;
  }

  /** Calls the real middleware as a SYSTEM_ADMIN. */
  const makeHttpRequest = async (url: string, method: string, body?: any) => {
    const bodyStr = body !== undefined ? JSON.stringify(body) : '';
    const req = Readable.from(bodyStr ? [bodyStr] : []) as any;
    req.url = url;
    req.method = method;
    req.headers = { authorization: `Bearer ${createSessionToken({ role: 'SYSTEM_ADMIN' })}` };
    let statusCode = 200;
    const bodies: string[] = [];
    const res: any = {
      setHeader: () => {},
      getHeader: () => undefined,
      writeHead(code: number) {
        statusCode = code;
        return this;
      },
      end: (data?: string) => {
        bodies.push(data ?? '');
      },
      set statusCode(val: number) {
        statusCode = val;
      },
      get statusCode() {
        return statusCode;
      },
    };
    await middleware(req, res, () => {});
    const last = bodies[bodies.length - 1];
    return { status: statusCode, body: last ? JSON.parse(last) : null };
  };

  it('stores a start and end date and returns them from the full load and the summary list', async () => {
    const t = await buildTournament({ startDate: '2026-11-14', endDate: '2026-11-16' });
    expect(t.startDate).toBe('2026-11-14');
    expect(t.endDate).toBe('2026-11-16');

    const summary = (await listTournamentSummaries()).find(s => s.id === t.id);
    expect(summary?.startDate).toBe('2026-11-14');
    expect(summary?.endDate).toBe('2026-11-16');
  });

  it('keeps the stored dates when a save omits them', async () => {
    const t = await buildTournament({ startDate: '2026-11-14', endDate: '2026-11-16' });
    await saveFullTournament({ ...t, startDate: undefined, endDate: undefined });

    const after = await reload(t.id);
    expect(after.startDate).toBe('2026-11-14');
    expect(after.endDate).toBe('2026-11-16');
  });

  it('clears both dates when sent empty strings', async () => {
    const t = await buildTournament({ startDate: '2026-11-14', endDate: '2026-11-16' });
    await saveFullTournament({ ...t, startDate: '', endDate: '' });

    const after = await reload(t.id);
    expect(after.startDate).toBe('');
    expect(after.endDate).toBe('');
  });

  it('stores no end date when it equals the start date', async () => {
    const t = await buildTournament({ startDate: '2026-11-14', endDate: '2026-11-14' });
    expect(t.startDate).toBe('2026-11-14');
    expect(t.endDate).toBe('');
  });

  it('rejects an invalid date or range and leaves the stored tournament unchanged', async () => {
    const t = await buildTournament({ startDate: '2026-11-14', endDate: '2026-11-16' });

    await expect(
      saveFullTournament({ ...t, name: 'Changed Name', startDate: 'March 21' })
    ).rejects.toBeInstanceOf(EventDateError);
    await expect(
      saveFullTournament({ ...t, name: 'Changed Name', startDate: '2026-11-16', endDate: '2026-11-14' })
    ).rejects.toBeInstanceOf(EventDateError);

    const after = await reload(t.id);
    expect(after.name).toBe(t.name);
    expect(after.startDate).toBe('2026-11-14');
    expect(after.endDate).toBe('2026-11-16');
  });

  it('answers 400 with the validation message through the API', async () => {
    const t = await buildTournament();
    const res = await makeHttpRequest(`/api/tournaments/${t.id}`, 'PUT', { ...t, startDate: 'Upcoming' });

    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toContain('Start date must be a real date');
  });
});
