import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';

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
};

export const FIXTURE_SLUG: string = fixtures.tournament.slug;
export const FIXTURE_TIER_SLUG: string = [...fixtures.tournament.tiers].sort(
  (a: any, b: any) => a.priority - b.priority
)[0].slug;

export const ADMIN_SESSION = {
  token: 'visual-test-token',
  role: 'SYSTEM_ADMIN',
  tournamentIds: [],
  tournamentSlugs: [],
  expiresAt: 4102444800000,
};

/** Routes every /api/* request to frozen fixtures. Returns a list that collects unmocked GETs. */
export async function installApiMocks(page: Page): Promise<string[]> {
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
      const single = pathname.match(/^\/api\/tournaments\/([^/]+)$/);
      if (single && (single[1] === fixtures.tournament.slug || single[1] === fixtures.tournament.id)) {
        return route.fulfill({ json: fixtures.tournament });
      }
      unmocked.push(`GET ${pathname}`);
      return route.fulfill({ status: 404, json: { error: `visual mock: unmocked GET ${pathname}` } });
    }
  );
  return unmocked;
}
