import { matches, games, tournaments, bracketTiers } from '../db/schema';
import { eq, inArray, or } from 'drizzle-orm';
import { getDb } from '../db';
import { assertValidScores } from '../utils/scores';

export interface MatchRecord {
  id: string;
  tierId: string;
  roundNumber: number;
  player1Id: string | null;
  player2Id: string | null;
  winnerId: string | null;
  loserId: string | null;
  bestOf: number;
  isForfeit: boolean;
  createdAt: Date;
}

export interface GameRecord {
  id: string;
  matchId: string;
  gameNumber: number;
  player1Score: number;
  player2Score: number;
  winnerId: string | null;
  loserId: string | null;
  isIntentionalTopout: boolean;
  createdAt: Date;
}

export async function createMatch(input: {
  id?: string;
  tierId: string;
  roundNumber: number;
  player1Id?: string | null;
  player2Id?: string | null;
  bestOf?: number;
}): Promise<MatchRecord> {
  const db = getDb();
  const [created] = await db
    .insert(matches)
    .values({
      id: input.id || crypto.randomUUID(),
      tierId: input.tierId,
      roundNumber: input.roundNumber,
      player1Id: input.player1Id || null,
      player2Id: input.player2Id || null,
      bestOf: input.bestOf || 3,
    })
    .returning();
  return created as MatchRecord;
}

export async function listMatchesByTier(tierId: string): Promise<MatchRecord[]> {
  const db = getDb();
  return (await db.select().from(matches).where(eq(matches.tierId, tierId))) as MatchRecord[];
}

export async function recordGameScore(input: {
  tournamentId: string;
  matchId: string;
  gameNumber: number;
  player1Score: number;
  player2Score: number;
  isIntentionalTopout?: boolean;
}): Promise<GameRecord> {
  const db = getDb();
  assertValidScores([input.player1Score, input.player2Score], 'Game score');

  // 1. Verify tournament verification status
  const isIdUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.tournamentId);
  const condition = isIdUuid
    ? or(eq(tournaments.id, input.tournamentId), eq(tournaments.slug, input.tournamentId))
    : eq(tournaments.slug, input.tournamentId);
  const t = await db.select().from(tournaments).where(condition).limit(1);
  if (t.length === 0) throw new Error('Tournament not found');

  if (!t[0].isVerified) {
    throw new Error('Cannot record match scores for an unverified bracket');
  }

  const m = await db.select().from(matches).where(eq(matches.id, input.matchId)).limit(1);
  if (m.length === 0) throw new Error('Match not found');

  const winnerId =
    input.player1Score > input.player2Score
      ? m[0].player1Id
      : input.player2Score > input.player1Score
      ? m[0].player2Id
      : null;
  const loserId =
    winnerId === m[0].player1Id
      ? m[0].player2Id
      : winnerId === m[0].player2Id
      ? m[0].player1Id
      : null;

  const [createdGame] = await db
    .insert(games)
    .values({
      matchId: input.matchId,
      gameNumber: input.gameNumber,
      player1Score: input.player1Score,
      player2Score: input.player2Score,
      winnerId,
      loserId,
      isIntentionalTopout: Boolean(input.isIntentionalTopout),
    })
    .returning();

  return createdGame as GameRecord;
}

export async function clearTournamentMatches(tournamentId: string): Promise<boolean> {
  const db = getDb();
  let resolvedTourneyId = tournamentId;
  const isIdUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tournamentId);
  if (!isIdUuid) {
    const [tourney] = await db
      .select({ id: tournaments.id })
      .from(tournaments)
      .where(eq(tournaments.slug, tournamentId))
      .limit(1);
    if (!tourney) return false;
    resolvedTourneyId = tourney.id;
  }
  const tiers = await db.select({ id: bracketTiers.id }).from(bracketTiers).where(eq(bracketTiers.tournamentId, resolvedTourneyId));
  if (tiers.length === 0) return false;
  const tierIds = tiers.map((t: { id: string }) => t.id);
  const res = await db.delete(matches).where(inArray(matches.tierId, tierIds)).returning();
  return res.length > 0;
}
