import { describe, it, expect, beforeEach } from 'vitest';
import { Readable } from 'stream';
import type { IncomingMessage, ServerResponse } from 'http';
import { setupTestDb } from '../../db/testDb';
import { setDb } from '../../db';
import { players } from '../../db/schema';
import { createTournament, getFullTournament, saveFullTournament } from '../tournaments';
import { generateDraftBracketsForTournament } from '../../features/qualifiers/scoring';
import { createApiMiddleware } from '../../server/api';
import { createSessionToken } from '../../server/pinCrypto';
import { MATCH_COMPLETE_CODE } from '../../features/bracket/matchConflict';
import type { BracketMatch } from '../../features/bracket/types';
import type { PlayerProfile, Tournament } from '../../features/tournament/types';

// Server-side guardrails for scoring a bracket match. These mirror what the score drawer
// allows, so a stale tab, a double tap or a direct API call cannot do what the UI would not.

describe('Match scoring guardrails', () => {
  let db: ReturnType<typeof setupTestDb>['db'];
  let middleware: ReturnType<typeof createApiMiddleware>;

  beforeEach(() => {
    const testDb = setupTestDb();
    db = testDb.db;
    setDb(db);
    middleware = createApiMiddleware();
  });

  const makeHttpRequest = async (url: string, method: string, body?: unknown) => {
    const bodyStr = body !== undefined ? JSON.stringify(body) : '';
    const req = Object.assign(Readable.from(bodyStr ? [bodyStr] : []), {
      url,
      method,
      headers: { authorization: `Bearer ${createSessionToken({ role: 'SYSTEM_ADMIN' })}` },
    });
    let statusCode = 200;
    let responseBody = '';
    const res = {
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
    await middleware(req as unknown as IncomingMessage, res as unknown as ServerResponse, () => {});
    return { status: statusCode, body: responseBody ? JSON.parse(responseBody) : null };
  };

  const buildLockedTournament = async (numPlayers = 8): Promise<Tournament> => {
    const competitors: PlayerProfile[] = Array.from({ length: numPlayers }, (_, i) => ({
      id: crypto.randomUUID(),
      name: `Guard_${i + 1}_${crypto.randomUUID().slice(0, 8)}`,
      country: 'US',
      personalBest: 900000 + (i + 1) * 1000,
      playstyle: 'Rolling',
      avatarType: 'flag' as const,
      isDisqualified: false,
    }));
    await db.insert(players).values(
      competitors.map(({ id, name, country, personalBest, playstyle }) => ({ id, name, country, personalBest, playstyle }))
    );

    const { tournament } = await createTournament({
      name: `Guardrails ${crypto.randomUUID().slice(0, 6)}`,
      organizationId: 'org_ctwc',
      qualFormat: 'HIGH_SCORE',
      tiers: [{ name: 'Gold', bracketType: 'TRADITIONAL', numPlayers, priorityOrder: 1, eliminationType: 'SINGLE' }],
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

  const playable = (t: Tournament): BracketMatch[] =>
    t.tiers[0].bracket!.rounds![0].matches.filter(m => m.player1.player && m.player2.player);

  const url = (t: Tournament, m: BracketMatch | string, action: string) =>
    `/api/tournaments/${t.id}/matches/${typeof m === 'string' ? m : m.id}/${action}`;

  const games = (m: BracketMatch, rows: Array<[number | null, number | null]>) =>
    rows.map(([a, b], i) => ({
      gameNumber: i + 1,
      player1Points: a,
      player2Points: b,
      winnerPlayerId: a !== null && b !== null ? (a > b ? m.player1.player!.id : b > a ? m.player2.player!.id : 'TIE') : null,
    }));

  const score = (t: Tournament, m: BracketMatch, rows: Array<[number | null, number | null]>) =>
    makeHttpRequest(url(t, m, 'score'), 'PUT', { tierId: t.tiers[0].id, games: games(m, rows) });

  const forfeit = (t: Tournament, m: BracketMatch, winnerPlayerId: string, reason?: string) =>
    makeHttpRequest(url(t, m, 'forfeit'), 'POST', { tierId: t.tiers[0].id, winnerPlayerId, reason });

  const reopen = (t: Tournament, m: BracketMatch) => makeHttpRequest(url(t, m, 'reopen'), 'POST', { tierId: t.tiers[0].id });

  const fetchMatch = async (t: Tournament, id: string) => {
    const res = await makeHttpRequest(`/api/tournaments/${t.id}`, 'GET');
    const fresh = res.body as Tournament;
    return { match: fresh.tiers[0].bracket!.matchesById[id], record: fresh.matchScores[id] };
  };

  describe('score values', () => {
    it.each([
      ['above 99,999,999', 100_000_000],
      ['far above the integer limit', 5_000_000_000],
      ['a decimal', 1234.5],
      ['negative', -10],
    ])('rejects a game score that is %s', async (_label, bad) => {
      const t = await buildLockedTournament();
      const [m] = playable(t);
      const res = await score(t, m, [[bad, 1000]]);
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/whole numbers from 0 to 99,999,999/);
      expect((await fetchMatch(t, m.id)).record?.games?.length ?? 0).toBe(0);
    });

    it('accepts 99,999,999 exactly', async () => {
      const t = await buildLockedTournament();
      const [m] = playable(t);
      expect((await score(t, m, [[99_999_999, 0]])).status).toBe(200);
    });

    it('rejects a qualifier score above 99,999,999 before anything is written', async () => {
      const { tournament } = await createTournament({
        name: `Quals ${crypto.randomUUID().slice(0, 6)}`,
        organizationId: 'org_ctwc',
        qualFormat: 'HIGH_SCORE',
        tiers: [{ name: 'Gold', bracketType: 'TRADITIONAL', numPlayers: 8, priorityOrder: 1, eliminationType: 'SINGLE' }],
      });
      const playersBefore = (await db.select().from(players)).length;
      const res = await makeHttpRequest(`/api/tournaments/${tournament.id}/qualifiers`, 'POST', {
        playerName: `Qual_${crypto.randomUUID().slice(0, 8)}`,
        score: 100_000_000,
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/99,999,999/);
      expect((await db.select().from(players)).length).toBe(playersBefore);
    });
  });

  describe('game structure', () => {
    it('rejects games entered after the match was decided', async () => {
      const t = await buildLockedTournament();
      const [m] = playable(t);
      const res = await score(t, m, [[900, 100], [900, 100], [100, 900]]);
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/decided in Game 2/);
    });

    it('rejects a game entered before the previous one is finished', async () => {
      const t = await buildLockedTournament();
      const [m] = playable(t);
      const res = await score(t, m, [[900, null], [900, 100]]);
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Game 1 must be finished/);
    });

    it('rejects a winner that contradicts the scores', async () => {
      const t = await buildLockedTournament();
      const [m] = playable(t);
      const res = await makeHttpRequest(url(t, m, 'score'), 'PUT', {
        tierId: t.tiers[0].id,
        games: [{ gameNumber: 1, player1Points: 900, player2Points: 100, winnerPlayerId: m.player2.player!.id }],
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/does not match the scores/);
    });

    it('allows a tied game to be followed by a tiebreaker game', async () => {
      const t = await buildLockedTournament();
      const [m] = playable(t);
      const res = await score(t, m, [[665, 665], [900, 100], [900, 100]]);
      expect(res.status).toBe(200);
      expect((await fetchMatch(t, m.id)).match.winnerId).toBe(m.player1.player!.id);
    });

    it('rejects scoring a match that is still waiting on a competitor', async () => {
      const t = await buildLockedTournament();
      const waiting = t.tiers[0].bracket!.rounds![1].matches[0];
      expect(waiting.player1.player && waiting.player2.player).toBeFalsy();
      const res = await makeHttpRequest(url(t, waiting, 'score'), 'PUT', { tierId: t.tiers[0].id, games: [] });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Both competitors/);
    });
  });

  describe('completed matches and reopening', () => {
    it('refuses to re-score a completed match until it is reopened', async () => {
      const t = await buildLockedTournament();
      const [m] = playable(t);
      expect((await score(t, m, [[900, 100], [900, 100]])).status).toBe(200);

      const again = await score(t, m, [[100, 900]]);
      expect(again.status).toBe(409);
      expect(again.body.code).toBe(MATCH_COMPLETE_CODE);
    });

    it('replays the practice-run incident: forfeit, undo, forfeit the other way, undo, and both competitors stay', async () => {
      const t = await buildLockedTournament();
      const [m] = playable(t);
      const a = m.player1.player!.id;
      const b = m.player2.player!.id;

      expect((await forfeit(t, m, a, 'No-show')).status).toBe(200);
      expect((await reopen(t, m)).status).toBe(200);
      expect((await forfeit(t, m, b, 'Wrong competitor')).status).toBe(200);
      expect((await reopen(t, m)).status).toBe(200);

      const { match, record } = await fetchMatch(t, m.id);
      expect([match.player1.player?.id, match.player2.player?.id]).toEqual([a, b]);
      expect(match.winnerId).toBeNull();
      expect(record.isComplete).toBe(false);
      expect(record.notes).toBeUndefined();

      const next = (await fetchMatch(t, m.nextMatchId!)).match;
      expect([next.player1.player?.id, next.player2.player?.id]).not.toContain(a);
      expect([next.player1.player?.id, next.player2.player?.id]).not.toContain(b);
    });

    it('blocks reopening while the next match has scores, naming that match', async () => {
      const t = await buildLockedTournament();
      const [m1, m2] = playable(t);
      expect((await score(t, m1, [[900, 100], [900, 100]])).status).toBe(200);
      expect((await score(t, m2, [[900, 100], [900, 100]])).status).toBe(200);

      const next = (await fetchMatch(t, m1.nextMatchId!)).match;
      expect((await score(t, next, [[900, 100]])).status).toBe(200);

      const res = await reopen(t, m1);
      expect(res.status).toBe(409);
      expect(res.body.error).toContain(`Match ${next.matchNumber}`);
      expect((await fetchMatch(t, m1.id)).match.winnerId).toBe(m1.player1.player!.id);
    });

    it('refuses to reopen a match that is not complete', async () => {
      const t = await buildLockedTournament();
      const [m] = playable(t);
      expect((await reopen(t, m)).status).toBe(409);
    });
  });

  describe('forfeits', () => {
    it('requires a reason', async () => {
      const t = await buildLockedTournament();
      const [m] = playable(t);
      const res = await forfeit(t, m, m.player1.player!.id, '   ');
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/reason is required/);
    });

    it('rejects a winner who is not in the match', async () => {
      const t = await buildLockedTournament();
      const [m, other] = playable(t);
      const res = await forfeit(t, m, other.player1.player!.id, 'No-show');
      expect(res.status).toBe(400);
    });

    it('keeps the reason after a reload', async () => {
      const t = await buildLockedTournament();
      const [m] = playable(t);
      expect((await forfeit(t, m, m.player1.player!.id, 'Left the venue')).status).toBe(200);
      expect((await fetchMatch(t, m.id)).record.notes).toBe('Forfeit: Left the venue');
    });

    it('refuses a forfeit on a completed match', async () => {
      const t = await buildLockedTournament();
      const [m] = playable(t);
      expect((await score(t, m, [[900, 100], [900, 100]])).status).toBe(200);
      const res = await forfeit(t, m, m.player2.player!.id, 'No-show');
      expect(res.status).toBe(409);
      expect(res.body.code).toBe(MATCH_COMPLETE_CODE);
    });
  });

  describe('best-of', () => {
    it('rejects formats outside the allowed list', async () => {
      const t = await buildLockedTournament();
      const [m] = playable(t);
      const res = await makeHttpRequest(url(t, m, 'best-of'), 'PUT', { tierId: t.tiers[0].id, bestOf: 99 });
      expect(res.status).toBe(400);
    });

    it('locks once a game has been scored', async () => {
      const t = await buildLockedTournament();
      const [m] = playable(t);
      expect((await makeHttpRequest(url(t, m, 'best-of'), 'PUT', { tierId: t.tiers[0].id, bestOf: 5 })).status).toBe(200);
      expect((await score(t, m, [[900, 100]])).status).toBe(200);
      const res = await makeHttpRequest(url(t, m, 'best-of'), 'PUT', { tierId: t.tiers[0].id, bestOf: 7 });
      expect(res.status).toBe(409);
    });
  });
});
