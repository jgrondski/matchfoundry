import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { Readable } from 'node:stream';
import { setupTestDb } from '../../../db/testDb';
import { setDb } from '../../../db';
import { createApiMiddleware } from '../../../server/api';
import { createSessionToken } from '../../../server/pinCrypto';
import { saveFullTournament, getFullTournament } from '../../../api/tournaments';
import { seedDefaultOrganizations } from '../../../api/organizations';
import { createEmptyTournament, createDefaultTier } from '../../tournament/defaults';
import { generateSimulatedQualifiers } from '../../tournament/simulation';
import { generateDraftBracketsForTournament, getPlayerQualifierStatus } from '../scoring';
import { LeaderboardTable } from '../components/LeaderboardTable';
import { PlayerDetailDrawer } from '../components/PlayerDetailDrawer';
import { AuthProvider } from '../../auth/AuthContext';
import { TournamentProvider } from '../../tournament/store';
import type { Tournament, PlayerProfile } from '../../tournament/types';

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

function qualTournament(): Tournament {
  const t = createEmptyTournament({ slug: 'quals-open', name: 'Quals Open' });
  t.id = crypto.randomUUID();
  t.organizationId = 'org_ctwc';
  t.isLocked = false;
  t.qualsClosed = false;
  t.seedingMethod = 'QUALIFIERS';
  t.tiers = [createDefaultTier(1, { id: crypto.randomUUID(), playerCount: 8 })];
  return t;
}

function renderWithProviders(tournament: Tournament, element: React.ReactElement) {
  return renderToStaticMarkup(
    React.createElement(
      MemoryRouter,
      null,
      React.createElement(
        AuthProvider as any,
        null,
        React.createElement(
          TournamentProvider as any,
          { initialTournaments: [tournament], initialHydrated: true },
          element
        )
      )
    )
  );
}

describe('OBS qualifier overlay timer', () => {
  it('renders the read-only qual timer on the OBS leaderboard while quals are open', () => {
    const t = qualTournament();
    const html = renderWithProviders(t, React.createElement(LeaderboardTable, { tournament: t, isObsMode: true }));
    expect(html).toContain('data-testid="obs-qual-timer-hud"');
  });
});

describe('Draft bracket placeholder seeds are not competitors', () => {
  const registered: PlayerProfile = { id: crypto.randomUUID(), name: 'Real Player', personalBest: 0, playstyle: 'DAS' };
  const placeholder: PlayerProfile = { id: 'placeholder-seed-tier-5', name: 'Seed 5', personalBest: 0, playstyle: 'DAS' };

  it('only offers qual score entry for registered competitors', () => {
    const t = { ...qualTournament(), playersPool: [registered] };
    const drawer = (player: PlayerProfile) =>
      renderWithProviders(
        t,
        React.createElement(PlayerDetailDrawer, { isOpen: true, onClose: () => {}, player, tournament: t, canManage: true })
      );
    expect(drawer(registered)).toContain('Record Attempt Score');
    expect(drawer(placeholder)).not.toContain('Record Attempt Score');
  });
});

describe('Qualifier API guards and simulation', () => {
  let middleware: ReturnType<typeof createApiMiddleware>;

  beforeEach(async () => {
    process.env.SYSTEM_ADMIN_RECOVERY_PIN = '999999';
    const { db } = setupTestDb();
    setDb(db);
    await seedDefaultOrganizations();
    middleware = createApiMiddleware();
  });

  async function call(url: string, method: string, token: string, body?: any) {
    const res = createMockRes();
    await middleware(createMockReq({ url, method, body, headers: { authorization: `Bearer ${token}` } }), res as any, () => {});
    return res;
  }

  it('rejects a qualifier score for a placeholder seed with a 400', async () => {
    const t = qualTournament();
    await saveFullTournament(t);
    const token = createSessionToken({ role: 'TOURNAMENT_ADMIN', tournamentId: t.id });
    const res = await call(`/api/tournaments/${t.id}/qualifiers`, 'POST', token, {
      playerId: `placeholder-seed-${t.tiers[0].id}-5`,
      score: 500000,
    });
    expect(res.getStatusCode()).toBe(400);
  });

  it('simulates pending in-person runs', () => {
    const t = qualTournament();
    const { submissions } = generateSimulatedQualifiers(t, []);
    expect(submissions.length).toBeGreaterThan(0);
    for (const s of submissions) {
      expect(s).toMatchObject({ status: 'SUBMITTED', submissionSource: 'IN_PERSON' });
      expect(s.verifiedBy).toBeUndefined();
    }
  });

  it('clear quals then simulate quals yields a real draft bracket preview, even with no global players', async () => {
    const t = qualTournament();
    await saveFullTournament(t);
    const token = createSessionToken({ role: 'SYSTEM_ADMIN' } as any);

    for (const [sub, method] of [['simulate/seed-quals', 'POST'], ['qualifiers', 'DELETE'], ['simulate/seed-quals', 'POST']]) {
      expect((await call(`/api/tournaments/${t.id}/${sub}`, method, token)).getStatusCode()).toBe(200);
    }

    const loaded = (await getFullTournament(t.id))!;
    const pool = loaded.playersPool || [];
    expect(pool.length).toBeGreaterThanOrEqual(8);
    expect((loaded.qualifierSubmissions || []).length).toBeGreaterThan(0);
    for (const p of pool) {
      expect(getPlayerQualifierStatus(loaded, p.id)).toBe('awaiting verification');
    }

    // The preview page recomputes draft brackets client-side before lock (useBracketTier)
    const preview = generateDraftBracketsForTournament(loaded)[0].bracket;
    const slotIds = preview.rounds
      .flatMap(r => r.matches.flatMap(m => [m.player1.player?.id, m.player2.player?.id]))
      .filter((id): id is string => Boolean(id));
    const poolIds = new Set(pool.map(p => p.id));
    expect(slotIds.filter(id => id.startsWith('placeholder-'))).toHaveLength(0);
    expect(slotIds.filter(id => poolIds.has(id)).length).toBe(8);
  });
});
