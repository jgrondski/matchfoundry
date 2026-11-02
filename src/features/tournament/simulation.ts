import {
  Tournament,
  TournamentTier,
  PlayerProfile,
  QualifierSubmission,
  MatchScoreRecord,
} from './types';
import { advanceMatchWinner } from '../bracket/math';
import { generateDraftBracketsForTournament } from '../qualifiers/scoring';

import { AUTHENTIC_COMPETITOR_NAMES } from './data/authenticPlayers';

export const REALISTIC_PLAYER_NAMES = AUTHENTIC_COMPETITOR_NAMES;

const COUNTRIES = [
  'US', 'JP', 'CA', 'DE', 'GB', 'FR', 'SE', 'PL', 'AU', 'BR',
  'KR', 'FI', 'IS', 'NL', 'DK', 'NO', 'ES', 'IT', 'MX', 'NZ'
];
const PLAYSTYLES: Array<'DAS' | 'Rolling' | 'Hypertap'> = ['Rolling', 'Rolling', 'Rolling', 'DAS', 'Hypertap'];

const TAG_PREFIXES = ['Hyper', 'Pixel', 'Retro', 'Turbo', 'Shadow', 'Quantum', 'Aero', 'Chrono', 'Zenith', 'Echo', 'Neon', 'Vortex'];
const TAG_SUFFIXES = ['Roll', 'Tap', 'Stack', 'Drop', 'Dash', 'Shift', 'Spark', 'Master', 'Knight', 'Fox', 'Blader', 'Tetris'];

function generateFallbackTag(existingNames: Set<string>): string {
  let attempt = 0;
  while (attempt < 1000) {
    const pre = TAG_PREFIXES[Math.floor(Math.random() * TAG_PREFIXES.length)];
    const suf = TAG_SUFFIXES[Math.floor(Math.random() * TAG_SUFFIXES.length)];
    const num = Math.floor(10 + Math.random() * 89);
    const candidate = `${pre}${suf}_${num}`;
    if (!existingNames.has(candidate.toLowerCase())) {
      return candidate;
    }
    attempt++;
  }
  return `NeoStack_${Date.now() % 10000}`;
}

/**
 * Generate a list of realistic competitors with random playstyles, PBs, and countries.
 */
export function generateRealisticPlayers(count: number, existingPool: PlayerProfile[] = []): PlayerProfile[] {
  const existingNames = new Set(existingPool.map(p => p.name.toLowerCase()));
  const players: PlayerProfile[] = [...existingPool];

  let nameIdx = 0;

  while (players.length < count) {
    let name = '';
    while (nameIdx < REALISTIC_PLAYER_NAMES.length) {
      const candidate = REALISTIC_PLAYER_NAMES[nameIdx++];
      if (!existingNames.has(candidate.toLowerCase())) {
        name = candidate;
        break;
      }
    }

    if (!name) {
      name = generateFallbackTag(existingNames);
    }

    existingNames.add(name.toLowerCase());

    const playstyle = PLAYSTYLES[Math.floor(Math.random() * PLAYSTYLES.length)];
    const country = COUNTRIES[Math.floor(Math.random() * COUNTRIES.length)];
    // Personal best between 700,000 and 1,350,000
    const personalBest = Math.floor(700000 + Math.random() * 650000);

    const rawUuid = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${players.length + 1}`;
    const id = `p_sim_${rawUuid}`;
    players.push({
      id,
      name,
      personalBest,
      playstyle,
      country,
      notes: 'Simulated competitor',
    });
  }

  return players;
}

/**
 * Generate exactly `count` new simulated competitors to append to a player pool.
 */
export function generateAdditionalFakePlayers(
  count: number,
  existingPool: PlayerProfile[] = []
): PlayerProfile[] {
  const existingNames = new Set(existingPool.map(p => p.name.toLowerCase()));
  const newPlayers: PlayerProfile[] = [];

  let nameIdx = 0;

  while (newPlayers.length < count) {
    let name = '';
    while (nameIdx < REALISTIC_PLAYER_NAMES.length) {
      const candidate = REALISTIC_PLAYER_NAMES[nameIdx++];
      if (!existingNames.has(candidate.toLowerCase())) {
        name = candidate;
        break;
      }
    }

    if (!name) {
      name = generateFallbackTag(existingNames);
    }

    existingNames.add(name.toLowerCase());

    const playstyle = PLAYSTYLES[Math.floor(Math.random() * PLAYSTYLES.length)];
    const country = COUNTRIES[Math.floor(Math.random() * COUNTRIES.length)];
    const personalBest = Math.floor(700000 + Math.random() * 650000);

    const rawUuid = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${newPlayers.length + 1}`;
    const id = `p_sim_${rawUuid}`;
    newPlayers.push({
      id,
      name,
      personalBest,
      playstyle,
      country,
      notes: 'Simulated competitor',
    });
  }

  return newPlayers;
}

/**
 * Generate simulated qualifier scores for a tournament based on its capacity and format.
 * Uses total bracket capacity + 1d6 extra players who won't make bracket play.
 * Pulls from the global player pool first, keeping any already added players,
 * and falling back to generic players if the global pool is empty or exhausted.
 */
/**
 * Number of competitors a qualifier simulation aims for, given a 1d6 roll (1-6).
 * Callers that persist results use the max roll (6) to pre-provision enough real players.
 */
export function getSimulatedQualifierTargetCount(tournament: Tournament, extra1d6: number): number {
  const totalCapacity = tournament.tiers.reduce((acc, t) => acc + (t.playerCount || 0), 0);
  return totalCapacity > 0
    ? Math.max(8, totalCapacity + extra1d6)
    : Math.max(24, (tournament.playersPool || []).length) + extra1d6;
}

export function generateSimulatedQualifiers(
  tournament: Tournament,
  globalPlayersPool: PlayerProfile[] = []
): {
  players: PlayerProfile[];
  submissions: QualifierSubmission[];
} {
  const extra1d6 = Math.floor(Math.random() * 6) + 1; // 1d6 roll (1 to 6)
  const targetCount = getSimulatedQualifierTargetCount(tournament, extra1d6);

  // Preserve any competitors already added to the tournament
  const players: PlayerProfile[] = [...(tournament.playersPool || [])];
  const existingIds = new Set(players.map(p => p.id));
  const existingNames = new Set(players.map(p => p.name.toLowerCase()));

  // If more players needed, pull from global player pool first
  if (players.length < targetCount && globalPlayersPool.length > 0) {
    const availableFromGlobal = globalPlayersPool.filter(
      p => !existingIds.has(p.id) && !existingNames.has(p.name.toLowerCase())
    );

    // Shuffle available global players randomly
    const shuffledGlobal = [...availableFromGlobal].sort(() => Math.random() - 0.5);

    for (const gp of shuffledGlobal) {
      if (players.length >= targetCount) break;
      players.push({ ...gp });
      existingIds.add(gp.id);
      existingNames.add(gp.name.toLowerCase());
    }
  }

  // If still below targetCount, generate generic realistic players
  if (players.length < targetCount) {
    const needed = targetCount - players.length;
    const genericPlayers = generateAdditionalFakePlayers(needed, players);
    players.push(...genericPlayers);
  }

  // Preserve existing submissions and add simulated submissions for any player needing them
  const existingSubmissions = tournament.qualifierSubmissions || [];
  const existingSubmissionsByPlayer = new Map<string, QualifierSubmission[]>();
  for (const sub of existingSubmissions) {
    const list = existingSubmissionsByPlayer.get(sub.playerId) || [];
    list.push(sub);
    existingSubmissionsByPlayer.set(sub.playerId, list);
  }

  const submissions: QualifierSubmission[] = [...existingSubmissions];
  const baseTime = Date.now() - 3600000 * 4; // 4 hours ago

  const qualFormat = tournament.qualFormat || 'AVERAGE_OF_X';
  const targetAttempts = qualFormat === 'AVERAGE_OF_X' ? (tournament.qualAverageCount || 2) : 3;

  players.forEach((player, pIdx) => {
    const existing = existingSubmissionsByPlayer.get(player.id) || [];
    if (existing.length >= targetAttempts) {
      return;
    }

    // Top-seeded players have higher skill bias
    const skillMultiplier = 1 - (pIdx / players.length) * 0.45; // 1.0 down to 0.55

    let playerTargetAttempts = targetAttempts;
    let isLegendaryPointsRun = false;

    if (qualFormat === 'POINTS') {
      // Points qualifiers allow multiple attempts.
      // Top seeds typically play 4-6 attempts.
      // Occasionally (~20% chance for #1 seed, or ~8% for seeds 2-3), a top player has a monster run reaching the 60s or 70s in total points.
      if ((pIdx === 0 && Math.random() < 0.20) || (pIdx > 0 && pIdx < 3 && Math.random() < 0.08)) {
        isLegendaryPointsRun = true;
        playerTargetAttempts = Math.random() < 0.5 ? 6 : 7;
      } else if (pIdx < 4) {
        playerTargetAttempts = 5;
      } else if (pIdx < Math.floor(players.length * 0.5)) {
        playerTargetAttempts = 4;
      } else {
        playerTargetAttempts = 3;
      }
    }

    if (existing.length >= playerTargetAttempts) {
      return;
    }

    for (let attempt = existing.length + 1; attempt <= playerTargetAttempts; attempt++) {
      let score: number;

      if (qualFormat === 'HIGH_SCORE') {
        // # of Maxes: top seeds frequently max out (>= 999,999)
        // 90% of the time, submit a kicker (< 999,999) to establish tiebreaker scores
        const playerCurrentAttempts = submissions.filter(s => s.playerId === player.id);
        const hasKickerAlready = playerCurrentAttempts.some(s => s.score < 999999);
        const isLastAttempt = attempt === targetAttempts;

        let isMaxout = pIdx < Math.min(16, Math.floor(players.length * 0.4)) && Math.random() < 0.75;
        // If player has only maxouts so far, 90% chance to submit a kicker on final attempt
        if (isLastAttempt && !hasKickerAlready && Math.random() < 0.90) {
          isMaxout = false;
        }

        if (isMaxout) {
          score = Math.floor(1000000 + Math.random() * 300000);
        } else {
          score = Math.floor(750000 + Math.random() * 245000); // 750,000 to 995,000
        }
      } else if (qualFormat === 'POINTS') {
        if (isLegendaryPointsRun) {
          // Scores between 1,600,000 and 2,150,000 (earning 9, 10, 11, or 13 points each, totaling 60-75 points)
          score = Math.floor(1600000 + Math.random() * 550000);
        } else {
          // Standard points distribution: can hit higher thresholds for top seeds
          const baseScore = 700000 + Math.random() * 1150000; // 700,000 to 1,850,000
          score = Math.floor(baseScore * skillMultiplier);
        }
      } else {
        // AVERAGE_OF_X
        score = Math.floor((650000 + Math.random() * 550000) * skillMultiplier);
      }

      const submittedAt = baseTime + pIdx * 60000 + attempt * 120000;
      // Simulated runs are created pending review, like real ones; they still seed draft brackets.
      submissions.push({
        id: `sub_sim_${player.id}_${attempt}`,
        tournamentId: tournament.id,
        organizationId: tournament.organizationId,
        playerId: player.id,
        score,
        submittedAt,
        submissionSource: 'IN_PERSON',
        status: 'SUBMITTED',
      });
    }
  });

  return { players, submissions };
}

/**
 * Simulate all matches across all tiers in a tournament up to the champions.
 */
export function simulateTournamentMatches(
  tournament: Tournament,
  tiersToSimulate: TournamentTier[]
): {
  updatedTiers: TournamentTier[];
  matchScores: Record<string, MatchScoreRecord>;
} {
  const matchScores: Record<string, MatchScoreRecord> = { ...tournament.matchScores };
  let currentTiers = [...tiersToSimulate];

  currentTiers = currentTiers.map(tier => {
    let bracket = { ...tier.bracket };

    // Simulate matches in topological dependency order
    let matchSimulated = true;
    let iterations = 0;
    while (matchSimulated && iterations < 100) {
      matchSimulated = false;
      iterations++;

      // Find all playable matches without a concluded winner
      const playableMatches = Object.values(bracket.matchesById).filter(
        (m) => !m.isBye && !m.winnerId && m.player1.player && m.player2.player
      );

      for (const currentMatch of playableMatches) {
        const p1 = currentMatch.player1.player;
        const p2 = currentMatch.player2.player;
        if (!p1 || !p2) continue;

        const bestOf = currentMatch.bestOf || tier.bestOf || 5;
        const winThreshold = Math.ceil(bestOf / 2);

        let p1Wins = 0;
        let p2Wins = 0;
        const games: MatchScoreRecord['games'] = [];

        // Randomly simulate games until one competitor reaches winThreshold
        // Competitor with higher seed (lower seed number) has slight advantage
        const p1Seed = p1.seed || 16;
        const p2Seed = p2.seed || 16;
        const p1Prob = p2Seed / (p1Seed + p2Seed); // e.g. Seed 1 vs Seed 16 -> 16/17 ~ 94% win probability

        let gameNumber = 1;
        while (p1Wins < winThreshold && p2Wins < winThreshold) {
          const p1Won = Math.random() < Math.max(0.2, Math.min(0.8, p1Prob));
          const winnerId = p1Won ? p1.id : p2.id;

          if (p1Won) p1Wins++;
          else p2Wins++;

          const winningScore = Math.floor(750000 + Math.random() * 350000);
          const losingScore = Math.floor(winningScore - (50000 + Math.random() * 250000));

          games.push({
            gameNumber,
            player1Points: p1Won ? winningScore : losingScore,
            player2Points: p1Won ? losingScore : winningScore,
            winnerPlayerId: winnerId,
          });

          gameNumber++;
        }

        const matchWinnerId = p1Wins >= winThreshold ? p1.id : p2.id;
        const matchLoserId = matchWinnerId === p1.id ? p2.id : p1.id;

        matchScores[currentMatch.id] = {
          matchId: currentMatch.id,
          tierId: tier.id,
          organizationId: tournament.organizationId,
          bestOf,
          player1Wins: p1Wins,
          player2Wins: p2Wins,
          winnerPlayerId: matchWinnerId,
          loserPlayerId: matchLoserId,
          isComplete: true,
          games,
        };

        // Advance winner through bracket math
        bracket = advanceMatchWinner(bracket, currentMatch.id, matchWinnerId);
        matchSimulated = true;
      }
    }

    return {
      ...tier,
      isLocked: true,
      bracket,
    };
  });

  return { updatedTiers: currentTiers, matchScores };
}

/**
 * Execute a full tournament simulation: seeds qualifiers if needed, locks tournament,
 * and simulates matches across all tiers.
 */
export function runFullSimulation(
  tournament: Tournament,
  globalPlayersPool: PlayerProfile[] = []
): Tournament {
  let tourney = { ...tournament };

  // 1. Seed qualifiers or manual seeds if fewer than total bracket capacity
  const totalCapacity = tourney.tiers.reduce((acc, t) => acc + t.playerCount, 0);
  if (tourney.seedingMethod === 'MANUAL') {
    if ((tourney.manualSeeds?.length || 0) < totalCapacity) {
      const { players } = generateSimulatedQualifiers(tourney, globalPlayersPool);
      tourney = {
        ...tourney,
        playersPool: players,
        manualSeeds: players.map(p => p.id),
        isLocked: false,
      };
    }
  } else if ((tourney.qualifierSubmissions?.length || 0) < totalCapacity) {
    const { players, submissions } = generateSimulatedQualifiers(tourney, globalPlayersPool);
    tourney = {
      ...tourney,
      playersPool: players,
      qualifierSubmissions: submissions,
      isLocked: false,
    };
  }

  // Always recalculate brackets from current qualifiers before locking
  tourney.tiers = generateDraftBracketsForTournament(tourney);

  // 2. Lock brackets into Match Play Mode
  const lockedTiers = tourney.tiers.map(t => ({ ...t, isLocked: true }));
  tourney.isLocked = true;
  tourney.tiers = lockedTiers;

  // 3. Simulate all match play rounds
  const { updatedTiers, matchScores } = simulateTournamentMatches(tourney, tourney.tiers);
  tourney.tiers = updatedTiers;
  tourney.matchScores = matchScores;

  return tourney;
}
