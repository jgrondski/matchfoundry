import type { MatchScoreRecord, Tournament, TournamentSummary } from './types';

/** True when any match has a result or a recorded game. Same rule the tournament card used before ER.9. */
export function hasMatchProgress(matchScores: Record<string, MatchScoreRecord> | null | undefined): boolean {
  return Object.values(matchScores || {}).some(
    m =>
      m.isComplete ||
      m.player1Wins > 0 ||
      m.player2Wins > 0 ||
      Boolean(m.games?.some(g => g.player1Points !== null || g.player2Points !== null))
  );
}

/** Summary of a fully loaded tournament, identical in shape to what GET /api/tournaments returns. */
export function toTournamentSummary(t: Tournament): TournamentSummary {
  const playerIds = new Set<string>();
  (t.playersPool || []).forEach(p => playerIds.add(p.id));
  Object.keys(t.tournamentPlayers || {}).forEach(id => playerIds.add(id));
  (t.qualifierSubmissions || []).forEach(s => playerIds.add(s.playerId));
  (t.qualRuns || []).forEach(r => playerIds.add(r.playerId));
  return {
    id: t.id,
    slug: t.slug,
    name: t.name,
    organizationId: t.organizationId,
    startDate: t.startDate || '',
    endDate: t.endDate || '',
    location: t.location || '',
    qualFormat: t.qualFormat,
    qualAverageCount: t.qualAverageCount,
    pointsConfig: t.pointsConfig,
    qualMode: t.qualMode || 'HYBRID',
    onlineQualsOpen: Boolean(t.onlineQualsOpen),
    qualsClosed: Boolean(t.qualsClosed),
    isLocked: Boolean(t.isLocked),
    seedingMethod: t.seedingMethod || 'QUALIFIERS',
    isTest: Boolean(t.isTest),
    revision: typeof t.revision === 'number' ? t.revision : 0,
    tiers: (t.tiers || []).map(tier => ({
      id: tier.id,
      slug: tier.slug,
      name: tier.name,
      priority: tier.priority,
      playerCount: tier.playerCount,
      bestOf: tier.bestOf,
      primaryColor: tier.primaryColor,
    })),
    registeredPlayerCount: (t.playersPool || []).length,
    hasRecordedResults:
      (t.qualifierSubmissions || []).length > 0 ||
      (t.qualifiers || []).length > 0 ||
      hasMatchProgress(t.matchScores),
    playerIds: [...playerIds],
  };
}

/**
 * The list the UI shows: the server's summaries in server order, with each tournament that is
 * loaded in full replaced by its fresh summary, and loaded tournaments missing from the server
 * list (just created or simulated) first, in their loaded order.
 */
export function mergeTournamentSummaries(
  serverSummaries: TournamentSummary[],
  loaded: Tournament[]
): TournamentSummary[] {
  const loadedById = new Map(loaded.map(t => [t.id, t]));
  const serverIds = new Set(serverSummaries.map(s => s.id));
  const added = loaded.filter(t => !serverIds.has(t.id)).map(toTournamentSummary);
  const merged = serverSummaries.map(s => {
    const full = loadedById.get(s.id);
    return full ? toTournamentSummary(full) : s;
  });
  return [...added, ...merged];
}