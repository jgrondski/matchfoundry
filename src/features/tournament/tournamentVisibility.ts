import type { Tournament } from './types';

/**
 * Test tournaments stay off the public front page. They remain reachable by direct link, and a
 * System Admin can list them with the "Show test tournaments" toggle.
 */
export function filterFrontPageTournaments<T extends Pick<Tournament, 'isTest'>>(
  tournaments: T[],
  { showTest }: { showTest: boolean }
): T[] {
  return showTest ? tournaments : tournaments.filter(t => !t.isTest);
}
