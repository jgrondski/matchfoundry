import { describe, it, expect, beforeEach } from 'vitest';
import { setupTestDb } from '../../../db/testDb';
import { setDb } from '../../../db';
import { saveFullTournament, getFullTournament } from '../../../api/tournaments';
import { seedDefaultOrganizations } from '../../../api/organizations';
import { createEmptyTournament, createDefaultTier } from '../defaults';
import { filterFrontPageTournaments } from '../tournamentVisibility';
import type { Tournament } from '../types';

function buildTournament(slug: string, overrides: Partial<Tournament> = {}): Tournament {
  const t = createEmptyTournament({ slug, name: slug });
  t.id = crypto.randomUUID();
  t.organizationId = 'org_ctwc';
  t.tiers = [createDefaultTier(1, { id: crypto.randomUUID(), playerCount: 8 })];
  return { ...t, ...overrides };
}

describe('filterFrontPageTournaments', () => {
  const live: { id: string; isTest?: boolean } = { id: 'live', isTest: false };
  const legacy: { id: string; isTest?: boolean } = { id: 'legacy' };
  const test: { id: string; isTest?: boolean } = { id: 'test', isTest: true };

  it('hides test tournaments by default and keeps tournaments with no flag', () => {
    expect(filterFrontPageTournaments([live, legacy, test], { showTest: false }).map(t => t.id)).toEqual([
      'live',
      'legacy',
    ]);
  });

  it('lists test tournaments when the admin toggle is on', () => {
    expect(filterFrontPageTournaments([live, test], { showTest: true }).map(t => t.id)).toEqual(['live', 'test']);
  });
});

describe('Test tournament flag persistence', () => {
  beforeEach(async () => {
    const { db } = setupTestDb();
    setDb(db);
    await seedDefaultOrganizations();
  });

  it('round-trips isTest through the tournament metadata', async () => {
    const saved = await saveFullTournament(buildTournament('flag-roundtrip', { isTest: true }));
    expect((await getFullTournament(saved.id))?.isTest).toBe(true);

    await saveFullTournament({ ...saved, isTest: false });
    expect((await getFullTournament(saved.id))?.isTest).toBe(false);
  });

  it('keeps the stored flag when a save omits it (older clients)', async () => {
    const saved = await saveFullTournament(buildTournament('flag-omitted', { isTest: true }));
    const { isTest: _omitted, ...withoutFlag } = saved;
    await saveFullTournament(withoutFlag as Tournament);
    expect((await getFullTournament(saved.id))?.isTest).toBe(true);
  });

  it('defaults to a live tournament', async () => {
    const saved = await saveFullTournament(buildTournament('flag-default'));
    expect((await getFullTournament(saved.id))?.isTest).toBe(false);
  });
});
