import { players, tournamentPlayers, qualifierSubmissions, matches, tournaments } from '../db/schema';
import { eq, sql, or, inArray, isNotNull } from 'drizzle-orm';
import { getDb } from '../db';

export interface PlayerRecord {
  id: string;
  name: string;
  displayName: string | null;
  nickname: string | null;
  twitchUsername: string | null;
  twitchId: string | null;
  country: string | null;
  avatarType: 'flag' | 'custom';
  avatarUrl: string | null;
  avatarThumbnailUrl: string | null;
  personalBest: number;
  playstyle: string | null;
  notes: string | null;
  isDisqualified: boolean;
  createdAt: Date;
}

export async function createPlayer(data: {
  name: string;
  displayName?: string;
  nickname?: string;
  twitchUsername?: string;
  twitchId?: string;
  country?: string;
  avatarType?: 'flag' | 'custom';
  avatarUrl?: string;
  avatarThumbnailUrl?: string;
  personalBest?: number;
  playstyle?: string;
  notes?: string;
}): Promise<PlayerRecord> {
  const trimmed = data.name.trim();
  if (!trimmed) throw new Error('Player name is required');
  const lower = trimmed.toLowerCase();

  const db = getDb();
  const existing = await db
    .select()
    .from(players)
    .where(sql`lower(trim(${players.name})) = ${lower}`)
    .limit(1);
  if (existing.length > 0) {
    throw new Error(`Player with name "${trimmed}" already exists`);
  }

  const cleanTwitch = data.twitchUsername ? data.twitchUsername.trim().replace(/^@/, '') : null;
  const cleanTwitchId = data.twitchId ? data.twitchId.trim() : null;

  const [created] = await db
    .insert(players)
    .values({
      name: trimmed,
      displayName: data.displayName?.trim() || null,
      nickname: data.nickname?.trim() || null,
      twitchUsername: cleanTwitch || null,
      twitchId: cleanTwitchId || null,
      country: data.country || null,
      avatarType: data.avatarType || 'flag',
      avatarUrl: data.avatarUrl || null,
      avatarThumbnailUrl: data.avatarThumbnailUrl || null,
      personalBest: data.personalBest ?? 0,
      playstyle: data.playstyle || null,
      notes: data.notes || null,
    })
    .returning();
  return created as PlayerRecord;
}

export async function createPlayersBatch(records: Array<{
  name: string;
  displayName?: string;
  nickname?: string;
  twitchUsername?: string;
  twitchId?: string;
  country?: string;
  avatarType?: 'flag' | 'custom';
  avatarUrl?: string;
  avatarThumbnailUrl?: string;
  personalBest?: number;
  playstyle?: string;
  notes?: string;
}>): Promise<PlayerRecord[]> {
  const db = getDb();
  if (records.length === 0) return [];
  const inserted = await db
    .insert(players)
    .values(records.map(r => ({
      name: r.name.trim(),
      displayName: r.displayName?.trim() || null,
      nickname: r.nickname?.trim() || null,
      twitchUsername: r.twitchUsername ? r.twitchUsername.trim().replace(/^@/, '') : null,
      twitchId: r.twitchId ? r.twitchId.trim() : null,
      country: r.country || null,
      avatarType: r.avatarType || 'flag',
      avatarUrl: r.avatarUrl || null,
      avatarThumbnailUrl: r.avatarThumbnailUrl || null,
      personalBest: r.personalBest ?? 0,
      playstyle: r.playstyle || null,
      notes: r.notes || null,
    })))
    .onConflictDoNothing()
    .returning();
  return inserted as PlayerRecord[];
}

export async function listPlayers(): Promise<PlayerRecord[]> {
  const db = getDb();
  return (await db.select().from(players)) as PlayerRecord[];
}

export async function getPlayer(id: string): Promise<PlayerRecord | null> {
  const db = getDb();
  const res = await db.select().from(players).where(eq(players.id, id)).limit(1);
  return (res[0] as PlayerRecord) || null;
}

export async function getPlayerByTwitchId(twitchId: string): Promise<PlayerRecord | null> {
  const trimmed = twitchId.trim();
  if (!trimmed) return null;
  const db = getDb();
  const res = await db.select().from(players).where(eq(players.twitchId, trimmed)).limit(1);
  return (res[0] as PlayerRecord) || null;
}

export async function updatePlayer(
  id: string,
  updates: Partial<Omit<PlayerRecord, 'id' | 'createdAt'>>
): Promise<PlayerRecord | null> {
  const db = getDb();
  const sanitized = { ...updates };
  if (typeof sanitized.twitchUsername === 'string') {
    sanitized.twitchUsername = sanitized.twitchUsername.trim().replace(/^@/, '') || null;
  }
  if (typeof sanitized.twitchId === 'string') {
    sanitized.twitchId = sanitized.twitchId.trim() || null;
  }
  const [updated] = await db
    .update(players)
    .set(sanitized)
    .where(eq(players.id, id))
    .returning();
  return (updated as PlayerRecord) || null;
}

export async function deletePlayer(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const db = getDb();

  // Find tournament enrollments
  const enrolled = await db
    .select({
      tournamentName: tournaments.name,
    })
    .from(tournamentPlayers)
    .innerJoin(tournaments, eq(tournamentPlayers.tournamentId, tournaments.id))
    .where(eq(tournamentPlayers.playerId, id));

  // Find qualifier submissions
  const quals = await db
    .select({
      tournamentName: tournaments.name,
    })
    .from(qualifierSubmissions)
    .innerJoin(tournaments, eq(qualifierSubmissions.tournamentId, tournaments.id))
    .where(eq(qualifierSubmissions.playerId, id));

  // Find matches
  const matchRows = await db
    .select({ id: matches.id })
    .from(matches)
    .where(
      or(
        eq(matches.player1Id, id),
        eq(matches.player2Id, id),
        eq(matches.winnerId, id),
        eq(matches.loserId, id)
      )
    )
    .limit(1);

  const tourneyNames = Array.from(
    new Set([...enrolled, ...quals].map(r => r.tournamentName).filter(Boolean))
  );

  if (tourneyNames.length > 0 || matchRows.length > 0) {
    const detail =
      tourneyNames.length > 0
        ? `enrolled in: ${tourneyNames.join(', ')}`
        : 'recorded in tournament matches';
    return {
      success: false,
      error: `Cannot delete competitor because they are ${detail}. Remove them from tournament rosters first.`,
    };
  }

  const res = await db.delete(players).where(eq(players.id, id)).returning();
  if (res.length === 0) {
    return { success: false, error: 'Player not found' };
  }
  return { success: true };
}

export async function deleteAllUnattachedPlayers(): Promise<{
  deletedIds: string[];
  skippedCount: number;
}> {
  const db = getDb();
  const [tp, qs, m1, m2, mw, ml, allPlayers] = await Promise.all([
    db.select({ playerId: tournamentPlayers.playerId }).from(tournamentPlayers),
    db.select({ playerId: qualifierSubmissions.playerId }).from(qualifierSubmissions),
    db.select({ playerId: matches.player1Id }).from(matches).where(isNotNull(matches.player1Id)),
    db.select({ playerId: matches.player2Id }).from(matches).where(isNotNull(matches.player2Id)),
    db.select({ playerId: matches.winnerId }).from(matches).where(isNotNull(matches.winnerId)),
    db.select({ playerId: matches.loserId }).from(matches).where(isNotNull(matches.loserId)),
    db.select({ id: players.id }).from(players),
  ]);

  const attachedSet = new Set<string>();
  tp.forEach((r: { playerId: string | null }) => r.playerId && attachedSet.add(r.playerId));
  qs.forEach((r: { playerId: string | null }) => r.playerId && attachedSet.add(r.playerId));
  m1.forEach((r: { playerId: string | null }) => r.playerId && attachedSet.add(r.playerId));
  m2.forEach((r: { playerId: string | null }) => r.playerId && attachedSet.add(r.playerId));
  mw.forEach((r: { playerId: string | null }) => r.playerId && attachedSet.add(r.playerId));
  ml.forEach((r: { playerId: string | null }) => r.playerId && attachedSet.add(r.playerId));

  const toDelete = allPlayers.filter((p: { id: string }) => !attachedSet.has(p.id)).map((p: { id: string }) => p.id);

  if (toDelete.length === 0) {
    return { deletedIds: [], skippedCount: allPlayers.length };
  }

  await db.delete(players).where(inArray(players.id, toDelete));

  return {
    deletedIds: toDelete,
    skippedCount: allPlayers.length - toDelete.length,
  };
}

export interface CareerStats {
  playerId: string;
  matchesPlayed: number;
  matchesWon: number;
  matchesLost: number;
  matchWinRate: number;
  gamesPlayed: number;
  gamesWon: number;
  gamesLost: number;
  gameWinRate: number;
  averageScore: number;
  highestScore: number;
}

export async function getPlayerCareerStats(
  playerId: string,
  seededMatches?: Array<{
    player1Id: string | null;
    player2Id: string | null;
    winnerId: string | null;
    games: Array<{ player1Score: number; player2Score: number; winnerId: string | null }>;
  }>
): Promise<CareerStats> {
  let matchesPlayed = 0;
  let matchesWon = 0;
  let gamesPlayed = 0;
  let gamesWon = 0;
  let totalScore = 0;
  let highestScore = 0;

  if (seededMatches) {
    for (const m of seededMatches) {
      const isP1 = m.player1Id === playerId;
      const isP2 = m.player2Id === playerId;
      if (!isP1 && !isP2) continue;

      matchesPlayed++;
      if (m.winnerId === playerId) matchesWon++;

      for (const g of m.games) {
        gamesPlayed++;
        const myScore = isP1 ? g.player1Score : g.player2Score;
        totalScore += myScore;
        if (myScore > highestScore) highestScore = myScore;
        if (g.winnerId === playerId) gamesWon++;
      }
    }
  }

  const matchesLost = matchesPlayed - matchesWon;
  const gamesLost = gamesPlayed - gamesWon;

  return {
    playerId,
    matchesPlayed,
    matchesWon,
    matchesLost,
    matchWinRate: matchesPlayed > 0 ? Number((matchesWon / matchesPlayed).toFixed(4)) : 0,
    gamesPlayed,
    gamesWon,
    gamesLost,
    gameWinRate: gamesPlayed > 0 ? Number((gamesWon / gamesPlayed).toFixed(4)) : 0,
    averageScore: gamesPlayed > 0 ? Math.round(totalScore / gamesPlayed) : 0,
    highestScore,
  };
}
