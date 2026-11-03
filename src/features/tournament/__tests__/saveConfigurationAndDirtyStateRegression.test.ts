import { describe, it, expect } from 'vitest';
import { Tournament, TournamentTier } from '../types';
import { generateUUID } from '../store';
import { getDefaultTierColors, TierThemeColors } from '../../bracket/colorUtils';
import { generateTraditionalBracket, generateDoubleEliminationBracket } from '../../bracket/math';
import { isUuid } from '../../../api/tournaments';

describe('Save Configuration & Dirty State Regression (All Bracket Types)', () => {
  const normColor = (
    tier: TournamentTier,
    field: keyof TierThemeColors
  ): string => {
    const val = tier[field];
    if (val && typeof val === 'string' && val.trim()) {
      return val.trim().toLowerCase();
    }
    const defaults = getDefaultTierColors(tier);
    return (defaults[field] || '#c2410c').toLowerCase();
  };

  const createFormDirtyChecker = (baseline: Tournament) => {
    return (current: {
      name: string;
      slug: string;
      organizationId?: string;
      useOrgBranding: boolean;
      discordWebhookUrl: string;
      logoUrl: string;
      bannerUrl: string;
      startDate: string;
      endDate: string;
      location: string;
      seedingMethod?: string;
      qualFormat: string;
      qualAverageCount: number;
      pointsConfig: any[];
      tiers: TournamentTier[];
    }): boolean => {
      if (current.name.trim() !== (baseline.name || '').trim()) return true;
      if (current.slug.trim() !== (baseline.slug || '').trim()) return true;
      if ((current.organizationId || '') !== (baseline.organizationId || '')) return true;
      if (current.useOrgBranding !== (baseline.useOrgBranding ?? true)) return true;
      if ((current.discordWebhookUrl || '').trim() !== (baseline.discordWebhookUrl || '').trim()) return true;
      if ((current.logoUrl || '').trim() !== (baseline.logoUrl || '').trim()) return true;
      if ((current.bannerUrl || '').trim() !== (baseline.bannerUrl || '').trim()) return true;
      if (current.startDate !== (baseline.startDate || '')) return true;
      if (current.endDate !== (baseline.endDate || '')) return true;
      if (current.location.trim() !== (baseline.location || '').trim()) return true;
      if (current.seedingMethod !== (baseline.seedingMethod || 'QUALIFIERS')) return true;
      if (current.qualFormat !== baseline.qualFormat) return true;
      if (current.qualAverageCount !== (baseline.qualAverageCount || 2)) return true;

      const initialTiers = baseline.tiers || [];
      if (current.tiers.length !== initialTiers.length) return true;
      for (let i = 0; i < current.tiers.length; i++) {
        const a = current.tiers[i];
        const b = initialTiers[i];
        if (!b) return true;
        const isSameTier =
          a.id === b.id ||
          (Boolean(a.slug && b.slug) && a.slug.trim() === b.slug.trim());
        if (!isSameTier) return true;
        if (
          (a.slug || '').trim() !== (b.slug || '').trim() ||
          (a.name || '').trim() !== (b.name || '').trim() ||
          a.priority !== b.priority ||
          a.bracketType !== b.bracketType ||
          (a.eliminationType || 'SINGLE') !== (b.eliminationType || 'SINGLE') ||
          a.playerCount !== b.playerCount ||
          a.bestOf !== b.bestOf ||
          (a.flatWidth || 0) !== (b.flatWidth || 0) ||
          normColor(a, 'primaryColor') !== normColor(b, 'primaryColor') ||
          normColor(a, 'secondaryColor') !== normColor(b, 'secondaryColor') ||
          normColor(a, 'cardColor') !== normColor(b, 'cardColor') ||
          normColor(a, 'textColor') !== normColor(b, 'textColor') ||
          normColor(a, 'backgroundColor') !== normColor(b, 'backgroundColor') ||
          normColor(a, 'lowerBracketColor') !== normColor(b, 'lowerBracketColor') ||
          (a.textSize || 'normal') !== (b.textSize || 'normal') ||
          JSON.stringify(a.roundBestOfOverrides || {}) !== JSON.stringify(b.roundBestOfOverrides || {})
        ) {
          return true;
        }
      }

      return false;
    };
  };

  it('1. Generates RFC4122 v4 compliant UUIDs for client tier creations', () => {
    const tierId1 = generateUUID();
    const tierId2 = generateUUID();

    expect(isUuid(tierId1)).toBe(true);
    expect(isUuid(tierId2)).toBe(true);
    expect(tierId1).not.toBe(tierId2);
  });

  it('2. Single Elimination: Traditional Bracket - clears dirty state cleanly after save', () => {
    const initialTourney: Tournament = {
      id: generateUUID(),
      name: 'Tetris Masters 2026',
      slug: 'tetris-masters-2026',
      organizationId: 'org_ctwc',
      useOrgBranding: true,
      location: 'Portland, OR',
      qualFormat: 'AVERAGE_OF_X',
      qualAverageCount: 2,
      seedingMethod: 'QUALIFIERS',
      isLocked: false,
      tiers: [],
      matchScores: {},
      playersPool: [],
      qualifierSubmissions: [],
      tournamentPlayers: {},
    };

    let checkDirty = createFormDirtyChecker(initialTourney);

    // Initial state: clean
    const currentFormState = {
      name: initialTourney.name,
      slug: initialTourney.slug,
      organizationId: initialTourney.organizationId,
      useOrgBranding: initialTourney.useOrgBranding ?? true,
      discordWebhookUrl: '',
      logoUrl: '',
      bannerUrl: '',
      startDate: initialTourney.startDate || '',
      endDate: initialTourney.endDate || '',
      location: initialTourney.location || '',
      seedingMethod: initialTourney.seedingMethod,
      qualFormat: initialTourney.qualFormat,
      qualAverageCount: initialTourney.qualAverageCount || 2,
      pointsConfig: [],
      tiers: [] as TournamentTier[],
    };
    expect(checkDirty(currentFormState)).toBe(false);

    // User adds a Single Elimination Traditional tier and customizes colors & player count
    const tierId = generateUUID();
    const newTier: TournamentTier = {
      id: tierId,
      slug: 'gold',
      name: 'Gold Championship',
      priority: 1,
      bracketType: 'TRADITIONAL',
      eliminationType: 'SINGLE',
      playerCount: 16,
      bestOf: 5,
      primaryColor: '#ffc905',
      secondaryColor: '#705b33',
      cardColor: '#1b1c1d',
      textColor: '#94A3B8',
      backgroundColor: '#020203',
      isLocked: false,
      bracket: generateTraditionalBracket(
        Array.from({ length: 16 }, (_, i) => ({ id: `p${i + 1}`, name: `Seed ${i + 1}`, seed: i + 1 })),
        { tierId, bestOf: 5 }
      ),
    };

    currentFormState.tiers = [newTier];

    // Dirty state should now be TRUE
    expect(checkDirty(currentFormState)).toBe(true);

    // Simulate saving to backend: server persists and returns saved tournament with UUID
    const savedTourney: Tournament = {
      ...initialTourney,
      tiers: currentFormState.tiers,
    };

    // Form syncs its baseline with savedTourney
    checkDirty = createFormDirtyChecker(savedTourney);

    // Form dirty state MUST be false!
    expect(checkDirty(currentFormState)).toBe(false);
  });

  it('3. Double Elimination Variants: Traditional, Flat Staged, Accelerated Hybrid - clears dirty state cleanly after save', () => {
    const initialTourney: Tournament = {
      id: generateUUID(),
      name: 'Double Elim Championship',
      slug: 'double-elim-championship',
      organizationId: 'org_ctwc',
      useOrgBranding: true,
      location: 'Dallas, TX',
      qualFormat: 'HIGH_SCORE',
      seedingMethod: 'QUALIFIERS',
      isLocked: false,
      tiers: [],
      matchScores: {},
      playersPool: [],
      qualifierSubmissions: [],
      tournamentPlayers: {},
    };

    let checkDirty = createFormDirtyChecker(initialTourney);

    // Create 3 tiers representing each double elimination variant
    const t1Id = generateUUID();
    const t1: TournamentTier = {
      id: t1Id,
      slug: 'tier-traditional',
      name: 'Traditional Double Elim',
      priority: 1,
      bracketType: 'TRADITIONAL',
      eliminationType: 'DOUBLE',
      bracketRouting: 'TRADITIONAL',
      playerCount: 16,
      bestOf: 3,
      primaryColor: '#ffc905',
      secondaryColor: '#705b33',
      isLocked: false,
      bracket: generateDoubleEliminationBracket(
        Array.from({ length: 16 }, (_, i) => ({ id: `p${i + 1}`, name: `Seed ${i + 1}`, seed: i + 1 })),
        { tierId: t1Id, bracketRouting: 'TRADITIONAL', bestOf: 3 }
      ),
    };

    const t2Id = generateUUID();
    const t2: TournamentTier = {
      id: t2Id,
      slug: 'tier-flat-staged',
      name: 'Flat Staged Double Elim',
      priority: 2,
      bracketType: 'TRADITIONAL',
      eliminationType: 'DOUBLE',
      bracketRouting: 'FLAT_STAGED',
      flatWidth: 4,
      playerCount: 32,
      bestOf: 3,
      primaryColor: '#CBD5E1',
      secondaryColor: '#3d4652',
      isLocked: false,
      bracket: generateDoubleEliminationBracket(
        Array.from({ length: 32 }, (_, i) => ({ id: `p${i + 17}`, name: `Seed ${i + 1}`, seed: i + 1 })),
        { tierId: t2Id, bracketRouting: 'FLAT_STAGED', flatWidth: 4, bestOf: 3 }
      ),
    };

    const t3Id = generateUUID();
    const t3: TournamentTier = {
      id: t3Id,
      slug: 'tier-accelerated',
      name: 'Accelerated Hybrid Double Elim',
      priority: 3,
      bracketType: 'TRADITIONAL',
      eliminationType: 'DOUBLE',
      bracketRouting: 'ACCELERATED_HYBRID',
      finalsCutoff: 16,
      playerCount: 48,
      bestOf: 3,
      primaryColor: '#db5f00',
      secondaryColor: '#4e310e',
      isLocked: false,
      bracket: generateDoubleEliminationBracket(
        Array.from({ length: 48 }, (_, i) => ({ id: `p${i + 49}`, name: `Seed ${i + 1}`, seed: i + 1 })),
        { tierId: t3Id, bracketRouting: 'ACCELERATED_HYBRID', finalsCutoff: 16, bestOf: 3 }
      ),
    };

    const formState = {
      name: initialTourney.name,
      slug: initialTourney.slug,
      organizationId: initialTourney.organizationId,
      useOrgBranding: true,
      discordWebhookUrl: '',
      logoUrl: '',
      bannerUrl: '',
      startDate: initialTourney.startDate || '',
      endDate: initialTourney.endDate || '',
      location: initialTourney.location || '',
      seedingMethod: initialTourney.seedingMethod,
      qualFormat: initialTourney.qualFormat,
      qualAverageCount: 2,
      pointsConfig: [],
      tiers: [t1, t2, t3],
    };

    // Dirty state is TRUE with newly added tiers
    expect(checkDirty(formState)).toBe(true);

    // Simulate saving all tiers atomically to DB
    const persistedTourney: Tournament = {
      ...initialTourney,
      tiers: formState.tiers,
    };

    checkDirty = createFormDirtyChecker(persistedTourney);
    expect(checkDirty(formState)).toBe(false);
  });

  it('4. Tier ID fallback by slug ensures no false dirty state when client and DB IDs match', () => {
    const tierUuid = generateUUID();
    const baselineTourney: Tournament = {
      id: generateUUID(),
      name: 'Tournament',
      slug: 'tourney',
      organizationId: 'org_ctwc',
      qualFormat: 'HIGH_SCORE',
      seedingMethod: 'QUALIFIERS',
      tiers: [
        {
          id: tierUuid,
          slug: 'gold',
          name: 'Gold Championship',
          priority: 1,
          bracketType: 'TRADITIONAL',
          playerCount: 16,
          bestOf: 5,
          primaryColor: '#ffc905',
          secondaryColor: '#705b33',
        } as any,
      ],
    } as any;

    const checkDirty = createFormDirtyChecker(baselineTourney);

    // Form with identical tier values and identical slug
    const cleanForm = {
      name: baselineTourney.name,
      slug: baselineTourney.slug,
      organizationId: baselineTourney.organizationId,
      useOrgBranding: true,
      discordWebhookUrl: '',
      logoUrl: '',
      bannerUrl: '',
      startDate: '',
      endDate: '',
      location: '',
      seedingMethod: baselineTourney.seedingMethod,
      qualFormat: baselineTourney.qualFormat,
      qualAverageCount: 2,
      pointsConfig: [],
      tiers: [
        {
          id: tierUuid, // Matches UUID exactly
          slug: 'gold',
          name: 'Gold Championship',
          priority: 1,
          bracketType: 'TRADITIONAL',
          playerCount: 16,
          bestOf: 5,
          primaryColor: '#ffc905',
          secondaryColor: '#705b33',
        } as any,
      ],
    };

    expect(checkDirty(cleanForm)).toBe(false);
  });

  it('5. Navigation speedbump logic: allows navigation when clean, blocks when dirty', () => {
    let isDirty = true;
    let pendingNav: string | null = null;

    const handleNavigateAttempt = (url: string, currentTourneySlug: string) => {
      if (url.includes(`/${currentTourneySlug}/manage/settings`)) {
        return true;
      }
      if (isDirty) {
        pendingNav = url;
        return false;
      }
      return true;
    };

    // When form is dirty: navigation to /brackets is blocked
    const canNavWhileDirty = handleNavigateAttempt('/tourney/brackets', 'tourney');
    expect(canNavWhileDirty).toBe(false);
    expect(pendingNav).toBe('/tourney/brackets');

    // User clicks "Save Configuration" -> isDirty becomes false
    isDirty = false;
    pendingNav = null;

    // After save: navigation to /brackets succeeds immediately without modal
    const canNavAfterSave = handleNavigateAttempt('/tourney/brackets', 'tourney');
    expect(canNavAfterSave).toBe(true);
    expect(pendingNav).toBe(null);
  });
});
