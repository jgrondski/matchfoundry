import type { QualRun, QualifierSubmission, Tournament } from '../tournament/types';
import type { ReviewQueueSessionSummary } from '../../api/qualifiers';

/**
 * Derives aggregated session summaries from raw tournament qualifier submissions.
 * Groups by playerId so that multiple scores/maxouts from a single online run
 * collapse into a single competitor session.
 */
export function deriveSessionsFromTournament(tournament: Tournament): ReviewQueueSessionSummary[] {
  if (tournament.qualRuns) return deriveSessionsFromRuns(tournament, tournament.qualRuns);

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
    const first = subs.find(s => s.status === 'IN_PROGRESS') || subs[0];
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
      runId: first.runId || '',
      submittedAt: first.status === 'IN_PROGRESS' ? null : (first.timerLog?.submittedAt ?? first.submittedAt ?? null),
      verifiedBy: first.verifiedBy || null,
      verifiedAt: first.verifiedAt ?? null,
    });
  }

  return result;
}

/** One summary per qual run, matching the server's buildSessionSummary. */
function deriveSessionsFromRuns(tournament: Tournament, runs: QualRun[]): ReviewQueueSessionSummary[] {
  const playerMap = new Map((tournament.playersPool || []).map(p => [p.id, p]));
  const qualMinutes = tournament.qualWindowMinutes || 90;
  const subsByRun = new Map<string, QualifierSubmission[]>();
  for (const s of tournament.qualifierSubmissions || []) {
    if (!s.runId) continue;
    const list = subsByRun.get(s.runId) || [];
    list.push(s);
    subsByRun.set(s.runId, list);
  }

  return runs.map(run => {
    const isOnline = run.submissionSource === 'ONLINE';
    const subs = [...(subsByRun.get(run.id) || [])].sort((a, b) => a.submittedAt - b.submittedAt);
    const p = playerMap.get(run.playerId);
    return {
      tournamentId: tournament.id,
      playerId: run.playerId,
      playerName: p?.name || run.submittedTwitchUsername || 'Unknown Player',
      country: p?.country || undefined,
      avatarUrl: p?.avatarUrl || undefined,
      avatarType: (p?.avatarType as any) || 'flag',
      submissionSource: run.submissionSource,
      status: run.status,
      authWord: isOnline ? (run.authWord || 'ROCKET') : (run.authWord || null),
      twitchVodUrl: run.twitchVodUrl || null,
      submittedTwitchId: run.submittedTwitchId || null,
      submittedTwitchUsername: run.submittedTwitchUsername || null,
      identityStatus: run.identityStatus || (isOnline ? null : 'VERIFIED_MATCH'),
      timerLog: run.timerLog || {
        startedAt: run.createdAt,
        elapsedSeconds: isOnline ? 0 : qualMinutes * 60,
        pauses: [],
      },
      scores: subs.map(s => s.score),
      judgeNotes: run.judgeNotes || null,
      playerNotes: run.playerNotes || null,
      submissionIds: subs.map(s => s.id),
      runId: run.id,
      submittedAt: run.submittedAt ?? null,
      verifiedBy: run.verifiedBy || null,
      verifiedAt: run.verifiedAt ?? null,
    };
  });
}

/** How long past its qual window an unfinished run goes before judges see it flagged. */
export const ABANDONED_GRACE_MINUTES = 60;

/**
 * An unfinished online run more than an hour past its window. Only a warning for judges: nothing
 * is DQ'd or deleted automatically.
 */
export function isAbandonedRun(
  session: Pick<ReviewQueueSessionSummary, 'status' | 'timerLog'>,
  qualWindowMinutes: number,
  nowMs: number = Date.now()
): boolean {
  if (session.status !== 'IN_PROGRESS' || !session.timerLog?.startedAt) return false;
  return nowMs > session.timerLog.startedAt + (qualWindowMinutes + ABANDONED_GRACE_MINUTES) * 60_000;
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
