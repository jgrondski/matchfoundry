import type { Tournament } from '../tournament/types';
import type { ReviewQueueSessionSummary } from '../../api/qualifiers';

/**
 * Derives aggregated session summaries from raw tournament qualifier submissions.
 * Groups by playerId so that multiple scores/maxouts from a single online run
 * collapse into a single competitor session.
 */
export function deriveSessionsFromTournament(tournament: Tournament): ReviewQueueSessionSummary[] {
  const allSubs = tournament.qualifierSubmissions || [];
  if (allSubs.length === 0) return [];

  const groups = new Map<string, typeof allSubs>();
  for (const s of allSubs) {
    const list = groups.get(s.playerId) || [];
    list.push(s);
    groups.set(s.playerId, list);
  }

  const playerMap = new Map((tournament.playersPool || []).map(p => [p.id, p]));
  const qualMinutes = tournament.qualWindowMinutes || 90;
  const result: ReviewQueueSessionSummary[] = [];

  for (const [playerId, subs] of groups.entries()) {
    const first = subs[0];
    const isOnline = subs.some(s => s.submissionSource === 'ONLINE');
    const scoredRows = subs.filter(
      s => s.status !== 'IN_PROGRESS' && s.status !== 'NOT_STARTED'
    );
    const p = playerMap.get(playerId);

    result.push({
      tournamentId: tournament.id,
      playerId,
      playerName: p?.name || first.submittedTwitchUsername || 'Unknown Player',
      country: p?.country || undefined,
      avatarUrl: p?.avatarUrl || undefined,
      avatarType: (p?.avatarType as any) || 'flag',
      submissionSource: isOnline ? 'ONLINE' : 'IN_PERSON',
      status: first.status || 'SUBMITTED',
      authWord: isOnline ? (first.authWord || 'ROCKET') : (first.authWord || null),
      twitchVodUrl: first.twitchVodUrl || null,
      submittedTwitchId: first.submittedTwitchId || null,
      submittedTwitchUsername: first.submittedTwitchUsername || null,
      identityStatus: first.identityStatus || (isOnline ? null : 'VERIFIED_MATCH'),
      timerLog:
        first.timerLog || {
          startedAt: first.submittedAt,
          elapsedSeconds: isOnline ? 0 : qualMinutes * 60,
          pauses: [],
        },
      scores: scoredRows.map(s => s.score),
      judgeNotes: first.judgeNotes || null,
      playerNotes: first.playerNotes || null,
      submissionIds: subs.map(s => s.id),
    });
  }

  return result;
}

/**
 * Computes the number of unique competitors awaiting review.
 * Matches the "Pending Review" count on the Review Queue page.
 */
export function countPendingReviewSessions(tournament: Tournament | null | undefined): number {
  if (!tournament) return 0;
  const sessions = deriveSessionsFromTournament(tournament);
  return sessions.filter(s => s.status === 'SUBMITTED').length;
}
