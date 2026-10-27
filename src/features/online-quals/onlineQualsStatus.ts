import type { Tournament } from '../tournament/types';

/**
 * Whether new online qualifier runs can be started. Requires an ONLINE/HYBRID tournament that the
 * organizer has explicitly opened, with quals not yet closed and brackets not locked.
 * Mirrors the server-side guard in startOnlineQualSession.
 */
export function isOnlineQualsOpen(
  tournament: Pick<Tournament, 'qualMode' | 'onlineQualsOpen' | 'qualsClosed' | 'isLocked'>
): boolean {
  return (
    (tournament.qualMode || 'HYBRID') !== 'IN_PERSON' &&
    Boolean(tournament.onlineQualsOpen) &&
    !tournament.qualsClosed &&
    !tournament.isLocked
  );
}

/**
 * IN_PROGRESS / NOT_STARTED rows are run placeholders, not scores: they never count as qualifier
 * results, never block roster removal or player deletion, and are hidden from the leaderboard.
 */
export function isPlaceholderSubmissionStatus(status: string | null | undefined): boolean {
  return status === 'IN_PROGRESS' || status === 'NOT_STARTED';
}
