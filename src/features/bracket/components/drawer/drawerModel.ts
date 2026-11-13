import type { BracketMatch, BracketStructure } from '../../types';
import type { MatchScoreRecord } from '../../../tournament/types';
import { TIE, gameOutcome, isGameStarted, summarizeSeries, visibleGameCount, type GameInput } from '../../matchRules';

/** One game row as typed: scores as plain digit strings, plus a winner picked by hand. */
export type GameDraft = { p1: string; p2: string; winner: string | null };

const EMPTY: GameDraft = { p1: '', p2: '', winner: null };

export function draftToInput(d: GameDraft): GameInput {
  return {
    player1Points: d.p1 === '' ? null : Number(d.p1),
    player2Points: d.p2 === '' ? null : Number(d.p2),
    winnerPlayerId: d.winner,
  };
}

const isEmptyDraft = (d: GameDraft) => !d.p1 && !d.p2 && !d.winner;

/**
 * Trims trailing empty rows, then pads with empty rows up to what the drawer should show:
 * the next game appears only once the current one is finished, and none appear after the
 * series is decided.
 */
export function normalizeDrafts(drafts: GameDraft[], bestOf: number, p1Id?: string, p2Id?: string): GameDraft[] {
  const out = drafts.map(d => ({ ...d }));
  while (out.length && isEmptyDraft(out[out.length - 1])) out.pop();
  const count = visibleGameCount(out.map(draftToInput), bestOf, p1Id, p2Id);
  while (out.length < count) out.push({ ...EMPTY });
  return out;
}

export function draftsFromRecord(
  record: MatchScoreRecord | undefined,
  bestOf: number,
  p1Id?: string,
  p2Id?: string
): GameDraft[] {
  const sorted = [...(record?.games || [])].sort((a, b) => a.gameNumber - b.gameNumber);
  const drafts = sorted.map(g => {
    const p1 = g.player1Points ?? null;
    const p2 = g.player2Points ?? null;
    const bothScored = p1 !== null && p2 !== null;
    return {
      p1: p1 === null ? '' : String(p1),
      p2: p2 === null ? '' : String(p2),
      // A stored winner only matters when it was picked by hand (scores missing).
      winner: bothScored ? null : g.winnerPlayerId && g.winnerPlayerId !== TIE ? g.winnerPlayerId : null,
    };
  });
  return normalizeDrafts(drafts, bestOf, p1Id, p2Id);
}

/** Equal if identical after dropping trailing empty games. */
export function gamesEqual(a: GameDraft[], b: GameDraft[]): boolean {
  const trim = (list: GameDraft[]) => {
    const out = [...list];
    while (out.length && isEmptyDraft(out[out.length - 1])) out.pop();
    return out;
  };
  return JSON.stringify(trim(a)) === JSON.stringify(trim(b));
}

/** The games as the API expects them, with each game's winner derived from its scores. */
export function draftsToPayload(drafts: GameDraft[], p1Id?: string, p2Id?: string) {
  const trimmed = [...drafts];
  while (trimmed.length && isEmptyDraft(trimmed[trimmed.length - 1])) trimmed.pop();
  return trimmed.map((d, idx) => {
    const input = draftToInput(d);
    return {
      gameNumber: idx + 1,
      player1Points: input.player1Points,
      player2Points: input.player2Points,
      winnerPlayerId: gameOutcome(input, p1Id, p2Id),
    };
  });
}

export function hasStartedGames(drafts: GameDraft[]): boolean {
  return drafts.some(d => isGameStarted(draftToInput(d)));
}

const nameOf = (m: BracketMatch, id: string | null | undefined) =>
  id === m.player1.player?.id ? m.player1.player?.name : id === m.player2.player?.id ? m.player2.player?.name : undefined;

/** Sentences for the Finish Match prompt: who wins, the score, and where both competitors go. */
export function finishSummary(
  bracket: BracketStructure | undefined,
  match: BracketMatch,
  drafts: GameDraft[],
  bestOf: number
): string[] {
  const p1Id = match.player1.player?.id;
  const p2Id = match.player2.player?.id;
  const series = summarizeSeries(drafts.map(draftToInput), bestOf, p1Id, p2Id);
  if (!series.winnerId) return [];
  const winner = nameOf(match, series.winnerId) ?? 'The winner';
  const loserId = series.winnerId === p1Id ? p2Id : p1Id;
  const loser = nameOf(match, loserId) ?? 'The other competitor';
  const high = Math.max(series.p1Wins, series.p2Wins);
  const low = Math.min(series.p1Wins, series.p2Wins);
  const next = match.nextMatchId ? bracket?.matchesById[match.nextMatchId] : undefined;
  const loserNext = match.loserNextMatchId ? bracket?.matchesById[match.loserNextMatchId] : undefined;

  const lines = [
    next
      ? `${winner} wins ${high}–${low} and advances to Match ${next.matchNumber}.`
      : `${winner} wins ${high}–${low} and wins the bracket.`,
  ];
  if (loserNext) lines.push(`${loser} drops to Match ${loserNext.matchNumber}.`);
  return lines;
}

/** Sentences for the Reopen Match prompt: who gets pulled back out of which match. */
export function reopenSummary(bracket: BracketStructure | undefined, match: BracketMatch): string[] {
  const lines: string[] = [];
  const next = match.nextMatchId ? bracket?.matchesById[match.nextMatchId] : undefined;
  const loserNext = match.loserNextMatchId ? bracket?.matchesById[match.loserNextMatchId] : undefined;
  const winner = nameOf(match, match.winnerId);
  const loser = nameOf(match, match.loserId);
  if (winner && next) lines.push(`Removes ${winner} from Match ${next.matchNumber}.`);
  if (loser && loserNext) lines.push(`Removes ${loser} from Match ${loserNext.matchNumber}.`);
  lines.push('The games stay so you can correct them.');
  return lines;
}

/** "Waiting on Match 3" text for a match that is missing a competitor. */
export function waitingOn(bracket: BracketStructure | undefined, match: BracketMatch): string {
  const feeders = [match.player1, match.player2]
    .filter(slot => !slot.player && slot.sourceMatchId)
    .map(slot => bracket?.matchesById[slot.sourceMatchId!]?.matchNumber)
    .filter((n): n is number => typeof n === 'number');
  if (feeders.length === 0) return 'Waiting for both competitors to be placed.';
  return `Waiting on ${feeders.map(n => `Match ${n}`).join(' and ')}.`;
}
