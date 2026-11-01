import { describe, it, expect, beforeEach } from 'vitest';
import { Readable } from 'node:stream';
import { and, eq } from 'drizzle-orm';
import { setupTestDb } from '../../../db/testDb';
import { setDb, getDb, qualifierRuns, tournamentPlayers, players } from '../../../db';
import { createApiMiddleware } from '../../../server/api';
import { createSessionToken } from '../../../server/pinCrypto';
import { saveFullTournament, getFullTournament } from '../../../api/tournaments';
import {
  startOnlineQualSession,
  submitOnlineQualScores,
  getOnlineQualRunByToken,
  saveOnlineQualDraft,
  discardOnlineQualRun,
  getOnlineQualSession,
  setOnlineQualsOpen,
} from '../../../api/qualifiers';
import { seedDefaultOrganizations } from '../../../api/organizations';
import { createPlayer, deletePlayer } from '../../../api/players';
import { createEmptyTournament, createDefaultTier } from '../../tournament/defaults';
import { deriveLeaderboard } from '../../qualifiers/scoring';
import { isAbandonedRun } from '../sessionDerivation';
import { loadPersistedSession, savePersistedSession } from '../components/CompetitorPortalView';
import type { Tournament } from '../../tournament/types';

function createMockReq(options: { url: string; method?: string; body?: any; headers?: Record<string, string> }) {
  const bodyStr = options.body !== undefined ? JSON.stringify(options.body) : '';
  const req = Readable.from(bodyStr ? [bodyStr] : []) as any;
  req.url = options.url;
  req.method = options.method || 'GET';
  req.headers = options.headers || {};
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
    getStatusCode() {
      return statusCode;
    },
  };
}

function buildTournament(overrides: Partial<Tournament> = {}): Tournament {
  const t = createEmptyTournament({ slug: `rl-${crypto.randomUUID().slice(0, 8)}`, name: 'Run Link Cup' });
  t.id = crypto.randomUUID();
  t.organizationId = 'org_ctwc';
  t.qualMode = 'HYBRID';
  t.tiers = [createDefaultTier(1, { id: crypto.randomUUID(), playerCount: 4 })];
  return { ...t, ...overrides };
}

describe('Online run links, drafts, and unfinished-run cleanup', () => {
  let middleware: ReturnType<typeof createApiMiddleware>;
  let tourney: Tournament;

  beforeEach(async () => {
    process.env.SYSTEM_ADMIN_RECOVERY_PIN = '999999';
    const { db } = setupTestDb();
    setDb(db);
    await seedDefaultOrganizations();
    middleware = createApiMiddleware();
    tourney = buildTournament();
    await saveFullTournament(tourney);
    await setOnlineQualsOpen(tourney.id, true);
  });

  async function call(url: string, opts: { method?: string; body?: any; token?: string } = {}) {
    const res = createMockRes();
    await middleware(
      createMockReq({
        url,
        method: opts.method || 'POST',
        body: opts.body,
        headers: opts.token ? { authorization: `Bearer ${opts.token}` } : {},
      }),
      res as any,
      () => {}
    );
    return res;
  }

  const adminToken = () => createSessionToken({ role: 'TOURNAMENT_ADMIN', tournamentId: tourney.id });

  async function rosterHas(playerId: string): Promise<boolean> {
    const rows = await getDb()
      .select()
      .from(tournamentPlayers)
      .where(and(eq(tournamentPlayers.tournamentId, tourney.id), eq(tournamentPlayers.playerId, playerId)));
    return rows.length > 0;
  }

  async function playerExists(playerId: string): Promise<boolean> {
    const rows = await getDb().select().from(players).where(eq(players.id, playerId));
    return rows.length > 0;
  }

  it('starting a run issues a token but does not add the player to the roster', async () => {
    const run = await startOnlineQualSession(tourney.id, { playerName: 'Walk In', twitchUsername: 'walkin' });
    expect(run.resumeToken).toMatch(/^[0-9a-f]{48}$/);
    expect(run.draft).toBeNull();
    expect(await rosterHas(run.playerId)).toBe(false);
  });

  it('autosaves a draft by token and restores it by link or by name and Twitch', async () => {
    const run = await startOnlineQualSession(tourney.id, { playerName: 'Drafter', twitchUsername: 'drafter' });
    const token = run.resumeToken!;

    const saved = await call(`/api/tournaments/${tourney.id}/qualify/draft`, {
      body: { resumeToken: token, scores: [845123, 999999], twitchVodUrl: 'https://twitch.tv/videos/9', playerNotes: 'g2 lag' },
    });
    expect(saved.getStatusCode()).toBe(200);

    const byLink = await call(`/api/tournaments/${tourney.id}/qualify/run?token=${token}`, { method: 'GET' });
    expect(byLink.getStatusCode()).toBe(200);
    expect(byLink.getBody().draft).toEqual({
      scores: [845123, 999999],
      twitchVodUrl: 'https://twitch.tv/videos/9',
      playerNotes: 'g2 lag',
    });
    expect(byLink.getBody().authWord).toBe(run.authWord);

    // Same name and Twitch on another device resumes the same run, scores included.
    const resumed = await startOnlineQualSession(tourney.id, { playerName: 'Drafter', twitchUsername: 'drafter' });
    expect(resumed.isNewSession).toBeUndefined();
    expect(resumed.resumeToken).toBe(token);
    expect(resumed.draft?.scores).toEqual([845123, 999999]);
  });

  it('rejects drafts and lookups with an unknown token', async () => {
    await startOnlineQualSession(tourney.id, { playerName: 'Guarded', twitchUsername: 'guarded' });
    const draft = await call(`/api/tournaments/${tourney.id}/qualify/draft`, {
      body: { resumeToken: 'not-a-real-token', scores: [1] },
    });
    expect(draft.getStatusCode()).toBe(403);
    const lookup = await call(`/api/tournaments/${tourney.id}/qualify/run?token=nope`, { method: 'GET' });
    expect(lookup.getStatusCode()).toBe(404);
  });

  it('requires the token to submit a tokened run, and registers the player only on submit', async () => {
    const run = await startOnlineQualSession(tourney.id, { playerName: 'Submitter', twitchUsername: 'submitter' });
    const body = { playerId: run.playerId, scores: [999999], twitchVodUrl: 'https://twitch.tv/videos/1' };

    const noToken = await call(`/api/tournaments/${tourney.id}/qualify/submit`, { body });
    expect(noToken.getStatusCode()).toBe(403);
    const wrongToken = await call(`/api/tournaments/${tourney.id}/qualify/submit`, {
      body: { ...body, resumeToken: 'x'.repeat(48) },
    });
    expect(wrongToken.getStatusCode()).toBe(403);
    expect(await rosterHas(run.playerId)).toBe(false);

    const ok = await call(`/api/tournaments/${tourney.id}/qualify/submit`, {
      body: { ...body, resumeToken: run.resumeToken },
    });
    expect(ok.getStatusCode()).toBe(200);
    expect(await rosterHas(run.playerId)).toBe(true);

    // The link stops working once the run is submitted.
    expect(await getOnlineQualRunByToken(tourney.id, run.resumeToken!)).toBeNull();
  });

  it('still lets runs started before tokens existed submit by player ID', async () => {
    const run = await startOnlineQualSession(tourney.id, { playerName: 'Legacy', twitchUsername: 'legacy' });
    await getDb()
      .update(qualifierRuns)
      .set({ resumeToken: null })
      .where(eq(qualifierRuns.playerId, run.playerId));

    const session = await submitOnlineQualScores(tourney.id, {
      playerId: run.playerId,
      scores: [700000],
      twitchVodUrl: 'https://twitch.tv/videos/2',
    });
    expect(session.status).toBe('SUBMITTED');
  });

  it('issues a token to a pre-token run when it is resumed', async () => {
    const run = await startOnlineQualSession(tourney.id, { playerName: 'Upgraded', twitchUsername: 'upgraded' });
    await getDb()
      .update(qualifierRuns)
      .set({ resumeToken: null })
      .where(eq(qualifierRuns.playerId, run.playerId));

    const resumed = await startOnlineQualSession(tourney.id, { playerName: 'Upgraded', twitchUsername: 'upgraded' });
    expect(resumed.resumeToken).toMatch(/^[0-9a-f]{48}$/);
    await expect(
      saveOnlineQualDraft(tourney.id, { resumeToken: resumed.resumeToken!, scores: [123] })
    ).resolves.toBeTruthy();
  });

  it('never exposes the token or draft in public data', async () => {
    const run = await startOnlineQualSession(tourney.id, { playerName: 'Private', twitchUsername: 'private' });
    await saveOnlineQualDraft(tourney.id, { resumeToken: run.resumeToken!, scores: [500000] });

    const publicSession = await getOnlineQualSession(tourney.id, { playerId: run.playerId });
    expect(publicSession?.resumeToken).toBeUndefined();
    expect(publicSession?.draft).toBeUndefined();

    const full = await getFullTournament(tourney.id);
    const serialized = JSON.stringify(full);
    expect(serialized).not.toContain(run.resumeToken!);
    expect(serialized).not.toContain('500000');
  });

  it('discarding a walk-in run deletes the run and the walk-in player', async () => {
    const run = await startOnlineQualSession(tourney.id, { playerName: 'Test A', twitchUsername: 'testa' });
    expect(run.identityStatus).toBe('PROVISIONAL_NEW');

    const unauth = await call(`/api/tournaments/${tourney.id}/qualify/discard`, { body: { playerId: run.playerId } });
    expect(unauth.getStatusCode()).toBe(401);

    const res = await call(`/api/tournaments/${tourney.id}/qualify/discard`, {
      body: { playerId: run.playerId },
      token: adminToken(),
    });
    expect(res.getStatusCode()).toBe(200);
    expect(res.getBody()).toEqual({ deletedPlayer: true });
    expect(await getOnlineQualSession(tourney.id, { playerId: run.playerId })).toBeNull();
    expect(await playerExists(run.playerId)).toBe(false);
  });

  it('discarding an existing player\'s run keeps the player', async () => {
    const player = await createPlayer({ name: 'Regular', country: 'US' } as any);
    await startOnlineQualSession(tourney.id, { playerName: 'Regular', twitchUsername: 'regular' });

    const result = await discardOnlineQualRun(tourney.id, player.id);
    expect(result.deletedPlayer).toBe(false);
    expect(await playerExists(player.id)).toBe(true);
    expect(await getOnlineQualSession(tourney.id, { playerId: player.id })).toBeNull();
  });

  it('refuses to discard a submitted run', async () => {
    const run = await startOnlineQualSession(tourney.id, { playerName: 'Done', twitchUsername: 'done' });
    await submitOnlineQualScores(tourney.id, {
      playerId: run.playerId,
      scores: [999999],
      twitchVodUrl: 'https://twitch.tv/videos/3',
      resumeToken: run.resumeToken,
    });
    await expect(discardOnlineQualRun(tourney.id, run.playerId)).rejects.toThrow(/No unfinished run/);
  });

  it('an unfinished run does not block roster removal, and goes with it', async () => {
    const player = await createPlayer({ name: 'Rostered', country: 'US' } as any);
    const full = await getFullTournament(tourney.id);
    await saveFullTournament({ ...full!, playersPool: [...full!.playersPool, player as any] });
    expect(await rosterHas(player.id)).toBe(true);
    await startOnlineQualSession(tourney.id, { playerId: player.id });

    const res = await call(`/api/tournaments/${tourney.id}/players/${player.id}`, {
      method: 'DELETE',
      token: adminToken(),
    });
    expect(res.getStatusCode()).toBe(200);
    expect(await rosterHas(player.id)).toBe(false);
    expect(await getOnlineQualSession(tourney.id, { playerId: player.id })).toBeNull();
  });

  it('an unfinished run does not block deleting the player', async () => {
    const run = await startOnlineQualSession(tourney.id, { playerName: 'Test B', twitchUsername: 'testb' });
    const result = await deletePlayer(run.playerId);
    expect(result).toEqual({ success: true });
    expect(await playerExists(run.playerId)).toBe(false);
  });

  it('hides unfinished runs from the leaderboard until they are submitted', async () => {
    const run = await startOnlineQualSession(tourney.id, { playerName: 'Hidden', twitchUsername: 'hidden' });
    let full = await getFullTournament(tourney.id);
    expect(deriveLeaderboard(full!).some(r => r.player.id === run.playerId)).toBe(false);

    await submitOnlineQualScores(tourney.id, {
      playerId: run.playerId,
      scores: [999999],
      twitchVodUrl: 'https://twitch.tv/videos/4',
      resumeToken: run.resumeToken,
    });
    full = await getFullTournament(tourney.id);
    expect(deriveLeaderboard(full!).some(r => r.player.id === run.playerId)).toBe(true);
  });
});

describe('isAbandonedRun', () => {
  const startedAt = Date.UTC(2026, 9, 26, 12, 0, 0);
  const run = { status: 'IN_PROGRESS' as const, timerLog: { startedAt, elapsedSeconds: 0, pauses: [] } };

  it('flags an unfinished run only once it is more than an hour past its window', () => {
    const windowMinutes = 60;
    expect(isAbandonedRun(run, windowMinutes, startedAt + 119 * 60_000)).toBe(false);
    expect(isAbandonedRun(run, windowMinutes, startedAt + 121 * 60_000)).toBe(true);
  });

  it('never flags a submitted run', () => {
    expect(isAbandonedRun({ ...run, status: 'SUBMITTED' }, 60, startedAt + 999 * 60_000)).toBe(false);
  });
});

describe('loadPersistedSession', () => {
  it('restores an in-progress run even when the player has other rows sorted first', () => {
    const storage = new Map<string, string>();
    (globalThis as any).localStorage = {
      getItem: (k: string) => storage.get(k) ?? null,
      setItem: (k: string, v: string) => void storage.set(k, v),
      removeItem: (k: string) => void storage.delete(k),
    };
    const t = buildTournament();
    t.qualifierSubmissions = [
      { id: 's1', tournamentId: t.id, playerId: 'p1', score: 850000, submittedAt: 1, status: 'VERIFIED', submissionSource: 'IN_PERSON' },
      { id: 's2', tournamentId: t.id, playerId: 'p1', score: 0, submittedAt: 2, status: 'IN_PROGRESS', submissionSource: 'ONLINE', authWord: 'ROCKET' },
    ];
    savePersistedSession(t.id, {
      playerId: 'p1',
      playerName: 'Sorted Second',
      twitchHandle: 'sorted',
      activeSession: { status: 'IN_PROGRESS', playerId: 'p1', authWord: 'ROCKET' } as any,
      scores: [400000],
      twitchVodUrl: '',
    });

    const restored = loadPersistedSession(t);
    expect(restored?.scores).toEqual([400000]);
    expect(restored?.activeSession.authWord).toBe('ROCKET');
    delete (globalThis as any).localStorage;
  });
});
