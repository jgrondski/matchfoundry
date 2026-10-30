import type { APIRequestContext } from '@playwright/test';
import { createEmptyTournament, createDefaultTier } from '../../src/features/tournament/defaults';
import type { Tournament } from '../../src/features/tournament/types';

/** Slug prefix for every tournament the e2e suite creates. Anything with it is disposable. */
export const E2E_SLUG_PREFIX = 'e2e-';
/** Name prefix for every player the e2e suite creates, including Journey 5's runner. */
export const E2E_PLAYER_PREFIX = 'E2E_';

export interface TestTournament {
  id: string;
  name: string;
  slug: string;
}

export interface JourneyTournaments {
  /** Unlocked, one Gold tier. Used for spectator, route-gating and PIN delegation journeys. */
  primary: TestTournament;
  /** Unlocked, one Gold tier. Shares a PIN with `primary` in the shared-PIN journey. */
  secondary: TestTournament;
  /** Unlocked HYBRID tournament with online qualifying open. Never given a tournament PIN. */
  online: TestTournament;
}

export async function loginSystemAdmin(request: APIRequestContext, pin: string): Promise<string> {
  const res = await request.post('/api/auth/pin', { data: { pin } });
  const body = await res.json();
  if (!res.ok() || !body.token) {
    throw new Error(`System admin login failed (${res.status()}). Check SYSTEM_ADMIN_RECOVERY_PIN in .env.`);
  }
  return body.token;
}

/**
 * Deletes every tournament whose slug starts with E2E_SLUG_PREFIX and every player whose name starts
 * with E2E_PLAYER_PREFIX, including leftovers from aborted runs. Tournaments go first so the players
 * are no longer attached to anything.
 */
export async function deleteTestData(request: APIRequestContext, token: string): Promise<void> {
  const res = await request.get('/api/tournaments', { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok()) throw new Error(`GET /api/tournaments failed (${res.status()})`);
  const all: Array<{ id: string; slug: string }> = await res.json();
  for (const t of all.filter(t => t.slug.startsWith(E2E_SLUG_PREFIX))) {
    const del = await request.delete(`/api/tournaments/${t.id}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!del.ok()) throw new Error(`DELETE /api/tournaments/${t.slug} failed (${del.status()})`);
  }

  const playersRes = await request.get('/api/players');
  if (!playersRes.ok()) throw new Error(`GET /api/players failed (${playersRes.status()})`);
  const players: Array<{ id: string; name: string }> = await playersRes.json();
  for (const p of players.filter(p => p.name.startsWith(E2E_PLAYER_PREFIX))) {
    const del = await request.delete(`/api/players/${p.id}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!del.ok()) throw new Error(`DELETE /api/players/${p.name} failed (${del.status()})`);
  }
}

async function createTournament(
  request: APIRequestContext,
  token: string,
  overrides: Partial<Tournament>
): Promise<TestTournament> {
  const tournament = createEmptyTournament({
    qualFormat: 'HIGH_SCORE',
    qualMode: 'HYBRID',
    tiers: [createDefaultTier(1)],
    ...overrides,
  });
  const res = await request.post('/api/tournaments', {
    headers: { Authorization: `Bearer ${token}` },
    data: tournament,
  });
  if (!res.ok()) throw new Error(`POST /api/tournaments (${tournament.slug}) failed (${res.status()})`);
  const saved: Tournament = await res.json();
  return { id: saved.id, name: saved.name, slug: saved.slug };
}

/**
 * Creates the three tournaments the golden journeys run against, plus one global player so the
 * player directory is never in its empty state, after removing earlier e2e data. Tournament names
 * are distinct words so role-name regexes never overlap.
 */
export async function createJourneyTournaments(
  request: APIRequestContext,
  token: string
): Promise<JourneyTournaments> {
  await deleteTestData(request, token);
  const runId = Date.now().toString(36);

  const player = await request.post('/api/players', {
    headers: { Authorization: `Bearer ${token}` },
    data: { name: `${E2E_PLAYER_PREFIX}Player_${runId}`, country: 'US' },
  });
  if (!player.ok()) throw new Error(`POST /api/players failed (${player.status()})`);

  const primary = await createTournament(request, token, {
    name: `E2E Alpha ${runId}`,
    slug: `${E2E_SLUG_PREFIX}alpha-${runId}`,
  });
  const secondary = await createTournament(request, token, {
    name: `E2E Bravo ${runId}`,
    slug: `${E2E_SLUG_PREFIX}bravo-${runId}`,
  });
  const online = await createTournament(request, token, {
    name: `E2E Charlie ${runId}`,
    slug: `${E2E_SLUG_PREFIX}charlie-${runId}`,
  });

  const open = await request.post(`/api/tournaments/${online.id}/online-quals`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { open: true },
  });
  if (!open.ok()) throw new Error(`Opening online quals on ${online.slug} failed (${open.status()})`);

  return { primary, secondary, online };
}
