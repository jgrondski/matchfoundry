import { describe, expect, it } from 'vitest';
import {
  TIE,
  bestOfChoices,
  canChangeBestOf,
  gameOutcome,
  matchPhase,
  reopenBlockers,
  summarizeSeries,
  validateMatchGames,
  visibleGameCount,
  type GameInput,
} from '../matchRules';
import { generateTraditionalBracket } from '../math/traditional';
import { generateTraditionalDoubleElim } from '../math/double-elimination';
import { advanceMatchWinner } from '../math/advance';
import type { BracketMatch } from '../types';
import type { MatchScoreRecord } from '../../tournament/types';

const A = 'a';
const B = 'b';
const g = (p1: number | null, p2: number | null, winner: string | null = null): GameInput => ({
  player1Points: p1,
  player2Points: p2,
  winnerPlayerId: winner,
});
const record = (games: GameInput[], extra: Partial<MatchScoreRecord> = {}): MatchScoreRecord => ({
  matchId: 'm',
  tierId: 't',
  bestOf: 3,
  player1Wins: 0,
  player2Wins: 0,
  games: games.map((x, i) => ({ gameNumber: i + 1, ...x })),
  winnerPlayerId: null,
  loserPlayerId: null,
  isComplete: false,
  ...extra,
});
const players = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}`, name: `P${i + 1}`, seed: i + 1 }));

describe('gameOutcome', () => {
  it('derives the winner from the scores, ignoring a hand-picked winner', () => {
    expect(gameOutcome(g(900, 100, B), A, B)).toBe(A);
    expect(gameOutcome(g(100, 900), A, B)).toBe(B);
    expect(gameOutcome(g(665, 665), A, B)).toBe(TIE);
  });

  it('treats 0-0 as not played', () => {
    expect(gameOutcome(g(0, 0), A, B)).toBeNull();
  });

  it('uses a hand-picked winner only when scores are missing', () => {
    expect(gameOutcome(g(null, null, B), A, B)).toBe(B);
    expect(gameOutcome(g(900, null, B), A, B)).toBe(B);
    expect(gameOutcome(g(null, null, 'someone-else'), A, B)).toBeNull();
  });
});

describe('summarizeSeries', () => {
  it('stops at the game that decides the series', () => {
    const s = summarizeSeries([g(900, 100), g(900, 100), g(100, 900)], 3, A, B);
    expect(s).toEqual({ p1Wins: 2, p2Wins: 0, winnerId: A, decidedAtIndex: 1 });
  });

  it('does not count a tie toward either side', () => {
    const s = summarizeSeries([g(665, 665), g(900, 100)], 3, A, B);
    expect(s).toEqual({ p1Wins: 1, p2Wins: 0, winnerId: null, decidedAtIndex: -1 });
  });
});

describe('visibleGameCount', () => {
  it('shows one empty row for a fresh match', () => {
    expect(visibleGameCount([], 3, A, B)).toBe(1);
  });

  it('adds the next row only after the current game is finished', () => {
    expect(visibleGameCount([g(900, null)], 3, A, B)).toBe(1);
    expect(visibleGameCount([g(900, 100)], 3, A, B)).toBe(2);
  });

  it('stops adding rows once the series is decided', () => {
    expect(visibleGameCount([g(900, 100), g(900, 100)], 3, A, B)).toBe(2);
  });

  it('gives a tied game a tiebreaker row beyond the best-of', () => {
    expect(visibleGameCount([g(665, 665), g(900, 100), g(100, 900)], 3, A, B)).toBe(4);
  });

  it('keeps rows that still hold data past the deciding game so they can be cleared', () => {
    expect(visibleGameCount([g(900, 100), g(900, 100), g(100, 900)], 3, A, B)).toBe(3);
  });
});

describe('validateMatchGames', () => {
  it('accepts a normal series and a series with a tiebreaker', () => {
    expect(validateMatchGames([g(900, 100, A), g(100, 900, B), g(900, 100, A)], 3, A, B)).toBeNull();
    expect(validateMatchGames([g(665, 665, TIE), g(900, 100), g(900, 100)], 3, A, B)).toBeNull();
  });

  it('accepts an in-progress last game with one score entered', () => {
    expect(validateMatchGames([g(900, 100), g(500, null)], 3, A, B)).toBeNull();
  });

  it('requires both competitors', () => {
    expect(validateMatchGames([], 3, A, undefined)).toMatch(/Both competitors/);
  });

  it('rejects out-of-range scores', () => {
    expect(validateMatchGames([g(100_000_000, 1)], 3, A, B)).toMatch(/99,999,999/);
    expect(validateMatchGames([g(1.5, 1)], 3, A, B)).toMatch(/whole numbers/);
  });

  it('rejects a winner from outside the match or one that contradicts the scores', () => {
    expect(validateMatchGames([g(null, null, 'zed')], 3, A, B)).toMatch(/not in this match/);
    expect(validateMatchGames([g(900, 100, B)], 3, A, B)).toMatch(/does not match/);
    expect(validateMatchGames([g(665, 665, A)], 3, A, B)).toMatch(/does not match/);
  });

  it('rejects gaps and games after the decision', () => {
    expect(validateMatchGames([g(null, null), g(900, 100)], 3, A, B)).toMatch(/Game 1 must be finished/);
    expect(validateMatchGames([g(900, 100), g(900, 100), g(1, 2)], 3, A, B)).toMatch(/decided in Game 2/);
  });

  it('rejects an even or non-positive best-of', () => {
    expect(validateMatchGames([], 4, A, B)).toMatch(/not a valid format/);
    expect(validateMatchGames([], 0, A, B)).toMatch(/not a valid format/);
  });
});

describe('best-of', () => {
  it('offers 1, 3, 5 and 7 plus the match default', () => {
    expect(bestOfChoices(3)).toEqual([1, 3, 5, 7]);
    expect(bestOfChoices(9)).toEqual([1, 3, 5, 7, 9]);
    expect(bestOfChoices(undefined)).toEqual([1, 3, 5, 7]);
  });

  it('can change only before any game is scored', () => {
    expect(canChangeBestOf(undefined)).toBe(true);
    expect(canChangeBestOf(record([g(null, null)]))).toBe(true);
    expect(canChangeBestOf(record([g(900, null)]))).toBe(false);
    expect(canChangeBestOf(record([], { isComplete: true }))).toBe(false);
  });
});

describe('matchPhase', () => {
  const bracket = generateTraditionalBracket(players(8), { tierId: 't' });
  const r1 = bracket.matchesById['t-r1-m1'] ?? Object.values(bracket.matchesById).find(m => m.roundNumber === 1)!;
  const r2 = Object.values(bracket.matchesById).find(m => m.roundNumber === 2)!;

  it('is WAITING while a competitor is missing', () => {
    expect(matchPhase(r2, undefined)).toBe('WAITING');
  });

  it('is READY, then IN_PROGRESS, then COMPLETE', () => {
    expect(matchPhase(r1, undefined)).toBe('READY');
    expect(matchPhase(r1, record([g(900, 100)]))).toBe('IN_PROGRESS');
    expect(matchPhase({ ...r1, winnerId: r1.player1.player!.id } as BracketMatch, undefined)).toBe('COMPLETE');
    expect(matchPhase(r1, record([], { isComplete: true }))).toBe('COMPLETE');
  });
});

describe('reopenBlockers', () => {
  it('is empty while the next match has no scores', () => {
    let bracket = generateTraditionalBracket(players(8), { tierId: 't' });
    const m = Object.values(bracket.matchesById).find(x => x.roundNumber === 1)!;
    bracket = advanceMatchWinner(bracket, m.id, m.player1.player!.id);
    expect(reopenBlockers(bracket, {}, m.id)).toEqual([]);
  });

  it('names the next match once it has a scored game', () => {
    let bracket = generateTraditionalBracket(players(8), { tierId: 't' });
    const m = Object.values(bracket.matchesById).find(x => x.roundNumber === 1)!;
    bracket = advanceMatchWinner(bracket, m.id, m.player1.player!.id);
    const blockers = reopenBlockers(bracket, { [m.nextMatchId!]: record([g(900, null)]) }, m.id);
    expect(blockers.map(b => b.id)).toEqual([m.nextMatchId]);
  });

  it('includes the losers-bracket match in double elimination', () => {
    let bracket = generateTraditionalDoubleElim(players(8), { tierId: 't' });
    const m = Object.values(bracket.matchesById).find(x => x.roundIdentifier === 'W1')!;
    bracket = advanceMatchWinner(bracket, m.id, m.player1.player!.id);
    const blockers = reopenBlockers(bracket, { [m.loserNextMatchId!]: record([g(900, null)]) }, m.id);
    expect(blockers.map(b => b.id)).toEqual([m.loserNextMatchId]);
  });

  it('does not block on an unrelated match', () => {
    let bracket = generateTraditionalBracket(players(8), { tierId: 't' });
    const [m1, , m3] = Object.values(bracket.matchesById).filter(x => x.roundNumber === 1);
    bracket = advanceMatchWinner(bracket, m1.id, m1.player1.player!.id);
    expect(reopenBlockers(bracket, { [m3.id]: record([g(900, 100)]) }, m1.id)).toEqual([]);
  });
});
