import type { Tournament } from '../tournament/types';
import { deriveLeaderboard, type LeaderboardRankRow } from '../qualifiers/scoring';
import { calculateGlobalStandings } from '../tournament/standings';
import { getEffectivePlayerName } from '../players/playerNameUtils';

/** One row of a narrow OBS gutter list: rank, name and the one number that matters. */
export interface GutterRow {
  key: string;
  rank: number;
  name: string;
  value: string;
  /** Short tag shown before the value, e.g. "2" (the max count) for # of Maxes. */
  badge?: string;
  /** Tier color for rows already placed in a tier, shown as a left edge. */
  accentColor?: string;
}

/** By default the gutter lists every player; the OBS operator crops or resizes the source. */
export const DEFAULT_GUTTER_COUNT = Infinity;

/** Parses the optional `?count=` cap; anything missing or invalid means no cap. */
export function parseGutterCount(param: string | null): number {
  const n = Number(param);
  return Number.isInteger(n) && n > 0 ? n : DEFAULT_GUTTER_COUNT;
}

/**
 * The gutter's number for one qualifier row, by qual format:
 * - POINTS: total points, just the number ("6"). A player with 0 points shows their best single
 *   score instead ("987,654"): that is the tiebreaker that orders them, so it decides their seed.
 * - AVERAGE_OF_X: the average, rounded to a whole score.
 * - HIGH_SCORE (# of Maxes): the max count (just the number) as a chip plus the kicker; no chip with 0 maxes;
 *   no value when every score was a max (there is no kicker).
 */
export function formatQualifierGutterValue(
  row: Pick<LeaderboardRankRow, 'finalScore' | 'maxoutCount' | 'kickerScore' | 'peakScore'>,
  format: Tournament['qualFormat']
): Pick<GutterRow, 'value' | 'badge'> {
  if (format === 'POINTS') {
    return { value: (row.finalScore > 0 ? row.finalScore : row.peakScore || 0).toLocaleString() };
  }
  if (format === 'HIGH_SCORE') {
    const maxes = row.maxoutCount || 0;
    const kicker = row.kickerScore || 0;
    return {
      value: kicker > 0 ? kicker.toLocaleString() : '',
      badge: maxes > 0 ? String(maxes) : undefined,
    };
  }
  return { value: Math.round(row.finalScore).toLocaleString() };
}

/**
 * Qualifier rows in leaderboard order: players with at least one score who are not
 * disqualified. The value follows the qual format (see formatQualifierGutterValue).
 * Manual-seeding tournaments list the seeds with no value.
 */
export function getQualifierGutterRows(tournament: Tournament, count: number = DEFAULT_GUTTER_COUNT): GutterRow[] {
  if (tournament.seedingMethod === 'MANUAL') {
    const byId = new Map((tournament.playersPool || []).map(p => [p.id, p]));
    return (tournament.manualSeeds || [])
      .map(id => byId.get(id))
      .filter((p): p is NonNullable<typeof p> => Boolean(p))
      .slice(0, count)
      .map((p, i) => ({ key: p.id, rank: i + 1, name: getEffectivePlayerName(p) || p.name, value: '' }));
  }

  const hasBrackets = tournament.tiers.length > 0;
  return deriveLeaderboard(tournament)
    // Points keeps its 0-point players: they still qualify and are seeded by their best score.
    .filter(
      row =>
        !row.isDisqualified &&
        row.attempts.length > 0 &&
        (row.finalScore > 0 || tournament.qualFormat === 'POINTS')
    )
    .slice(0, count)
    .map((row, i) => ({
      key: row.player.id,
      rank: row.rank ?? row.globalRank ?? i + 1,
      name: getEffectivePlayerName(row.player) || row.player.name,
      ...formatQualifierGutterValue(row, tournament.qualFormat),
      accentColor: hasBrackets && row.assignedTier && !row.isDNQ ? row.assignedTier.primaryColor : undefined,
    }));
}

/**
 * Final standings rows for placed players (no DNQ or DQ), best first. The value is the
 * match record (W–L). Empty until brackets lock, because nothing is placed before then.
 */
export function getStandingsGutterRows(tournament: Tournament, count: number = DEFAULT_GUTTER_COUNT): GutterRow[] {
  if (!tournament.isLocked || tournament.tiers.length === 0) return [];
  const profiles = new Map((tournament.playersPool || []).map(p => [p.id, p]));
  return calculateGlobalStandings(tournament)
    .filter(row => typeof row.finalRank === 'number' && !row.isDNQ && !row.isDisqualified)
    .slice(0, count)
    .map(row => ({
      key: row.player.id,
      rank: row.finalRank as number,
      name: getEffectivePlayerName(profiles.get(row.player.id)) || row.player.name,
      value: row.stats.matchRecordDisplay,
      accentColor: row.tier?.primaryColor,
    }));
}
