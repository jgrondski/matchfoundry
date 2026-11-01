import { and, asc, desc, eq, isNull } from 'drizzle-orm';
import { getDb } from '../db';
import { qualifierRuns, qualifierSubmissions } from '../db/schema';

/** One competitor's qual in a tournament. Its scores are the qualifier_submissions rows with this runId. */
export type QualRunRow = typeof qualifierRuns.$inferSelect;

type QualRunInsert = typeof qualifierRuns.$inferInsert;
type LegacySubmissionRow = typeof qualifierSubmissions.$inferSelect;

export async function getRunForPlayer(tournamentId: string, playerId: string): Promise<QualRunRow | null> {
  const [run] = await getDb()
    .select()
    .from(qualifierRuns)
    .where(and(eq(qualifierRuns.tournamentId, tournamentId), eq(qualifierRuns.playerId, playerId)))
    .limit(1);
  return (run as QualRunRow | undefined) || null;
}

export async function listRuns(tournamentId: string): Promise<QualRunRow[]> {
  return (await getDb()
    .select()
    .from(qualifierRuns)
    .where(eq(qualifierRuns.tournamentId, tournamentId))
    .orderBy(desc(qualifierRuns.createdAt))) as QualRunRow[];
}

export async function listRunScores(
  runId: string
): Promise<Array<{ id: string; score: number; createdAt: Date }>> {
  return getDb()
    .select({ id: qualifierSubmissions.id, score: qualifierSubmissions.score, createdAt: qualifierSubmissions.createdAt })
    .from(qualifierSubmissions)
    .where(eq(qualifierSubmissions.runId, runId))
    .orderBy(asc(qualifierSubmissions.createdAt));
}

export async function insertRunScores(run: QualRunRow, scores: number[], baseTime: Date): Promise<string[]> {
  if (scores.length === 0) return [];
  const inserted = await getDb()
    .insert(qualifierSubmissions)
    .values(
      scores.map((score, index) => ({
        tournamentId: run.tournamentId,
        playerId: run.playerId,
        runId: run.id,
        score,
        createdAt: new Date(baseTime.getTime() + index),
      }))
    )
    .returning({ id: qualifierSubmissions.id });
  return inserted.map((r: { id: string }) => r.id);
}

export async function replaceRunScores(run: QualRunRow, scores: number[], baseTime: Date): Promise<string[]> {
  await getDb().delete(qualifierSubmissions).where(eq(qualifierSubmissions.runId, run.id));
  return insertRunScores(run, scores, baseTime);
}

const RUN_PLAYER_INDEX = 'qualifier_runs_tournament_player_idx';

/** True when the error (or its wrapped cause) is a violation of the one-run-per-player index. */
function isRunPlayerConflict(err: unknown): boolean {
  let current: unknown = err;
  for (let depth = 0; current && depth < 4; depth++) {
    const e = current as { constraint?: string; message?: string; cause?: unknown };
    if (e.constraint === RUN_PLAYER_INDEX) return true;
    if (typeof e.message === 'string' && e.message.includes(RUN_PLAYER_INDEX)) return true;
    current = e.cause;
  }
  return false;
}

function isPlaceholderRow(row: LegacySubmissionRow): boolean {
  return row.status === 'IN_PROGRESS' || row.status === 'NOT_STARTED';
}

function deriveLegacyRunStatus(rows: LegacySubmissionRow[]): QualRunRow['status'] {
  const scored = rows.filter(r => !isPlaceholderRow(r));
  if (rows.some(isPlaceholderRow)) return 'IN_PROGRESS';
  if (rows.some(r => r.status === 'DQ')) return 'DQ';
  if (rows.some(r => r.status === 'SUBMITTED')) return 'SUBMITTED';
  if (scored.length > 0 && scored.every(r => r.status === 'DNQ')) return 'DNQ';
  if (rows.some(r => r.status === 'VERIFIED')) return 'VERIFIED';
  return 'SUBMITTED';
}

function earliest(rows: LegacySubmissionRow[]): Date {
  return rows.reduce((min, r) => (r.createdAt < min ? r.createdAt : min), rows[0].createdAt);
}

function buildLegacyRun(tournamentId: string, playerId: string, rows: LegacySubmissionRow[]): QualRunInsert {
  const placeholders = rows.filter(isPlaceholderRow);
  const scored = rows.filter(r => !isPlaceholderRow(r));
  const anchor =
    placeholders[0] || rows.reduce((latest, r) => (r.createdAt > latest.createdAt ? r : latest), rows[0]);
  const anchorIsPlaceholder = isPlaceholderRow(anchor);
  const submissionSource = rows.some(r => r.submissionSource === 'ONLINE') ? 'ONLINE' : 'IN_PERSON';
  const status = deriveLegacyRunStatus(rows);

  let submittedAt: Date | null;
  if (status === 'IN_PROGRESS') submittedAt = null;
  else if (submissionSource === 'ONLINE' && anchor.timerLog?.submittedAt) submittedAt = new Date(anchor.timerLog.submittedAt);
  else if (scored.length > 0) submittedAt = earliest(scored);
  else submittedAt = earliest(rows);

  return {
    tournamentId,
    playerId,
    submissionSource,
    status,
    authWord: anchor.authWord,
    twitchVodUrl: anchor.twitchVodUrl,
    submittedTwitchId: anchor.submittedTwitchId,
    submittedTwitchUsername: anchor.submittedTwitchUsername,
    identityStatus: anchor.identityStatus,
    timerLog: anchor.timerLog,
    judgeNotes: anchor.judgeNotes,
    playerNotes: anchor.playerNotes,
    verifiedBy: anchor.verifiedBy,
    verifiedAt: anchor.verifiedAt,
    resumeToken: anchorIsPlaceholder ? anchor.resumeToken : null,
    draft: anchorIsPlaceholder ? anchor.draft : null,
    createdAt: earliest(rows),
    submittedAt,
  };
}

/**
 * Lazy backfill: gives every score row without a run_id a qualifier_runs row (one per player),
 * deleting legacy IN_PROGRESS / NOT_STARTED placeholder rows. Idempotent; one select when there is
 * nothing to do. This is the only code that reads a score row's legacy qual-detail columns.
 */
export async function attachOrphanScoresToRuns(tournamentId: string): Promise<void> {
  const db = getDb();
  const orphans = (await db
    .select()
    .from(qualifierSubmissions)
    .where(and(eq(qualifierSubmissions.tournamentId, tournamentId), isNull(qualifierSubmissions.runId)))) as LegacySubmissionRow[];
  if (orphans.length === 0) return;

  const groups = new Map<string, LegacySubmissionRow[]>();
  for (const row of orphans) {
    const list = groups.get(row.playerId) || [];
    list.push(row);
    groups.set(row.playerId, list);
  }

  for (const [playerId, rows] of groups) {
    let run = await getRunForPlayer(tournamentId, playerId);
    if (!run) {
      try {
        const [created] = await db.insert(qualifierRuns).values(buildLegacyRun(tournamentId, playerId, rows)).returning();
        run = created as QualRunRow;
      } catch (err) {
        if (!isRunPlayerConflict(err)) throw err;
        run = await getRunForPlayer(tournamentId, playerId);
        if (!run) throw err;
      }
    }

    for (const row of rows) {
      if (isPlaceholderRow(row)) {
        await db.delete(qualifierSubmissions).where(eq(qualifierSubmissions.id, row.id));
      } else {
        await db.update(qualifierSubmissions).set({ runId: run.id }).where(eq(qualifierSubmissions.id, row.id));
      }
    }
  }
}
