import {
  qualifierSubmissions,
  qualifierRuns,
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
import {
  attachOrphanScoresToRuns,
  getRunForPlayer,
  insertRunScores,
  listRunScores,
  listRuns,
  replaceRunScores,
  type QualRunRow,
} from './qualRuns';
import { getReassignBlockReason } from '../features/online-quals/reassignRules';

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
  runId: string;
  submittedAt: number | null;
  verifiedBy: string | null;
  verifiedAt: number | null;
  // Only startOnlineQualSession sets this: true when it created the run, not when it resumed one.
  isNewSession?: boolean;
  // Only set for the competitor's own in-progress run (start / get-by-token); never in public or judge listings.
  resumeToken?: string;
  draft?: QualRunDraft | null;
}

/** Thrown when a run token is missing, wrong, or no longer refers to an in-progress run. */
export class QualRunAccessError extends Error {}

/** Thrown when a change is attempted on a verified (locked) qual. */
export class QualLockedError extends Error {}

/** Thrown when a change conflicts with another qual (e.g. reassigning onto a player who has one). */
export class QualConflictError extends Error {}

const QUAL_LOCKED_MESSAGE = 'This qual is verified. Unverify it before making changes.';

function assertRunEditable(run: { status: string }): void {
  if (run.status === 'VERIFIED') throw new QualLockedError(QUAL_LOCKED_MESSAGE);
}

function generateResumeToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

function isUuid(val: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
}

/** Quals are closed exactly when brackets are locked (metadata.isLocked is the source of truth). */
function areQualsClosed(tourney: { metadata: unknown }): boolean {
  return Boolean(((tourney.metadata as Record<string, any>) || {}).isLocked);
}

async function resolveTournamentRow(tournamentIdOrSlug: string) {
  const db = getDb();
  const [tourney] = await db
    .select()
    .from(tournaments)
    .where(isUuid(tournamentIdOrSlug) ? eq(tournaments.id, tournamentIdOrSlug) : eq(tournaments.slug, tournamentIdOrSlug))
    .limit(1);
  if (!tourney) throw new Error('Tournament not found');
  await attachOrphanScoresToRuns(tourney.id);
  return tourney;
}

type TournamentRow = typeof tournaments.$inferSelect;
type ScoreRow = { id: string; score: number; createdAt: Date };

/** The session summary every qual API returns. Never includes the run token or draft. */
function buildSessionSummary(
  tourney: TournamentRow,
  run: QualRunRow,
  scoreRows: ScoreRow[],
  player?: { name: string } | null
): OnlineQualSessionSummary {
  const isOnline = run.submissionSource === 'ONLINE';
  const qualWindowMinutes = tourney.qualWindowMinutes ?? 90;
  const ordered = [...scoreRows].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  return {
    tournamentId: tourney.id,
    playerId: run.playerId,
    playerName: player?.name,
    submissionSource: run.submissionSource,
    status: run.status,
    authWord: isOnline ? (run.authWord || 'ROCKET') : (run.authWord || null),
    twitchVodUrl: run.twitchVodUrl || null,
    submittedTwitchId: run.submittedTwitchId || null,
    submittedTwitchUsername: run.submittedTwitchUsername || null,
    identityStatus: run.identityStatus || (isOnline ? null : 'VERIFIED_MATCH'),
    timerLog: run.timerLog || {
      startedAt: run.createdAt.getTime(),
      elapsedSeconds: isOnline ? 0 : qualWindowMinutes * 60,
      pauses: [],
    },
    scores: ordered.map(r => r.score),
    judgeNotes: run.judgeNotes || null,
    playerNotes: run.playerNotes || null,
    submissionIds: ordered.map(r => r.id),
    runId: run.id,
    submittedAt: run.submittedAt ? run.submittedAt.getTime() : null,
    verifiedBy: run.verifiedBy || null,
    verifiedAt: run.verifiedAt ? run.verifiedAt.getTime() : null,
  };
}

async function loadPlayerName(playerId: string): Promise<{ name: string } | null> {
  const [player] = await getDb().select({ name: players.name }).from(players).where(eq(players.id, playerId)).limit(1);
  return player || null;
}

async function summarizeRun(tourney: TournamentRow, run: QualRunRow): Promise<OnlineQualSessionSummary> {
  return buildSessionSummary(tourney, run, await listRunScores(run.id), await loadPlayerName(run.playerId));
}

async function updateRun(runId: string, values: Partial<typeof qualifierRuns.$inferInsert>): Promise<QualRunRow> {
  const [updated] = await getDb().update(qualifierRuns).set(values).where(eq(qualifierRuns.id, runId)).returning();
  return updated as QualRunRow;
}

interface RecordScoreOptions {
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

const NOT_SUBMITTED_ERROR = "This run hasn't been submitted yet.";
const NO_SCORES_TO_VERIFY_ERROR = 'Add at least one score before verifying this qual.';

const RUN_IN_PROGRESS_ERROR =
  'This competitor has an online run in progress. Wait for them to submit, or discard the run first.';

/** Adds one score to the player's qual, creating the qual (in person by default) if they have none. */
async function recordScore(
  tourney: TournamentRow,
  playerId: string,
  score: number,
  options: RecordScoreOptions = {}
): Promise<QualifierSubmissionRecord> {
  let run = await getRunForPlayer(tourney.id, playerId);
  if (run?.status === 'IN_PROGRESS') throw new Error(RUN_IN_PROGRESS_ERROR);
  if (run) assertRunEditable(run);

  // Ensure competitor is registered in tournament roster so leaderboard derivation and bracket seeding recognize them
  await ensureTournamentPlayerRegistration(tourney.id, playerId);

  const now = new Date();
  if (!run) {
    const status = options.status ?? 'SUBMITTED';
    const [created] = await getDb()
      .insert(qualifierRuns)
      .values({
        tournamentId: tourney.id,
        playerId,
        submissionSource: options.submissionSource ?? 'IN_PERSON',
        status: status === 'NOT_STARTED' ? 'SUBMITTED' : status,
        authWord: options.authWord || null,
        twitchVodUrl: options.twitchVodUrl || null,
        submittedTwitchId: options.submittedTwitchId || null,
        submittedTwitchUsername: options.submittedTwitchUsername || null,
        identityStatus: options.identityStatus || null,
        timerLog: options.timerLog || null,
        judgeNotes: options.judgeNotes || null,
        submittedAt: now,
      })
      .returning();
    run = created as QualRunRow;
  }

  const [id] = await insertRunScores(run, [score], now);
  return {
    id,
    tournamentId: run.tournamentId,
    playerId: run.playerId,
    score,
    submissionSource: run.submissionSource,
    authWord: run.authWord,
    twitchVodUrl: run.twitchVodUrl,
    submittedTwitchId: run.submittedTwitchId,
    submittedTwitchUsername: run.submittedTwitchUsername,
    identityStatus: run.identityStatus,
    status: run.status,
    timerLog: run.timerLog,
    judgeNotes: run.judgeNotes,
    playerNotes: run.playerNotes,
    resumeToken: null,
    draft: null,
    verifiedBy: run.verifiedBy,
    verifiedAt: run.verifiedAt,
    createdAt: now,
  };
}

export async function submitQualifierScore(
  tournamentId: string,
  playerId: string,
  score: number,
  options?: RecordScoreOptions
): Promise<QualifierSubmissionRecord> {
  if (score < 0) throw new Error('Score must be positive');

  const tourney = await resolveTournamentRow(tournamentId);
  if (areQualsClosed(tourney)) throw new Error('Qualifiers are closed for this tournament');

  return recordScore(tourney, playerId, score, options);
}

export async function submitQualifiersBatch(
  tournamentId: string,
  submissions: Array<{ playerId: string; score: number } & RecordScoreOptions>
): Promise<QualifierSubmissionRecord[]> {
  if (submissions.length === 0) return [];
  const tourney = await resolveTournamentRow(tournamentId);
  if (areQualsClosed(tourney)) throw new Error('Qualifiers are closed for this tournament');

  const results: QualifierSubmissionRecord[] = [];
  for (const { playerId, score, ...options } of submissions) {
    results.push(await recordScore(tourney, playerId, score, options));
  }
  return results;
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
  const deletedRuns = await db
    .delete(qualifierRuns)
    .where(eq(qualifierRuns.tournamentId, resolvedTourneyId))
    .returning({ id: qualifierRuns.id });
  const deletedRows = await db
    .delete(qualifierSubmissions)
    .where(eq(qualifierSubmissions.tournamentId, resolvedTourneyId))
    .returning({ id: qualifierSubmissions.id });
  await db
    .update(tournamentPlayers)
    .set({ qualsCompleted: false })
    .where(eq(tournamentPlayers.tournamentId, resolvedTourneyId));
  return deletedRuns.length > 0 || deletedRows.length > 0;
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

  // Score rows only; in-progress online runs have none (resolveTournamentRow removed legacy placeholders).
  const allSubmissions = await db
    .select({ playerId: qualifierSubmissions.playerId, score: qualifierSubmissions.score })
    .from(qualifierSubmissions)
    .where(eq(qualifierSubmissions.tournamentId, resolvedTourneyId))
    .orderBy(desc(qualifierSubmissions.score));

  const playerScores = new Map<string, number[]>();
  for (const s of allSubmissions) {
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
  const tourney = await resolveTournamentRow(tournamentIdOrSlug);

  let run: QualRunRow | null = query.playerId ? await getRunForPlayer(tourney.id, query.playerId) : null;
  if (!run && query.twitchId) {
    run = (await listRuns(tourney.id)).find(r => r.submittedTwitchId === query.twitchId) || null;
  }
  if (!run) return null;
  return summarizeRun(tourney, run);
}

export interface ReviewQueueSessionSummary extends OnlineQualSessionSummary {
  playerName: string;
  country?: string;
  avatarUrl?: string;
  avatarType?: string;
}

/**
 * Lists all online and in-person qualifier sessions for a tournament, one per qual run (Track 10E).
 */
export async function listOnlineQualSessions(
  tournamentIdOrSlug: string
): Promise<ReviewQueueSessionSummary[]> {
  const db = getDb();
  const tourney = await resolveTournamentRow(tournamentIdOrSlug);

  const runs = await listRuns(tourney.id);
  if (runs.length === 0) return [];

  const scoreRows = await db
    .select({
      id: qualifierSubmissions.id,
      runId: qualifierSubmissions.runId,
      score: qualifierSubmissions.score,
      createdAt: qualifierSubmissions.createdAt,
    })
    .from(qualifierSubmissions)
    .where(eq(qualifierSubmissions.tournamentId, tourney.id));
  const scoresByRun = new Map<string, ScoreRow[]>();
  for (const row of scoreRows) {
    if (!row.runId) continue;
    const list = scoresByRun.get(row.runId) || [];
    list.push(row);
    scoresByRun.set(row.runId, list);
  }

  const allPlayers = (await db.select().from(players)) as Array<typeof players.$inferSelect>;
  const playerMap = new Map<string, typeof players.$inferSelect>(
    allPlayers.map(p => [p.id, p])
  );

  return runs.map(run => {
    const p = playerMap.get(run.playerId);
    return {
      ...buildSessionSummary(tourney, run, scoresByRun.get(run.id) || [], p),
      playerName: p?.name || run.submittedTwitchUsername || 'Unknown Player',
      country: p?.country || undefined,
      avatarUrl: p?.avatarUrl || undefined,
      avatarType: p?.avatarType || 'flag',
    };
  });
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

const PREVIEW_DISCORD_DISABLED =
  'Discord posting is disabled on preview deploys. Set DISCORD_WEBHOOK_OVERRIDE_URL to post to a test channel.';

/**
 * Where a Discord post is actually delivered. DISCORD_WEBHOOK_OVERRIDE_URL (set for Vercel Preview,
 * optionally in a local .env) redirects every post to a test channel. A preview deploy without a valid
 * override posts nothing, so production data copied into the preview database never reaches real channels.
 */
export function resolveDiscordDeliveryUrl(url: string): string | null {
  const override = (process.env.DISCORD_WEBHOOK_OVERRIDE_URL || '').trim();
  if (override) return isDiscordWebhookUrl(override) ? override : null;
  if (process.env.VERCEL_ENV === 'preview') return null;
  return url;
}

async function postToDiscord(url: string, content: string): Promise<boolean> {
  if (typeof fetch === 'undefined') return false;
  const deliveryUrl = resolveDiscordDeliveryUrl(url);
  if (!deliveryUrl) return false;
  try {
    const res = await fetch(deliveryUrl, {
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
): Promise<{ success: boolean; source?: 'tournament' | 'organization'; redirected?: boolean; error?: string }> {
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

  const deliveryUrl = resolveDiscordDeliveryUrl(target.url);
  if (!deliveryUrl) {
    return { success: false, source: target.source, error: PREVIEW_DISCORD_DISABLED };
  }
  const redirected = deliveryUrl !== target.url;

  const name = escapeDiscordMarkdown(tourney.name || 'Tournament');
  const content = redirected
    ? `🔔 Test from MatchFoundry for **${name}**, redirected here by DISCORD_WEBHOOK_OVERRIDE_URL. It was meant for the ${target.source} webhook; on this deploy every announcement posts to this channel instead.`
    : `🔔 Test from MatchFoundry: qual announcements for **${name}** will post here.`;
  const ok = await postToDiscord(target.url, content);
  return ok
    ? { success: true, source: target.source, redirected }
    : { success: false, source: target.source, redirected, error: 'Discord rejected the message or did not respond' };
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

  if (areQualsClosed(tourney)) {
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
  const existingRun = await getRunForPlayer(tourney.id, targetPlayerId);
  if (existingRun) {
    const existingSession = await summarizeRun(tourney, existingRun);
    return withRunCredentials(tourney.id, {
      ...existingSession,
      playerName: targetPlayerName || existingSession.playerName,
    });
  }

  // Gather already-used auth words in this tournament to avoid collisions
  const usedWords = (await listRuns(tourney.id))
    .map(r => r.authWord)
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
    .insert(qualifierRuns)
    .values({
      tournamentId: tourney.id,
      playerId: targetPlayerId,
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
    ...buildSessionSummary(tourney, inserted as QualRunRow, [], { name: targetPlayerName || '' }),
    playerName: targetPlayerName,
    submissionIds: [],
    isNewSession: true,
    resumeToken,
    draft: null,
  };
}

async function findInProgressRun(
  tournamentId: string,
  where: { playerId: string } | { resumeToken: string }
): Promise<QualRunRow | null> {
  const [run] = await getDb()
    .select()
    .from(qualifierRuns)
    .where(
      and(
        eq(qualifierRuns.tournamentId, tournamentId),
        eq(qualifierRuns.status, 'IN_PROGRESS'),
        'playerId' in where
          ? eq(qualifierRuns.playerId, where.playerId)
          : eq(qualifierRuns.resumeToken, where.resumeToken)
      )
    )
    .limit(1);
  return (run as QualRunRow | undefined) || null;
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
  const run = await findInProgressRun(tournamentId, { playerId: session.playerId });
  if (!run) return session;
  let resumeToken = run.resumeToken;
  if (!resumeToken) {
    resumeToken = generateResumeToken();
    await updateRun(run.id, { resumeToken });
  }
  return { ...session, resumeToken, draft: run.draft || null };
}

/** Loads the competitor's own in-progress run by its token (the `?run=` link). Null if not active. */
export async function getOnlineQualRunByToken(
  tournamentIdOrSlug: string,
  resumeToken: string
): Promise<OnlineQualSessionSummary | null> {
  if (!resumeToken) return null;
  const tourney = await resolveTournamentRow(tournamentIdOrSlug);
  const run = await findInProgressRun(tourney.id, { resumeToken });
  if (!run) return null;
  const session = await summarizeRun(tourney, run);
  return { ...session, resumeToken, draft: run.draft || null };
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
  const run = input.resumeToken ? await findInProgressRun(tourney.id, { resumeToken: input.resumeToken }) : null;
  if (!run) {
    throw new QualRunAccessError('This run link is no longer active');
  }
  const draft: QualRunDraft = {
    scores: validateQualScores(input.scores, { requireOne: false }),
    twitchVodUrl: typeof input.twitchVodUrl === 'string' ? input.twitchVodUrl.trim() : undefined,
    playerNotes: normalizePlayerNotes(input.playerNotes) || undefined,
  };
  await updateRun(run.id, { draft });
  return { savedAt: Date.now() };
}

/**
 * Judge action: throws away an unfinished online run. If the run created a player record that is
 * referenced nowhere else, that player is deleted too. Submitted or judged runs cannot be discarded.
 */
export async function discardOnlineQualRun(
  tournamentIdOrSlug: string,
  playerId: string
): Promise<{ deletedPlayer: boolean }> {
  const db = getDb();
  const tourney = await resolveTournamentRow(tournamentIdOrSlug);
  const run = await findInProgressRun(tourney.id, { playerId });
  if (!run) {
    throw new Error('No unfinished run found for this player');
  }

  const hasRealResults = (await listRunScores(run.id)).length > 0;
  await db.delete(qualifierRuns).where(eq(qualifierRuns.id, run.id));

  if (run.identityStatus !== 'PROVISIONAL_NEW') return { deletedPlayer: false };

  // A player created by this run: drop the roster entry (pre-token runs registered at start)
  // unless they have real results here, then the player record if nothing else references it.
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

/** Deletes a player row only if no submission, qual run, roster entry, or match anywhere references it. */
async function deletePlayerIfUnreferenced(playerId: string): Promise<boolean> {
  const db = getDb();
  const anySubs = await db
    .select({ id: qualifierSubmissions.id })
    .from(qualifierSubmissions)
    .where(eq(qualifierSubmissions.playerId, playerId))
    .limit(1);
  const anyRuns = await db
    .select({ id: qualifierRuns.id })
    .from(qualifierRuns)
    .where(eq(qualifierRuns.playerId, playerId))
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
  if (anySubs.length > 0 || anyRuns.length > 0 || anyTourneyPlayers.length > 0 || anyMatches.length > 0) return false;
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

  if (areQualsClosed(tourney)) {
    throw new Error('Qualifiers are closed for this tournament');
  }

  validateQualScores(input.scores, { requireOne: true });
  const cleanVod = (input.twitchVodUrl || '').trim();
  if (!cleanVod) {
    throw new Error('Twitch VOD URL is required');
  }

  let run = await getRunForPlayer(tourney.id, input.playerId);
  // A submitted (or judged) run can't be replaced by submitting again; only a judge reset reopens it.
  if (run && run.status !== 'IN_PROGRESS') {
    throw new Error('You have already submitted your qualifier run for this tournament');
  }
  // Runs issued a token can only be submitted by its holder. Runs started before tokens existed
  // have none and still submit by player ID.
  if (run?.resumeToken && run.resumeToken !== input.resumeToken) {
    throw new QualRunAccessError('This run link is no longer valid. Reload the page to continue your run.');
  }

  await ensureTournamentPlayerRegistration(tourney.id, input.playerId);
  const nowMs = input.nowMs ?? Date.now();
  const windowMinutes = tourney.qualWindowMinutes ?? meta.qualWindowMinutes ?? 90;

  const baseTimerLog = run?.timerLog || createInitialTimerLog(nowMs);
  const telemetry = computeTimerTelemetry(baseTimerLog, windowMinutes, nowMs);
  const finalTimerLog: QualTimerLog = {
    ...baseTimerLog,
    submittedAt: nowMs,
    elapsedSeconds: telemetry.elapsedSeconds,
    overTime: telemetry.overTime,
  };

  const authWord = run?.authWord || generateNesAuthword(tourney.customAuthWords as string[]);
  const submittedTwitchId = input.submittedTwitchId ?? run?.submittedTwitchId ?? null;
  const submittedTwitchUsername =
    input.submittedTwitchUsername ?? run?.submittedTwitchUsername ?? null;
  const identityStatus = input.identityStatus ?? run?.identityStatus ?? 'CLAIMED_PENDING_REVIEW';

  if (!run) {
    const [created] = await db
      .insert(qualifierRuns)
      .values({
        tournamentId: tourney.id,
        playerId: input.playerId,
        submissionSource: 'ONLINE',
        status: 'IN_PROGRESS',
        authWord,
        submittedTwitchId,
        submittedTwitchUsername,
        identityStatus,
        timerLog: baseTimerLog,
        createdAt: new Date(nowMs),
      })
      .returning();
    run = created as QualRunRow;
  }

  const submitted = await updateRun(run.id, {
    status: 'SUBMITTED',
    authWord,
    twitchVodUrl: cleanVod,
    submittedTwitchId,
    submittedTwitchUsername,
    identityStatus,
    timerLog: finalTimerLog,
    playerNotes,
    resumeToken: null,
    draft: null,
    submittedAt: new Date(nowMs),
  });
  await insertRunScores(submitted, input.scores, new Date(nowMs));

  return summarizeRun(tourney, submitted);
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

  const remainingRun = await getRunForPlayer(tournamentId, oldPlayerId);

  if (!remainingRun && !(await hasTournamentMatches(tournamentId, oldPlayerId))) {
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
    const hasRemainingVerified = remainingRun?.status === 'VERIFIED';
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

/** Moves a qual run and all its score rows to another player, marking the identity as confirmed. */
async function moveRunToPlayer(runId: string, playerId: string): Promise<void> {
  await updateRun(runId, { playerId, identityStatus: 'VERIFIED_MATCH' });
  await getDb().update(qualifierSubmissions).set({ playerId }).where(eq(qualifierSubmissions.runId, runId));
}

/**
 * Track 10E: Judge Review Queue adjudication & identity resolution mutations.
 */
export async function adjudicateOnlineSubmission(
  tournamentIdOrSlug: string,
  input: {
    playerId: string;
    action:
      | 'SAVE'
      | 'VERIFY'
      | 'SAVE_AND_VERIFY'
      | 'UNVERIFY'
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
  const run = await getRunForPlayer(tourney.id, input.playerId);
  if (!run) {
    throw new Error('Online qualifier submission not found for this player');
  }
  const existing = await summarizeRun(tourney, run);
  const refreshed = () => getOnlineQualSession(tourney.id, { playerId: input.playerId });

  const now = new Date();
  const judgeBy = input.verifiedBy || 'Judge';

  /** Writes edited scores and notes; never changes status. */
  const applySave = async () => {
    const next = validateQualScores(input.scores, { requireOne: false });
    const prev = existing.scores;
    let audit: string | null = null;
    if (prev.length !== next.length || prev.some((score, i) => score !== next[i])) {
      await replaceRunScores(run, next, run.submittedAt ?? now);
      audit = `[SCORES EDITED BY ${judgeBy}]: ${prev.join(', ') || 'none'} -> ${next.join(', ') || 'none'}`;
    }
    const base = input.judgeNotes !== undefined ? (input.judgeNotes.trim() || null) : run.judgeNotes;
    const judgeNotes = audit ? (base ? `${base}\n${audit}` : audit) : base;
    await updateRun(run.id, { judgeNotes });
    return { scoreCount: next.length, judgeNotes };
  };

  const applyVerify = async (judgeNotes: string | null) => {
    await updateRun(run.id, {
      status: 'VERIFIED',
      identityStatus: 'VERIFIED_MATCH',
      judgeNotes,
      verifiedBy: judgeBy,
      verifiedAt: now,
    });
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
  };

  if (input.action === 'VERIFY') {
    if (run.status === 'IN_PROGRESS') throw new Error(NOT_SUBMITTED_ERROR);
    if (run.status === 'VERIFIED') return existing;
    if (existing.scores.length === 0) throw new Error(NO_SCORES_TO_VERIFY_ERROR);
    await applyVerify(input.judgeNotes?.trim() || existing.judgeNotes || null);
    return refreshed();
  }

  if (input.action === 'SAVE' || input.action === 'SAVE_AND_VERIFY') {
    if (run.status === 'IN_PROGRESS') throw new Error(NOT_SUBMITTED_ERROR);
    assertRunEditable(run);
    if (input.action === 'SAVE_AND_VERIFY') {
      // Check before writing anything, so a refused verify never leaves a half-applied save.
      const next = validateQualScores(input.scores, { requireOne: false });
      if (next.length === 0) throw new Error(NO_SCORES_TO_VERIFY_ERROR);
    }
    const saved = await applySave();
    if (input.action === 'SAVE_AND_VERIFY') await applyVerify(saved.judgeNotes);
    return refreshed();
  }

  if (input.action === 'UNVERIFY') {
    if (run.status !== 'VERIFIED') throw new Error('Only a verified qual can be unverified.');
    const line = `[UNVERIFIED BY ${judgeBy}]`;
    await updateRun(run.id, {
      status: 'SUBMITTED',
      verifiedBy: null,
      verifiedAt: null,
      judgeNotes: run.judgeNotes ? `${run.judgeNotes}\n${line}` : line,
    });
    await db
      .update(tournamentPlayers)
      .set({ qualsCompleted: false })
      .where(
        and(
          eq(tournamentPlayers.tournamentId, tourney.id),
          eq(tournamentPlayers.playerId, input.playerId)
        )
      );
    return refreshed();
  }

  if (input.action === 'DNQ') {
    assertRunEditable(run);
    const note = input.judgeNotes?.trim()
      ? existing.judgeNotes
        ? `${existing.judgeNotes}\n[DNQ]: ${input.judgeNotes.trim()}`
        : `[DNQ]: ${input.judgeNotes.trim()}`
      : existing.judgeNotes || '[DNQ]: Marked DNQ by judge';

    await updateRun(run.id, { status: 'DNQ', judgeNotes: note, verifiedBy: judgeBy, verifiedAt: now });
    await db
      .update(tournamentPlayers)
      .set({ qualsCompleted: false, isDisqualified: false })
      .where(
        and(
          eq(tournamentPlayers.tournamentId, tourney.id),
          eq(tournamentPlayers.playerId, input.playerId)
        )
      );
    return refreshed();
  }

  if (input.action === 'DQ') {
    assertRunEditable(run);
    const note = input.judgeNotes?.trim()
      ? existing.judgeNotes
        ? `${existing.judgeNotes}\n[DQ]: ${input.judgeNotes.trim()}`
        : `[DQ]: ${input.judgeNotes.trim()}`
      : existing.judgeNotes || '[DQ]: Disqualified by judge';

    // Tournament-scoped DQ: reversible by a later VERIFY / DNQ ruling
    await db
      .update(tournamentPlayers)
      .set({ isDisqualified: true, qualsCompleted: false })
      .where(
        and(
          eq(tournamentPlayers.tournamentId, tourney.id),
          eq(tournamentPlayers.playerId, input.playerId)
        )
      );

    await updateRun(run.id, { status: 'DQ', judgeNotes: note, verifiedBy: judgeBy, verifiedAt: now });
    return refreshed();
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

    await updateRun(run.id, { identityStatus: 'VERIFIED_MATCH' });
    return refreshed();
  }

  if (input.action === 'REASSIGN_PLAYER') {
    assertRunEditable(run);
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
    if (targetPlayer.id !== input.playerId) {
      const targetRun = await getRunForPlayer(tourney.id, targetPlayer.id);
      if (targetRun) {
        const scoreCount = (await listRunScores(targetRun.id)).length;
        const reason = getReassignBlockReason(targetPlayer.name, { status: targetRun.status, scoreCount });
        if (reason) {
          throw targetRun.status === 'VERIFIED' ? new QualLockedError(reason) : new QualConflictError(reason);
        }
        // An empty, unverified qual holds nothing worth keeping: this run replaces it.
        await db.delete(qualifierRuns).where(eq(qualifierRuns.id, targetRun.id));
      }
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

    await moveRunToPlayer(run.id, targetPlayer.id);

    await cleanupSourcePlayerAfterReassign(
      tourney.id,
      input.playerId,
      targetPlayer.id,
      wasProvisional
    );

    return getOnlineQualSession(tourney.id, { playerId: targetPlayer.id });
  }

  if (input.action === 'CREATE_NEW_PLAYER') {
    assertRunEditable(run);
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

    await moveRunToPlayer(run.id, createdPlayer.id);

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
  // A qual with no scores can't be verified; it stays pending until scores are added or it is removed.
  const unverified = sessions.filter(s => s.status === 'SUBMITTED' && s.scores.length > 0);

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
 * Lifting a DQ sends a DQ'd qual back to SUBMITTED so they re-enter the judge review queue.
 */
export async function setTournamentPlayerDisqualification(
  tournamentIdOrSlug: string,
  input: { playerId: string; isDisqualified: boolean; changedBy?: string }
): Promise<void> {
  const db = getDb();
  const tourney = await resolveTournamentRow(tournamentIdOrSlug);

  if (input.isDisqualified) {
    const run = await getRunForPlayer(tourney.id, input.playerId);
    if (run) assertRunEditable(run);
  }

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
    const run = await getRunForPlayer(tourney.id, input.playerId);
    if (run?.status === 'DQ') {
      const liftNote = `[DQ LIFTED BY ${input.changedBy || 'Organizer'}]`;
      await updateRun(run.id, {
        status: 'SUBMITTED',
        judgeNotes: run.judgeNotes ? `${run.judgeNotes}\n${liftNote}` : liftNote,
        verifiedBy: null,
        verifiedAt: null,
      });
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
