import { describe, it, expect, beforeEach } from 'vitest';
import { Readable } from 'node:stream';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { setupTestDb } from '../../../db/testDb';
import { setDb } from '../../../db';
import { createApiMiddleware } from '../../../server/api';
import { createSessionToken } from '../../../server/pinCrypto';
import { saveFullTournament, getFullTournament } from '../../../api/tournaments';
import { startOnlineQualSession, setOnlineQualsOpen } from '../../../api/qualifiers';
import { seedDefaultOrganizations } from '../../../api/organizations';
import { createPlayer } from '../../../api/players';
import { createEmptyTournament, createDefaultTier } from '../../tournament/defaults';
import { OrganizationProvider } from '../../organizations/store';
import { isOnlineQualsOpen } from '../onlineQualsStatus';
import { OpenQualsCard } from '../components/OpenQualsCard';
import { CompetitorPortalView } from '../components/CompetitorPortalView';
import type { Tournament, QualMode } from '../../tournament/types';

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
  const headers: Record<string, string> = {};
  return {
    setHeader(name: string, val: string) {
      headers[name.toLowerCase()] = val;
    },
    getHeader(name: string) {
      return headers[name.toLowerCase()];
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
  const t = createEmptyTournament({ slug: `oq-${crypto.randomUUID().slice(0, 8)}`, name: 'Online Quals Cup' });
  t.id = crypto.randomUUID();
  t.organizationId = 'org_ctwc';
  t.qualMode = 'HYBRID';
  t.tiers = [createDefaultTier(1, { id: crypto.randomUUID(), playerCount: 4 })];
  return { ...t, ...overrides };
}

describe('isOnlineQualsOpen', () => {
  const base = { qualMode: 'HYBRID' as QualMode, onlineQualsOpen: true, qualsClosed: false, isLocked: false };

  it('is open only for an opted-in ONLINE/HYBRID tournament still in qualifiers', () => {
    expect(isOnlineQualsOpen(base)).toBe(true);
    expect(isOnlineQualsOpen({ ...base, qualMode: 'ONLINE' })).toBe(true);
    expect(isOnlineQualsOpen({ ...base, qualMode: undefined })).toBe(true);
  });

  it('is closed when not opted in, in-person only, quals closed, or brackets locked', () => {
    expect(isOnlineQualsOpen({ ...base, onlineQualsOpen: false })).toBe(false);
    expect(isOnlineQualsOpen({ ...base, onlineQualsOpen: undefined })).toBe(false);
    expect(isOnlineQualsOpen({ ...base, qualMode: 'IN_PERSON' })).toBe(false);
    expect(isOnlineQualsOpen({ ...base, qualsClosed: true })).toBe(false);
    expect(isOnlineQualsOpen({ ...base, isLocked: true })).toBe(false);
  });
});

describe('Online quals open/close (server)', () => {
  let middleware: ReturnType<typeof createApiMiddleware>;

  beforeEach(async () => {
    process.env.SYSTEM_ADMIN_RECOVERY_PIN = '999999';
    const { db } = setupTestDb();
    setDb(db);
    await seedDefaultOrganizations();
    middleware = createApiMiddleware();
  });

  async function call(url: string, body: any, token?: string) {
    const res = createMockRes();
    await middleware(
      createMockReq({
        url,
        method: 'POST',
        body,
        headers: token ? { authorization: `Bearer ${token}` } : {},
      }),
      res as any,
      () => {}
    );
    return res;
  }

  it('new tournaments start closed and reject online runs until opened', async () => {
    const tourney = buildTournament();
    await saveFullTournament(tourney);
    const player = await createPlayer({ name: 'Closed Tester', country: 'US' } as any);

    expect((await getFullTournament(tourney.id))?.onlineQualsOpen).toBe(false);
    await expect(startOnlineQualSession(tourney.id, { playerId: player.id })).rejects.toThrow(
      /Online qualifying is not open/i
    );

    await setOnlineQualsOpen(tourney.id, true);
    const session = await startOnlineQualSession(tourney.id, { playerId: player.id });
    expect(session.status).toBe('IN_PROGRESS');
  });

  it('rejects online runs for in-person tournaments even if the flag was left on', async () => {
    const tourney = buildTournament();
    await saveFullTournament(tourney);
    await setOnlineQualsOpen(tourney.id, true);
    await saveFullTournament({ ...tourney, qualMode: 'IN_PERSON' });
    const player = await createPlayer({ name: 'In Person Tester', country: 'US' } as any);

    await expect(startOnlineQualSession(tourney.id, { playerId: player.id })).rejects.toThrow(
      /not available for in-person/i
    );
  });

  it('POST /online-quals requires a tournament admin and refuses to open in-person tournaments', async () => {
    const hybrid = buildTournament();
    const inPerson = buildTournament({ qualMode: 'IN_PERSON' });
    await saveFullTournament(hybrid);
    await saveFullTournament(inPerson);

    const unauth = await call(`/api/tournaments/${hybrid.id}/online-quals`, { open: true });
    expect(unauth.getStatusCode()).toBe(401);

    const token = createSessionToken({ role: 'TOURNAMENT_ADMIN', tournamentId: hybrid.id });
    const badBody = await call(`/api/tournaments/${hybrid.id}/online-quals`, { open: 'yes' }, token);
    expect(badBody.getStatusCode()).toBe(400);

    const opened = await call(`/api/tournaments/${hybrid.id}/online-quals`, { open: true }, token);
    expect(opened.getStatusCode()).toBe(200);
    expect(opened.getBody().onlineQualsOpen).toBe(true);

    const closed = await call(`/api/tournaments/${hybrid.id}/online-quals`, { open: false }, token);
    expect(closed.getBody().onlineQualsOpen).toBe(false);

    const ipToken = createSessionToken({ role: 'TOURNAMENT_ADMIN', tournamentId: inPerson.id });
    const ipRes = await call(`/api/tournaments/${inPerson.id}/online-quals`, { open: true }, ipToken);
    expect(ipRes.getStatusCode()).not.toBe(200);
    expect((await getFullTournament(inPerson.id))?.onlineQualsOpen).toBe(false);
  });

  it('a stale full-tournament save cannot open or close online quals', async () => {
    const tourney = buildTournament();
    await saveFullTournament(tourney);
    const staleSnapshot = (await getFullTournament(tourney.id))!;

    await setOnlineQualsOpen(tourney.id, true);
    await saveFullTournament({ ...staleSnapshot, onlineQualsOpen: false });
    expect((await getFullTournament(tourney.id))?.onlineQualsOpen).toBe(true);

    await setOnlineQualsOpen(tourney.id, false);
    await saveFullTournament({ ...staleSnapshot, onlineQualsOpen: true });
    expect((await getFullTournament(tourney.id))?.onlineQualsOpen).toBe(false);
  });
});

describe('OpenQualsCard', () => {
  const render = (tournaments: Tournament[]) =>
    renderToStaticMarkup(
      <MemoryRouter>
        <OrganizationProvider>
          <OpenQualsCard tournaments={tournaments} />
        </OrganizationProvider>
      </MemoryRouter>
    );

  it('renders nothing when no tournament has online quals open', () => {
    const html = render([
      buildTournament({ name: 'Not Opened' }),
      buildTournament({ name: 'In Person', qualMode: 'IN_PERSON', onlineQualsOpen: true }),
      buildTournament({ name: 'Locked', onlineQualsOpen: true, isLocked: true }),
    ]);
    expect(html).toBe('');
  });

  it('lists only open tournaments with a Qualify link to each portal', () => {
    const open = buildTournament({ name: 'Open Cup', slug: 'open-cup', onlineQualsOpen: true });
    const closed = buildTournament({ name: 'Closed Cup', slug: 'closed-cup' });
    const html = render([open, closed]);

    expect(html).toContain('Quals Open!');
    expect(html).toContain('Open Cup');
    expect(html).toContain('href="/open-cup/qualify"');
    expect(html).not.toContain('Closed Cup');
  });
});

describe('CompetitorPortalView when online quals are not open', () => {
  it('shows the not-open notice and disables starting a run', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <CompetitorPortalView tournament={buildTournament()} />
      </MemoryRouter>
    );
    expect(html).toContain('Online Qualifying Not Open');
    expect(html).toMatch(/<button type="submit" disabled=""/);
  });

  it('does not show the notice once opened', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <CompetitorPortalView tournament={buildTournament({ onlineQualsOpen: true })} />
      </MemoryRouter>
    );
    expect(html).not.toContain('Online Qualifying Not Open');
  });
});
