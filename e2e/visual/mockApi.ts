import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, type Page } from '@playwright/test';
import { generateDoubleEliminationBracket } from '../../src/features/bracket/math';

const FIXTURE_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');

function load(name: string): any {
  return JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, `${name}.json`), 'utf8'));
}

const fixtures = {
  health: load('health'),
  tournaments: load('tournaments'),
  tournament: load('tournament'),
  organizations: load('organizations'),
  players: load('players'),
  sessions: load('sessions'),
  orgTournaments: load('orgTournaments'),
};

export const FIXTURE_SLUG: string = fixtures.tournament.slug;
export const FIXTURE_TIER_SLUG: string = [...fixtures.tournament.tiers].sort(
  (a: any, b: any) => a.priority - b.priority
)[0].slug;

const fixtureOrg = (fixtures.organizations as any[]).find(o => o.id === fixtures.tournament.organizationId);
if (!fixtureOrg) {
  throw new Error(`No organization fixture matches tournament organizationId ${fixtures.tournament.organizationId}.`);
}
export const FIXTURE_ORG_SLUG: string = fixtureOrg.slug;

export const FIXED_TIME = new Date('2026-06-01T12:00:00Z');

export interface MockOptions {
  /** Transforms the full tournament fixture before it is served (GET /api/tournaments/:slugOrId). */
  tournament?: (t: any) => any;
}

/** Serves the first tier as an unplayed 16-player double-elimination bracket, without adding a tier. */
export const DOUBLE_ELIM: MockOptions = {
  tournament: t => {
    const tier = t.tiers.find((x: any) => x.slug === FIXTURE_TIER_SLUG);
    const players = t.playersPool.slice(0, 16).map((p: any, i: number) => ({ id: p.id, name: p.name, seed: i + 1 }));
    tier.bracket = generateDoubleEliminationBracket(players, { tierId: tier.id });
    tier.eliminationType = 'DOUBLE';
    tier.bracketRouting = 'TRADITIONAL_TREE';
    return { ...t, matchScores: {} };
  },
};

/** Serves the fixture tournament with manual seeding, so the seeding manager renders. */
export const MANUAL_SEEDING: MockOptions = {
  tournament: t => ({ ...t, seedingMethod: 'MANUAL', manualSeeds: t.playersPool.map((p: any) => p.id) }),
};

export const ADMIN_SESSION = {
  token: 'visual-test-token',
  role: 'SYSTEM_ADMIN',
  tournamentIds: [],
  tournamentSlugs: [],
  expiresAt: 4102444800000,
};

/** Routes every /api/* request to frozen fixtures. Returns a list that collects unmocked GETs. */
export async function installApiMocks(page: Page, options: MockOptions = {}): Promise<string[]> {
  const unmocked: string[] = [];
  await page.route(
    url => url.pathname.startsWith('/api/'),
    async route => {
      const request = route.request();
      const { pathname } = new URL(request.url());
      if (request.method() !== 'GET') {
        return route.fulfill({ status: 200, json: { success: true } });
      }
      if (pathname === '/api/health') return route.fulfill({ json: fixtures.health });
      if (pathname === '/api/tournaments') return route.fulfill({ json: fixtures.tournaments });
      if (pathname === '/api/players') return route.fulfill({ json: fixtures.players });
      if (pathname === '/api/organizations') return route.fulfill({ json: fixtures.organizations });
      if (/^\/api\/tournaments\/[^/]+\/qualify\/sessions$/.test(pathname)) {
        return route.fulfill({ json: fixtures.sessions });
      }
      const orgTournaments = pathname.match(/^\/api\/organizations\/([^/]+)\/tournaments$/);
      if (orgTournaments && orgTournaments[1] === fixtures.tournament.organizationId) {
        return route.fulfill({ json: fixtures.orgTournaments });
      }
      const single = pathname.match(/^\/api\/tournaments\/([^/]+)$/);
      if (single && (single[1] === fixtures.tournament.slug || single[1] === fixtures.tournament.id)) {
        return route.fulfill({
          json: options.tournament ? options.tournament(structuredClone(fixtures.tournament)) : fixtures.tournament,
        });
      }
      unmocked.push(`GET ${pathname}`);
      return route.fulfill({ status: 404, json: { error: `visual mock: unmocked GET ${pathname}` } });
    }
  );
  return unmocked;
}

export async function prepare(page: Page, admin: boolean, options: MockOptions = {}): Promise<string[]> {
  const unmocked = await installApiMocks(page, options);
  await page.clock.setFixedTime(FIXED_TIME);
  if (admin) {
    await page.addInitScript(session => {
      window.localStorage.setItem('tm_admin_auth', JSON.stringify(session));
    }, ADMIN_SESSION);
  }
  return unmocked;
}

export async function settle(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');
  await expect(page.getByText(/^Loading/)).toHaveCount(0);
  await page.evaluate(() => document.fonts.ready);
}
