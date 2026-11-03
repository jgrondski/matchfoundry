import { eq, sql } from 'drizzle-orm';
import { getDb } from '../db';
import { bracketTiers, games, matches, tournaments } from '../db/schema';
import type { BracketMatch, BracketStructure } from '../features/bracket/types';
import type { MatchScoreRecord, Tournament } from '../features/tournament/types';
import { isUuid } from './tournaments';

/** Every match of a bracket by id: matchesById entries first, then rounds[].matches[]. */
export function collectBracketMatches(bracket: BracketStructure): Map<string, BracketMatch> {
  const matchMap = new Map<string, BracketMatch>();
  if (bracket.matchesById) {
    for (const [mId, m] of Object.entries(bracket.matchesById)) {
      matchMap.set(mId, m);
    }
  }
  if (bracket.rounds) {
    for (const r of bracket.rounds) {
      for (const m of r.matches || []) {
        matchMap.set(m.id, m);
      }
    }
  }
  return matchMap;
}

/** The matches row for one bracket match, with its result taken from scoreRec when present. */
export function buildMatchRow(
  m: BracketMatch,
  scoreRec: MatchScoreRecord | undefined,
  tierUuid: string,
  tierBestOf: number | undefined
) {
  const p1Id = m.player1?.player?.id && isUuid(m.player1.player.id) ? m.player1.player.id : null;
  const p2Id = m.player2?.player?.id && isUuid(m.player2.player.id) ? m.player2.player.id : null;

  let winId = (scoreRec?.winnerPlayerId && isUuid(scoreRec.winnerPlayerId))
    ? scoreRec.winnerPlayerId
    : ((m.winnerId && isUuid(m.winnerId)) ? m.winnerId : null);
  let losId = (scoreRec?.loserPlayerId && isUuid(scoreRec.loserPlayerId))
    ? scoreRec.loserPlayerId
    : ((m.loserId && isUuid(m.loserId)) ? m.loserId : null);

  if (winId && !losId && p1Id && p2Id) {
    losId = winId === p1Id ? p2Id : p1Id;
  }

  const bestOf = scoreRec?.bestOf || m.bestOf || tierBestOf || 3;
  const threshold = Math.ceil(bestOf / 2);
  const p1Wins = scoreRec?.player1Wins ?? 0;
  const p2Wins = scoreRec?.player2Wins ?? 0;
  const isForfeit = Boolean(
    scoreRec?.forfeitWinnerId || scoreRec?.notes?.toLowerCase().includes('forfeit')
  );
  const isComplete = Boolean(
    scoreRec?.isComplete ||
    (winId && (p1Wins >= threshold || p2Wins >= threshold || isForfeit))
  );

  return {
    id: m.id,
    tierId: tierUuid,
    roundNumber: m.roundNumber || 1,
    matchNumber: m.matchNumber || null,
    stage: m.stage || null,
    roundIdentifier: m.roundIdentifier || null,
    player1Id: p1Id,
    player2Id: p2Id,
    winnerId: winId,
    loserId: losId,
    bestOf,
    isForfeit,
    isComplete,
    metadata: {
      nextMatchId: m.nextMatchId,
      nextMatchSlot: m.nextMatchSlot,
      loserNextMatchId: m.loserNextMatchId,
      loserNextMatchSlot: m.loserNextMatchSlot,
      slotA: m.slotA,
      slotB: m.slotB,
      player1SourceMatchId: m.player1?.sourceMatchId,
      player2SourceMatchId: m.player2?.sourceMatchId,
      isBye: m.isBye,
    },
  };
}

/** The games rows for one bracket match (empty when scoreRec has no games). */
export function buildGameRows(m: BracketMatch, scoreRec: MatchScoreRecord | undefined) {
  const p1Id = m.player1?.player?.id && isUuid(m.player1.player.id) ? m.player1.player.id : null;
  const p2Id = m.player2?.player?.id && isUuid(m.player2.player.id) ? m.player2.player.id : null;
  const rows: Array<any> = [];
  if (scoreRec?.games && scoreRec.games.length > 0) {
    for (const g of scoreRec.games) {
      if (g.player1Points !== null || g.player2Points !== null || g.winnerPlayerId !== null) {
        const gWinId = g.winnerPlayerId && isUuid(g.winnerPlayerId) ? g.winnerPlayerId : null;
        let gLosId: string | null = null;
        if (gWinId && p1Id && p2Id) {
          gLosId = gWinId === p1Id ? p2Id : p1Id;
        }
        rows.push({
          id: crypto.randomUUID(),
          matchId: m.id,
          gameNumber: g.gameNumber,
          player1Score: g.player1Points ?? 0,
          player2Score: g.player2Points ?? 0,
          winnerId: gWinId,
          loserId: gLosId,
          isIntentionalTopout: false,
        });
      }
    }
  }
  return rows;
}

/**
 * Persists one match's result. Must run inside the tournament write lock (ER.3).
 * Writes: the tier's bracket JSON, every match row of that tier (upsert, so slot changes from
 * advancing or retracting a winner land), the games of `matchId` only, and the tournament's
 * matchScores entry for `matchId`. Nothing is deleted except that match's old games.
 */
export async function saveMatchResult(input: {
  tournament: Tournament; // loaded inside the lock, with input.matchId's record already replaced
  tierId: string;
  matchId: string;
  record: MatchScoreRecord;
  bracket: BracketStructure; // the tier's bracket after advance/retract
}): Promise<void> {
  const db = getDb();
  const { tierId, matchId } = input;

  const [tierRow] = await db
    .select({ metadata: bracketTiers.metadata, tournamentId: bracketTiers.tournamentId })
    .from(bracketTiers)
    .where(eq(bracketTiers.id, tierId))
    .limit(1);
  if (!tierRow || tierRow.tournamentId !== input.tournament.id) throw new Error('Tier not found');

  const existingMetadata = (tierRow.metadata as Record<string, unknown> | null) || {};
  await db
    .update(bracketTiers)
    .set({ metadata: { ...existingMetadata, bracket: input.bracket } })
    .where(eq(bracketTiers.id, tierId));

  const tier = input.tournament.tiers.find(t => t.id === tierId);
  const bracketMatches = collectBracketMatches(input.bracket);
  const rows = [...bracketMatches.values()].map(m =>
    buildMatchRow(m, m.id === matchId ? input.record : input.tournament.matchScores[m.id], tierId, tier?.bestOf)
  );

  const CHUNK = 50;
  for (let i = 0; i < rows.length; i += CHUNK) {
    await db
      .insert(matches)
      .values(rows.slice(i, i + CHUNK))
      .onConflictDoUpdate({
        target: matches.id,
        set: {
          tierId: sql.raw('excluded.tier_id'),
          roundNumber: sql.raw('excluded.round_number'),
          matchNumber: sql.raw('excluded.match_number'),
          stage: sql.raw('excluded.stage'),
          roundIdentifier: sql.raw('excluded.round_identifier'),
          player1Id: sql.raw('excluded.player1_id'),
          player2Id: sql.raw('excluded.player2_id'),
          winnerId: sql.raw('excluded.winner_id'),
          loserId: sql.raw('excluded.loser_id'),
          bestOf: sql.raw('excluded.best_of'),
          isForfeit: sql.raw('excluded.is_forfeit'),
          isComplete: sql.raw('excluded.is_complete'),
          metadata: sql.raw('excluded.metadata'),
        },
      });
  }

  await db.delete(games).where(eq(games.matchId, matchId));
  const target = bracketMatches.get(matchId);
  const gameRows = target ? buildGameRows(target, input.record) : [];
  if (gameRows.length > 0) await db.insert(games).values(gameRows);

  const [tRow] = await db
    .select({ metadata: tournaments.metadata })
    .from(tournaments)
    .where(eq(tournaments.id, input.tournament.id))
    .limit(1);
  const meta = (tRow?.metadata as Record<string, any> | null) || {};
  await db
    .update(tournaments)
    .set({ metadata: { ...meta, matchScores: { ...(meta.matchScores || {}), [matchId]: input.record } } })
    .where(eq(tournaments.id, input.tournament.id));
}
