import { describe, it, expect } from 'vitest';
import { generateDoubleEliminationBracket, getDoubleEliminationConfigError } from '../math';
import { generateDraftBracketsForTournament } from '../../qualifiers/scoring';
import { createEmptyTournament, createDefaultTier } from '../../tournament/defaults';
import type { GenerateBracketOptions } from '../types';

const players = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}`, name: `Seed ${i + 1}`, seed: i + 1 }));

const configs: GenerateBracketOptions[] = [
  { bracketRouting: 'TRADITIONAL_TREE' },
  { bracketRouting: 'FLAT_STAGED', flatWidth: 4 },
  { bracketRouting: 'FLAT_STAGED', flatWidth: 8 },
  { bracketRouting: 'ACCELERATED_HYBRID', finalsCutoff: 8 },
  { bracketRouting: 'ACCELERATED_HYBRID', finalsCutoff: 16 },
];

describe('getDoubleEliminationConfigError', () => {
  it('flags exactly the configurations the generator rejects', () => {
    for (const config of configs) {
      for (let n = 2; n <= 40; n++) {
        let threw = false;
        try {
          generateDoubleEliminationBracket(players(n), config);
        } catch {
          threw = true;
        }
        const error = getDoubleEliminationConfigError(n, config);
        expect({ n, config, flagged: Boolean(error) }).toEqual({ n, config, flagged: threw });
      }
    }
  });

  it('explains the 9-player flat staged and accelerated hybrid cases', () => {
    expect(getDoubleEliminationConfigError(9, { bracketRouting: 'FLAT_STAGED', flatWidth: 4 })).toMatch(
      /multiple of 4 players \(e\.g\. 8 or 12\)/
    );
    expect(getDoubleEliminationConfigError(9, { bracketRouting: 'ACCELERATED_HYBRID', finalsCutoff: 8 })).toMatch(
      /exactly 8 or at least 10 players/
    );
  });
});

describe('generateDraftBracketsForTournament with an invalid double-elim tier', () => {
  it('returns an empty bracket for that tier instead of throwing', () => {
    const tournament = createEmptyTournament({ slug: 'nine', name: 'Nine' });
    tournament.tiers = [
      createDefaultTier(1, {
        id: 'tier-9',
        playerCount: 9,
        eliminationType: 'DOUBLE',
        bracketRouting: 'FLAT_STAGED',
        flatWidth: 4,
      }),
      createDefaultTier(2, { id: 'tier-8', playerCount: 8 }),
    ];

    const tiers = generateDraftBracketsForTournament(tournament);
    expect(tiers.find(t => t.id === 'tier-9')?.bracket.rounds).toEqual([]);
    expect(tiers.find(t => t.id === 'tier-8')?.bracket.rounds.length).toBeGreaterThan(0);
  });
});
