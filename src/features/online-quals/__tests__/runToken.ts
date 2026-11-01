import { and, eq } from 'drizzle-orm';
import { getDb, qualifierRuns } from '../../../db';

/** The run token of a player's in-progress online run, as the competitor's page would hold it. */
export async function runToken(tournamentId: string, playerId: string): Promise<string | undefined> {
  const [row] = await getDb()
    .select({ resumeToken: qualifierRuns.resumeToken })
    .from(qualifierRuns)
    .where(
      and(
        eq(qualifierRuns.tournamentId, tournamentId),
        eq(qualifierRuns.playerId, playerId),
        eq(qualifierRuns.status, 'IN_PROGRESS')
      )
    )
    .limit(1);
  return row?.resumeToken || undefined;
}
