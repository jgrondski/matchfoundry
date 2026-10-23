import {
  Tournament,
  TournamentTier,
  PlayerProfile,
  QualifierSubmission,
  PointsThreshold,
  QualifierStatus,
} from '../tournament/types';
import { SeededPlayer, BracketStructure } from '../bracket/types';
import { generateTraditionalBracket, generateFlatBracket, generateDoubleEliminationBracket } from '../bracket/math';

export const MAXOUT_THRESHOLD = 999999;

export interface MaxoutKickerResult {
  maxoutCount: number;
  kickerScore: number;
  bestScore: number;
}

export interface LeaderboardRankRow {
  rank?: number;
  globalRank?: number;
  player: PlayerProfile;
  attempts: number[];
  formattedDetail: string; // e.g. "Ao2 (3 attempts)", "Max of 4", "180 pts"
  finalScore: number;
  peakScore?: number;
  maxoutCount?: number;
  kickerScore?: number;
  isDisqualified: boolean;
  status: QualifierStatus;
  submissionSource?: 'IN_PERSON' | 'ONLINE';
  twitchVodUrl?: string;
  assignedTier?: TournamentTier;
  tierSeed?: number;
  isDNQ: boolean;
  earliestTimestamp: number;
}

/**
 * Derives the current qualifier status for a player in a tournament.
 * - If brackets are locked, all players are auto-flipped to 'verified'.
 * - If marked isVerified in tournamentPlayers, returns 'verified'.
 * - For online submissions:
 *   - status === 'SUBMITTED' -> 'awaiting verification'
 *   - status === 'VERIFIED' -> 'verified'
 *   - status === 'DNQ' -> 'dnq'
 *   - status === 'DQ' -> 'dq'
 *   - status === 'IN_PROGRESS' -> 'in progress'
 * - If 0 qualifier submissions, returns 'not started'.
 * - Otherwise returns 'in progress'.
 */
export function getPlayerQualifierStatus(
  tournament: Tournament,
  playerId: string
): QualifierStatus {
  if (tournament.isLocked) {
    return 'verified';
  }

  const playerSubs = (tournament.qualifierSubmissions || []).filter(
    s => s.playerId === playerId
  );

  const isProfileDQ = Boolean(
    (tournament.playersPool || []).find(p => p.id === playerId)?.isDisqualified
  );
  if (isProfileDQ || playerSubs.some(s => s.status === 'DQ')) {
    return 'dq';
  }

  if (playerSubs.some(s => s.status === 'SUBMITTED')) {
    return 'awaiting verification';
  }

  if (playerSubs.length > 0 && playerSubs.every(s => s.status === 'DNQ')) {
    return 'dnq';
  }

  const tPlayer = tournament.tournamentPlayers?.[playerId];
  if (tPlayer?.isVerified || tPlayer?.qualsCompleted) {
    return 'verified';
  }

  if (playerSubs.some(s => s.status === 'VERIFIED')) {
    return 'verified';
  }

  if (playerSubs.length === 0 || playerSubs.every(s => s.status === 'NOT_STARTED')) {
    return 'not started';
  }

  return 'in progress';
}

/**
 * Calculates high score across submissions.
 */
export function calculateHighScore(submissions: QualifierSubmission[]): number {
  if (submissions.length === 0) return 0;
  return Math.max(...submissions.map(s => s.score));
}

/**
 * Calculates maxout count (>= 999,999), kicker score (highest sub-maxout attempt, or 0),
 * and best overall score across qualifier submissions.
 */
export function calculateMaxoutAndKicker(submissions: QualifierSubmission[]): MaxoutKickerResult {
  if (submissions.length === 0) {
    return { maxoutCount: 0, kickerScore: 0, bestScore: 0 };
  }
  const scores = submissions.map(s => s.score);
  const maxoutCount = scores.filter(s => s >= MAXOUT_THRESHOLD).length;
  const nonMaxouts = scores.filter(s => s < MAXOUT_THRESHOLD);
  const kickerScore = nonMaxouts.length > 0 ? Math.max(...nonMaxouts) : 0;
  const bestScore = Math.max(...scores);
  return { maxoutCount, kickerScore, bestScore };
}

/**
 * Calculates Average of X.
 * If in-progress, calculates arithmetic mean of attempts so far.
 * If closed or player completed, missing attempts up to targetX count as 0.
 */
export function calculateAverageOfX(
  submissions: QualifierSubmission[],
  targetX: number = 2,
  isClosedOrComplete: boolean = false
): { average: number; count: number; rawAverage: number } {
  if (submissions.length === 0) {
    return { average: 0, count: 0, rawAverage: 0 };
  }

  const scores = submissions.map(s => s.score);
  const sum = scores.reduce((a, b) => a + b, 0);

  if (isClosedOrComplete) {
    // Missing attempts up to targetX are 0
    const divisor = Math.max(scores.length, targetX);
    const average = Math.round(sum / divisor);
    return { average, count: scores.length, rawAverage: sum / divisor };
  } else {
    // Running count & mean
    const average = Math.round(sum / scores.length);
    return { average, count: scores.length, rawAverage: sum / scores.length };
  }
}

/**
 * Calculates Points format.
 * Each submitted score earns the value of highest threshold met (non-cumulative per attempt).
 * Total points is the sum across all valid attempts.
 */
export function calculatePoints(
  submissions: QualifierSubmission[],
  config: PointsThreshold[] = []
): { totalPoints: number; pointsPerAttempt: number[] } {
  if (submissions.length === 0 || config.length === 0) {
    return { totalPoints: 0, pointsPerAttempt: [] };
  }

  // Sort threshold descending by minScore
  const sortedThresholds = [...config].sort((a, b) => b.minScore - a.minScore);

  const pointsPerAttempt: number[] = [];
  let totalPoints = 0;

  for (const sub of submissions) {
    const matched = sortedThresholds.find(t => sub.score >= t.minScore);
    const earned = matched ? matched.points : 0;
    pointsPerAttempt.push(earned);
    totalPoints += earned;
  }

  return { totalPoints, pointsPerAttempt };
}

/**
 * Single rule for whether a competitor may occupy a tier/seed slot.
 * DQ and DNQ competitors never take a bracket or seed slot, in the leaderboard or in draft brackets.
 */
export function isSeedingEligible(row: Pick<LeaderboardRankRow, 'isDisqualified' | 'status'>): boolean {
  return !row.isDisqualified && row.status !== 'dq' && row.status !== 'dnq';
}

/**
 * Derives dynamic leaderboard rows for a tournament, sorted deterministically.
 * Order: ranked eligible competitors, then DNQ, then DQ, then unstarted.
 */
export function deriveLeaderboard(tournament: Tournament): LeaderboardRankRow[] {
  const pool = tournament.playersPool || [];
  const submissions = tournament.qualifierSubmissions || [];
  const tournamentPlayers = tournament.tournamentPlayers || {};

  // Guarantee that every competitor with a submission is included in the pool
  const poolPlayerIds = new Set(pool.map(p => p.id));
  const effectivePool = [...pool];
  for (const sub of submissions) {
    if (!poolPlayerIds.has(sub.playerId)) {
      poolPlayerIds.add(sub.playerId);
      effectivePool.push({
        id: sub.playerId,
        name: sub.submittedTwitchUsername || 'Online Competitor',
        country: 'US',
        avatarType: 'flag',
        playstyle: 'DAS',
        personalBest: 0,
        isDisqualified: false,
      });
    }
  }

  // Group submissions by player
  const submissionsByPlayer = new Map<string, QualifierSubmission[]>();
  for (const sub of submissions) {
    const list = submissionsByPlayer.get(sub.playerId) || [];
    list.push(sub);
    submissionsByPlayer.set(sub.playerId, list);
  }

  // Calculate score per player
  const rawRows = effectivePool.map(player => {
    const allPlayerSubs = (submissionsByPlayer.get(player.id) || []).sort(
      (a, b) => a.submittedAt - b.submittedAt
    );
    // Exclude IN_PROGRESS and NOT_STARTED session rows from scored game attempts
    const playerSubs = allPlayerSubs.filter(
      s => s.status !== 'IN_PROGRESS' && s.status !== 'NOT_STARTED'
    );
    const tPlayer = tournamentPlayers[player.id];
    const isCompleted = tournament.isLocked || Boolean(tPlayer?.qualsCompleted);
    const isDisqualified = Boolean(player.isDisqualified || allPlayerSubs.some(s => s.status === 'DQ'));

    let finalScore = 0;
    let formattedDetail = 'No attempts';
    let maxoutCount: number | undefined = undefined;
    let kickerScore: number | undefined = undefined;

    if (tournament.qualFormat === 'HIGH_SCORE') {
      const res = calculateMaxoutAndKicker(playerSubs);
      finalScore = res.bestScore;
      maxoutCount = res.maxoutCount;
      kickerScore = res.kickerScore;
      if (res.maxoutCount > 0) {
        formattedDetail = res.kickerScore > 0
          ? `${res.maxoutCount}x Max (Kicker: ${res.kickerScore.toLocaleString()})`
          : `${res.maxoutCount}x Max`;
      } else {
        formattedDetail = playerSubs.length > 0
          ? `${playerSubs.length} ${playerSubs.length === 1 ? 'attempt' : 'attempts'}`
          : '0 attempts';
      }
    } else if (tournament.qualFormat === 'AVERAGE_OF_X') {
      const targetX = tournament.qualAverageCount || 2;
      const res = calculateAverageOfX(playerSubs, targetX, isCompleted);
      finalScore = res.average;
      formattedDetail = `Ao${res.count} (${playerSubs.length}/${targetX})`;
    } else if (tournament.qualFormat === 'POINTS') {
      const res = calculatePoints(playerSubs, tournament.pointsConfig || []);
      finalScore = res.totalPoints;
      formattedDetail = `${res.totalPoints} pts (${playerSubs.length} attempts)`;
    }

    const peakScore = playerSubs.length > 0
      ? Math.max(...playerSubs.map(s => s.score))
      : 0;

    const earliestTimestamp = playerSubs.length > 0
      ? Math.min(...playerSubs.map(s => s.submittedAt))
      : Number.MAX_SAFE_INTEGER;

    const primarySource = allPlayerSubs.some(s => s.submissionSource === 'ONLINE')
      ? 'ONLINE'
      : allPlayerSubs.length > 0
        ? 'IN_PERSON'
        : undefined;
    const twitchVodUrl = allPlayerSubs.find(s => s.twitchVodUrl)?.twitchVodUrl;

    return {
      player,
      attempts: playerSubs.map(s => s.score),
      formattedDetail,
      finalScore,
      peakScore,
      maxoutCount,
      kickerScore,
      isDisqualified,
      status: getPlayerQualifierStatus(tournament, player.id),
      submissionSource: primarySource as 'IN_PERSON' | 'ONLINE' | undefined,
      twitchVodUrl,
      earliestTimestamp,
    };
  });

  // Partition: eligible competitors with attempts are ranked; DQ / DNQ rulings drop to the bottom
  // without a rank, tier, or seed; competitors with 0 attempts stay unstarted.
  const qualifiedRows = rawRows.filter(r => r.attempts.length > 0 && isSeedingEligible(r));
  const dnqRulingRows = rawRows.filter(r => !r.isDisqualified && r.status === 'dnq');
  const dqRows = rawRows.filter(r => r.isDisqualified || r.status === 'dq');
  const unstartedRows = rawRows.filter(
    r => r.attempts.length === 0 && isSeedingEligible(r)
  );

  // Sort qualifiedRows deterministically:
  // 1. If HIGH_SCORE:
  //    a. maxout_count descending
  //    b. If maxout_count > 0: kicker_score descending
  //    c. If maxout_count == 0: highest score descending
  //    If POINTS:
  //    a. finalScore (totalPoints) descending
  //    b. Tiebreaker: peakScore descending (specifically for 0-point players and point ties)
  //    If other formats: finalScore descending
  // 2. Earlier timestamp first (for ties)
  // 3. Player ID ascending fallback
  const qualifiedRowsComparator = (a: typeof rawRows[number], b: typeof rawRows[number]): number => {
    if (tournament.qualFormat === 'HIGH_SCORE') {
      const aMax = a.maxoutCount || 0;
      const bMax = b.maxoutCount || 0;
      if (bMax !== aMax) {
        return bMax - aMax;
      }
      if (bMax > 0) {
        const aKicker = a.kickerScore || 0;
        const bKicker = b.kickerScore || 0;
        if (bKicker !== aKicker) {
          return bKicker - aKicker;
        }
        if (b.finalScore !== a.finalScore) {
          return b.finalScore - a.finalScore;
        }
      } else {
        if (b.finalScore !== a.finalScore) {
          return b.finalScore - a.finalScore;
        }
      }
    } else if (tournament.qualFormat === 'POINTS') {
      if (b.finalScore !== a.finalScore) {
        return b.finalScore - a.finalScore;
      }
      const aPeak = a.peakScore ?? 0;
      const bPeak = b.peakScore ?? 0;
      if (bPeak !== aPeak) {
        return bPeak - aPeak;
      }
    } else {
      if (b.finalScore !== a.finalScore) {
        return b.finalScore - a.finalScore;
      }
    }

    if (a.earliestTimestamp !== b.earliestTimestamp) {
      return a.earliestTimestamp - b.earliestTimestamp;
    }
    return a.player.id.localeCompare(b.player.id);
  };
  qualifiedRows.sort(qualifiedRowsComparator);

  // Calculate tier cutoff ranges based on priority
  const sortedTiers = [...tournament.tiers].sort((a, b) => a.priority - b.priority);
  const tierRanges: Array<{ tier: TournamentTier; startRank: number; endRank: number }> = [];
  let currentCutoff = 0;
  for (const tier of sortedTiers) {
    const startRank = currentCutoff + 1;
    const endRank = currentCutoff + tier.playerCount;
    tierRanges.push({ tier, startRank, endRank });
    currentCutoff = endRank;
  }

  // Assign ranks, tier cutoffs, and tier seeds ONLY to eligible players with recorded attempts.
  const qualifiedResult: LeaderboardRankRow[] = qualifiedRows.map((item, idx) => {
    const rank = idx + 1;
    // Find matching tier range
    const matchingRange = tierRanges.find(
      r => rank >= r.startRank && rank <= r.endRank
    );

    if (matchingRange) {
      const tierSeed = rank - matchingRange.startRank + 1;
      return {
        ...item,
        rank,
        globalRank: idx + 1,
        assignedTier: matchingRange.tier,
        tierSeed,
        isDNQ: false,
      };
    }

    // If no tiers configured yet (pure qualifiers mode before brackets are added)
    if (tierRanges.length === 0) {
      return {
        ...item,
        rank,
        globalRank: idx + 1,
        assignedTier: undefined,
        tierSeed: undefined,
        isDNQ: false,
      };
    }

    return {
      ...item,
      rank,
      globalRank: idx + 1,
      assignedTier: undefined,
      tierSeed: undefined,
      isDNQ: true,
    };
  });

  // Competitors with 0 attempts stay in the roster as unstarted without rank or bracket tier seeding
  unstartedRows.sort((a, b) => a.player.name.localeCompare(b.player.name));
  const unstartedResult: LeaderboardRankRow[] = unstartedRows.map(item => ({
    ...item,
    rank: undefined,
    globalRank: undefined,
    assignedTier: undefined,
    tierSeed: undefined,
    isDNQ: false,
  }));

  // Judge rulings: kept for audit at the bottom, ordered by score, never ranked or seeded
  const rulingResult = (rows: typeof rawRows, isDNQ: boolean): LeaderboardRankRow[] =>
    [...rows].sort(qualifiedRowsComparator).map(item => ({
      ...item,
      rank: undefined,
      globalRank: undefined,
      assignedTier: undefined,
      tierSeed: undefined,
      isDNQ,
    }));

  return [
    ...qualifiedResult,
    ...rulingResult(dnqRulingRows, true),
    ...rulingResult(dqRows, false),
    ...unstartedResult,
  ];
}

/**
 * Generates a full populated bracket structure for a given tier and seeded players.
 * Guarantees that all N slots (up to tier capacity) are filled with valid seeds or placeholders.
 */
export function generateFullTierBracket(tier: TournamentTier, availablePlayers: SeededPlayer[]): BracketStructure {
  const capacity = Math.max(tier.playerCount || 2, 2);
  // Combine available players with placeholder seeds for any unfilled slots
  const fullSeeds: SeededPlayer[] = Array.from({ length: capacity }, (_, idx) => {
    const seedNum = idx + 1;
    const existing = availablePlayers.find(p => p.seed === seedNum);
    if (existing) {
      return existing;
    }
    return {
      id: `placeholder-seed-${tier.id}-${seedNum}`,
      name: `Seed ${seedNum}`,
      seed: seedNum,
    };
  });

  const options = {
    tierId: tier.id,
    bestOf: tier.bestOf,
    roundBestOfOverrides: tier.roundBestOfOverrides,
    bracketRouting: tier.bracketRouting,
    flatWidth: tier.flatWidth,
    finalsCutoff: tier.finalsCutoff,
  };

  return tier.eliminationType === 'DOUBLE'
    ? generateDoubleEliminationBracket(fullSeeds, options)
    : tier.bracketType === 'FLAT'
      ? generateFlatBracket(fullSeeds, tier.flatWidth || 4, options)
      : generateTraditionalBracket(fullSeeds, options);
}

/**
 * Computes projected draft brackets for all tiers of a tournament.
 * Used during DRAFT mode to keep bracket previews live and reactive.
 * Strictly excludes DQ / DNQ players (isSeedingEligible) and AWAITING_VERIFICATION (Assertion 5.3).
 */
export function generateDraftBracketsForTournament(tournament: Tournament): TournamentTier[] {
  const sortedTiers = [...tournament.tiers].sort((a, b) => a.priority - b.priority);


  // If manual seeding is active, bypass qualifiers leaderboard and seed directly from manualSeeds
  if (tournament.seedingMethod === 'MANUAL') {
    const manualIds = tournament.manualSeeds || [];
    const playerMap = new Map((tournament.playersPool || []).map(p => [p.id, p]));
    const validIds = manualIds.filter(
      id =>
        playerMap.has(id) &&
        isSeedingEligible({
          isDisqualified: Boolean(playerMap.get(id)?.isDisqualified),
          status: getPlayerQualifierStatus(tournament, id),
        })
    );

    let currentOffset = 0;
    return sortedTiers.map(tier => {
      const tierCapacity = tier.playerCount;
      const tierPlayerIds = validIds.slice(currentOffset, currentOffset + tierCapacity);
      currentOffset += tierCapacity;

      const seededPlayers: SeededPlayer[] = tierPlayerIds.map((id, idx) => {
        const p = playerMap.get(id);
        return {
          id,
          name: p?.name || 'Unknown',
          seed: idx + 1,
          country: p?.country,
          playstyle: p?.playstyle,
          displayName: p?.displayName,
          nickname: p?.nickname,
        };
      });

      return {
        ...tier,
        bracket: generateFullTierBracket(tier, seededPlayers),
      };
    });
  }

  const leaderboard = deriveLeaderboard(tournament);
  const eligibleRows = leaderboard.filter(
    row =>
      row.attempts.length > 0 &&
      isSeedingEligible(row) &&
      row.status !== 'awaiting verification'
  );

  let currentOffset = 0;
  return sortedTiers.map(tier => {
    const tierCapacity = tier.playerCount;
    const tierRows = eligibleRows.slice(currentOffset, currentOffset + tierCapacity);
    currentOffset += tierCapacity;

    const seededPlayers: SeededPlayer[] = tierRows.map((row, idx) => ({
      id: row.player.id,
      name: row.player.name,
      seed: idx + 1,
      country: row.player.country,
      playstyle: row.player.playstyle,
      displayName: row.player.displayName,
      nickname: row.player.nickname,
    }));

    return {
      ...tier,
      bracket: generateFullTierBracket(tier, seededPlayers),
    };
  });
}
