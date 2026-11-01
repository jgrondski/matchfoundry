import { SeededPlayer } from '../bracket/types';
import { generateTraditionalBracket, generateFlatBracket, advanceMatchWinner } from '../bracket/math';
import { Tournament, QualifierScore, MatchScoreRecord, PlayerProfile, QualifierSubmission } from './types';
import { DEFAULT_TIER_THEME, TIER_THEMES } from '../../theme/palette';

export const MOCK_PLAYERS_POOL: PlayerProfile[] = [
  { id: 'p1', name: 'Blue Scuti', personalBest: 1674967, playstyle: 'Rolling', country: 'US' },
  { id: 'p2', name: 'TetrisTime', personalBest: 1418281, playstyle: 'Rolling', country: 'US' },
  { id: 'p3', name: 'Winter', personalBest: 1418281, playstyle: 'Rolling', country: 'US' },
  { id: 'p4', name: 'DMJ', personalBest: 1293050, playstyle: 'Rolling', country: 'US' },
  { id: 'p5', name: 'JoshuaTolles', personalBest: 1170620, playstyle: 'Rolling', country: 'US' },
  { id: 'p6', name: 'LapisLazuli', personalBest: 1175180, playstyle: 'Rolling', country: 'US' },
  { id: 'p7', name: 'Chance', personalBest: 1036640, playstyle: 'Rolling', country: 'US' },
  { id: 'p8', name: 'James', personalBest: 1102020, playstyle: 'Rolling', country: 'US' },
  { id: 'p9', name: 'Matt Martin', personalBest: 1076621, playstyle: 'Rolling', country: 'US' },
  { id: 'p10', name: 'Jonesy', personalBest: 1035920, playstyle: 'Rolling', country: 'US' },
  { id: 'p11', name: 'Izo', personalBest: 1170240, playstyle: 'Rolling', country: 'US' },
  { id: 'p12', name: 'JediEvan', personalBest: 1195417, playstyle: 'Rolling', country: 'US' },
  { id: 'p13', name: 'PixelAndy', personalBest: 1520000, playstyle: 'Rolling', country: 'US' },
  { id: 'p14', name: 'DogPlayingTetris', personalBest: 1550000, playstyle: 'Rolling', country: 'US' },
  { id: 'p15', name: 'Fractal', personalBest: 1480000, playstyle: 'Rolling', country: 'US' },
  { id: 'p16', name: 'Huff', personalBest: 1240000, playstyle: 'DAS', country: 'US' },
  { id: 'p17', name: 'EricICX', personalBest: 1380000, playstyle: 'Rolling', country: 'US' },
  { id: 'p18', name: 'Alex T', personalBest: 1320000, playstyle: 'Rolling', country: 'US' },
  { id: 'p19', name: 'Cheez', personalBest: 1400000, playstyle: 'Rolling', country: 'US' },
  { id: 'p20', name: 'Tristop', personalBest: 1300000, playstyle: 'Rolling', country: 'US' },
  { id: 'p21', name: 'Marfang', personalBest: 1150000, playstyle: 'Rolling', country: 'US' },
  { id: 'p22', name: 'Mitch', personalBest: 1180000, playstyle: 'Rolling', country: 'US' },
  { id: 'p23', name: 'Ben Mullen', personalBest: 1190000, playstyle: 'Rolling', country: 'US' },
  { id: 'p24', name: 'Sodium', personalBest: 1210000, playstyle: 'Rolling', country: 'US' },
  { id: 'p25', name: 'Koryan', personalBest: 1140000, playstyle: 'DAS', country: 'JP' },
  { id: 'p26', name: 'Svavar', personalBest: 1120000, playstyle: 'DAS', country: 'IS' },
  { id: 'p27', name: 'Bo Steil', personalBest: 1160000, playstyle: 'DAS', country: 'US' },
  { id: 'p28', name: 'RedScuti', personalBest: 1250000, playstyle: 'Rolling', country: 'US' },
  { id: 'p29', name: 'Sharky', personalBest: 1110000, playstyle: 'Rolling', country: 'US' },
  { id: 'p30', name: 'Greentea', personalBest: 1220000, playstyle: 'DAS', country: 'JP' },
  { id: 'p31', name: 'DanV', personalBest: 1100000, playstyle: 'DAS', country: 'US' },
  { id: 'p32', name: 'Harry Hong', personalBest: 1150000, playstyle: 'DAS', country: 'US' },
];

export function buildMockQualifiers(): QualifierScore[] {
  return [
    { id: 'q1', playerId: 'p1', playerName: 'Blue Scuti', game1: 1280000, game2: 1249200, game3: 1190000, totalScore: 2529200, verified: true, seed: 1, assignedTierId: 'gold' },
    { id: 'q2', playerId: 'p2', playerName: 'TetrisTime', game1: 1205360, game2: 1144660, game3: 1100000, totalScore: 2350020, verified: true, seed: 2, assignedTierId: 'gold' },
    { id: 'q3', playerId: 'p3', playerName: 'Winter', game1: 1418281, game2: 966142, game3: 880000, totalScore: 2384423, verified: true, seed: 3, assignedTierId: 'gold' },
    { id: 'q4', playerId: 'p4', playerName: 'DMJ', game1: 1193050, game2: 1106940, game3: 990000, totalScore: 2299990, verified: true, seed: 4, assignedTierId: 'gold' },
    { id: 'q5', playerId: 'p5', playerName: 'JoshuaTolles', game1: 1170620, game2: 1050000, totalScore: 2220620, verified: true, seed: 5, assignedTierId: 'gold' },
    { id: 'q6', playerId: 'p6', playerName: 'LapisLazuli', game1: 1175180, game2: 1040000, totalScore: 2215180, verified: true, seed: 6, assignedTierId: 'gold' },
    { id: 'q7', playerId: 'p7', playerName: 'Chance', game1: 1036640, game2: 1012720, totalScore: 2049360, verified: true, seed: 7, assignedTierId: 'gold' },
    { id: 'q8', playerId: 'p8', playerName: 'James', game1: 1102020, game2: 940000, totalScore: 2042020, verified: true, seed: 8, assignedTierId: 'gold' },
    { id: 'q9', playerId: 'p9', playerName: 'Matt Martin', game1: 1076621, game2: 920000, totalScore: 1996621, verified: true, seed: 9, assignedTierId: 'gold' },
    { id: 'q10', playerId: 'p10', playerName: 'Jonesy', game1: 1035920, game2: 935920, totalScore: 1971840, verified: true, seed: 10, assignedTierId: 'gold' },
    { id: 'q11', playerId: 'p11', playerName: 'Izo', game1: 1170240, game2: 780000, totalScore: 1950240, verified: true, seed: 11, assignedTierId: 'gold' },
    { id: 'q12', playerId: 'p12', playerName: 'JediEvan', game1: 1195417, game2: 750000, totalScore: 1945417, verified: true, seed: 12, assignedTierId: 'gold' },
    { id: 'q13', playerId: 'p13', playerName: 'PixelAndy', game1: 990000, game2: 950000, totalScore: 1940000, verified: true, seed: 1, assignedTierId: 'silver' },
    { id: 'q14', playerId: 'p14', playerName: 'DogPlayingTetris', game1: 980000, game2: 940000, totalScore: 1920000, verified: true, seed: 2, assignedTierId: 'silver' },
    { id: 'q15', playerId: 'p15', playerName: 'Fractal', game1: 960000, game2: 940000, totalScore: 1900000, verified: true, seed: 3, assignedTierId: 'silver' },
    { id: 'q16', playerId: 'p16', playerName: 'Huff', game1: 950000, game2: 930000, totalScore: 1880000, verified: true, seed: 4, assignedTierId: 'silver' },
    { id: 'q17', playerId: 'p17', playerName: 'EricICX', game1: 940000, game2: 920000, totalScore: 1860000, verified: true, seed: 5, assignedTierId: 'silver' },
    { id: 'q18', playerId: 'p18', playerName: 'Alex T', game1: 930000, game2: 910000, totalScore: 1840000, verified: true, seed: 6, assignedTierId: 'silver' },
    { id: 'q19', playerId: 'p19', playerName: 'Cheez', game1: 920000, game2: 900000, totalScore: 1820000, verified: true, seed: 7, assignedTierId: 'silver' },
    { id: 'q20', playerId: 'p20', playerName: 'Tristop', game1: 910000, game2: 890000, totalScore: 1800000, verified: true, seed: 8, assignedTierId: 'silver' },
    { id: 'q21', playerId: 'p21', playerName: 'Marfang', game1: 900000, game2: 880000, totalScore: 1780000, verified: true, seed: 9, assignedTierId: 'silver' },
    { id: 'q22', playerId: 'p22', playerName: 'Mitch', game1: 890000, game2: 870000, totalScore: 1760000, verified: true, seed: 10, assignedTierId: 'silver' },
    { id: 'q23', playerId: 'p23', playerName: 'Ben Mullen', game1: 880000, game2: 860000, totalScore: 1740000, verified: true, seed: 11, assignedTierId: 'silver' },
    { id: 'q24', playerId: 'p24', playerName: 'Sodium', game1: 870000, game2: 850000, totalScore: 1720000, verified: true, seed: 12, assignedTierId: 'silver' },
    { id: 'q25', playerId: 'p25', playerName: 'Koryan', game1: 860000, game2: 840000, totalScore: 1700000, verified: true, seed: 13, assignedTierId: 'silver' },
    { id: 'q26', playerId: 'p26', playerName: 'Svavar', game1: 850000, game2: 830000, totalScore: 1680000, verified: true, seed: 14, assignedTierId: 'silver' },
    { id: 'q27', playerId: 'p27', playerName: 'Bo Steil', game1: 840000, game2: 820000, totalScore: 1660000, verified: true, seed: 15, assignedTierId: 'silver' },
    { id: 'q28', playerId: 'p28', playerName: 'RedScuti', game1: 830000, game2: 810000, totalScore: 1640000, verified: true, seed: 16, assignedTierId: 'silver' },
  ];
}

export function buildMockSubmissions(tournamentId: string, organizationId: string = 'org_ctwc'): QualifierSubmission[] {
  const qualifiers = buildMockQualifiers();
  const submissions: QualifierSubmission[] = [];
  const baseTime = Date.now() - 1000 * 60 * 60 * 24; // 24h ago

  qualifiers.forEach((q, idx) => {
    submissions.push({
      id: `sub_${tournamentId}_${q.playerId}_1`,
      tournamentId,
      organizationId,
      playerId: q.playerId,
      score: q.game1,
      submittedAt: baseTime + idx * 1000 * 60 + 1000,
    });
    submissions.push({
      id: `sub_${tournamentId}_${q.playerId}_2`,
      tournamentId,
      organizationId,
      playerId: q.playerId,
      score: q.game2,
      submittedAt: baseTime + idx * 1000 * 60 + 2000,
    });
    if (q.game3) {
      submissions.push({
        id: `sub_${tournamentId}_${q.playerId}_3`,
        tournamentId,
        organizationId,
        playerId: q.playerId,
        score: q.game3,
        submittedAt: baseTime + idx * 1000 * 60 + 3000,
      });
    }
  });

  return submissions;
}

export function createInitialTournaments(): Tournament[] {
  // 12 players for Gold Tier (exact KC Open dataset)
  const goldPlayers: SeededPlayer[] = [
    { id: 'p1', name: 'Blue Scuti', seed: 1 },
    { id: 'p2', name: 'TetrisTime', seed: 2 },
    { id: 'p3', name: 'Winter', seed: 3 },
    { id: 'p4', name: 'DMJ', seed: 4 },
    { id: 'p5', name: 'JoshuaTolles', seed: 5 },
    { id: 'p6', name: 'LapisLazuli', seed: 6 },
    { id: 'p7', name: 'Chance', seed: 7 },
    { id: 'p8', name: 'James', seed: 8 },
    { id: 'p9', name: 'Matt Martin', seed: 9 },
    { id: 'p10', name: 'Jonesy', seed: 10 },
    { id: 'p11', name: 'Izo', seed: 11 },
    { id: 'p12', name: 'JediEvan', seed: 12 },
  ];

  let goldBracket = generateTraditionalBracket(goldPlayers, { tierId: 'gold', bestOf: 5 });

  // 16 players for Silver Tier (Flat bracket width 4)
  const silverPlayers: SeededPlayer[] = [
    { id: 'p13', name: 'PixelAndy', seed: 1 },
    { id: 'p14', name: 'DogPlayingTetris', seed: 2 },
    { id: 'p15', name: 'Fractal', seed: 3 },
    { id: 'p16', name: 'Huff', seed: 4 },
    { id: 'p17', name: 'EricICX', seed: 5 },
    { id: 'p18', name: 'Alex T', seed: 6 },
    { id: 'p19', name: 'Cheez', seed: 7 },
    { id: 'p20', name: 'Tristop', seed: 8 },
    { id: 'p21', name: 'Marfang', seed: 9 },
    { id: 'p22', name: 'Mitch', seed: 10 },
    { id: 'p23', name: 'Ben Mullen', seed: 11 },
    { id: 'p24', name: 'Sodium', seed: 12 },
    { id: 'p25', name: 'Koryan', seed: 13 },
    { id: 'p26', name: 'Svavar', seed: 14 },
    { id: 'p27', name: 'Bo Steil', seed: 15 },
    { id: 'p28', name: 'RedScuti', seed: 16 },
  ];
  const silverBracket = generateFlatBracket(silverPlayers, 4, { tierId: 'silver', bestOf: 5 });

  // Pre-seed KC Open match scores directly from the user's Google Sheet screenshots!
  const matchScores: Record<string, MatchScoreRecord> = {};

  // Find round 1 matches
  const r1Matches = goldBracket.rounds[0]?.matches || [];

  // Helper to advance match in bracket and record scores
  const recordMatch = (
    matchId: string,
    tierId: string,
    p1Wins: number,
    p2Wins: number,
    winnerId: string,
    loserId: string,
    games: Array<{ g: number; p1: number | null; p2: number | null; w: string | null }>
  ) => {
    matchScores[matchId] = {
      matchId,
      tierId,
      organizationId: 'org_ctwc',
      bestOf: 5,
      player1Wins: p1Wins,
      player2Wins: p2Wins,
      winnerPlayerId: winnerId,
      loserPlayerId: loserId,
      isComplete: true,
      games: games.map(g => ({
        gameNumber: g.g,
        player1Points: g.p1,
        player2Points: g.p2,
        winnerPlayerId: g.w,
      })),
    };
    try {
      goldBracket = advanceMatchWinner(goldBracket, matchId, winnerId);
    } catch {
      // ignore
    }
  };

  // Match 1: James (#8) vs Matt Martin (#9) -> James wins 3-0
  if (r1Matches[0]) {
    recordMatch(r1Matches[0].id, 'gold', 3, 0, 'p8', 'p9', [
      { g: 1, p1: 902020, p2: 876621, w: 'p8' },
      { g: 2, p1: 617184, p2: 425222, w: 'p8' },
      { g: 3, p1: 868620, p2: 856587, w: 'p8' },
    ]);
  }

  // Match 2: JoshuaTolles (#5) vs JediEvan (#12) -> JediEvan wins 3-2
  if (r1Matches[1]) {
    recordMatch(r1Matches[1].id, 'gold', 2, 3, 'p12', 'p5', [
      { g: 1, p1: 170620, p2: 195417, w: 'p12' },
      { g: 2, p1: 257672, p2: 279680, w: 'p12' },
      { g: 3, p1: 209380, p2: 72123, w: 'p5' },
      { g: 4, p1: 512128, p2: 513460, w: 'p12' },
    ]);
  }

  // Match 3: Chance (#7) vs Jonesy (#10) -> Chance wins 3-1
  if (r1Matches[2]) {
    recordMatch(r1Matches[2].id, 'gold', 3, 1, 'p7', 'p10', [
      { g: 1, p1: 836640, p2: 935920, w: 'p10' },
      { g: 2, p1: 439280, p2: 416860, w: 'p7' },
      { g: 3, p1: 532940, p2: 448800, w: 'p7' },
      { g: 4, p1: 517340, p2: 388080, w: 'p7' },
    ]);
  }

  // Match 4: LapisLazuli (#6) vs Izo (#11) -> LapisLazuli wins 3-2
  if (r1Matches[3]) {
    recordMatch(r1Matches[3].id, 'gold', 3, 2, 'p6', 'p11', [
      { g: 1, p1: 175180, p2: 170240, w: 'p6' },
      { g: 2, p1: 35340, p2: 8360, w: 'p6' },
      { g: 3, p1: 307040, p2: 391400, w: 'p11' },
      { g: 4, p1: 494820, p2: 619520, w: 'p11' },
      { g: 5, p1: 413860, p2: 353120, w: 'p6' },
    ]);
  }

  // Re-fetch QF matches after R1 advancements
  const updatedQF = goldBracket.rounds[1]?.matches || [];

  // QF 1: Blue Scuti (#1) vs James (#8) -> Blue Scuti wins 3-0
  if (updatedQF[0]) {
    recordMatch(updatedQF[0].id, 'gold', 3, 0, 'p1', 'p8', [
      { g: 1, p1: 902800, p2: 617184, w: 'p1' },
      { g: 2, p1: 902640, p2: 534720, w: 'p1' },
      { g: 3, p1: 876621, p2: 521140, w: 'p1' },
    ]);
  }

  // QF 2: DMJ (#4) vs JediEvan (#12) -> DMJ wins 3-1
  if (updatedQF[1]) {
    recordMatch(updatedQF[1].id, 'gold', 3, 1, 'p4', 'p12', [
      { g: 1, p1: 791124, p2: 471340, w: 'p4' },
      { g: 2, p1: 432914, p2: 434792, w: 'p12' },
      { g: 3, p1: 390000, p2: 194661, w: 'p4' },
      { g: 4, p1: 843915, p2: 563026, w: 'p4' },
    ]);
  }

  // QF 3: TetrisTime (#2) vs Chance (#7) -> TetrisTime wins 3-1
  if (updatedQF[2]) {
    recordMatch(updatedQF[2].id, 'gold', 3, 1, 'p2', 'p7', [
      { g: 1, p1: 754780, p2: 719000, w: 'p2' },
      { g: 2, p1: 177840, p2: 75620, w: 'p2' },
      { g: 3, p1: 905940, p2: 1012720, w: 'p7' },
      { g: 4, p1: 612940, p2: 568105, w: 'p2' },
    ]);
  }

  // QF 4: Winter (#3) vs LapisLazuli (#6) -> Winter wins 3-0
  if (updatedQF[3]) {
    recordMatch(updatedQF[3].id, 'gold', 3, 0, 'p3', 'p6', [
      { g: 1, p1: 632340, p2: 524340, w: 'p3' },
      { g: 2, p1: 216620, p2: 101000, w: 'p3' },
      { g: 3, p1: 1145680, p2: 419900, w: 'p3' },
    ]);
  }

  // Semifinals
  const sfMatches = goldBracket.rounds[2]?.matches || [];
  // SF 1: Blue Scuti vs DMJ -> Blue Scuti wins 3-0
  if (sfMatches[0]) {
    recordMatch(sfMatches[0].id, 'gold', 3, 0, 'p1', 'p4', [
      { g: 1, p1: 1674967, p2: 1293050, w: 'p1' },
      { g: 2, p1: 1445240, p2: 1106940, w: 'p1' },
      { g: 3, p1: 1314300, p2: 1156530, w: 'p1' },
    ]);
  }

  // SF 2: TetrisTime vs Winter -> TetrisTime wins 3-1
  if (sfMatches[1]) {
    recordMatch(sfMatches[1].id, 'gold', 3, 1, 'p2', 'p3', [
      { g: 1, p1: 1205360, p2: 1418281, w: 'p3' },
      { g: 2, p1: 1144660, p2: 1020341, w: 'p2' },
      { g: 3, p1: 1126620, p2: 966142, w: 'p2' },
      { g: 4, p1: 861840, p2: 733702, w: 'p2' },
    ]);
  }

  // Finals
  const finalsMatches = goldBracket.rounds[3]?.matches || [];
  // Finals: Blue Scuti vs TetrisTime -> Blue Scuti wins 3-0 Champion!
  if (finalsMatches[0]) {
    recordMatch(finalsMatches[0].id, 'gold', 3, 0, 'p1', 'p2', [
      { g: 1, p1: 83200, p2: 59660, w: 'p1' },
      { g: 2, p1: 1249200, p2: 1002700, w: 'p1' },
      { g: 3, p1: 651800, p2: 612450, w: 'p1' },
    ]);
  }

  const kc2026Open: Tournament = {
    id: 'kc-2026-open',
    organizationId: 'org_ctwc',
    slug: 'kc-2026-open',
    name: 'KC Regional 2026 Open',
    date: 'March 21-22, 2026',
    location: 'Kansas City, MO',
    qualFormat: 'AVERAGE_OF_X',
    qualAverageCount: 2,
    isLocked: true,
    playersPool: MOCK_PLAYERS_POOL,
    qualifierSubmissions: buildMockSubmissions('kc-2026-open'),
    tournamentPlayers: {},
    tiers: [
      {
        id: 'gold',
        slug: 'gold',
        name: 'Gold Bracket',
        priority: 1,
        bracketType: 'TRADITIONAL',
        playerCount: 12,
        bestOf: 5,
        primaryColor: DEFAULT_TIER_THEME.primaryColor,
        secondaryColor: DEFAULT_TIER_THEME.secondaryColor,
        cardColor: DEFAULT_TIER_THEME.cardColor,
        textColor: DEFAULT_TIER_THEME.textColor,
        backgroundColor: DEFAULT_TIER_THEME.backgroundColor,
        bracket: goldBracket,
        isLocked: true,
      },
      {
        id: 'silver',
        slug: 'silver',
        name: 'Silver Bracket',
        priority: 2,
        bracketType: 'FLAT',
        flatWidth: 4,
        playerCount: 16,
        bestOf: 5,
        primaryColor: TIER_THEMES.silver.primaryColor,
        secondaryColor: TIER_THEMES.silver.secondaryColor,
        cardColor: TIER_THEMES.silver.cardColor,
        textColor: TIER_THEMES.silver.textColor,
        backgroundColor: TIER_THEMES.silver.backgroundColor,
        bracket: silverBracket,
        isLocked: true,
      },
      {
        id: 'bronze',
        slug: 'bronze',
        name: 'Bronze Bracket',
        priority: 3,
        bracketType: 'TRADITIONAL',
        playerCount: 8,
        bestOf: 3,
        primaryColor: TIER_THEMES.bronze.primaryColor,
        secondaryColor: TIER_THEMES.bronze.secondaryColor,
        cardColor: TIER_THEMES.bronze.cardColor,
        textColor: TIER_THEMES.bronze.textColor,
        backgroundColor: TIER_THEMES.bronze.backgroundColor,
        bracket: generateTraditionalBracket(silverPlayers.slice(0, 8), { tierId: 'bronze', bestOf: 3 }),
        isLocked: false,
      }
    ],
    matchScores,
    qualifiers: buildMockQualifiers(),
  };

  const kc2026Das: Tournament = {
    id: 'kc-2026-das',
    organizationId: 'org_ctwc',
    slug: 'kc-2026-das',
    name: 'KC Regional 2026 DAS',
    date: 'March 20, 2026',
    location: 'Kansas City, MO',
    qualFormat: 'HIGH_SCORE',
    isLocked: false, // Qualifiers Mode (Draft preview)
    playersPool: MOCK_PLAYERS_POOL,
    qualifierSubmissions: buildMockSubmissions('kc-2026-das').slice(0, 24),
    tournamentPlayers: {},
    tiers: [
      {
        id: 'gold',
        slug: 'gold',
        name: 'Gold DAS Bracket',
        priority: 1,
        bracketType: 'TRADITIONAL',
        playerCount: 8,
        bestOf: 5,
        primaryColor: DEFAULT_TIER_THEME.primaryColor,
        secondaryColor: DEFAULT_TIER_THEME.secondaryColor,
        cardColor: DEFAULT_TIER_THEME.cardColor,
        textColor: DEFAULT_TIER_THEME.textColor,
        backgroundColor: DEFAULT_TIER_THEME.backgroundColor,
        bracket: generateTraditionalBracket(
          [
            { id: 'p16', name: 'Huff', seed: 1 },
            { id: 'p25', name: 'Koryan', seed: 2 },
            { id: 'p26', name: 'Svavar', seed: 3 },
            { id: 'p27', name: 'Bo Steil', seed: 4 },
            { id: 'p30', name: 'Greentea', seed: 5 },
            { id: 'p31', name: 'DanV', seed: 6 },
            { id: 'p32', name: 'Harry Hong', seed: 7 },
            { id: 'p23', name: 'Ben Mullen', seed: 8 },
          ],
          { tierId: 'gold', bestOf: 5 }
        ),
        isLocked: false,
      },
      {
        id: 'silver',
        slug: 'silver',
        name: 'Silver DAS Bracket',
        priority: 2,
        bracketType: 'FLAT',
        flatWidth: 2,
        playerCount: 8,
        bestOf: 3,
        primaryColor: TIER_THEMES.silver.primaryColor,
        secondaryColor: TIER_THEMES.silver.secondaryColor,
        cardColor: TIER_THEMES.silver.cardColor,
        textColor: TIER_THEMES.silver.textColor,
        backgroundColor: TIER_THEMES.silver.backgroundColor,
        bracket: generateFlatBracket(
          [
            { id: 'p1', name: 'Blue Scuti', seed: 1 },
            { id: 'p2', name: 'TetrisTime', seed: 2 },
            { id: 'p3', name: 'Winter', seed: 3 },
            { id: 'p4', name: 'DMJ', seed: 4 },
            { id: 'p5', name: 'JoshuaTolles', seed: 5 },
            { id: 'p6', name: 'LapisLazuli', seed: 6 },
            { id: 'p7', name: 'Chance', seed: 7 },
            { id: 'p8', name: 'James', seed: 8 },
          ],
          2,
          { tierId: 'silver', bestOf: 3 }
        ),
        isLocked: false,
      }
    ],
    matchScores: {},
    qualifiers: buildMockQualifiers().slice(0, 16),
  };

  return [kc2026Open, kc2026Das];
}
