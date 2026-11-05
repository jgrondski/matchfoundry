export * from './types';
export * from './singleElimLayout';
export * from './doubleElimLayout';
export * from './hybridLayout';

import { BracketStructure } from '../types';
import { LayoutConfig, BracketViewMode, BracketLayoutMetadata, COMPACT_LAYOUT_CONFIG } from './types';
import { calculateTraditionalSingleElimLayout, calculateSplitBracketLayout } from './singleElimLayout';
import { calculateDoubleEliminationBracketLayout } from './doubleElimLayout';

/**
 * Main Layout Calculator supporting standard, fit, and split bilateral modes.
 * Dynamically routes to Traditional Single Elim, Double Elim, or Accelerated Hybrid layout engines.
 */
export function calculateBracketLayout(
  bracket: BracketStructure,
  customConfig?: Partial<LayoutConfig>,
  viewMode: BracketViewMode = 'standard'
): BracketLayoutMetadata {
  if (viewMode === 'compact') {
    const compactLayout = calculateBracketLayout(
      bracket,
      { ...COMPACT_LAYOUT_CONFIG, ...customConfig },
      'standard'
    );
    return { ...compactLayout, viewMode: 'compact' };
  }

  if (bracket.eliminationType === 'DOUBLE') {
    return calculateDoubleEliminationBracketLayout(bracket, customConfig, viewMode);
  }

  if (viewMode === 'split') {
    return calculateSplitBracketLayout(bracket, customConfig);
  }

  return calculateTraditionalSingleElimLayout(bracket, customConfig, viewMode);
}

/**
 * Whether the compact bracket view can render this bracket. Single elimination and
 * double elimination with traditional routing ('TRADITIONAL' or 'TRADITIONAL_TREE', or
 * no routing set) are supported; Accelerated Hybrid and Flat Staged are not.
 */
export function supportsCompactView(bracket: BracketStructure): boolean {
  const routing = bracket.bracketRouting;
  return routing !== 'ACCELERATED_HYBRID' && routing !== 'FLAT_STAGED';
}
