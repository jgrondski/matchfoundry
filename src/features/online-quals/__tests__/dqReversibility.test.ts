import { describe, it, expect, beforeEach } from 'vitest';
import { Readable } from 'node:stream';
import { setupTestDb } from '../../../db/testDb';
import { setDb } from '../../../db';
import { createApiMiddleware } from '../../../server/api';
import { createSessionToken } from '../../../server/pinCrypto';
import { saveFullTournament, getFullTournament } from '../../../api/tournaments';
import { setOnlineQualsOpen } from '../../../api/qualifiers';
import { seedDefaultOrganizations } from '../../../api/organizations';
import { createPlayer, getPlayer } from '../../../api/players';
import { createEmptyTournament, createDefaultTier } from '../../tournament/defaults';
import {
  deriveLeaderboard,
  generateDraftBracketsForTournament,
  getPlayerQualifierStatus,
} from '../../qualifiers/scoring';
import type { Tournament, PlayerProfile, QualifierSubmission } from '../../tournament/types';

function createMockReq(options: {
  url: string;
  method?: string;
  body?: any;
  headers?: Record<string, string>;
}) {
  const bodyStr = options.body !== undefined ? JSON.stringify(options.body) : '';
  const stream = Readable.from(bodyStr ? [bodyStr] : []);
  const req = stream as any;
  req.url = options.url;
  req.method = options.method || 'GET';
  req.headers = options.headers || {};
  return req;
}

function createMockRes() {
  let statusCode = 200;
  let body = '';
  const headers: Record<string, string> = {};
  return {
    setHeader(name: string, val: string) {
      headers[name.toLowerCase()] = val;
    },
    getHeader(name: string) {
      return headers[name.toLowerCase()];
    },
    writeHead(code: number, headHeaders?: Record<string, string>) {
      statusCode = code;
      if (headHeaders) {
        for (const [k, v] of Object.entries(headHeaders)) {
          headers[k.toLowerCase()] = v;
        }
      }
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
    getStatusCode() {
      return statusCode;
    },
  };
}

describe('Tournament-scoped DQ / DNQ reversibility and seeding', () => {
  let middleware: ReturnType<typeof createApiMiddleware>;

  beforeEach(async () => {
    process.env.SYSTEM_ADMIN_RECOVERY_PIN = '999999';
    const { db } = setupTestDb();
    setDb(db);
    await seedDefaultOrganizations();
    middleware = createApiMiddleware();
  });

  async function call(url: string, body: any, token: string, method = 'POST') {
    const res = createMockRes();
    await middleware(
      createMockReq({ url, method, body, headers: { authorization: `Bearer ${token}` } }),
      res as any,
      () => {}
    );
    return res;
  }

  async function createOnlineTournament(slug: string): Promise<{ tourney: Tournament; token: string }> {
    const tourney = createEmptyTournament({ slug, name: slug });
    tourney.id = crypto.randomUUID();
    tourney.organizationId = 'org_ctwc';
    tourney.qualMode = 'ONLINE';
    tourney.isLocked = false;
    tourney.tiers = [createDefaultTier(1, { id: crypto.randomUUID(), playerCount: 4 })];
    await saveFullTournament(tourney);
    await setOnlineQualsOpen(tourney.id, true);
    const token = createSessionToken({ role: 'TOURNAMENT_ADMIN', tournamentId: tourney.id });
    return { tourney, token };
  }

  async function submitOnlineRun(tourneyId: string, playerId: string, twitch: string, scores: number[]) {
    await middleware(
      createMockReq({
        url: `/api/tournaments/${tourneyId}/qualify/start`,
        method: 'POST',
        body: {
          playerId,
          submittedTwitchId: `tw_${twitch}`,
          submittedTwitchUsername: twitch,
          identityStatus: 'VERIFIED_MATCH',
        },
      }),
      createMockRes() as any,
      () => {}
    );
    await middleware(
      createMockReq({
        url: `/api/tournaments/${tourneyId}/qualify/submit`,
        method: 'POST',
        body: { playerId, scores, twitchVodUrl: 'https://twitch.tv/videos/1' },
      }),
      createMockRes() as any,
      () => {}
    );
  }

  async function newPlayer(name: string): Promise<PlayerProfile> {
    const p = await createPlayer({ name, country: 'US' });
    return { id: p.id, name: p.name, personalBest: p.personalBest, playstyle: 'DAS' };
  }

  function adjudicate(tourneyId: string, token: string, playerId: string, action: string) {
    return call(`/api/tournaments/${tourneyId}/qualify/adjudicate`, { playerId, action }, token);
  }

  it('DQ followed by VERIFY fully reinstates the competitor (status, flag, rank, seed)', async () => {
    const { tourney, token } = await createOnlineTournament('dq-revert');
    const player = await newPlayer('DqRevertPlayer');
    await submitOnlineRun(tourney.id, player.id, 'dqrevert', [900000]);

    expect((await adjudicate(tourney.id, token, player.id, 'DQ')).getStatusCode()).toBe(200);
    const afterDq = (await getFullTournament(tourney.id))!;
    expect(afterDq.playersPool?.find(p => p.id === player.id)?.isDisqualified).toBe(true);
    expect(getPlayerQualifierStatus(afterDq, player.id)).toBe('dq');

    expect((await adjudicate(tourney.id, token, player.id, 'VERIFY')).getStatusCode()).toBe(200);
    const afterVerify = (await getFullTournament(tourney.id))!;
    expect(afterVerify.playersPool?.find(p => p.id === player.id)?.isDisqualified).toBe(false);
    expect(getPlayerQualifierStatus(afterVerify, player.id)).toBe('verified');

    const row = deriveLeaderboard(afterVerify).find(r => r.player.id === player.id)!;
    expect(row.isDisqualified).toBe(false);
    expect(row.isDNQ).toBe(false);
    expect(row.rank).toBe(1);
    expect(row.tierSeed).toBe(1);
  });

  it('DQ followed by DNQ replaces the DQ ruling', async () => {
    const { tourney, token } = await createOnlineTournament('dq-to-dnq');
    const player = await newPlayer('DqToDnqPlayer');
    await submitOnlineRun(tourney.id, player.id, 'dqtodnq', [900000]);

    await adjudicate(tourney.id, token, player.id, 'DQ');
    await adjudicate(tourney.id, token, player.id, 'DNQ');
    const t = (await getFullTournament(tourney.id))!;
    expect(t.playersPool?.find(p => p.id === player.id)?.isDisqualified).toBe(false);
    expect(getPlayerQualifierStatus(t, player.id)).toBe('dnq');
  });

  it('a DQ in one tournament does not leak into another tournament or the global profile', async () => {
    const { tourney: a, token: tokenA } = await createOnlineTournament('dq-iso-a');
    const player = await newPlayer('IsolatedPlayer');
    await submitOnlineRun(a.id, player.id, 'isolated', [900000]);

    const b = createEmptyTournament({ slug: 'dq-iso-b', name: 'dq-iso-b' });
    b.id = crypto.randomUUID();
    b.organizationId = 'org_ctwc';
    b.playersPool = [player];
    await saveFullTournament(b);

    await adjudicate(a.id, tokenA, player.id, 'DQ');

    expect((await getFullTournament(a.id))!.playersPool?.find(p => p.id === player.id)?.isDisqualified).toBe(true);
    expect((await getFullTournament(b.id))!.playersPool?.find(p => p.id === player.id)?.isDisqualified).toBe(false);
    expect((await getPlayer(player.id))?.isDisqualified).toBe(false);
  });

  it('a stale full-tournament save cannot revert a judge VERIFIED run back to DNQ', async () => {
    const { tourney, token } = await createOnlineTournament('stale-dnq');
    const player = await newPlayer('StaleDnqPlayer');
    await submitOnlineRun(tourney.id, player.id, 'stalednq', [900000]);

    await adjudicate(tourney.id, token, player.id, 'DNQ');
    const staleSnapshot = (await getFullTournament(tourney.id))!; // a tab that loaded during the DNQ
    await adjudicate(tourney.id, token, player.id, 'VERIFY');

    await saveFullTournament(staleSnapshot);

    const t = (await getFullTournament(tourney.id))!;
    const subs = (t.qualifierSubmissions || []).filter(s => s.playerId === player.id);
    expect(subs.length).toBeGreaterThan(0);
    expect(subs.every(s => s.status === 'VERIFIED')).toBe(true);
    expect(getPlayerQualifierStatus(t, player.id)).toBe('verified');
  });

  it('a full-tournament save never sets or clears DQ', async () => {
    const { tourney, token } = await createOnlineTournament('stale-dq');
    const player = await newPlayer('StaleDqPlayer');
    await submitOnlineRun(tourney.id, player.id, 'staledq', [900000]);

    // Snapshot claiming DQ must not DQ the player
    const snapshot = (await getFullTournament(tourney.id))!;
    snapshot.playersPool = snapshot.playersPool?.map(p => (p.id === player.id ? { ...p, isDisqualified: true } : p));
    await saveFullTournament(snapshot);
    expect((await getFullTournament(tourney.id))!.playersPool?.find(p => p.id === player.id)?.isDisqualified).toBe(false);

    // And a stale non-DQ snapshot must not lift a judge DQ
    const preDqSnapshot = (await getFullTournament(tourney.id))!;
    await adjudicate(tourney.id, token, player.id, 'DQ');
    await saveFullTournament(preDqSnapshot);
    expect((await getFullTournament(tourney.id))!.playersPool?.find(p => p.id === player.id)?.isDisqualified).toBe(true);
  });

  it('POST /qualify/disqualification sets DQ and lifting it returns DQ runs to the review queue', async () => {
    const { tourney, token } = await createOnlineTournament('dq-toggle');
    const player = await newPlayer('TogglePlayer');
    await submitOnlineRun(tourney.id, player.id, 'toggle', [900000]);
    await adjudicate(tourney.id, token, player.id, 'DQ');

    const bad = await call(`/api/tournaments/${tourney.id}/qualify/disqualification`, { playerId: player.id }, token);
    expect(bad.getStatusCode()).toBe(400);

    const lift = await call(
      `/api/tournaments/${tourney.id}/qualify/disqualification`,
      { playerId: player.id, isDisqualified: false },
      token
    );
    expect(lift.getStatusCode()).toBe(200);
    const lifted: Tournament = lift.getBody();
    expect(lifted.playersPool?.find(p => p.id === player.id)?.isDisqualified).toBe(false);
    const subs = (lifted.qualifierSubmissions || []).filter(s => s.playerId === player.id);
    expect(subs.every(s => s.status === 'SUBMITTED')).toBe(true);
    expect(getPlayerQualifierStatus(lifted, player.id)).toBe('awaiting verification');

    const set = await call(
      `/api/tournaments/${tourney.id}/qualify/disqualification`,
      { playerId: player.id, isDisqualified: true },
      token
    );
    expect(set.getStatusCode()).toBe(200);
    expect((set.getBody() as Tournament).playersPool?.find(p => p.id === player.id)?.isDisqualified).toBe(true);
  });
});

describe('DQ / DNQ competitors never take a rank, tier, or seed slot', () => {
  const tier = createDefaultTier(1, { id: 'gold', playerCount: 2 });
  const sub = (id: string, playerId: string, score: number, status: QualifierSubmission['status']): QualifierSubmission => ({
    id,
    tournamentId: 't',
    playerId,
    score,
    submittedAt: Number(id.replace(/\D/g, '')),
    status,
  });
  const tournament: Tournament = {
    ...createEmptyTournament({ slug: 't', name: 't' }),
    id: 't',
    qualFormat: 'HIGH_SCORE',
    isLocked: false,
    tiers: [tier],
    playersPool: [
      { id: 'top-dnq', name: 'Top DNQ', personalBest: 0, playstyle: 'DAS' },
      { id: 'top-dq', name: 'Top DQ', personalBest: 0, playstyle: 'DAS', isDisqualified: true },
      { id: 'a', name: 'A', personalBest: 0, playstyle: 'DAS' },
      { id: 'b', name: 'B', personalBest: 0, playstyle: 'DAS' },
      { id: 'c', name: 'C', personalBest: 0, playstyle: 'DAS' },
      { id: 'idle', name: 'Idle', personalBest: 0, playstyle: 'DAS' },
    ],
    qualifierSubmissions: [
      sub('s1', 'top-dnq', 990000, 'DNQ'),
      sub('s2', 'top-dq', 995000, 'VERIFIED'),
      sub('s3', 'a', 900000, 'VERIFIED'),
      sub('s4', 'b', 800000, 'VERIFIED'),
      sub('s5', 'c', 700000, 'VERIFIED'),
    ],
    tournamentPlayers: {},
  };

  it('orders ranked competitors, then DNQ, then DQ, then unstarted', () => {
    const rows = deriveLeaderboard(tournament);
    expect(rows.map(r => r.player.id)).toEqual(['a', 'b', 'c', 'top-dnq', 'top-dq', 'idle']);

    expect(rows[0]).toMatchObject({ rank: 1, tierSeed: 1, isDNQ: false });
    expect(rows[1]).toMatchObject({ rank: 2, tierSeed: 2, isDNQ: false });
    // Cutoff miss keeps a rank (3) because DNQ/DQ rulings no longer consume rank numbers
    expect(rows[2]).toMatchObject({ rank: 3, isDNQ: true });
    expect(rows[2].assignedTier).toBeUndefined();

    for (const ruling of [rows[3], rows[4]]) {
      expect(ruling.rank).toBeUndefined();
      expect(ruling.assignedTier).toBeUndefined();
      expect(ruling.tierSeed).toBeUndefined();
    }
    expect(rows[3]).toMatchObject({ isDNQ: true, isDisqualified: false, status: 'dnq' });
    expect(rows[4]).toMatchObject({ isDNQ: false, isDisqualified: true, status: 'dq' });
  });

  it('excludes DQ and DNQ competitors from draft and manual-seeded brackets', () => {
    const seededIds = (tiers: Tournament['tiers']) =>
      tiers.flatMap(t =>
        t.bracket.rounds.flatMap(r => r.matches.flatMap(m => [m.player1.player?.id, m.player2.player?.id]))
      ).filter(Boolean);

    const draft = seededIds(generateDraftBracketsForTournament(tournament));
    expect(draft).toEqual(expect.arrayContaining(['a', 'b']));
    expect(draft).not.toContain('top-dnq');
    expect(draft).not.toContain('top-dq');

    const manual = seededIds(
      generateDraftBracketsForTournament({
        ...tournament,
        seedingMethod: 'MANUAL',
        manualSeeds: ['top-dq', 'top-dnq', 'a', 'b'],
      })
    );
    expect(manual).toEqual(expect.arrayContaining(['a', 'b']));
    expect(manual).not.toContain('top-dnq');
    expect(manual).not.toContain('top-dq');
  });
});
