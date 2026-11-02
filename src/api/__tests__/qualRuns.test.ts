import { describe, it, expect, beforeEach } from 'vitest';
import { Readable } from 'stream';
import { eq } from 'drizzle-orm';
import { setupTestDb } from '../../db/testDb';
import { setDb, getDb, qualifierRuns, qualifierSubmissions, players } from '../../db';
import { createApiMiddleware } from '../../server/api';
import { createSessionToken } from '../../server/pinCrypto';
import { saveFullTournament, getFullTournament } from '../tournaments';
import { createPlayer } from '../players';
import {
  adjudicateOnlineSubmission,
  discardOnlineQualRun,
  getOnlineQualRunByToken,
  listOnlineQualSessions,
  setOnlineQualsOpen,
  startOnlineQualSession,
  submitOnlineQualScores,
  submitQualifierScore,
} from '../qualifiers';
import { createEmptyTournament, createDefaultTier } from '../../features/tournament/defaults';
import type { QualRunRow } from '../qualRuns';

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

async function createTournament(slug: string): Promise<string> {
  const t = createEmptyTournament({ slug, name: slug });
  t.id = crypto.randomUUID();
  t.organizationId = undefined;
  t.qualMode = 'HYBRID';
  t.isLocked = false;
  t.tiers = [createDefaultTier(1, { id: crypto.randomUUID(), playerCount: 4 })];
  await saveFullTournament(t);
  await setOnlineQualsOpen(t.id, true);
  return t.id;
}

async function newPlayer(name: string): Promise<string> {
  return (await createPlayer({ name, country: 'US' })).id;
}

async function startAndSubmit(tournamentId: string, playerId: string, scores: number[]) {
  const started = await startOnlineQualSession(tournamentId, {
    playerId,
    submittedTwitchId: `tw_${playerId}`,
    submittedTwitchUsername: `tw_user_${playerId.slice(0, 4)}`,
    identityStatus: 'VERIFIED_MATCH',
  });
  return submitOnlineQualScores(tournamentId, {
    playerId,
    scores,
    twitchVodUrl: 'https://twitch.tv/videos/42',
    resumeToken: started.resumeToken,
  });
}

async function sessionFor(tournamentId: string, playerId: string) {
  return (await listOnlineQualSessions(tournamentId)).find(s => s.playerId === playerId);
}

describe('Qual runs (qualifier_runs)', () => {
  beforeEach(() => {
    const { db } = setupTestDb();
    setDb(db);
  });

  it('backfills legacy score rows into one run per player', async () => {
    const tid = await createTournament('qr-backfill');
    const [a, b, c] = [await newPlayer('Legacy A'), await newPlayer('Legacy B'), await newPlayer('Legacy C')];
    const db = getDb();
    const submittedAtMs = Date.UTC(2026, 0, 2, 10, 0, 0);
    const timerLog = { startedAt: submittedAtMs - 3600_000, elapsedSeconds: 3600, pauses: [], submittedAt: submittedAtMs };

    await db.insert(qualifierSubmissions).values([
      {
        tournamentId: tid, playerId: a, score: 900000, submissionSource: 'ONLINE', status: 'SUBMITTED',
        authWord: 'PLANET', twitchVodUrl: 'https://twitch.tv/videos/a', timerLog,
        createdAt: new Date(submittedAtMs),
      },
      {
        tournamentId: tid, playerId: a, score: 800000, submissionSource: 'ONLINE', status: 'SUBMITTED',
        authWord: 'PLANET', twitchVodUrl: 'https://twitch.tv/videos/a', timerLog,
        createdAt: new Date(submittedAtMs + 1),
      },
      {
        tournamentId: tid, playerId: b, score: 700000, submissionSource: 'IN_PERSON', status: 'VERIFIED',
        verifiedBy: 'Judge', verifiedAt: new Date(submittedAtMs), createdAt: new Date(submittedAtMs - 5000),
      },
      {
        tournamentId: tid, playerId: c, score: 0, submissionSource: 'ONLINE', status: 'IN_PROGRESS',
        authWord: 'ZAPPER', resumeToken: 'legacy-token-c', draft: { scores: [123] },
        timerLog: { startedAt: submittedAtMs, elapsedSeconds: 0, pauses: [] },
        createdAt: new Date(submittedAtMs),
      },
    ]);

    const full = (await getFullTournament(tid))!;

    const runs: QualRunRow[] = await db.select().from(qualifierRuns).where(eq(qualifierRuns.tournamentId, tid));
    expect(runs).toHaveLength(3);
    const runA = runs.find(r => r.playerId === a)!;
    const runB = runs.find(r => r.playerId === b)!;
    const runC = runs.find(r => r.playerId === c)!;
    expect(runA).toMatchObject({ submissionSource: 'ONLINE', status: 'SUBMITTED', authWord: 'PLANET' });
    expect(runA.submittedAt!.getTime()).toBe(submittedAtMs);
    expect(runB).toMatchObject({ submissionSource: 'IN_PERSON', status: 'VERIFIED' });
    expect(runB.submittedAt!.getTime()).toBe(submittedAtMs - 5000);
    expect(runC).toMatchObject({ submissionSource: 'ONLINE', status: 'IN_PROGRESS', authWord: 'ZAPPER' });
    expect(runC.submittedAt).toBeNull();

    const rows: Array<typeof qualifierSubmissions.$inferSelect> = await db
      .select()
      .from(qualifierSubmissions)
      .where(eq(qualifierSubmissions.tournamentId, tid));
    expect(rows).toHaveLength(3);
    expect(rows.filter(r => r.playerId === a).every(r => r.runId === runA.id)).toBe(true);
    expect(rows.find(r => r.playerId === b)!.runId).toBe(runB.id);
    expect(rows.some(r => r.playerId === c)).toBe(false);

    const byToken = await getOnlineQualRunByToken(tid, 'legacy-token-c');
    expect(byToken?.runId).toBe(runC.id);
    expect(byToken?.draft).toEqual({ scores: [123] });

    expect(full.qualRuns).toHaveLength(3);
    for (const run of full.qualRuns!) {
      expect(run).not.toHaveProperty('resumeToken');
      expect(run).not.toHaveProperty('draft');
    }
  });

  it('backfill is idempotent', async () => {
    const tid = await createTournament('qr-idempotent');
    const a = await newPlayer('Idem A');
    await getDb().insert(qualifierSubmissions).values({ tournamentId: tid, playerId: a, score: 500000 });

    await getFullTournament(tid);
    await getFullTournament(tid);

    const runs = await getDb().select().from(qualifierRuns).where(eq(qualifierRuns.tournamentId, tid));
    expect(runs).toHaveLength(1);
  });

  it('keeps the qual when every score is deleted, and a re-added score joins it', async () => {
    const tid = await createTournament('qr-zero');
    const a = await newPlayer('Zero A');
    const submitted = await startAndSubmit(tid, a, [990000, 880000]);
    expect(submitted.submissionIds).toHaveLength(2);

    for (const subId of submitted.submissionIds) {
      expect((await call(`/api/tournaments/${tid}/qualifiers/${subId}`, 'DELETE')).status).toBe(200);
    }

    const empty = await sessionFor(tid, a);
    expect(empty).toBeDefined();
    expect(empty!.submissionSource).toBe('ONLINE');
    expect(empty!.authWord).toBe(submitted.authWord);
    expect(empty!.twitchVodUrl).toBe('https://twitch.tv/videos/42');
    expect(empty!.scores).toEqual([]);

    expect((await call(`/api/tournaments/${tid}/qualifiers`, 'POST', { playerId: a, score: 777000 })).status).toBe(201);

    const readded = await sessionFor(tid, a);
    expect(readded!.scores).toEqual([777000]);
    expect(readded!.submissionSource).toBe('ONLINE');
    expect(readded!.runId).toBe(submitted.runId);
  });

  it('keeps an in-person qual in person when its scores are edited', async () => {
    const tid = await createTournament('qr-source');
    const a = await newPlayer('InPerson A');
    await submitQualifierScore(tid, a, 600000);

    await adjudicateOnlineSubmission(tid, { playerId: a, action: 'SAVE', scores: [650000, 610000] });
    await adjudicateOnlineSubmission(tid, { playerId: a, action: 'VERIFY' });

    const session = await sessionFor(tid, a);
    expect(session!.submissionSource).toBe('IN_PERSON');
    expect(session!.scores).toEqual([650000, 610000]);
  });

  it('refuses to reassign a qual onto a player whose qual has scores', async () => {
    const tid = await createTournament('qr-reassign');
    const a = await newPlayer('Reassign A');
    const b = await newPlayer('Reassign B');
    await submitQualifierScore(tid, a, 500000);
    await submitQualifierScore(tid, b, 400000);
    const before = await listOnlineQualSessions(tid);

    await expect(
      adjudicateOnlineSubmission(tid, { playerId: a, action: 'REASSIGN_PLAYER', targetPlayerId: b })
    ).rejects.toThrow(
      "Reassign B already has a qual with 1 score. Remove Reassign B's scores on the Review page, or remove Reassign B from the roster, before reassigning to them."
    );

    const after = await listOnlineQualSessions(tid);
    expect(after.map(s => [s.playerId, s.scores])).toEqual(before.map(s => [s.playerId, s.scores]));
  });

  it('reassigning onto a player whose qual has no scores replaces that empty qual', async () => {
    const tid = await createTournament('qr-reassign-empty');
    const a = await newPlayer('Empty A');
    const b = await newPlayer('Empty B');
    const aRun = await startAndSubmit(tid, a, [500000]);
    await submitQualifierScore(tid, b, 400000);
    const bSession = await sessionFor(tid, b);
    for (const subId of bSession!.submissionIds) {
      expect((await call(`/api/tournaments/${tid}/qualifiers/${subId}`, 'DELETE')).status).toBe(200);
    }
    expect((await sessionFor(tid, b))!.scores).toEqual([]);

    const moved = await adjudicateOnlineSubmission(tid, { playerId: a, action: 'REASSIGN_PLAYER', targetPlayerId: b });
    expect(moved?.playerId).toBe(b);
    expect(moved?.runId).toBe(aRun.runId);
    expect(moved?.scores).toEqual([500000]);

    const sessions = await listOnlineQualSessions(tid);
    expect(sessions.filter(s => s.playerId === b)).toHaveLength(1);
    expect(sessions.some(s => s.playerId === a)).toBe(false);
  });

  it('blocks score entry while the player has an online run in progress', async () => {
    const tid = await createTournament('qr-midrun');
    const a = await newPlayer('Midrun A');
    await startOnlineQualSession(tid, { playerId: a });

    await expect(submitQualifierScore(tid, a, 100000)).rejects.toThrow(
      'This competitor has an online run in progress. Wait for them to submit, or discard the run first.'
    );
  });

  it('discarding a run that created a player removes both', async () => {
    const tid = await createTournament('qr-discard');
    const started = await startOnlineQualSession(tid, { playerName: 'Brand New Comp', twitchUsername: 'brandnew' });
    expect(started.identityStatus).toBe('PROVISIONAL_NEW');

    const result = await discardOnlineQualRun(tid, started.playerId);
    expect(result.deletedPlayer).toBe(true);

    const runs = await getDb().select().from(qualifierRuns).where(eq(qualifierRuns.tournamentId, tid));
    expect(runs).toHaveLength(0);
    const playerRows = await getDb().select().from(players).where(eq(players.id, started.playerId));
    expect(playerRows).toHaveLength(0);
  });
});
