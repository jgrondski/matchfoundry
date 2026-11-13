import { describe, expect, it } from 'vitest';
import { generateTraditionalBracket } from '../traditional';
import { generateFlatBracket } from '../flat';
import {
  generateAcceleratedHybrid,
  generateFlatDoubleElim,
  generateTraditionalDoubleElim,
} from '../double-elimination';
import { advanceMatchWinner, retractMatchWinner } from '../advance';
import type { BracketStructure, SeededPlayer } from '../../types';

// Regression: undoing a result (a forfeit, or a score edited back to no winner) used to blank
// the competitors of the undone match itself, and of the winner's earlier matches, because
// the cleanup searched the whole bracket for the winner's and loser's IDs.

const players = (count: number): SeededPlayer[] =>
  Array.from({ length: count }, (_, i) => ({ id: `p${i + 1}`, name: `Player ${i + 1}`, seed: i + 1 }));

const formats: Array<[string, () => BracketStructure]> = [
  ['single elimination', () => generateTraditionalBracket(players(12), { tierId: 't' })],
  ['flat', () => generateFlatBracket(players(12), 4, { tierId: 't' })],
  ['traditional double elimination', () => generateTraditionalDoubleElim(players(12), { tierId: 't' })],
  ['flat staged double elimination', () => generateFlatDoubleElim(players(12), 4, { tierId: 't' })],
  ['accelerated hybrid', () => generateAcceleratedHybrid(players(12), 4, { tierId: 't' })],
];

/** Plays every ready match (player 1 wins) until nothing is left to play. */
function playOut(bracket: BracketStructure): BracketStructure {
  for (let guard = 0; guard < 200; guard++) {
    const ready = Object.values(bracket.matchesById).find(
      m => !m.isBye && !m.winnerId && m.player1.player && m.player2.player
    );
    if (!ready) return bracket;
    bracket = advanceMatchWinner(bracket, ready.id, ready.player1.player!.id);
  }
  throw new Error('bracket did not finish');
}

/** The match plus every match its winner or loser can reach. */
function downstreamOf(bracket: BracketStructure, matchId: string): Set<string> {
  const seen = new Set<string>();
  const queue = [matchId];
  while (queue.length) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    const m = bracket.matchesById[id];
    if (!m) continue;
    if (m.nextMatchId) queue.push(m.nextMatchId);
    if (m.loserNextMatchId) queue.push(m.loserNextMatchId);
    for (const other of Object.values(bracket.matchesById)) {
      if (other.player1.sourceMatchId === id || other.player2.sourceMatchId === id) queue.push(other.id);
    }
  }
  return seen;
}

const slots = (bracket: BracketStructure, id: string) => {
  const m = bracket.matchesById[id];
  return [m?.player1.player?.id ?? null, m?.player2.player?.id ?? null];
};

describe('retractMatchWinner keeps competitors outside the undone result', () => {
  for (const [name, build] of formats) {
    it(`${name}: undoing any result leaves that match and all earlier matches intact`, () => {
      const finished = playOut(build());
      const completed = Object.values(finished.matchesById).filter(m => m.winnerId && !m.isBye);
      expect(completed.length).toBeGreaterThan(0);

      for (const match of completed) {
        const retracted = retractMatchWinner(finished, match.id);
        const affected = downstreamOf(finished, match.id);

        expect(slots(retracted, match.id), `${match.id} kept its competitors`).toEqual(slots(finished, match.id));
        expect(retracted.matchesById[match.id].winnerId).toBeNull();

        for (const other of Object.values(finished.matchesById)) {
          if (affected.has(other.id)) continue;
          expect(slots(retracted, other.id), `${other.id} untouched when undoing ${match.id}`).toEqual(
            slots(finished, other.id)
          );
          expect(retracted.matchesById[other.id]?.winnerId).toBe(other.winnerId);
        }
      }
    });
  }

  it('awarding a forfeit, undoing it, then awarding and undoing the other side keeps both competitors', () => {
    let bracket = generateTraditionalBracket(players(12), { tierId: 't' });
    const match = Object.values(bracket.matchesById).find(m => !m.isBye && m.player1.player && m.player2.player)!;
    const [a, b] = slots(bracket, match.id) as [string, string];

    bracket = advanceMatchWinner(bracket, match.id, a);
    bracket = retractMatchWinner(bracket, match.id);
    expect(slots(bracket, match.id)).toEqual([a, b]);

    bracket = advanceMatchWinner(bracket, match.id, b);
    bracket = retractMatchWinner(bracket, match.id);
    expect(slots(bracket, match.id)).toEqual([a, b]);
    expect(bracket.matchesById[match.nextMatchId!].player1.player?.id ?? null).not.toBe(b);
    expect(bracket.matchesById[match.nextMatchId!].player2.player?.id ?? null).not.toBe(b);
  });
});
