import {
  qualifierSubmissions,
  tournaments,
  players,
  tournamentPlayers,
  matches,
  bracketTiers,
} from '../db/schema';
import { eq, and, or, desc, sql } from 'drizzle-orm';
import { getDb } from '../db';
import type {
  SubmissionSource,
  IdentityStatus,
  SubmissionStatus,
  QualTimerLog,
} from '../features/tournament/types';
import {
  generateNesAuthword,
  createInitialTimerLog,
  computeTimerTelemetry,
} from '../features/online-quals/authwordEngine';

export interface QualifierSubmissionRecord {
  id: string;
  tournamentId: string;
  playerId: string;
  score: number;
  submissionSource: SubmissionSource;
  authWord: string | null;
  twitchVodUrl: string | null;
  submittedTwitchId: string | null;
  submittedTwitchUsername: string | null;
  identityStatus: IdentityStatus | null;
  status: SubmissionStatus;
  timerLog: QualTimerLog | null;
  judgeNotes: string | null;
  verifiedBy: string | null;
  verifiedAt: Date | null;
  createdAt: Date;
}

export interface LeaderboardEntry {
  playerId: string;
  rank: number;
  totalScore: number;
  submissionCount: number;
  topScores: number[];
}

export interface OnlineQualSessionSummary {
  tournamentId: string;
  playerId: string;
  playerName?: string;
  status: SubmissionStatus;
  authWord: string;
  twitchVodUrl: string | null;
  submittedTwitchId: string | null;
  submittedTwitchUsername: string | null;
  identityStatus: IdentityStatus | null;
  timerLog: QualTimerLog;
  scores: number[];
  judgeNotes: string | null;
  submissionIds: string[];
}

function isUuid(val: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
}

async function resolveTournamentRow(tournamentIdOrSlug: string) {
  const db = getDb();
  if (!isUuid(tournamentIdOrSlug)) {
    const [tourney] = await db
      .select()
      .from(tournaments)
      .where(eq(tournaments.slug, tournamentIdOrSlug))
      .limit(1);
    if (!tourney) throw new Error('Tournament not found');
    return tourney;
  } else {
    const [tourney] = await db
      .select()
      .from(tournaments)
      .where(eq(tournaments.id, tournamentIdOrSlug))
      .limit(1);
    if (!tourney) throw new Error('Tournament not found');
    return tourney;
  }
}

export async function submitQualifierScore(
  tournamentId: string,
  playerId: string,
  score: number,
  options?: {
    submissionSource?: SubmissionSource;
    status?: SubmissionStatus;
    authWord?: string;
    twitchVodUrl?: string;
    submittedTwitchId?: string;
    submittedTwitchUsername?: string;
    identityStatus?: IdentityStatus;
    timerLog?: QualTimerLog;
    judgeNotes?: string;
  }
): Promise<QualifierSubmissionRecord> {
  if (score < 0) throw new Error('Score must be positive');

  const db = getDb();
  const tourney = await resolveTournamentRow(tournamentId);
  if (tourney.qualsClosed) throw new Error('Qualifiers are closed for this tournament');

  const submissionSource = options?.submissionSource || 'IN_PERSON';
  const status = options?.status || (submissionSource === 'IN_PERSON' ? 'VERIFIED' : 'SUBMITTED');

  const [created] = await db
    .insert(qualifierSubmissions)
    .values({
      tournamentId: tourney.id,
      playerId,
      score,
      submissionSource,
      status,
      authWord: options?.authWord || null,
      twitchVodUrl: options?.twitchVodUrl || null,
      submittedTwitchId: options?.submittedTwitchId || null,
      submittedTwitchUsername: options?.submittedTwitchUsername || null,
      identityStatus: options?.identityStatus || null,
      timerLog: options?.timerLog || null,
      judgeNotes: options?.judgeNotes || null,
    })
    .returning();
  return created as QualifierSubmissionRecord;
}

export async function submitQualifiersBatch(
  tournamentId: string,
  submissions: Array<{
    playerId: string;
    score: number;
    submissionSource?: SubmissionSource;
    status?: SubmissionStatus;
    authWord?: string;
    twitchVodUrl?: string;
    submittedTwitchId?: string;
    submittedTwitchUsername?: string;
    identityStatus?: IdentityStatus;
    timerLog?: QualTimerLog;
    judgeNotes?: string;
  }>
): Promise<QualifierSubmissionRecord[]> {
  const db = getDb();
  if (submissions.length === 0) return [];
  const tourney = await resolveTournamentRow(tournamentId);
  if (tourney.qualsClosed) throw new Error('Qualifiers are closed for this tournament');

  const inserted = await db
    .insert(qualifierSubmissions)
    .values(
      submissions.map(s => {
        const src = s.submissionSource || 'IN_PERSON';
        const st = s.status || (src === 'IN_PERSON' ? 'VERIFIED' : 'SUBMITTED');
        return {
          tournamentId: tourney.id,
          playerId: s.playerId,
          score: s.score,
          submissionSource: src,
          status: st,
          authWord: s.authWord || null,
          twitchVodUrl: s.twitchVodUrl || null,
          submittedTwitchId: s.submittedTwitchId || null,
          submittedTwitchUsername: s.submittedTwitchUsername || null,
          identityStatus: s.identityStatus || null,
          timerLog: s.timerLog || null,
          judgeNotes: s.judgeNotes || null,
        };
      })
    )
    .returning();
  return inserted as QualifierSubmissionRecord[];
}

export async function clearTournamentQualifiers(tournamentId: string): Promise<boolean> {
  const db = getDb();
  let resolvedTourneyId = tournamentId;
  if (!isUuid(tournamentId)) {
    const [tourney] = await db
      .select({ id: tournaments.id })
      .from(tournaments)
      .where(eq(tournaments.slug, tournamentId))
      .limit(1);
    if (!tourney) return false;
    resolvedTourneyId = tourney.id;
  }
  const res = await db
    .delete(qualifierSubmissions)
    .where(eq(qualifierSubmissions.tournamentId, resolvedTourneyId))
    .returning();
  await db
    .update(tournamentPlayers)
    .set({ qualsCompleted: false })
    .where(eq(tournamentPlayers.tournamentId, resolvedTourneyId));
  return res.length > 0;
}

export async function getQualifierLeaderboard(tournamentId: string): Promise<LeaderboardEntry[]> {
  const db = getDb();
  let tRow: any = null;
  try {
    tRow = await resolveTournamentRow(tournamentId);
  } catch {
    return [];
  }
  const resolvedTourneyId = tRow.id;
  const tourneyQualFormat = tRow.qualFormat;
  const qualAvgCount = tRow.qualAverageCount || 2;
  const pointsConfig = tRow.pointsConfig || [];

  const allSubmissions = (await db
    .select()
    .from(qualifierSubmissions)
    .where(eq(qualifierSubmissions.tournamentId, resolvedTourneyId))
    .orderBy(desc(qualifierSubmissions.score))) as QualifierSubmissionRecord[];

  // Group by player, excluding IN_PROGRESS / NOT_STARTED placeholder rows
  const playerScores = new Map<string, number[]>();
  for (const s of allSubmissions) {
    if (s.status === 'IN_PROGRESS' || s.status === 'NOT_STARTED') continue;
    const list = playerScores.get(s.playerId) || [];
    list.push(s.score);
    playerScores.set(s.playerId, list);
  }

  const entries: Array<Omit<LeaderboardEntry, 'rank'>> = [];

  for (const [playerId, scores] of playerScores.entries()) {
    scores.sort((a, b) => b - a);

    let totalScore = 0;
    if (tourneyQualFormat === 'HIGH_SCORE') {
      totalScore = scores[0] || 0;
    } else if (tourneyQualFormat === 'AVERAGE_OF_X') {
      const topX = scores.slice(0, qualAvgCount);
      const sum = topX.reduce((acc, curr) => acc + curr, 0);
      totalScore = topX.length > 0 ? Math.round(sum / topX.length) : 0;
    } else if (tourneyQualFormat === 'POINTS') {
      for (const sc of scores) {
        let pts = 0;
        for (const cfg of pointsConfig) {
          if (sc >= cfg.minScore) {
            pts = Math.max(pts, cfg.points);
          }
        }
        totalScore += pts;
      }
    }

    entries.push({
      playerId,
      totalScore,
      submissionCount: scores.length,
      topScores: scores,
    });
  }

  entries.sort((a, b) => b.totalScore - a.totalScore);

  return entries.map((entry, index) => ({
    ...entry,
    rank: index + 1,
  }));
}

/**
 * Ensures a player is registered in tournament_players for a tournament.
 */
async function ensureTournamentPlayerRegistration(tournamentId: string, playerId: string) {
  const db = getDb();
  const existing = await db
    .select()
    .from(tournamentPlayers)
    .where(
      and(
        eq(tournamentPlayers.tournamentId, tournamentId),
        eq(tournamentPlayers.playerId, playerId)
      )
    )
    .limit(1);

  if (existing.length === 0) {
    await db.insert(tournamentPlayers).values({
      tournamentId,
      playerId,
      qualsCompleted: false,
    });
  }
}

/**
 * Track 10B: Resolves a Twitch OAuth user against the global players table (Bucket 1: VERIFIED_MATCH).
 */
export async function resolveTwitchIdentity(
  tournamentIdOrSlug: string,
  twitchUser: {
    twitchId: string;
    twitchUsername: string;
    displayName?: string;
    avatarUrl?: string;
  }
) {
  const db = getDb();
  const tourney = await resolveTournamentRow(tournamentIdOrSlug);
  const cleanTwitchId = twitchUser.twitchId.trim();

  const [matchedPlayer] = await db
    .select()
    .from(players)
    .where(eq(players.twitchId, cleanTwitchId))
    .limit(1);

  if (matchedPlayer) {
    await ensureTournamentPlayerRegistration(tourney.id, matchedPlayer.id);
    return {
      identityStatus: 'VERIFIED_MATCH' as IdentityStatus,
      player: matchedPlayer,
    };
  }

  return {
    identityStatus: null,
    player: null,
  };
}

/**
 * Track 10B: Handles Bucket 2 (CLAIM_ROSTER -> CLAIMED_PENDING_REVIEW)
 * and Bucket 3 (NEW_PLAYER -> PROVISIONAL_NEW).
 */
export async function claimOrRegisterOnlineCompetitor(
  tournamentIdOrSlug: string,
  input: {
    twitchId: string;
    twitchUsername: string;
    avatarUrl?: string;
    mode: 'CLAIM_ROSTER' | 'NEW_PLAYER';
    playerId?: string;
    newPlayer?: {
      name: string;
      country?: string;
      playstyle?: string;
    };
  }
) {
  const db = getDb();
  const tourney = await resolveTournamentRow(tournamentIdOrSlug);
  const cleanUsername = input.twitchUsername.trim().replace(/^@/, '');

  if (input.mode === 'CLAIM_ROSTER') {
    if (!input.playerId) {
      throw new Error('playerId is required when claiming a roster profile');
    }
    const [existingPlayer] = await db
      .select()
      .from(players)
      .where(eq(players.id, input.playerId))
      .limit(1);

    if (!existingPlayer) {
      throw new Error('Selected player not found');
    }

    await ensureTournamentPlayerRegistration(tourney.id, existingPlayer.id);
    return {
      identityStatus: 'CLAIMED_PENDING_REVIEW' as IdentityStatus,
      player: existingPlayer,
    };
  }

  // Bucket 3: NEW_PLAYER -> PROVISIONAL_NEW
  const trimmedName = (input.newPlayer?.name || cleanUsername).trim();
  if (!trimmedName) {
    throw new Error('Competitor alias is required');
  }
  const lowerName = trimmedName.toLowerCase();

  let [playerRow] = await db
    .select()
    .from(players)
    .where(sql`lower(trim(${players.name})) = ${lowerName}`)
    .limit(1);

  if (!playerRow) {
    const [created] = await db
      .insert(players)
      .values({
        name: trimmedName,
        twitchUsername: cleanUsername || null,
        country: input.newPlayer?.country ? input.newPlayer.country.toUpperCase() : 'US',
        playstyle: input.newPlayer?.playstyle || 'DAS',
        avatarType: input.avatarUrl ? 'custom' : 'flag',
        avatarUrl: input.avatarUrl || null,
        personalBest: 0,
      })
      .returning();
    playerRow = created;
  }

  await ensureTournamentPlayerRegistration(tourney.id, playerRow.id);
  return {
    identityStatus: 'PROVISIONAL_NEW' as IdentityStatus,
    player: playerRow,
  };
}

/**
 * Recovers an active or completed online qualifier session for a competitor (Assertion 1.5).
 */
export async function getOnlineQualSession(
  tournamentIdOrSlug: string,
  query: { playerId?: string; twitchId?: string }
): Promise<OnlineQualSessionSummary | null> {
  const db = getDb();
  const tourney = await resolveTournamentRow(tournamentIdOrSlug);

  const allSubs = (await db
    .select()
    .from(qualifierSubmissions)
    .where(eq(qualifierSubmissions.tournamentId, tourney.id))) as QualifierSubmissionRecord[];

  const onlineSubs = allSubs.filter(s => {
    if (s.submissionSource !== 'ONLINE') return false;
    if (query.playerId && s.playerId === query.playerId) return true;
    if (query.twitchId && s.submittedTwitchId === query.twitchId) return true;
    return false;
  });

  if (onlineSubs.length === 0) return null;

  const first = onlineSubs[0];
  const scoredRows = onlineSubs.filter(
    s => s.status !== 'IN_PROGRESS' && s.status !== 'NOT_STARTED'
  );

  const [player] = await db
    .select({ name: players.name })
    .from(players)
    .where(eq(players.id, first.playerId))
    .limit(1);

  return {
    tournamentId: tourney.id,
    playerId: first.playerId,
    playerName: player?.name,
    status: first.status,
    authWord: first.authWord || 'ROCKET',
    twitchVodUrl: first.twitchVodUrl || null,
    submittedTwitchId: first.submittedTwitchId || null,
    submittedTwitchUsername: first.submittedTwitchUsername || null,
    identityStatus: first.identityStatus || null,
    timerLog: first.timerLog || createInitialTimerLog(first.createdAt.getTime()),
    scores: scoredRows.map(s => s.score),
    judgeNotes: first.judgeNotes || null,
    submissionIds: onlineSubs.map(s => s.id),
  };
}

export interface ReviewQueueSessionSummary extends OnlineQualSessionSummary {
  playerName: string;
  country?: string;
  avatarUrl?: string;
  avatarType?: string;
}

/**
 * Lists all online qualifier sessions for a tournament, grouped by player (Track 10E).
 */
export async function listOnlineQualSessions(
  tournamentIdOrSlug: string
): Promise<ReviewQueueSessionSummary[]> {
  const db = getDb();
  const tourney = await resolveTournamentRow(tournamentIdOrSlug);

  const allSubs = (await db
    .select()
    .from(qualifierSubmissions)
    .where(eq(qualifierSubmissions.tournamentId, tourney.id))
    .orderBy(desc(qualifierSubmissions.createdAt))) as QualifierSubmissionRecord[];

  const onlineSubs = allSubs.filter(s => s.submissionSource === 'ONLINE');
  if (onlineSubs.length === 0) return [];

  // Group by playerId preserving order
  const playerGroups = new Map<string, QualifierSubmissionRecord[]>();
  for (const s of onlineSubs) {
    const list = playerGroups.get(s.playerId) || [];
    list.push(s);
    playerGroups.set(s.playerId, list);
  }

  const allPlayers = (await db.select().from(players)) as Array<typeof players.$inferSelect>;
  const playerMap = new Map<string, typeof players.$inferSelect>(
    allPlayers.map(p => [p.id, p])
  );

  const result: ReviewQueueSessionSummary[] = [];

  for (const [playerId, subs] of playerGroups.entries()) {
    const first = subs[0];
    const scoredRows = subs.filter(
      s => s.status !== 'IN_PROGRESS' && s.status !== 'NOT_STARTED'
    );
    const p = playerMap.get(playerId);

    result.push({
      tournamentId: tourney.id,
      playerId,
      playerName: p?.name || first.submittedTwitchUsername || 'Unknown Player',
      country: p?.country || 'US',
      avatarUrl: p?.avatarUrl || undefined,
      avatarType: p?.avatarType || 'flag',
      status: first.status,
      authWord: first.authWord || 'ROCKET',
      twitchVodUrl: first.twitchVodUrl || null,
      submittedTwitchId: first.submittedTwitchId || null,
      submittedTwitchUsername: first.submittedTwitchUsername || null,
      identityStatus: first.identityStatus || null,
      timerLog: first.timerLog || createInitialTimerLog(first.createdAt.getTime()),
      scores: scoredRows.map(s => s.score),
      judgeNotes: first.judgeNotes || null,
      submissionIds: subs.map(s => s.id),
    });
  }

  return result;
}

/**
 * Track 10F: Dispatches automated Discord webhook notifications for online qualifier events.
 * Non-blocking and failsafe (never throws on webhook failures).
 */
export async function dispatchDiscordWebhook(
  tournamentIdOrSlug: string,
  event: 'START' | 'SUBMIT' | 'VERIFIED',
  data: {
    playerName: string;
    twitchUsername?: string;
    authWord?: string;
    twitchVodUrl?: string;
    score?: number | string;
    judgeName?: string;
  }
): Promise<boolean> {
  try {
    const tourney = await resolveTournamentRow(tournamentIdOrSlug);
    const meta = (tourney.metadata as Record<string, any>) || {};
    const webhookUrl = tourney.discordWebhookUrl || meta.discordWebhookUrl;
    if (!webhookUrl || typeof webhookUrl !== 'string' || !webhookUrl.startsWith('http')) {
      return false;
    }

    let messageContent = '';
    const tourneyName = tourney.name || 'Tournament';
    const twitchUrl = data.twitchUsername ? `https://twitch.tv/${data.twitchUsername}` : '';

    if (event === 'START') {
      messageContent = `🎮 **${data.playerName}** started an official qual for **${tourneyName}**!${
        twitchUrl ? ` Watch live: ${twitchUrl}` : ''
      }${data.authWord ? ` (Authword: \`${data.authWord}\`)` : ''}`;
    } else if (event === 'SUBMIT') {
      messageContent = `🏆 **${data.playerName}** submitted qual: **${
        data.score ?? 'Scores recorded'
      }**!${data.twitchVodUrl ? ` VOD: ${data.twitchVodUrl}` : ''}`;
    } else if (event === 'VERIFIED') {
      messageContent = `✓ **${data.playerName}**'s qualification has been verified by judge${
        data.judgeName ? ` (${data.judgeName})` : ''
      }: **${data.score ?? 'Approved'}**`;
    }

    if (typeof fetch !== 'undefined') {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: messageContent }),
      }).catch(() => {});
      return true;
    }
  } catch {
    // Fail silently
  }
  return false;
}

/**
 * Starts an online qualifier session, issuing an immutable 6-8 char NES Authword
 * and starting the non-blocking countdown timer (Track 10C).
 * Idempotent if a session is already active or submitted for this player.
 */
export async function startOnlineQualSession(
  tournamentIdOrSlug: string,
  input: {
    playerId?: string;
    playerName?: string;
    twitchUsername?: string;
    submittedTwitchId?: string;
    submittedTwitchUsername?: string;
    identityStatus?: IdentityStatus;
    nowMs?: number;
  }
): Promise<OnlineQualSessionSummary> {
  const db = getDb();
  const tourney = await resolveTournamentRow(tournamentIdOrSlug);
  const meta = (tourney.metadata as Record<string, any>) || {};

  if (tourney.qualsClosed || meta.isLocked) {
    throw new Error('Qualifiers are closed for this tournament');
  }

  let targetPlayerId = input.playerId;
  let targetPlayerName = input.playerName;
  let wasCreatedAsWalkIn = false;
  let matchedPlayerRow: typeof players.$inferSelect | null = null;

  if (!targetPlayerId) {
    const rawName = (input.playerName || input.submittedTwitchUsername || input.twitchUsername || '').trim();
    if (!rawName) {
      throw new Error('Player name or ID is required to start qualification');
    }
    const cleanTwitch = (input.twitchUsername || input.submittedTwitchUsername || '')
      .trim()
      .replace(/^@/, '')
      .replace(/^https?:\/\/(www\.)?twitch\.tv\//i, '');
    const lowerName = rawName.toLowerCase();

    const [existingByName] = await db
      .select()
      .from(players)
      .where(sql`lower(trim(${players.name})) = ${lowerName}`)
      .limit(1);

    let playerRow = existingByName;
    if (!playerRow && cleanTwitch) {
      const [byTwitch] = await db
        .select()
        .from(players)
        .where(sql`lower(trim(${players.twitchUsername})) = ${cleanTwitch.toLowerCase()}`)
        .limit(1);
      if (byTwitch) playerRow = byTwitch;
    }

    if (!playerRow) {
      const [created] = await db
        .insert(players)
        .values({
          name: rawName,
          twitchUsername: cleanTwitch || null,
          country: 'US',
          playstyle: 'DAS',
          avatarType: 'flag',
          personalBest: 0,
        })
        .returning();
      playerRow = created;
      wasCreatedAsWalkIn = true;
    }

    matchedPlayerRow = playerRow;
    targetPlayerId = playerRow.id;
    targetPlayerName = playerRow.name;
  } else {
    const [existingPlayer] = await db
      .select()
      .from(players)
      .where(eq(players.id, targetPlayerId))
      .limit(1);
    matchedPlayerRow = existingPlayer || null;
    if (!targetPlayerName && matchedPlayerRow) {
      targetPlayerName = matchedPlayerRow.name;
    }
  }

  if (!targetPlayerId) {
    throw new Error('Failed to resolve competitor profile');
  }

  let resolvedIdentityStatus: IdentityStatus = 'CLAIMED_PENDING_REVIEW';
  if (input.identityStatus) {
    resolvedIdentityStatus = input.identityStatus;
  } else if (wasCreatedAsWalkIn) {
    resolvedIdentityStatus = 'PROVISIONAL_NEW';
  } else if (
    input.submittedTwitchId &&
    matchedPlayerRow?.twitchId &&
    input.submittedTwitchId === matchedPlayerRow.twitchId
  ) {
    resolvedIdentityStatus = 'VERIFIED_MATCH';
  } else {
    resolvedIdentityStatus = 'CLAIMED_PENDING_REVIEW';
  }

  await ensureTournamentPlayerRegistration(tourney.id, targetPlayerId);

  // Check if session already exists (idempotent recovery for page reloads - Assertion 1.5)
  const existingSession = await getOnlineQualSession(tourney.id, {
    playerId: targetPlayerId,
  });
  if (existingSession) {
    return {
      ...existingSession,
      playerName: targetPlayerName || existingSession.playerName,
    };
  }

  // Gather already-used auth words in this tournament to avoid collisions
  const allTourneySubs = (await db
    .select()
    .from(qualifierSubmissions)
    .where(eq(qualifierSubmissions.tournamentId, tourney.id))) as QualifierSubmissionRecord[];
  const usedWords = allTourneySubs
    .map(s => s.authWord)
    .filter((w): w is string => Boolean(w));

  const customWords =
    (tourney.customAuthWords as string[] | null) ||
    (meta.customAuthWords as string[] | undefined) ||
    [];
  const authWord = generateNesAuthword(customWords, usedWords);
  const timerLog = createInitialTimerLog(input.nowMs ?? Date.now());

  const cleanTwitchUser = (input.submittedTwitchUsername || input.twitchUsername || '')
    .trim()
    .replace(/^@/, '')
    .replace(/^https?:\/\/(www\.)?twitch\.tv\//i, '') || null;

  const [inserted] = await db
    .insert(qualifierSubmissions)
    .values({
      tournamentId: tourney.id,
      playerId: targetPlayerId,
      score: 0,
      submissionSource: 'ONLINE',
      status: 'IN_PROGRESS',
      authWord,
      submittedTwitchId: input.submittedTwitchId || null,
      submittedTwitchUsername: cleanTwitchUser,
      identityStatus: resolvedIdentityStatus,
      timerLog,
    })
    .returning();

  return {
    tournamentId: tourney.id,
    playerId: targetPlayerId,
    playerName: targetPlayerName,
    status: 'IN_PROGRESS',
    authWord,
    twitchVodUrl: null,
    submittedTwitchId: input.submittedTwitchId || null,
    submittedTwitchUsername: cleanTwitchUser,
    identityStatus: resolvedIdentityStatus,
    timerLog,
    scores: [],
    judgeNotes: null,
    submissionIds: [inserted.id],
  };
}

/**
 * Submits final online qualifier scores and Twitch VOD URL (Assertions 1.4, 1.6).
 */
export async function submitOnlineQualScores(
  tournamentIdOrSlug: string,
  input: {
    playerId: string;
    scores: number[];
    twitchVodUrl: string;
    submittedTwitchId?: string;
    submittedTwitchUsername?: string;
    identityStatus?: IdentityStatus;
    nowMs?: number;
  }
): Promise<OnlineQualSessionSummary> {
  const db = getDb();
  const tourney = await resolveTournamentRow(tournamentIdOrSlug);
  const meta = (tourney.metadata as Record<string, any>) || {};

  if (tourney.qualsClosed || meta.isLocked) {
    throw new Error('Qualifiers are closed for this tournament');
  }

  if (!Array.isArray(input.scores) || input.scores.length === 0) {
    throw new Error('At least one game score is required');
  }
  for (const s of input.scores) {
    if (typeof s !== 'number' || s < 0 || Number.isNaN(s)) {
      throw new Error('All game scores must be non-negative numbers');
    }
  }
  const cleanVod = (input.twitchVodUrl || '').trim();
  if (!cleanVod) {
    throw new Error('Twitch VOD URL is required');
  }

  await ensureTournamentPlayerRegistration(tourney.id, input.playerId);

  const existing = await getOnlineQualSession(tourney.id, { playerId: input.playerId });
  const nowMs = input.nowMs ?? Date.now();
  const windowMinutes = tourney.qualWindowMinutes ?? meta.qualWindowMinutes ?? 90;

  const baseTimerLog = existing?.timerLog || createInitialTimerLog(nowMs);
  const telemetry = computeTimerTelemetry(baseTimerLog, windowMinutes, nowMs);
  const finalTimerLog: QualTimerLog = {
    ...baseTimerLog,
    submittedAt: nowMs,
    elapsedSeconds: telemetry.elapsedSeconds,
    overTime: telemetry.overTime,
  };

  const authWord = existing?.authWord || generateNesAuthword(tourney.customAuthWords as string[]);
  const submittedTwitchId = input.submittedTwitchId ?? existing?.submittedTwitchId ?? null;
  const submittedTwitchUsername =
    input.submittedTwitchUsername ?? existing?.submittedTwitchUsername ?? null;
  const identityStatus = input.identityStatus ?? existing?.identityStatus ?? 'CLAIMED_PENDING_REVIEW';

  // Remove the IN_PROGRESS placeholder row(s) for this player's online run
  if (existing && existing.submissionIds.length > 0) {
    for (const subId of existing.submissionIds) {
      await db.delete(qualifierSubmissions).where(eq(qualifierSubmissions.id, subId));
    }
  }

  const inserted = await db
    .insert(qualifierSubmissions)
    .values(
      input.scores.map((score, idx) => ({
        tournamentId: tourney.id,
        playerId: input.playerId,
        score,
        submissionSource: 'ONLINE' as const,
        status: 'SUBMITTED' as const,
        authWord,
        twitchVodUrl: cleanVod,
        submittedTwitchId,
        submittedTwitchUsername,
        identityStatus,
        timerLog: finalTimerLog,
        judgeNotes: existing?.judgeNotes || null,
        createdAt: new Date(nowMs + idx),
      }))
    )
    .returning();

  return {
    tournamentId: tourney.id,
    playerId: input.playerId,
    status: 'SUBMITTED',
    authWord,
    twitchVodUrl: cleanVod,
    submittedTwitchId,
    submittedTwitchUsername,
    identityStatus,
    timerLog: finalTimerLog,
    scores: input.scores,
    judgeNotes: existing?.judgeNotes || null,
    submissionIds: (inserted as Array<{ id: string }>).map(r => r.id),
  };
}

/**
 * Competitor reports a stream crash / technical reset request during an active run (Assertion 4.1).
 */
export async function requestOnlineQualReset(
  tournamentIdOrSlug: string,
  input: {
    playerId: string;
    reason: string;
    nowMs?: number;
  }
): Promise<OnlineQualSessionSummary> {
  const db = getDb();
  const tourney = await resolveTournamentRow(tournamentIdOrSlug);
  const existing = await getOnlineQualSession(tourney.id, { playerId: input.playerId });
  if (!existing) {
    throw new Error('No active online qualifier session found for this player');
  }

  const cleanReason = input.reason.trim() || 'Stream crash / technical issue reported';
  const nowMs = input.nowMs ?? Date.now();
  const updatedTimerLog: QualTimerLog = {
    ...existing.timerLog,
    resetRequested: true,
    resetReason: cleanReason,
    resetRequestedAt: nowMs,
  };
  const updatedNotes = existing.judgeNotes
    ? `${existing.judgeNotes}\n[RESET REQUEST]: ${cleanReason}`
    : `[RESET REQUEST]: ${cleanReason}`;

  for (const subId of existing.submissionIds) {
    await db
      .update(qualifierSubmissions)
      .set({
        timerLog: updatedTimerLog,
        judgeNotes: updatedNotes,
      })
      .where(eq(qualifierSubmissions.id, subId));
  }

  return {
    ...existing,
    timerLog: updatedTimerLog,
    judgeNotes: updatedNotes,
  };
}

/**
 * Judge voids an active/crashed online session and issues a brand new NES Authword
 * and fresh countdown timer without creating duplicate submissions (Assertion 4.2).
 */
export async function voidAndResetOnlineQualSession(
  tournamentIdOrSlug: string,
  input: {
    playerId: string;
    judgeNote?: string;
    nowMs?: number;
  }
): Promise<OnlineQualSessionSummary> {
  const db = getDb();
  const tourney = await resolveTournamentRow(tournamentIdOrSlug);
  const meta = (tourney.metadata as Record<string, any>) || {};
  const existing = await getOnlineQualSession(tourney.id, { playerId: input.playerId });

  const allTourneySubs = (await db
    .select()
    .from(qualifierSubmissions)
    .where(eq(qualifierSubmissions.tournamentId, tourney.id))) as QualifierSubmissionRecord[];
  const usedWords = allTourneySubs
    .map(s => s.authWord)
    .filter((w): w is string => Boolean(w));
  if (existing?.authWord) {
    usedWords.push(existing.authWord);
  }

  if (existing && existing.submissionIds.length > 0) {
    for (const subId of existing.submissionIds) {
      await db.delete(qualifierSubmissions).where(eq(qualifierSubmissions.id, subId));
    }
  }

  const customWords =
    (tourney.customAuthWords as string[] | null) ||
    (meta.customAuthWords as string[] | undefined) ||
    [];
  const newAuthWord = generateNesAuthword(customWords, usedWords);
  const newTimerLog = createInitialTimerLog(input.nowMs ?? Date.now());
  const note = input.judgeNote?.trim() || null;

  const [inserted] = await db
    .insert(qualifierSubmissions)
    .values({
      tournamentId: tourney.id,
      playerId: input.playerId,
      score: 0,
      submissionSource: 'ONLINE',
      status: 'IN_PROGRESS',
      authWord: newAuthWord,
      submittedTwitchId: existing?.submittedTwitchId || null,
      submittedTwitchUsername: existing?.submittedTwitchUsername || null,
      identityStatus: existing?.identityStatus || 'VERIFIED_MATCH',
      timerLog: newTimerLog,
      judgeNotes: note,
    })
    .returning();

  return {
    tournamentId: tourney.id,
    playerId: input.playerId,
    status: 'IN_PROGRESS',
    authWord: newAuthWord,
    twitchVodUrl: null,
    submittedTwitchId: existing?.submittedTwitchId || null,
    submittedTwitchUsername: existing?.submittedTwitchUsername || null,
    identityStatus: existing?.identityStatus || 'VERIFIED_MATCH',
    timerLog: newTimerLog,
    scores: [],
    judgeNotes: note,
    submissionIds: [inserted.id],
  };
}

/**
 * Cleans up old player records from tournament_players (and orphaned provisional player rows)
 * when a qualifier run is reassigned or split to a new player.
 */
async function cleanupSourcePlayerAfterReassign(
  tournamentId: string,
  oldPlayerId: string,
  newPlayerId: string,
  wasProvisionalWalkIn: boolean
) {
  if (oldPlayerId === newPlayerId) return;
  const db = getDb();

  const remainingSubs = await db
    .select()
    .from(qualifierSubmissions)
    .where(
      and(
        eq(qualifierSubmissions.tournamentId, tournamentId),
        eq(qualifierSubmissions.playerId, oldPlayerId)
      )
    )
    .limit(1);

  const tourneyMatches = await db
    .select({ id: matches.id })
    .from(matches)
    .innerJoin(bracketTiers, eq(matches.tierId, bracketTiers.id))
    .where(
      and(
        eq(bracketTiers.tournamentId, tournamentId),
        or(
          eq(matches.player1Id, oldPlayerId),
          eq(matches.player2Id, oldPlayerId),
          eq(matches.winnerId, oldPlayerId)
        )
      )
    )
    .limit(1);

  if (remainingSubs.length === 0 && tourneyMatches.length === 0) {
    await db
      .delete(tournamentPlayers)
      .where(
        and(
          eq(tournamentPlayers.tournamentId, tournamentId),
          eq(tournamentPlayers.playerId, oldPlayerId)
        )
      );

    if (wasProvisionalWalkIn) {
      const anySubs = await db
        .select()
        .from(qualifierSubmissions)
        .where(eq(qualifierSubmissions.playerId, oldPlayerId))
        .limit(1);
      const anyTourneyPlayers = await db
        .select()
        .from(tournamentPlayers)
        .where(eq(tournamentPlayers.playerId, oldPlayerId))
        .limit(1);
      const anyMatches = await db
        .select()
        .from(matches)
        .where(
          or(
            eq(matches.player1Id, oldPlayerId),
            eq(matches.player2Id, oldPlayerId),
            eq(matches.winnerId, oldPlayerId)
          )
        )
        .limit(1);

      if (anySubs.length === 0 && anyTourneyPlayers.length === 0 && anyMatches.length === 0) {
        await db.delete(players).where(eq(players.id, oldPlayerId));
      }
    }
  } else {
    const hasRemainingVerified = (remainingSubs as QualifierSubmissionRecord[]).some(
      s => s.status === 'VERIFIED'
    );
    await db
      .update(tournamentPlayers)
      .set({ qualsCompleted: hasRemainingVerified })
      .where(
        and(
          eq(tournamentPlayers.tournamentId, tournamentId),
          eq(tournamentPlayers.playerId, oldPlayerId)
        )
      );
  }
}

/**
 * Track 10E: Judge Review Queue adjudication & identity resolution mutations.
 */
export async function adjudicateOnlineSubmission(
  tournamentIdOrSlug: string,
  input: {
    playerId: string;
    action:
      | 'VERIFY'
      | 'EDIT_AND_VERIFY'
      | 'DNQ'
      | 'DQ'
      | 'CONFIRM_IDENTITY'
      | 'REASSIGN_PLAYER'
      | 'PROMOTE_PROVISIONAL'
      | 'CREATE_NEW_PLAYER';
    scores?: number[];
    judgeNotes?: string;
    verifiedBy?: string;
    targetPlayerId?: string;
    newPlayer?: {
      name: string;
      country?: string;
      playstyle?: string;
    };
  }
) {
  const db = getDb();
  const tourney = await resolveTournamentRow(tournamentIdOrSlug);
  const existing = await getOnlineQualSession(tourney.id, { playerId: input.playerId });
  if (!existing) {
    throw new Error('Online qualifier submission not found for this player');
  }

  const now = new Date();
  const judgeBy = input.verifiedBy || 'Judge';

  if (input.action === 'VERIFY') {
    const note = input.judgeNotes?.trim() || existing.judgeNotes || null;
    for (const subId of existing.submissionIds) {
      await db
        .update(qualifierSubmissions)
        .set({
          status: 'VERIFIED',
          identityStatus: 'VERIFIED_MATCH',
          judgeNotes: note,
          verifiedBy: judgeBy,
          verifiedAt: now,
        })
        .where(eq(qualifierSubmissions.id, subId));
    }
    if (existing.submittedTwitchId || existing.submittedTwitchUsername) {
      await db
        .update(players)
        .set({
          ...(existing.submittedTwitchId ? { twitchId: existing.submittedTwitchId } : {}),
          ...(existing.submittedTwitchUsername
            ? { twitchUsername: existing.submittedTwitchUsername }
            : {}),
        })
        .where(eq(players.id, input.playerId));
    }
    await db
      .update(tournamentPlayers)
      .set({ qualsCompleted: true })
      .where(
        and(
          eq(tournamentPlayers.tournamentId, tourney.id),
          eq(tournamentPlayers.playerId, input.playerId)
        )
      );
    return getOnlineQualSession(tourney.id, { playerId: input.playerId });
  }

  if (input.action === 'EDIT_AND_VERIFY') {
    const newScores =
      Array.isArray(input.scores) && input.scores.length > 0
        ? input.scores
        : existing.scores;
    const prevScoresStr = existing.scores.join(', ');
    const newScoresStr = newScores.join(', ');
    const auditLine = `[SCORE EDITED BY ${judgeBy}]: ${prevScoresStr} -> ${newScoresStr}${
      input.judgeNotes ? ` (${input.judgeNotes.trim()})` : ''
    }`;
    const combinedNotes = existing.judgeNotes
      ? `${existing.judgeNotes}\n${auditLine}`
      : auditLine;

    for (const subId of existing.submissionIds) {
      await db.delete(qualifierSubmissions).where(eq(qualifierSubmissions.id, subId));
    }

    await db.insert(qualifierSubmissions).values(
      newScores.map((score, idx) => ({
        tournamentId: tourney.id,
        playerId: input.playerId,
        score,
        submissionSource: 'ONLINE' as const,
        status: 'VERIFIED' as const,
        authWord: existing.authWord,
        twitchVodUrl: existing.twitchVodUrl,
        submittedTwitchId: existing.submittedTwitchId,
        submittedTwitchUsername: existing.submittedTwitchUsername,
        identityStatus: 'VERIFIED_MATCH' as const,
        timerLog: existing.timerLog,
        judgeNotes: combinedNotes,
        verifiedBy: judgeBy,
        verifiedAt: now,
        createdAt: new Date(now.getTime() + idx),
      }))
    );

    if (existing.submittedTwitchId || existing.submittedTwitchUsername) {
      await db
        .update(players)
        .set({
          ...(existing.submittedTwitchId ? { twitchId: existing.submittedTwitchId } : {}),
          ...(existing.submittedTwitchUsername
            ? { twitchUsername: existing.submittedTwitchUsername }
            : {}),
        })
        .where(eq(players.id, input.playerId));
    }

    await db
      .update(tournamentPlayers)
      .set({ qualsCompleted: true })
      .where(
        and(
          eq(tournamentPlayers.tournamentId, tourney.id),
          eq(tournamentPlayers.playerId, input.playerId)
        )
      );
    return getOnlineQualSession(tourney.id, { playerId: input.playerId });
  }

  if (input.action === 'DNQ') {
    const note = input.judgeNotes?.trim()
      ? existing.judgeNotes
        ? `${existing.judgeNotes}\n[DNQ]: ${input.judgeNotes.trim()}`
        : `[DNQ]: ${input.judgeNotes.trim()}`
      : existing.judgeNotes || '[DNQ]: Marked DNQ by judge';

    for (const subId of existing.submissionIds) {
      await db
        .update(qualifierSubmissions)
        .set({
          status: 'DNQ',
          judgeNotes: note,
          verifiedBy: judgeBy,
          verifiedAt: now,
        })
        .where(eq(qualifierSubmissions.id, subId));
    }
    await db
      .update(tournamentPlayers)
      .set({ qualsCompleted: false })
      .where(
        and(
          eq(tournamentPlayers.tournamentId, tourney.id),
          eq(tournamentPlayers.playerId, input.playerId)
        )
      );
    return getOnlineQualSession(tourney.id, { playerId: input.playerId });
  }

  if (input.action === 'DQ') {
    const note = input.judgeNotes?.trim()
      ? existing.judgeNotes
        ? `${existing.judgeNotes}\n[DQ]: ${input.judgeNotes.trim()}`
        : `[DQ]: ${input.judgeNotes.trim()}`
      : existing.judgeNotes || '[DQ]: Disqualified by judge';

    await db
      .update(players)
      .set({ isDisqualified: true })
      .where(eq(players.id, input.playerId));

    for (const subId of existing.submissionIds) {
      await db
        .update(qualifierSubmissions)
        .set({
          status: 'DQ',
          judgeNotes: note,
          verifiedBy: judgeBy,
          verifiedAt: now,
        })
        .where(eq(qualifierSubmissions.id, subId));
    }
    return getOnlineQualSession(tourney.id, { playerId: input.playerId });
  }

  if (input.action === 'CONFIRM_IDENTITY' || input.action === 'PROMOTE_PROVISIONAL') {
    if (existing.submittedTwitchId || existing.submittedTwitchUsername) {
      await db
        .update(players)
        .set({
          ...(existing.submittedTwitchId ? { twitchId: existing.submittedTwitchId } : {}),
          ...(existing.submittedTwitchUsername
            ? { twitchUsername: existing.submittedTwitchUsername }
            : {}),
        })
        .where(eq(players.id, input.playerId));
    }
    await ensureTournamentPlayerRegistration(tourney.id, input.playerId);

    for (const subId of existing.submissionIds) {
      await db
        .update(qualifierSubmissions)
        .set({
          identityStatus: 'VERIFIED_MATCH',
        })
        .where(eq(qualifierSubmissions.id, subId));
    }
    return getOnlineQualSession(tourney.id, { playerId: input.playerId });
  }

  if (input.action === 'REASSIGN_PLAYER') {
    if (!input.targetPlayerId) {
      throw new Error('targetPlayerId is required for REASSIGN_PLAYER');
    }
    const [targetPlayer] = await db
      .select()
      .from(players)
      .where(eq(players.id, input.targetPlayerId))
      .limit(1);
    if (!targetPlayer) {
      throw new Error('Target player not found');
    }

    const wasProvisional = existing.identityStatus === 'PROVISIONAL_NEW';
    const wasVerified = existing.status === 'VERIFIED';

    await ensureTournamentPlayerRegistration(tourney.id, targetPlayer.id);

    if (wasVerified) {
      await db
        .update(tournamentPlayers)
        .set({ qualsCompleted: true })
        .where(
          and(
            eq(tournamentPlayers.tournamentId, tourney.id),
            eq(tournamentPlayers.playerId, targetPlayer.id)
          )
        );
    }

    if (existing.submittedTwitchId || existing.submittedTwitchUsername) {
      await db
        .update(players)
        .set({
          ...(existing.submittedTwitchId ? { twitchId: existing.submittedTwitchId } : {}),
          ...(existing.submittedTwitchUsername
            ? { twitchUsername: existing.submittedTwitchUsername }
            : {}),
        })
        .where(eq(players.id, targetPlayer.id));
    }

    for (const subId of existing.submissionIds) {
      await db
        .update(qualifierSubmissions)
        .set({
          playerId: targetPlayer.id,
          identityStatus: 'VERIFIED_MATCH',
        })
        .where(eq(qualifierSubmissions.id, subId));
    }

    await cleanupSourcePlayerAfterReassign(
      tourney.id,
      input.playerId,
      targetPlayer.id,
      wasProvisional
    );

    return getOnlineQualSession(tourney.id, { playerId: targetPlayer.id });
  }

  if (input.action === 'CREATE_NEW_PLAYER') {
    const rawName = (input.newPlayer?.name || '').trim();
    if (!rawName) {
      throw new Error('Player name is required when creating a new player');
    }

    let finalName = rawName;
    const lowerName = rawName.toLowerCase();
    const [existingByName] = await db
      .select()
      .from(players)
      .where(sql`lower(trim(${players.name})) = ${lowerName}`)
      .limit(1);

    if (existingByName) {
      const candidate = `${rawName} (${existing.submittedTwitchUsername || 'New'})`;
      const [collisionCheck] = await db
        .select()
        .from(players)
        .where(sql`lower(trim(${players.name})) = ${candidate.toLowerCase()}`)
        .limit(1);
      finalName = collisionCheck ? `${candidate} #2` : candidate;
    }

    const [createdPlayer] = await db
      .insert(players)
      .values({
        name: finalName,
        country: (input.newPlayer?.country || 'US').toUpperCase(),
        playstyle: input.newPlayer?.playstyle || 'DAS',
        twitchUsername: existing.submittedTwitchUsername || null,
        twitchId: existing.submittedTwitchId || null,
        avatarType: 'flag',
        personalBest: 0,
      })
      .returning();

    const wasProvisional = existing.identityStatus === 'PROVISIONAL_NEW';
    const wasVerified = existing.status === 'VERIFIED';

    await ensureTournamentPlayerRegistration(tourney.id, createdPlayer.id);

    if (wasVerified) {
      await db
        .update(tournamentPlayers)
        .set({ qualsCompleted: true })
        .where(
          and(
            eq(tournamentPlayers.tournamentId, tourney.id),
            eq(tournamentPlayers.playerId, createdPlayer.id)
          )
        );
    }

    for (const subId of existing.submissionIds) {
      await db
        .update(qualifierSubmissions)
        .set({
          playerId: createdPlayer.id,
          identityStatus: 'VERIFIED_MATCH',
        })
        .where(eq(qualifierSubmissions.id, subId));
    }

    await cleanupSourcePlayerAfterReassign(
      tourney.id,
      input.playerId,
      createdPlayer.id,
      wasProvisional
    );

    return getOnlineQualSession(tourney.id, { playerId: createdPlayer.id });
  }

  return existing;
}
