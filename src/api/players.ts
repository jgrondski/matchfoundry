import { players } from '../db/schema';
import { eq, sql } from 'drizzle-orm';
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

export async function deletePlayer(id: string): Promise<boolean> {
  const db = getDb();
  const res = await db.delete(players).where(eq(players.id, id)).returning();
  return res.length > 0;
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
