import { sql } from 'drizzle-orm';

if (typeof process.loadEnvFile === 'function' && !process.env.DATABASE_URL) {
  try {
    process.loadEnvFile();
  } catch {}
}

import { getDb } from '../src/db';

/**
 * One-off backfill: judge DQ rulings used to be written to the global players.is_disqualified flag.
 * DQ is now tournament-scoped (tournament_players.is_disqualified). This copies existing rulings to
 * the tournaments where the player actually has DQ submissions, then reports any globally flagged
 * players it could not attribute to a tournament. The global flag is left untouched (no longer read).
 *
 * Run after `npm run db:push`:  npx tsx scripts/backfillTournamentDq.ts
 */
export async function backfillTournamentDq() {
  const db = getDb();

  const backfilled = await db.execute(sql`
    UPDATE tournament_players tp
    SET is_disqualified = true
    WHERE tp.is_disqualified = false
      AND EXISTS (
        SELECT 1 FROM qualifier_submissions qs
        WHERE qs.tournament_id = tp.tournament_id
          AND qs.player_id = tp.player_id
          AND qs.status = 'DQ'
      )
    RETURNING tp.tournament_id, tp.player_id
  `);
  const backfilledRows = (backfilled as any).rows ?? backfilled;
  console.log(`✅ Flagged ${backfilledRows.length} tournament competitor(s) with existing DQ submissions.`);

  const unattributed = await db.execute(sql`
    SELECT p.id, p.name
    FROM players p
    WHERE p.is_disqualified = true
      AND NOT EXISTS (
        SELECT 1 FROM qualifier_submissions qs
        WHERE qs.player_id = p.id AND qs.status = 'DQ'
      )
  `);
  const unattributedRows = (unattributed as any).rows ?? unattributed;
  if (unattributedRows.length > 0) {
    console.log(
      `⚠️  ${unattributedRows.length} player(s) have the legacy global DQ flag but no DQ submissions ` +
        `(likely set via the player edit modal). Re-apply their DQ per tournament if still intended:`
    );
    for (const row of unattributedRows) {
      console.log(`   - ${row.name} (${row.id})`);
    }
  }
}

// Execute if run directly
const isDirectExecution = process.argv[1]?.replace(/\\/g, '/').endsWith('scripts/backfillTournamentDq.ts');
if (isDirectExecution) {
  backfillTournamentDq()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('❌ Failed to backfill tournament DQ flags:', err);
      process.exit(1);
    });
}
