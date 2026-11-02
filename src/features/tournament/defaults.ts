import {
  Tournament,
  TournamentTier,
  PlayerProfile,
  QualFormat,
  SeedingMethod,
  DEFAULT_POINTS_THRESHOLDS,
} from './types';
import { generateTraditionalBracket, generateFlatBracket } from '../bracket/math';
import { AUTHENTIC_COMPETITOR_NAMES } from './data/authenticPlayers';
import { BLUE_TIER_THEME, DEFAULT_TIER_THEME, TIER_THEMES } from '../../theme/palette';

/**
 * Generates an RFC4122 v4 compliant UUID string cross-platform.
 */
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export const DEFAULT_QUAL_FORMAT: QualFormat = 'AVERAGE_OF_X';
export const DEFAULT_QUAL_AVERAGE_COUNT = 2;
export const DEFAULT_SEEDING_METHOD: SeedingMethod = 'QUALIFIERS';
export const DEFAULT_BEST_OF = 3;

/**
 * Factory to create a default TournamentTier based on its priority index.
 * Priority 1 -> Gold (16 players, Traditional, Bo5)
 * Priority 2 -> Silver (9 players, Flat, Bo3 with Bo5 semis/finals overrides)
 * Priority 3 -> Bronze (8 players, Traditional, Bo3)
 * Priority N -> Tier N (8 players, Traditional, Bo3)
 */
export function createDefaultTier(
  priority: number,
  overrides?: Partial<TournamentTier>
): TournamentTier {
  const tierId = overrides?.id || generateUUID();

  if (priority === 1) {
    const defaultTier: TournamentTier = {
      id: tierId,
      slug: 'gold',
      name: 'Gold',
      priority: 1,
      bracketType: 'TRADITIONAL',
      playerCount: 16,
      bestOf: 5,
      primaryColor: DEFAULT_TIER_THEME.primaryColor,
      secondaryColor: DEFAULT_TIER_THEME.secondaryColor,
      cardColor: DEFAULT_TIER_THEME.cardColor,
      textColor: DEFAULT_TIER_THEME.textColor,
      backgroundColor: DEFAULT_TIER_THEME.backgroundColor,
      isLocked: false,
      bracket: generateTraditionalBracket(
        Array.from({ length: 16 }, (_, i) => ({
          id: `p${i + 1}`,
          name: AUTHENTIC_COMPETITOR_NAMES[i] || `TetrisPlayer_${i + 1}`,
          seed: i + 1,
        })),
        { tierId, bestOf: 5 }
      ),
    };
    return { ...defaultTier, ...overrides };
  }

  if (priority === 2) {
    const roundBestOfOverrides = { 4: 5, 5: 5 };
    const defaultTier: TournamentTier = {
      id: tierId,
      slug: 'silver',
      name: 'Silver',
      priority: 2,
      bracketType: 'FLAT',
      playerCount: 9,
      flatWidth: 2,
      bestOf: 3,
      roundBestOfOverrides,
      primaryColor: TIER_THEMES.silver.primaryColor,
      secondaryColor: TIER_THEMES.silver.secondaryColor,
      cardColor: TIER_THEMES.silver.cardColor,
      textColor: TIER_THEMES.silver.textColor,
      backgroundColor: TIER_THEMES.silver.backgroundColor,
      isLocked: false,
      bracket: generateFlatBracket(
        Array.from({ length: 9 }, (_, i) => ({
          id: `p${i + 17}`,
          name: AUTHENTIC_COMPETITOR_NAMES[i + 16] || `TetrisPlayer_${i + 17}`,
          seed: i + 1,
        })),
        2,
        { tierId, bestOf: 3, roundBestOfOverrides }
      ),
    };
    return { ...defaultTier, ...overrides };
  }

  const tierName = priority === 3 ? 'Bronze' : `Tier ${priority}`;
  const tierSlug = priority === 3 ? 'bronze' : `tier-${priority}`;
  const theme = priority === 3 ? TIER_THEMES.bronze : BLUE_TIER_THEME;
  const { primaryColor, secondaryColor, cardColor, textColor, backgroundColor } = theme;

  const defaultTier: TournamentTier = {
    id: tierId,
    slug: tierSlug,
    name: tierName,
    priority,
    bracketType: 'TRADITIONAL',
    playerCount: 8,
    bestOf: 3,
    primaryColor,
    secondaryColor,
    cardColor,
    textColor,
    backgroundColor,
    isLocked: false,
    bracket: generateTraditionalBracket(
      Array.from({ length: 8 }, (_, i) => ({
        id: `p${i + 26}`,
        name: AUTHENTIC_COMPETITOR_NAMES[i + 25] || `TetrisPlayer_${i + 26}`,
        seed: i + 1,
      })),
      { tierId, bestOf: 3 }
    ),
  };
  return { ...defaultTier, ...overrides };
}

/**
 * Factory to create an empty, valid Tournament entity with safe default properties.
 */
export function createEmptyTournament(overrides?: Partial<Tournament>): Tournament {
  const id = overrides?.id || generateUUID();
  const defaultTourney: Tournament = {
    id,
    name: '',
    slug: '',
    organizationId: undefined,
    date: 'Upcoming',
    location: 'TBD',
    qualFormat: DEFAULT_QUAL_FORMAT,
    qualAverageCount: DEFAULT_QUAL_AVERAGE_COUNT,
    pointsConfig: DEFAULT_POINTS_THRESHOLDS,
    qualMode: 'HYBRID',
    qualWindowMinutes: 90,
    isLocked: false,
    seedingMethod: DEFAULT_SEEDING_METHOD,
    manualSeeds: [],
    tiers: [],
    matchScores: {},
    playersPool: [],
    qualifierSubmissions: [],
    qualRuns: [],
    tournamentPlayers: {},
    useOrgBranding: true,
  };
  return { ...defaultTourney, ...overrides };
}

/**
 * Factory to create an empty, valid PlayerProfile entity.
 */
export function createEmptyPlayer(overrides?: Partial<PlayerProfile>): PlayerProfile {
  const id = overrides?.id || generateUUID();
  const defaultPlayer: PlayerProfile = {
    id,
    name: '',
    country: 'US',
    avatarType: 'flag',
    personalBest: 0,
    playstyle: 'Rolling',
    isDisqualified: false,
  };
  return { ...defaultPlayer, ...overrides };
}
