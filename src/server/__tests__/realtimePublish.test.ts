import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Readable } from 'stream';
import { setupTestDb } from '../../db/testDb';
import { setDb } from '../../db';
import { players } from '../../db/schema';
import { createTournament, getFullTournament, saveFullTournament } from '../../api/tournaments';
import { generateDraftBracketsForTournament } from '../../features/qualifiers/scoring';
import { createApiMiddleware } from '../api';
import { createSessionToken } from '../pinCrypto';
import { publishTournamentChanged } from '../realtime';
import type { PlayerProfile } from '../../features/tournament/types';

vi.mock('../realtime', () => ({ publishTournamentChanged: vi.fn() }));

const publishMock = vi.mocked(publishTournamentChanged);

describe('Realtime publish and response headers (pg-mem)', () => {
  let db: any;
  let middleware: any;

  beforeEach(() => {
    vi.stubEnv('DISCORD_WEBHOOK_OVERRIDE_URL', '');
    vi.stubEnv('VERCEL_ENV', '');
    const testDb = setupTestDb();
    db = testDb.db;
    setDb(db);
    middleware = createApiMiddleware();
    publishMock.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const createCompetitors = async (count: number): Promise<PlayerProfile[]> => {
    const list: any[] = [];
    for (let i = 1; i <= count; i++) {
      list.push({
        id: crypto.randomUUID(),
        name: `Realtime_${i}_${crypto.randomUUID().slice(0, 8)}`,
        country: 'US',
        personalBest: 950000 + i * 10000,
        playstyle: 'Rolling',
      });
    }
    await db.insert(players).values(list);
    return list.map(p => ({ ...p, avatarType: 'flag' as const, isDisqualified: false }));
  };

  const makeHttpRequest = async (url: string, method: string, body?: any, opts: { authed?: boolean } = {}) => {
    const authed = opts.authed ?? true;
    const bodyStr = body !== undefined ? JSON.stringify(body) : '';
    const req = Readable.from(bodyStr ? [bodyStr] : []) as any;
    req.url = url;
    req.method = method;
    req.headers = authed ? { authorization: `Bearer ${createSessionToken({ role: 'SYSTEM_ADMIN' })}` } : {};
    let statusCode = 200;
    const headers: Record<string, string> = {};
    const bodies: string[] = [];
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

  const buildLockedTournament = async () => {
    const competitors = await createCompetitors(8);
    const { tournament } = await createTournament({
      name: 'Realtime Publish Test',
      organizationId: 'org_ctwc',
      qualFormat: 'HIGH_SCORE',
      tiers: [{ name: 'Gold', bracketType: 'TRADITIONAL', numPlayers: 8, priorityOrder: 1, eliminationType: 'SINGLE' }],
    });
    const full = await getFullTournament(tournament.id);
    if (!full) throw new Error('Not found');
    full.playersPool = competitors;
    full.manualSeeds = competitors.map(c => c.id);
    full.seedingMethod = 'MANUAL';
    full.tiers = generateDraftBracketsForTournament(full);
    full.isLocked = true;
    full.tiers[0].isLocked = true;
    return saveFullTournament(full);
  };

  const winSeriesBody = (tierId: string, winnerId: string, extra: Record<string, unknown> = {}) => ({
    tierId,
    games: [
      { gameNumber: 1, player1Points: 850000, player2Points: 720000, winnerPlayerId: winnerId },
      { gameNumber: 2, player1Points: 920000, player2Points: 800000, winnerPlayerId: winnerId },
    ],
    ...extra,
  });

  it('a successful score PUT publishes once with the tournament UUID and new revision', async () => {
    const saved = await buildLockedTournament();
    const tier = saved.tiers[0];
    const m1 = tier.bracket!.rounds![0].matches[0];
    const before = (await makeHttpRequest(`/api/tournaments/${saved.id}`, 'GET')).body.revision;

    const score = await makeHttpRequest(
      `/api/tournaments/${saved.slug}/matches/${m1.id}/score`,
      'PUT',
      winSeriesBody(tier.id, m1.player1.player!.id)
    );
    expect(score.status).toBe(200);
    expect(publishMock).toHaveBeenCalledTimes(1);
    expect(publishMock).toHaveBeenCalledWith(saved.id, before + 1);
  });

  it('a 409 score PUT and a 401 write do not publish', async () => {
    const saved = await buildLockedTournament();
    const tier = saved.tiers[0];
    const m1 = tier.bracket!.rounds![0].matches[0];

    const conflict = await makeHttpRequest(
      `/api/tournaments/${saved.id}/matches/${m1.id}/score`,
      'PUT',
      winSeriesBody(tier.id, m1.player1.player!.id, { expectedRevision: 99 })
    );
    expect(conflict.status).toBe(409);

    const unauthorized = await makeHttpRequest(
      `/api/tournaments/${saved.id}/matches/${m1.id}/score`,
      'PUT',
      winSeriesBody(tier.id, m1.player1.player!.id),
      { authed: false }
    );
    expect(unauthorized.status).toBe(401);

    expect(publishMock).not.toHaveBeenCalled();
  });

  it('qualify/draft and GET do not publish', async () => {
    const saved = await buildLockedTournament();
    await makeHttpRequest(`/api/tournaments/${saved.id}/qualify/draft`, 'POST', {
      resumeToken: 'not-a-real-token',
      scores: [],
    });
    await makeHttpRequest(`/api/tournaments/${saved.id}`, 'GET');
    expect(publishMock).not.toHaveBeenCalled();
  });

  it('root GET is CDN-cacheable only for anonymous versioned requests', async () => {
    const saved = await buildLockedTournament();

    const anonVersioned = await makeHttpRequest(`/api/tournaments/${saved.id}?v=3`, 'GET', undefined, { authed: false });
    expect(anonVersioned.status).toBe(200);
    expect(anonVersioned.headers['cache-control']).toBe('public, max-age=0, s-maxage=300');

    const anonPlain = await makeHttpRequest(`/api/tournaments/${saved.id}`, 'GET', undefined, { authed: false });
    expect(anonPlain.headers['cache-control']).toBe('no-store');

    const authedVersioned = await makeHttpRequest(`/api/tournaments/${saved.id}?v=3`, 'GET');
    expect(authedVersioned.headers['cache-control']).toBe('no-store');
  });

  it('every JSON response sets a numeric X-Server-Time', async () => {
    const saved = await buildLockedTournament();
    const ok = await makeHttpRequest(`/api/tournaments/${saved.id}`, 'GET');
    const missing = await makeHttpRequest(`/api/tournaments/${saved.id}/does-not-exist`, 'POST', {});
    for (const r of [ok, missing]) {
      const value = Number(r.headers['x-server-time']);
      expect(Number.isFinite(value)).toBe(true);
      expect(value).toBeGreaterThan(0);
    }
  });
});

describe('publishTournamentChanged without configuration', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('returns without calling fetch when REALTIME_URL is unset', async () => {
    const actual = await vi.importActual<typeof import('../realtime')>('../realtime');
    vi.stubEnv('REALTIME_URL', '');
    vi.stubEnv('REALTIME_PUBLISH_SECRET', 'secret');
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    actual.publishTournamentChanged('t1', 1);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
