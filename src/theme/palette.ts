/**
 * Single home for hex colors used as data: theme defaults stored on tiers and orgs,
 * render-time fallbacks for missing theme values, and per-feature color maps.
 *
 * Static UI colors are Tailwind tokens in src/index.css, not values here.
 * Values are kept byte-identical to what each call site used before (including case),
 * because some are persisted or compared as strings.
 */

/** Freezes a color map, keeping its keys but typing values as plain strings. */
function colors<K extends string>(map: Record<K, string>): Readonly<Record<K, string>> {
  return Object.freeze(map);
}

export interface TierThemeHex {
  readonly primaryColor: string;
  readonly secondaryColor: string;
  readonly cardColor: string;
  readonly textColor: string;
  readonly backgroundColor: string;
  readonly lowerBracketColor: string;
}

/** Built-in tier themes. `gold` is the default for new tiers and new organizations. */
export const TIER_THEMES: Readonly<Record<'gold' | 'silver' | 'bronze' | 'yellow', TierThemeHex>> = {
  gold: {
    primaryColor: '#ffc905',
    secondaryColor: '#705b33',
    cardColor: '#1b1c1d',
    textColor: '#94A3B8',
    backgroundColor: '#020203',
    lowerBracketColor: '#c2410c',
  },
  silver: {
    primaryColor: '#CBD5E1',
    secondaryColor: '#3d4652',
    cardColor: '#0E1420',
    textColor: '#4f5c6d',
    backgroundColor: '#0B0E14',
    lowerBracketColor: '#c2410c',
  },
  bronze: {
    primaryColor: '#db5f00',
    secondaryColor: '#4e310e',
    cardColor: '#181410',
    textColor: '#5e6f87',
    backgroundColor: '#0B0E14',
    lowerBracketColor: '#c2410c',
  },
  /** Default colors for a tier that is not gold, silver or bronze. */
  yellow: {
    primaryColor: '#eab308',
    secondaryColor: '#ca8a04',
    cardColor: '#161922',
    textColor: '#94A3B8',
    backgroundColor: '#0B0E14',
    lowerBracketColor: '#c2410c',
  },
};

/** New tiers beyond the third (non-bronze) get this theme. It has no lower-bracket color. */
export const BLUE_TIER_THEME: Readonly<Omit<TierThemeHex, 'lowerBracketColor'>> = {
  primaryColor: '#3b82f6',
  secondaryColor: '#60a5fa',
  cardColor: '#0E1420',
  textColor: '#94A3B8',
  backgroundColor: '#0B0E14',
};

export const DEFAULT_TIER_THEME = TIER_THEMES.gold;

/** Default lower-bracket accent for every tier theme. */
export const LOWER_BRACKET_COLOR: string = '#c2410c';

/** Colors a tier stored by older data received when it had none. */
export const LEGACY_TIER_FALLBACK = colors({
  primaryColor: '#FFD700',
  secondaryColor: '#000000',
});

/**
 * Render-time fallbacks when a tier or org has no value for a color.
 * These differ from DEFAULT_TIER_THEME on purpose; they are what each view rendered before.
 */
export const THEME_FALLBACK = colors({
  primaryColor: '#f59e0b',
  cardColor: '#161922',
  backgroundColor: '#0c0d12',
  /** OBS hub and OBS match card. */
  obsCardColor: '#141824',
  /** Leaderboard seed column card. */
  leaderboardCardColor: '#0E1420',
  /** Organization banner and directory card secondary color. */
  orgSecondaryColor: '#1e293b',
  /** getAlternateShade() result for unparseable input. */
  alternateShade: '#182232',
});

/** High-contrast text picked by getContrastingTextColor(). */
export const CONTRAST_TEXT = colors({
  dark: '#000000',
  light: '#ffffff',
});

/** Player status accents used as data (passed into themed components). */
export const STATUS_COLORS = colors({
  dq: '#ef4444',
  dqSecondary: '#7f1d1d',
  dnq: '#64748b',
  dnqSecondary: '#334155',
  matchWin: '#10b981',
  matchLoss: '#f43f5e',
});

/** QR code module colors in the share modal. */
export const QR_COLORS = colors({
  dark: '#090d16',
  light: '#ffffff',
});

/** OBS chroma-key backgrounds. */
export const CHROMA_KEY_COLORS = colors({
  green: '#00ff00',
  magenta: '#ff00ff',
  blue: '#0000ff',
});

/** Playstyle chip colors. */
export const PLAYSTYLE_COLORS: Readonly<
  Record<'roll' | 'das' | 'hybrid' | 'tap' | 'unknown', Readonly<{ color: string; background: string; borderColor: string }>>
> = {
  roll: { color: '#ffffff', background: '#a855f7', borderColor: '#c084fc' },
  das: { color: '#fde047', background: '#dc2626', borderColor: '#ef4444' },
  hybrid: { color: '#e9d5ff', background: '#4c1d95', borderColor: '#6b21a8' },
  tap: { color: '#bae6fd', background: '#0c4a6e', borderColor: '#0284c7' },
  unknown: { color: '#e2e8f0', background: 'rgba(255, 255, 255, 0.1)', borderColor: 'rgba(255, 255, 255, 0.2)' },
};

/** Accelerated-hybrid pod colors (AR = advance round, UB = upper bracket, LB = lower bracket). */
export const ACCELERATED_HYBRID_POD_PALETTE = {
  AR: {
    border: '#9333EA',
    text: '#C084FC',
    bgTranslucent: 'rgba(147, 51, 234, 0.2)',
    badgeBg: 'rgba(147, 51, 234, 0.25)',
    glow: 'rgba(147, 51, 234, 0.6)',
  },
  UB: {
    border: '#0284C7',
    text: '#38BDF8',
    bgTranslucent: 'rgba(2, 132, 199, 0.2)',
    badgeBg: 'rgba(2, 132, 199, 0.25)',
    glow: 'rgba(2, 132, 199, 0.6)',
  },
  LB: {
    border: '#c2410c',
    text: '#fb923c',
    bgTranslucent: 'rgba(194, 65, 12, 0.2)',
    badgeBg: 'rgba(194, 65, 12, 0.25)',
    glow: 'rgba(194, 65, 12, 0.6)',
  },
} as const;

/** Text color of lower-bracket routing chips. */
export const LOWER_BRACKET_CHIP_TEXT: string = '#fb923c';
