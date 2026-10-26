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
