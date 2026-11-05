import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { deriveLeaderboard } from '../scoring';
import { LeaderboardCardList } from '../components/LeaderboardCardList';
import { renderPointsBreakdown, type CutoffInfo } from '../components/LeaderboardTable';
import type { Tournament, QualifierSubmission, PlayerProfile, TournamentTier, QualFormat } from '../../tournament/types';
import { generateTraditionalBracket } from '../../bracket/math';
import { THEME_FALLBACK } from '../../../theme/palette';

const players: PlayerProfile[] = [
  { id: 'p1', name: 'Alice', personalBest: 1200000, playstyle: 'Rolling' },
  { id: 'p2', name: 'Bob', personalBest: 1100000, playstyle: 'DAS' },
  { id: 'p3', name: 'Charlie', personalBest: 1050000, playstyle: 'DAS' },
];

const submissions: QualifierSubmission[] = [
  { id: 's1', tournamentId: 't1', playerId: 'p1', score: 1000000, submittedAt: 100 },
  { id: 's2', tournamentId: 't1', playerId: 'p1', score: 900000, submittedAt: 150 },
  { id: 's3', tournamentId: 't1', playerId: 'p2', score: 850000, submittedAt: 200 },
  { id: 's4', tournamentId: 't1', playerId: 'p2', score: 800000, submittedAt: 250 },
  { id: 's5', tournamentId: 't1', playerId: 'p3', score: 600000, submittedAt: 300 },
];

const goldTier: TournamentTier = {
  id: 'gold',
  slug: 'gold',
  name: 'Gold',
  priority: 1,
  bracketType: 'TRADITIONAL',
  playerCount: 2,
  bestOf: 5,
  bracket: generateTraditionalBracket(
    [{ id: 'p1', name: 'Alice', seed: 1 }, { id: 'p2', name: 'Bob', seed: 2 }],
    { tierId: 'gold' }
  ),
  isLocked: false,
};

function buildTournament(qualFormat: QualFormat, tiers: TournamentTier[] = []): Tournament {
  return {
    id: 't1',
    organizationId: 'org_test',
    slug: 't1-slug',
    name: 'Card List Test',
    location: 'Online',
    qualFormat,
    qualAverageCount: 2,
    pointsConfig: [
      { minScore: 999999, points: 5 },
      { minScore: 800000, points: 2 },
    ],
    isLocked: false,
    tiers,
    matchScores: {},
    playersPool: players,
    qualifierSubmissions: submissions,
    tournamentPlayers: {},
  };
}

function cutoffsFor(tournament: Tournament): Map<number, CutoffInfo> {
  const map = new Map<number, CutoffInfo>();
  let running = 0;
  [...tournament.tiers].sort((a, b) => a.priority - b.priority).forEach(tier => {
    running += tier.playerCount;
    map.set(running, { tierName: tier.name, color: THEME_FALLBACK.primaryColor, count: tier.playerCount });
  });
  return map;
}

function render(tournament: Tournament) {
  const rows = deriveLeaderboard(tournament);
  const html = renderToStaticMarkup(
    <LeaderboardCardList
      rows={rows}
      format={tournament.qualFormat}
      hasBrackets={tournament.tiers.length > 0}
      cutoffRanks={cutoffsFor(tournament)}
      isObsMode={false}
      onSelectRow={vi.fn()}
    />
  );
  return { rows, html };
}

const expectedPrimary: Record<QualFormat, Record<string, string>> = {
  AVERAGE_OF_X: { Alice: '950,000', Bob: '825,000', Charlie: '600,000' },
  HIGH_SCORE: { Alice: '1 Max', Bob: '0 Maxes', Charlie: '0 Maxes' },
  POINTS: { Alice: '7 pts', Bob: '4 pts', Charlie: '0 pts' },
};

describe('LeaderboardCardList', () => {
  (['AVERAGE_OF_X', 'HIGH_SCORE', 'POINTS'] as QualFormat[]).forEach(format => {
    it(`renders rank, name and primary metric for every ${format} row`, () => {
      const { rows, html } = render(buildTournament(format));
      expect(rows).toHaveLength(3);
      rows.forEach(row => {
        expect(row.rank).toBeDefined();
        expect(html).toContain(`>${row.rank}</span>`);
        expect(html).toContain(row.player.name);
        expect(html).toContain(`>${expectedPrimary[format][row.player.name]}</span>`);
      });
    });
  });

  it('shows maxes as the headline and the highest non-max as the kicker', () => {
    const { html } = render(buildTournament('HIGH_SCORE'));
    expect(html).toContain('Kicker 900,000');
    expect(html).toContain('Kicker 850,000');
    expect(html).not.toContain('Kicker 1,000,000');
  });

  it('leaves out the playstyle chip, attempt scores and points breakdown', () => {
    expect(render(buildTournament('HIGH_SCORE')).html).not.toContain('>Roll<');
    expect(render(buildTournament('AVERAGE_OF_X')).html).not.toContain('1,000,000');
    expect(render(buildTournament('POINTS')).html).not.toContain('+5');
  });

  it('renders verified status as an icon box with no text label', () => {
    const tournament = buildTournament('AVERAGE_OF_X');
    tournament.qualRuns = [
      { id: 'r1', tournamentId: 't1', playerId: 'p1', status: 'VERIFIED', source: 'IN_PERSON' },
      { id: 'r2', tournamentId: 't1', playerId: 'p2', status: 'SUBMITTED', source: 'ONLINE' },
    ] as unknown as Tournament['qualRuns'];
    const { html, rows } = render(tournament);
    const statuses = rows.map(row => row.status);
    if (statuses.includes('verified')) expect(html).toContain('aria-label="Verified"');
    if (statuses.includes('awaiting verification')) expect(html).toContain('aria-label="Unverified"');
    expect(html).not.toContain('Awaiting Verification');
    expect(html).not.toContain('> Verified<');
  });

  it('desktop points chips show the score behind each award on hover', () => {
    const tournament = buildTournament('POINTS');
    const row = deriveLeaderboard(tournament).find(r => r.player.id === 'p1')!;
    const html = renderToStaticMarkup(<>{renderPointsBreakdown(row, tournament)}</>);
    expect(html).toContain('title="1,000,000"');
    expect(html).toContain('+5');
    expect(html).toContain('title="900,000"');
    expect(html).toContain('+2');
  });

  it('renders one cutoff separator when a tier cutoff falls inside the rows', () => {
    const { html } = render(buildTournament('HIGH_SCORE', [goldTier]));
    expect(html.match(/role="separator"/g)).toHaveLength(1);
    expect(html).toContain('▲ Gold Cutoff (2 competitors advance to Gold) ▲');
  });

  it('renders no separator without brackets', () => {
    const { html } = render(buildTournament('AVERAGE_OF_X'));
    expect(html).not.toContain('role="separator"');
  });
});
