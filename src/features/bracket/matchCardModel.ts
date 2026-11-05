import { BracketMatch, BracketRound, BracketStructure, isMatchPlayable } from './types';
import { TournamentTier, MatchScoreRecord, GameScoreEntry } from '../tournament/types';
import { getEffectivePlayerName } from '../players/playerNameUtils';

export interface MatchSideModel {
  name: string;          // effective name or placeholder text
  isPlaceholder: boolean;
  seed: number | null;
  winsDisplay: string;   // e.g. "2" or "2 (t)"
  won: boolean;
  leading: boolean;
}

export interface MatchCardModel {
  p1: MatchSideModel;
  p2: MatchSideModel;
  isComplete: boolean;
  inProgress: boolean;
  isPlayable: boolean;
}

/**
 * Placeholder text for an empty slot ("TBD", "Winner of M#3", Accelerated Hybrid origins).
 */
function getSlotPlaceholder(
  match: BracketMatch,
  slot: BracketMatch['player1'],
  fallbackNumber: 1 | 2,
  mIdx: number,
  bracket: BracketStructure,
  isPhase2OpeningRound: boolean
): string {
  const p1SourceNum = match.player1.sourceMatchId
    ? match.player1.sourceMatchId.match(/-m(\d+)$/)?.[1]
    : undefined;
  const p2SourceNum = match.player2.sourceMatchId
    ? match.player2.sourceMatchId.match(/-m(\d+)$/)?.[1]
    : undefined;

  if (isPhase2OpeningRound) {
    return fallbackNumber === 1
      ? `Winner of Accel #${p1SourceNum || mIdx + 1}`
      : `Winner of Play-off #${p2SourceNum || mIdx + 1}`;
  }
  if (match.roundIdentifier === '2C') {
    return fallbackNumber === 1
      ? `Winner of Lower Bracket R2 M#${mIdx + 1}`
      : `Loser of Accelerated Round M#${p2SourceNum || mIdx + 1}`;
  }
  if (match.roundIdentifier === 'PO') {
    return fallbackNumber === 1
      ? `Winner of Upper Bracket R2 M#${mIdx + 1}`
      : `Winner of Lower Bracket R3 M#${mIdx + 1}`;
  }
  if (match.roundIdentifier === 'PRE_L1') {
    return `Loser of Upper Bracket R1`;
  }
  if (match.roundIdentifier === 'PRE_L2') {
    return fallbackNumber === 1
      ? `Winner of Lower Bracket R1 M#${mIdx + 1}`
      : `Loser of Upper Bracket R1`;
  }
  if (!slot.sourceMatchId) return 'TBD';
  const src = bracket.matchesById[slot.sourceMatchId];
  if (!src) return 'TBD';
  const isLoserDrop = match.stage === 'LOSERS' && src.stage === 'WINNERS';
  return `${isLoserDrop ? 'Loser' : 'Winner'} of M#${src.matchNumber || fallbackNumber}`;
}

/**
 * Pure per-match derivation shared by the full (BracketMatchCard) and compact
 * (CompactMatchCard) bracket views: names, placeholders, match wins and result flags.
 */
export function getMatchCardModel(args: {
  match: BracketMatch;
  mIdx: number;
  bracket: BracketStructure;
  tier: TournamentTier;
  record: MatchScoreRecord | undefined;
  /** Accelerated Hybrid only: the match is in the first Top-C round (Phase 2 view). */
  isPhase2OpeningRound?: boolean;
}): MatchCardModel {
  const { match, mIdx, bracket, tier, record, isPhase2OpeningRound = false } = args;
  const p1 = match.player1.player;
  const p2 = match.player2.player;

  const p1EffectiveName = getEffectivePlayerName(p1);
  const p2EffectiveName = getEffectivePlayerName(p2);
  const p1Name = p1EffectiveName || getSlotPlaceholder(match, match.player1, 1, mIdx, bracket, isPhase2OpeningRound);
  const p2Name = p2EffectiveName || getSlotPlaceholder(match, match.player2, 2, mIdx, bracket, isPhase2OpeningRound);

  const p1Wins = record?.player1Wins || 0;
  const p2Wins = record?.player2Wins || 0;
  const matchBestOf = record?.bestOf || match.bestOf || tier.bestOf || 5;
  const hasTieGame = Boolean(
    record?.games?.some(
      (g: GameScoreEntry) =>
        g.winnerPlayerId === 'TIE' ||
        (g.player1Points !== null && g.player1Points === g.player2Points && g.player1Points > 0)
    )
  );
  const hasTiebreaker = Boolean(
    record?.hasTiebreaker || hasTieGame || (record?.games && record.games.length > matchBestOf)
  );
  const p1ScoreDisplay = hasTiebreaker ? `${p1Wins} (t)` : `${p1Wins}`;
  const p2ScoreDisplay = hasTiebreaker ? `${p2Wins} (t)` : `${p2Wins}`;

  const isPlayable = isMatchPlayable(match);
  const isComplete = Boolean(
    (p1?.id && match.winnerId === p1.id) ||
      (p2?.id && match.winnerId === p2.id) ||
      record?.isComplete
  );
  const inProgress = !isComplete && (p1Wins > 0 || p2Wins > 0);
  const p1Won = Boolean(p1?.id && (match.winnerId === p1.id || record?.winnerPlayerId === p1.id));
  const p2Won = Boolean(p2?.id && (match.winnerId === p2.id || record?.winnerPlayerId === p2.id));
  const p1Leading = inProgress && p1Wins > p2Wins;
  const p2Leading = inProgress && p2Wins > p1Wins;

  return {
    p1: {
      name: p1Name,
      isPlaceholder: !p1EffectiveName,
      seed: p1EffectiveName ? p1?.seed ?? null : null,
      winsDisplay: p1ScoreDisplay,
      won: p1Won,
      leading: p1Leading,
    },
    p2: {
      name: p2Name,
      isPlaceholder: !p2EffectiveName,
      seed: p2EffectiveName ? p2?.seed ?? null : null,
      winsDisplay: p2ScoreDisplay,
      won: p2Won,
      leading: p2Leading,
    },
    isComplete,
    inProgress,
    isPlayable,
  };
}

/**
 * Whether a match sits in the losers (lower) bracket, which takes the lower-bracket accent color.
 */
export function isLosersBracketMatch(match: BracketMatch, round: BracketRound): boolean {
  return Boolean(
    match.stage === 'LOSERS' ||
      round.stage === 'LOSERS' ||
      match.roundIdentifier?.startsWith('L') ||
      round.roundIdentifier?.startsWith('L') ||
      match.id?.toLowerCase().includes('-l') ||
      match.id?.toLowerCase().includes('loser') ||
      round.name?.toLowerCase().includes('loser') ||
      round.name?.toLowerCase().includes('lower') ||
      round.name?.startsWith('LR') ||
      round.name?.includes('(L)')
  );
}

/**
 * Whether the bracket is double elimination (by tier, bracket, or the presence of losers rounds).
 */
export function isDoubleElimBracket(bracket: BracketStructure, tier: TournamentTier): boolean {
  return (
    tier.eliminationType === 'DOUBLE' ||
    bracket?.eliminationType === 'DOUBLE' ||
    Boolean(bracket?.rounds?.some((r: BracketRound) => r.stage === 'LOSERS' || r.name?.toLowerCase().includes('loser')))
  );
}
