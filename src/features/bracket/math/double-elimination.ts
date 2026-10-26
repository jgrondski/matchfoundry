import {
  BracketMatch,
  BracketRound,
  BracketStructure,
  BracketRouting,
  GenerateBracketOptions,
  SeededPlayer,
  MatchSlotFeeder,
  MatchParticipant,
} from '../types';
import {
  getNextPowerOfTwo,
  getStandardSeedingPairs,
  getStandardLeaders,
} from './seed-utils';
import { generateTraditionalBracket } from './traditional';

/**
 * Unified helper to resolve round best-of override.
 * Supports identifiers like 'WR1', 'W1', 'LR1', 'L1', 'GF', 'GF_RESET', or numerical round indices.
 */
function createBestOfResolver(
  defaultBestOf: number,
  roundBestOfOverrides: Record<string | number, number> = {}
) {
  return (identifier: string, roundNum: number) => {
    if (roundBestOfOverrides[identifier] !== undefined) {
      return roundBestOfOverrides[identifier];
    }
    const alt = identifier.startsWith('WR')
      ? identifier.replace('WR', 'W')
      : identifier.startsWith('LR')
      ? identifier.replace('LR', 'L')
      : identifier.startsWith('W')
      ? identifier.replace('W', 'WR')
      : identifier.startsWith('L')
      ? identifier.replace('L', 'LR')
      : identifier;
    if (roundBestOfOverrides[alt] !== undefined) {
      return roundBestOfOverrides[alt];
    }
    if (roundBestOfOverrides[roundNum] !== undefined) {
      return roundBestOfOverrides[roundNum];
    }
    return defaultBestOf;
  };
}

/**
 * Helper to normalize DAG slots on a match.
 */
export function populateDagSlots(match: BracketMatch) {
  const p1SourceId = match.player1.sourceMatchId;
  const p2SourceId = match.player2.sourceMatchId;

  const slotA: MatchSlotFeeder = p1SourceId
    ? {
        matchId: p1SourceId,
        type: match.player1.player === null && match.stage === 'LOSERS' && match.player1.sourceMatchId?.includes('-w')
          ? 'LOSER'
          : 'WINNER',
      }
    : { type: 'DIRECT' };

  const slotB: MatchSlotFeeder = p2SourceId
    ? {
        matchId: p2SourceId,
        type: match.player2.player === null && match.stage === 'LOSERS' && match.player2.sourceMatchId?.includes('-w')
          ? 'LOSER'
          : 'WINNER',
      }
    : { type: 'DIRECT' };

  match.slotA = slotA;
  match.slotB = slotB;
}

/**
 * Assigns human-friendly canonical round names prioritizing Quarters, Semis, Finals, and Top 6.
 * Assigns canonical round names to Double Elimination rounds.
 * These names serve as the single source of truth across the entire app (brackets, standings, judge, master sheet).
 */
export function applyDoubleElimRoundNames(
  winnersRounds: BracketRound[],
  losersRounds: BracketRound[],
  grandFinalsRound: BracketRound
) {
  const W = winnersRounds.length;
  for (let i = 0; i < W; i++) {
    const round = winnersRounds[i];
    const fromEnd = W - 1 - i;
    if (fromEnd === 0) {
      round.name = 'Winners Finals';
    } else if (fromEnd === 1) {
      round.name = 'Winners Semis';
    } else if (fromEnd === 2) {
      round.name = 'Winners Quarters';
    } else {
      round.name = `Round ${i + 1} (Winners)`;
    }
  }

  const L = losersRounds.length;
  for (let j = 0; j < L; j++) {
    const round = losersRounds[j];
    const fromEnd = L - 1 - j;
    if (fromEnd === 0) {
      round.name = "Loser's Finals";
    } else if (fromEnd === 1) {
      round.name = "Loser's Semis";
    } else if (fromEnd === 2) {
      round.name = "Loser's Quarters";
    } else if (fromEnd === 3 && round.matches.length <= 2) {
      round.name = "Loser's Top 6";
    } else {
      round.name = `Round ${j + 1} (Losers)`;
    }
  }

  grandFinalsRound.name = 'Finals';
}

/**
 * Variant A: Traditional Binary-Tree Double Elimination (Challonge/Start.gg conventions)
 * Supports power-of-2 trees with byes, fixed drop-in crossing from Winners to Losers,
 * and flat sequential match numbering (1..2N-2).
 */
export function generateTraditionalDoubleElim(
  playersOrConfig: SeededPlayer[] | { players: SeededPlayer[]; options?: GenerateBracketOptions },
  optionsArg?: GenerateBracketOptions
): BracketStructure {
  let players: SeededPlayer[];
  let options: GenerateBracketOptions;

  if (Array.isArray(playersOrConfig)) {
    players = playersOrConfig;
    options = optionsArg || {};
  } else {
    players = playersOrConfig.players;
    options = playersOrConfig.options || {};
  }

  if (players.length < 2) {
    throw new Error(`Double elimination bracket requires at least 2 players, received ${players.length}`);
  }

  const { tierId, bestOf = 3, roundBestOfOverrides = {} } = options;
  const getBestOf = createBestOfResolver(bestOf, roundBestOfOverrides);
  const totalPlayers = players.length;
  const prefix = tierId ? `${tierId}-` : '';

  // Map players by seed
  const playerBySeed = new Map<number, SeededPlayer>();
  for (const p of players) {
    playerBySeed.set(p.seed, p);
  }

  // Edge case: Exactly 2 players
  if (totalPlayers === 2) {
    const p1 = playerBySeed.get(1) ?? players[0];
    const p2 = playerBySeed.get(2) ?? players[1];

    const w1MatchId = `${prefix}w1-m1`;
    const gf1MatchId = `${prefix}gf1`;

    const w1Match: BracketMatch = {
      id: w1MatchId,
      tierId,
      stage: 'WINNERS',
      roundIdentifier: 'W1',
      roundNumber: 1,
      roundIndex: 0,
      matchNumber: 1,
      player1: { player: p1 },
      player2: { player: p2 },
      slotA: { type: 'DIRECT' },
      slotB: { type: 'DIRECT' },
      winnerId: null,
      loserId: null,
      nextMatchId: gf1MatchId,
      nextMatchSlot: 1,
      loserNextMatchId: gf1MatchId,
      loserNextMatchSlot: 2,
      bestOf: getBestOf('W1', 1),
      isBye: false,
    };

    const gf1Match: BracketMatch = {
      id: gf1MatchId,
      tierId,
      stage: 'GRAND_FINALS',
      roundIdentifier: 'GF',
      roundNumber: 2,
      roundIndex: 1,
      matchNumber: 2,
      player1: { player: null, sourceMatchId: w1MatchId },
      player2: { player: null, sourceMatchId: w1MatchId },
      slotA: { matchId: w1MatchId, type: 'WINNER' },
      slotB: { matchId: w1MatchId, type: 'LOSER' },
      winnerId: null,
      loserId: null,
      bestOf: getBestOf('GF', 2),
      isBye: false,
    };

    return {
      tierId,
      type: 'TRADITIONAL',
      eliminationType: 'DOUBLE',
      bracketRouting: 'TRADITIONAL_TREE',
      totalPlayers: 2,
      totalRounds: 2,
      rounds: [
        { roundNumber: 1, name: 'Winners Finals', stage: 'WINNERS', roundIdentifier: 'W1', matches: [w1Match] },
        { roundNumber: 2, name: 'Finals', stage: 'GRAND_FINALS', roundIdentifier: 'GF', matches: [gf1Match] },
      ],
      matchesById: {
        [w1MatchId]: w1Match,
        [gf1MatchId]: gf1Match,
      },
    };
  }

  const B = getNextPowerOfTwo(totalPlayers);
  const K = Math.log2(B); // Number of rounds in power-of-2 Winners bracket

  const matchesById: Record<string, BracketMatch> = {};
  const winnersRounds: BracketRound[] = [];
  const losersRounds: BracketRound[] = [];

  // ==========================================
  // 1. WINNERS BRACKET
  // ==========================================
  const seedingPairs = getStandardSeedingPairs(B);
  const wr1Matches: BracketMatch[] = [];
  const wrMatchesByRound: Record<number, BracketMatch[]> = {};

  // Track feeds into WR2 for each of the B/2 pairs
  type FeedIntoWR2 = { isBye: true; player: SeededPlayer } | { isBye: false; matchId: string };
  const wr2Feeds: FeedIntoWR2[] = [];
  const wr1LoserFeeders: (MatchSlotFeeder | null)[] = [];

  let wr1Counter = 0;
  for (let i = 0; i < seedingPairs.length; i++) {
    const [s1, s2] = seedingPairs[i];
    const p1 = playerBySeed.get(s1);
    const p2 = playerBySeed.get(s2);

    if (p1 && p2) {
      // Real match in WR1
      wr1Counter++;
      const id = `${prefix}w1-m${wr1Counter}`;
      const match: BracketMatch = {
        id,
        tierId,
        stage: 'WINNERS',
        roundIdentifier: 'W1',
        roundNumber: 1,
        roundIndex: 0,
        matchNumber: 0, // Assigned sequentially later
        player1: { player: p1 },
        player2: { player: p2 },
        slotA: { type: 'DIRECT' },
        slotB: { type: 'DIRECT' },
        winnerId: null,
        loserId: null,
        bestOf: getBestOf('W1', 1),
        isBye: false,
      };
      wr1Matches.push(match);
      matchesById[id] = match;
      wr2Feeds.push({ isBye: false, matchId: id });
      wr1LoserFeeders.push({ matchId: id, type: 'LOSER' });
    } else {
      // Bye: confirmed player advances directly to WR2
      const byePlayer = p1 || p2!;
      wr2Feeds.push({ isBye: true, player: byePlayer });
      wr1LoserFeeders.push(null);
    }
  }

  winnersRounds.push({
    roundNumber: 1,
    name: 'WR1',
    stage: 'WINNERS',
    roundIdentifier: 'W1',
    matches: wr1Matches,
  });
  wrMatchesByRound[1] = wr1Matches;

  // WR2 Matches: B / 4 matches
  const wr2Matches: BracketMatch[] = [];
  const wr2MatchCount = B / 4;
  for (let m = 0; m < wr2MatchCount; m++) {
    const id = `${prefix}w2-m${m + 1}`;
    const feed1 = wr2Feeds[2 * m];
    const feed2 = wr2Feeds[2 * m + 1];

    const match: BracketMatch = {
      id,
      tierId,
      stage: 'WINNERS',
      roundIdentifier: 'W2',
      roundNumber: 2,
      roundIndex: 1,
      matchNumber: 0,
      player1: feed1.isBye ? { player: feed1.player } : { player: null, sourceMatchId: feed1.matchId },
      player2: feed2.isBye ? { player: feed2.player } : { player: null, sourceMatchId: feed2.matchId },
      slotA: feed1.isBye ? { type: 'DIRECT' } : { matchId: feed1.matchId, type: 'WINNER' },
      slotB: feed2.isBye ? { type: 'DIRECT' } : { matchId: feed2.matchId, type: 'WINNER' },
      winnerId: null,
      loserId: null,
      bestOf: getBestOf('W2', 2),
      isBye: false,
    };

    if (!feed1.isBye) {
      matchesById[feed1.matchId].nextMatchId = id;
      matchesById[feed1.matchId].nextMatchSlot = 1;
    }
    if (!feed2.isBye) {
      matchesById[feed2.matchId].nextMatchId = id;
      matchesById[feed2.matchId].nextMatchSlot = 2;
    }

    wr2Matches.push(match);
    matchesById[id] = match;
  }

  winnersRounds.push({
    roundNumber: 2,
    name: 'WR2',
    stage: 'WINNERS',
    roundIdentifier: 'W2',
    matches: wr2Matches,
  });
  wrMatchesByRound[2] = wr2Matches;

  // WR3 through WRK Matches
  let prevRoundMatches = wr2Matches;
  for (let r = 3; r <= K; r++) {
    const roundMatches: BracketMatch[] = [];
    const count = prevRoundMatches.length / 2;
    const roundIdent = `W${r}`;
    const roundName = `WR${r}`;

    for (let m = 0; m < count; m++) {
      const id = `${prefix}w${r}-m${m + 1}`;
      const f1Match = prevRoundMatches[2 * m];
      const f2Match = prevRoundMatches[2 * m + 1];

      const match: BracketMatch = {
        id,
        tierId,
        stage: 'WINNERS',
        roundIdentifier: roundIdent,
        roundNumber: r,
        roundIndex: r - 1,
        matchNumber: 0,
        player1: { player: null, sourceMatchId: f1Match.id },
        player2: { player: null, sourceMatchId: f2Match.id },
        slotA: { matchId: f1Match.id, type: 'WINNER' },
        slotB: { matchId: f2Match.id, type: 'WINNER' },
        winnerId: null,
        loserId: null,
        bestOf: getBestOf(roundIdent, r),
        isBye: false,
      };

      f1Match.nextMatchId = id;
      f1Match.nextMatchSlot = 1;
      f2Match.nextMatchId = id;
      f2Match.nextMatchSlot = 2;

      roundMatches.push(match);
      matchesById[id] = match;
    }

    winnersRounds.push({
      roundNumber: r,
      name: roundName,
      stage: 'WINNERS',
      roundIdentifier: roundIdent,
      matches: roundMatches,
    });
    wrMatchesByRound[r] = roundMatches;
    prevRoundMatches = roundMatches;
  }

  // ==========================================
  // 2. LOSERS BRACKET
  // ==========================================
  const totalPowerOfTwoLoserRounds = 2 * (K - 1);
  let lrRoundNumber = 1;
  let currentFeeders: (MatchSlotFeeder | null)[] = [];

  // --- LR1: Pairing from WR1 ---
  const lr1SlotsCount = B / 4;
  const lr1Matches: BracketMatch[] = [];

  for (let j = 0; j < lr1SlotsCount; j++) {
    const fA = wr1LoserFeeders[2 * j];
    const fB = wr1LoserFeeders[2 * j + 1];

    if (fA && fB) {
      const matchNumInRound = lr1Matches.length + 1;
      const id = `${prefix}l1-m${matchNumInRound}`;
      const match: BracketMatch = {
        id,
        tierId,
        stage: 'LOSERS',
        roundIdentifier: 'L1',
        roundNumber: lrRoundNumber,
        roundIndex: lrRoundNumber - 1,
        matchNumber: 0,
        player1: { player: null, sourceMatchId: fA.matchId },
        player2: { player: null, sourceMatchId: fB.matchId },
        slotA: fA,
        slotB: fB,
        winnerId: null,
        loserId: null,
        bestOf: getBestOf('L1', lrRoundNumber),
        isBye: false,
      };

      if (fA.matchId && matchesById[fA.matchId]) {
        matchesById[fA.matchId].loserNextMatchId = id;
        matchesById[fA.matchId].loserNextMatchSlot = 1;
      }
      if (fB.matchId && matchesById[fB.matchId]) {
        matchesById[fB.matchId].loserNextMatchId = id;
        matchesById[fB.matchId].loserNextMatchSlot = 2;
      }

      lr1Matches.push(match);
      matchesById[id] = match;
      currentFeeders.push({ matchId: id, type: 'WINNER' });
    } else if (fA || fB) {
      // Bye in LR1: advance player directly into LR2
      currentFeeders.push(fA || fB);
    } else {
      currentFeeders.push(null);
    }
  }

  if (lr1Matches.length > 0) {
    losersRounds.push({
      roundNumber: lrRoundNumber++,
      name: 'LR1',
      stage: 'LOSERS',
      roundIdentifier: 'L1',
      matches: lr1Matches,
    });
  }

  // --- LR2 through LR(2K-2) ---
  for (let m = 2; m <= totalPowerOfTwoLoserRounds; m++) {
    const roundIdent = `L${m}`;
    const roundName = `LR${m}`;
    const roundMatches: BracketMatch[] = [];
    const nextFeeders: (MatchSlotFeeder | null)[] = [];

    if (m % 2 === 0) {
      // Drop-in round from Winners: lower survivors face drop-ins from WR(r + 1)
      const r = m / 2; // e.g. m = 2 -> r = 1 (WR2); m = 4 -> r = 2 (WR3)
      const wrDropRound = wrMatchesByRound[r + 1];
      const slotCount = wrDropRound.length;

      for (let j = 0; j < slotCount; j++) {
        const fA = currentFeeders[j] || null;
        // Inverted crossover for drop-in from Winners to Losers
        const wrSrc = wrDropRound[slotCount - 1 - j];
        const fB: MatchSlotFeeder = { matchId: wrSrc.id, type: 'LOSER' };

        if (fA) {
          const matchNumInRound = roundMatches.length + 1;
          const id = `${prefix}l${m}-m${matchNumInRound}`;
          const match: BracketMatch = {
            id,
            tierId,
            stage: 'LOSERS',
            roundIdentifier: roundIdent,
            roundNumber: lrRoundNumber,
            roundIndex: lrRoundNumber - 1,
            matchNumber: 0,
            player1: { player: null, sourceMatchId: fA.matchId },
            player2: { player: null, sourceMatchId: fB.matchId },
            slotA: fA,
            slotB: fB,
            winnerId: null,
            loserId: null,
            bestOf: getBestOf(roundIdent, lrRoundNumber),
            isBye: false,
          };

          if (fA.matchId && matchesById[fA.matchId]) {
            if (fA.type === 'LOSER') {
              matchesById[fA.matchId].loserNextMatchId = id;
              matchesById[fA.matchId].loserNextMatchSlot = 1;
            } else {
              matchesById[fA.matchId].nextMatchId = id;
              matchesById[fA.matchId].nextMatchSlot = 1;
            }
          }
          if (fB.matchId && matchesById[fB.matchId]) {
            matchesById[fB.matchId].loserNextMatchId = id;
            matchesById[fB.matchId].loserNextMatchSlot = 2;
          }

          roundMatches.push(match);
          matchesById[id] = match;
          nextFeeders.push({ matchId: id, type: 'WINNER' });
        } else {
          // fA was empty (both WR1 feeders were byes), so the WR drop-in player gets a bye through this loser round
          nextFeeders.push(fB);
        }
      }
    } else {
      // Consolidation round: pairs of lower survivors play each other
      const slotCount = currentFeeders.length / 2;

      for (let k = 0; k < slotCount; k++) {
        const fA = currentFeeders[2 * k];
        const fB = currentFeeders[2 * k + 1];

        if (fA && fB) {
          const matchNumInRound = roundMatches.length + 1;
          const id = `${prefix}l${m}-m${matchNumInRound}`;
          const match: BracketMatch = {
            id,
            tierId,
            stage: 'LOSERS',
            roundIdentifier: roundIdent,
            roundNumber: lrRoundNumber,
            roundIndex: lrRoundNumber - 1,
            matchNumber: 0,
            player1: { player: null, sourceMatchId: fA.matchId },
            player2: { player: null, sourceMatchId: fB.matchId },
            slotA: fA,
            slotB: fB,
            winnerId: null,
            loserId: null,
            bestOf: getBestOf(roundIdent, lrRoundNumber),
            isBye: false,
          };

          if (fA.matchId && matchesById[fA.matchId]) {
            if (fA.type === 'LOSER') {
              matchesById[fA.matchId].loserNextMatchId = id;
              matchesById[fA.matchId].loserNextMatchSlot = 1;
            } else {
              matchesById[fA.matchId].nextMatchId = id;
              matchesById[fA.matchId].nextMatchSlot = 1;
            }
          }
          if (fB.matchId && matchesById[fB.matchId]) {
            if (fB.type === 'LOSER') {
              matchesById[fB.matchId].loserNextMatchId = id;
              matchesById[fB.matchId].loserNextMatchSlot = 2;
            } else {
              matchesById[fB.matchId].nextMatchId = id;
              matchesById[fB.matchId].nextMatchSlot = 2;
            }
          }

          roundMatches.push(match);
          matchesById[id] = match;
          nextFeeders.push({ matchId: id, type: 'WINNER' });
        } else if (fA || fB) {
          nextFeeders.push(fA || fB);
        } else {
          nextFeeders.push(null);
        }
      }
    }

    if (roundMatches.length > 0) {
      losersRounds.push({
        roundNumber: lrRoundNumber++,
        name: roundName,
        stage: 'LOSERS',
        roundIdentifier: roundIdent,
        matches: roundMatches,
      });
    }
    currentFeeders = nextFeeders;
  }

  // ==========================================
  // 3. GRAND FINALS
  // ==========================================
  const wfMatch = wrMatchesByRound[K][0];
  const lastLosersRound = losersRounds[losersRounds.length - 1];
  const lfMatch = lastLosersRound.matches[0];

  const gf1Id = `${prefix}gf1`;
  const gfRoundNum = winnersRounds.length + losersRounds.length + 1;

  const gf1Match: BracketMatch = {
    id: gf1Id,
    tierId,
    stage: 'GRAND_FINALS',
    roundIdentifier: 'GF',
    roundNumber: gfRoundNum,
    roundIndex: gfRoundNum - 1,
    matchNumber: 0,
    player1: { player: null, sourceMatchId: wfMatch.id },
    player2: { player: null, sourceMatchId: lfMatch.id },
    slotA: { matchId: wfMatch.id, type: 'WINNER' },
    slotB: { matchId: lfMatch.id, type: 'WINNER' },
    winnerId: null,
    loserId: null,
    bestOf: getBestOf('GF', gfRoundNum),
    isBye: false,
  };

  wfMatch.nextMatchId = gf1Id;
  wfMatch.nextMatchSlot = 1;
  lfMatch.nextMatchId = gf1Id;
  lfMatch.nextMatchSlot = 2;
  matchesById[gf1Id] = gf1Match;

  const grandFinalsRound: BracketRound = {
    roundNumber: gfRoundNum,
    name: 'GF',
    stage: 'GRAND_FINALS',
    roundIdentifier: 'GF',
    matches: [gf1Match],
  };

  // ==========================================
  // 4. FLAT SEQUENTIAL MATCH NUMBERING & ROUND NUMBERING
  // ==========================================
  let globalMatchNum = 1;

  for (const round of winnersRounds) {
    for (const match of round.matches) {
      match.matchNumber = globalMatchNum++;
    }
  }

  for (const round of losersRounds) {
    for (const match of round.matches) {
      match.matchNumber = globalMatchNum++;
    }
  }

  gf1Match.matchNumber = globalMatchNum++;

  // Apply canonical round names (Source of truth for all views)
  applyDoubleElimRoundNames(winnersRounds, losersRounds, grandFinalsRound);

  const allRounds = [...winnersRounds, ...losersRounds, grandFinalsRound];
  for (let rIdx = 0; rIdx < allRounds.length; rIdx++) {
    allRounds[rIdx].roundNumber = rIdx + 1;
    for (const match of allRounds[rIdx].matches) {
      match.roundNumber = rIdx + 1;
      match.roundIndex = rIdx;
    }
  }

  return {
    tierId,
    type: 'TRADITIONAL',
    eliminationType: 'DOUBLE',
    bracketRouting: 'TRADITIONAL_TREE',
    totalPlayers,
    totalRounds: allRounds.length,
    rounds: allRounds,
    matchesById,
  };
}

/**
 * Variant B: Flat Staged Double Elimination (AIE DAS / CTWC DAS 2024–2025 Style)
 * Supports step-in seed injection rounds with fixed horizontal lower rails and inverted crossover.
 */
export function generateFlatDoubleElim(
  playersOrConfig: SeededPlayer[] | { players: SeededPlayer[]; flatWidth?: number; options?: GenerateBracketOptions },
  flatWidthArg?: number,
  optionsArg?: GenerateBracketOptions
): BracketStructure {
  let players: SeededPlayer[];
  let flatWidth: number;
  let options: GenerateBracketOptions;

  if (Array.isArray(playersOrConfig)) {
    players = playersOrConfig;
    flatWidth = flatWidthArg || 4;
    options = optionsArg || {};
  } else {
    players = playersOrConfig.players;
    flatWidth = playersOrConfig.flatWidth || 4;
    options = playersOrConfig.options || {};
  }

  const totalPlayers = players.length;
  if (flatWidth < 4 || totalPlayers <= 2 * flatWidth) {
    return generateTraditionalDoubleElim({ players, options });
  }
  if (totalPlayers % flatWidth !== 0) {
    throw new Error(`Participant count (${totalPlayers}) must be a multiple of flat width (${flatWidth}) for flat staged double elimination.`);
  }

  const { tierId, bestOf = 3, roundBestOfOverrides = {} } = options;
  const getBestOf = createBestOfResolver(bestOf, roundBestOfOverrides);
  const prefix = tierId ? `${tierId}-` : '';

  // Map players by seed
  const playerBySeed = new Map<number, SeededPlayer>();
  for (const p of players) {
    playerBySeed.set(p.seed, p);
  }

  // Number of seed injection rounds: K = (N / W) - 1
  const K = Math.floor(totalPlayers / flatWidth) - 1;

  const matchesById: Record<string, BracketMatch> = {};
  const winnersRounds: BracketRound[] = [];
  const losersRounds: BracketRound[] = [];

  // ==========================================
  // 1. WINNERS BRACKET
  // ==========================================
  const wrMatchesByRound: BracketMatch[][] = [];
  const leaders = getStandardLeaders(2 * flatWidth);

  // Round 1: Seeds (N - 2W + 1) through N play W matches
  {
    const r1SeedStart = totalPlayers - 2 * flatWidth + 1;
    const r1Matches: BracketMatch[] = [];

    for (let m = 0; m < flatWidth; m++) {
      const id = `${prefix}w1-m${m + 1}`;
      const relRank = leaders[m];
      const s1 = r1SeedStart + (relRank - 1);
      const s2 = totalPlayers - (relRank - 1);
      const p1 = playerBySeed.get(s1);
      const p2 = playerBySeed.get(s2);

      const match: BracketMatch = {
        id,
        tierId,
        stage: 'WINNERS',
        roundIdentifier: 'W1',
        roundNumber: 1,
        roundIndex: 0,
        matchNumber: 0,
        player1: { player: p1 || null },
        player2: { player: p2 || null },
        slotA: { type: 'DIRECT' },
        slotB: { type: 'DIRECT' },
        winnerId: null,
        loserId: null,
        bestOf: getBestOf('W1', 1),
        isBye: false,
      };

      r1Matches.push(match);
      matchesById[id] = match;
    }

    wrMatchesByRound.push(r1Matches);
    winnersRounds.push({
      roundNumber: 1,
      name: 'WR1',
      stage: 'WINNERS',
      roundIdentifier: 'W1',
      matches: r1Matches,
    });
  }

  // Rounds 2..K: The W advancing winners face the next tier of incoming seeds
  for (let r = 2; r <= K; r++) {
    const roundNumber = r;
    const roundIdent = `W${r}`;
    const roundName = `WR${r}`;
    const rMatches: BracketMatch[] = [];

    // Incoming seeds: from (N - (r + 1) * W + 1) to (N - r * W)
    const seedStart = totalPlayers - (r + 1) * flatWidth + 1;
    const prevWinners = wrMatchesByRound[r - 2];

    for (let m = 0; m < flatWidth; m++) {
      const id = `${prefix}w${r}-m${m + 1}`;
      const relRank = leaders[m];
      const stepInSeed = seedStart + (relRank - 1);
      const stepInPlayer = playerBySeed.get(stepInSeed);
      const prevMatch = prevWinners[m];

      const match: BracketMatch = {
        id,
        tierId,
        stage: 'WINNERS',
        roundIdentifier: roundIdent,
        roundNumber,
        roundIndex: r - 1,
        matchNumber: 0,
        player1: { player: stepInPlayer || null },
        player2: { player: null, sourceMatchId: prevMatch?.id },
        slotA: { type: 'DIRECT' },
        slotB: { matchId: prevMatch?.id, type: 'WINNER' },
        winnerId: null,
        loserId: null,
        bestOf: getBestOf(roundIdent, roundNumber),
        isBye: false,
      };

      if (prevMatch) {
        prevMatch.nextMatchId = id;
        prevMatch.nextMatchSlot = 2;
      }

      rMatches.push(match);
      matchesById[id] = match;
    }

    wrMatchesByRound.push(rMatches);
    winnersRounds.push({
      roundNumber,
      name: roundName,
      stage: 'WINNERS',
      roundIdentifier: roundIdent,
      matches: rMatches,
    });
  }

  // Round K+1 onwards: Bracket contracts standard binary-style (W -> W/2 -> ... -> 1)
  let currentContractionWidth = flatWidth / 2;
  let currRoundNumber = K + 1;

  while (currentContractionWidth >= 1) {
    const roundIdent = `W${currRoundNumber}`;
    const roundName = `WR${currRoundNumber}`;
    const rMatches: BracketMatch[] = [];
    const prevMatches = wrMatchesByRound[wrMatchesByRound.length - 1];

    for (let m = 0; m < currentContractionWidth; m++) {
      const id = `${prefix}w${currRoundNumber}-m${m + 1}`;
      const f1 = prevMatches[2 * m];
      const f2 = prevMatches[2 * m + 1];

      const match: BracketMatch = {
        id,
        tierId,
        stage: 'WINNERS',
        roundIdentifier: roundIdent,
        roundNumber: currRoundNumber,
        roundIndex: currRoundNumber - 1,
        matchNumber: 0,
        player1: { player: null, sourceMatchId: f1.id },
        player2: { player: null, sourceMatchId: f2.id },
        slotA: { matchId: f1.id, type: 'WINNER' },
        slotB: { matchId: f2.id, type: 'WINNER' },
        winnerId: null,
        loserId: null,
        bestOf: getBestOf(roundIdent, currRoundNumber),
        isBye: false,
      };

      f1.nextMatchId = id;
      f1.nextMatchSlot = 1;
      f2.nextMatchId = id;
      f2.nextMatchSlot = 2;

      rMatches.push(match);
      matchesById[id] = match;
    }

    wrMatchesByRound.push(rMatches);
    winnersRounds.push({
      roundNumber: currRoundNumber,
      name: roundName,
      stage: 'WINNERS',
      roundIdentifier: roundIdent,
      matches: rMatches,
    });

    currentContractionWidth = Math.floor(currentContractionWidth / 2);
    currRoundNumber++;
  }

  // ==========================================
  // 2. LOSERS BRACKET
  // ==========================================
  let lrRoundNum = 1;

  // LR1: Lower rail receives WR1 losers, upper drops receive WR2 losers with inverted crossover
  const wr1Losers = wrMatchesByRound[0];
  const wr2Losers = wrMatchesByRound[1];
  const lr1Matches: BracketMatch[] = [];

  for (let m = 0; m < flatWidth; m++) {
    const id = `${prefix}l1-m${m + 1}`;
    const wr1Src = wr1Losers[flatWidth - 1 - m]; // inverted crossover
    const wr2Src = wr2Losers[m];

    const match: BracketMatch = {
      id,
      tierId,
      stage: 'LOSERS',
      roundIdentifier: 'L1',
      roundNumber: lrRoundNum,
      roundIndex: lrRoundNum - 1,
      matchNumber: 0,
      player1: { player: null, sourceMatchId: wr1Src.id },
      player2: { player: null, sourceMatchId: wr2Src.id },
      slotA: { matchId: wr1Src.id, type: 'LOSER' },
      slotB: { matchId: wr2Src.id, type: 'LOSER' },
      winnerId: null,
      loserId: null,
      bestOf: getBestOf('L1', lrRoundNum),
      isBye: false,
    };

    wr1Src.loserNextMatchId = id;
    wr1Src.loserNextMatchSlot = 1;
    wr2Src.loserNextMatchId = id;
    wr2Src.loserNextMatchSlot = 2;

    lr1Matches.push(match);
    matchesById[id] = match;
  }

  losersRounds.push({
    roundNumber: lrRoundNum++,
    name: 'LR1',
    stage: 'LOSERS',
    roundIdentifier: 'L1',
    matches: lr1Matches,
  });

  let prevLosersMatches = lr1Matches;

  // LR2 through LR(K-1): Fixed horizontal rails on slotA, inverted crossover drop-ins on slotB
  for (let p = 2; p <= K - 1; p++) {
    const roundIdent = `L${lrRoundNum}`;
    const roundName = `LR${lrRoundNum}`;
    const roundMatches: BracketMatch[] = [];
    const wrDropRound = wrMatchesByRound[p]; // WR(p+1) losers

    for (let m = 0; m < flatWidth; m++) {
      const id = `${prefix}l${lrRoundNum}-m${m + 1}`;
      const lrPrev = prevLosersMatches[m]; // Fixed horizontal rail
      const wrDrop = wrDropRound[flatWidth - 1 - m]; // Inverted crossover drop-in

      const match: BracketMatch = {
        id,
        tierId,
        stage: 'LOSERS',
        roundIdentifier: roundIdent,
        roundNumber: lrRoundNum,
        roundIndex: lrRoundNum - 1,
        matchNumber: 0,
        player1: { player: null, sourceMatchId: lrPrev.id },
        player2: { player: null, sourceMatchId: wrDrop.id },
        slotA: { matchId: lrPrev.id, type: 'WINNER' },
        slotB: { matchId: wrDrop.id, type: 'LOSER' },
        winnerId: null,
        loserId: null,
        bestOf: getBestOf(roundIdent, lrRoundNum),
        isBye: false,
      };

      lrPrev.nextMatchId = id;
      lrPrev.nextMatchSlot = 1;
      wrDrop.loserNextMatchId = id;
      wrDrop.loserNextMatchSlot = 2;

      roundMatches.push(match);
      matchesById[id] = match;
    }

    losersRounds.push({
      roundNumber: lrRoundNum++,
      name: roundName,
      stage: 'LOSERS',
      roundIdentifier: roundIdent,
      matches: roundMatches,
    });
    prevLosersMatches = roundMatches;
  }

  // LR_K: Consolidation round of the W survivors (e.g. 4 -> 2 matches)
  {
    const roundIdent = `L${lrRoundNum}`;
    const roundName = `LR${lrRoundNum}`;
    const roundMatches: BracketMatch[] = [];
    const count = prevLosersMatches.length / 2;

    for (let m = 0; m < count; m++) {
      const id = `${prefix}l${lrRoundNum}-m${m + 1}`;
      const f1 = prevLosersMatches[2 * m];
      const f2 = prevLosersMatches[2 * m + 1];

      const match: BracketMatch = {
        id,
        tierId,
        stage: 'LOSERS',
        roundIdentifier: roundIdent,
        roundNumber: lrRoundNum,
        roundIndex: lrRoundNum - 1,
        matchNumber: 0,
        player1: { player: null, sourceMatchId: f1.id },
        player2: { player: null, sourceMatchId: f2.id },
        slotA: { matchId: f1.id, type: 'WINNER' },
        slotB: { matchId: f2.id, type: 'WINNER' },
        winnerId: null,
        loserId: null,
        bestOf: getBestOf(roundIdent, lrRoundNum),
        isBye: false,
      };

      f1.nextMatchId = id;
      f1.nextMatchSlot = 1;
      f2.nextMatchId = id;
      f2.nextMatchSlot = 2;

      roundMatches.push(match);
      matchesById[id] = match;
    }

    losersRounds.push({
      roundNumber: lrRoundNum++,
      name: roundName,
      stage: 'LOSERS',
      roundIdentifier: roundIdent,
      matches: roundMatches,
    });
    prevLosersMatches = roundMatches;
  }

  // LR_(K+1): Top 6 Cross-drop with Winners Semifinals losers!
  // Match 1: Lower R(K) Winner 1 vs Loser of Winners Semi 2
  // Match 2: Lower R(K) Winner 2 vs Loser of Winners Semi 1
  {
    const roundIdent = `L${lrRoundNum}`;
    const roundName = `LR${lrRoundNum}`;
    const roundMatches: BracketMatch[] = [];
    const semisRound = wrMatchesByRound[wrMatchesByRound.length - 2]; // Penultimate round is Semis

    const id1 = `${prefix}l${lrRoundNum}-m1`;
    const f1 = prevLosersMatches[0];
    const semi2 = semisRound[1];

    const match1: BracketMatch = {
      id: id1,
      tierId,
      stage: 'LOSERS',
      roundIdentifier: roundIdent,
      roundNumber: lrRoundNum,
      roundIndex: lrRoundNum - 1,
      matchNumber: 0,
      player1: { player: null, sourceMatchId: f1.id },
      player2: { player: null, sourceMatchId: semi2.id },
      slotA: { matchId: f1.id, type: 'WINNER' },
      slotB: { matchId: semi2.id, type: 'LOSER' },
      winnerId: null,
      loserId: null,
      bestOf: getBestOf(roundIdent, lrRoundNum),
      isBye: false,
    };
    f1.nextMatchId = id1;
    f1.nextMatchSlot = 1;
    semi2.loserNextMatchId = id1;
    semi2.loserNextMatchSlot = 2;
    roundMatches.push(match1);
    matchesById[id1] = match1;

    const id2 = `${prefix}l${lrRoundNum}-m2`;
    const f2 = prevLosersMatches[1];
    const semi1 = semisRound[0];

    const match2: BracketMatch = {
      id: id2,
      tierId,
      stage: 'LOSERS',
      roundIdentifier: roundIdent,
      roundNumber: lrRoundNum,
      roundIndex: lrRoundNum - 1,
      matchNumber: 0,
      player1: { player: null, sourceMatchId: f2.id },
      player2: { player: null, sourceMatchId: semi1.id },
      slotA: { matchId: f2.id, type: 'WINNER' },
      slotB: { matchId: semi1.id, type: 'LOSER' },
      winnerId: null,
      loserId: null,
      bestOf: getBestOf(roundIdent, lrRoundNum),
      isBye: false,
    };
    f2.nextMatchId = id2;
    f2.nextMatchSlot = 1;
    semi1.loserNextMatchId = id2;
    semi1.loserNextMatchSlot = 2;
    roundMatches.push(match2);
    matchesById[id2] = match2;

    losersRounds.push({
      roundNumber: lrRoundNum++,
      name: roundName,
      stage: 'LOSERS',
      roundIdentifier: roundIdent,
      matches: roundMatches,
    });
    prevLosersMatches = roundMatches;
  }

  // LR_(K+2): Consolidation round (2 -> 1 match)
  {
    const roundIdent = `L${lrRoundNum}`;
    const roundName = `LR${lrRoundNum}`;
    const id = `${prefix}l${lrRoundNum}-m1`;
    const f1 = prevLosersMatches[0];
    const f2 = prevLosersMatches[1];

    const match: BracketMatch = {
      id,
      tierId,
      stage: 'LOSERS',
      roundIdentifier: roundIdent,
      roundNumber: lrRoundNum,
      roundIndex: lrRoundNum - 1,
      matchNumber: 0,
      player1: { player: null, sourceMatchId: f1.id },
      player2: { player: null, sourceMatchId: f2.id },
      slotA: { matchId: f1.id, type: 'WINNER' },
      slotB: { matchId: f2.id, type: 'WINNER' },
      winnerId: null,
      loserId: null,
      bestOf: getBestOf(roundIdent, lrRoundNum),
      isBye: false,
    };

    f1.nextMatchId = id;
    f1.nextMatchSlot = 1;
    f2.nextMatchId = id;
    f2.nextMatchSlot = 2;

    const roundMatches = [match];
    matchesById[id] = match;

    losersRounds.push({
      roundNumber: lrRoundNum++,
      name: roundName,
      stage: 'LOSERS',
      roundIdentifier: roundIdent,
      matches: roundMatches,
    });
    prevLosersMatches = roundMatches;
  }

  // LR_(K+3): Losers Finals (survivor vs loser of Winners Finals)
  {
    const roundIdent = `L${lrRoundNum}`;
    const roundName = `LR${lrRoundNum}`;
    const id = `${prefix}l${lrRoundNum}-m1`;
    const lrSurvivor = prevLosersMatches[0];
    const wfMatch = wrMatchesByRound[wrMatchesByRound.length - 1][0];

    const match: BracketMatch = {
      id,
      tierId,
      stage: 'LOSERS',
      roundIdentifier: roundIdent,
      roundNumber: lrRoundNum,
      roundIndex: lrRoundNum - 1,
      matchNumber: 0,
      player1: { player: null, sourceMatchId: lrSurvivor.id },
      player2: { player: null, sourceMatchId: wfMatch.id },
      slotA: { matchId: lrSurvivor.id, type: 'WINNER' },
      slotB: { matchId: wfMatch.id, type: 'LOSER' },
      winnerId: null,
      loserId: null,
      bestOf: getBestOf(roundIdent, lrRoundNum),
      isBye: false,
    };

    lrSurvivor.nextMatchId = id;
    lrSurvivor.nextMatchSlot = 1;
    wfMatch.loserNextMatchId = id;
    wfMatch.loserNextMatchSlot = 2;

    const roundMatches = [match];
    matchesById[id] = match;

    losersRounds.push({
      roundNumber: lrRoundNum++,
      name: roundName,
      stage: 'LOSERS',
      roundIdentifier: roundIdent,
      matches: roundMatches,
    });
    prevLosersMatches = roundMatches;
  }

  // ==========================================
  // 3. GRAND FINALS
  // ==========================================
  const gfRoundNum = lrRoundNum;
  const wfMatch = wrMatchesByRound[wrMatchesByRound.length - 1][0];
  const lfMatch = prevLosersMatches[0];
  const gf1Id = `${prefix}gf1`;

  const gf1Match: BracketMatch = {
    id: gf1Id,
    tierId,
    stage: 'GRAND_FINALS',
    roundIdentifier: 'GF',
    roundNumber: gfRoundNum,
    roundIndex: gfRoundNum - 1,
    matchNumber: 0,
    player1: { player: null, sourceMatchId: wfMatch.id },
    player2: { player: null, sourceMatchId: lfMatch.id },
    slotA: { matchId: wfMatch.id, type: 'WINNER' },
    slotB: { matchId: lfMatch.id, type: 'WINNER' },
    winnerId: null,
    loserId: null,
    bestOf: getBestOf('GF', gfRoundNum),
    isBye: false,
  };

  wfMatch.nextMatchId = gf1Id;
  wfMatch.nextMatchSlot = 1;
  lfMatch.nextMatchId = gf1Id;
  lfMatch.nextMatchSlot = 2;
  matchesById[gf1Id] = gf1Match;

  const grandFinalsRound: BracketRound = {
    roundNumber: gfRoundNum,
    name: 'GF',
    stage: 'GRAND_FINALS',
    roundIdentifier: 'GF',
    matches: [gf1Match],
  };

  // ==========================================
  // 4. FLAT SEQUENTIAL MATCH NUMBERING
  // ==========================================
  let globalMatchNum = 1;

  for (const round of winnersRounds) {
    for (const match of round.matches) {
      match.matchNumber = globalMatchNum++;
    }
  }

  for (const round of losersRounds) {
    for (const match of round.matches) {
      match.matchNumber = globalMatchNum++;
    }
  }

  gf1Match.matchNumber = globalMatchNum++;

  // Apply canonical round names (Source of truth for all views)
  applyDoubleElimRoundNames(winnersRounds, losersRounds, grandFinalsRound);

  const allRounds = [...winnersRounds, ...losersRounds, grandFinalsRound];
  for (let rIdx = 0; rIdx < allRounds.length; rIdx++) {
    allRounds[rIdx].roundNumber = rIdx + 1;
    for (const match of allRounds[rIdx].matches) {
      match.roundNumber = rIdx + 1;
      match.roundIndex = rIdx;
    }
  }

  return {
    tierId,
    type: 'FLAT',
    eliminationType: 'DOUBLE',
    bracketRouting: 'FLAT_STAGED',
    flatWidth,
    totalPlayers,
    totalRounds: allRounds.length,
    rounds: allRounds,
    matchesById,
  };
}

/**
 * Variant C: Accelerated Hybrid Double Elimination (CTWC DAS 2026 Style)
 * 
 * Orchestrates existing generators:
 * - Accelerated Round (Round C): seeds 1..finalsCutoff (C / 2 matches)
 *   - Winners advance directly to Phase 2 (Top C Championship) as Upper Qualifiers
 *   - Losers advance to Slot B of 2nd Chance Round
 * - Pre-Merge Qualification Stage: seeds (finalsCutoff + 1)..totalPlayers in traditional double-elimination,
 *   halting when C / 2 upper qualifiers and C / 2 lower survivors remain.
 *   - Upper Pre-Merge qualifiers advance to Slot A of Play-Offs
 *   - Lower Pre-Merge survivors advance to Slot A of 2nd Chance Round
 * - 2nd Chance Round (Round XB): C / 2 matches (Lower Pre-Merge survivors vs Accelerated Round losers).
 *   - Winners advance to Slot B of Play-Offs
 * - Play-Offs (Round B): C / 2 matches (Upper Pre-Merge qualifiers vs 2nd Chance winners).
 *   - Winners advance to Phase 2 (Top C Championship) as Play-Off Qualifiers
 * - Phase 2: Clean finalsCutoff-player Single-Elimination Championship tree via generateTraditionalBracket.
 *   - Slot A: Accelerated Round winners
 *   - Slot B: Play-Offs winners
 *   - Progresses through Round of C -> Quarterfinals -> Semifinals -> Finals
 */
export function generateAcceleratedHybrid(
  playersOrConfig: SeededPlayer[] | { players: SeededPlayer[]; finalsCutoff?: number; options?: GenerateBracketOptions },
  finalsCutoffArg?: number,
  optionsArg?: GenerateBracketOptions
): BracketStructure {
  let players: SeededPlayer[];
  let finalsCutoff: number;
  let options: GenerateBracketOptions;

  if (Array.isArray(playersOrConfig)) {
    players = playersOrConfig;
    finalsCutoff = finalsCutoffArg || 16;
    options = optionsArg || {};
  } else {
    players = playersOrConfig.players;
    finalsCutoff = playersOrConfig.finalsCutoff || 16;
    options = playersOrConfig.options || {};
  }

  const totalPlayers = players.length;
  if (totalPlayers < finalsCutoff) {
    throw new Error(`Accelerated hybrid bracket requires at least finalsCutoff (${finalsCutoff}) players, received ${totalPlayers}`);
  }

  const { tierId, bestOf = 3, roundBestOfOverrides = {} } = options;
  const getBestOf = createBestOfResolver(bestOf, roundBestOfOverrides);
  const prefix = tierId ? `${tierId}-` : '';

  const playerBySeed = new Map<number, SeededPlayer>();
  for (const p of players) {
    playerBySeed.set(p.seed, p);
  }

  const matchesById: Record<string, BracketMatch> = {};
  const rounds: BracketRound[] = [];
  let roundIndexCounter = 0;
  let roundNumberCounter = 1;

  // ----------------------------------------------------
  // Component 1: Accelerated Round (AR, Round C)
  // Seeds 1..finalsCutoff play M = finalsCutoff / 2 matches
  // Winners -> Phase 2 Round 1 Slot A
  // Losers  -> 2nd Chance Round Slot B
  // ----------------------------------------------------
  const mAcc = finalsCutoff / 2;
  const arMatches: BracketMatch[] = [];

  for (let m = 0; m < mAcc; m++) {
    const id = `${prefix}ar-m${m + 1}`;
    const s1 = m + 1;
    const s2 = finalsCutoff - m;
    const p1 = playerBySeed.get(s1);
    const p2 = playerBySeed.get(s2);

    const match: BracketMatch = {
      id,
      tierId,
      stage: 'WINNERS',
      phase: 'QUALIFIERS',
      subTrack: 'ACCELERATED',
      roundIdentifier: 'AR',
      roundNumber: roundNumberCounter,
      roundIndex: roundIndexCounter,
      matchNumber: 0,
      player1: { player: p1 || null },
      player2: { player: p2 || null },
      slotA: { type: 'DIRECT' },
      slotB: { type: 'DIRECT' },
      winnerId: null,
      loserId: null,
      bestOf: getBestOf('AR', roundNumberCounter),
      isBye: false,
    };

    arMatches.push(match);
    matchesById[id] = match;
  }

  const arRound: BracketRound = {
    roundNumber: roundNumberCounter++,
    name: 'Accelerated Round',
    stage: 'WINNERS',
    phase: 'QUALIFIERS',
    roundIdentifier: 'AR',
    matches: arMatches,
  };
  roundIndexCounter++;

  // ----------------------------------------------------
  // Component 2: Pre-Merge Qualification Stage
  // Seeds (finalsCutoff + 1)..totalPlayers enter a standard Double Elimination bracket
  // Halts when M = finalsCutoff / 2 upper qualifiers and M lower survivors remain.
  // ----------------------------------------------------
  const numPreMergePlayers = totalPlayers - finalsCutoff;
  const preMergeUpperRounds: BracketRound[] = [];
  const preMergeLowerRounds: BracketRound[] = [];
  let upperQualifierMatches: BracketMatch[] = [];
  let lowerSurvivorMatches: BracketMatch[] = [];

  if (numPreMergePlayers > 0) {
    const prePlayers: SeededPlayer[] = [];
    for (let s = finalsCutoff + 1; s <= totalPlayers; s++) {
      const p = playerBySeed.get(s);
      if (p) {
        prePlayers.push(p);
      } else {
        prePlayers.push({ id: `p${s}`, name: `Player ${s}`, seed: s });
      }
    }
    prePlayers.sort((a, b) => a.seed - b.seed);

    // Normalize seeds to 1..P for generateTraditionalDoubleElim
    const normalizedPrePlayers: SeededPlayer[] = prePlayers.map((p, idx) => ({
      ...p,
      seed: idx + 1,
    }));

    const preDE = generateTraditionalDoubleElim(normalizedPrePlayers, {
      tierId: tierId ? `${tierId}-pre` : 'pre',
      bestOf,
      roundBestOfOverrides,
    });

    const normalizedToRealPlayer = new Map<number, SeededPlayer>();
    prePlayers.forEach((p, idx) => {
      normalizedToRealPlayer.set(idx + 1, p);
    });

    const restorePlayer = (part: MatchParticipant) => {
      if (part.player && normalizedToRealPlayer.has(part.player.seed)) {
        part.player = normalizedToRealPlayer.get(part.player.seed)!;
      }
    };

    // Filter raw Winners rounds up to halting threshold (when matches.length === mAcc)
    const rawWinnersRounds = preDE.rounds.filter(
      (r) => r.stage === 'WINNERS' || r.roundIdentifier?.startsWith('W')
    );

    let upperHaltingIdx = rawWinnersRounds.findIndex((r) => r.matches.length === mAcc);
    if (upperHaltingIdx === -1) {
      upperHaltingIdx = rawWinnersRounds.findIndex((r) => r.matches.length <= mAcc);
      if (upperHaltingIdx === -1) {
        upperHaltingIdx = rawWinnersRounds.length - 1;
      }
    }

    const keptWinners = rawWinnersRounds.slice(0, upperHaltingIdx + 1);

    // Filter raw Losers rounds up to halting threshold
    const rawLosersRounds = preDE.rounds.filter(
      (r) => r.stage === 'LOSERS' || r.roundIdentifier?.startsWith('L')
    );

    let keptLosers: BracketRound[] = [];
    if (rawWinnersRounds[0].matches.length > mAcc) {
      let lowerHaltingIdx = -1;
      for (let i = 0; i < rawLosersRounds.length; i++) {
        const lr = rawLosersRounds[i];
        if (lr.matches.length === mAcc) {
          lowerHaltingIdx = i;
        } else if (lr.matches.length < mAcc && lowerHaltingIdx !== -1) {
          break;
        }
      }
      if (lowerHaltingIdx !== -1) {
        keptLosers = rawLosersRounds.slice(0, lowerHaltingIdx + 1);
      }
    }

    // Format and register kept Winners rounds
    keptWinners.forEach((r, idx) => {
      const roundIdent = `PRE_W${idx + 1}`;
      r.roundIdentifier = roundIdent;
      r.name = `Upper Bracket R${idx + 1}`;
      r.stage = 'WINNERS';
      r.phase = 'QUALIFIERS';
      r.roundNumber = roundNumberCounter++;
      r.matches.forEach((m) => {
        m.stage = 'WINNERS';
        m.phase = 'QUALIFIERS';
        m.subTrack = 'PRE_MERGE_UPPER';
        m.roundIdentifier = roundIdent;
        m.roundNumber = r.roundNumber;
        m.roundIndex = roundIndexCounter;
        restorePlayer(m.player1);
        restorePlayer(m.player2);
        matchesById[m.id] = m;
      });
      roundIndexCounter++;
      preMergeUpperRounds.push(r);
    });

    // Format and register kept Losers rounds
    keptLosers.forEach((r, idx) => {
      const roundIdent = `PRE_L${idx + 1}`;
      r.roundIdentifier = roundIdent;
      r.name = `Lower Bracket R${idx + 1}`;
      r.stage = 'LOSERS';
      r.phase = 'QUALIFIERS';
      r.roundNumber = roundNumberCounter++;
      r.matches.forEach((m) => {
        m.stage = 'LOSERS';
        m.phase = 'QUALIFIERS';
        m.subTrack = 'PRE_MERGE_LOWER';
        m.roundIdentifier = roundIdent;
        m.roundNumber = r.roundNumber;
        m.roundIndex = roundIndexCounter;
        restorePlayer(m.player1);
        restorePlayer(m.player2);
        matchesById[m.id] = m;
      });
      roundIndexCounter++;
      preMergeLowerRounds.push(r);
    });

    // Disconnect downstream links on halting rounds (to be connected to PO and 2C)
    const upperHaltingRound = preMergeUpperRounds[preMergeUpperRounds.length - 1];
    upperQualifierMatches = upperHaltingRound ? upperHaltingRound.matches : [];
    for (const m of upperQualifierMatches) {
      m.nextMatchId = undefined;
      m.nextMatchSlot = undefined;
    }

    if (preMergeLowerRounds.length > 0) {
      const lowerHaltingRound = preMergeLowerRounds[preMergeLowerRounds.length - 1];
      lowerSurvivorMatches = lowerHaltingRound ? lowerHaltingRound.matches : [];
      for (const m of lowerSurvivorMatches) {
        m.nextMatchId = undefined;
        m.nextMatchSlot = undefined;
      }
    } else {
      lowerSurvivorMatches = upperQualifierMatches;
    }
  }

  // ----------------------------------------------------
  // Component 3: 2nd Chance Round (Round XB)
  // Consists of M = finalsCutoff / 2 matches
  // Slot A: Fed by M Lower Pre-Merge survivors (or upper losers if no lower rounds)
  // Slot B: Fed by M Accelerated Round losers
  // Winners -> Slot B of Play-Offs
  // ----------------------------------------------------
  const secondChanceMatches: BracketMatch[] = [];
  const scRoundNumber = roundNumberCounter++;

  for (let m = 0; m < mAcc; m++) {
    const id = `${prefix}2c-m${m + 1}`;
    const arMatch = arMatches[m];
    const feederLower = lowerSurvivorMatches.length > 0
      ? lowerSurvivorMatches[m % lowerSurvivorMatches.length]
      : undefined;

    const isLowerFeederWinner = preMergeLowerRounds.length > 0;
    const p1SrcId = feederLower?.id;
    const p2SrcId = arMatch.id;

    const match: BracketMatch = {
      id,
      tierId,
      stage: 'LOSERS',
      phase: 'QUALIFIERS',
      subTrack: 'RE_CLIMB',
      roundIdentifier: '2C',
      roundNumber: scRoundNumber,
      roundIndex: roundIndexCounter,
      matchNumber: 0,
      player1: { player: null, sourceMatchId: p1SrcId },
      player2: { player: null, sourceMatchId: p2SrcId },
      slotA: p1SrcId ? { matchId: p1SrcId, type: isLowerFeederWinner ? 'WINNER' : 'LOSER' } : undefined,
      slotB: { matchId: p2SrcId, type: 'LOSER' },
      winnerId: null,
      loserId: null,
      bestOf: getBestOf('2C', scRoundNumber),
      isBye: false,
    };

    if (feederLower) {
      if (isLowerFeederWinner) {
        feederLower.nextMatchId = id;
        feederLower.nextMatchSlot = 1;
      } else {
        feederLower.loserNextMatchId = id;
        feederLower.loserNextMatchSlot = 1;
      }
    }

    arMatch.loserNextMatchId = id;
    arMatch.loserNextMatchSlot = 2;

    secondChanceMatches.push(match);
    matchesById[id] = match;
  }

  const secondChanceRound: BracketRound = {
    roundNumber: scRoundNumber,
    name: `Lower Bracket R${preMergeLowerRounds.length + 1}`,
    stage: 'LOSERS',
    phase: 'QUALIFIERS',
    roundIdentifier: '2C',
    matches: secondChanceMatches,
  };
  roundIndexCounter++;

  // ----------------------------------------------------
  // Component 4: Play-Offs (Round B)
  // Consists of M = finalsCutoff / 2 matches
  // Slot A: Fed by M Upper Pre-Merge qualifiers
  // Slot B: Fed by M 2nd Chance Round winners
  // Winners -> Slot B of Phase 2 (Top C Championship)
  // ----------------------------------------------------
  const playOffMatches: BracketMatch[] = [];
  const poRoundNumber = roundNumberCounter++;

  for (let m = 0; m < mAcc; m++) {
    const id = `${prefix}po-m${m + 1}`;
    const upperMatch = upperQualifierMatches.length > 0
      ? upperQualifierMatches[m % upperQualifierMatches.length]
      : undefined;
    const scMatch = secondChanceMatches[m];

    const p1SrcId = upperMatch?.id;
    const p2SrcId = scMatch.id;

    const match: BracketMatch = {
      id,
      tierId,
      stage: 'LOSERS',
      phase: 'QUALIFIERS',
      subTrack: 'RE_CLIMB',
      roundIdentifier: 'PO',
      roundNumber: poRoundNumber,
      roundIndex: roundIndexCounter,
      matchNumber: 0,
      player1: { player: null, sourceMatchId: p1SrcId },
      player2: { player: null, sourceMatchId: p2SrcId },
      slotA: p1SrcId ? { matchId: p1SrcId, type: 'WINNER' } : undefined,
      slotB: { matchId: p2SrcId, type: 'WINNER' },
      winnerId: null,
      loserId: null,
      bestOf: getBestOf('PO', poRoundNumber),
      isBye: false,
    };

    if (upperMatch) {
      upperMatch.nextMatchId = id;
      upperMatch.nextMatchSlot = 1;
    }

    scMatch.nextMatchId = id;
    scMatch.nextMatchSlot = 2;

    playOffMatches.push(match);
    matchesById[id] = match;
  }

  const playOffRound: BracketRound = {
    roundNumber: poRoundNumber,
    name: `Lower Bracket R${preMergeLowerRounds.length + 2}`,
    stage: 'LOSERS',
    phase: 'QUALIFIERS',
    roundIdentifier: 'PO',
    matches: playOffMatches,
  };
  roundIndexCounter++;

  // ----------------------------------------------------
  // Component 5: Phase 2: Top C Championship (Single Elimination)
  // Instantiate generateTraditionalBracket(C)
  // Round 1 (Round of C, e.g. Round of 16):
  // Slot A: Accelerated Round winners
  // Slot B: Play-Offs winners
  // Fully progresses through Quarterfinals -> Semifinals -> Finals
  // ----------------------------------------------------
  const dummyChampPlayers: SeededPlayer[] = Array.from({ length: finalsCutoff }, (_, i) => ({
    id: `champ-p${i + 1}`,
    name: `Qualifier ${i + 1}`,
    seed: i + 1,
  }));

  const champBracket = generateTraditionalBracket(dummyChampPlayers, {
    tierId: tierId ? `${tierId}-champ` : 'champ',
    bestOf,
    roundBestOfOverrides,
  });

  const champRounds: BracketRound[] = [];

  champBracket.rounds.forEach((r, rIdx) => {
    const roundNumber = roundNumberCounter++;
    const roundIdent = `CHAMP_R${rIdx + 1}`;
    r.roundNumber = roundNumber;
    r.stage = 'GRAND_FINALS';
    r.phase = 'CHAMPIONSHIP';
    r.roundIdentifier = roundIdent;
    r.name =
      rIdx === champBracket.rounds.length - 1
        ? 'Finals'
        : rIdx === champBracket.rounds.length - 2
        ? 'Semifinals'
        : rIdx === champBracket.rounds.length - 3
        ? 'Quarterfinals'
        : `Round of ${r.matches.length * 2}`;

    r.matches.forEach((m, mIdx) => {
      m.stage = 'GRAND_FINALS';
      m.phase = 'CHAMPIONSHIP';
      m.roundIdentifier = roundIdent;
      m.roundNumber = roundNumber;
      m.roundIndex = roundIndexCounter;

      if (rIdx === 0) {
        const arMatch = arMatches[mIdx % arMatches.length];
        const poMatch = playOffMatches[mIdx % playOffMatches.length];

        m.player1 = { player: null, sourceMatchId: arMatch.id };
        m.player2 = { player: null, sourceMatchId: poMatch.id };
        m.slotA = { matchId: arMatch.id, type: 'WINNER' };
        m.slotB = { matchId: poMatch.id, type: 'WINNER' };

        arMatch.nextMatchId = m.id;
        arMatch.nextMatchSlot = 1;

        poMatch.nextMatchId = m.id;
        poMatch.nextMatchSlot = 2;
      } else {
        m.player1 = { ...m.player1, player: null };
        m.player2 = { ...m.player2, player: null };
      }

      matchesById[m.id] = m;
    });

    roundIndexCounter++;
    champRounds.push(r);
  });

  // Assemble full tournament progression
  rounds.push(arRound);
  rounds.push(...preMergeUpperRounds);
  rounds.push(...preMergeLowerRounds);
  rounds.push(secondChanceRound);
  rounds.push(playOffRound);
  rounds.push(...champRounds);

  // Sequential match numbering across the entire bracket (1..totalMatches)
  let globalMatchNum = 1;
  for (const round of rounds) {
    for (const match of round.matches) {
      match.matchNumber = globalMatchNum++;
    }
  }

  return {
    tierId,
    type: 'TRADITIONAL',
    eliminationType: 'DOUBLE',
    bracketRouting: 'ACCELERATED_HYBRID',
    finalsCutoff,
    totalPlayers,
    totalRounds: rounds.length,
    rounds,
    matchesById,
  };
}

/**
 * Why a double-elimination tier can't be generated for this player count, or null if it can.
 * Mirrors the throws in generateFlatDoubleElim and generateAcceleratedHybrid so callers can block
 * the configuration instead of crashing.
 */
export function getDoubleEliminationConfigError(
  playerCount: number,
  options: Pick<GenerateBracketOptions, 'bracketRouting' | 'flatWidth' | 'finalsCutoff'>
): string | null {
  if (playerCount < 2) return 'Double elimination needs at least 2 players.';

  if (options.bracketRouting === 'FLAT_STAGED') {
    const flatWidth = options.flatWidth || 4;
    // Fields of at most 2x the width fall back to a traditional tree (see generateFlatDoubleElim).
    if (flatWidth >= 4 && playerCount > 2 * flatWidth && playerCount % flatWidth !== 0) {
      const lower = Math.floor(playerCount / flatWidth) * flatWidth;
      return `Flat staged ${flatWidth} wide needs a multiple of ${flatWidth} players (e.g. ${lower} or ${lower + flatWidth}), not ${playerCount}.`;
    }
  } else if (options.bracketRouting === 'ACCELERATED_HYBRID') {
    const finalsCutoff = options.finalsCutoff || 16;
    // Players outside the cutoff play a pre-bracket, so there must be none of them or at least 2.
    if (playerCount < finalsCutoff || playerCount === finalsCutoff + 1) {
      return `Accelerated hybrid with a Top ${finalsCutoff} cutoff needs exactly ${finalsCutoff} or at least ${finalsCutoff + 2} players, not ${playerCount}.`;
    }
  }
  return null;
}

/**
 * Universal dispatcher for Double Elimination brackets.
 * Routes to:
 * - 'TRADITIONAL_TREE' (default): Traditional binary-tree double elimination
 * - 'FLAT_STAGED': AIE / CTWC DAS flat double elimination with fixed rails
 * - 'ACCELERATED_HYBRID': CTWC 2026 accelerated hybrid qualification + finals
 */
export function generateDoubleEliminationBracket(
  players: SeededPlayer[],
  options: GenerateBracketOptions = {}
): BracketStructure {
  if (players.length < 2) {
    throw new Error(`Double elimination bracket requires at least 2 players, received ${players.length}`);
  }

  const routing: BracketRouting = options.bracketRouting || 'TRADITIONAL_TREE';

  switch (routing) {
    case 'FLAT_STAGED': {
      const flatWidth = options.flatWidth || 4;
      return generateFlatDoubleElim({ players, flatWidth, options });
    }
    case 'ACCELERATED_HYBRID': {
      const finalsCutoff = options.finalsCutoff || 16;
      return generateAcceleratedHybrid({ players, finalsCutoff, options });
    }
    case 'TRADITIONAL_TREE':
    default:
      return generateTraditionalDoubleElim({ players, options });
  }
}
