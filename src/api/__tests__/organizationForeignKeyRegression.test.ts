import { describe, it, expect, beforeEach } from 'vitest';
import { setupTestDb } from '../../db/testDb';
import { setDb } from '../../db';
import {
  listOrganizations,
  getOrganizationById,
  getOrganizationBySlug,
  createOrganization,
  updateOrganization,
  deleteOrganization,
} from '../organizations';
import { createTournament, getFullTournament, saveFullTournament } from '../tournaments';
import {
  generateTraditionalBracket,
  generateDoubleEliminationBracket,
} from '../../features/bracket/math';
import type { Tournament, PlayerProfile } from '../../features/tournament/types';

describe('Organization Table & Foreign Key Enforcements (Regression)', () => {
  beforeEach(() => {
    const { db } = setupTestDb();
    setDb(db);
  });

  describe('1. Foreign Key Constraint Enforcement', () => {
    it('fails when creating a tournament with a non-existent organization_id', async () => {
      await expect(
        createTournament({
          name: 'Orphan Tournament',
          organizationId: 'org_does_not_exist',
          qualFormat: 'HIGH_SCORE',
          tiers: [{ name: 'Gold', bracketType: 'TRADITIONAL', numPlayers: 8, priorityOrder: 1 }],
        })
      ).rejects.toThrow();
    });

    it('succeeds when creating a tournament attached to a valid organization', async () => {
      const { tournament, tiers } = await createTournament({
        name: 'CTWC Main Event',
        organizationId: 'org_ctwc',
        qualFormat: 'HIGH_SCORE',
        tiers: [{ name: 'Gold', bracketType: 'TRADITIONAL', numPlayers: 8, priorityOrder: 1 }],
      });

      expect(tournament.id).toBeDefined();
      expect(tournament.organizationId).toBe('org_ctwc');
      expect(tiers.length).toBe(1);

      const full = await getFullTournament(tournament.id);
      expect(full?.organizationId).toBe('org_ctwc');
    });

    it('prevents deleting an organization when tournaments are attached (RESTRICT constraint)', async () => {
      await createTournament({
        name: 'Active Championship',
        organizationId: 'org_ctm',
        qualFormat: 'HIGH_SCORE',
        tiers: [{ name: 'Masters', bracketType: 'TRADITIONAL', numPlayers: 8, priorityOrder: 1 }],
      });

      const result = await deleteOrganization('org_ctm');
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/active tournaments/i);

      // Verify org still exists
      const org = await getOrganizationById('org_ctm');
      expect(org).toBeDefined();
      expect(org?.id).toBe('org_ctm');
    });

    it('allows deleting an organization after its tournaments are deleted', async () => {
      const newOrg = await createOrganization({
        name: 'Temporary League',
        slug: 'temp-league',
      });

      const { tournament } = await createTournament({
        name: 'Temp Tourney',
        organizationId: newOrg.id,
        qualFormat: 'HIGH_SCORE',
      });

      // Cannot delete while attached
      const blockedResult = await deleteOrganization(newOrg.id);
      expect(blockedResult.success).toBe(false);

      // Delete tournament first
      const { deleteTournament } = await import('../tournaments');
      await deleteTournament(tournament.id);

      // Now deletion succeeds
      const deletedResult = await deleteOrganization(newOrg.id);
      expect(deletedResult.success).toBe(true);

      const check = await getOrganizationById(newOrg.id);
      expect(check).toBeNull();
    });
  });

  describe('2. Organizations CRUD Operations', () => {
    it('lists seeded default organizations', async () => {
      const orgs = await listOrganizations();
      expect(orgs.length).toBeGreaterThanOrEqual(2);
      expect(orgs.some(o => o.id === 'org_ctwc')).toBe(true);
      expect(orgs.some(o => o.id === 'org_ctm')).toBe(true);
    });

    it('finds organization by slug', async () => {
      const ctwc = await getOrganizationBySlug('ctwc');
      expect(ctwc).toBeDefined();
      expect(ctwc?.name).toBe('Classic Tetris World Championship');
    });

    it('creates and updates organizations', async () => {
      const created = await createOrganization({
        name: 'European Tetris Championship',
        slug: 'ctc-eu',
        brandColor: '#0055A5',
      });

      expect(created.id).toBeDefined();
      expect(created.slug).toBe('ctc-eu');
      expect(created.brandColor).toBe('#0055A5');

      const updated = await updateOrganization(created.id, {
        name: 'Classic Tetris European Championship',
        website: 'https://ctc-eu.com',
      });

      expect(updated?.name).toBe('Classic Tetris European Championship');
      expect(updated?.website).toBe('https://ctc-eu.com');
    });
  });

  describe('3. Multi-Bracket Variant Coverage with Host Organizations', () => {
    let dummyPlayers: PlayerProfile[] = [];

    beforeEach(async () => {
      dummyPlayers = [];
      for (let i = 0; i < 16; i++) {
        const p = await (await import('../players')).createPlayer({
          name: `Competitor_${i + 1}`,
          country: 'US',
          personalBest: 1000000 - i * 10000,
          playstyle: 'Rolling',
        });
        dummyPlayers.push({
          id: p.id,
          name: p.name,
          country: p.country || undefined,
          avatarType: p.avatarType,
          personalBest: p.personalBest,
          playstyle: (p.playstyle as any) || 'Rolling',
        });
      }
    });

    it('persists Single Elimination Traditional with host organization', async () => {
      const tierId = crypto.randomUUID();
      const tourney: Tournament = {
        id: crypto.randomUUID(),
        organizationId: 'org_ctwc',
        slug: 'single-trad',
        name: 'CTWC Single Traditional',
        location: 'Portland, OR',
        qualFormat: 'HIGH_SCORE',
        isLocked: false,
        playersPool: dummyPlayers.slice(0, 8),
        qualifierSubmissions: [],
        tournamentPlayers: {},
        matchScores: {},
        tiers: [
          {
            id: tierId,
            slug: 'gold',
            name: 'Gold',
            priority: 1,
            bracketType: 'TRADITIONAL',
            eliminationType: 'SINGLE',
            playerCount: 8,
            bestOf: 5,
            isLocked: false,
            primaryColor: '#ffc905',
            secondaryColor: '#705b33',
            bracket: generateTraditionalBracket(
              dummyPlayers.slice(0, 8).map((p, i) => ({ id: p.id, name: p.name, seed: i + 1 })),
              { tierId, bestOf: 5 }
            ),
          },
        ],
      };

      const saved = await saveFullTournament(tourney);
      expect(saved.organizationId).toBe('org_ctwc');

      const loaded = await getFullTournament(saved.id);
      expect(loaded?.organizationId).toBe('org_ctwc');
      expect(loaded?.tiers[0].bracketType).toBe('TRADITIONAL');
    });

    it('persists Double Elimination Variants (Traditional, Flat Staged, Accelerated Hybrid)', async () => {
      const variants: Array<{
        routing: 'TRADITIONAL_TREE' | 'FLAT_STAGED' | 'ACCELERATED_HYBRID';
        type: 'TRADITIONAL' | 'FLAT';
      }> = [
        { routing: 'TRADITIONAL_TREE', type: 'TRADITIONAL' },
        { routing: 'FLAT_STAGED', type: 'FLAT' },
        { routing: 'ACCELERATED_HYBRID', type: 'TRADITIONAL' },
      ];

      for (const variant of variants) {
        const tierId = crypto.randomUUID();
        const tourney: Tournament = {
          id: crypto.randomUUID(),
          organizationId: 'org_ctm',
          slug: `double-${variant.routing.toLowerCase()}`,
          name: `CTM Double Elim (${variant.routing})`,
          location: 'Online',
          qualFormat: 'AVERAGE_OF_X',
          qualAverageCount: 3,
          isLocked: false,
          playersPool: dummyPlayers.slice(0, 16),
          qualifierSubmissions: [],
          tournamentPlayers: {},
          matchScores: {},
          tiers: [
            {
              id: tierId,
              slug: 'champ',
              name: `${variant.routing} Tier`,
              priority: 1,
              bracketType: variant.type,
              eliminationType: 'DOUBLE',
              bracketRouting: variant.routing,
              finalsCutoff: 4,
              playerCount: 16,
              bestOf: 3,
              isLocked: false,
              primaryColor: '#38bdf8',
              secondaryColor: '#0369a1',
              bracket: generateDoubleEliminationBracket(
                dummyPlayers.slice(0, 16).map((p, i) => ({ id: p.id, name: p.name, seed: i + 1 })),
                { tierId, bestOf: 3, bracketRouting: variant.routing, finalsCutoff: 4 }
              ),
            },
          ],
        };

        const saved = await saveFullTournament(tourney);
        expect(saved.organizationId).toBe('org_ctm');

        const loaded = await getFullTournament(saved.id);
        expect(loaded?.organizationId).toBe('org_ctm');
        expect(loaded?.tiers[0].bracketRouting).toBe(variant.routing);
      }
    });
  });
});
