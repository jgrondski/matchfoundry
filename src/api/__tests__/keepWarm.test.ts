import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Readable } from 'stream';
import { drizzle } from 'drizzle-orm/node-postgres';
import { setupTestDb } from '../../db/testDb';
import { setDb } from '../../db';
import * as schema from '../../db/schema';
import { addDays, buildKeepWarmWindows, getKeepWarmWindows } from '../keepWarm';
import { saveFullTournament } from '../tournaments';
import { createEmptyTournament } from '../../features/tournament/defaults';
import { createApiMiddleware } from '../../server/api';
import type { Tournament } from '../../features/tournament/types';

describe('addDays', () => {
  it('shifts dates across day, year and leap-day boundaries', () => {
    expect(addDays('2026-11-14', -1)).toBe('2026-11-13');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29');
  });
});

describe('buildKeepWarmWindows', () => {
  const today = '2026-11-03';
  const event = (startDate: string | null, endDate: string | null = null, isTest = false) => ({ startDate, endDate, isTest });

  it('pads a multi-day event by one day on each side', () => {
    expect(buildKeepWarmWindows([event('2026-11-14', '2026-11-16')], today)).toEqual([
      { from: '2026-11-13', until: '2026-11-17' },
    ]);
  });

  it('uses the start date for both ends of a single-day event', () => {
    expect(buildKeepWarmWindows([event('2026-11-14')], today)).toEqual([{ from: '2026-11-13', until: '2026-11-15' }]);
  });

  it('leaves out test events and events without a start date', () => {
    expect(buildKeepWarmWindows([event('2026-11-14', '2026-11-16', true), event(null)], today)).toEqual([]);
  });

  it('leaves out a window that ended before today and keeps one that ends today', () => {
    expect(buildKeepWarmWindows([event('2026-10-30', '2026-11-01')], today)).toEqual([]);
    expect(buildKeepWarmWindows([event('2026-10-31', '2026-11-02')], today)).toEqual([
      { from: '2026-10-30', until: '2026-11-03' },
    ]);
  });

  it('sorts windows by from', () => {
    expect(
      buildKeepWarmWindows([event('2026-12-05'), event('2026-11-14', '2026-11-16'), event('2026-11-20')], today).map(
        w => w.from
      )
    ).toEqual(['2026-11-13', '2026-11-19', '2026-12-04']);
  });
});

describe('Keep-warm schedule (pg-mem)', () => {
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

  async function saveTournament(fields: Partial<Tournament>) {
    const runId = crypto.randomUUID().slice(0, 8);
    return saveFullTournament(
      createEmptyTournament({
        name: `Keep Warm ${runId}`,
        slug: `keep-warm-${runId}`,
        qualFormat: 'HIGH_SCORE',
        ...fields,
      } as Partial<Tournament>)
    );
  }

  /** Calls the real middleware with no session, recording response headers. */
  const makeHttpRequest = async (url: string, method: string, body?: any) => {
    const bodyStr = body !== undefined ? JSON.stringify(body) : '';
    const req = Readable.from(bodyStr ? [bodyStr] : []) as any;
    req.url = url;
    req.method = method;
    req.headers = {};
    let statusCode = 200;
    const bodies: string[] = [];
    const headers: Record<string, string> = {};
    const res: any = {
      setHeader: (name: string, value: string) => {
        headers[name.toLowerCase()] = String(value);
      },
      getHeader: (name: string) => headers[name.toLowerCase()],
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
    return { status: statusCode, headers, body: last ? JSON.parse(last) : null };
  };

  it('returns one padded window for the upcoming non-test event', async () => {
    await saveTournament({ startDate: '2026-11-14', endDate: '2026-11-16' });
    await saveTournament({ startDate: '2026-11-20', endDate: '2026-11-21', isTest: true });
    await saveTournament({});

    expect(await getKeepWarmWindows(new Date('2026-11-03T12:00:00Z'))).toEqual([
      { from: '2026-11-13', until: '2026-11-17' },
    ]);
  });

  it('serves the schedule publicly with Cache-Control: no-store', async () => {
    const res = await makeHttpRequest('/api/keep-warm-schedule', 'GET');

    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(Array.isArray(res.body?.windows)).toBe(true);
  });
});
