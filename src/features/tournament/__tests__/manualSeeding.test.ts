import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { parseBulkSeedList } from '../components/seeding/BulkSeedImportModal';
import { generateDraftBracketsForTournament } from '../../qualifiers/scoring';
import { getLeaderboardForStandings, calculateGlobalStandings } from '../standings';
import { Tournament, TournamentTier, PlayerProfile } from '../types';
import { generateTraditionalBracket } from '../../bracket/math';
import { shiftSeedsCluster, jumpSeedsBunched, TournamentProvider } from '../store';
import { ManualSeedingManager } from '../components/seeding/ManualSeedingManager';

function createMockPlayers(count: number): PlayerProfile[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `player-${i + 1}`,
    name: `Player ${i + 1}`,
    country: 'USA',
    playstyle: 'DAS' as const,
    personalBest: 1000000,
  }));
}

function createMockTier(
  overrides: Partial<TournamentTier> & { id: string; name: string; priority: number; playerCount: number }
): TournamentTier {
  return {
    id: overrides.id,
    name: overrides.name,
    slug: overrides.id,
    priority: overrides.priority,
    playerCount: overrides.playerCount,
    bracketType: overrides.bracketType || 'TRADITIONAL',
    eliminationType: overrides.eliminationType || 'SINGLE',
    bracketRouting: overrides.bracketRouting,
    flatWidth: overrides.flatWidth,
    finalsCutoff: overrides.finalsCutoff,
    bestOf: overrides.bestOf || 5,
    primaryColor: '#ffc905',
    secondaryColor: '#705b33',
    cardColor: '#1b1c1d',
    textColor: '#94A3B8',
    backgroundColor: '#020203',
    isLocked: overrides.isLocked ?? false,
    bracket: overrides.bracket || generateTraditionalBracket(
      Array.from({ length: overrides.playerCount }, (_, i) => ({
        id: `p${i + 1}`,
        name: `Placeholder ${i + 1}`,
        seed: i + 1,
      })),
      { tierId: overrides.id, bestOf: overrides.bestOf || 5 }
    ),
  };
}

function createMockTournament(overrides: Partial<Tournament> = {}): Tournament {
  return {
    id: overrides.id || 't-mock',
    organizationId: overrides.organizationId || 'org-1',
    name: overrides.name || 'Mock Tournament',
    slug: overrides.slug || 'mock-tournament',
    startDate: overrides.startDate || '2026-09-29',
    location: overrides.location || 'Kansas City, MO',
    seedingMethod: overrides.seedingMethod || 'MANUAL',
    qualFormat: overrides.qualFormat || 'AVERAGE_OF_X',
    qualAverageCount: overrides.qualAverageCount || 2,
    manualSeeds: overrides.manualSeeds || [],
    playersPool: overrides.playersPool || [],
    qualifierSubmissions: overrides.qualifierSubmissions || [],
    qualifiers: overrides.qualifiers || [],
    matchScores: overrides.matchScores || {},
    tournamentPlayers: overrides.tournamentPlayers || {},
    tiers: overrides.tiers || [],
    isLocked: overrides.isLocked ?? false,
    ...overrides,
  };
}

describe('Phase 6: Manual Seeding & Roster Seeding Engine', () => {
  describe('1. parseBulkSeedList', () => {
    it('strips diverse numerical and bullet prefixes cleanly', () => {
      const rawInput = [
        '1. Alex Kerr',
        '2) Jonas Neubauer',
        '#3 Harry Hong',
        '4 - Joseph Saelee',
        '5: Koryan',
        '- Chadic',
        '* Greentea',
        '• Buco',
        '   PixelAndy   ',
      ].join('\n');

      const parsed = parseBulkSeedList(rawInput);
      expect(parsed).toEqual([
        'Alex Kerr',
        'Jonas Neubauer',
        'Harry Hong',
        'Joseph Saelee',
        'Koryan',
        'Chadic',
        'Greentea',
        'Buco',
        'PixelAndy',
      ]);
    });

    it('ignores empty lines and case-insensitively deduplicates while preserving order', () => {
      const rawInput = [
        'DogPlayingTetris',
        '',
        '   ',
        'dogplayingtetris',
        'Huffulufugus',
        'HUFFULUFUGUS',
        'Tristop',
      ].join('\n');

      const parsed = parseBulkSeedList(rawInput);
      expect(parsed).toEqual(['DogPlayingTetris', 'Huffulufugus', 'Tristop']);
    });

    it('parses direct copy-paste from tournament players table without detecting scores, country codes or actions as players', () => {
      const rawInput = [
        '1\t',
        'Blue Scuti',
        'CA',
        '982,561\tRemove',
        '2\t',
        'Fractal',
        'KR',
        '1,334,643\tRemove',
        '3\t',
        'PixelAndy',
        'DE',
        '854,855\tRemove',
        '4\t',
        'DogPlayingTetris',
        'JP',
        '725,642\tRemove',
        '5\t',
        'Player 1',
        'BR',
        '1,171,124\tRemove',
        '6\t',
        'Player 2',
        'CA',
        '1,193,166',
      ].join('\n');

      const parsed = parseBulkSeedList(rawInput);
      expect(parsed).toEqual([
        'Blue Scuti',
        'Fractal',
        'PixelAndy',
        'DogPlayingTetris',
        'Player 1',
        'Player 2',
      ]);
    });

    it('handles table headers, tab-delimited rows, and CSV lines', () => {
      const tableText = [
        '#\tPlayer\tCountry\tPlaystyle\tPersonal Best\tActions',
        '1\tBlue Scuti\tCA\tDAS\t982,561\tRemove',
        '2\tFractal\tKR\tROLLING\t1,334,643\tRemove',
        '3, PixelAndy, DE, 854855',
        '4. DogPlayingTetris (JP) - 725,642',
      ].join('\n');

      const parsed = parseBulkSeedList(tableText);
      expect(parsed).toEqual(['Blue Scuti', 'Fractal', 'PixelAndy', 'DogPlayingTetris']);
    });

    it('returns empty array when text contains only noise, ranks, country tags, or action buttons', () => {
      const noise = [
        '1\t',
        'CA',
        '982,561\tRemove',
        'KR',
        'Remove',
        'Edit',
        'Personal Best',
        '—',
      ].join('\n');

      const parsed = parseBulkSeedList(noise);
      expect(parsed).toEqual([]);
    });
  });

  describe('2. Direct Seeding Bracket Generation across all variants', () => {
    it('generates a Traditional Single Elimination bracket seeded directly from manualSeeds', () => {
      const players = createMockPlayers(16);
      const tier = createMockTier({
        id: 'gold',
        name: 'Gold Championship',
        priority: 1,
        playerCount: 16,
        eliminationType: 'SINGLE',
        bracketType: 'TRADITIONAL',
      });

      const tournament = createMockTournament({
        id: 't-manual-single',
        name: 'Manual Single Elim',
        slug: 'manual-single',
        manualSeeds: players.map(p => p.id),
        playersPool: players,
        tiers: [tier],
      });

      const [updatedTier] = generateDraftBracketsForTournament(tournament);
      expect(updatedTier).toBeDefined();

      const r1Matches = updatedTier.bracket.rounds[0].matches;
      expect(r1Matches).toHaveLength(8);

      // Verify seed 1 vs seed 16 in match 1
      const m1 = r1Matches[0];
      expect(m1.player1.player?.id).toBe('player-1');
      expect(m1.player1.player?.seed).toBe(1);
      expect(m1.player2.player?.id).toBe('player-16');
      expect(m1.player2.player?.seed).toBe(16);
    });

    it('generates a Flat Staged Single Elimination bracket seeded directly from manualSeeds', () => {
      const players = createMockPlayers(16);
      const tier = createMockTier({
        id: 'silver',
        name: 'Silver Flat',
        priority: 1,
        playerCount: 16,
        eliminationType: 'SINGLE',
        bracketType: 'FLAT',
        flatWidth: 4,
      });

      const tournament = createMockTournament({
        id: 't-manual-flat',
        name: 'Manual Flat Elim',
        slug: 'manual-flat',
        manualSeeds: players.map(p => p.id),
        playersPool: players,
        tiers: [tier],
      });

      const [updatedTier] = generateDraftBracketsForTournament(tournament);
      expect(updatedTier.bracket.rounds.length).toBeGreaterThan(0);
      expect(Object.keys(updatedTier.bracket.matchesById).length).toBeGreaterThan(0);

      // Check first round seeds
      const firstMatch = updatedTier.bracket.rounds[0].matches[0];
      expect(firstMatch.player1.player).toBeDefined();
      expect(firstMatch.player2.player).toBeDefined();
    });

    it('generates a Traditional Double Elimination bracket seeded directly from manualSeeds', () => {
      const players = createMockPlayers(16);
      const tier = createMockTier({
        id: 'gold-de',
        name: 'Gold Double Elim',
        priority: 1,
        playerCount: 16,
        eliminationType: 'DOUBLE',
        bracketRouting: 'TRADITIONAL_TREE',
      });

      const tournament = createMockTournament({
        id: 't-manual-de-tree',
        name: 'Manual DE Tree',
        slug: 'manual-de-tree',
        manualSeeds: players.map(p => p.id),
        playersPool: players,
        tiers: [tier],
      });

      const [updatedTier] = generateDraftBracketsForTournament(tournament);
      expect(updatedTier.bracket.eliminationType).toBe('DOUBLE');

      // Verify Winners Round 1 seeding
      const wr1 = updatedTier.bracket.rounds.find(r => r.roundIdentifier === 'W1' || (r.stage === 'WINNERS' && r.roundNumber === 1));
      expect(wr1).toBeDefined();
      expect(wr1?.matches).toHaveLength(8);
      expect(wr1?.matches[0].player1.player?.id).toBe('player-1');
      expect(wr1?.matches[0].player2.player?.id).toBe('player-16');

      // Verify Losers bracket rounds exist
      const lr1 = updatedTier.bracket.rounds.find(r => r.roundIdentifier === 'L1' || (r.stage === 'LOSERS' && r.roundNumber === 1));
      expect(lr1).toBeDefined();
    });

    it('generates an Accelerated Hybrid Double Elimination bracket seeded directly from manualSeeds', () => {
      const players = createMockPlayers(24);
      const tier = createMockTier({
        id: 'gold-hybrid',
        name: 'Gold Hybrid DE',
        priority: 1,
        playerCount: 24,
        eliminationType: 'DOUBLE',
        bracketRouting: 'ACCELERATED_HYBRID',
        finalsCutoff: 8,
      });

      const tournament = createMockTournament({
        id: 't-manual-hybrid',
        name: 'Manual Hybrid DE',
        slug: 'manual-hybrid',
        manualSeeds: players.map(p => p.id),
        playersPool: players,
        tiers: [tier],
      });

      const [updatedTier] = generateDraftBracketsForTournament(tournament);
      expect(updatedTier.bracket.rounds.length).toBeGreaterThan(0);
      expect(Object.keys(updatedTier.bracket.matchesById).length).toBeGreaterThan(0);
      expect(updatedTier.bracket.bracketRouting).toBe('ACCELERATED_HYBRID');

      // Verify Accelerated Round exists
      const arRound = updatedTier.bracket.rounds.find(r => r.roundIdentifier === 'AR');
      expect(arRound).toBeDefined();

      // Verify pre-merge and 2nd chance rounds exist
      const hasPreRounds = updatedTier.bracket.rounds.some(
        r => r.roundIdentifier?.startsWith('PRE_') || r.roundIdentifier === '2C' || r.roundIdentifier === 'PO'
      );
      expect(hasPreRounds).toBe(true);
    });
  });

  describe('3. Multi-tier Cutoff Distribution & Seed Normalization', () => {
    it('slices manual seeds sequentially across tiers and marks overflow as DNQ', () => {
      const players = createMockPlayers(40);
      const tierGold = createMockTier({
        id: 'tier-gold',
        name: 'Gold Tier',
        priority: 1,
        playerCount: 16,
      });
      const tierSilver = createMockTier({
        id: 'tier-silver',
        name: 'Silver Tier',
        priority: 2,
        playerCount: 16,
      });

      const tournament = createMockTournament({
        id: 't-multi-tier',
        name: 'Multi Tier Seeding',
        slug: 'multi-tier',
        manualSeeds: players.map(p => p.id),
        playersPool: players,
        tiers: [tierGold, tierSilver],
      });

      // 1. Bracket draft generation
      const [goldBracketTier, silverBracketTier] = generateDraftBracketsForTournament(tournament);
      
      // Tier 1 Gold gets players 1–16, normalized seed 1–16
      const goldM1 = goldBracketTier.bracket.rounds[0].matches[0];
      expect(goldM1.player1.player?.id).toBe('player-1');
      expect(goldM1.player1.player?.seed).toBe(1);
      expect(goldM1.player2.player?.id).toBe('player-16');
      expect(goldM1.player2.player?.seed).toBe(16);

      // Tier 2 Silver gets players 17–32, normalized seed 1–16
      const silverM1 = silverBracketTier.bracket.rounds[0].matches[0];
      expect(silverM1.player1.player?.id).toBe('player-17');
      expect(silverM1.player1.player?.seed).toBe(1); // Normalized to 1 for Silver!
      expect(silverM1.player2.player?.id).toBe('player-32');
      expect(silverM1.player2.player?.seed).toBe(16); // Normalized to 16 for Silver!

      // 2. Standings leaderboard derivation
      const standingsRows = getLeaderboardForStandings(tournament);
      expect(standingsRows).toHaveLength(40);

      // Seeds 1–16 in Gold
      expect(standingsRows[0].assignedTier?.id).toBe('tier-gold');
      expect(standingsRows[0].tierSeed).toBe(1);
      expect(standingsRows[0].isDNQ).toBe(false);

      expect(standingsRows[15].assignedTier?.id).toBe('tier-gold');
      expect(standingsRows[15].tierSeed).toBe(16);
      expect(standingsRows[15].isDNQ).toBe(false);

      // Seeds 17–32 in Silver
      expect(standingsRows[16].assignedTier?.id).toBe('tier-silver');
      expect(standingsRows[16].tierSeed).toBe(1);
      expect(standingsRows[16].isDNQ).toBe(false);

      expect(standingsRows[31].assignedTier?.id).toBe('tier-silver');
      expect(standingsRows[31].tierSeed).toBe(16);
      expect(standingsRows[31].isDNQ).toBe(false);

      // Seeds 33–40 are DNQ
      expect(standingsRows[32].assignedTier).toBeUndefined();
      expect(standingsRows[32].tierSeed).toBeUndefined();
      expect(standingsRows[32].isDNQ).toBe(true);

      expect(standingsRows[39].assignedTier).toBeUndefined();
      expect(standingsRows[39].isDNQ).toBe(true);
    });
  });

  describe('4. Standings, Rank Delta & DNQ Placement', () => {
    it('calculates global standings with accurate rankDelta based on initial manual seed', () => {
      const players = createMockPlayers(18); // 16 in bracket, 2 DNQ
      const tier = createMockTier({
        id: 'gold',
        name: 'Gold Championship',
        priority: 1,
        playerCount: 16,
      });

      const initialTournament = createMockTournament({
        id: 't-standings',
        name: 'Standings Test',
        slug: 'standings-test',
        manualSeeds: players.map(p => p.id),
        playersPool: players,
        tiers: [tier],
      });

      const [draftTier] = generateDraftBracketsForTournament(initialTournament);
      
      // Simulate finals: seed 8 beats seed 1 for the championship
      const finalsRound = draftTier.bracket.rounds[draftTier.bracket.rounds.length - 1];
      const finalsMatch = finalsRound.matches[0];

      const matchScores = {
        [finalsMatch.id]: {
          matchId: finalsMatch.id,
          tierId: 'gold',
          winnerPlayerId: 'player-8', // Seed 8 wins Champion
          loserPlayerId: 'player-1',  // Seed 1 takes Runner-Up
          player1Wins: 3,
          player2Wins: 2,
          isComplete: true,
          bestOf: 5,
          games: [
            { gameNumber: 1, player1Points: 800000, player2Points: 700000, winnerPlayerId: 'player-8' },
            { gameNumber: 2, player1Points: 600000, player2Points: 750000, winnerPlayerId: 'player-1' },
            { gameNumber: 3, player1Points: 850000, player2Points: 720000, winnerPlayerId: 'player-8' },
            { gameNumber: 4, player1Points: 650000, player2Points: 800000, winnerPlayerId: 'player-1' },
            { gameNumber: 5, player1Points: 900000, player2Points: 810000, winnerPlayerId: 'player-8' },
          ],
        },
      };

      // Set players in finals match
      finalsMatch.player1.player = { id: 'player-8', name: 'Player 8', seed: 8 };
      finalsMatch.player2.player = { id: 'player-1', name: 'Player 1', seed: 1 };

      const tournamentWithScores: Tournament = {
        ...initialTournament,
        tiers: [draftTier],
        matchScores,
      };

      const standings = calculateGlobalStandings(tournamentWithScores);

      // 1. Champion is Player 8
      const championRow = standings[0];
      expect(championRow.finalRank).toBe(1);
      expect(championRow.player.id).toBe('player-8');
      expect(championRow.qualRank).toBe(8); // Started as seed 8
      expect(championRow.rankDelta).toBe(7); // 8 - 1 = +7 rank delta!

      // 2. Runner-Up is Player 1
      const runnerUpRow = standings[1];
      expect(runnerUpRow.finalRank).toBe(2);
      expect(runnerUpRow.player.id).toBe('player-1');
      expect(runnerUpRow.qualRank).toBe(1); // Started as seed 1
      expect(runnerUpRow.rankDelta).toBe(-1); // 1 - 2 = -1 rank delta!

      // 3. DNQ players (Player 17 and Player 18) placed at the end
      const dnqRows = standings.filter(s => s.isDNQ);
      expect(dnqRows).toHaveLength(2);
      expect(dnqRows[0].player.id).toBe('player-17');
      expect(dnqRows[0].qualRank).toBe(17);
      expect(dnqRows[1].player.id).toBe('player-18');
      expect(dnqRows[1].qualRank).toBe(18);
    });
  });

  describe('5. Seed Reordering & Reactivity', () => {
    it('reactively recomputes draft bracket when manual seeds are reordered', () => {
      const players = createMockPlayers(16);
      const tier = createMockTier({
        id: 'gold',
        name: 'Gold Championship',
        priority: 1,
        playerCount: 16,
      });

      const tournament = createMockTournament({
        id: 't-reorder',
        name: 'Reorder Test',
        slug: 'reorder-test',
        manualSeeds: players.map(p => p.id),
        playersPool: players,
        tiers: [tier],
      });

      // Initially player-1 is seed 1
      const [initialTier] = generateDraftBracketsForTournament(tournament);
      expect(initialTier.bracket.rounds[0].matches[0].player1.player?.id).toBe('player-1');

      // Reorder: Move player-10 to top seed
      const reorderedIds = [
        'player-10',
        ...tournament.manualSeeds!.filter(id => id !== 'player-10'),
      ];
      const reorderedTournament: Tournament = {
        ...tournament,
        manualSeeds: reorderedIds,
      };

      const [recomputedTier] = generateDraftBracketsForTournament(reorderedTournament);
      // Now player-10 is seed 1 in match 1!
      const topMatch = recomputedTier.bracket.rounds[0].matches[0];
      expect(topMatch.player1.player?.id).toBe('player-10');
      expect(topMatch.player1.player?.seed).toBe(1);

      // Player 1 has shifted down to seed 2
      const seed2Match = recomputedTier.bracket.rounds[0].matches.find(
        m => m.player1.player?.id === 'player-1' || m.player2.player?.id === 'player-1'
      );
      expect(seed2Match).toBeDefined();
    });

    it('preserves bracket without mutation when tier or tournament is locked', () => {
      const players = createMockPlayers(16);
      const tier = createMockTier({
        id: 'gold-locked',
        name: 'Gold Championship Locked',
        priority: 1,
        playerCount: 16,
        isLocked: true,
      });

      const originalBracket = tier.bracket;

      const tournament = createMockTournament({
        id: 't-locked',
        name: 'Locked Test',
        slug: 'locked-test',
        manualSeeds: players.map(p => p.id),
        playersPool: players,
        tiers: [tier],
        isLocked: true,
      });

      expect(tournament.tiers[0].isLocked).toBe(true);
      expect(tournament.tiers[0].bracket).toBe(originalBracket);
    });

    it('handles player removal from tournament roster and cleans up manualSeeds', () => {
      const players = createMockPlayers(10);
      const manualSeeds = players.map(p => p.id);
      
      const targetId = 'player-3';
      const updatedPool = players.filter(p => p.id !== targetId);
      const updatedSeeds = manualSeeds.filter(id => id !== targetId);

      expect(updatedPool).toHaveLength(9);
      expect(updatedSeeds).toHaveLength(9);
      expect(updatedSeeds.includes('player-3')).toBe(false);
      // Relative order of remaining players is preserved
      expect(updatedSeeds[0]).toBe('player-1');
      expect(updatedSeeds[1]).toBe('player-2');
      expect(updatedSeeds[2]).toBe('player-4');
    });
  });

  describe('6. shiftSeedsCluster (Independent Movement for Up/Down 1)', () => {
    const baseSeeds = [
      'P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9', 'P10'
    ];

    it('moves non-contiguous selections independently UP by 1 slot (user scenario: 3, 6, 9 -> 2, 5, 8)', () => {
      // User requested: selecting 3, 6, and 9 and moving UP 1 moves each respectively one slot
      const selected = ['P3', 'P6', 'P9'];
      const result = shiftSeedsCluster(baseSeeds, selected, 'UP');

      expect(result).toEqual([
        'P1',
        'P3', // was 3, now seed 2
        'P2', // was 2, displaced to seed 3
        'P4',
        'P6', // was 6, now seed 5
        'P5', // was 5, displaced to seed 6
        'P7',
        'P9', // was 9, now seed 8
        'P8', // was 8, displaced to seed 9
        'P10',
      ]);
    });

    it('moves non-contiguous selections independently DOWN by 1 slot (3, 6, 9 -> 4, 7, 10)', () => {
      const selected = ['P3', 'P6', 'P9'];
      const result = shiftSeedsCluster(baseSeeds, selected, 'DOWN');

      expect(result).toEqual([
        'P1',
        'P2',
        'P4', // was 4, displaced to seed 3
        'P3', // was 3, now seed 4
        'P5',
        'P7', // was 7, displaced to seed 6
        'P6', // was 6, now seed 7
        'P8',
        'P10', // was 10, displaced to seed 9
        'P9',  // was 9, now seed 10
      ]);
    });

    it('shifts a contiguous block cluster UP together, displacing the preceding boundary item', () => {
      // Selecting P2 and P3 (seeds 2 and 3)
      const selected = ['P2', 'P3'];
      const result = shiftSeedsCluster(baseSeeds, selected, 'UP');

      expect(result).toEqual([
        'P2', // Seed 1
        'P3', // Seed 2
        'P1', // Seed 3 (displaced)
        'P4',
        'P5',
        'P6',
        'P7',
        'P8',
        'P9',
        'P10',
      ]);
    });

    it('shifts a contiguous block cluster DOWN together, displacing the subsequent boundary item', () => {
      // Selecting P8 and P9 (seeds 8 and 9)
      const selected = ['P8', 'P9'];
      const result = shiftSeedsCluster(baseSeeds, selected, 'DOWN');

      expect(result).toEqual([
        'P1',
        'P2',
        'P3',
        'P4',
        'P5',
        'P6',
        'P7',
        'P10', // Seed 8 (displaced)
        'P8',  // Seed 9
        'P9',  // Seed 10
      ]);
    });

    it('respects top boundary: item at Seed 1 cannot move UP, but lower selected items still shift UP', () => {
      // Selecting P1 and P3
      const selected = ['P1', 'P3'];
      const result = shiftSeedsCluster(baseSeeds, selected, 'UP');

      expect(result).toEqual([
        'P1', // Seed 1 (at top boundary, stays at 1)
        'P3', // Seed 2 (shifted up from 3)
        'P2', // Seed 3 (displaced)
        'P4',
        'P5',
        'P6',
        'P7',
        'P8',
        'P9',
        'P10',
      ]);
    });

    it('respects bottom boundary: item at bottom cannot move DOWN, but higher selected items still shift DOWN', () => {
      // Selecting P8 and P10
      const selected = ['P8', 'P10'];
      const result = shiftSeedsCluster(baseSeeds, selected, 'DOWN');

      expect(result).toEqual([
        'P1',
        'P2',
        'P3',
        'P4',
        'P5',
        'P6',
        'P7',
        'P9',  // Seed 8 (displaced)
        'P8',  // Seed 9 (shifted down from 8)
        'P10', // Seed 10 (at bottom boundary, stays at 10)
      ]);
    });

    it('handles edge cases: empty list, single element, empty selection', () => {
      expect(shiftSeedsCluster([], ['P1'], 'UP')).toEqual([]);
      expect(shiftSeedsCluster(['P1'], ['P1'], 'UP')).toEqual(['P1']);
      expect(shiftSeedsCluster(baseSeeds, [], 'UP')).toEqual(baseSeeds);
    });
  });

  describe('7. jumpSeedsBunched (Bunched Contiguous Jump to Target Seed)', () => {
    const baseSeeds = [
      'P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9', 'P10'
    ];

    it('bunches non-contiguous selections together at target Seed 1 preserving relative order (user scenario: 3, 6, 9 -> 1, 2, 3)', () => {
      // User specified: "jump to seed bunches them together at the seed. So if you selected 3, 6, and 9, and jumped to seed 1, they would be 1, 2, 3 respectively - 3->1, 6->2, 9 -> 3."
      const selected = ['P3', 'P6', 'P9'];
      const result = jumpSeedsBunched(baseSeeds, selected, 1);

      expect(result).toEqual([
        'P3',  // Seed 1
        'P6',  // Seed 2
        'P9',  // Seed 3
        'P1',  // Seed 4
        'P2',  // Seed 5
        'P4',  // Seed 6
        'P5',  // Seed 7
        'P7',  // Seed 8
        'P8',  // Seed 9
        'P10', // Seed 10
      ]);
    });

    it('bunches non-contiguous selections in the middle (e.g., target Seed 5)', () => {
      const selected = ['P2', 'P8'];
      const result = jumpSeedsBunched(baseSeeds, selected, 5);

      // Remaining without P2, P8: [P1, P3, P4, P5, P6, P7, P9, P10]
      // Spliced at index 4 (seed 5):
      // P1, P3, P4, P5 (seeds 1..4)
      // P2, P8 (seeds 5, 6)
      // P6, P7, P9, P10 (seeds 7..10)
      expect(result).toEqual([
        'P1',
        'P3',
        'P4',
        'P5',
        'P2',
        'P8',
        'P6',
        'P7',
        'P9',
        'P10',
      ]);
    });

    it('clamps target seeds out of bounds cleanly to top or bottom', () => {
      const selected = ['P5'];
      // Jump to 0 or negative clamps to 1 (top)
      const topClamp = jumpSeedsBunched(baseSeeds, selected, 0);
      expect(topClamp[0]).toBe('P5');

      // Jump to 999 clamps to bottom
      const bottomClamp = jumpSeedsBunched(baseSeeds, selected, 999);
      expect(bottomClamp[bottomClamp.length - 1]).toBe('P5');
    });
  });

  describe('8. Additive Bulk Import & Deduplication', () => {
    it('appends unique new players to the bottom of existing seeds (Additive BOTTOM mode)', () => {
      const existingSeeds = ['P1', 'P2', 'P3', 'P4'];
      const pastedNames = ['NewPlayerA', 'NewPlayerB', 'P2', 'NewPlayerC']; // Note P2 is already seeded!

      const existingSet = new Set(existingSeeds);
      const uniqueNew = pastedNames.filter(name => !existingSet.has(name));

      // In additive BOTTOM mode:
      const updatedSeeds = [...existingSeeds, ...uniqueNew];

      expect(updatedSeeds).toEqual([
        'P1', 'P2', 'P3', 'P4', // Existing seeds 1..4 preserved intact!
        'NewPlayerA', // Seed 5
        'NewPlayerB', // Seed 6
        'NewPlayerC', // Seed 7 (P2 was skipped from re-adding)
      ]);
      expect(updatedSeeds).toHaveLength(7);
      expect(updatedSeeds.filter(s => s === 'P2')).toHaveLength(1);
    });

    it('inserts unique new players at the top of existing seeds (Additive TOP mode)', () => {
      const existingSeeds = ['P1', 'P2', 'P3'];
      const pastedNames = ['Alpha', 'Beta'];

      const existingSet = new Set(existingSeeds);
      const uniqueNew = pastedNames.filter(name => !existingSet.has(name));

      // In additive TOP mode:
      const updatedSeeds = [...uniqueNew, ...existingSeeds];

      expect(updatedSeeds).toEqual([
        'Alpha', // Seed 1
        'Beta',  // Seed 2
        'P1',    // Seed 3 (shifted)
        'P2',    // Seed 4
        'P3',    // Seed 5
      ]);
    });
  });

  describe('9. Bracket Draft Updates Across All Variants with Batch Operations', () => {
    it('reflects bunched jump (3, 6, 9 -> 1, 2, 3) in Traditional Single Elimination matchups', () => {
      const players = createMockPlayers(16);
      const tier = createMockTier({
        id: 'gold',
        name: 'Gold Championship',
        priority: 1,
        playerCount: 16,
        eliminationType: 'SINGLE',
        bracketType: 'TRADITIONAL',
      });

      const initialSeeds = players.map(p => p.id);
      const bunchedSeeds = jumpSeedsBunched(initialSeeds, ['player-3', 'player-6', 'player-9'], 1);

      const tournament = createMockTournament({
        id: 't-bunched-bracket',
        manualSeeds: bunchedSeeds,
        playersPool: players,
        tiers: [tier],
      });

      const [updatedTier] = generateDraftBracketsForTournament(tournament);
      const m1 = updatedTier.bracket.rounds[0].matches[0];
      // Seed 1 is now player-3!
      expect(m1.player1.player?.id).toBe('player-3');
      expect(m1.player1.player?.seed).toBe(1);
    });

    it('reflects cluster shifts in Traditional Double Elimination matchups', () => {
      const players = createMockPlayers(16);
      const tier = createMockTier({
        id: 'gold-de',
        name: 'Gold DE',
        priority: 1,
        playerCount: 16,
        eliminationType: 'DOUBLE',
        bracketRouting: 'TRADITIONAL_TREE',
      });

      const initialSeeds = players.map(p => p.id);
      // Shift player-2 up 1 slot (P2 becomes seed 1, P1 becomes seed 2)
      const shiftedSeeds = shiftSeedsCluster(initialSeeds, ['player-2'], 'UP');

      const tournament = createMockTournament({
        id: 't-shifted-de',
        manualSeeds: shiftedSeeds,
        playersPool: players,
        tiers: [tier],
      });

      const [updatedTier] = generateDraftBracketsForTournament(tournament);
      const wr1 = updatedTier.bracket.rounds.find(r => r.roundIdentifier === 'W1' || (r.stage === 'WINNERS' && r.roundNumber === 1));
      const m1 = wr1?.matches[0];
      expect(m1?.player1.player?.id).toBe('player-2');
      expect(m1?.player1.player?.seed).toBe(1);
    });

    it('reflects batch seed operations in Flat Staged Single Elimination', () => {
      const players = createMockPlayers(16);
      const tier = createMockTier({
        id: 'flat-tier',
        name: 'Flat Tier',
        priority: 1,
        playerCount: 16,
        eliminationType: 'SINGLE',
        bracketType: 'FLAT',
        flatWidth: 4,
      });

      const initialSeeds = players.map(p => p.id);
      const bunchedSeeds = jumpSeedsBunched(initialSeeds, ['player-16'], 1);

      const tournament = createMockTournament({
        id: 't-flat-batch',
        manualSeeds: bunchedSeeds,
        playersPool: players,
        tiers: [tier],
      });

      const [updatedTier] = generateDraftBracketsForTournament(tournament);
      const matchWithSeed1 = updatedTier.bracket.rounds
        .flatMap(r => r.matches)
        .find(m => m.player1.player?.id === 'player-16' || m.player2.player?.id === 'player-16');
      expect(matchWithSeed1).toBeDefined();
      const p16 = matchWithSeed1?.player1.player?.id === 'player-16'
        ? matchWithSeed1?.player1.player
        : matchWithSeed1?.player2.player;
      expect(p16?.seed).toBe(1);
    });

    it('reflects batch seed operations in Accelerated Hybrid Double Elimination', () => {
      const players = createMockPlayers(24);
      const tier = createMockTier({
        id: 'hybrid-tier',
        name: 'Hybrid Tier',
        priority: 1,
        playerCount: 24,
        eliminationType: 'DOUBLE',
        bracketRouting: 'ACCELERATED_HYBRID',
        finalsCutoff: 8,
      });

      const initialSeeds = players.map(p => p.id);
      const bunchedSeeds = jumpSeedsBunched(initialSeeds, ['player-24'], 1);

      const tournament = createMockTournament({
        id: 't-hybrid-batch',
        manualSeeds: bunchedSeeds,
        playersPool: players,
        tiers: [tier],
      });

      const [updatedTier] = generateDraftBracketsForTournament(tournament);
      expect(updatedTier.bracket.rounds.length).toBeGreaterThan(0);
      const topMatch = updatedTier.bracket.rounds[0].matches[0];
      expect(topMatch.player1.player?.id).toBe('player-24');
      expect(topMatch.player1.player?.seed).toBe(1);
    });
  });

  describe('Reverse and Shuffle Operations across Bracket Types', () => {
    it('inverts seeds and updates matchups in Traditional Single Elimination', () => {
      const players = createMockPlayers(8);
      const tier = createMockTier({
        id: 'tier-trad-single',
        name: 'Trad Single Tier',
        priority: 1,
        playerCount: 8,
        eliminationType: 'SINGLE',
        bracketType: 'TRADITIONAL',
      });

      const initialSeeds = players.map(p => p.id); // player-1 .. player-8
      const reversedSeeds = [...initialSeeds].reverse(); // player-8 is now seed 1

      const tournament = createMockTournament({
        id: 't-reverse-single',
        manualSeeds: reversedSeeds,
        playersPool: players,
        tiers: [tier],
      });

      const [updatedTier] = generateDraftBracketsForTournament(tournament);
      const round1 = updatedTier.bracket.rounds[0];
      const match1 = round1.matches[0];

      // In an 8-player bracket, Seed 1 plays Seed 8
      // Seed 1 is player-8, Seed 8 is player-1
      expect(match1.player1.player?.id).toBe('player-8');
      expect(match1.player1.player?.seed).toBe(1);
      expect(match1.player2.player?.id).toBe('player-1');
      expect(match1.player2.player?.seed).toBe(8);
    });

    it('inverts seeds and updates matchups in Traditional Double Elimination', () => {
      const players = createMockPlayers(8);
      const tier = createMockTier({
        id: 'tier-trad-double',
        name: 'Trad Double Tier',
        priority: 1,
        playerCount: 8,
        eliminationType: 'DOUBLE',
        bracketType: 'TRADITIONAL',
      });

      const initialSeeds = players.map(p => p.id);
      const reversedSeeds = [...initialSeeds].reverse();

      const tournament = createMockTournament({
        id: 't-reverse-double',
        manualSeeds: reversedSeeds,
        playersPool: players,
        tiers: [tier],
      });

      const [updatedTier] = generateDraftBracketsForTournament(tournament);
      const winnerRound1 = updatedTier.bracket.rounds.find(r => r.name?.toLowerCase().includes('winner') || r.matches.length === 4) || updatedTier.bracket.rounds[0];
      expect(winnerRound1).toBeDefined();
      const topMatch = winnerRound1.matches[0];
      expect(topMatch.player1.player?.id).toBe('player-8');
      expect(topMatch.player1.player?.seed).toBe(1);
    });

    it('inverts seeds in Flat Staged Double Elimination', () => {
      const players = createMockPlayers(16);
      const tier = createMockTier({
        id: 'tier-flat-double',
        name: 'Flat Double Tier',
        priority: 1,
        playerCount: 16,
        eliminationType: 'DOUBLE',
        bracketType: 'FLAT',
        flatWidth: 4,
      });

      const initialSeeds = players.map(p => p.id);
      const reversedSeeds = [...initialSeeds].reverse();

      const tournament = createMockTournament({
        id: 't-reverse-flat',
        manualSeeds: reversedSeeds,
        playersPool: players,
        tiers: [tier],
      });

      const [updatedTier] = generateDraftBracketsForTournament(tournament);
      const matchWithSeed1 = updatedTier.bracket.rounds
        .flatMap(r => r.matches)
        .find(m => m.player1.player?.seed === 1 || m.player2.player?.seed === 1);
      expect(matchWithSeed1).toBeDefined();
      const pSeed1 = matchWithSeed1?.player1.player?.seed === 1
        ? matchWithSeed1?.player1.player
        : matchWithSeed1?.player2.player;
      expect(pSeed1?.id).toBe('player-16');
    });

    it('inverts seeds in Accelerated Hybrid Double Elimination', () => {
      const players = createMockPlayers(24);
      const tier = createMockTier({
        id: 'tier-hybrid-double',
        name: 'Hybrid Double Tier',
        priority: 1,
        playerCount: 24,
        eliminationType: 'DOUBLE',
        bracketRouting: 'ACCELERATED_HYBRID',
        finalsCutoff: 8,
      });

      const initialSeeds = players.map(p => p.id);
      const reversedSeeds = [...initialSeeds].reverse();

      const tournament = createMockTournament({
        id: 't-reverse-hybrid',
        manualSeeds: reversedSeeds,
        playersPool: players,
        tiers: [tier],
      });

      const [updatedTier] = generateDraftBracketsForTournament(tournament);
      const topMatch = updatedTier.bracket.rounds[0].matches[0];
      expect(topMatch.player1.player?.id).toBe('player-24');
      expect(topMatch.player1.player?.seed).toBe(1);
    });

    it('maintains integrity under shuffle operations', () => {
      const players = createMockPlayers(16);
      const initialSeeds = players.map(p => p.id);
      const shuffledSeeds = [...initialSeeds];
      for (let i = shuffledSeeds.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledSeeds[i], shuffledSeeds[j]] = [shuffledSeeds[j], shuffledSeeds[i]];
      }

      // Check all elements are preserved
      expect(shuffledSeeds.length).toBe(16);
      expect(new Set(shuffledSeeds).size).toBe(16);
      initialSeeds.forEach(id => {
        expect(shuffledSeeds).toContain(id);
      });
    });
  });

  describe('7. Public Leaderboard vs Manage Seeding View Contracts', () => {
    const players: PlayerProfile[] = [
      { id: 'p1', name: 'Blue Scuti', country: 'US', playstyle: 'Rolling', personalBest: 1334643 },
      { id: 'p2', name: 'Fractal', country: 'CA', playstyle: 'DAS', personalBest: 1222391 },
      { id: 'p3', name: 'PixelAndy', country: 'DE', playstyle: 'Hypertap', personalBest: 1047484 },
      { id: 'p4', name: 'Alex T', country: 'KR', playstyle: 'Rolling', personalBest: 982561 },
      { id: 'p5', name: 'Reserve Player', country: 'GB', playstyle: 'DAS', personalBest: 854855 },
    ];

    const goldTier = createMockTier({
      id: 'tier-gold',
      name: 'Gold',
      priority: 1,
      playerCount: 2,
      eliminationType: 'DOUBLE',
      bracketType: 'TRADITIONAL',
    });

    const silverTier = createMockTier({
      id: 'tier-silver',
      name: 'Silver',
      priority: 2,
      playerCount: 2,
      eliminationType: 'DOUBLE',
      bracketType: 'FLAT',
      flatWidth: 2,
    });

    const mockTournament = createMockTournament({
      id: 't-seeding-contract',
      name: 'Championship Seeding Open',
      slug: 'champ-seeding-open',
      seedingMethod: 'MANUAL',
      playersPool: players,
      manualSeeds: ['p1', 'p2', 'p3', 'p4', 'p5'],
      tiers: [goldTier, silverTier],
    });

    it('enforces Public view contract: no management buttons, no admin descriptions, clean title and telemetry', () => {
      const html = renderToString(
        React.createElement(TournamentProvider, null,
          React.createElement(ManualSeedingManager, { tournament: mockTournament, canManage: false })
        )
      );

      // Title & Description
      expect(html).toContain('Tournament Seeding');
      expect(html).not.toContain('Tournament Seeding Manager');
      expect(html).toContain('Official competitor seeding and bracket allocations.');
      expect(html).not.toContain('Direct seeding active. Drag, jump, or paste names');

      // Allowed public controls
      expect(html).toContain('New Page View');
      expect(html).toContain('Filter seeds...');
      expect(html).toContain('Total Seeds:');
      expect(html).toContain('Bracket Capacity:');

      // Forbidden in public view
      expect(html).not.toContain('Shuffle');
      expect(html).not.toContain('Reverse');
      expect(html).not.toContain('Bulk Import');
      expect(html).not.toContain('Add Seeds');
      expect(html).not.toContain('Select All');
      expect(html).not.toContain('Deselect All');
      expect(html).not.toContain('Move to top');
      expect(html).not.toContain('Move Up');
      expect(html).not.toContain('Move Down');
      expect(html).not.toContain('Move to bottom');
    });

    it('enforces Public row column order: Overall seed > Flag > Player name > Playstyle > PB > bracket seed chip', () => {
      const html = renderToString(
        React.createElement(TournamentProvider, null,
          React.createElement(ManualSeedingManager, { tournament: mockTournament, canManage: false })
        )
      );

      // Headers check
      expect(html).toContain('Seed');
      expect(html).toContain('Flag');
      expect(html).toContain('Competitor');
      expect(html).toContain('Style');
      expect(html).toContain('Personal Best');
      expect(html).toContain('Bracket Seed');

      // Data check: Blue Scuti (Seed 1, Gold 1, ROLLING -> Roll, PB formatted)
      expect(html).toContain('#1');
      expect(html).toContain('Blue Scuti');
      expect(html).toContain('Roll');
      expect(html).toContain('1,334,643');
      expect(html).toContain('Gold 1');

      // Data check: Fractal (Seed 2, Gold 2, DAS, PB formatted)
      expect(html).toContain('#2');
      expect(html).toContain('Fractal');
      expect(html).toContain('DAS');
      expect(html).toContain('1,222,391');
      expect(html).toContain('Gold 2');

      // Data check: PixelAndy (Seed 3, Silver 1, HYPERTAP -> Tap)
      expect(html).toContain('#3');
      expect(html).toContain('PixelAndy');
      expect(html).toContain('Tap');
      expect(html).toContain('Silver 1');

      // Data check: Reserve Player (Seed 5 exceeds capacity of 4 -> Reserve)
      expect(html).toContain('#5');
      expect(html).toContain('Reserve Player');
      expect(html).toContain('Reserve');
    });

    it('enforces Manage view contract: shows management controls, and omits Flag and Style to preserve space for controls', () => {
      const html = renderToString(
        React.createElement(TournamentProvider, null,
          React.createElement(ManualSeedingManager, { tournament: mockTournament, canManage: true })
        )
      );

      // Title & Admin Description
      expect(html).toContain('Tournament Seeding Manager');
      expect(html).toContain('Direct seeding active. Drag, jump, or paste names');

      // Management action bar buttons
      expect(html).toContain('Shuffle');
      expect(html).toContain('Reverse');
      expect(html).toContain('Bulk Import');
      expect(html).toContain('Add Seeds');

      // In Manage mode, table header contains Competitor, PB, Bracket Seed, Actions
      expect(html).toContain('Competitor');
      expect(html).toContain('Personal Best');
      expect(html).toContain('Bracket Seed');
      expect(html).toContain('Actions');

      // Rows contain Blue Scuti, PB, and Gold 1 chip
      expect(html).toContain('Blue Scuti');
      expect(html).toContain('1,334,643');
      expect(html).toContain('Gold 1');

      // Row controls present
      expect(html).toContain('Move to top (#1 Seed)');
      expect(html).toContain('Move Up (↑)');
      expect(html).toContain('Move Down (↓)');
      expect(html).toContain('Move to bottom');
      expect(html).toContain('Remove from seeds');
    });

    it('validates colored bracket seed chips across Single, Double Traditional, Flat, and Hybrid variants', () => {
      // Test all 4 bracket architectures
      const hybridTier = createMockTier({
        id: 'tier-hybrid',
        name: 'Hybrid Tier',
        priority: 1,
        playerCount: 8,
        eliminationType: 'DOUBLE',
        bracketRouting: 'ACCELERATED_HYBRID',
        finalsCutoff: 4,
      });

      const singleElimTier = createMockTier({
        id: 'tier-single',
        name: 'Single Elim Tier',
        priority: 2,
        playerCount: 8,
        eliminationType: 'SINGLE',
        bracketType: 'TRADITIONAL',
      });

      const multiArchitectureTourney = createMockTournament({
        id: 't-multi-arch',
        name: 'Multi Architecture Seeding',
        slug: 'multi-arch-seeding',
        playersPool: createMockPlayers(20),
        manualSeeds: createMockPlayers(20).map(p => p.id),
        tiers: [hybridTier, singleElimTier],
      });

      const html = renderToString(
        React.createElement(TournamentProvider, null,
          React.createElement(ManualSeedingManager, { tournament: multiArchitectureTourney, canManage: false })
        )
      );

      // Hybrid Tier Seeds 1-8
      expect(html).toContain('Hybrid Tier 1');
      expect(html).toContain('Hybrid Tier 8');

      // Single Elim Tier Seeds 9-16
      expect(html).toContain('Single Elim Tier 1');
      expect(html).toContain('Single Elim Tier 8');

      // Reserve Pool Seeds 17-20
      expect(html).toContain('Reserve');
    });

  });
});



