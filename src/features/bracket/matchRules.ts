import type { BracketMatch, BracketStructure } from './types';
import type { MatchScoreRecord } from '../tournament/types';
import { isValidScore, MAX_SCORE } from '../../utils/scores';

/**
 * The rules for scoring a bracket match, shared by the score drawer (what to show and
 * enable) and the API (what to accept). Keep the two in agreement by changing them here.
 */

export const TIE = 'TIE';

/** Best-of choices offered in the match drawer, plus the match's own default if it differs. */
export const MATCH_BEST_OF_OPTIONS = [1, 3, 5, 7] as const;

export const FORFEIT_REASON_MAX_LENGTH = 200;

export type MatchPhase = 'WAITING' | 'READY' | 'IN_PROGRESS' | 'COMPLETE';

export interface GameInput {
  player1Points: number | null;
  player2Points: number | null;
  winnerPlayerId: string | null;
}

export function winsNeeded(bestOf: number): number {
  return Math.ceil(bestOf / 2);
}

export function bestOfChoices(defaultBestOf: number | undefined): number[] {
  const set = new Set<number>(MATCH_BEST_OF_OPTIONS);
  if (defaultBestOf && defaultBestOf > 0) set.add(defaultBestOf);
  return [...set].sort((a, b) => a - b);
}

export function isGameStarted(g: GameInput): boolean {
  return g.player1Points !== null || g.player2Points !== null || Boolean(g.winnerPlayerId);
}

/**
 * Who won a game. With both scores entered the higher score wins and equal scores are a
 * tie (0-0 counts as not played). Without both scores, a winner picked by hand counts.
 */
export function gameOutcome(g: GameInput, p1Id: string | undefined, p2Id: string | undefined): string | null {
  if (g.player1Points !== null && g.player2Points !== null) {
    if (g.player1Points === 0 && g.player2Points === 0) return null;
    if (g.player1Points > g.player2Points) return p1Id ?? null;
    if (g.player2Points > g.player1Points) return p2Id ?? null;
    return TIE;
  }
  if (g.winnerPlayerId && (g.winnerPlayerId === p1Id || g.winnerPlayerId === p2Id)) return g.winnerPlayerId;
  return null;
}

export interface SeriesSummary {
  p1Wins: number;
  p2Wins: number;
  /** The competitor who reached the win threshold, if anyone has. */
  winnerId: string | null;
  /** Index of the game that decided the series, or -1. */
  decidedAtIndex: number;
}

export function summarizeSeries(
  games: GameInput[],
  bestOf: number,
  p1Id: string | undefined,
  p2Id: string | undefined
): SeriesSummary {
  const needed = winsNeeded(bestOf);
  let p1Wins = 0;
  let p2Wins = 0;
  for (let i = 0; i < games.length; i++) {
    const outcome = gameOutcome(games[i], p1Id, p2Id);
    if (outcome && outcome === p1Id) p1Wins++;
    else if (outcome && outcome === p2Id) p2Wins++;
    if (p1Id && p1Wins >= needed) return { p1Wins, p2Wins, winnerId: p1Id, decidedAtIndex: i };
    if (p2Id && p2Wins >= needed) return { p1Wins, p2Wins, winnerId: p2Id, decidedAtIndex: i };
  }
  return { p1Wins, p2Wins, winnerId: null, decidedAtIndex: -1 };
}

/**
 * How many game rows the drawer shows: every game up to the first unfinished one, stopping
 * once the series is decided. Rows past that point stay visible only while they hold data,
 * so validation can point at them.
 */
export function visibleGameCount(
  games: GameInput[],
  bestOf: number,
  p1Id: string | undefined,
  p2Id: string | undefined
): number {
  const series = summarizeSeries(games, bestOf, p1Id, p2Id);
  let count: number;
  if (series.decidedAtIndex >= 0) {
    count = series.decidedAtIndex + 1;
  } else {
    const firstOpen = games.findIndex(g => !gameOutcome(g, p1Id, p2Id));
    count = firstOpen === -1 ? games.length + 1 : firstOpen + 1;
  }
  let lastStarted = -1;
  games.forEach((g, i) => {
    if (isGameStarted(g)) lastStarted = i;
  });
  return Math.max(count, lastStarted + 1, 1);
}

/** Returns a message describing the first problem with a set of games, or null if they are valid. */
export function validateMatchGames(
  games: GameInput[],
  bestOf: number,
  p1Id: string | undefined,
  p2Id: string | undefined
): string | null {
  if (!p1Id || !p2Id) return 'Both competitors must be set before scores can be entered.';
  if (!Number.isInteger(bestOf) || bestOf < 1 || bestOf % 2 === 0) {
    return `Best-of ${bestOf} is not a valid format.`;
  }

  for (let i = 0; i < games.length; i++) {
    const g = games[i];
    const label = `Game ${i + 1}`;
    for (const points of [g.player1Points, g.player2Points]) {
      if (points !== null && !isValidScore(points)) {
        return `${label}: scores must be whole numbers from 0 to ${MAX_SCORE.toLocaleString('en-US')}.`;
      }
    }
    if (g.winnerPlayerId && ![p1Id, p2Id, TIE].includes(g.winnerPlayerId)) {
      return `${label}: the winner is not in this match.`;
    }
    if (g.player1Points !== null && g.player2Points !== null && g.winnerPlayerId) {
      const outcome = gameOutcome(g, p1Id, p2Id);
      if ((outcome ?? TIE) !== g.winnerPlayerId) return `${label}: the winner does not match the scores.`;
    }
  }

  let lastStarted = -1;
  games.forEach((g, i) => {
    if (isGameStarted(g)) lastStarted = i;
  });
  for (let i = 0; i < lastStarted; i++) {
    if (!gameOutcome(games[i], p1Id, p2Id)) {
      return `Game ${i + 1} must be finished before Game ${i + 2} is entered.`;
    }
  }

  const series = summarizeSeries(games, bestOf, p1Id, p2Id);
  if (series.decidedAtIndex >= 0 && lastStarted > series.decidedAtIndex) {
    return `The match was decided in Game ${series.decidedAtIndex + 1}. Clear the games after it.`;
  }
  return null;
}

export function matchPhase(match: BracketMatch, record: MatchScoreRecord | undefined): MatchPhase {
  if (match.winnerId || record?.isComplete) return 'COMPLETE';
  if (!match.player1.player || !match.player2.player) return 'WAITING';
  if (record?.games?.some(isGameStarted)) return 'IN_PROGRESS';
  return 'READY';
}

/** Best-of can change only before any game is scored. */
export function canChangeBestOf(record: MatchScoreRecord | undefined): boolean {
  return !record || (!record.isComplete && !(record.games || []).some(isGameStarted));
}

/**
 * Later matches whose results would be wiped by reopening this one: the matches its winner
 * and loser were sent to (including a slot they were moved to by hand) that already have a
 * result or scored games. Reopening is blocked until those are reopened first.
 */
export function reopenBlockers(
  bracket: BracketStructure,
  matchScores: Record<string, MatchScoreRecord | undefined>,
  matchId: string
): BracketMatch[] {
  const match = bracket.matchesById[matchId];
  if (!match) return [];
  const moved = [match.winnerId, match.loserId].filter(Boolean) as string[];
  const resetId = match.roundIdentifier === 'GF' ? bracket.grandFinalsResetMatchId : undefined;
  const targets = [match.nextMatchId, match.loserNextMatchId, resetId]
    .map(id => (id ? bracket.matchesById[id] : undefined))
    .filter(Boolean) as BracketMatch[];

  const fedBy = Object.values(bracket.matchesById).filter(candidate => {
    if (candidate.id === matchId) return false;
    if (candidate.player1.sourceMatchId === matchId || candidate.player2.sourceMatchId === matchId) return true;
    const inTargetRound = targets.some(
      t => t.roundNumber === candidate.roundNumber && (t.stage || 'WINNERS') === (candidate.stage || 'WINNERS')
    );
    return (
      inTargetRound &&
      moved.some(id => candidate.player1.player?.id === id || candidate.player2.player?.id === id)
    );
  });

  const seen = new Set<string>();
  return [...targets, ...fedBy].filter(candidate => {
    if (seen.has(candidate.id)) return false;
    seen.add(candidate.id);
    const rec = matchScores[candidate.id];
    return Boolean(candidate.winnerId || rec?.isComplete || rec?.games?.some(isGameStarted));
  });
}
