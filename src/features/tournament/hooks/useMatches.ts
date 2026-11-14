import { useTournament } from '../store';
import type { MatchScoreRecord, Tournament } from '../types';

export interface MatchesHook {
  activeMatchScores: Record<string, MatchScoreRecord>;
  recordGameScore: (
    tournamentId: string,
    tierId: string,
    matchId: string,
    gameNumber: number,
    p1Points: number | null,
    p2Points: number | null,
    declaredWinnerId?: string | null
  ) => Promise<Tournament | null>;
  saveMatchScores: (
    tournamentId: string,
    tierId: string,
    matchId: string,
    scoredGames: Array<{
      gameNumber: number;
      player1Points: number | null;
      player2Points: number | null;
      winnerPlayerId: string | null;
    }>,
    hasTiebreaker?: boolean
  ) => Promise<Tournament | null>;
  updateMatchBestOf: (tournamentId: string, tierId: string, matchId: string, bestOf: number) => Promise<Tournament | null>;
  forfeitMatch: (tournamentId: string, tierId: string, matchId: string, winnerPlayerId: string, reason: string) => Promise<Tournament | null>;
  reopenMatch: (tournamentId: string, tierId: string, matchId: string, expectedRevision?: number) => Promise<Tournament | null>;
  clearMatchScores: (tournamentId: string) => Promise<Tournament | null>;
  swapMatchSlots: (
    tournamentId: string,
    tierId: string,
    payload: {
      sourceMatchId: string;
      sourceSlot: 1 | 2;
      targetMatchId: string;
      targetSlot: 1 | 2;
    }
  ) => Promise<{ success: boolean; error?: string }>;
}

export function useMatches(): MatchesHook {
  const store = useTournament();
  return {
    activeMatchScores: store.activeTournament?.matchScores || {},
    recordGameScore: store.recordGameScore,
    saveMatchScores: store.saveMatchScores,
    updateMatchBestOf: store.updateMatchBestOf,
    forfeitMatch: store.forfeitMatch,
    reopenMatch: store.reopenMatch,
    clearMatchScores: store.clearMatchScores,
    swapMatchSlots: store.swapMatchSlots,
  };
}
