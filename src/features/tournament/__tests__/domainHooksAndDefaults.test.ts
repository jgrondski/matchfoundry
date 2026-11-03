import { describe, it, expect } from 'vitest';
import {
  createEmptyTournament,
  createDefaultTier,
  createEmptyPlayer,
  generateUUID,
  DEFAULT_QUAL_FORMAT,
  DEFAULT_QUAL_AVERAGE_COUNT,
  DEFAULT_SEEDING_METHOD,
} from '../defaults';
import {
  useTournamentSettings,
  useQualifiers,
  useMatches,
  useGlobalPlayers,
} from '../hooks';
import {
  useTournamentSettings as storeSettings,
  useQualifiers as storeQualifiers,
  useMatches as storeMatches,
  useGlobalPlayers as storeGlobalPlayers,
} from '../store';
import type { TierInput } from '../../../api/tournaments';

describe('Track A: Factory Centralization & Domain Defaults (defaults.ts)', () => {
  it('generateUUID produces valid RFC4122 v4 UUID format', () => {
    const uuid = generateUUID();
    expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    const uuid2 = generateUUID();
    expect(uuid).not.toBe(uuid2);
  });

  describe('createEmptyTournament', () => {
    it('creates a clean default tournament with safe default properties', () => {
      const tourney = createEmptyTournament();
      expect(tourney.id).toBeDefined();
      expect(tourney.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      expect(tourney.name).toBe('');
      expect(tourney.slug).toBe('');
      expect(tourney.organizationId).toBeUndefined();
      expect(tourney.startDate).toBeUndefined();
      expect(tourney.location).toBe('TBD');
      expect(tourney.qualFormat).toBe(DEFAULT_QUAL_FORMAT);
      expect(tourney.qualAverageCount).toBe(DEFAULT_QUAL_AVERAGE_COUNT);
      expect(tourney.isLocked).toBe(false);
      expect(tourney.seedingMethod).toBe(DEFAULT_SEEDING_METHOD);
      expect(tourney.manualSeeds).toEqual([]);
      expect(tourney.tiers).toEqual([]);
      expect(tourney.matchScores).toEqual({});
      expect(tourney.playersPool).toEqual([]);
      expect(tourney.qualifierSubmissions).toEqual([]);
      expect(tourney.tournamentPlayers).toEqual({});
      expect(tourney.useOrgBranding).toBe(true);
    });

    it('merges custom overrides properly', () => {
      const tourney = createEmptyTournament({
        name: 'Portland Masters 2026',
        slug: 'portland-masters-2026',
        organizationId: 'org_ctwc',
        qualFormat: 'HIGH_SCORE',
      });
      expect(tourney.name).toBe('Portland Masters 2026');
      expect(tourney.slug).toBe('portland-masters-2026');
      expect(tourney.organizationId).toBe('org_ctwc');
      expect(tourney.qualFormat).toBe('HIGH_SCORE');
      expect(tourney.isLocked).toBe(false);
    });
  });

  describe('createDefaultTier', () => {
    it('creates Priority 1 Gold tier with 16 players, Traditional, Bo5', () => {
      const gold = createDefaultTier(1);
      expect(gold.priority).toBe(1);
      expect(gold.name).toBe('Gold');
      expect(gold.slug).toBe('gold');
      expect(gold.bracketType).toBe('TRADITIONAL');
      expect(gold.playerCount).toBe(16);
      expect(gold.bestOf).toBe(5);
      expect(gold.primaryColor).toBe('#ffc905');
      expect(gold.bracket).toBeDefined();
      expect(gold.bracket.rounds.length).toBeGreaterThan(0);
      expect(gold.bracket.totalPlayers).toBe(16);
    });

    it('creates Priority 2 Silver tier with 9 players, Flat (width 2), Bo3 + Bo5 semis/finals overrides', () => {
      const silver = createDefaultTier(2);
      expect(silver.priority).toBe(2);
      expect(silver.name).toBe('Silver');
      expect(silver.slug).toBe('silver');
      expect(silver.bracketType).toBe('FLAT');
      expect(silver.playerCount).toBe(9);
      expect(silver.flatWidth).toBe(2);
      expect(silver.bestOf).toBe(3);
      expect(silver.roundBestOfOverrides).toEqual({ 4: 5, 5: 5 });
      expect(silver.primaryColor).toBe('#CBD5E1');
      expect(silver.bracket).toBeDefined();
      expect(silver.bracket.type).toBe('FLAT');
      expect(silver.bracket.totalPlayers).toBe(9);
    });

    it('creates Priority 3 Bronze tier with 8 players, Traditional, Bo3', () => {
      const bronze = createDefaultTier(3);
      expect(bronze.priority).toBe(3);
      expect(bronze.name).toBe('Bronze');
      expect(bronze.slug).toBe('bronze');
      expect(bronze.bracketType).toBe('TRADITIONAL');
      expect(bronze.playerCount).toBe(8);
      expect(bronze.bestOf).toBe(3);
      expect(bronze.primaryColor).toBe('#db5f00');
      expect(bronze.bracket).toBeDefined();
      expect(bronze.bracket.totalPlayers).toBe(8);
    });

    it('creates Priority 4+ generic tier with 8 players, Traditional, Bo3', () => {
      const tier4 = createDefaultTier(4);
      expect(tier4.priority).toBe(4);
      expect(tier4.name).toBe('Tier 4');
      expect(tier4.slug).toBe('tier-4');
      expect(tier4.bracketType).toBe('TRADITIONAL');
      expect(tier4.playerCount).toBe(8);
      expect(tier4.bestOf).toBe(3);
      expect(tier4.primaryColor).toBe('#3b82f6');
      expect(tier4.bracket).toBeDefined();
    });

    it('merges custom overrides on default tiers', () => {
      const custom = createDefaultTier(1, {
        name: 'Championship Division',
        bestOf: 7,
      });
      expect(custom.name).toBe('Championship Division');
      expect(custom.bestOf).toBe(7);
      expect(custom.priority).toBe(1);
    });
  });

  describe('createEmptyPlayer', () => {
    it('creates an empty player profile with safe defaults', () => {
      const player = createEmptyPlayer();
      expect(player.id).toBeDefined();
      expect(player.name).toBe('');
      expect(player.country).toBe('US');
      expect(player.avatarType).toBe('flag');
      expect(player.personalBest).toBe(0);
      expect(player.playstyle).toBe('Rolling');
      expect(player.isDisqualified).toBe(false);
    });

    it('merges custom overrides properly', () => {
      const player = createEmptyPlayer({
        name: 'Alex T',
        country: 'US',
        personalBest: 1200000,
        playstyle: 'DAS',
      });
      expect(player.name).toBe('Alex T');
      expect(player.country).toBe('US');
      expect(player.personalBest).toBe(1200000);
      expect(player.playstyle).toBe('DAS');
    });
  });

  describe('Domain Hooks Decoupling & Parity', () => {
    it('exports all domain hooks from both hooks/index and store', () => {
      expect(useTournamentSettings).toBeDefined();
      expect(useQualifiers).toBeDefined();
      expect(useMatches).toBeDefined();
      expect(useGlobalPlayers).toBeDefined();

      expect(storeSettings).toBe(useTournamentSettings);
      expect(storeQualifiers).toBe(useQualifiers);
      expect(storeMatches).toBe(useMatches);
      expect(storeGlobalPlayers).toBe(useGlobalPlayers);
    });
  });

  describe('Contract Alignment & Defensive Invariants', () => {
    it('supports TierInput with both playerCount and numPlayers defensively', () => {
      const inputWithPlayerCount: TierInput = {
        name: 'Gold',
        priorityOrder: 1,
        bracketType: 'TRADITIONAL',
        playerCount: 16,
      };
      const inputWithNumPlayers: TierInput = {
        name: 'Silver',
        priorityOrder: 2,
        bracketType: 'FLAT',
        numPlayers: 8,
      };

      const resolvedCount1 = inputWithPlayerCount.numPlayers ?? inputWithPlayerCount.playerCount ?? 16;
      const resolvedCount2 = inputWithNumPlayers.numPlayers ?? inputWithNumPlayers.playerCount ?? 16;

      expect(resolvedCount1).toBe(16);
      expect(resolvedCount2).toBe(8);
    });
  });
});
