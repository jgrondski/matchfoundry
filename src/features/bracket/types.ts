export type BracketType = 'TRADITIONAL' | 'FLAT';
export type EliminationType = 'SINGLE' | 'DOUBLE';
export type BracketRouting = 'TRADITIONAL_TREE' | 'TRADITIONAL' | 'FLAT_STAGED' | 'ACCELERATED_HYBRID';
export type BracketStage = 'WINNERS' | 'LOSERS' | 'GRAND_FINALS' | 'GRAND_FINALS_RESET';

export interface SeededPlayer {
  id: string;
  name: string;
  seed: number; // 1-indexed seed number
  country?: string;
  playstyle?: string;
  displayName?: string;
  nickname?: string;
}

export interface MatchParticipant {
  player: SeededPlayer | null;
  sourceMatchId?: string;
  isBye?: boolean;
  isManualOverride?: boolean;
  originalSourceMatchId?: string;
}

export interface MatchSlotSwapPayload {
  sourceMatchId: string;
  sourceSlot: 1 | 2;
  targetMatchId: string;
  targetSlot: 1 | 2;
}

export interface MatchSlotFeeder {
  matchId?: string;
  type: 'WINNER' | 'LOSER' | 'DIRECT';
}

export type BracketPhase = 'QUALIFIERS' | 'CHAMPIONSHIP';
export type BracketSubTrack = 'ACCELERATED' | 'PRE_MERGE_UPPER' | 'PRE_MERGE_LOWER' | 'RE_CLIMB';

export interface BracketMatch {
  id: string;
  tierId?: string;
  stage?: BracketStage;
  phase?: BracketPhase;
  subTrack?: BracketSubTrack;
  roundIdentifier?: string; // e.g. 'W1', 'W2', 'L1', 'L2', 'GF', 'GF_RESET'
  roundNumber: number; // 1-indexed (1, 2, ..., totalRounds)
  roundIndex?: number; // 0-indexed DAG round index
  matchNumber: number; // Sequential match number across bracket
  player1: MatchParticipant;
  player2: MatchParticipant;
  slotA?: MatchSlotFeeder;
  slotB?: MatchSlotFeeder;
  winnerId: string | null;
  loserId: string | null;
  nextMatchId?: string;
  nextMatchSlot?: 1 | 2;
  loserNextMatchId?: string;
  loserNextMatchSlot?: 1 | 2;
  bestOf: number;
  isBye: boolean;
}

export interface BracketRound {
  roundNumber: number;
  name: string;
  stage?: BracketStage;
  phase?: BracketPhase;
  roundIdentifier?: string;
  matches: BracketMatch[];
}

export interface BracketStructure {
  tierId?: string;
  type: BracketType;
  eliminationType?: EliminationType;
  bracketRouting?: BracketRouting;
  totalPlayers: number;
  totalRounds: number;
  flatWidth?: number;
  finalsCutoff?: number;
  rounds: BracketRound[];
  matchesById: Record<string, BracketMatch>;
  grandFinalsResetMatchId?: string;
}

export interface GenerateBracketOptions {
  tierId?: string;
  bestOf?: number;
  eliminationType?: EliminationType;
  bracketRouting?: BracketRouting;
  flatWidth?: number;
  finalsCutoff?: number;
  roundBestOfOverrides?: Record<string | number, number>;
}

export const isMatchPlayable = (match: BracketMatch): boolean => {
  return match.player1.player !== null && match.player2.player !== null && !match.isBye;
};

/**
 * Maps any legacy, draft, or variant round names/identifiers to their canonical names.
 * Ensures a single source of truth across brackets, standings, floor judge, and master sheet.
 */
export function getCanonicalRoundName(name: string, roundIdentifier?: string): string {
  const ident = roundIdentifier?.toUpperCase();
  const trimmed = name?.trim() || '';
  const lower = trimmed.toLowerCase();

  // 1. Accelerated Round
  if (ident === 'AR' || lower === 'accelerated round' || lower === 'accel round' || lower === 'accel') {
    return 'Accelerated Round';
  }

  // 2. Upper Bracket R1
  if (
    ident === 'PRE_W1' ||
    lower === 'pre-merge upper r1' ||
    lower === 'pre-merge upper round 1' ||
    lower === 'upper bracket rd 1' ||
    lower === 'upper bracket round 1' ||
    lower === 'upper bracket r1'
  ) {
    return 'Upper Bracket R1';
  }

  // 3. Upper Bracket R2
  if (
    ident === 'PRE_W2' ||
    lower === 'pre-merge upper r2' ||
    lower === 'pre-merge upper round 2' ||
    lower === 'upper bracket rd 2' ||
    lower === 'upper bracket round 2' ||
    lower === 'upper bracket r2'
  ) {
    return 'Upper Bracket R2';
  }

  // 4. Lower Bracket R1
  if (
    ident === 'PRE_L1' ||
    lower === 'pre-merge lower r1' ||
    lower === 'pre-merge lower round 1' ||
    lower === 'lower bracket rd 1' ||
    lower === 'lower bracket round 1' ||
    lower === 'lower bracket r1'
  ) {
    return 'Lower Bracket R1';
  }

  // 5. Lower Bracket R2
  if (
    ident === 'PRE_L2' ||
    lower === 'pre-merge lower r2' ||
    lower === 'pre-merge lower round 2' ||
    lower === 'lower bracket rd 2' ||
    lower === 'lower bracket round 2' ||
    lower === 'lower bracket r2'
  ) {
    return 'Lower Bracket R2';
  }

  // 6. Lower Bracket R3 (2nd Chance)
  if (
    ident === '2C' ||
    lower === '2nd chance' ||
    lower === '2nd chance round' ||
    lower === 'second chance' ||
    lower === 'second chance round' ||
    lower === 'lower bracket rd 3' ||
    lower === 'lower bracket round 3' ||
    lower === 'lower bracket r3'
  ) {
    return 'Lower Bracket R3';
  }

  // 7. Lower Bracket R4 (Play-Offs)
  if (
    ident === 'PO' ||
    lower === 'play-offs' ||
    lower === 'playoffs' ||
    lower === 'play-off' ||
    lower === 'playoff' ||
    lower === 'lower bracket rd 4' ||
    lower === 'lower bracket round 4' ||
    lower === 'lower bracket r4'
  ) {
    return 'Lower Bracket R4';
  }

  // 8. Championship Finals / Finals
  if (
    ident === 'CHAMP_R4' ||
    lower === 'championship finals' ||
    lower === 'championship final'
  ) {
    return 'Finals';
  }

  // 9. Double Elimination Grand Finals Reset
  if (ident === 'GFR' || ident === 'GF_RESET' || lower === 'grand finals reset') {
    return 'Grand Finals Reset';
  }

  return trimmed || name;
}

/**
 * Normalizes all rounds in-place to ensure canonical naming across the entire tournament.
 */
export function canonicalizeBracketRounds(rounds: BracketRound[]): void {
  for (let i = 0; i < rounds.length; i++) {
    const round = rounds[i];
    round.name = getCanonicalRoundName(round.name, round.roundIdentifier);
    if (round.roundNumber !== i + 1) {
      round.roundNumber = i + 1;
      for (const m of round.matches) {
        m.roundNumber = i + 1;
        m.roundIndex = i;
      }
    }
    if (
      round.roundIdentifier === 'PO' ||
      round.name === 'Lower Bracket R4' ||
      round.roundIdentifier === '2C' ||
      round.name === 'Lower Bracket R3' ||
      round.roundIdentifier?.startsWith('PRE_L') ||
      round.name.startsWith('Lower Bracket')
    ) {
      round.stage = 'LOSERS';
      for (const m of round.matches) {
        m.stage = 'LOSERS';
      }
    }
  }
}

