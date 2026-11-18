import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createEmptyTournament, createDefaultTier } from '../../tournament/defaults';
import { runFullSimulation } from '../../tournament/simulation';
import type { Tournament, QualifierSubmission } from '../../tournament/types';
import {
  DEFAULT_GUTTER_COUNT,
  getQualifierGutterRows,
  getStandingsGutterRows,
  parseGutterCount,
} from '../gutterRows';
import { ObsGutterList } from '../components/ObsGutterList';
import { DEFAULT_POINTS_THRESHOLDS } from '../../tournament/types';
import { CHROMA_KEY_COLORS } from '../../../theme/palette';

type Entry = [name: string, scores: number | number[] | null, displayName?: string];

function withScores(entries: Entry[], qualFormat: Tournament['qualFormat'] = 'AVERAGE_OF_X'): Tournament {
  const t = createEmptyTournament({ id: 't-g', slug: 'gutter', name: 'Gutter Cup', qualFormat });
  t.qualAverageCount = 2;
  t.playersPool = entries.map(([name, , displayName], i) => ({
    id: `p${i}`,
    name,
    displayName,
    personalBest: 0,
    playstyle: 'DAS',
  }));
  t.qualifierSubmissions = entries.flatMap(([, scores], i): QualifierSubmission[] =>
    scores === null
      ? []
      : [scores].flat().map((score, j) => ({
          id: `s${i}-${j}`,
          tournamentId: t.id,
          playerId: `p${i}`,
          score,
          submittedAt: 1000 + i * 10 + j,
        }))
  );
  return t;
}

const view = (t: Tournament) => getQualifierGutterRows(t).map(r => [r.rank, r.name, r.badge ?? null, r.value]);

describe('qualifier gutter rows', () => {
  it('Average of X shows the average, rounded, with the preferred name', () => {
    const t = withScores([
      ['Alpha', [900000, 800001]],
      ['Bravo Long Name', [700000, 600000], 'Bravo'],
      ['NoScore', null],
    ]);
    expect(view(t)).toEqual([
      [1, 'Alpha', null, (850001).toLocaleString()],
      [2, 'Bravo', null, (650000).toLocaleString()],
    ]);
  });

  it('Points shows total points', () => {
    // Default thresholds: 1,250,000 = 4 pts, 1,000,000 = 2 pts, 1,100,000 = 3 pts.
    const t = withScores(
      [
        ['Alpha', [1250000, 1000000]],
        ['Bravo', [1100000]],
        ['LowPeak', [400000, 650000]],
        ['HighPeak', [987654]],
      ],
      'POINTS'
    );
    t.pointsConfig = DEFAULT_POINTS_THRESHOLDS;
    // 0-point players stay on the list, ordered by and showing their best single score.
    expect(view(t)).toEqual([
      [1, 'Alpha', null, '6'],
      [2, 'Bravo', null, '3'],
      [3, 'HighPeak', null, (987654).toLocaleString()],
      [4, 'LowPeak', null, (650000).toLocaleString()],
    ]);
  });

  it('# of Maxes shows the max count and the kicker, just the kicker with no maxes, and no number when every run maxed', () => {
    const t = withScores(
      [
        ['TwoMaxes', [1000000, 1100000, 950000]],
        ['AllMaxes', [1000000]],
        ['NoMaxes', [987654, 500000]],
      ],
      'HIGH_SCORE'
    );
    expect(view(t)).toEqual([
      [1, 'TwoMaxes', '2', (950000).toLocaleString()],
      [2, 'AllMaxes', '1', ''],
      [3, 'NoMaxes', null, (987654).toLocaleString()],
    ]);
  });

  it('caps the list at the requested count', () => {
    const t = withScores(Array.from({ length: 30 }, (_, i) => [`P${i}`, 100000 + i] as [string, number]));
    // No count: every player with a score, not just the first 20.
    expect(getQualifierGutterRows(t)).toHaveLength(30);
    expect(getQualifierGutterRows(t, 5)).toHaveLength(5);
  });

  it('manual seeding lists seeds in order with no score', () => {
    const t = withScores([['Alpha', null], ['Bravo', null]]);
    t.seedingMethod = 'MANUAL';
    t.manualSeeds = ['p1', 'p0'];
    expect(getQualifierGutterRows(t).map(r => [r.rank, r.name, r.value])).toEqual([
      [1, 'Bravo', ''],
      [2, 'Alpha', ''],
    ]);
  });
});

describe('standings gutter rows', () => {
  it('is empty until brackets lock', () => {
    expect(getStandingsGutterRows(withScores([['Alpha', 900000]]))).toEqual([]);
  });

  it('after a full simulated event lists placed players with their match record, champion first', () => {
    const base = createEmptyTournament({ id: 't-sim', slug: 'sim', name: 'Sim', tiers: [createDefaultTier(1, { playerCount: 8 })] });
    const done = runFullSimulation(base);
    const rows = getStandingsGutterRows(done, 8);
    expect(rows).toHaveLength(8);
    expect(rows[0].rank).toBe(1);
    expect(rows.map(r => r.rank)).toEqual([...rows.map(r => r.rank)].sort((a, b) => a - b));
    expect(rows[0].value).toMatch(/^\d+[–-]\d+$/);
  });
});

describe('parseGutterCount', () => {
  it.each([
    [null, DEFAULT_GUTTER_COUNT],
    ['8', 8],
    ['0', DEFAULT_GUTTER_COUNT],
    ['abc', DEFAULT_GUTTER_COUNT],
    ['1000', 1000],
  ])('%s -> %s', (input, expected) => {
    expect(parseGutterCount(input)).toBe(expected);
  });
});

describe('ObsGutterList', () => {
  const rows = [{ key: 'a', rank: 1, name: 'Bravo', value: '1,200,000', badge: '2', accentColor: '#ffc905' }];

  it('never lets a name shrink below 6 characters (plus the ellipsis)', () => {
    const html = renderToStaticMarkup(<ObsGutterList title="Qualifiers" rows={rows} emptyText="None" />);
    expect(html).toMatch(/data-testid="obs-gutter-name" class="[^"]*min-w-\[7ch\]/);
    expect(html).not.toMatch(/data-testid="obs-gutter-name" class="[^"]*min-w-0/);
  });

  it('the maxes chip shows just the count', () => {
    const html = renderToStaticMarkup(<ObsGutterList title="Qualifiers" rows={rows} emptyText="None" />);
    expect(html).toMatch(/data-testid="obs-gutter-badge"[^>]*>2<\/span>/);
    expect(html).not.toContain('MAX<');
  });

  it('shows the large qualifier countdown while quals are open, and nothing once they close', () => {
    const open = withScores([['Alpha', 900000]]);
    const html = renderToStaticMarkup(
      <ObsGutterList title="Qualifiers" rows={rows} emptyText="None" chroma="green" timerTournament={open} />
    );
    expect(html).toContain('data-testid="obs-qual-timer-hud"');
    // Sized to the gutter's width, with no label above the digits.
    expect(html).toMatch(/text-\[clamp\([^\]]*cqw/);
    expect(html).not.toContain('Qual Time Left<');

    const closed = { ...open, qualsClosed: true };
    const none = renderToStaticMarkup(
      <ObsGutterList title="Qualifiers" rows={rows} emptyText="None" timerTournament={closed} />
    );
    expect(none).not.toContain('obs-qual-timer-hud');
  });

  it('renders rank, name and value on solid rows over the chroma color', () => {
    const html = renderToStaticMarkup(<ObsGutterList title="Qualifiers" rows={rows} emptyText="None" chroma="green" />);
    expect(html).toContain(`background:${CHROMA_KEY_COLORS.green}`);
    expect(html).toContain('Bravo');
    expect(html).toContain('1,200,000');
    expect(html).not.toMatch(/rgba\(|opacity-|shadow-/);
    // Narrow view shows no secondary data (flags, playstyle, attempts).
    expect(html).not.toContain('Verified');
  });

  it('shows the empty text when there are no rows', () => {
    const html = renderToStaticMarkup(<ObsGutterList title="Standings" rows={[]} emptyText="Awaiting results" />);
    expect(html).toContain('Awaiting results');
    expect(html).toContain('background:transparent');
  });
});
