import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Readable } from 'node:stream';
import { setupTestDb } from '../../../db/testDb';
import { setDb } from '../../../db';
import { createApiMiddleware } from '../../../server/api';
import { createSessionToken } from '../../../server/pinCrypto';
import { saveFullTournament, getFullTournament } from '../../../api/tournaments';
import { setOnlineQualsOpen } from '../../../api/qualifiers';
import { seedDefaultOrganizations, updateOrganization } from '../../../api/organizations';
import { createPlayer } from '../../../api/players';
import { createEmptyTournament, createDefaultTier } from '../../tournament/defaults';
import {
  buildQualDiscordMessage,
  formatQualResult,
  isDiscordWebhookUrl,
} from '../discordMessages';
import type { Tournament } from '../../tournament/types';
import { runToken } from './runToken';

const TOURNEY_HOOK = 'https://discord.com/api/webhooks/111/tourney-token';
const ORG_HOOK = 'https://discord.com/api/webhooks/222/org-token';

describe('formatQualResult', () => {
  it('# of Maxes: max count with kicker, maxes alone, or kicker alone with no maxes', () => {
    const f = { qualFormat: 'HIGH_SCORE' as const };
    expect(formatQualResult(f, [999999, 1000000, 845123])).toBe('**2x Max** (Kicker: 845,123)');
    expect(formatQualResult(f, [999999, 1200000])).toBe('**2x Max**');
    expect(formatQualResult(f, [700000, 845123])).toBe('Kicker: **845,123**');
  });

  it('Average of X: the average plus every score', () => {
    const f = { qualFormat: 'AVERAGE_OF_X' as const, qualAverageCount: 3 };
    expect(formatQualResult(f, [900000, 800000, 700000])).toBe(
      '**800,000** average (Ao3)\n- 900,000\n- 800,000\n- 700,000'
    );
  });

  it('Points: total with a per-score breakdown, or kicker alone when no points were earned', () => {
    const f = {
      qualFormat: 'POINTS' as const,
      pointsConfig: [
        { minScore: 999999, points: 5 },
        { minScore: 800000, points: 2 },
      ],
    };
    expect(formatQualResult(f, [1000000, 850000, 400000])).toBe(
      '**7 pts**\n- 1,000,000 (5 pts)\n- 850,000 (2 pts)\n- 400,000 (0 pts)'
    );
    expect(formatQualResult(f, [400000, 650000])).toBe('Kicker: **650,000**');
  });

  it('handles a run with no scores', () => {
    expect(formatQualResult({ qualFormat: 'HIGH_SCORE' }, [])).toBe('No scores recorded');
  });
});

describe('buildQualDiscordMessage', () => {
  it('escapes markdown in player and tournament names', () => {
    const msg = buildQualDiscordMessage('START', {
      tournamentName: 'Cup_2026',
      format: { qualFormat: 'HIGH_SCORE' },
      playerName: '**evil**',
    });
    expect(msg).toContain('**\\*\\*evil\\*\\***');
    expect(msg).toContain('**Cup\\_2026**');
  });

  it('puts the formatted result in submit messages', () => {
    const msg = buildQualDiscordMessage('SUBMIT', {
      tournamentName: 'Cup',
      format: { qualFormat: 'AVERAGE_OF_X', qualAverageCount: 2 },
      playerName: 'Sharky',
      scores: [900000, 700000],
      twitchVodUrl: 'https://twitch.tv/videos/1',
      tournamentSlug: 'cup',
    });
    expect(msg).toBe(
      '🏆 **Sharky** submitted their qual for **Cup**: **800,000** average (Ao2)\n- 900,000\n- 700,000\nVOD: https://twitch.tv/videos/1\nQualifiers: <https://matchfoundry.gg/cup/leaderboard>'
    );
  });
});

describe('player notes in the submitted message', () => {
  it('quotes each line, escapes markdown, and sits before the qualifiers link', () => {
    const msg = buildQualDiscordMessage('SUBMIT', {
      tournamentName: 'Cup',
      tournamentSlug: 'cup',
      format: { qualFormat: 'HIGH_SCORE' },
      playerName: 'Sharky',
      scores: [845123],
      playerNotes: '  Stream dropped in game 2\nrestarted *quickly*  ',
    });
    expect(msg).toBe(
      '🏆 **Sharky** submitted their qual for **Cup**: Kicker: **845,123**\nNotes:\n> Stream dropped in game 2\n> restarted \\*quickly\\*\nQualifiers: <https://matchfoundry.gg/cup/leaderboard>'
    );
  });
});

describe('isDiscordWebhookUrl', () => {
  it('accepts Discord webhook URLs only', () => {
    expect(isDiscordWebhookUrl(TOURNEY_HOOK)).toBe(true);
    expect(isDiscordWebhookUrl('https://discordapp.com/api/webhooks/1/abc')).toBe(true);
    expect(isDiscordWebhookUrl('https://ptb.discord.com/api/webhooks/1/abc')).toBe(true);
    expect(isDiscordWebhookUrl('http://discord.com/api/webhooks/1/abc')).toBe(false);
    expect(isDiscordWebhookUrl('https://example.com/api/webhooks/1/abc')).toBe(false);
    expect(isDiscordWebhookUrl('https://discord.com.evil.io/api/webhooks/1/abc')).toBe(false);
    expect(isDiscordWebhookUrl(undefined)).toBe(false);
  });
});

function createMockReq(options: { url: string; method?: string; body?: any; token?: string }) {
  const bodyStr = options.body !== undefined ? JSON.stringify(options.body) : '';
  const req = Readable.from(bodyStr ? [bodyStr] : []) as any;
  req.url = options.url;
  req.method = options.method || 'GET';
  req.headers = options.token ? { authorization: `Bearer ${options.token}` } : {};
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

describe('Discord webhook (server)', () => {
  let middleware: ReturnType<typeof createApiMiddleware>;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    process.env.SYSTEM_ADMIN_RECOVERY_PIN = '999999';
    const { db } = setupTestDb();
    setDb(db);
    await seedDefaultOrganizations();
    middleware = createApiMiddleware();
    fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function call(url: string, opts: { method?: string; body?: any; token?: string } = {}) {
    const res = createMockRes();
    await middleware(createMockReq({ url, method: opts.method || 'POST', ...opts }), res as any, () => {});
    return res;
  }

  async function createTournament(overrides: Partial<Tournament> = {}): Promise<Tournament> {
    const t = createEmptyTournament({ slug: `hook-${crypto.randomUUID().slice(0, 8)}`, name: 'Hook Cup' });
    t.id = crypto.randomUUID();
    t.organizationId = 'org_ctwc';
    t.qualMode = 'ONLINE';
    t.qualFormat = 'HIGH_SCORE';
    t.tiers = [createDefaultTier(1, { id: crypto.randomUUID(), playerCount: 4 })];
    Object.assign(t, overrides);
    await saveFullTournament(t);
    await setOnlineQualsOpen(t.id, true);
    return t;
  }

  const discordPosts = () =>
    fetchMock.mock.calls
      .filter(([url]) => String(url).includes('/api/webhooks/'))
      .map(([url, init]) => ({ url: String(url), body: JSON.parse((init as RequestInit).body as string) }));

  it('announces a start once; resuming or retrying after submitting does not re-announce', async () => {
    const t = await createTournament({ discordWebhookUrl: TOURNEY_HOOK });
    const player = await createPlayer({ name: 'Sharky', country: 'US' } as any);
    const start = () => call(`/api/tournaments/${t.id}/qualify/start`, { body: { playerId: player.id } });

    await start();
    await start(); // page reload resumes the same run
    expect(discordPosts().filter(p => p.body.content.includes('started'))).toHaveLength(1);

    const submit = await call(`/api/tournaments/${t.id}/qualify/submit`, {
      body: { playerId: player.id, resumeToken: await runToken(t.id, player.id), scores: [999999, 845123], twitchVodUrl: 'https://twitch.tv/videos/1' },
    });
    expect(submit.getStatusCode()).toBe(200);
    const submitPost = discordPosts().find(p => p.body.content.includes('submitted'));
    expect(submitPost?.body.content).toContain('**1x Max** (Kicker: 845,123)');
    expect(submitPost?.body.content).toContain(`Qualifiers: <https://matchfoundry.gg/${t.slug}/leaderboard>`);

    await start(); // already submitted: blocked in the portal, and no announcement
    expect(discordPosts().filter(p => p.body.content.includes('started'))).toHaveLength(1);

    const resubmit = await call(`/api/tournaments/${t.id}/qualify/submit`, {
      body: { playerId: player.id, resumeToken: await runToken(t.id, player.id), scores: [1200000], twitchVodUrl: 'https://twitch.tv/videos/2' },
    });
    expect(resubmit.getStatusCode()).toBeGreaterThanOrEqual(400);
    expect(resubmit.getBody().error).toMatch(/already submitted/i);
  });

  it('stores player notes, posts them publicly, and keeps them through judge edits and stale saves', async () => {
    const t = await createTournament({ discordWebhookUrl: TOURNEY_HOOK });
    const player = await createPlayer({ name: 'Noted', country: 'US' } as any);
    await call(`/api/tournaments/${t.id}/qualify/start`, { body: { playerId: player.id } });

    const tooLong = await call(`/api/tournaments/${t.id}/qualify/submit`, {
      body: { playerId: player.id, resumeToken: await runToken(t.id, player.id), scores: [845123], twitchVodUrl: 'https://twitch.tv/videos/1', playerNotes: 'x'.repeat(1001) },
    });
    expect(tooLong.getStatusCode()).toBeGreaterThanOrEqual(400);

    const submit = await call(`/api/tournaments/${t.id}/qualify/submit`, {
      body: { playerId: player.id, resumeToken: await runToken(t.id, player.id), scores: [845123], twitchVodUrl: 'https://twitch.tv/videos/1', playerNotes: 'OBS froze in game 2' },
    });
    expect(submit.getBody().playerNotes).toBe('OBS froze in game 2');
    expect(discordPosts().find(p => p.body.content.includes('submitted'))?.body.content).toContain('> OBS froze in game 2');

    const token = createSessionToken({ role: 'TOURNAMENT_ADMIN', tournamentId: t.id });
    const stale = (await getFullTournament(t.id))!;
    await call(`/api/tournaments/${t.id}/qualify/adjudicate`, {
      token,
      body: { playerId: player.id, action: 'EDIT_AND_VERIFY', scores: [900000], verifiedBy: 'Judge' },
    });
    await saveFullTournament({
      ...stale,
      qualifierSubmissions: (stale.qualifierSubmissions || []).map(s => ({ ...s, playerNotes: undefined })),
    });

    const sessions = (await call(`/api/tournaments/${t.id}/qualify/sessions`, { method: 'GET', token })).getBody();
    const session = sessions.find((s: any) => s.playerId === player.id);
    expect(session.scores).toEqual([900000]);
    expect(session.playerNotes).toBe('OBS froze in game 2');
  });

  it('falls back to the organization webhook and never allows mentions', async () => {
    await updateOrganization('org_ctwc', { discordWebhookUrl: ORG_HOOK } as any);
    const t = await createTournament();
    const player = await createPlayer({ name: '@everyone', country: 'US' } as any);

    await call(`/api/tournaments/${t.id}/qualify/start`, { body: { playerId: player.id } });

    const [post] = discordPosts();
    expect(post.url).toBe(ORG_HOOK);
    expect(post.body.allowed_mentions).toEqual({ parse: [] });
  });

  it('withholds webhook URLs and the encrypted PIN from public reads', async () => {
    await updateOrganization('org_ctwc', { discordWebhookUrl: ORG_HOOK } as any);
    const t = await createTournament({ discordWebhookUrl: TOURNEY_HOOK });

    const publicList = (await call('/api/tournaments', { method: 'GET' })).getBody();
    const publicT = publicList.find((x: Tournament) => x.id === t.id);
    expect(publicT.discordWebhookUrl).toBeUndefined();
    expect(publicT.adminPinEncrypted).toBeUndefined();
    expect((await call(`/api/tournaments/${t.id}`, { method: 'GET' })).getBody().discordWebhookUrl).toBeUndefined();

    const taToken = createSessionToken({ role: 'TOURNAMENT_ADMIN', tournamentId: t.id });
    const managerT = (await call(`/api/tournaments/${t.id}`, { method: 'GET', token: taToken })).getBody();
    expect(managerT.discordWebhookUrl).toBe(TOURNEY_HOOK);

    const publicOrg = (await call('/api/organizations', { method: 'GET' }))
      .getBody()
      .find((o: any) => o.id === 'org_ctwc');
    expect(publicOrg.discordWebhookUrl).toBeUndefined();
    expect(publicOrg.hasDiscordWebhook).toBe(true);

    const sysToken = createSessionToken({ role: 'SYSTEM_ADMIN' } as any);
    const adminOrg = (await call('/api/organizations', { method: 'GET', token: sysToken }))
      .getBody()
      .find((o: any) => o.id === 'org_ctwc');
    expect(adminOrg.discordWebhookUrl).toBe(ORG_HOOK);
  });

  it('a save that omits the webhook (redacted client) keeps it; an explicit empty value clears it', async () => {
    const t = await createTournament({ discordWebhookUrl: TOURNEY_HOOK });
    const { discordWebhookUrl: _omit, ...redacted } = (await getFullTournament(t.id))!;

    await saveFullTournament({ ...redacted, name: 'Renamed' } as Tournament);
    expect((await getFullTournament(t.id))?.discordWebhookUrl).toBe(TOURNEY_HOOK);

    await saveFullTournament({ ...redacted, discordWebhookUrl: '' } as Tournament);
    expect((await getFullTournament(t.id))?.discordWebhookUrl).toBeUndefined();
  });

  it('test endpoint sends a real message, validates URLs, and requires a tournament admin', async () => {
    const t = await createTournament();
    const token = createSessionToken({ role: 'TOURNAMENT_ADMIN', tournamentId: t.id });
    const url = `/api/tournaments/${t.id}/discord-webhook/test`;

    expect((await call(url, { body: { url: TOURNEY_HOOK } })).getStatusCode()).toBe(401);

    const bad = await call(url, { body: { url: 'https://example.com/hook' }, token });
    expect(bad.getStatusCode()).toBe(400);
    expect(discordPosts()).toHaveLength(0);

    const none = await call(url, { body: {}, token });
    expect(none.getStatusCode()).toBe(400);
    expect(none.getBody().error).toMatch(/No webhook configured/i);

    const ok = await call(url, { body: { url: TOURNEY_HOOK }, token });
    expect(ok.getStatusCode()).toBe(200);
    expect(discordPosts()[0].url).toBe(TOURNEY_HOOK);
    expect(discordPosts()[0].body.content).toContain('Test from MatchFoundry');
  });
});
