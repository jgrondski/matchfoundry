import { describe, it, expect } from 'vitest';
import { gamesEqual } from '../components/MatchScoreDrawer';

const empty = { p1: '', p2: '', winner: null };

describe('gamesEqual', () => {
  it('treats identical games as equal', () => {
    const games = [{ p1: '100', p2: '90', winner: 'a' }, empty];
    expect(gamesEqual(games, [...games.map(g => ({ ...g }))])).toBe(true);
  });

  it('ignores trailing empty games added by a Best-of change', () => {
    const base = [{ p1: '100', p2: '90', winner: 'a' }, empty, empty];
    expect(gamesEqual(base, [...base, empty, empty])).toBe(true);
    expect(gamesEqual([], [empty, empty, empty])).toBe(true);
  });

  it('detects an edited score', () => {
    expect(gamesEqual([empty, empty, empty], [{ p1: '123456', p2: '', winner: null }, empty, empty])).toBe(false);
  });

  it('detects a toggled winner', () => {
    const base = [{ p1: '5', p2: '5', winner: null }];
    expect(gamesEqual(base, [{ p1: '5', p2: '5', winner: 'TIE' }])).toBe(false);
  });

  it('does not ignore empty games in the middle', () => {
    const scored = { p1: '1', p2: '2', winner: 'b' };
    expect(gamesEqual([scored, empty, scored], [scored, scored])).toBe(false);
  });
});
