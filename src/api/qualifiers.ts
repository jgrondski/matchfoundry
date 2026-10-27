import {
  qualifierSubmissions,
  tournaments,
  players,
  tournamentPlayers,
  matches,
  bracketTiers,
  organizations,
} from '../db/schema';
import { eq, and, or, desc, sql, ne } from 'drizzle-orm';
import { getDb } from '../db';
import type {
  SubmissionSource,
  IdentityStatus,
  SubmissionStatus,
  QualTimerLog,
  QualRunDraft,
  PointsThreshold,
} from '../features/tournament/types';
import {
  generateNesAuthword,
  createInitialTimerLog,
  computeTimerTelemetry,
} from '../features/online-quals/authwordEngine';
import {
  buildQualDiscordMessage,
  escapeDiscordMarkdown,
  isDiscordWebhookUrl,
  PLAYER_NOTES_MAX_LENGTH,
  type QualDiscordEvent,
} from '../features/online-quals/discordMessages';
import { isPlaceholderSubmissionStatus } from '../features/online-quals/onlineQualsStatus';

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
  playerNotes: string | null;
  resumeToken: string | null;
  draft: QualRunDraft | null;
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
  authWord: string | null;
  twitchVodUrl: string | null;
  submittedTwitchId: string | null;
  submittedTwitchUsername: string | null;
  identityStatus: IdentityStatus | null;
  timerLog: QualTimerLog;
  scores: number[];
  judgeNotes: string | null;
  playerNotes?: string | null;
  submissionIds: string[];
  submissionSource?: SubmissionSource;
  // Only startOnlineQualSession sets this: true when it created the run, not when it resumed one.
  isNewSession?: boolean;
  // Only set for the competitor's own in-progress run (start / get-by-token); never in public or judge listings.
  resumeToken?: string;
  draft?: QualRunDraft | null;
}

/** Thrown when a run token is missing, wrong, or no longer refers to an in-progress run. */
export class QualRunAccessError extends Error {}

function generateResumeToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
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
  const status = options?.status || 'SUBMITTED';

  // Ensure competitor is registered in tournament roster so leaderboard derivation and bracket seeding recognize them
  await ensureTournamentPlayerRegistration(tourney.id, playerId);

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

  const uniquePlayerIds = Array.from(new Set(submissions.map(s => s.playerId)));
  for (const pid of uniquePlayerIds) {
    await ensureTournamentPlayerRegistration(tourney.id, pid);
  }

  const inserted = await db
    .insert(qualifierSubmissions)
    .values(
      submissions.map(s => {
        const src = s.submissionSource || 'IN_PERSON';
        const st = s.status || 'SUBMITTED';
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
        country: input.newPlayer?.country ? input.newPlayer.country.toUpperCase() : null,
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

  const matchedSubs = allSubs.filter(s => {
    if (query.playerId && s.playerId === query.playerId) return true;
    if (query.twitchId && s.submittedTwitchId === query.twitchId) return true;
    return false;
  });

  if (matchedSubs.length === 0) return null;

  // Row order is arbitrary; an in-progress run must win over any other row for this player.
  const first = matchedSubs.find(s => s.status === 'IN_PROGRESS') || matchedSubs[0];
  const isOnline = matchedSubs.some(s => s.submissionSource === 'ONLINE');
  const scoredRows = matchedSubs.filter(
    s => s.status !== 'IN_PROGRESS' && s.status !== 'NOT_STARTED'
  );

  const [player] = await db
    .select({ name: players.name })
    .from(players)
    .where(eq(players.id, first.playerId))
    .limit(1);

  const qualWindowMinutes = tourney.qualWindowMinutes ?? 90;

  return {
    tournamentId: tourney.id,
    playerId: first.playerId,
    playerName: player?.name,
    submissionSource: isOnline ? 'ONLINE' : 'IN_PERSON',
    status: first.status,
    authWord: isOnline ? (first.authWord || 'ROCKET') : (first.authWord || null),
    twitchVodUrl: first.twitchVodUrl || null,
    submittedTwitchId: first.submittedTwitchId || null,
    submittedTwitchUsername: first.submittedTwitchUsername || null,
    identityStatus: first.identityStatus || (isOnline ? null : 'VERIFIED_MATCH'),
    timerLog:
      first.timerLog || {
        startedAt: first.createdAt.getTime(),
        elapsedSeconds: isOnline ? 0 : qualWindowMinutes * 60,
        pauses: [],
      },
    scores: scoredRows.map(s => s.score),
    judgeNotes: first.judgeNotes || null,
    playerNotes: first.playerNotes || null,
    submissionIds: matchedSubs.map(s => s.id),
  };
}

export interface ReviewQueueSessionSummary extends OnlineQualSessionSummary {
  playerName: string;
  country?: string;
  avatarUrl?: string;
  avatarType?: string;
}

/**
 * Lists all online and in-person qualifier sessions for a tournament, grouped by player (Track 10E).
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

  if (allSubs.length === 0) return [];

  // Group by playerId preserving order
  const playerGroups = new Map<string, QualifierSubmissionRecord[]>();
  for (const s of allSubs) {
    const list = playerGroups.get(s.playerId) || [];
    list.push(s);
    playerGroups.set(s.playerId, list);
  }

  const allPlayers = (await db.select().from(players)) as Array<typeof players.$inferSelect>;
  const playerMap = new Map<string, typeof players.$inferSelect>(
    allPlayers.map(p => [p.id, p])
  );

  const qualWindowMinutes = tourney.qualWindowMinutes ?? 90;
  const result: ReviewQueueSessionSummary[] = [];

  for (const [playerId, subs] of playerGroups.entries()) {
    const first = subs[0];
    const isOnline = subs.some(s => s.submissionSource === 'ONLINE');
    const scoredRows = subs.filter(
      s => s.status !== 'IN_PROGRESS' && s.status !== 'NOT_STARTED'
    );
    const p = playerMap.get(playerId);

    result.push({
      tournamentId: tourney.id,
      playerId,
      playerName: p?.name || first.submittedTwitchUsername || 'Unknown Player',
      country: p?.country || undefined,
      avatarUrl: p?.avatarUrl || undefined,
      avatarType: p?.avatarType || 'flag',
      submissionSource: isOnline ? 'ONLINE' : 'IN_PERSON',
      status: first.status,
      authWord: isOnline ? (first.authWord || 'ROCKET') : (first.authWord || null),
      twitchVodUrl: first.twitchVodUrl || null,
      submittedTwitchId: first.submittedTwitchId || null,
      submittedTwitchUsername: first.submittedTwitchUsername || null,
      identityStatus: first.identityStatus || (isOnline ? null : 'VERIFIED_MATCH'),
      timerLog:
        first.timerLog || {
          startedAt: first.createdAt.getTime(),
          elapsedSeconds: isOnline ? 0 : qualWindowMinutes * 60,
          pauses: [],
        },
      scores: scoredRows.map(s => s.score),
      judgeNotes: first.judgeNotes || null,
      playerNotes: first.playerNotes || null,
      submissionIds: subs.map(s => s.id),
    });
  }

  return result;
}

const DISCORD_TIMEOUT_MS = 3000;

/**
 * Webhook for a tournament's announcements: its own URL, else its organization's.
 * Only genuine Discord webhook URLs are returned.
 */
async function resolveDiscordWebhook(
  tourney: typeof tournaments.$inferSelect
): Promise<{ url: string; source: 'tournament' | 'organization' } | null> {
  const meta = (tourney.metadata as Record<string, any>) || {};
  if (isDiscordWebhookUrl(meta.discordWebhookUrl)) {
    return { url: meta.discordWebhookUrl.trim(), source: 'tournament' };
  }
  if (tourney.organizationId) {
    const [org] = await getDb()
      .select({ discordWebhookUrl: organizations.discordWebhookUrl })
      .from(organizations)
      .where(eq(organizations.id, tourney.organizationId))
      .limit(1);
    if (isDiscordWebhookUrl(org?.discordWebhookUrl)) {
      return { url: org.discordWebhookUrl!.trim(), source: 'organization' };
    }
  }
  return null;
}

async function postToDiscord(url: string, content: string): Promise<boolean> {
  if (typeof fetch === 'undefined') return false;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // Never let player-supplied text ping @everyone, roles, or users.
      body: JSON.stringify({ content, allowed_mentions: { parse: [] } }),
      signal: AbortSignal.timeout(DISCORD_TIMEOUT_MS),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Track 10F: Dispatches automated Discord webhook notifications for online qualifier events.
 * Callers await it so serverless runtimes don't drop the request after the response is sent;
 * it is bounded by DISCORD_TIMEOUT_MS and never throws.
 */
export async function dispatchDiscordWebhook(
  tournamentIdOrSlug: string,
  event: QualDiscordEvent,
  data: {
    playerName: string;
    twitchUsername?: string;
    authWord?: string;
    twitchVodUrl?: string;
    scores?: number[];
    judgeName?: string;
    playerNotes?: string;
  }
): Promise<boolean> {
  try {
    const tourney = await resolveTournamentRow(tournamentIdOrSlug);
    const webhook = await resolveDiscordWebhook(tourney);
    if (!webhook) return false;

    const content = buildQualDiscordMessage(event, {
      ...data,
      tournamentName: tourney.name || 'Tournament',
      tournamentSlug: tourney.slug || undefined,
      format: {
        qualFormat: tourney.qualFormat,
        qualAverageCount: tourney.qualAverageCount,
        pointsConfig: tourney.pointsConfig as PointsThreshold[] | null,
      },
    });
    return await postToDiscord(webhook.url, content);
  } catch {
    return false;
  }
}

/**
 * Sends a test message so organizers can confirm a webhook works. Uses `overrideUrl` (an unsaved
 * value typed in settings) when given, otherwise the tournament's or its organization's webhook.
 */
export async function sendTestDiscordWebhook(
  tournamentIdOrSlug: string,
  overrideUrl?: string
): Promise<{ success: boolean; source?: 'tournament' | 'organization'; error?: string }> {
  const tourney = await resolveTournamentRow(tournamentIdOrSlug);
  let target: { url: string; source: 'tournament' | 'organization' } | null;
  if (overrideUrl?.trim()) {
    if (!isDiscordWebhookUrl(overrideUrl)) {
      return { success: false, error: 'That is not a Discord webhook URL (https://discord.com/api/webhooks/...)' };
    }
    target = { url: overrideUrl.trim(), source: 'tournament' };
  } else {
    target = await resolveDiscordWebhook(tourney);
    if (!target) {
      return { success: false, error: 'No webhook configured for this tournament or its organization' };
    }
  }

  const name = escapeDiscordMarkdown(tourney.name || 'Tournament');
  const ok = await postToDiscord(target.url, `🔔 Test from MatchFoundry: qual announcements for **${name}** will post here.`);
  return ok
    ? { success: true, source: target.source }
    : { success: false, source: target.source, error: 'Discord rejected the message or did not respond' };
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
  if (tourney.qualMode === 'IN_PERSON') {
    throw new Error('Online qualifying is not available for in-person tournaments');
  }
  if (!tourney.onlineQualsOpen) {
    throw new Error('Online qualifying is not open for this tournament');
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
          country: null,
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

  // Roster registration is deferred to submit: an unfinished run must not make someone a competitor.

  // Check if session already exists (idempotent recovery for page reloads - Assertion 1.5)
  const existingSession = await getOnlineQualSession(tourney.id, {
    playerId: targetPlayerId,
  });
  if (existingSession) {
    return withRunCredentials(tourney.id, {
      ...existingSession,
      playerName: targetPlayerName || existingSession.playerName,
    });
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
  const resumeToken = generateResumeToken();

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
      resumeToken,
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
    isNewSession: true,
    resumeToken,
    draft: null,
  };
}

async function findInProgressRow(
  tournamentId: string,
  where: { playerId: string } | { resumeToken: string }
): Promise<QualifierSubmissionRecord | null> {
  const [row] = (await getDb()
    .select()
    .from(qualifierSubmissions)
    .where(
      and(
        eq(qualifierSubmissions.tournamentId, tournamentId),
        eq(qualifierSubmissions.status, 'IN_PROGRESS'),
        'playerId' in where
          ? eq(qualifierSubmissions.playerId, where.playerId)
          : eq(qualifierSubmissions.resumeToken, where.resumeToken)
      )
    )
    .limit(1)) as QualifierSubmissionRecord[];
  return row || null;
}

/**
 * Adds the run token and autosaved draft to a resumed in-progress session. Runs started before
 * tokens existed are issued one here.
 */
async function withRunCredentials(
  tournamentId: string,
  session: OnlineQualSessionSummary
): Promise<OnlineQualSessionSummary> {
  if (session.status !== 'IN_PROGRESS') return session;
  const row = await findInProgressRow(tournamentId, { playerId: session.playerId });
  if (!row) return session;
  let resumeToken = row.resumeToken;
  if (!resumeToken) {
    resumeToken = generateResumeToken();
    await getDb()
      .update(qualifierSubmissions)
      .set({ resumeToken })
      .where(eq(qualifierSubmissions.id, row.id));
  }
  return { ...session, resumeToken, draft: row.draft || null };
}

/** Loads the competitor's own in-progress run by its token (the `?run=` link). Null if not active. */
export async function getOnlineQualRunByToken(
  tournamentIdOrSlug: string,
  resumeToken: string
): Promise<OnlineQualSessionSummary | null> {
  if (!resumeToken) return null;
  const tourney = await resolveTournamentRow(tournamentIdOrSlug);
  const row = await findInProgressRow(tourney.id, { resumeToken });
  if (!row) return null;
  const session = await getOnlineQualSession(tourney.id, { playerId: row.playerId });
  if (!session) return null;
  return { ...session, resumeToken, draft: row.draft || null };
}

function validateQualScores(scores: unknown, { requireOne }: { requireOne: boolean }): number[] {
  if (!Array.isArray(scores) || (requireOne && scores.length === 0)) {
    throw new Error('At least one game score is required');
  }
  for (const s of scores) {
    if (typeof s !== 'number' || s < 0 || !Number.isFinite(s)) {
      throw new Error('All game scores must be non-negative numbers');
    }
  }
  return scores as number[];
}

function normalizePlayerNotes(notes: unknown): string | null {
  const clean = typeof notes === 'string' ? notes.trim() || null : null;
  if (clean && clean.length > PLAYER_NOTES_MAX_LENGTH) {
    throw new Error(`Notes must be ${PLAYER_NOTES_MAX_LENGTH} characters or fewer`);
  }
  return clean;
}

/** Autosaves the not-yet-submitted contents of an in-progress run. Requires the run's token. */
export async function saveOnlineQualDraft(
  tournamentIdOrSlug: string,
  input: { resumeToken: string; scores: number[]; twitchVodUrl?: string; playerNotes?: string }
): Promise<{ savedAt: number }> {
  const tourney = await resolveTournamentRow(tournamentIdOrSlug);
  const row = input.resumeToken ? await findInProgressRow(tourney.id, { resumeToken: input.resumeToken }) : null;
  if (!row) {
    throw new QualRunAccessError('This run link is no longer active');
  }
  const draft: QualRunDraft = {
    scores: validateQualScores(input.scores, { requireOne: false }),
    twitchVodUrl: typeof input.twitchVodUrl === 'string' ? input.twitchVodUrl.trim() : undefined,
    playerNotes: normalizePlayerNotes(input.playerNotes) || undefined,
  };
  await getDb()
    .update(qualifierSubmissions)
    .set({ draft })
    .where(eq(qualifierSubmissions.id, row.id));
  return { savedAt: Date.now() };
}

/**
 * Judge action: throws away an unfinished online run. If the run created a walk-in player who is
 * referenced nowhere else, that player is deleted too. Submitted or judged runs cannot be discarded.
 */
export async function discardOnlineQualRun(
  tournamentIdOrSlug: string,
  playerId: string
): Promise<{ deletedPlayer: boolean }> {
  const db = getDb();
  const tourney = await resolveTournamentRow(tournamentIdOrSlug);
  const row = await findInProgressRow(tourney.id, { playerId });
  if (!row) {
    throw new Error('No unfinished run found for this player');
  }

  const playerSubs = (await db
    .select()
    .from(qualifierSubmissions)
    .where(
      and(eq(qualifierSubmissions.tournamentId, tourney.id), eq(qualifierSubmissions.playerId, playerId))
    )) as QualifierSubmissionRecord[];
  for (const sub of playerSubs) {
    if (isPlaceholderSubmissionStatus(sub.status)) {
      await db.delete(qualifierSubmissions).where(eq(qualifierSubmissions.id, sub.id));
    }
  }

  if (row.identityStatus !== 'PROVISIONAL_NEW') return { deletedPlayer: false };

  // A walk-in created by this run: drop the roster entry (pre-token runs registered at start)
  // unless they have real results here, then the player record if nothing else references it.
  const hasRealResults = playerSubs.some(sub => !isPlaceholderSubmissionStatus(sub.status));
  if (!hasRealResults && !(await hasTournamentMatches(tourney.id, playerId))) {
    await db
      .delete(tournamentPlayers)
      .where(and(eq(tournamentPlayers.tournamentId, tourney.id), eq(tournamentPlayers.playerId, playerId)));
  }
  return { deletedPlayer: await deletePlayerIfUnreferenced(playerId) };
}

async function hasTournamentMatches(tournamentId: string, playerId: string): Promise<boolean> {
  const rows = await getDb()
    .select({ id: matches.id })
    .from(matches)
    .innerJoin(bracketTiers, eq(matches.tierId, bracketTiers.id))
    .where(
      and(
        eq(bracketTiers.tournamentId, tournamentId),
        or(eq(matches.player1Id, playerId), eq(matches.player2Id, playerId), eq(matches.winnerId, playerId))
      )
    )
    .limit(1);
  return rows.length > 0;
}

/** Deletes a player row only if no submission, roster entry, or match anywhere references it. */
async function deletePlayerIfUnreferenced(playerId: string): Promise<boolean> {
  const db = getDb();
  const anySubs = await db
    .select({ id: qualifierSubmissions.id })
    .from(qualifierSubmissions)
    .where(eq(qualifierSubmissions.playerId, playerId))
    .limit(1);
  const anyTourneyPlayers = await db
    .select({ playerId: tournamentPlayers.playerId })
    .from(tournamentPlayers)
    .where(eq(tournamentPlayers.playerId, playerId))
    .limit(1);
  const anyMatches = await db
    .select({ id: matches.id })
    .from(matches)
    .where(or(eq(matches.player1Id, playerId), eq(matches.player2Id, playerId), eq(matches.winnerId, playerId)))
    .limit(1);
  if (anySubs.length > 0 || anyTourneyPlayers.length > 0 || anyMatches.length > 0) return false;
  await db.delete(players).where(eq(players.id, playerId));
  return true;
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
    playerNotes?: string;
    resumeToken?: string;
    submittedTwitchId?: string;
    submittedTwitchUsername?: string;
    identityStatus?: IdentityStatus;
    nowMs?: number;
  }
): Promise<OnlineQualSessionSummary> {
  const db = getDb();
  const tourney = await resolveTournamentRow(tournamentIdOrSlug);
  const meta = (tourney.metadata as Record<string, any>) || {};

  const playerNotes = normalizePlayerNotes(input.playerNotes);

  if (tourney.qualsClosed || meta.isLocked) {
    throw new Error('Qualifiers are closed for this tournament');
  }

  validateQualScores(input.scores, { requireOne: true });
  const cleanVod = (input.twitchVodUrl || '').trim();
  if (!cleanVod) {
    throw new Error('Twitch VOD URL is required');
  }

  const existing = await getOnlineQualSession(tourney.id, { playerId: input.playerId });
  // A submitted (or judged) run can't be replaced by submitting again; only a judge reset reopens it.
  if (existing && existing.status !== 'IN_PROGRESS') {
    throw new Error('You have already submitted your qualifier run for this tournament');
  }
  // Runs issued a token can only be submitted by its holder. Runs started before tokens existed
  // have none and still submit by player ID.
  const inProgressRow = await findInProgressRow(tourney.id, { playerId: input.playerId });
  if (inProgressRow?.resumeToken && inProgressRow.resumeToken !== input.resumeToken) {
    throw new QualRunAccessError('This run link is no longer valid. Reload the page to continue your run.');
  }

  await ensureTournamentPlayerRegistration(tourney.id, input.playerId);
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
        playerNotes,
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
    playerNotes,
    submissionIds: (inserted as Array<{ id: string }>).map(r => r.id),
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

  if (remainingSubs.length === 0 && !(await hasTournamentMatches(tournamentId, oldPlayerId))) {
    await db
      .delete(tournamentPlayers)
      .where(
        and(
          eq(tournamentPlayers.tournamentId, tournamentId),
          eq(tournamentPlayers.playerId, oldPlayerId)
        )
      );

    if (wasProvisionalWalkIn) {
      await deletePlayerIfUnreferenced(oldPlayerId);
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
      .set({ qualsCompleted: true, isDisqualified: false })
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
        playerNotes: existing.playerNotes ?? null,
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
      .set({ qualsCompleted: true, isDisqualified: false })
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
      .set({ qualsCompleted: false, isDisqualified: false })
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

    // Tournament-scoped DQ: reversible by a later VERIFY / EDIT_AND_VERIFY / DNQ ruling
    await db
      .update(tournamentPlayers)
      .set({ isDisqualified: true, qualsCompleted: false })
      .where(
        and(
          eq(tournamentPlayers.tournamentId, tourney.id),
          eq(tournamentPlayers.playerId, input.playerId)
        )
      );

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
    const updatePayload: Record<string, any> = {};
    if (existing.submittedTwitchId) {
      updatePayload.twitchId = existing.submittedTwitchId;
    }
    if (existing.submittedTwitchUsername) {
      updatePayload.twitchUsername = existing.submittedTwitchUsername;
    }
    if (input.newPlayer?.name?.trim()) {
      const rawName = input.newPlayer.name.trim();
      const lowerName = rawName.toLowerCase();
      const [existingByName] = await db
        .select()
        .from(players)
        .where(and(sql`lower(trim(${players.name})) = ${lowerName}`, ne(players.id, input.playerId)))
        .limit(1);

      if (existingByName) {
        const candidate = `${rawName} (${existing.submittedTwitchUsername || 'New'})`;
        const [collisionCheck] = await db
          .select()
          .from(players)
          .where(and(sql`lower(trim(${players.name})) = ${candidate.toLowerCase()}`, ne(players.id, input.playerId)))
          .limit(1);
        updatePayload.name = collisionCheck ? `${candidate} #2` : candidate;
      } else {
        updatePayload.name = rawName;
      }
    }
    if (input.newPlayer?.country !== undefined) {
      updatePayload.country = input.newPlayer.country.trim().toUpperCase() || null;
    }
    if (input.newPlayer?.playstyle?.trim()) {
      updatePayload.playstyle = input.newPlayer.playstyle.trim();
    }
    if (Object.keys(updatePayload).length > 0) {
      await db
        .update(players)
        .set(updatePayload)
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

export async function verifyAllQualifierSubmissions(
  tournamentIdOrSlug: string,
  verifiedBy: string = 'Judge'
): Promise<{ verifiedCount: number; sessions: OnlineQualSessionSummary[] }> {
  const tourney = await resolveTournamentRow(tournamentIdOrSlug);
  const sessions = await listOnlineQualSessions(tourney.id);
  const unverified = sessions.filter(s => s.status === 'SUBMITTED');

  const results: OnlineQualSessionSummary[] = [];
  for (const s of unverified) {
    const res = await adjudicateOnlineSubmission(tourney.id, {
      playerId: s.playerId,
      action: 'VERIFY',
      verifiedBy,
    });
    if (res) {
      results.push(res);
    }
  }

  return {
    verifiedCount: results.length,
    sessions: results,
  };
}

/**
 * Explicitly sets or lifts a competitor's tournament-scoped disqualification (organizer toggle).
 * Lifting a DQ sends any DQ'd submissions back to SUBMITTED so they re-enter the judge review queue.
 */
export async function setTournamentPlayerDisqualification(
  tournamentIdOrSlug: string,
  input: { playerId: string; isDisqualified: boolean; changedBy?: string }
): Promise<void> {
  const db = getDb();
  const tourney = await resolveTournamentRow(tournamentIdOrSlug);

  const [updated] = await db
    .update(tournamentPlayers)
    .set({ isDisqualified: input.isDisqualified })
    .where(
      and(
        eq(tournamentPlayers.tournamentId, tourney.id),
        eq(tournamentPlayers.playerId, input.playerId)
      )
    )
    .returning();
  if (!updated) {
    throw new Error('Competitor is not registered in this tournament');
  }

  if (!input.isDisqualified) {
    const dqSubs = await db
      .select()
      .from(qualifierSubmissions)
      .where(
        and(
          eq(qualifierSubmissions.tournamentId, tourney.id),
          eq(qualifierSubmissions.playerId, input.playerId),
          eq(qualifierSubmissions.status, 'DQ')
        )
      );
    const liftNote = `[DQ LIFTED BY ${input.changedBy || 'Organizer'}]`;
    for (const sub of dqSubs) {
      await db
        .update(qualifierSubmissions)
        .set({
          status: 'SUBMITTED',
          judgeNotes: sub.judgeNotes ? `${sub.judgeNotes}\n${liftNote}` : liftNote,
          verifiedBy: null,
          verifiedAt: null,
        })
        .where(eq(qualifierSubmissions.id, sub.id));
    }
  }
}

/**
 * Opens or closes online qualifying (organizer toggle). Kept out of the full-tournament save so a
 * stale tab can't silently reopen or close quals. In-person tournaments can never be opened.
 */
export async function setOnlineQualsOpen(tournamentIdOrSlug: string, open: boolean): Promise<void> {
  const db = getDb();
  const tourney = await resolveTournamentRow(tournamentIdOrSlug);
  if (open && tourney.qualMode === 'IN_PERSON') {
    throw new Error('Online qualifying is not available for in-person tournaments');
  }
  await db
    .update(tournaments)
    .set({ onlineQualsOpen: open })
    .where(eq(tournaments.id, tourney.id));
}
