import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { summarizeQualScores } from '../qualSummary';
import { SubmissionFormCard } from '../../online-quals/components/SubmissionFormCard';
import type { QualFormat, PointsThreshold } from '../../tournament/types';

const pointsConfig: PointsThreshold[] = [
  { minScore: 999999, points: 5 },
  { minScore: 800000, points: 2 },
];

describe('summarizeQualScores', () => {
  it('returns null until a score is entered (empty slots are zeros)', () => {
    expect(summarizeQualScores({ qualFormat: 'HIGH_SCORE' }, [0, 0])).toBeNull();
  });

  it('# of Maxes: max count and kicker', () => {
    expect(summarizeQualScores({ qualFormat: 'HIGH_SCORE' }, [999999, 1100000, 845123, 0])).toEqual({
      kind: 'MAXES',
      maxoutCount: 2,
      kickerScore: 845123,
    });
  });

  it('Average of X: missing games count as 0, like the leaderboard', () => {
    expect(summarizeQualScores({ qualFormat: 'AVERAGE_OF_X', qualAverageCount: 3 }, [900000, 600000, 0])).toEqual({
      kind: 'AVERAGE',
      average: 500000,
      targetCount: 3,
      scores: [900000, 600000],
    });
  });

  it('Points: per-score points and total', () => {
    expect(summarizeQualScores({ qualFormat: 'POINTS', pointsConfig }, [1000000, 850000, 400000])).toEqual({
      kind: 'POINTS',
      totalPoints: 7,
      kickerScore: 1000000,
      breakdown: [
        { score: 1000000, points: 5 },
        { score: 850000, points: 2 },
        { score: 400000, points: 0 },
      ],
    });
  });
});

describe('SubmissionFormCard live summary', () => {
  const render = (qualFormat: QualFormat, scores: number[], extra: Record<string, unknown> = {}) =>
    renderToStaticMarkup(
      <SubmissionFormCard
        qualFormat={qualFormat}
        scores={scores}
        onScoresChange={vi.fn()}
        twitchVodUrl=""
        onTwitchVodUrlChange={vi.fn()}
        playerNotes=""
        onPlayerNotesChange={vi.fn()}
        onSubmit={vi.fn()}
        {...extra}
      />
    );

  it('is hidden before any score is entered', () => {
    expect(render('HIGH_SCORE', [0])).not.toContain('qual-score-summary');
  });

  it('shows maxes and kicker', () => {
    const html = render('HIGH_SCORE', [1000000, 845123]);
    expect(html).toContain('qual-score-summary');
    expect(html).toMatch(/Maxes<\/span><span[^>]*>1</);
    expect(html).toMatch(/Kicker<\/span><span[^>]*>845,123</);
  });

  it('shows the average and how many games are still missing', () => {
    const html = render('AVERAGE_OF_X', [900000, 0], { qualAverageCount: 2 });
    expect(html).toMatch(/Average of 2<\/span><span[^>]*>450,000</);
    expect(html).toContain('1 of 2 games entered');
  });

  it('shows points per score and the total', () => {
    const html = render('POINTS', [1000000, 850000], { pointsConfig });
    expect(html).toMatch(/1,000,000<\/span><span[^>]*>5 pts</);
    expect(html).toMatch(/850,000<\/span><span[^>]*>2 pts</);
    expect(html).toMatch(/Total<\/span><span[^>]*>7 pts</);
  });
});
