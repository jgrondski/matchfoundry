import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Readable } from 'stream';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { setupTestDb } from '../../../db/testDb';
import { setDb } from '../../../db';
import { createApiMiddleware } from '../../../server/api';
import { createSessionToken } from '../../../server/pinCrypto';
import { saveFullTournament, getFullTournament } from '../../../api/tournaments';
import { createPlayer } from '../../../api/players';
import { seedDefaultOrganizations } from '../../../api/organizations';
import {
  adjudicateOnlineSubmission,
  listOnlineQualSessions,
  QualLockedError,
  setOnlineQualsOpen,
  setTournamentPlayerDisqualification,
  startOnlineQualSession,
  submitOnlineQualScores,
  submitQualifierScore,
  type ReviewQueueSessionSummary,
} from '../../../api/qualifiers';
import { createEmptyTournament, createDefaultTier } from '../../tournament/defaults';
import { generateDraftBracketsForTournament } from '../../qualifiers/scoring';
import { generateSimulatedQualifiers } from '../../tournament/simulation';
import { AdjudicationModal } from '../components/AdjudicationModal';
import { ReviewQueueTable } from '../components/ReviewQueueTable';
import { VerifyBracketModal } from '../../tournament/components/VerifyBracketModal';
import { IdentityResolutionModal } from '../components/IdentityResolutionModal';
import { AuthProvider } from '../../auth/AuthContext';
import { TournamentProvider } from '../../tournament/store';
import { OrganizationProvider } from '../../organizations/store';
import { formatQualTimestamp } from '../formatQualTimestamp';
import type { Tournament } from '../../tournament/types';

const HOOK = 'https://discord.com/api/webhooks/444/review-workflow-token';
const LOCKED = 'This qual is verified. Unverify it before making changes.';

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

function baseTournament(slug: string): Tournament {
  const t = createEmptyTournament({ slug, name: slug });
  t.id = crypto.randomUUID();
  t.organizationId = 'org_ctwc';
  t.qualMode = 'HYBRID';
  t.qualFormat = 'HIGH_SCORE';
  t.isLocked = false;
  t.tiers = [createDefaultTier(1, { id: crypto.randomUUID(), playerCount: 4 })];
  return t;
}

async function createTournament(slug: string, overrides: Partial<Tournament> = {}): Promise<string> {
  const t = Object.assign(baseTournament(slug), overrides);
  await saveFullTournament(t);
  await setOnlineQualsOpen(t.id, true);
  return t.id;
}

async function newPlayer(name: string): Promise<string> {
  return (await createPlayer({ name, country: 'US' })).id;
}

async function submitOnline(tid: string, playerId: string, scores: number[]) {
  const started = await startOnlineQualSession(tid, { playerId, identityStatus: 'VERIFIED_MATCH' });
  return submitOnlineQualScores(tid, {
    playerId,
    scores,
    twitchVodUrl: 'https://twitch.tv/videos/7',
    resumeToken: started.resumeToken,
  });
}

async function sessionFor(tid: string, playerId: string) {
  return (await listOnlineQualSessions(tid)).find(s => s.playerId === playerId);
}

function adjudicate(tid: string, body: Record<string, unknown>) {
  return call(`/api/tournaments/${tid}/qualify/adjudicate`, 'POST', body);
}

describe('Qual review workflow: save, verify, unverify', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.stubEnv('DISCORD_WEBHOOK_OVERRIDE_URL', '');
    vi.stubEnv('VERCEL_ENV', '');
    const { db } = setupTestDb();
    setDb(db);
    await seedDefaultOrganizations();
    fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  const verifiedPosts = () =>
    fetchMock.mock.calls.filter(
      ([url, init]) =>
        String(url).includes('/api/webhooks/') &&
        JSON.parse((init as RequestInit).body as string).content.includes('was verified')
    );

  it('SAVE edits scores without changing status or source, and can remove every game', async () => {
    const tid = await createTournament('rw-save');
    const a = await newPlayer('Save A');
    await submitOnline(tid, a, [800000, 700000]);

    const saved = await adjudicate(tid, { playerId: a, action: 'SAVE', scores: [810000], judgeNotes: 'Fixed typo', verifiedBy: 'Judy' });
    expect(saved.status).toBe(200);
    expect(saved.body.status).toBe('SUBMITTED');
    expect(saved.body.submissionSource).toBe('ONLINE');
    expect(saved.body.scores).toEqual([810000]);
    expect(saved.body.judgeNotes).toBe('Fixed typo\n[SCORES EDITED BY Judy]: 800000, 700000 -> 810000');

    const cleared = await adjudicate(tid, { playerId: a, action: 'SAVE', scores: [], verifiedBy: 'Judy' });
    expect(cleared.status).toBe(200);
    const listed = await sessionFor(tid, a);
    expect(listed).toBeDefined();
    expect(listed!.scores).toEqual([]);
    expect(listed!.status).toBe('SUBMITTED');
  });

  it('VERIFY never changes scores and announces only once', async () => {
    const tid = await createTournament('rw-verify', { discordWebhookUrl: HOOK });
    const a = await newPlayer('Verify A');
    await submitOnline(tid, a, [900000, 850000]);

    const first = await adjudicate(tid, { playerId: a, action: 'VERIFY', scores: [1], verifiedBy: 'Judy' });
    expect(first.status).toBe(200);
    expect(first.body.status).toBe('VERIFIED');
    expect(first.body.scores).toEqual([900000, 850000]);

    const second = await adjudicate(tid, { playerId: a, action: 'VERIFY', verifiedBy: 'Judy' });
    expect(second.status).toBe(200);
    expect(second.body.scores).toEqual([900000, 850000]);
    expect(verifiedPosts()).toHaveLength(1);
  });

  it('locks a verified qual against every change', async () => {
    const tid = await createTournament('rw-lock');
    const a = await newPlayer('Locked A');
    const b = await newPlayer('Other B');
    const submitted = await submitOnline(tid, a, [950000]);
    await adjudicate(tid, { playerId: a, action: 'VERIFY', verifiedBy: 'Judy' });
    const before = await sessionFor(tid, a);

    for (const action of ['SAVE', 'DNQ', 'DQ', 'REASSIGN_PLAYER']) {
      const res = await adjudicate(tid, { playerId: a, action, scores: [1], targetPlayerId: b });
      expect(res.status).toBe(409);
      expect(res.body.error).toBe(LOCKED);
    }
    await expect(
      adjudicateOnlineSubmission(tid, { playerId: a, action: 'DNQ' })
    ).rejects.toBeInstanceOf(QualLockedError);
    await expect(submitQualifierScore(tid, a, 1)).rejects.toBeInstanceOf(QualLockedError);
    await expect(
      setTournamentPlayerDisqualification(tid, { playerId: a, isDisqualified: true })
    ).rejects.toBeInstanceOf(QualLockedError);

    expect((await call(`/api/tournaments/${tid}/qualifiers`, 'POST', { playerId: a, score: 1 })).status).toBe(409);
    expect((await call(`/api/tournaments/${tid}/qualifiers/${submitted.submissionIds[0]}`, 'DELETE')).status).toBe(409);
    expect((await call(`/api/tournaments/${tid}/players/${a}`, 'DELETE')).status).toBe(409);

    const after = await sessionFor(tid, a);
    expect(after).toEqual(before);
    const full = (await getFullTournament(tid))!;
    expect(full.tournamentPlayers[a]).toBeDefined();
    expect(full.playersPool?.find(p => p.id === a)?.isDisqualified).toBeFalsy();
  });

  it('UNVERIFY returns the qual to pending and unlocks it', async () => {
    const tid = await createTournament('rw-unverify');
    const a = await newPlayer('Unverify A');
    await submitOnline(tid, a, [600000]);

    const pendingUnverify = await adjudicate(tid, { playerId: a, action: 'UNVERIFY' });
    expect(pendingUnverify.status).toBe(500);
    expect(pendingUnverify.body.error).toBe('Only a verified qual can be unverified.');

    await adjudicate(tid, { playerId: a, action: 'VERIFY', verifiedBy: 'Judy' });
    expect((await getFullTournament(tid))!.tournamentPlayers[a].qualsCompleted).toBe(true);

    const res = await adjudicate(tid, { playerId: a, action: 'UNVERIFY', verifiedBy: 'Max' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('SUBMITTED');
    expect(res.body.verifiedBy).toBeNull();
    expect(res.body.verifiedAt).toBeNull();
    expect(res.body.judgeNotes).toContain('[UNVERIFIED BY Max]');
    expect((await getFullTournament(tid))!.tournamentPlayers[a].qualsCompleted).toBe(false);

    const saved = await adjudicate(tid, { playerId: a, action: 'SAVE', scores: [610000] });
    expect(saved.status).toBe(200);
    expect(saved.body.scores).toEqual([610000]);
  });

  it('SAVE_AND_VERIFY saves edits and verifies in one step, announcing once', async () => {
    const tid = await createTournament('rw-save-verify', { discordWebhookUrl: HOOK });
    const a = await newPlayer('SaveVerify A');
    await submitOnline(tid, a, [800000]);

    const res = await adjudicate(tid, { playerId: a, action: 'SAVE_AND_VERIFY', scores: [820000], judgeNotes: 'Typo', verifiedBy: 'Judy' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('VERIFIED');
    expect(res.body.scores).toEqual([820000]);
    expect(res.body.verifiedBy).toBe('Judy');
    expect(res.body.judgeNotes).toBe('Typo\n[SCORES EDITED BY Judy]: 800000 -> 820000');
    expect(verifiedPosts()).toHaveLength(1);
  });

  it('refuses to verify a qual with no scores and leaves it untouched', async () => {
    const tid = await createTournament('rw-verify-empty');
    const a = await newPlayer('Empty Verify A');
    await submitOnline(tid, a, [700000]);

    const blocked = await adjudicate(tid, { playerId: a, action: 'SAVE_AND_VERIFY', scores: [] });
    expect(blocked.status).toBe(500);
    expect(blocked.body.error).toBe('Add at least one score before verifying this qual.');
    expect((await sessionFor(tid, a))!.scores).toEqual([700000]);

    await adjudicate(tid, { playerId: a, action: 'SAVE', scores: [] });
    const verify = await adjudicate(tid, { playerId: a, action: 'VERIFY' });
    expect(verify.status).toBe(500);
    expect((await sessionFor(tid, a))!.status).toBe('SUBMITTED');
  });

  it('reassign onto a player with a scored or verified qual is refused with a 409 and a clear reason', async () => {
    const tid = await createTournament('rw-reassign');
    const a = await newPlayer('Source A');
    const scored = await newPlayer('Scored B');
    const verified = await newPlayer('Verified C');
    await submitOnline(tid, a, [600000]);
    await submitQualifierScore(tid, scored, 500000);
    await submitQualifierScore(tid, verified, 400000);
    await adjudicate(tid, { playerId: verified, action: 'VERIFY' });

    const toScored = await adjudicate(tid, { playerId: a, action: 'REASSIGN_PLAYER', targetPlayerId: scored });
    expect(toScored.status).toBe(409);
    expect(toScored.body.error).toContain('Scored B already has a qual with 1 score.');

    const toVerified = await adjudicate(tid, { playerId: a, action: 'REASSIGN_PLAYER', targetPlayerId: verified });
    expect(toVerified.status).toBe(409);
    expect(toVerified.body.error).toBe("Verified C's qual is verified. Unverify it on the Review page before reassigning to them.");

    expect((await sessionFor(tid, a))!.scores).toEqual([600000]);
  });

  it('seeds pending quals with a score into draft brackets, but not empty ones', async () => {
    const tid = await createTournament('rw-draft');
    const scored = await newPlayer('Pending Scored');
    const empty = await newPlayer('Pending Empty');
    await submitOnline(tid, scored, [700000]);
    await submitOnline(tid, empty, [650000]);
    await adjudicate(tid, { playerId: empty, action: 'SAVE', scores: [] });

    const full = (await getFullTournament(tid))!;
    const seeded = generateDraftBracketsForTournament(full)[0].bracket.rounds.flatMap(r =>
      r.matches.flatMap(m => [m.player1.player?.id, m.player2.player?.id])
    );
    expect(seeded).toContain(scored);
    expect(seeded).not.toContain(empty);
  });

  it('simulates pending quals only', () => {
    const { submissions } = generateSimulatedQualifiers(baseTournament('rw-sim'), []);
    expect(submissions.length).toBeGreaterThan(0);
    for (const s of submissions) {
      expect(s.status).toBe('SUBMITTED');
      expect(s.verifiedBy).toBeUndefined();
    }
  });
});

describe('Qual review workflow: markup', () => {
  const submittedAt = Date.UTC(2026, 10, 1, 15, 42);

  function session(overrides: Partial<ReviewQueueSessionSummary> = {}): ReviewQueueSessionSummary {
    return {
      tournamentId: 't-1',
      playerId: 'p-1',
      playerName: 'Markup Player',
      submissionSource: 'ONLINE',
      status: 'SUBMITTED',
      authWord: 'ROCKET',
      twitchVodUrl: 'https://twitch.tv/videos/1',
      submittedTwitchId: null,
      submittedTwitchUsername: 'markup',
      identityStatus: 'VERIFIED_MATCH',
      timerLog: { startedAt: submittedAt - 3600_000, elapsedSeconds: 3600, pauses: [] },
      scores: [900000],
      judgeNotes: null,
      submissionIds: ['s-1'],
      runId: 'r-1',
      submittedAt,
      verifiedBy: null,
      verifiedAt: null,
      ...overrides,
    };
  }

  const modal = (s: ReviewQueueSessionSummary) =>
    renderToStaticMarkup(
      <AdjudicationModal isOpen session={s} onClose={() => {}} onAdjudicate={async () => {}} />
    );

  it('AdjudicationModal shows Save and Verify for a pending qual', () => {
    const html = modal(session());
    expect(html).toContain('Save');
    expect(html).toContain('Verify Qual');
    expect(html).not.toContain('Unverify');
  });

  it('AdjudicationModal shows only Unverify for a verified qual', () => {
    const html = modal(session({ status: 'VERIFIED', verifiedBy: 'Judy', verifiedAt: submittedAt }));
    expect(html).toContain('Unverify');
    expect(html).toContain('verified and locked');
    expect(html).not.toContain('Mark DNQ');
  });

  it('AdjudicationModal shows an empty-games notice and disables Verify', () => {
    const html = modal(session({ scores: [], submissionIds: [] }));
    expect(html).toContain('No games recorded.');
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*title="Add at least one score before verifying."/);
  });

  it('AdjudicationModal enables Verify Qual for a pending qual with scores', () => {
    const html = modal(session());
    expect(html).not.toContain('Add at least one score before verifying.');
    expect(html).not.toContain('Save &amp; Verify');
  });

  it('ReviewQueueTable shows the submitted time and no walk-in badge', () => {
    const html = renderToStaticMarkup(
      <ReviewQueueTable
        sessions={[session(), session({ playerId: 'p-2', runId: 'r-2', identityStatus: 'PROVISIONAL_NEW' })]}
        onOpenAdjudicate={() => {}}
        onOpenIdentityModal={() => {}}
      />
    );
    expect(html).toContain('Submitted');
    expect(html).not.toContain('NES Authword');
    expect(html).toContain(formatQualTimestamp(submittedAt));
    expect(html).not.toContain('Walk-In');
    expect(html).not.toContain('Verified Match');
    expect(html).toContain('New Player');
  });

  it('IdentityResolutionModal shows which players already have a qual', () => {
    const html = renderToStaticMarkup(
      <IdentityResolutionModal
        isOpen
        session={session()}
        playersPool={[
          { id: 'p-scored', name: 'Scored', personalBest: 0, playstyle: 'DAS' },
          { id: 'p-empty', name: 'Empty', personalBest: 0, playstyle: 'DAS' },
          { id: 'p-verified', name: 'Verified', personalBest: 0, playstyle: 'DAS' },
          { id: 'p-free', name: 'Free', personalBest: 0, playstyle: 'DAS' },
        ]}
        sessions={[
          session({ playerId: 'p-scored', runId: 'r-s', scores: [1, 2] }),
          session({ playerId: 'p-empty', runId: 'r-e', scores: [] }),
          session({ playerId: 'p-verified', runId: 'r-v', status: 'VERIFIED' }),
        ]}
        onClose={() => {}}
        onResolve={async () => {}}
      />
    );
    expect(html).toContain('Has a qual · 2 scores');
    expect(html).toContain('Has an empty qual');
    expect(html).toContain('Has a verified qual');
  });

  it('VerifyBracketModal warns about pending quals', () => {
    const t: Tournament = {
      ...baseTournament('rw-lock-warning'),
      qualRuns: [
        { id: 'r-1', tournamentId: 't-1', playerId: 'p-1', submissionSource: 'ONLINE', status: 'SUBMITTED', createdAt: submittedAt },
      ],
    };
    const html = renderToStaticMarkup(
      <AuthProvider>
        <OrganizationProvider initialHydrated={true}>
          <TournamentProvider initialTournaments={[t]} initialHydrated={true}>
            <MemoryRouter>
              <VerifyBracketModal isOpen onClose={() => {}} tournament={t} />
            </MemoryRouter>
          </TournamentProvider>
        </OrganizationProvider>
      </AuthProvider>
    );
    expect(html).toContain('data-testid="lock-pending-warning"');
    expect(html).toContain('1 qual is still pending review');
  });
});
