import { describe, it, expect, beforeEach } from 'vitest';
import { Readable } from 'stream';
import { eq } from 'drizzle-orm';
import { setupTestDb } from '../../db/testDb';
import { setDb } from '../../db';
import { games, matches, players, tournaments } from '../../db/schema';
import { createTournament, getFullTournament, saveFullTournament } from '../tournaments';
import { generateDraftBracketsForTournament } from '../../features/qualifiers/scoring';
import { createApiMiddleware } from '../../server/api';
import { createSessionToken } from '../../server/pinCrypto';
import { MATCH_CONFLICT_MESSAGE } from '../../features/bracket/matchConflict';
import type { BracketMatch } from '../../features/bracket/types';
import type { PlayerProfile, Tournament } from '../../features/tournament/types';

type TierConfig = Parameters<typeof createTournament>[0]['tiers'] extends Array<infer T> | undefined ? T : never;

const FORMATS: Array<{ label: string; double: boolean; tier: TierConfig }> = [
  {
    label: 'Single Elimination: Traditional',
    double: false,
    tier: { name: 'Gold', bracketType: 'TRADITIONAL', numPlayers: 8, priorityOrder: 1, eliminationType: 'SINGLE' },
  },
  {
    label: 'Double Elimination: Traditional',
    double: true,
    tier: {
      name: 'Gold Double',
      bracketType: 'TRADITIONAL',
      numPlayers: 8,
      priorityOrder: 1,
      eliminationType: 'DOUBLE',
      bracketRouting: 'TRADITIONAL',
    },
  },
  {
    label: 'Double Elimination: Flat Staged',
    double: true,
    tier: {
      name: 'Flat Staged Tier',
      bracketType: 'FLAT',
      flatWidth: 4,
      numPlayers: 16,
      priorityOrder: 1,
      eliminationType: 'DOUBLE',
      bracketRouting: 'FLAT_STAGED',
    },
  },
  {
    label: 'Double Elimination: Accelerated Hybrid',
    double: true,
    tier: {
      name: 'Accelerated Tier',
      bracketType: 'TRADITIONAL',
      numPlayers: 16,
      priorityOrder: 1,
      eliminationType: 'DOUBLE',
      bracketRouting: 'ACCELERATED_HYBRID',
    },
  },
];

describe('Targeted match writes', () => {
  let db: any;
  let middleware: any;

  beforeEach(() => {
    const testDb = setupTestDb();
    db = testDb.db;
    setDb(db);
    middleware = createApiMiddleware();
  });

  const createCompetitors = async (count: number): Promise<PlayerProfile[]> => {
    const list: any[] = [];
    for (let i = 1; i <= count; i++) {
      list.push({
        id: crypto.randomUUID(),
        name: `Targeted_${i}_${crypto.randomUUID().slice(0, 8)}`,
        country: 'US',
        personalBest: 950000 + i * 10000,
        playstyle: 'Rolling',
      });
    }
    await db.insert(players).values(list);
    return list.map(p => ({ ...p, avatarType: 'flag' as const, isDisqualified: false }));
  };

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

  /** The relationalIntegrity section 4 fixture: manual seeds, locked, saved with saveFullTournament. */
  const buildLockedTournament = async (tier: TierConfig): Promise<Tournament> => {
    const competitors = await createCompetitors(tier.numPlayers!);
    const { tournament } = await createTournament({
      name: `Targeted ${tier.name}`,
      organizationId: 'org_ctwc',
      qualFormat: 'HIGH_SCORE',
      tiers: [tier],
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

  /** The first two round-1 matches with both players seated. */
  const firstTwoPlayableMatches = (t: Tournament): [BracketMatch, BracketMatch] => {
    const playable = t.tiers[0].bracket!.rounds![0].matches.filter(m => m.player1.player && m.player2.player);
    expect(playable.length).toBeGreaterThanOrEqual(2);
    return [playable[0], playable[1]];
  };

  const scoreBody = (tierId: string, m: BracketMatch, winners: string[], base = 800000, extra: Record<string, unknown> = {}) => ({
    tierId,
    games: winners.map((w, i) => ({
      gameNumber: i + 1,
      player1Points: w === m.player1.player!.id ? base + 50000 : base,
      player2Points: w === m.player1.player!.id ? base : base + 50000,
      winnerPlayerId: w,
    })),
    ...extra,
  });

  const score = (t: Tournament, m: BracketMatch, winners: string[], base?: number, extra?: Record<string, unknown>) =>
    makeHttpRequest(`/api/tournaments/${t.id}/matches/${m.id}/score`, 'PUT', scoreBody(t.tiers[0].id, m, winners, base, extra));

  const getTournament = async (t: Tournament): Promise<Tournament> =>
    (await makeHttpRequest(`/api/tournaments/${t.id}`, 'GET')).body as Tournament;

  const rowsForTier = (tierId: string) => db.select().from(matches).where(eq(matches.tierId, tierId));
  const rowById = async (id: string) => (await db.select().from(matches).where(eq(matches.id, id)))[0];
  const slotOf = (m: BracketMatch | undefined, slot: 1 | 2 | undefined) => (slot === 2 ? m?.player2 : m?.player1);

  for (const format of FORMATS) {
    describe(format.label, () => {
      it('scoring one match neither deletes nor re-inserts the other match rows', async () => {
        const t = await buildLockedTournament(format.tier);
        const [m1] = firstTwoPlayableMatches(t);
        const before = await rowsForTier(t.tiers[0].id);
        const createdBefore = new Map(before.map((r: any) => [r.id, new Date(r.createdAt).getTime()]));
        expect(before.length).toBeGreaterThan(0);

        const p1 = m1.player1.player!.id;
        expect((await score(t, m1, [p1, p1])).status).toBe(200);

        const after = await rowsForTier(t.tiers[0].id);
        expect(after.length).toBe(before.length);
        for (const r of after) {
          expect(createdBefore.has(r.id)).toBe(true);
          expect(new Date(r.createdAt).getTime()).toBe(createdBefore.get(r.id));
        }
      });

      it('persists advancement to the routed slots, in GET and in the matches rows', async () => {
        const t = await buildLockedTournament(format.tier);
        const [m1] = firstTwoPlayableMatches(t);
        const p1 = m1.player1.player!.id;
        const p2 = m1.player2.player!.id;
        expect(m1.nextMatchId).toBeDefined();

        expect((await score(t, m1, [p1, p1])).status).toBe(200);
        const after = await getTournament(t);
        const bracket = after.tiers[0].bracket!;

        expect(slotOf(bracket.matchesById[m1.nextMatchId!], m1.nextMatchSlot)?.player?.id).toBe(p1);
        const nextRow = await rowById(m1.nextMatchId!);
        expect(m1.nextMatchSlot === 2 ? nextRow.player2Id : nextRow.player1Id).toBe(p1);

        if (format.double) {
          expect(m1.loserNextMatchId).toBeDefined();
          expect(slotOf(bracket.matchesById[m1.loserNextMatchId!], m1.loserNextMatchSlot)?.player?.id).toBe(p2);
          const loserRow = await rowById(m1.loserNextMatchId!);
          expect(m1.loserNextMatchSlot === 2 ? loserRow.player2Id : loserRow.player1Id).toBe(p2);
        }
      });

      it('re-scoring one match leaves another match\'s games rows untouched', async () => {
        const t = await buildLockedTournament(format.tier);
        const [m1, m2] = firstTwoPlayableMatches(t);
        const a = m1.player1.player!.id;
        const b = m2.player1.player!.id;

        expect((await score(t, m1, [a, a])).status).toBe(200);
        expect((await score(t, m2, [b, b])).status).toBe(200);
        const m2GamesBefore = await db.select().from(games).where(eq(games.matchId, m2.id));
        expect(m2GamesBefore.length).toBe(2);

        expect((await score(t, m1, [a, a], 600000)).status).toBe(200);
        const m2GamesAfter = await db.select().from(games).where(eq(games.matchId, m2.id));
        expect(m2GamesAfter.map((g: any) => g.id).sort()).toEqual(m2GamesBefore.map((g: any) => g.id).sort());
        expect(m2GamesAfter).toEqual(expect.arrayContaining(m2GamesBefore));

        const m1Games = await db.select().from(games).where(eq(games.matchId, m1.id));
        expect(m1Games.every((g: any) => g.player1Score === 650000 || g.player2Score === 650000)).toBe(true);
      });

      it('re-scoring so nobody has won yet clears the winner from the next match slot', async () => {
        const t = await buildLockedTournament(format.tier);
        const [m1] = firstTwoPlayableMatches(t);
        const p1 = m1.player1.player!.id;

        expect((await score(t, m1, [p1, p1])).status).toBe(200);
        expect((await score(t, m1, [p1])).status).toBe(200);

        const after = await getTournament(t);
        expect(after.matchScores[m1.id]?.winnerPlayerId ?? null).toBeNull();
        const nextSlot = slotOf(after.tiers[0].bracket!.matchesById[m1.nextMatchId!], m1.nextMatchSlot);
        expect(nextSlot?.player?.id ?? null).not.toBe(p1);
        const nextRow = await rowById(m1.nextMatchId!);
        expect(m1.nextMatchSlot === 2 ? nextRow.player2Id : nextRow.player1Id).not.toBe(p1);
      });
    });
  }

  describe('match revision (Single Elimination)', () => {
    const se = FORMATS[0].tier;

    it('returns 409 MATCH_CONFLICT for a stale expectedRevision and changes nothing', async () => {
      const t = await buildLockedTournament(se);
      const [m1] = firstTwoPlayableMatches(t);
      const p1 = m1.player1.player!.id;

      const first = await score(t, m1, [p1]);
      expect(first.status).toBe(200);
      expect(first.body.matchScores[m1.id].revision).toBe(1);
      const gamesBefore = await db.select().from(games).where(eq(games.matchId, m1.id));

      const stale = await score(t, m1, [p1, p1], 700000, { expectedRevision: 0 });
      expect(stale.status).toBe(409);
      expect(stale.body).toEqual({ error: MATCH_CONFLICT_MESSAGE, code: 'MATCH_CONFLICT' });

      const unchanged = await getTournament(t);
      expect(unchanged.matchScores[m1.id].revision).toBe(1);
      expect(unchanged.matchScores[m1.id].winnerPlayerId ?? null).toBeNull();
      expect(await db.select().from(games).where(eq(games.matchId, m1.id))).toEqual(gamesBefore);

      const fresh = await score(t, m1, [p1, p1], 700000, { expectedRevision: 1 });
      expect(fresh.status).toBe(200);
      expect(fresh.body.matchScores[m1.id].revision).toBe(2);
    });

    it('forfeit and best-of each raise the revision by 1', async () => {
      const t = await buildLockedTournament(se);
      const [, m2] = firstTwoPlayableMatches(t);
      const tierId = t.tiers[0].id;

      const bestOf = await makeHttpRequest(`/api/tournaments/${t.id}/matches/${m2.id}/best-of`, 'PUT', { tierId, bestOf: 5 });
      expect(bestOf.status).toBe(200);
      expect(bestOf.body.matchScores[m2.id].revision).toBe(1);

      const forfeit = await makeHttpRequest(`/api/tournaments/${t.id}/matches/${m2.id}/forfeit`, 'POST', {
        tierId,
        winnerPlayerId: m2.player2.player!.id,
      });
      expect(forfeit.status).toBe(200);
      expect(forfeit.body.matchScores[m2.id].revision).toBe(2);
    });

    it('stores hasTiebreaker in tournaments.metadata.matchScores', async () => {
      const t = await buildLockedTournament(se);
      const [m1] = firstTwoPlayableMatches(t);
      const p1 = m1.player1.player!.id;

      expect((await score(t, m1, [p1, p1], 800000, { hasTiebreaker: true })).status).toBe(200);
      const [row] = await db.select({ metadata: tournaments.metadata }).from(tournaments).where(eq(tournaments.id, t.id));
      expect((row.metadata as any).matchScores[m1.id].hasTiebreaker).toBe(true);
    });
  });
});
