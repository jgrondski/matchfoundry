import { CONTRAST_TEXT, DEFAULT_TIER_THEME, THEME_FALLBACK, TIER_THEMES } from '../../theme/palette';

/**
 * Utility to generate RGBA color strings with custom alpha transparency
 * from hex color codes (e.g. #3b82f6 or #f59e0b), with a safe fallback.
 */
export function colorWithAlpha(
  colorStr: string | undefined,
  alpha: number,
  fallback: string = 'rgba(245, 158, 11, 0.2)'
): string {
  if (!colorStr) return fallback;
  if (colorStr.startsWith('#')) {
    let hex = colorStr.slice(1);
    if (hex.length === 3) {
      hex = hex.split('').map(c => c + c).join('');
    }
    if (hex.length === 6) {
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
  }
  return colorStr;
}

/**
 * Returns high-contrast text color ('#000000' or '#ffffff')
 * based on the luminance of the provided background color.
 */
export function getContrastingTextColor(hexColor: string | undefined, fallback: string = CONTRAST_TEXT.dark): string {
  if (!hexColor || !hexColor.startsWith('#')) return fallback;
  let hex = hexColor.slice(1);
  if (hex.length === 3) {
    hex = hex.split('').map(c => c + c).join('');
  }
  if (hex.length !== 6) return fallback;
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  // Standard perceptual luminance formula
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? CONTRAST_TEXT.dark : CONTRAST_TEXT.light;
}

/**
 * Generates solid background for the tier canvas without gradients.
 */
export function getTierCanvasBackground(
  backgroundColor: string | undefined,
  _primaryColor?: string | undefined,
  fallback: string = THEME_FALLBACK.backgroundColor
): string {
  if (backgroundColor && (backgroundColor.startsWith('#') || backgroundColor.startsWith('rgb'))) {
    return backgroundColor;
  }
  return fallback;
}

/**
 * Generates match card background fill from the dedicated cardColor setting.
 */
export function getTierCardBackground(
  cardColor: string | undefined,
  _primaryColor?: string | undefined,
  fallback: string = THEME_FALLBACK.cardColor
): string {
  if (cardColor && (cardColor.startsWith('#') || cardColor.startsWith('rgb'))) {
    return cardColor;
  }
  return fallback;
}

/**
 * Generates an alternating row background shade (e.g. for zebra striping)
 * from a base hex color by shifting perceptual luminance slightly.
 */
export function getAlternateShade(hexColor: string | undefined, deltaPercent: number = 7): string {
  if (!hexColor || !hexColor.startsWith('#')) return THEME_FALLBACK.alternateShade;
  let hex = hexColor.slice(1);
  if (hex.length === 3) {
    hex = hex.split('').map(c => c + c).join('');
  }
  if (hex.length !== 6) return THEME_FALLBACK.alternateShade;
  let r = parseInt(hex.substring(0, 2), 16);
  let g = parseInt(hex.substring(2, 4), 16);
  let b = parseInt(hex.substring(4, 6), 16);

  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  const shift = luminance < 0.5 ? Math.round(255 * (deltaPercent / 100)) : -Math.round(255 * (deltaPercent / 100));
  r = Math.min(255, Math.max(0, r + shift));
  g = Math.min(255, Math.max(0, g + shift));
  b = Math.min(255, Math.max(0, b + shift));

  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Resolves a scale factor for bracket match card text and inner elements.
 * 1.0 represents the default baseline (original compact text size).
 */
export function getTextScale(textSize?: string | number): number {
  if (typeof textSize === 'number') {
    if (textSize > 2) return textSize / 100;
    return Math.max(0.6, Math.min(2.0, textSize));
  }
  switch (textSize) {
    case 'small':
    case 'compact':
      return 0.88;
    case 'medium':
      return 1.1;
    case 'large':
      return 1.2;
    case 'xlarge':
      return 1.3;
    case 'normal':
    case 'standard':
    default:
      return 1.0;
  }
}

export interface TierThemeColors {
  primaryColor: string;
  secondaryColor: string;
  cardColor: string;
  textColor: string;
  backgroundColor: string;
  lowerBracketColor?: string;
}

/**
 * Returns default theme colors for a tier based on its id, slug, or priority.
 */
export function getDefaultTierColors(tier: { id?: string; slug?: string; priority?: number }): TierThemeColors {
  const isGold = tier.id === 'gold' || tier.slug === 'gold' || tier.priority === 1;
  const isSilver = tier.id === 'silver' || tier.slug === 'silver' || tier.priority === 2;
  const isBronze = tier.id === 'bronze' || tier.slug === 'bronze' || tier.priority === 3;

  if (isGold) {
    return {
      primaryColor: DEFAULT_TIER_THEME.primaryColor,
      secondaryColor: DEFAULT_TIER_THEME.secondaryColor,
      cardColor: DEFAULT_TIER_THEME.cardColor,
      textColor: DEFAULT_TIER_THEME.textColor,
      backgroundColor: DEFAULT_TIER_THEME.backgroundColor,
      lowerBracketColor: DEFAULT_TIER_THEME.lowerBracketColor,
    };
  }
  if (isSilver) {
    return {
      primaryColor: TIER_THEMES.silver.primaryColor,
      secondaryColor: TIER_THEMES.silver.secondaryColor,
      cardColor: TIER_THEMES.silver.cardColor,
      textColor: TIER_THEMES.silver.textColor,
      backgroundColor: TIER_THEMES.silver.backgroundColor,
      lowerBracketColor: TIER_THEMES.silver.lowerBracketColor,
    };
  }
  if (isBronze) {
    return {
      primaryColor: TIER_THEMES.bronze.primaryColor,
      secondaryColor: TIER_THEMES.bronze.secondaryColor,
      cardColor: TIER_THEMES.bronze.cardColor,
      textColor: TIER_THEMES.bronze.textColor,
      backgroundColor: TIER_THEMES.bronze.backgroundColor,
      lowerBracketColor: TIER_THEMES.bronze.lowerBracketColor,
    };
  }
  return {
    primaryColor: TIER_THEMES.yellow.primaryColor,
    secondaryColor: TIER_THEMES.yellow.secondaryColor,
    cardColor: TIER_THEMES.yellow.cardColor,
    textColor: TIER_THEMES.yellow.textColor,
    backgroundColor: TIER_THEMES.yellow.backgroundColor,
    lowerBracketColor: TIER_THEMES.yellow.lowerBracketColor,
  };
}

function parseHex(color: string | undefined): [number, number, number] | null {
  if (!color || !color.startsWith('#')) return null;
  let hex = color.slice(1);
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  if (hex.length === 8) hex = hex.slice(0, 6);
  if (hex.length !== 6 || !/^[0-9a-f]{6}$/i.test(hex)) return null;
  return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
}

/**
 * The solid color you see when `fg` at `alpha` sits on `bg`. OBS overlays use this instead of
 * an rgba() fill, because anything translucent picks up the chroma-key color behind it and
 * gets keyed out with it. Falls back to `bg` (or `fg` when bg is unreadable) for non-hex input.
 */
export function blendOver(fg: string | undefined, bg: string | undefined, alpha: number): string {
  const f = parseHex(fg);
  const b = parseHex(bg);
  if (!f || !b) return (b ? bg : fg) || THEME_FALLBACK.cardColor;
  const toHex = (n: number) => Math.round(n).toString(16).padStart(2, '0');
  const mix = (i: number) => f[i] * alpha + b[i] * (1 - alpha);
  return `#${toHex(mix(0))}${toHex(mix(1))}${toHex(mix(2))}`;
}

/** A hex color with any alpha channel dropped (#rrggbbaa -> #rrggbb). Non-hex input is returned as is. */
export function toOpaqueHex(color: string): string {
  const rgb = parseHex(color);
  if (!rgb) return color;
  return `#${rgb.map(n => n.toString(16).padStart(2, '0')).join('')}`;
}

function hsv([r, g, b]: [number, number, number]): { h: number; s: number; v: number } {
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  const d = max - min;
  let h = 0;
  if (d > 0) {
    if (max === r / 255) h = 60 * (((g - b) / 255 / d) % 6);
    else if (max === g / 255) h = 60 * ((b - r) / 255 / d + 2);
    else h = 60 * ((r - g) / 255 / d + 4);
  }
  return { h: (h + 360) % 360, s: max === 0 ? 0 : d / max, v: max };
}

/**
 * True when `color` is close enough in hue to the chroma key that a keyer tuned for the key
 * would also eat it: a saturated, reasonably bright color within 45 degrees of the key's hue.
 * Greys, darks and pastels never clash.
 */
export function clashesWithChroma(color: string | undefined, keyHex: string): boolean {
  const c = parseHex(color);
  const k = parseHex(keyHex);
  if (!c || !k) return false;
  const a = hsv(c);
  const b = hsv(k);
  if (a.s < 0.45 || a.v < 0.35) return false;
  const diff = Math.abs(a.h - b.h);
  return Math.min(diff, 360 - diff) <= 45;
}
