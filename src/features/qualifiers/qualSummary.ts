import { calculateAverageOfX, calculateMaxoutAndKicker, calculatePoints } from './scoring';
import type { PointsThreshold, QualFormat, QualifierSubmission } from '../tournament/types';

export interface QualFormatConfig {
  qualFormat: QualFormat;
  qualAverageCount?: number | null;
  pointsConfig?: PointsThreshold[] | null;
}

export type QualScoreSummary =
  | { kind: 'MAXES'; maxoutCount: number; kickerScore: number }
  | { kind: 'AVERAGE'; average: number; targetCount: number; scores: number[] }
  | { kind: 'POINTS'; totalPoints: number; kickerScore: number; breakdown: { score: number; points: number }[] };

/**
 * A qual run's result in its tournament's format, computed the same way as the leaderboard.
 * Empty (zero) entries are ignored, matching what the portal submits. Returns null with no scores.
 * Shared by the live submission-form summary and the Discord announcements so they always agree.
 */
export function summarizeQualScores(format: QualFormatConfig, rawScores: number[]): QualScoreSummary | null {
  const scores = rawScores.filter(s => typeof s === 'number' && s > 0);
  if (scores.length === 0) return null;
  const subs = scores.map(score => ({ score }) as QualifierSubmission);

  if (format.qualFormat === 'HIGH_SCORE') {
    const { maxoutCount, kickerScore } = calculateMaxoutAndKicker(subs);
    return { kind: 'MAXES', maxoutCount, kickerScore };
  }

  if (format.qualFormat === 'AVERAGE_OF_X') {
    const targetCount = format.qualAverageCount || 2;
    // A submitted run is complete, so missing attempts count as 0 (same as the leaderboard).
    const { average } = calculateAverageOfX(subs, targetCount, true);
    return { kind: 'AVERAGE', average, targetCount, scores };
  }

  const { totalPoints, pointsPerAttempt } = calculatePoints(subs, format.pointsConfig || []);
  return {
    kind: 'POINTS',
    totalPoints,
    kickerScore: Math.max(...scores),
    breakdown: scores.map((score, i) => ({ score, points: pointsPerAttempt[i] ?? 0 })),
  };
}
