import { BracketStructure, BracketType, EliminationType, BracketStage, BracketRouting } from '../bracket/types';
import { TierThemeColors } from '../bracket/colorUtils';

export type { EliminationType, BracketStage, BracketRouting, TierThemeColors };

export type QualFormat = 'HIGH_SCORE' | 'AVERAGE_OF_X' | 'POINTS';
export type QualMode = 'IN_PERSON' | 'ONLINE' | 'HYBRID';
export type SubmissionSource = 'IN_PERSON' | 'ONLINE';
export type IdentityStatus = 'VERIFIED_MATCH' | 'CLAIMED_PENDING_REVIEW' | 'PROVISIONAL_NEW';
export type SubmissionStatus =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'SUBMITTED'
  | 'VERIFIED'
  | 'DNQ'
  | 'DQ';

export interface QualTimerPause {
  pausedAt: number;
  resumedAt?: number;
}

export interface QualTimerLog {
  startedAt: number;
  submittedAt?: number;
  elapsedSeconds: number;
  pauses: QualTimerPause[];
  overTime?: boolean;
}

/** Autosaved, not-yet-submitted contents of an online run. Never included in the public tournament payload. */
export interface QualRunDraft {
  scores: number[];
  twitchVodUrl?: string;
  playerNotes?: string;
}

export interface TournamentQualTimer {
  durationMinutes: number;
  elapsedSeconds: number;
  isRunning: boolean;
  lastResumedAt: number | null;
  startedAt?: number | null;
}

export interface PointsThreshold {
  minScore: number;
  points: number;
}

export const DEFAULT_POINTS_THRESHOLDS: PointsThreshold[] = [
  { minScore: 999999, points: 2 },
  { minScore: 1099999, points: 3 },
  { minScore: 1199999, points: 4 },
  { minScore: 1299999, points: 5 },
  { minScore: 1399999, points: 6 },
  { minScore: 1499999, points: 7 },
  { minScore: 1599999, points: 8 },
  { minScore: 1699999, points: 9 },
  { minScore: 1799999, points: 10 },
  { minScore: 1899999, points: 11 },
  { minScore: 1999999, points: 13 },
];

export interface OrgTierTheme {
  id: string;
  name: string;
  themeColors: TierThemeColors;
  textSize?: 'compact' | 'normal' | 'large';
}

export interface OrganizationBranding {
  logoUrl?: string;
  bannerUrl?: string;
  themeColors?: TierThemeColors;
  brandColor?: string;
}

export interface OrganizationDefaultRules {
  qualFormat?: QualFormat;
  qualAverageCount?: number;
  qualWindowMinutes?: number;
  bestOf?: number;
  primaryColor?: string;
  secondaryColor?: string;
  pointsConfig?: PointsThreshold[];
}

export interface TournamentMetadata {
  date?: string;
  location?: string;
  organizationId?: string;
  useOrgBranding?: boolean;
  logoUrl?: string;
  bannerUrl?: string;
  discordWebhookUrl?: string;
  themeColors?: TierThemeColors;
  seedingMethod?: SeedingMethod;
  manualSeeds?: string[];
  qualMode?: QualMode;
  qualWindowMinutes?: number;
  qualTimer?: TournamentQualTimer;
  customAuthWords?: string[];
  [key: string]: unknown;
}

export interface TierMetadata {
  cardColor?: string;
  textColor?: string;
  backgroundColor?: string;
  lowerBracketColor?: string;
  textSize?: 'compact' | 'normal' | 'large' | 'small' | 'medium' | 'xlarge' | number;
  eliminationType?: EliminationType;
  bracketRouting?: BracketRouting;
  finalsCutoff?: number;
  bestOf?: number;
  isLocked?: boolean;
  roundBestOfOverrides?: Record<string | number, number>;
  bracket?: BracketStructure;
  [key: string]: unknown;
}

export interface MatchMetadata {
  [key: string]: unknown;
}

export interface Organization {
  id: string;
  slug: string; // unique URL slug, e.g. 'ctwc', 'ctm'
  name: string; // e.g. 'Classic Tetris World Championship'
  shortName?: string; // e.g. 'CTWC', 'CTM'
  description?: string;
  logoUrl?: string;
  bannerUrl?: string;
  website?: string;
  brandColor?: string; // primary accent color
  themeColors?: TierThemeColors; // 5-color bracket theme palette
  tierThemes?: OrgTierTheme[]; // multi-tier default themes (primary, secondary, etc.)
  branding?: OrganizationBranding;
  discordWebhookUrl?: string; // inherited by tournaments if not overridden
  hasDiscordWebhook?: boolean; // set on public reads, where the URL itself is withheld from non-system-admins
  defaultRules?: OrganizationDefaultRules;
  createdAt: number;
}

export interface GameScoreEntry {
  gameNumber: number; // 1, 2, 3, 4, 5...
  player1Points: number | null;
  player2Points: number | null;
  winnerPlayerId: string | null;
}

export interface MatchScoreRecord {
  matchId: string;
  tierId: string;
  organizationId?: string;
  bestOf: number;
  player1Wins: number;
  player2Wins: number;
  games: GameScoreEntry[];
  winnerPlayerId: string | null;
  loserPlayerId: string | null;
  isComplete: boolean;
  notes?: string;
  forfeitWinnerId?: string;
  hasTiebreaker?: boolean;
}

export interface TournamentTier {
  id: string; // e.g. 'gold', 'silver', 'bronze'
  slug: string; // url slug e.g. 'gold'
  name: string; // e.g. 'Gold Bracket'
  priority: number; // 1 for highest/default tier
  bracketType: BracketType;
  eliminationType?: EliminationType; // 'SINGLE' | 'DOUBLE' (default 'SINGLE')
  bracketRouting?: BracketRouting;
  flatWidth?: number;
  finalsCutoff?: number;
  bestOf: number;
  playerCount: number;
  primaryColor?: string;
  secondaryColor?: string;
  cardColor?: string; // Background for match cards / player names
  textColor?: string; // Standard text and neutral elements color
  backgroundColor?: string; // Overall background for the entire bracket canvas
  lowerBracketColor?: string; // Left/right border highlights for lower bracket matches and headers in double elim
  textSize?: 'compact' | 'normal' | 'large' | 'small' | 'medium' | 'xlarge' | number; // Bracket text size scaling
  bracket: BracketStructure;
  isLocked: boolean;
  roundBestOfOverrides?: Record<string | number, number>; // Key: roundNumber (1, 2, ...) or stage ('W1', 'L1', 'GF', 'GF_RESET'), Value: bestOf (1..99)
}

export type QualRunStatus = 'IN_PROGRESS' | 'SUBMITTED' | 'VERIFIED' | 'DNQ' | 'DQ';

/** One competitor's qual in a tournament. Scores are the qualifierSubmissions with this runId. */
export interface QualRun {
  id: string;
  tournamentId: string;
  playerId: string;
  submissionSource: SubmissionSource;
  status: QualRunStatus;
  authWord?: string;
  twitchVodUrl?: string;
  submittedTwitchId?: string;
  submittedTwitchUsername?: string;
  identityStatus?: IdentityStatus;
  timerLog?: QualTimerLog;
  judgeNotes?: string;
  playerNotes?: string;
  verifiedBy?: string;
  verifiedAt?: number;
  submittedAt?: number;
  createdAt: number;
}

export interface QualifierSubmission {
  id: string;
  tournamentId: string;
  organizationId?: string;
  playerId: string;
  runId?: string;
  score: number;
  submittedAt: number; // timestamp in ms
  submissionSource?: SubmissionSource;
  authWord?: string;
  twitchVodUrl?: string;
  submittedTwitchId?: string;
  submittedTwitchUsername?: string;
  identityStatus?: IdentityStatus;
  status?: SubmissionStatus;
  timerLog?: QualTimerLog;
  judgeNotes?: string;
  playerNotes?: string;
  verifiedBy?: string;
  verifiedAt?: number;
}

export type QualifierStatus =
  | 'not started'
  | 'in progress'
  | 'verified'
  | 'awaiting verification'
  | 'dnq'
  | 'dq';

export interface TournamentPlayer {
  playerId: string;
  tournamentId: string;
  organizationId?: string;
  tierId?: string;
  seed?: number;
  qualsCompleted?: boolean;
  isVerified?: boolean;
}

export type Playstyle = 'DAS' | 'Rolling' | 'Hypertap' | 'Hybrid' | 'Roll' | 'Tap';

export interface QualifierScore {
  id: string;
  playerId: string;
  playerName: string;
  seed?: number;
  game1: number;
  game2: number;
  game3?: number;
  totalScore: number;
  verified: boolean;
  assignedTierId?: string;
  playstyle?: Playstyle;
  personalBest?: number;
}

export type AvatarType = 'flag' | 'custom';

export interface PlayerProfile {
  id: string;
  name: string;
  displayName?: string;
  nickname?: string;
  twitchUsername?: string;
  twitchId?: string;
  country?: string;
  avatarType?: AvatarType;
  avatarUrl?: string;
  avatarThumbnailUrl?: string;
  personalBest: number;
  playstyle: Playstyle;
  notes?: string;
  isDisqualified?: boolean;
}


export type SeedingMethod = 'QUALIFIERS' | 'MANUAL';

export interface Tournament {
  id: string;
  organizationId?: string; // parent Organization ID if associated
  slug: string; // e.g. 'kc-2026-open'
  name: string; // e.g. 'KC Regional 2026 Open'
  date: string;
  location: string;
  seedingMethod?: SeedingMethod; // default 'QUALIFIERS'
  manualSeeds?: string[]; // ordered array of playerIds: index 0 = Seed 1, index 1 = Seed 2, etc.
  qualFormat: QualFormat;
  qualAverageCount?: number; // target count X for AVERAGE_OF_X
  pointsConfig?: PointsThreshold[]; // array of { minScore, points } for POINTS
  qualMode?: QualMode; // default 'HYBRID'
  qualWindowMinutes?: number; // default 90
  qualTimer?: TournamentQualTimer;
  customAuthWords?: string[]; // custom organizer dictionary words
  qualsClosed?: boolean; // true = Qualifiers closed
  onlineQualsOpen?: boolean; // true = organizer has opened online qualifying (ONLINE/HYBRID only)
  isLocked: boolean; // false = Qualifiers Mode (Draft Preview), true = Match Play Mode (Locked)
  tiers: TournamentTier[];
  matchScores: Record<string, MatchScoreRecord>; // keyed by matchId
  playersPool: PlayerProfile[];
  qualifierSubmissions: QualifierSubmission[];
  qualRuns?: QualRun[];
  tournamentPlayers: Record<string, TournamentPlayer>; // keyed by playerId
  qualifiers?: QualifierScore[]; // legacy fallback
  useOrgBranding?: boolean; // default true: inherits 5 colors, logo, banner from org
  logoUrl?: string; // tournament-specific logo override
  bannerUrl?: string; // tournament-specific banner override
  discordWebhookUrl?: string; // tournament-specific discord webhook override
  themeColors?: TierThemeColors; // tournament-level 5-color palette override
  adminPinEncrypted?: string; // AES-256-GCM encrypted tournament PIN
  adminPin?: string; // transient/decrypted when viewed by authorized System Admin
}

