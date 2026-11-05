import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createDefaultTier } from '../defaults';
import type { GlobalStandingRow, PlayerTournamentStats } from '../standings';
import { FinalStandingsCardList } from '../components/FinalStandingsCardList';

const gold = createDefaultTier(1, { id: 'gold', name: 'Gold' });

const stats = (overrides: Partial<PlayerTournamentStats> = {}): PlayerTournamentStats => ({
  matchesPlayed: 2,
  matchesWon: 1,
  matchesLost: 1,
  matchRecordDisplay: '1–1',
  gamesWon: 3,
  gamesLost: 2,
  gameRecordDisplay: '3–2',
  totalGameScore: 2_500_000,
  totalGamesWithScore: 5,
  overallGameAvg: 500_000,
  ...overrides,
});

const rows: GlobalStandingRow[] = [
  {
    finalRank: 1,
    rankLabel: '1st Place (Champion)',
    player: { id: 'p1', name: 'Alpha Card', country: 'US', playstyle: 'DAS' },
    tier: gold,
    eliminationRound: 'Champion',
    stats: stats({ matchesWon: 2, matchesLost: 0, matchRecordDisplay: '2–0' }),
    qualScore: 1_200_000,
    qualRank: 2,
    rankDelta: 1,
    isDNQ: false,
    isDisqualified: false,
  },
  {
    finalRank: 2,
    rankLabel: '2nd Place (Runner-up)',
    player: { id: 'p2', name: 'Bravo Card', country: 'CA' },
    tier: gold,
    eliminationRound: 'Finals',
    exitDetails: {
      matchId: 'm-final',
      roundName: 'Finals',
      opponentId: 'p1',
      opponentName: 'Alpha Card',
      playerWins: 1,
      opponentWins: 2,
      scoreDisplay: '1–2',
      avgLossScore: 480_000,
    },
    stats: stats(),
    qualScore: 1_300_000,
    qualRank: 1,
    rankDelta: -1,
    isDNQ: false,
    isDisqualified: false,
  },
  {
    finalRank: 3,
    rankLabel: '3rd Place',
    player: { id: 'p3', name: 'Charlie Card' },
    eliminationRound: 'Did Not Qualify',
    stats: stats({ matchesPlayed: 0, matchesWon: 0, matchesLost: 0, matchRecordDisplay: '0–0', overallGameAvg: 0 }),
    qualScore: 400_000,
    qualRank: 3,
    isDNQ: true,
    isDisqualified: false,
  },
];

const render = (isObsMode = false) =>
  renderToStaticMarkup(<FinalStandingsCardList rows={rows} isObsMode={isObsMode} onSelectPlayer={() => {}} />);

describe('FinalStandingsCardList', () => {
  it('renders every row with its rank, name and stage label', () => {
    const html = render();
    const items = html.split('<li').slice(1);
    expect(items).toHaveLength(3);

    const expected = [
      { rank: '1', name: 'Alpha Card', stage: 'Champion' },
      { rank: '2', name: 'Bravo Card', stage: 'Finals' },
      { rank: '3', name: 'Charlie Card', stage: 'Did Not Qualify' },
    ];
    expected.forEach(({ rank, name, stage }, i) => {
      expect(items[i]).toContain(`font-black text-fg">${rank}</span>`);
      expect(items[i]).toContain(name);
      expect(items[i]).toContain(`>${stage}</span>`);
    });
  });

  it('shows the match record instead of a Details disclosure or qual score', () => {
    const html = render();
    expect(html).not.toContain('<details>');
    expect(html).not.toContain('1,200,000');
    expect(html).toContain('2–0');
    expect(html).toContain('1–1');
  });

  it('makes each card a button, except in OBS mode', () => {
    expect(render().split('title="View Competitor"').length - 1).toBe(3);
    expect(render(true)).not.toContain('View Competitor');
  });
});
