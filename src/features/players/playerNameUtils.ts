/**
 * Utility functions for resolving competitor names across the tournament manager.
 *
 * Domain Rules:
 * - Master Catalog (Global Directory & Admin Modals): Displays Player Name (name) and Nickname/Preferred Name (displayName/nickname)
 *   so administrators can view and edit both.
 * - All Other App Views (Brackets, Match Cards, Matrices, Qualifiers Leaderboards, Tournament Roster, and OBS Overlays):
 *   Display the Preferred Name (displayName or nickname), falling back to Player Name (name) if null or empty.
 */

export function getEffectivePlayerName(
  player?: { name?: string; displayName?: string; nickname?: string } | null
): string {
  if (!player) return '';
  return player.displayName?.trim() || player.nickname?.trim() || player.name || '';
}
