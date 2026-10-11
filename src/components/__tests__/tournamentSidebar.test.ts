import { describe, it, expect, beforeEach } from 'vitest';
import { filterTournamentsByQuery, getTournamentTargetUrl } from '../TournamentSidebar';
import { Tournament } from '../../features/tournament/types';
import { setStoredTierSlug } from '../../features/tournament/tierStorage';

describe('TournamentSidebar helpers', () => {
  const mockTournaments = [
    {
      id: 'tourney-1',
      name: 'Classic Tetris World Championship 2026',
      slug: 'ctwc-2026',
      organizationId: 'org_ctwc',
      tiers: [
        {
          id: 'tier-gold',
          slug: 'gold',
          name: 'Gold Tier',
          priority: 1,
          bracketType: 'TRADITIONAL',
          eliminationType: 'DOUBLE',
          playerCount: 16,
          bestOf: 3,
          isLocked: false,
          bracket: {} as any,
        },
        {
          id: 'tier-silver',
          slug: 'silver',
          name: 'Silver Tier',
          priority: 2,
          bracketType: 'TRADITIONAL',
          eliminationType: 'SINGLE',
          playerCount: 16,
          bestOf: 3,
          isLocked: false,
          bracket: {} as any,
        },
      ],
      playersPool: [],
      matchScores: {},
      isLocked: false,
    },
    {
      id: 'tourney-2',
      name: 'Kansas City Classic Open',
      slug: 'kc-2026-open',
      organizationId: 'org_ctwc',
      tiers: [
        {
          id: 'tier-masters',
          slug: 'masters',
          name: 'Masters Tier',
          priority: 1,
          bracketType: 'TRADITIONAL',
          eliminationType: 'DOUBLE',
          playerCount: 8,
          bestOf: 3,
          isLocked: true,
          bracket: {} as any,
        },
      ],
      playersPool: [],
      matchScores: {},
      isLocked: true,
    },
    {
      id: 'tourney-3',
      name: 'Lone Star Regional',
      slug: 'lone-star-2026',
      organizationId: 'org_ctwc',
      tiers: [],
      playersPool: [],
      matchScores: {},
      isLocked: false,
    },
  ] as unknown as Tournament[];

  let mockStore: Record<string, string>;

  beforeEach(() => {
    mockStore = {};
    (globalThis as unknown as { sessionStorage: Storage }).sessionStorage = {
      getItem: (key: string) => mockStore[key] ?? null,
      setItem: (key: string, value: string) => {
        mockStore[key] = String(value);
      },
      removeItem: (key: string) => {
        delete mockStore[key];
      },
      clear: () => {
        mockStore = {};
      },
      length: 0,
      key: () => null,
    };
  });

  describe('filterTournamentsByQuery', () => {
    it('returns all tournaments when query is empty or only whitespace', () => {
      expect(filterTournamentsByQuery(mockTournaments, '')).toHaveLength(3);
      expect(filterTournamentsByQuery(mockTournaments, '   ')).toHaveLength(3);
    });

    it('filters tournaments by name case-insensitively', () => {
      const result = filterTournamentsByQuery(mockTournaments, 'kansas');
      expect(result).toHaveLength(1);
      expect(result[0].slug).toBe('kc-2026-open');
    });

    it('filters tournaments by slug case-insensitively', () => {
      const result = filterTournamentsByQuery(mockTournaments, 'ctwc');
      expect(result).toHaveLength(1);
      expect(result[0].slug).toBe('ctwc-2026');
    });

    it('returns empty array when no tournaments match query', () => {
      const result = filterTournamentsByQuery(mockTournaments, 'nonexistent tournament');
      expect(result).toHaveLength(0);
    });
  });

  describe('getTournamentTargetUrl', () => {
    const target = mockTournaments[0]; // ctwc-2026, top tier is 'gold'

    describe('director / manage mode (default)', () => {
      it('preserves standings view in manage mode', () => {
        expect(getTournamentTargetUrl(target, 'standings')).toBe('/ctwc-2026/manage/standings');
      });

      it('preserves master sheet view with top tier', () => {
        expect(getTournamentTargetUrl(target, 'sheet')).toBe('/ctwc-2026/manage/sheet?tier=gold');
      });

      it('preserves bracket visualizer view with top tier in manage mode', () => {
        expect(getTournamentTargetUrl(target, 'bracket')).toBe('/ctwc-2026/manage/bracket/gold');
      });

      it('preserves floor judge view with top tier', () => {
        expect(getTournamentTargetUrl(target, 'judge')).toBe('/ctwc-2026/manage/judge?tier=gold');
      });

      it('preserves obs hub view', () => {
        expect(getTournamentTargetUrl(target, 'obs')).toBe('/ctwc-2026/obs');
      });

      it('preserves tournament roster view', () => {
        expect(getTournamentTargetUrl(target, 'players')).toBe('/ctwc-2026/manage/players');
      });

      it('preserves tournament settings view', () => {
        expect(getTournamentTargetUrl(target, 'settings')).toBe('/ctwc-2026/manage/settings');
      });

      it('defaults to qualifiers manage view', () => {
        expect(getTournamentTargetUrl(target, 'leaderboard')).toBe('/ctwc-2026/manage/qualifiers');
        expect(getTournamentTargetUrl(target, undefined)).toBe('/ctwc-2026/manage/qualifiers');
      });

      it('uses stored tier slug if user previously visited a specific tier of target tournament', () => {
        setStoredTierSlug('ctwc-2026', 'silver');
        expect(getTournamentTargetUrl(target, 'bracket')).toBe('/ctwc-2026/manage/bracket/silver');
        expect(getTournamentTargetUrl(target, 'sheet')).toBe('/ctwc-2026/manage/sheet?tier=silver');
        expect(getTournamentTargetUrl(target, 'judge')).toBe('/ctwc-2026/manage/judge?tier=silver');
        setStoredTierSlug('ctwc-2026', undefined);
      });

      it('handles target tournament without any tiers gracefully in manage mode', () => {
        const noTiers = mockTournaments[2]; // lone-star-2026
        expect(getTournamentTargetUrl(noTiers, 'bracket')).toBe('/lone-star-2026/manage/bracket');
        expect(getTournamentTargetUrl(noTiers, 'sheet')).toBe('/lone-star-2026/manage/sheet');
        expect(getTournamentTargetUrl(noTiers, 'judge')).toBe('/lone-star-2026/manage/judge');
      });
    });

    describe('public spectator mode (isManage = false)', () => {
      it('returns public spectator URLs', () => {
        expect(getTournamentTargetUrl(target, 'standings', false)).toBe('/ctwc-2026/standings');
        expect(getTournamentTargetUrl(target, 'bracket', false)).toBe('/ctwc-2026/gold');
        expect(getTournamentTargetUrl(target, 'leaderboard', false)).toBe('/ctwc-2026/leaderboard');
      });

      it('handles target tournament without tiers in public mode', () => {
        const noTiers = mockTournaments[2];
        expect(getTournamentTargetUrl(noTiers, 'bracket', false)).toBe('/lone-star-2026/brackets');
      });
    });

    describe('manageable tournaments filtering in sidebar dropdown', () => {
      it('filters out unmanageable tournaments for Tournament Admins while retaining all for System Admins', () => {
        const canManage = (slug?: string) => slug === 'ctwc-2026' || slug === 'kc-2026-open';

        // For Tournament Admin:
        const tournamentAdminManageable = mockTournaments.filter(
          t => canManage(t.slug) || canManage(t.id)
        );
        expect(tournamentAdminManageable.map(t => t.slug)).toEqual(['ctwc-2026', 'kc-2026-open']);
        expect(tournamentAdminManageable.map(t => t.slug)).not.toContain('lone-star-2026');

        // For System Admin:
        const isSystemAdmin = true;
        const systemAdminManageable = mockTournaments.filter(
          t => isSystemAdmin || canManage(t.slug) || canManage(t.id)
        );
        expect(systemAdminManageable).toHaveLength(mockTournaments.length);
      });
    });
  });
});

