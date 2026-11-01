import { useTournament } from '../store';
import type { QualifierSubmission, QualifierScore } from '../types';

export interface QualifiersHook {
  activeTournamentSubmissions: QualifierSubmission[];
  submitQualifierScore: (tournamentId: string, playerId: string, score: number) => void;
  deleteQualifierScore: (tournamentId: string, submissionId: string) => void;
  addQualifierScore: (tournamentId: string, entry: Omit<QualifierScore, 'id' | 'totalScore'>) => void;
  verifyQualifierScore: (tournamentId: string, qualifierId: string, verified: boolean) => void;
  togglePlayerDisqualification: (tournamentId: string, playerId: string, isDisqualified: boolean) => void;
  togglePlayerQualsCompleted: (tournamentId: string, playerId: string, qualsCompleted: boolean) => void;
  clearQualifierScores: (tournamentId: string) => void;
}

export function useQualifiers(): QualifiersHook {
  const store = useTournament();
  return {
    activeTournamentSubmissions: store.activeTournament?.qualifierSubmissions || [],
    submitQualifierScore: store.submitQualifierScore,
    deleteQualifierScore: store.deleteQualifierScore,
    addQualifierScore: store.addQualifierScore,
    verifyQualifierScore: store.verifyQualifierScore,
    togglePlayerDisqualification: store.togglePlayerDisqualification,
    togglePlayerQualsCompleted: store.togglePlayerQualsCompleted,
    clearQualifierScores: store.clearQualifierScores,
  };
}
