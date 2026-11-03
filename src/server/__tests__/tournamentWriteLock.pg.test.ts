import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Readable } from 'stream';
import { like } from 'drizzle-orm';
import type pg from 'pg';
import { setDb } from '../../db';
import { players } from '../../db/schema';
import { RUN_PG_TESTS, connectLocalPostgres } from '../../db/__tests__/pgTestDb';
import { createTournament, deleteTournament, getFullTournament, saveFullTournament } from '../../api/tournaments';
import { generateDraftBracketsForTournament } from '../../features/qualifiers/scoring';
import { createApiMiddleware } from '../api';
import { createSessionToken } from '../pinCrypto';
import type { PlayerProfile, Tournament } from '../../features/tournament/types';

const PLAYER_PREFIX = 'PGT_';
const SLUG_PREFIX = 'pgt-';

describe.skipIf(!RUN_PG_TESTS)('Tournament write lock on real PostgreSQL', () => {
  let db: any;
  let pool: pg.Pool;
  let middleware: any;
  const createdTournamentIds: string[] = [];

  beforeAll(() => {
    const conn = connectLocalPostgres();
    db = conn.db;
    pool = conn.pool;
    setDb(db);
    middleware = createApiMiddleware();
  });

  afterAll(async () => {
    for (const id of createdTournamentIds) await deleteTournament(id);
    await db.delete(players).where(like(players.name, `${PLAYER_PREFIX}%`));
    setDb(null);
    await pool.end();
  });

  const makeHttpRequest = async (url: string, method: string, body?: any) => {
    const bodyStr = body !== undefined ? JSON.stringify(body) : '';
    const req = Readable.from(bodyStr ? [bodyStr] : []) as any;
    req.url = url;
    req.method = method;
    req.headers = { authorization: `Bearer ${createSessionToken({ role: 'SYSTEM_ADMIN' })}` };
    let statusCode = 200;
    let responseBody = '';
    const res: any = {
      setHeader: () => {},
      getHeader: () => undefined,
      writeHead(code: number) {
        statusCode = code;
        return this;
      },
      end: (data?: string) => {
        responseBody = data ?? '';
      },
      set statusCode(val: number) {
        statusCode = val;
      },
      get statusCode() {
        return statusCode;
      },
    };
    await middleware(req, res, () => {});
    return { status: statusCode, body: responseBody ? JSON.parse(responseBody) : null };
  };

  /** 8 PGT_ competitors, one Gold TRADITIONAL tier, manual seeds, locked. */
  const buildLockedTournament = async (): Promise<Tournament> => {
    const run = crypto.randomUUID().slice(0, 8);
    const list = Array.from({ length: 8 }, (_, i) => ({
      id: crypto.randomUUID(),
      name: `${PLAYER_PREFIX}${i + 1}_${run}`,
      country: 'US',
      personalBest: 950000 + (i + 1) * 10000,
      playstyle: 'Rolling',
    }));
    await db.insert(players).values(list);
    const competitors: PlayerProfile[] = list.map(p => ({
      ...p,
      playstyle: 'Rolling' as const,
      avatarType: 'flag' as const,
      isDisqualified: false,
    }));

    const { tournament } = await createTournament({
      name: `PGT Write Lock ${run}`,
      slug: `${SLUG_PREFIX}write-lock-${run}`,
      qualFormat: 'HIGH_SCORE',
      tiers: [{ name: 'Gold', bracketType: 'TRADITIONAL', numPlayers: 8, priorityOrder: 1, eliminationType: 'SINGLE' }],
    });
    createdTournamentIds.push(tournament.id);
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

  /** Fires full Best-of-3 wins for round-1 matches 1 and 2 (each for its player 1) at the same time. */
  const scoreTwoMatchesConcurrently = async (saved: Tournament) => {
    const tier = saved.tiers[0];
    const [m1, m2] = tier.bracket!.rounds![0].matches;
    const w1 = m1.player1.player!.id;
    const w2 = m2.player1.player!.id;
    const [r1, r2] = await Promise.all([
      makeHttpRequest(`/api/tournaments/${saved.id}/matches/${m1.id}/score`, 'PUT', winSeriesBody(tier.id, w1)),
      makeHttpRequest(`/api/tournaments/${saved.id}/matches/${m2.id}/score`, 'PUT', winSeriesBody(tier.id, w2)),
    ]);
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    return { tier, scored: [[m1, w1], [m2, w2]] as const };
  };

  it('concurrent score writes to different matches both survive', async () => {
    const saved = await buildLockedTournament();
    const { tier, scored } = await scoreTwoMatchesConcurrently(saved);

    const after = (await makeHttpRequest(`/api/tournaments/${saved.id}`, 'GET')).body as Tournament;
    const bracket = after.tiers.find(t => t.id === tier.id)!.bracket!;
    for (const [m, w] of scored) {
      expect(after.matchScores[m.id]?.winnerPlayerId).toBe(w);
      const next = bracket.matchesById![m.nextMatchId!];
      const slot = m.nextMatchSlot === 2 ? next.player2 : next.player1;
      expect(slot.player?.id).toBe(w);
    }
  });

  it('concurrent writes raise the revision by exactly 2', async () => {
    const saved = await buildLockedTournament();
    const before = (await makeHttpRequest(`/api/tournaments/${saved.id}`, 'GET')).body.revision as number;
    await scoreTwoMatchesConcurrently(saved);
    const after = (await makeHttpRequest(`/api/tournaments/${saved.id}`, 'GET')).body.revision as number;
    expect(after).toBe(before + 2);
  });
});
