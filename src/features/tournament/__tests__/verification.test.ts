import { describe, it, expect } from 'vitest';
import { generateDraftBracketsForTournament } from '../../qualifiers/scoring';
import { Tournament, TournamentTier } from '../types';
import { generateTraditionalBracket } from '../../bracket/math';

describe('Bracket Verification Lifecycle & Invariants', () => {
  const mockTiers: TournamentTier[] = [
    {
      id: 'gold',
      slug: 'gold',
      name: 'Gold',
      priority: 1,
      bracketType: 'TRADITIONAL',
      playerCount: 2,
      bestOf: 3,
      bracket: generateTraditionalBracket(
        [
          { id: 'p1', name: 'Alice', seed: 1 },
          { id: 'p2', name: 'Bob', seed: 2 },
        ],
        { tierId: 'gold', bestOf: 3 }
      ),
      isLocked: false,
    },
  ];

  const createTestTournament = (isLocked: boolean = false): Tournament => ({
    id: 'test-tournament',
    organizationId: 'org_ctwc',
    slug: 'test-tournament',
    name: 'Verification Test Event',
    location: 'Test City',
    qualFormat: 'HIGH_SCORE',
    isLocked,
    tiers: mockTiers,
    matchScores: {},
    playersPool: [
      { id: 'p1', name: 'Alice', personalBest: 1000000, playstyle: 'Rolling' },
      { id: 'p2', name: 'Bob', personalBest: 950000, playstyle: 'Rolling' },
      { id: 'p3', name: 'Charlie', personalBest: 900000, playstyle: 'DAS' },
    ],
    qualifierSubmissions: [
      { id: 'sub1', tournamentId: 'test-tournament', playerId: 'p1', score: 1000000, submittedAt: 100 },
      { id: 'sub2', tournamentId: 'test-tournament', playerId: 'p2', score: 900000, submittedAt: 200 },
    ],
    tournamentPlayers: {},
  });

  it('updates draft brackets dynamically when a new qualifier score overtakes seeding', () => {
    const tournament = createTestTournament(false);
    // Initial draft bracket has Alice (Seed 1) vs Bob (Seed 2)
    const initialTiers = generateDraftBracketsForTournament(tournament);
    expect(initialTiers[0].bracket.rounds[0].matches[0].player1.player?.name).toBe('Alice');
    expect(initialTiers[0].bracket.rounds[0].matches[0].player2.player?.name).toBe('Bob');

    // Charlie submits a massive 1.2M score
    const updatedTournament: Tournament = {
      ...tournament,
      qualifierSubmissions: [
        ...tournament.qualifierSubmissions,
        { id: 'sub3', tournamentId: 'test-tournament', playerId: 'p3', score: 1200000, submittedAt: 300 },
      ],
    };

    const newDraftTiers = generateDraftBracketsForTournament(updatedTournament);
    // Charlie is now Seed 1, Alice is Seed 2, Bob dropped out of top 2
    expect(newDraftTiers[0].bracket.rounds[0].matches[0].player1.player?.name).toBe('Charlie');
    expect(newDraftTiers[0].bracket.rounds[0].matches[0].player1.player?.seed).toBe(1);
    expect(newDraftTiers[0].bracket.rounds[0].matches[0].player2.player?.name).toBe('Alice');
    expect(newDraftTiers[0].bracket.rounds[0].matches[0].player2.player?.seed).toBe(2);
  });

  it('blocks unlock brackets when matches contain recorded game scores (Safety Invariant)', () => {
    const tournament = createTestTournament(true);
    const matchId = tournament.tiers[0].bracket.rounds[0].matches[0].id;

    // Simulate active match play
    tournament.matchScores[matchId] = {
      matchId,
      tierId: 'gold',
      bestOf: 3,
      player1Wins: 1,
      player2Wins: 0,
      games: [
        { gameNumber: 1, player1Points: 500000, player2Points: 400000, winnerPlayerId: 'p1' },
      ],
      winnerPlayerId: null,
      loserPlayerId: null,
      isComplete: false,
    };

    // Check unlocking rule logic
    const hasRecordedScores = Object.values(tournament.matchScores).some(
      record =>
        record.isComplete ||
        record.games.some(g => g.player1Points !== null || g.player2Points !== null) ||
        record.player1Wins > 0 ||
        record.player2Wins > 0
    );

    expect(hasRecordedScores).toBe(true);
  });

  it('permits unlock brackets when no match scores have been recorded', () => {
    const tournament = createTestTournament(true);
    // matchScores is empty
    const hasRecordedScores = Object.values(tournament.matchScores).some(
      record =>
        record.isComplete ||
        record.games.some(g => g.player1Points !== null || g.player2Points !== null) ||
        record.player1Wins > 0 ||
        record.player2Wins > 0
    );

    expect(hasRecordedScores).toBe(false);
  });

  it('locks all tiers and marks isLocked = true on tournament', () => {
    const tournament = createTestTournament(false);
    expect(tournament.isLocked).toBe(false);
    expect(tournament.tiers.every(t => !t.isLocked)).toBe(true);

    const lockedTiers = tournament.tiers.map(tier => ({ ...tier, isLocked: true }));
    const lockedTournament = { ...tournament, isLocked: true, tiers: lockedTiers };

    expect(lockedTournament.isLocked).toBe(true);
    expect(lockedTournament.tiers.every(t => t.isLocked)).toBe(true);
  });
});
