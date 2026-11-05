import { describe, it, expect } from 'vitest';
import { generateTraditionalBracket, generateDoubleEliminationBracket } from '../math';
import { calculateBracketLayout, supportsCompactView, MatchPosition, COMPACT_LAYOUT_CONFIG } from '../bracketLayout';
import { getMatchCardModel } from '../matchCardModel';
import { BracketStructure } from '../types';
import { MatchScoreRecord, TournamentTier } from '../../tournament/types';

const makePlayers = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}`, name: `Player ${i + 1}`, seed: i + 1 }));

const overlaps = (a: MatchPosition, b: MatchPosition) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

const expectCompactGeometry = (bracket: BracketStructure) => {
  const layout = calculateBracketLayout(bracket, undefined, 'compact');
  expect(layout.viewMode).toBe('compact');
  const positions = Object.values(layout.matchPositions);
  expect(positions.length).toBeGreaterThan(0);
  for (const pos of positions) {
    expect(pos.width).toBe(136);
    expect(pos.height).toBe(44);
  }
  for (let i = 0; i < positions.length; i++) {
    for (let j = i + 1; j < positions.length; j++) {
      expect(overlaps(positions[i], positions[j]), `${positions[i].matchId} overlaps ${positions[j].matchId}`).toBe(false);
    }
  }
  return layout;
};

const makeTier = (bracket: BracketStructure): TournamentTier => ({
  id: 'gold',
  slug: 'gold',
  name: 'Gold',
  priority: 1,
  bracketType: 'TRADITIONAL',
  eliminationType: 'SINGLE',
  bestOf: 3,
  playerCount: 8,
  bracket,
  isLocked: true,
} as TournamentTier);

const makeRecord = (matchId: string, overrides: Partial<MatchScoreRecord>): MatchScoreRecord => ({
  matchId,
  tierId: 'gold',
  bestOf: 3,
  player1Wins: 0,
  player2Wins: 0,
  games: [],
  winnerPlayerId: null,
  loserPlayerId: null,
  isComplete: false,
  ...overrides,
});

describe('compact bracket layout', () => {
  it.each([8, 13, 16])('single elim %i players: 136x44 matches with no overlaps', (n) => {
    expectCompactGeometry(generateTraditionalBracket(makePlayers(n), { tierId: 'gold' }));
  });

  it('double elim 16 players: 136x44 matches with no overlaps', () => {
    expectCompactGeometry(generateDoubleEliminationBracket(makePlayers(16), { tierId: 'gold' }));
  });

  it.each([8, 13, 16])('single elim %i players: byes never get a position (N-1 matches)', (n) => {
    const layout = calculateBracketLayout(generateTraditionalBracket(makePlayers(n), { tierId: 'gold' }), undefined, 'compact');
    expect(Object.keys(layout.matchPositions)).toHaveLength(n - 1);
  });
});

describe('compact cards in other view modes', () => {
  const singles = generateTraditionalBracket(makePlayers(16), { tierId: 'gold' });
  const doubles = generateDoubleEliminationBracket(makePlayers(16), { tierId: 'gold' });

  it.each([
    ['single elim split', singles, 'split'],
    ['single elim fit', singles, 'fit'],
    ['double elim split', doubles, 'split'],
    ['double elim fit', doubles, 'fit'],
  ] as const)('%s: 136x44 matches with no overlaps', (_name, bracket, mode) => {
    const layout = calculateBracketLayout(bracket, COMPACT_LAYOUT_CONFIG, mode);
    const positions = Object.values(layout.matchPositions);
    expect(positions.length).toBeGreaterThan(0);
    for (const pos of positions) {
      expect(pos.width).toBe(136);
      expect(pos.height).toBe(44);
    }
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        expect(overlaps(positions[i], positions[j]), `${positions[i].matchId} overlaps ${positions[j].matchId}`).toBe(false);
      }
    }
  });
});

describe('supportsCompactView', () => {
  const base = generateTraditionalBracket(makePlayers(8), { tierId: 'gold' });

  it('is false for Accelerated Hybrid and Flat Staged', () => {
    expect(supportsCompactView({ ...base, bracketRouting: 'ACCELERATED_HYBRID' })).toBe(false);
    expect(supportsCompactView({ ...base, bracketRouting: 'FLAT_STAGED' })).toBe(false);
  });

  it('is true for TRADITIONAL, TRADITIONAL_TREE and unset routing', () => {
    expect(supportsCompactView({ ...base, bracketRouting: 'TRADITIONAL' })).toBe(true);
    expect(supportsCompactView({ ...base, bracketRouting: 'TRADITIONAL_TREE' })).toBe(true);
    expect(supportsCompactView({ ...base, bracketRouting: undefined })).toBe(true);
  });
});

describe('getMatchCardModel', () => {
  const bracket = generateTraditionalBracket(makePlayers(8), { tierId: 'gold' });
  const tier = makeTier(bracket);
  const firstMatch = bracket.rounds[0].matches[0];
  const p1Id = firstMatch.player1.player!.id;
  const p2Id = firstMatch.player2.player!.id;

  it('a decided match marks exactly one side won', () => {
    const record = makeRecord(firstMatch.id, {
      player1Wins: 2,
      player2Wins: 1,
      winnerPlayerId: p1Id,
      loserPlayerId: p2Id,
      isComplete: true,
    });
    const model = getMatchCardModel({ match: firstMatch, mIdx: 0, bracket, tier, record });
    expect(model.isComplete).toBe(true);
    expect([model.p1.won, model.p2.won].filter(Boolean)).toHaveLength(1);
    expect(model.p1.won).toBe(true);
    expect(model.p1.winsDisplay).toBe('2');
    expect(model.p2.winsDisplay).toBe('1');
  });

  it('a tiebreaker produces "N (t)"', () => {
    const record = makeRecord(firstMatch.id, { player1Wins: 2, player2Wins: 1, hasTiebreaker: true });
    const model = getMatchCardModel({ match: firstMatch, mIdx: 0, bracket, tier, record });
    expect(model.p1.winsDisplay).toBe('2 (t)');
    expect(model.p2.winsDisplay).toBe('1 (t)');
  });

  it('an empty slot is a placeholder with no seed', () => {
    const laterMatch = bracket.rounds[1].matches[0];
    const model = getMatchCardModel({ match: laterMatch, mIdx: 0, bracket, tier, record: undefined });
    expect(model.p1.isPlaceholder).toBe(true);
    expect(model.p1.seed).toBeNull();
    expect(model.p1.name).toMatch(/^(Winner of M#\d+|TBD)$/);
  });
});
