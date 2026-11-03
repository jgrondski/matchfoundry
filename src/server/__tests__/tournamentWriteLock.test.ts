import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Readable } from 'stream';
import { eq } from 'drizzle-orm';
import { setupTestDb } from '../../db/testDb';
import { setDb } from '../../db';
import { matches, players } from '../../db/schema';
import { createTournament, getFullTournament, saveFullTournament } from '../../api/tournaments';
import { createPlayer } from '../../api/players';
import { seedDefaultOrganizations } from '../../api/organizations';
import {
  adjudicateOnlineSubmission,
  setOnlineQualsOpen,
  startOnlineQualSession,
  submitOnlineQualScores,
} from '../../api/qualifiers';
import { generateDraftBracketsForTournament } from '../../features/qualifiers/scoring';
import { createEmptyTournament, createDefaultTier } from '../../features/tournament/defaults';
import { createApiMiddleware } from '../api';
import { createSessionToken } from '../pinCrypto';
import type { PlayerProfile, Tournament } from '../../features/tournament/types';

const LOCKED = 'This qual is verified. Unverify it before making changes.';

describe('Tournament write lock (pg-mem)', () => {
  let db: any;
  let middleware: any;

  beforeEach(() => {
    vi.stubEnv('DISCORD_WEBHOOK_OVERRIDE_URL', '');
    vi.stubEnv('VERCEL_ENV', '');
    const testDb = setupTestDb();
    db = testDb.db;
    setDb(db);
    middleware = createApiMiddleware();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const createCompetitors = async (count: number): Promise<PlayerProfile[]> => {
    const list: any[] = [];
    for (let i = 1; i <= count; i++) {
      list.push({
        id: crypto.randomUUID(),
        name: `WriteLock_${i}_${crypto.randomUUID().slice(0, 8)}`,
        country: 'US',
        personalBest: 950000 + i * 10000,
        playstyle: 'Rolling',
      });
    }
    await db.insert(players).values(list);
    return list.map(p => ({ ...p, avatarType: 'flag' as const, isDisqualified: false }));
  };

  /** Calls the real middleware; counts every res.end() so a test can prove exactly one response was written. */
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
    return { status: statusCode, endCount: bodies.length, body: last ? JSON.parse(last) : null };
  };

  /** 8 competitors, one Gold TRADITIONAL tier, manual seeds, locked. */
  const buildLockedTournament = async () => {
    const competitors = await createCompetitors(8);
    const { tournament } = await createTournament({
      name: 'Write Lock Test',
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

  const winSeriesBody = (tierId: string, winnerId: string) => ({
    tierId,
    games: [
      { gameNumber: 1, player1Points: 850000, player2Points: 720000, winnerPlayerId: winnerId },
      { gameNumber: 2, player1Points: 920000, player2Points: 800000, winnerPlayerId: winnerId },
    ],
  });

  it('starts at revision 0 and rises by one per write', async () => {
    const saved = await buildLockedTournament();
    const tier = saved.tiers[0];
    const [m1, m2] = tier.bracket!.rounds![0].matches;

    expect((await makeHttpRequest(`/api/tournaments/${saved.id}`, 'GET')).body.revision).toBe(0);

    const score = await makeHttpRequest(
      `/api/tournaments/${saved.id}/matches/${m1.id}/score`,
      'PUT',
      winSeriesBody(tier.id, m1.player1.player!.id)
    );
    expect(score.status).toBe(200);
    const bestOf = await makeHttpRequest(`/api/tournaments/${saved.id}/matches/${m2.id}/best-of`, 'PUT', {
      tierId: tier.id,
      bestOf: 5,
    });
    expect(bestOf.status).toBe(200);

    expect((await makeHttpRequest(`/api/tournaments/${saved.id}`, 'GET')).body.revision).toBe(2);
  });

  it('a stale settings save on a locked tournament keeps scores, brackets and the lock', async () => {
    const saved = await buildLockedTournament();
    const tier = saved.tiers[0];
    const m1 = tier.bracket!.rounds![0].matches[0];
    const p1 = m1.player1.player!.id;

    const stale = (await makeHttpRequest(`/api/tournaments/${saved.id}`, 'GET')).body as Tournament;
    // getFullTournament returns an empty record per relational match row; none has a result yet.
    expect(stale.matchScores?.[m1.id]?.winnerPlayerId ?? null).toBeNull();

    const score = await makeHttpRequest(
      `/api/tournaments/${saved.id}/matches/${m1.id}/score`,
      'PUT',
      winSeriesBody(tier.id, p1)
    );
    expect(score.status).toBe(200);

    const put = await makeHttpRequest(`/api/tournaments/${saved.id}`, 'PUT', {
      ...stale,
      name: 'Renamed',
      isLocked: false,
    });
    expect(put.status).toBe(200);

    const after = (await makeHttpRequest(`/api/tournaments/${saved.id}`, 'GET')).body as Tournament;
    expect(after.name).toBe('Renamed');
    expect(after.isLocked).toBe(true);
    expect(after.matchScores[m1.id]?.winnerPlayerId).toBe(p1);

    const afterTier = after.tiers.find(t => t.id === tier.id)!;
    expect(m1.nextMatchId).toBeDefined();
    const next = afterTier.bracket!.matchesById![m1.nextMatchId!];
    const slot = m1.nextMatchSlot === 2 ? next.player2 : next.player1;
    expect(slot.player?.id).toBe(p1);

    const [row] = await db.select().from(matches).where(eq(matches.id, m1.id));
    expect(row.winnerId).toBe(p1);
  });

  it('an unmatched tournament route returns one 404', async () => {
    const saved = await buildLockedTournament();
    const res = await makeHttpRequest(`/api/tournaments/${saved.id}/does-not-exist`, 'POST', {});
    expect(res.status).toBe(404);
    expect(res.endCount).toBe(1);
  });

  it('qualify/draft does not take the lock or bump the revision', async () => {
    const saved = await buildLockedTournament();
    const before = (await makeHttpRequest(`/api/tournaments/${saved.id}`, 'GET')).body.revision;
    const res = await makeHttpRequest(`/api/tournaments/${saved.id}/qualify/draft`, 'POST', {
      resumeToken: 'not-a-real-token',
      scores: [],
    });
    expect(res.status).toBe(403);
    expect(res.endCount).toBe(1);
    expect((await makeHttpRequest(`/api/tournaments/${saved.id}`, 'GET')).body.revision).toBe(before);
  });

  it('a QualLockedError thrown under the lock still returns one 409', async () => {
    await seedDefaultOrganizations();
    const t = createEmptyTournament({ slug: 'write-lock-qual', name: 'write-lock-qual' });
    t.id = crypto.randomUUID();
    t.organizationId = 'org_ctwc';
    t.qualMode = 'HYBRID';
    t.qualFormat = 'HIGH_SCORE';
    t.isLocked = false;
    t.tiers = [createDefaultTier(1, { id: crypto.randomUUID(), playerCount: 4 })];
    await saveFullTournament(t);
    await setOnlineQualsOpen(t.id, true);

    const playerId = (await createPlayer({ name: 'Write Lock Verified', country: 'US' })).id;
    const started = await startOnlineQualSession(t.id, { playerId, identityStatus: 'VERIFIED_MATCH' });
    await submitOnlineQualScores(t.id, {
      playerId,
      scores: [950000],
      twitchVodUrl: 'https://twitch.tv/videos/7',
      resumeToken: started.resumeToken,
    });
    await adjudicateOnlineSubmission(t.id, { playerId, action: 'VERIFY', verifiedBy: 'Judy' });

    const res = await makeHttpRequest(`/api/tournaments/${t.id}/qualifiers`, 'POST', { playerId, score: 1 });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe(LOCKED);
    expect(res.endCount).toBe(1);
  });
});
