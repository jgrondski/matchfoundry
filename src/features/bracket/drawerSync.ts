/**
 * Whether the score drawer should replace its editable games with the latest stored ones.
 * It never discards a judge's unsaved typing because of a background refresh; the save's
 * revision check catches real conflicts instead.
 */
export function shouldResyncDrawer(input: {
  lastSyncedMatchId: string | null; // match id at the last resync, null if never synced
  lastSyncedGamesJson: string | null; // JSON of the games at the last resync
  currentGamesJson: string; // JSON of the games the judge sees now
  matchId: string;
}): boolean {
  if (input.lastSyncedMatchId !== input.matchId) return true;
  return input.currentGamesJson === input.lastSyncedGamesJson;
}
