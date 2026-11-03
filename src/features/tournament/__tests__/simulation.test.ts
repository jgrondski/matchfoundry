import { describe, it, expect } from 'vitest';
import {
  generateRealisticPlayers,
  generateSimulatedQualifiers,
  runFullSimulation,
  REALISTIC_PLAYER_NAMES,
} from '../simulation';
import { Tournament, TournamentTier, PlayerProfile } from '../types';
import { generateTraditionalBracket, generateFlatBracket } from '../../bracket/math';
import { generateDraftBracketsForTournament, deriveLeaderboard } from '../../qualifiers/scoring';

describe('Simulation Engine', () => {
  describe('generateRealisticPlayers', () => {
    it('generates requested count of unique competitors', () => {
      const count = 20;
      const players = generateRealisticPlayers(count);

      expect(players).toHaveLength(count);

      // Check uniqueness of names
      const names = new Set(players.map(p => p.name.toLowerCase()));
      expect(names.size).toBe(count);

      // Check fields
      players.forEach(p => {
        expect(p.id).toBeDefined();
        expect(p.name).toBeTruthy();
        expect(['Rolling', 'DAS', 'Hypertap']).toContain(p.playstyle);
        expect(p.country).toBeTruthy();
        expect(p.personalBest).toBeGreaterThanOrEqual(700000);
        expect(p.personalBest).toBeLessThanOrEqual(1350000);
      });
    });

    it('preserves existing player pool and appends new unique competitors', () => {
      const existing = [
        {
          id: 'p_custom_1',
          name: REALISTIC_PLAYER_NAMES[0], // e.g. 'Blue Scuti'
          personalBest: 1200000,
          playstyle: 'Rolling' as const,
          country: 'US',
        },
      ];

      const players = generateRealisticPlayers(5, existing);
      expect(players).toHaveLength(5);
      expect(players[0].id).toBe('p_custom_1');

      const names = new Set(players.map(p => p.name.toLowerCase()));
      expect(names.size).toBe(5);
    });
  });

  describe('generateSimulatedQualifiers', () => {
    const sampleTiers: TournamentTier[] = [
      {
        id: 'tier-gold',
        slug: 'gold',
        name: 'Gold Tier',
        priority: 1,
        bracketType: 'TRADITIONAL',
        playerCount: 8,
        bestOf: 5,
        primaryColor: '#eab308',
        secondaryColor: '#ca8a04',
        isLocked: false,
        bracket: generateTraditionalBracket(
          Array.from({ length: 8 }, (_, i) => ({ id: `p${i + 1}`, name: `Seed ${i + 1}`, seed: i + 1 })),
          { tierId: 'tier-gold', bestOf: 5 }
        ),
      },
    ];

    const mockTournament: Tournament = {
      id: 'tourney-test',
      organizationId: 'org_ctwc',
      slug: 'test-tourney',
      name: 'Test Tournament',
      location: 'Online',
      qualFormat: 'AVERAGE_OF_X',
      qualAverageCount: 2,
      tiers: sampleTiers,
      playersPool: [],
      qualifierSubmissions: [],
      tournamentPlayers: {},
      matchScores: {},
      isLocked: false,
    };

    it('generates capacity + 1d6 competitors with correct attempt count', () => {
      const { players, submissions } = generateSimulatedQualifiers(mockTournament);

      // Capacity is 8, 1d6 adds 1..6, so total should be between 9 and 14
      expect(players.length).toBeGreaterThanOrEqual(9);
      expect(players.length).toBeLessThanOrEqual(14);

      // AVERAGE_OF_X with count 2 should generate 2 submissions per competitor
      expect(submissions).toHaveLength(players.length * 2);

      submissions.forEach(sub => {
        expect(sub.tournamentId).toBe('tourney-test');
        expect(sub.score).toBeGreaterThan(0);
        expect(sub.submittedAt).toBeGreaterThan(0);
      });
    });

    it('pulls from global player pool if populated and preserves existing tournament players', () => {
      const existingPlayer: PlayerProfile = {
        id: 'p_existing_1',
        name: 'Existing Champion',
        personalBest: 1250000,
        playstyle: 'Rolling',
      };

      const globalPool: PlayerProfile[] = [
        { id: 'p_glob_1', name: 'Global Star A', personalBest: 1100000, playstyle: 'DAS' },
        { id: 'p_glob_2', name: 'Global Star B', personalBest: 1150000, playstyle: 'Rolling' },
        { id: 'p_glob_3', name: 'Global Star C', personalBest: 950000, playstyle: 'Hypertap' },
      ];

      const tourneyWithPlayer: Tournament = {
        ...mockTournament,
        playersPool: [existingPlayer],
      };

      const { players } = generateSimulatedQualifiers(tourneyWithPlayer, globalPool);

      // Existing player MUST still be present
      expect(players.some(p => p.id === 'p_existing_1')).toBe(true);

      // Global players should be pulled in
      const globalIds = new Set(globalPool.map(g => g.id));
      const pulledGlobal = players.filter(p => globalIds.has(p.id));
      expect(pulledGlobal.length).toBe(3);

      // Total count should still be capacity (8) + 1d6 (1..6)
      expect(players.length).toBeGreaterThanOrEqual(9);
      expect(players.length).toBeLessThanOrEqual(14);
    });

    it('handles HIGH_SCORE mode with 3 attempts per player', () => {
      const highScoreTourney: Tournament = {
        ...mockTournament,
        qualFormat: 'HIGH_SCORE',
      };

      const { players, submissions } = generateSimulatedQualifiers(highScoreTourney);
      expect(players.length).toBeGreaterThanOrEqual(9);
      expect(players.length).toBeLessThanOrEqual(14);
      expect(submissions).toHaveLength(players.length * 3); // 3 attempts per player
    });

    it('generates 25-30 competitors when tournament has zero tiers (pure qualifiers state)', () => {
      const bracketlessTourney: Tournament = {
        ...mockTournament,
        tiers: [],
      };

      const { players, submissions } = generateSimulatedQualifiers(bracketlessTourney);
      expect(players.length).toBeGreaterThanOrEqual(25);
      expect(players.length).toBeLessThanOrEqual(30);
      expect(submissions).toHaveLength(players.length * 2);
    });
  });

  describe('runFullSimulation', () => {
    it('seeds qualifiers, locks brackets, and simulates all rounds to completion', () => {
      const goldTier: TournamentTier = {
        id: 'tier-gold',
        slug: 'gold',
        name: 'Gold Tier',
        priority: 1,
        bracketType: 'TRADITIONAL',
        playerCount: 8,
        bestOf: 5,
        primaryColor: '#eab308',
        secondaryColor: '#ca8a04',
        isLocked: false,
        bracket: generateTraditionalBracket(
          Array.from({ length: 8 }, (_, i) => ({ id: `p${i + 1}`, name: `Seed ${i + 1}`, seed: i + 1 })),
          { tierId: 'tier-gold', bestOf: 5 }
        ),
      };

      const silverTier: TournamentTier = {
        id: 'tier-silver',
        slug: 'silver',
        name: 'Silver Tier',
        priority: 2,
        bracketType: 'FLAT',
        playerCount: 8,
        flatWidth: 4,
        bestOf: 3,
        primaryColor: '#94a3b8',
        secondaryColor: '#64748b',
        isLocked: false,
        bracket: generateFlatBracket(
          Array.from({ length: 8 }, (_, i) => ({ id: `p${i + 9}`, name: `Seed ${i + 1}`, seed: i + 1 })),
          4,
          { tierId: 'tier-silver', bestOf: 3 }
        ),
      };

      const cleanTourney: Tournament = {
        id: 'tourney-sim',
        organizationId: 'org_ctwc',
        slug: 'sim-tourney',
        name: 'Simulation Open',
        location: 'Virtual',
        qualFormat: 'AVERAGE_OF_X',
        qualAverageCount: 2,
        tiers: [goldTier, silverTier],
        playersPool: [],
        qualifierSubmissions: [],
        tournamentPlayers: {},
        matchScores: {},
        isLocked: false,
      };

      const simulated = runFullSimulation(cleanTourney);

      // 1. Should have seeded players (16 capacity + 1d6 >= 17 players)
      expect(simulated.playersPool.length).toBeGreaterThanOrEqual(17);
      expect(simulated.qualifierSubmissions.length).toBeGreaterThanOrEqual(34);

      // 2. Tournament and all tiers should be locked
      expect(simulated.isLocked).toBe(true);
      simulated.tiers.forEach(t => {
        expect(t.isLocked).toBe(true);
      });

      // 3. Match scores should be recorded and complete
      const matchScoreValues = Object.values(simulated.matchScores);
      expect(matchScoreValues.length).toBeGreaterThan(0);

      matchScoreValues.forEach(m => {
        expect(m.isComplete).toBe(true);
        expect(m.winnerPlayerId).toBeTruthy();
        expect(m.loserPlayerId).toBeTruthy();
        expect(m.games.length).toBeGreaterThan(0);
      });

      // 4. Gold tier final match should have a winner
      const gold = simulated.tiers.find(t => t.slug === 'gold')!;
      const lastGoldRound = gold.bracket.rounds[gold.bracket.rounds.length - 1];
      const championshipMatch = lastGoldRound.matches[0];
      const champScore = simulated.matchScores[championshipMatch.id];
      expect(champScore).toBeDefined();
      expect(champScore.isComplete).toBe(true);
      expect(championshipMatch.winnerId).toBe(champScore.winnerPlayerId);
    });

    it('simulates matches from already-seeded qualifiers without regenerating submissions', () => {
      const tier: TournamentTier = {
        id: 'tier-gold',
        slug: 'gold',
        name: 'Gold Tier',
        priority: 1,
        bracketType: 'TRADITIONAL',
        playerCount: 8,
        bestOf: 3,
        primaryColor: '#eab308',
        secondaryColor: '#ca8a04',
        isLocked: false,
        bracket: generateTraditionalBracket(
          Array.from({ length: 8 }, (_, i) => ({ id: `p${i + 1}`, name: `Seed ${i + 1}`, seed: i + 1 })),
          { tierId: 'tier-gold', bestOf: 3 }
        ),
      };

      const baseTourney: Tournament = {
        id: 'tourney-seeded',
        organizationId: 'org_ctwc',
        slug: 'seeded-tourney',
        name: 'Seeded Tourney',
        location: 'Virtual',
        qualFormat: 'AVERAGE_OF_X',
        qualAverageCount: 2,
        tiers: [tier],
        playersPool: [],
        qualifierSubmissions: [],
        tournamentPlayers: {},
        matchScores: {},
        isLocked: false,
      };

      // Step 1: Seed qualifiers only
      const { players, submissions } = generateSimulatedQualifiers(baseTourney);
      const seededTourney: Tournament = {
        ...baseTourney,
        playersPool: players,
        qualifierSubmissions: submissions,
      };

      const initialSubIds = submissions.map(s => s.id);

      // Step 2: Run simulation on the already-seeded tournament
      const finishedTourney = runFullSimulation(seededTourney);

      // Verify that existing submissions were preserved, NOT replaced
      expect(finishedTourney.qualifierSubmissions.map(s => s.id)).toEqual(initialSubIds);
      expect(finishedTourney.isLocked).toBe(true);
      expect(Object.keys(finishedTourney.matchScores).length).toBeGreaterThan(0);
    });

    it('supports seeding qualifiers with zero tiers, subsequently adding tiers, and simulating matches', () => {
      // 1. New tournament with zero tiers
      const zeroTierTourney: Tournament = {
        id: 'tourney-dynamic',
        organizationId: 'org_ctwc',
        slug: 'dynamic-tourney',
        name: 'Dynamic Tourney',
        location: 'Virtual',
        qualFormat: 'AVERAGE_OF_X',
        qualAverageCount: 2,
        tiers: [],
        playersPool: [],
        qualifierSubmissions: [],
        tournamentPlayers: {},
        matchScores: {},
        isLocked: false,
      };

      // 2. Seed qualifiers only
      const { players, submissions } = generateSimulatedQualifiers(zeroTierTourney);
      const seededTourney: Tournament = {
        ...zeroTierTourney,
        playersPool: players,
        qualifierSubmissions: submissions,
      };
      expect(seededTourney.playersPool.length).toBeGreaterThanOrEqual(25);

      // 3. Compute leaderboard rankings from the seeded qualifiers
      const leaderboard = deriveLeaderboard(seededTourney);
      expect(leaderboard.length).toBe(seededTourney.playersPool.length);

      // 4. Organizer adds Tier 1 (Gold, 8 players)
      const tierGold: TournamentTier = {
        id: 'tier_gold',
        slug: 'gold',
        name: 'Gold Championship',
        priority: 1,
        bracketType: 'TRADITIONAL',
        playerCount: 8,
        bestOf: 3,
        primaryColor: '#f59e0b',
        secondaryColor: '#fbbf24',
        isLocked: false,
        bracket: generateTraditionalBracket(
          Array.from({ length: 8 }, (_, i) => ({ id: `p${i + 1}`, name: `Player ${i + 1}`, seed: i + 1 })),
          { bestOf: 3 }
        ),
      };

      const tourneyWithGold: Tournament = {
        ...seededTourney,
        tiers: [tierGold],
      };
      const draftedTiers1 = generateDraftBracketsForTournament(tourneyWithGold);
      const goldBracketPlayers = draftedTiers1[0].bracket.rounds[0].matches
        .flatMap(m => [m.player1.player, m.player2.player])
        .filter(Boolean);
      // Top 8 players from leaderboard should populate the Gold bracket
      const top8Ids = new Set(leaderboard.slice(0, 8).map(r => r.player.id));
      goldBracketPlayers.forEach(p => {
        expect(top8Ids.has(p!.id)).toBe(true);
      });

      // 5. Organizer adds Tier 2 (Silver, 8 players)
      const tierSilver: TournamentTier = {
        id: 'tier_silver',
        slug: 'silver',
        name: 'Silver Tier',
        priority: 2,
        bracketType: 'TRADITIONAL',
        playerCount: 8,
        bestOf: 3,
        primaryColor: '#94a3b8',
        secondaryColor: '#cbd5e1',
        isLocked: false,
        bracket: generateTraditionalBracket(
          Array.from({ length: 8 }, (_, i) => ({ id: `p${i + 1}`, name: `Player ${i + 1}`, seed: i + 1 })),
          { bestOf: 3 }
        ),
      };

      const tourneyWithBoth: Tournament = {
        ...seededTourney,
        tiers: [draftedTiers1[0], tierSilver],
      };
      const draftedTiers2 = generateDraftBracketsForTournament(tourneyWithBoth);
      const silverBracketPlayers = draftedTiers2[1].bracket.rounds[0].matches
        .flatMap(m => [m.player1.player, m.player2.player])
        .filter(Boolean);
      // Next 8 players (ranks 9-16) should populate Silver bracket
      const next8Ids = new Set(leaderboard.slice(8, 16).map(r => r.player.id));
      silverBracketPlayers.forEach(p => {
        expect(next8Ids.has(p!.id)).toBe(true);
      });

      // 6. Simulate tournament matches to completion
      const simulatedTourney = runFullSimulation({
        ...tourneyWithBoth,
        tiers: draftedTiers2,
      });

      expect(simulatedTourney.isLocked).toBe(true);
      expect(simulatedTourney.tiers).toHaveLength(2);
      expect(Object.keys(simulatedTourney.matchScores).length).toBeGreaterThan(0);
    });

    it('simulates a Double Elimination tier completely and crowns a champion', async () => {
      const { generateDoubleEliminationBracket } = await import('../../bracket/math');
      const { calculateTierStandings } = await import('../standings');

      const players: PlayerProfile[] = Array.from({ length: 8 }, (_, i) => ({
        id: `de-p${i + 1}`,
        name: `Competitor ${i + 1}`,
        personalBest: 1000000,
        playstyle: 'Rolling' as const,
      }));

      const seededPlayers = players.map((p, i) => ({
        id: p.id,
        name: p.name,
        seed: i + 1,
      }));

      const deTier: TournamentTier = {
        id: 'tier-de',
        slug: 'de',
        name: 'Double Elim Tier',
        priority: 1,
        bracketType: 'TRADITIONAL',
        eliminationType: 'DOUBLE',
        playerCount: 8,
        bestOf: 3,
        isLocked: false,
        bracket: generateDoubleEliminationBracket(seededPlayers, { tierId: 'tier-de', bestOf: 3 }),
      };

      const tournament: Tournament = {
        id: 'tourney-de',
        organizationId: 'org-test',
        slug: 'tourney-de',
        name: 'Double Elim Open',
        location: 'Arena',
        qualFormat: 'HIGH_SCORE',
        isLocked: false,
        tiers: [deTier],
        matchScores: {},
        playersPool: players,
        qualifierSubmissions: players.map((p, i) => ({
          id: `sub-${i + 1}`,
          tournamentId: 'tourney-de',
          playerId: p.id,
          score: 900000 - i * 10000,
          submittedAt: Date.now() + i,
        })),
        tournamentPlayers: {},
      };

      const simulated = runFullSimulation(tournament);
      expect(simulated.isLocked).toBe(true);

      const tierSim = simulated.tiers[0];
      const matchCount = Object.keys(tierSim.bracket.matchesById).length;
      // Either 14 (no GF reset) or 15 (GF reset)
      expect([14, 15]).toContain(matchCount);

      const standings = calculateTierStandings(tierSim, simulated.matchScores);
      expect(standings).toHaveLength(8);
      expect(standings[0].rankNumber).toBe(1);
      expect(standings[0].status).toBe('champion');
      expect(standings[1].rankNumber).toBe(2);
      expect(standings[1].status).toBe('runner_up');
    });
  });
});
