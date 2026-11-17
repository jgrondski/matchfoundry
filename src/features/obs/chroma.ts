import { CHROMA_KEY_COLORS } from '../../theme/palette';
import { clashesWithChroma } from '../bracket/colorUtils';

export type ChromaPreset = keyof typeof CHROMA_KEY_COLORS;

export const CHROMA_PRESETS: readonly ChromaPreset[] = ['green', 'magenta', 'blue'];

/**
 * The background color for an OBS `?chroma=` value: a preset name (green, magenta, blue),
 * a hex color with or without '#', or null for a transparent background.
 */
export function resolveChromaColor(param?: string | null): string | null {
  const c = (param || '').trim().toLowerCase();
  if (!c) return null;
  if (c in CHROMA_KEY_COLORS) return CHROMA_KEY_COLORS[c as ChromaPreset];
  return c.startsWith('#') ? c : `#${c}`;
}

interface ChromaCheckTier {
  name: string;
  primaryColor?: string;
  secondaryColor?: string;
  cardColor?: string;
  textColor?: string;
  lowerBracketColor?: string;
}

/**
 * For each chroma preset, the names of tiers that use a color a keyer would remove along with
 * that background. Pass tiers with their theme colors already resolved (custom or default).
 */
export function getChromaClashes(tiers: ChromaCheckTier[]): Record<ChromaPreset, string[]> {
  const result = { green: [], magenta: [], blue: [] } as Record<ChromaPreset, string[]>;
  for (const preset of CHROMA_PRESETS) {
    const key = CHROMA_KEY_COLORS[preset];
    for (const tier of tiers) {
      const colorsUsed = [tier.primaryColor, tier.secondaryColor, tier.cardColor, tier.textColor, tier.lowerBracketColor];
      if (colorsUsed.some(c => clashesWithChroma(c, key))) result[preset].push(tier.name);
    }
  }
  return result;
}

/** The first preset (green, then magenta, then blue) no tier clashes with, or null if all clash. */
export function recommendChroma(clashes: Record<ChromaPreset, string[]>): ChromaPreset | null {
  return CHROMA_PRESETS.find(p => clashes[p].length === 0) ?? null;
}
