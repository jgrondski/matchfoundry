import { describe, it, expect } from 'vitest';
import { hasMatchProgress, toTournamentSummary, mergeTournamentSummaries } from '../summary';
import { createEmptyTournament, createDefaultTier } from '../defaults';
import type { MatchScoreRecord, PlayerProfile, TournamentSummary } from '../types';

function matchRecord(overrides: Partial<MatchScoreRecord> = {}): MatchScoreRecord {
  return {
    matchId: 'm1',
    tierId: 't1',
    bestOf: 3,
    player1Wins: 0,
    player2Wins: 0,
    games: [],
    winnerPlayerId: null,
    loserPlayerId: null,
    isComplete: false,
    ...overrides,
  };
}

function player(id: string): PlayerProfile {
  return { id, name: `Player ${id}`, personalBest: 0, playstyle: 'Rolling' };
}

describe('hasMatchProgress', () => {
  it('is false for no matches or matches with no progress', () => {
    expect(hasMatchProgress({})).toBe(false);
    expect(hasMatchProgress(null)).toBe(false);
    expect(hasMatchProgress({ m1: matchRecord() })).toBe(false);
  });

  it('is true for a complete match, a win, or a recorded game', () => {
    expect(hasMatchProgress({ m1: matchRecord({ isComplete: true }) })).toBe(true);
    expect(hasMatchProgress({ m1: matchRecord({ player1Wins: 1 }) })).toBe(true);
    expect(
      hasMatchProgress({
        m1: matchRecord({
          games: [{ gameNumber: 1, player1Points: 0, player2Points: null, winnerPlayerId: null }],
        }),
      })
    ).toBe(true);
  });
});

describe('toTournamentSummary', () => {
  it('summarizes tiers, players and recorded results', () => {
    const tiers = [createDefaultTier(1), createDefaultTier(2)];
    const t = createEmptyTournament({
      name: 'Summary Test',
      slug: 'summary-test',
      tiers,
      playersPool: [player('p1'), player('p2'), player('p3')],
      qualifierSubmissions: [
        { id: 's1', tournamentId: 'x', playerId: 'p4', score: 100_000, submittedAt: 0 },
      ],
    });

    const summary = toTournamentSummary(t);

    expect(summary.registeredPlayerCount).toBe(3);
    expect(summary.playerIds).toHaveLength(4);
    expect(summary.hasRecordedResults).toBe(true);
    expect(summary.tiers).toHaveLength(2);
    summary.tiers.forEach((tier, i) => {
      expect(tier.slug).toBe(tiers[i].slug);
      expect(tier.playerCount).toBe(tiers[i].playerCount);
      expect(tier.bestOf).toBe(tiers[i].bestOf);
      expect(tier.primaryColor).toBe(tiers[i].primaryColor);
    });
  });
});

describe('mergeTournamentSummaries', () => {
  it('puts newly loaded tournaments first and replaces server summaries with loaded ones', () => {
    const a = createEmptyTournament({ name: 'A', slug: 'a' });
    const b = createEmptyTournament({ name: 'B', slug: 'b' });
    const c = createEmptyTournament({ name: 'C', slug: 'c' });
    const server: TournamentSummary[] = [toTournamentSummary(a), toTournamentSummary(b)];
    const bRenamed = { ...b, name: 'B Renamed' };

    const merged = mergeTournamentSummaries(server, [bRenamed, c]);

    expect(merged.map(s => s.id)).toEqual([c.id, a.id, b.id]);
    expect(merged[2].name).toBe('B Renamed');
  });
});
