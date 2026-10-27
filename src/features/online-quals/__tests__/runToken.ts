import { and, eq } from 'drizzle-orm';
import { getDb, qualifierSubmissions } from '../../../db';

/** The run token of a player's in-progress online run, as the competitor's page would hold it. */
export async function runToken(tournamentId: string, playerId: string): Promise<string | undefined> {
  const [row] = await getDb()
    .select({ resumeToken: qualifierSubmissions.resumeToken })
    .from(qualifierSubmissions)
    .where(
      and(
        eq(qualifierSubmissions.tournamentId, tournamentId),
        eq(qualifierSubmissions.playerId, playerId),
        eq(qualifierSubmissions.status, 'IN_PROGRESS')
      )
    )
    .limit(1);
  return row?.resumeToken || undefined;
}
