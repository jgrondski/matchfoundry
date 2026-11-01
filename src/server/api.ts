import { getDb, tournaments, systemSettings, tournamentPlayers, qualifierSubmissions } from '../db';
import { sql, eq, or, and } from 'drizzle-orm';
import type { IncomingMessage, ServerResponse } from 'http';
import {
  encryptPin,
  decryptPin,
  createSessionToken,
  verifySessionToken,
  isSystemRecoveryPin,
  safeCompareStrings,
  type SessionPayload,
} from './pinCrypto';
import {
  createPlayer,
  createPlayersBatch,
  listPlayers,
  getPlayer,
  updatePlayer,
  deletePlayer,
  deleteAllUnattachedPlayers,
} from '../api/players';
import {
  listFullTournaments,
  getFullTournament,
  saveFullTournament,
  deleteTournament,
  isUuid,
} from '../api/tournaments';
import {
  submitQualifierScore,
  submitQualifiersBatch,
  clearTournamentQualifiers,
  resolveTwitchIdentity,
  claimOrRegisterOnlineCompetitor,
  getOnlineQualSession,
  startOnlineQualSession,
  submitOnlineQualScores,
  adjudicateOnlineSubmission,
  verifyAllQualifierSubmissions,
  setTournamentPlayerDisqualification,
  setOnlineQualsOpen,
  sendTestDiscordWebhook,
  listOnlineQualSessions,
  dispatchDiscordWebhook,
  getOnlineQualRunByToken,
  saveOnlineQualDraft,
  discardOnlineQualRun,
  QualRunAccessError,
} from '../api/qualifiers';
import { isPlaceholderSubmissionStatus } from '../features/online-quals/onlineQualsStatus';
import { clearTournamentMatches } from '../api/brackets';
import {
  listOrganizations,
  getOrganizationById,
  createOrganization,
  updateOrganization,
  deleteOrganization,
  seedDefaultOrganizations,
} from '../api/organizations';
import {
  runFullSimulation,
  generateSimulatedQualifiers,
  generateAdditionalFakePlayers,
  getSimulatedQualifierTargetCount,
} from '../features/tournament/simulation';
import { AUTHENTIC_COMPETITOR_NAMES } from '../features/tournament/data/authenticPlayers';
import {
  generateTraditionalBracket,
  generateFlatBracket,
  advanceMatchWinner,
  retractMatchWinner,
  swapMatchSlots,
} from '../features/bracket/math';
import { generateDraftBracketsForTournament } from '../features/qualifiers/scoring';
import type {
  Tournament,
  PlayerProfile,
  MatchScoreRecord,
  GameScoreEntry,
  Organization,
} from '../features/tournament/types';
import { DEFAULT_TIER_THEME, TIER_THEMES } from '../theme/palette';
import { isSimulationAllowed, SIMULATION_DISABLED_MESSAGE } from '../utils/simulationEnv';

/**
 * Loads the global player supply for a qualifier simulation, first creating real player rows if
 * the global pool can't cover the largest possible simulated field. The simulator would otherwise
 * invent non-UUID players that saveFullTournament silently drops while brackets still reference them.
 */
async function loadSimulationPlayerSupply(t: Tournament): Promise<PlayerProfile[]> {
  const toProfile = (p: Awaited<ReturnType<typeof listPlayers>>[number]): PlayerProfile => ({
    id: p.id,
    name: p.name,
    country: p.country || undefined,
    avatarType: p.avatarType,
    avatarUrl: p.avatarUrl || undefined,
    personalBest: p.personalBest,
    playstyle: (p.playstyle as PlayerProfile['playstyle']) || 'Rolling',
    // DQ is tournament-scoped; the legacy global flag must not leak into simulated rosters
    isDisqualified: false,
  });
  const profiles = (await listPlayers()).map(toProfile);

  const pool = t.playersPool || [];
  const poolIds = new Set(pool.map(p => p.id));
  const poolNames = new Set(pool.map(p => p.name.toLowerCase()));
  const available = profiles.filter(p => !poolIds.has(p.id) && !poolNames.has(p.name.toLowerCase()));
  const needed = getSimulatedQualifierTargetCount(t, 6) - pool.length - available.length;

  if (needed > 0) {
    const fakes = generateAdditionalFakePlayers(needed, [...pool, ...profiles]);
    const created = await createPlayersBatch(
      fakes.map(f => ({ name: f.name, country: f.country, personalBest: f.personalBest, playstyle: f.playstyle }))
    );
    profiles.push(...created.map(toProfile));
  }
  return profiles;
}

/** Marks every competitor with simulated (pre-verified) runs as having completed quals. */
function markSimulatedQualsCompleted(t: Tournament): void {
  const simulatedIds = new Set(
    (t.qualifierSubmissions || []).filter(s => s.verifiedBy === 'Simulation').map(s => s.playerId)
  );
  const tournamentPlayers = { ...(t.tournamentPlayers || {}) };
  for (const playerId of simulatedIds) {
    tournamentPlayers[playerId] = {
      ...(tournamentPlayers[playerId] || { playerId, tournamentId: t.id }),
      qualsCompleted: true,
      isVerified: true,
    };
  }
  t.tournamentPlayers = tournamentPlayers;
}

async function parseBody(req: IncomingMessage): Promise<unknown> {
  if (req.method === 'GET' || req.method === 'HEAD') return undefined;
  if (typeof req.on !== 'function') return {};
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error('Invalid JSON payload'));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res: ServerResponse, status: number, data: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

function sendError(res: ServerResponse, status: number, message: string) {
  sendJson(res, status, { error: message });
}

/** Non-failing counterpart to checkAuth: the caller's session, or null, without writing a response. */
function getRequestSession(req: IncomingMessage): SessionPayload | null {
  const authHeader = (req.headers && req.headers['authorization']) || '';
  if (!authHeader.startsWith('Bearer ')) return null;
  return verifySessionToken(authHeader.slice(7).trim());
}

function isSystemSession(session: SessionPayload | null): boolean {
  return Boolean(session && (session.role === 'SYSTEM_ADMIN' || session.role === 'MASTER_ADMIN'));
}

function sessionCanManageTournament(session: SessionPayload | null, t: { id: string; slug: string }): boolean {
  if (!session) return false;
  if (isSystemSession(session)) return true;
  if (session.role !== 'TOURNAMENT_ADMIN') return false;
  return (
    session.tournamentId === t.id ||
    session.tournamentSlug === t.slug ||
    Boolean(session.tournamentIds?.includes(t.id)) ||
    Boolean(session.tournamentSlugs?.includes(t.slug))
  );
}

// A Discord webhook URL lets anyone holding it post to the channel, so public reads omit it.
function redactTournamentForCaller(t: Tournament, session: SessionPayload | null): Tournament {
  if (sessionCanManageTournament(session, t)) return t;
  const { discordWebhookUrl: _webhook, ...rest } = t;
  return rest;
}

function redactOrganizationForCaller(org: Organization, session: SessionPayload | null): Organization {
  if (isSystemSession(session)) return org;
  const { discordWebhookUrl, ...rest } = org;
  return { ...rest, hasDiscordWebhook: Boolean(discordWebhookUrl) };
}

function checkAuth(
  req: IncomingMessage,
  res: ServerResponse,
  requiredRole: 'SYSTEM_ADMIN' | 'TOURNAMENT_ADMIN' | 'MASTER_ADMIN',
  targetTournamentId?: string
): SessionPayload | null {
  const authHeader = (req.headers && req.headers['authorization']) || '';
  if (!authHeader.startsWith('Bearer ')) {
    sendError(res, 401, 'Unauthorized: Admin session token required');
    return null;
  }
  const token = authHeader.slice(7).trim();
  const session = verifySessionToken(token);
  if (!session) {
    sendError(res, 401, 'Unauthorized: Invalid or expired session token');
    return null;
  }
  if (session.role === 'SYSTEM_ADMIN' || session.role === 'MASTER_ADMIN') {
    return session;
  }
  if (requiredRole === 'TOURNAMENT_ADMIN') {
    if (session.role === 'TOURNAMENT_ADMIN') {
      if (
        !targetTournamentId ||
        session.tournamentId === targetTournamentId ||
        session.tournamentSlug === targetTournamentId ||
        session.tournamentIds?.includes(targetTournamentId) ||
        session.tournamentSlugs?.includes(targetTournamentId)
      ) {
        return session;
      }
      sendError(res, 403, 'Forbidden: Tournament Admin scope does not match this tournament');
      return null;
    }
  }
  sendError(res, 403, 'Forbidden: Requires System Admin permissions');
  return null;
}

export function createApiMiddleware() {
  return async (req: IncomingMessage, res: ServerResponse, _next?: () => void) => {
    const forwardedUrl =
      (req.headers?.['x-matched-path'] as string) ||
      (req.headers?.['x-forwarded-url'] as string) ||
      req.url ||
      '';
    let rawUrl = forwardedUrl;

    // In Vite dev server (where _next is provided), pass non-API requests through to Vite
    if (_next && !rawUrl.startsWith('/api')) {
      return _next();
    }

    if (!rawUrl.startsWith('/api')) {
      rawUrl = '/api' + (rawUrl.startsWith('/') ? rawUrl : '/' + rawUrl);
    }

    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }

    const url = new URL(rawUrl, 'http://localhost');
    const pathname = url.pathname;
    const method = req.method || 'GET';

    try {
      const body: any = await parseBody(req);

      // GET /api root ping
      if ((pathname === '/api' || pathname === '/api/') && method === 'GET') {
        return sendJson(res, 200, { status: 'ok', service: 'matchfoundry-api', timestamp: Date.now() });
      }

      // GET /api/health
      if (pathname === '/api/health' && method === 'GET') {

        try {
          const db = getDb();
          await db.execute(sql`SELECT 1`);
          return sendJson(res, 200, { status: 'ok', db: 'connected', timestamp: Date.now() });
        } catch (err: any) {
          return sendJson(res, 503, {
            status: 'error',
            db: 'disconnected',
            error: err.message || 'Database connection failed',
            timestamp: Date.now(),
          });
        }
      }

      // POST /api/client-log
      if (pathname === '/api/client-log' && method === 'POST') {
        console.error('[CLIENT RUNTIME ERROR]:', JSON.stringify(body, null, 2));
        return sendJson(res, 200, { ok: true });
      }

      // --- AUTHENTICATION & PIN ENDPOINTS ---
      // POST /api/auth/pin
      if (pathname === '/api/auth/pin' && method === 'POST') {
        const candidatePin = typeof body?.pin === 'string' ? body.pin.trim() : '';
        const tournamentSlugOrId = typeof body?.tournamentSlugOrId === 'string' ? body.tournamentSlugOrId.trim() : undefined;

        if (!candidatePin) {
          return sendError(res, 400, 'PIN is required');
        }

        // 1. Check System Recovery PIN from environment variable
        if (isSystemRecoveryPin(candidatePin)) {
          const token = createSessionToken({ role: 'SYSTEM_ADMIN' });
          return sendJson(res, 200, {
            success: true,
            role: 'SYSTEM_ADMIN',
            token,
          });
        }

        // 2. Check System PIN from system_settings table
        try {
          const db = getDb();
          const masterSetting = await db
            .select()
            .from(systemSettings)
            .where(eq(systemSettings.key, 'master_credentials'));
          if (masterSetting.length > 0) {
            const val = masterSetting[0].value as any;
            if (val?.masterPinEncrypted) {
              const storedPin = decryptPin(val.masterPinEncrypted);
              if (safeCompareStrings(candidatePin, storedPin)) {
                const token = createSessionToken({ role: 'SYSTEM_ADMIN' });
                return sendJson(res, 200, {
                  success: true,
                  role: 'SYSTEM_ADMIN',
                  token,
                });
              }
            }
          }
        } catch {
          // Ignore DB / decryption error and continue
        }

        // Dev fallback for System Admin if no Recovery PIN is configured and not in production
        const rawRecoveryPin = (process.env.SYSTEM_ADMIN_RECOVERY_PIN || process.env.MASTER_ADMIN_RECOVERY_PIN || '').trim();
        const cleanRecoveryPin = rawRecoveryPin.replace(/^["']|["']$/g, '').trim();
        const hasConfiguredRecoveryPin = Boolean(cleanRecoveryPin);
        if (process.env.NODE_ENV !== 'production' && !hasConfiguredRecoveryPin) {
          if (safeCompareStrings(candidatePin, 'admin') || safeCompareStrings(candidatePin, '0000')) {
            const token = createSessionToken({ role: 'SYSTEM_ADMIN' });
            return sendJson(res, 200, {
              success: true,
              role: 'SYSTEM_ADMIN',
              token,
            });
          }
        }

        // 3. Check Tournament PINs across all tournaments
        try {
          const db = getDb();
          const allTourneys = await db.select().from(tournaments);
          type TournamentRow = typeof tournaments.$inferSelect;
          const matchingTourneys: TournamentRow[] = [];

          for (const t of allTourneys) {
            if (t.adminPinEncrypted) {
              try {
                const storedPin = decryptPin(t.adminPinEncrypted);
                if (safeCompareStrings(candidatePin, storedPin)) {
                  matchingTourneys.push(t);
                }
              } catch {
                // Ignore decryption error
              }
            }
          }

          if (matchingTourneys.length > 0) {
            // If the user specified a tournament scope, verify that it's among the matches
            if (tournamentSlugOrId) {
              const scopedMatch = matchingTourneys.find(
                (t: TournamentRow) => t.id === tournamentSlugOrId || t.slug === tournamentSlugOrId
              );
              if (!scopedMatch) {
                return sendError(res, 401, 'Invalid PIN for selected tournament');
              }
            }

            const primaryTourney = tournamentSlugOrId
              ? (matchingTourneys.find((t: TournamentRow) => t.id === tournamentSlugOrId || t.slug === tournamentSlugOrId) || matchingTourneys[0])
              : matchingTourneys[0];

            const tournamentIds = matchingTourneys.map((t: TournamentRow) => t.id);
            const tournamentSlugs = matchingTourneys.map((t: TournamentRow) => t.slug);

            const token = createSessionToken({
              role: 'TOURNAMENT_ADMIN',
              tournamentId: primaryTourney.id,
              tournamentSlug: primaryTourney.slug,
              tournamentIds,
              tournamentSlugs,
            });

            return sendJson(res, 200, {
              success: true,
              role: 'TOURNAMENT_ADMIN',
              tournamentId: primaryTourney.id,
              tournamentSlug: primaryTourney.slug,
              tournamentIds,
              tournamentSlugs,
              token,
            });
          }
        } catch {
          // Ignore DB error
        }

        return sendError(res, 401, 'Invalid PIN');
      }

      // GET /api/auth/session
      if (pathname === '/api/auth/session' && method === 'GET') {
        const authHeader = (req.headers && req.headers['authorization']) || '';
        if (!authHeader.startsWith('Bearer ')) {
          return sendJson(res, 200, { valid: false });
        }
        const session = verifySessionToken(authHeader.slice(7).trim());
        if (!session) {
          return sendJson(res, 200, { valid: false });
        }
        return sendJson(res, 200, {
          valid: true,
          role: session.role,
          tournamentId: session.tournamentId,
          tournamentSlug: session.tournamentSlug,
          tournamentIds: session.tournamentIds,
          tournamentSlugs: session.tournamentSlugs,
          expiresAt: session.expiresAt,
        });
      }

      // PUT /api/auth/system-pin (and legacy /api/auth/master-pin)
      if ((pathname === '/api/auth/system-pin' || pathname === '/api/auth/master-pin') && method === 'PUT') {
        if (!checkAuth(req, res, 'SYSTEM_ADMIN')) return;
        const newPin = typeof body?.pin === 'string' ? body.pin.trim() : '';
        if (!newPin) return sendError(res, 400, 'New PIN is required');
        const db = getDb();
        const encrypted = encryptPin(newPin);
        const existing = await db
          .select()
          .from(systemSettings)
          .where(eq(systemSettings.key, 'master_credentials'));
        if (existing.length > 0) {
          await db
            .update(systemSettings)
            .set({ value: { masterPinEncrypted: encrypted }, updatedAt: new Date() })
            .where(eq(systemSettings.key, 'master_credentials'));
        } else {
          await db.insert(systemSettings).values({
            key: 'master_credentials',
            value: { masterPinEncrypted: encrypted },
          });
        }
        return sendJson(res, 200, { success: true });
      }

      // --- TWITCH OAUTH 2.0 ENDPOINTS ---
      // GET /api/auth/twitch/authorize (and POST)
      if (pathname === '/api/auth/twitch/authorize' && (method === 'GET' || method === 'POST')) {
        const redirectUri =
          url.searchParams.get('redirect_uri') ||
          url.searchParams.get('redirectUri') ||
          body?.redirectUri ||
          body?.redirect_uri ||
          '';
        const state =
          url.searchParams.get('state') ||
          body?.state ||
          '';
        const mockParam = url.searchParams.get('mock');
        const isMock =
          mockParam === 'true' ||
          body?.mock === true ||
          !process.env.TWITCH_CLIENT_ID;
        const mockUsername =
          url.searchParams.get('mock_username') ||
          url.searchParams.get('mockUsername') ||
          body?.mockUsername ||
          'MockCompetitor';

        if (isMock) {
          const mockCode = `mock_code_${encodeURIComponent(mockUsername)}`;
          const mockRedirectUrl = redirectUri
            ? `${redirectUri}${redirectUri.includes('?') ? '&' : '?'}code=${mockCode}&state=${encodeURIComponent(state)}`
            : `/mock-auth-callback?code=${mockCode}&state=${encodeURIComponent(state)}`;

          if (
            url.searchParams.get('format') === 'json' ||
            (req.headers.accept && req.headers.accept.includes('application/json')) ||
            method === 'POST'
          ) {
            return sendJson(res, 200, {
              url: mockRedirectUrl,
              mock: true,
              code: mockCode,
            });
          }
          res.writeHead(302, { Location: mockRedirectUrl });
          res.end();
          return;
        }

        const twitchClientId = process.env.TWITCH_CLIENT_ID;
        const twitchAuthUrl = `https://id.twitch.tv/oauth2/authorize?client_id=${twitchClientId}&redirect_uri=${encodeURIComponent(
          redirectUri
        )}&response_type=code&scope=user:read:email&state=${encodeURIComponent(state)}`;

        if (
          url.searchParams.get('format') === 'json' ||
          (req.headers.accept && req.headers.accept.includes('application/json')) ||
          method === 'POST'
        ) {
          return sendJson(res, 200, { url: twitchAuthUrl, mock: false });
        }
        res.writeHead(302, { Location: twitchAuthUrl });
        res.end();
        return;
      }

      // POST /api/auth/twitch/callback (and GET)
      if (pathname === '/api/auth/twitch/callback' && (method === 'POST' || method === 'GET')) {
        const code =
          url.searchParams.get('code') ||
          body?.code ||
          '';
        const redirectUri =
          url.searchParams.get('redirect_uri') ||
          url.searchParams.get('redirectUri') ||
          body?.redirectUri ||
          body?.redirect_uri ||
          '';

        if (!code) {
          return sendError(res, 400, 'Authorization code is required');
        }

        // Mock Mode Fallback
        if (
          code.startsWith('mock_code_') ||
          code === 'mock' ||
          !process.env.TWITCH_CLIENT_SECRET
        ) {
          const rawUser = code.startsWith('mock_code_')
            ? decodeURIComponent(code.slice('mock_code_'.length))
            : (body?.mockUsername || body?.username || 'MockCompetitor');
          const cleanUsername = rawUser.trim().replace(/^@/, '') || 'MockCompetitor';
          const cleanId = `tw_${cleanUsername.toLowerCase()}`;
          return sendJson(res, 200, {
            success: true,
            twitchUser: {
              id: cleanId,
              login: cleanUsername.toLowerCase(),
              displayName: cleanUsername,
              profileImageUrl: `https://avatar.vercel.sh/${cleanUsername.toLowerCase()}.png`,
            },
          });
        }

        // Real Twitch OAuth 2.0 Token Exchange
        try {
          const tokenRes = await fetch('https://id.twitch.tv/oauth2/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              client_id: process.env.TWITCH_CLIENT_ID!,
              client_secret: process.env.TWITCH_CLIENT_SECRET!,
              code,
              grant_type: 'authorization_code',
              redirect_uri: redirectUri,
            }),
          });
          const tokenData: any = await tokenRes.json();
          if (!tokenRes.ok || !tokenData.access_token) {
            return sendError(res, 400, tokenData.message || 'Twitch token exchange failed');
          }

          const userRes = await fetch('https://api.twitch.tv/helix/users', {
            headers: {
              'Client-ID': process.env.TWITCH_CLIENT_ID!,
              Authorization: `Bearer ${tokenData.access_token}`,
            },
          });
          const userData: any = await userRes.json();
          const u = userData?.data?.[0];
          if (!u) {
            return sendError(res, 400, 'Failed to fetch Twitch user profile');
          }

          return sendJson(res, 200, {
            success: true,
            twitchUser: {
              id: u.id,
              login: u.login,
              displayName: u.display_name,
              profileImageUrl: u.profile_image_url,
            },
          });
        } catch (err: any) {
          return sendError(res, 500, err.message || 'Twitch OAuth callback error');
        }
      }

      // --- PLAYERS ENDPOINTS ---
      // GET /api/players
      if (pathname === '/api/players' && method === 'GET') {
        const dbPlayers = await listPlayers();
        const profiles: PlayerProfile[] = dbPlayers.map(p => ({
          id: p.id,
          name: p.name,
          displayName: p.displayName || undefined,
          nickname: p.nickname || undefined,
          twitchUsername: p.twitchUsername || undefined,
          country: p.country || undefined,
          avatarType: p.avatarType,
          avatarUrl: p.avatarUrl || undefined,
          avatarThumbnailUrl: p.avatarThumbnailUrl || undefined,
          personalBest: p.personalBest,
          playstyle: (p.playstyle as PlayerProfile['playstyle']) || 'Rolling',
          notes: p.notes || undefined,
          isDisqualified: p.isDisqualified,
        }));
        return sendJson(res, 200, profiles);
      }

      // POST /api/players/batch
      if (pathname === '/api/players/batch' && method === 'POST') {
        if (!checkAuth(req, res, 'SYSTEM_ADMIN')) return;
        const list = Array.isArray(body) ? body : body.players || [];
        const created = await createPlayersBatch(list);
        return sendJson(res, 201, created);
      }

      // POST /api/players
      if (pathname === '/api/players' && method === 'POST') {
        if (!checkAuth(req, res, 'TOURNAMENT_ADMIN')) return;
        const created = await createPlayer(body);
        return sendJson(res, 201, created);
      }

      // DELETE /api/players (Bulk clean unattached players)
      if (pathname === '/api/players' && method === 'DELETE') {
        if (!checkAuth(req, res, 'SYSTEM_ADMIN')) return;
        const result = await deleteAllUnattachedPlayers();
        return sendJson(res, 200, result);
      }

      // /api/players/:id
      const playerMatch = pathname.match(/^\/api\/players\/([^/]+)$/);
      if (playerMatch) {
        const playerId = playerMatch[1];
        if (method === 'GET') {
          const p = await getPlayer(playerId);
          if (!p) return sendError(res, 404, 'Player not found');
          return sendJson(res, 200, p);
        }
        if (method === 'PUT') {
          if (!checkAuth(req, res, 'TOURNAMENT_ADMIN')) return;
          const updated = await updatePlayer(playerId, body);
          if (!updated) return sendError(res, 404, 'Player not found');
          return sendJson(res, 200, updated);
        }
        if (method === 'DELETE') {
          if (!checkAuth(req, res, 'TOURNAMENT_ADMIN')) return;
          const result = await deletePlayer(playerId);
          if (!result.success) {
            const statusCode = result.error === 'Player not found' ? 404 : 400;
            return sendError(res, statusCode, result.error || 'Cannot delete player');
          }
          return sendJson(res, 200, { success: true });
        }
      }

      // --- ORGANIZATIONS ENDPOINTS ---
      // GET /api/organizations
      if (pathname === '/api/organizations' && method === 'GET') {
        const orgs = await listOrganizations();
        const session = getRequestSession(req);
        return sendJson(res, 200, orgs.map(org => redactOrganizationForCaller(org, session)));
      }

      // POST /api/organizations
      if (pathname === '/api/organizations' && method === 'POST') {
        if (!checkAuth(req, res, 'SYSTEM_ADMIN')) return;
        const created = await createOrganization(body as any);
        return sendJson(res, 201, created);
      }

      // /api/organizations/:id
      const orgMatch = pathname.match(/^\/api\/organizations\/([^/]+)$/);
      if (orgMatch) {
        const orgId = orgMatch[1];
        if (method === 'GET') {
          const org = await getOrganizationById(orgId);
          if (!org) return sendError(res, 404, 'Organization not found');
          return sendJson(res, 200, redactOrganizationForCaller(org, getRequestSession(req)));
        }
        if (method === 'PUT') {
          if (!checkAuth(req, res, 'SYSTEM_ADMIN')) return;
          const updated = await updateOrganization(orgId, body as any);
          if (!updated) return sendError(res, 404, 'Organization not found');
          return sendJson(res, 200, updated);
        }
        if (method === 'DELETE') {
          if (!checkAuth(req, res, 'SYSTEM_ADMIN')) return;
          const result = await deleteOrganization(orgId);
          if (!result.success) {
            return sendError(res, 400, result.error || 'Failed to delete organization');
          }
          return sendJson(res, 200, { success: true });
        }
      }

      // --- TOURNAMENTS ENDPOINTS ---
      // GET /api/tournaments
      if (pathname === '/api/tournaments' && method === 'GET') {
        const fullTourneys = await listFullTournaments();
        const session = getRequestSession(req);
        return sendJson(res, 200, fullTourneys.map(t => redactTournamentForCaller(t, session)));
      }

      // POST /api/tournaments
      if (pathname === '/api/tournaments' && method === 'POST') {
        if (!checkAuth(req, res, 'SYSTEM_ADMIN')) return;
        const saved = await saveFullTournament(body);
        return sendJson(res, 201, saved);
      }

      // POST /api/simulate/sample (1-click sample tournament)
      if (pathname === '/api/simulate/sample' && method === 'POST') {
        if (!isSimulationAllowed()) return sendError(res, 403, SIMULATION_DISABLED_MESSAGE);
        if (!checkAuth(req, res, 'SYSTEM_ADMIN')) return;
        const sampleTourney = await simulateSampleTournament();
        return sendJson(res, 201, sampleTourney);
      }

      // Match tournament routes: /api/tournaments/:id/...
      const tourneySubMatch = pathname.match(/^\/api\/tournaments\/([^/]+)(?:\/(.*))?$/);
      if (tourneySubMatch) {
        const tourneyId = tourneySubMatch[1];
        const subAction = tourneySubMatch[2] || '';

        // Exact tournament root: /api/tournaments/:id
        if (!subAction) {
          if (method === 'GET') {
            const t = await getFullTournament(tourneyId);
            if (!t) return sendError(res, 404, 'Tournament not found');
            return sendJson(res, 200, redactTournamentForCaller(t, getRequestSession(req)));
          }
          if (method === 'PUT') {
            if (!checkAuth(req, res, 'TOURNAMENT_ADMIN', tourneyId)) return;
            const updated = await saveFullTournament({ ...body, id: tourneyId });
            return sendJson(res, 200, updated);
          }
          if (method === 'DELETE') {
            if (!checkAuth(req, res, 'SYSTEM_ADMIN')) return;
            const deleted = await deleteTournament(tourneyId);
            return sendJson(res, 200, { success: deleted });
          }
        }

        // Subactions
        // PUT /api/tournaments/:id/pin (Update tournament PIN)
        if (subAction === 'pin' && method === 'PUT') {
          if (!checkAuth(req, res, 'TOURNAMENT_ADMIN', tourneyId)) return;
          const pin = typeof body?.pin === 'string' ? body.pin.trim() : '';
          const confirmed = Boolean(body?.confirmed);
          if (!pin) return sendError(res, 400, 'PIN is required');

          const db = getDb();
          const allTourneys = await db.select().from(tournaments);
          type TournamentRow = typeof tournaments.$inferSelect;

          // Locate current tournament row to exclude it from other matches
          const currentTourney = allTourneys.find(
            (t: TournamentRow) => t.id === tourneyId || t.slug === tourneyId
          );

          // Find other tournaments sharing this candidate PIN
          const matchingOtherTourneys: { id: string; name: string; slug: string }[] = [];
          for (const t of allTourneys) {
            if (currentTourney && (t.id === currentTourney.id || t.slug === currentTourney.slug)) {
              continue;
            }
            if (t.adminPinEncrypted) {
              try {
                const storedPin = decryptPin(t.adminPinEncrypted);
                if (safeCompareStrings(pin, storedPin)) {
                  matchingOtherTourneys.push({
                    id: t.id,
                    name: t.name,
                    slug: t.slug,
                  });
                }
              } catch {
                // Ignore decryption failure
              }
            }
          }

          if (matchingOtherTourneys.length > 0 && !confirmed) {
            return sendJson(res, 200, {
              success: false,
              isShared: true,
              sharedTournaments: matchingOtherTourneys,
              message: `This PIN is already shared with ${matchingOtherTourneys.map(t => t.name).join(', ')}.`,
            });
          }

          const encrypted = encryptPin(pin);
          const pinCond = isUuid(tourneyId)
            ? or(eq(tournaments.id, tourneyId), eq(tournaments.slug, tourneyId))
            : eq(tournaments.slug, tourneyId);
          await db
            .update(tournaments)
            .set({ adminPinEncrypted: encrypted })
            .where(pinCond);
          return sendJson(res, 200, {
            success: true,
            isShared: matchingOtherTourneys.length > 0,
            sharedTournaments: matchingOtherTourneys,
          });
        }

        // GET /api/tournaments/:id/reveal-pin (Master Admin reveals plaintext PIN)
        if (subAction === 'reveal-pin' && method === 'GET') {
          if (!checkAuth(req, res, 'SYSTEM_ADMIN')) return;
          const db = getDb();
          const revealCond = isUuid(tourneyId)
            ? or(eq(tournaments.id, tourneyId), eq(tournaments.slug, tourneyId))
            : eq(tournaments.slug, tourneyId);
          const rows = await db
            .select()
            .from(tournaments)
            .where(revealCond);
          if (rows.length === 0) return sendError(res, 404, 'Tournament not found');
          const encrypted = rows[0].adminPinEncrypted;
          let plaintextPin: string | null = null;
          if (encrypted) {
            try {
              plaintextPin = decryptPin(encrypted);
            } catch {
              plaintextPin = null;
            }
          }
          return sendJson(res, 200, { pin: plaintextPin });
        }

        // POST /api/tournaments/:id/qualifiers
        if (subAction === 'qualifiers' && method === 'POST') {
          if (!checkAuth(req, res, 'TOURNAMENT_ADMIN', tourneyId)) return;
          const tourneyCheck = await getFullTournament(tourneyId);
          if (!tourneyCheck) return sendError(res, 404, 'Tournament not found');
          if (tourneyCheck.isLocked) {
            return sendError(res, 400, 'Cannot modify qualifier scores while brackets are locked. Unlock brackets first.');
          }

          let targetPlayerId = body.playerId;
          if (body.playerName && (!targetPlayerId || !isUuid(targetPlayerId) || !(await getPlayer(targetPlayerId)))) {
            const resolved = await createPlayer({
              id: isUuid(targetPlayerId) ? targetPlayerId : undefined,
              name: body.playerName,
              playstyle: body.playstyle || 'Rolling',
              personalBest: body.personalBest ?? 0,
              upsertIfExists: true,
            });
            targetPlayerId = resolved.id;
          } else if (!targetPlayerId || !isUuid(targetPlayerId) || !(await getPlayer(targetPlayerId))) {
            // e.g. a draft bracket placeholder seed ("placeholder-seed-…") is not a real competitor
            return sendError(res, 400, 'Qualifier scores can only be recorded for registered competitors');
          }

          await submitQualifierScore(tourneyId, targetPlayerId, body.score);
          const t = await getFullTournament(tourneyId);
          if (t && !t.isLocked) {
            t.tiers = generateDraftBracketsForTournament(t);
            const saved = await saveFullTournament(t);
            return sendJson(res, 201, saved);
          }
          return sendJson(res, 201, t);
        }

        // POST /api/tournaments/:id/qualifiers/batch
        if (subAction === 'qualifiers/batch' && method === 'POST') {
          if (!checkAuth(req, res, 'TOURNAMENT_ADMIN', tourneyId)) return;
          const tourneyCheck = await getFullTournament(tourneyId);
          if (!tourneyCheck) return sendError(res, 404, 'Tournament not found');
          if (tourneyCheck.isLocked) {
            return sendError(res, 400, 'Cannot modify qualifier scores while brackets are locked. Unlock brackets first.');
          }
          await submitQualifiersBatch(tourneyId, body.submissions || body);
          const t = await getFullTournament(tourneyId);
          if (t && !t.isLocked) {
            t.tiers = generateDraftBracketsForTournament(t);
            const saved = await saveFullTournament(t);
            return sendJson(res, 201, saved);
          }
          return sendJson(res, 201, t);
        }

        // --- ONLINE QUALIFIERS (PHASE 10) ---
        // POST /api/tournaments/:id/qualify/resolve-identity
        if (subAction === 'qualify/resolve-identity' && method === 'POST') {
          const result = await resolveTwitchIdentity(tourneyId, {
            twitchId: body?.twitchId,
            twitchUsername: body?.twitchUsername,
          });
          return sendJson(res, 200, result);
        }

        // POST /api/tournaments/:id/qualify/claim-identity
        if (subAction === 'qualify/claim-identity' && method === 'POST') {
          const result = await claimOrRegisterOnlineCompetitor(tourneyId, {
            twitchId: body?.twitchId,
            twitchUsername: body?.twitchUsername,
            avatarUrl: body?.avatarUrl,
            mode: body?.mode || body?.action,
            playerId: body?.playerId || body?.targetPlayerId,
            newPlayer: body?.newPlayer,
          });
          return sendJson(res, 200, result);
        }

        // GET /api/tournaments/:id/qualify/session
        if (subAction === 'qualify/session' && method === 'GET') {
          const playerId = url.searchParams.get('playerId') || undefined;
          const twitchId = url.searchParams.get('twitchId') || undefined;
          const session = await getOnlineQualSession(tourneyId, { playerId, twitchId });
          return sendJson(res, 200, session);
        }

        // GET /api/tournaments/:id/qualify/run?token=… (the competitor's own run link)
        if (subAction === 'qualify/run' && method === 'GET') {
          const run = await getOnlineQualRunByToken(tourneyId, url.searchParams.get('token') || '');
          if (!run) return sendError(res, 404, 'This run link is no longer active');
          return sendJson(res, 200, run);
        }

        // POST /api/tournaments/:id/qualify/draft (autosave; requires the run token)
        if (subAction === 'qualify/draft' && method === 'POST') {
          try {
            const saved = await saveOnlineQualDraft(tourneyId, {
              resumeToken: body?.resumeToken,
              scores: body?.scores,
              twitchVodUrl: body?.twitchVodUrl,
              playerNotes: body?.playerNotes,
            });
            return sendJson(res, 200, saved);
          } catch (err) {
            if (err instanceof QualRunAccessError) return sendError(res, 403, err.message);
            throw err;
          }
        }

        // POST /api/tournaments/:id/qualify/discard (Tournament Admin only): throw away an unfinished run
        if (subAction === 'qualify/discard' && method === 'POST') {
          if (!checkAuth(req, res, 'TOURNAMENT_ADMIN', tourneyId)) return;
          const result = await discardOnlineQualRun(tourneyId, body?.playerId);
          return sendJson(res, 200, result);
        }

        // GET /api/tournaments/:id/qualify/sessions (Review Queue - Tournament Admin only)
        if (subAction === 'qualify/sessions' && method === 'GET') {
          if (!checkAuth(req, res, 'TOURNAMENT_ADMIN', tourneyId)) return;
          const sessions = await listOnlineQualSessions(tourneyId);
          return sendJson(res, 200, sessions);
        }

        // POST /api/tournaments/:id/qualify/start
        if (subAction === 'qualify/start' && method === 'POST') {
          const session = await startOnlineQualSession(tourneyId, {
            playerId: body?.playerId,
            playerName: body?.playerName,
            twitchUsername: body?.twitchUsername || body?.submittedTwitchUsername,
            submittedTwitchId: body?.submittedTwitchId,
            submittedTwitchUsername: body?.submittedTwitchUsername || body?.twitchUsername,
            identityStatus: body?.identityStatus,
            nowMs: body?.nowMs,
          });
          const p = await getPlayer(session.playerId);
          // Resumed or already-submitted runs come back from start too; only announce a brand-new run.
          if (session.isNewSession) {
            await dispatchDiscordWebhook(tourneyId, 'START', {
              playerName: p?.name || session.submittedTwitchUsername || 'Player',
              twitchUsername: session.submittedTwitchUsername || undefined,
              authWord: session.authWord || undefined,
            });
          }
          return sendJson(res, 200, {
            ...session,
            player: p || undefined,
          });
        }

        // POST /api/tournaments/:id/qualify/submit
        if (subAction === 'qualify/submit' && method === 'POST') {
          let session;
          try {
            session = await submitOnlineQualScores(tourneyId, {
              playerId: body?.playerId,
              scores: body?.scores,
              twitchVodUrl: body?.twitchVodUrl,
              playerNotes: body?.playerNotes,
              resumeToken: body?.resumeToken,
              submittedTwitchId: body?.submittedTwitchId,
              submittedTwitchUsername: body?.submittedTwitchUsername,
              identityStatus: body?.identityStatus,
              nowMs: body?.nowMs,
            });
          } catch (err) {
            if (err instanceof QualRunAccessError) return sendError(res, 403, err.message);
            throw err;
          }
          const t = await getFullTournament(tourneyId);
          if (t && !t.isLocked) {
            t.tiers = generateDraftBracketsForTournament(t);
            await saveFullTournament(t);
          }
          const p = await getPlayer(session.playerId);
          await dispatchDiscordWebhook(tourneyId, 'SUBMIT', {
            playerName: p?.name || session.submittedTwitchUsername || 'Player',
            twitchUsername: session.submittedTwitchUsername || undefined,
            twitchVodUrl: session.twitchVodUrl || undefined,
            scores: session.scores,
            playerNotes: session.playerNotes || undefined,
          });
          return sendJson(res, 200, session);
        }

        // POST /api/tournaments/:id/qualify/adjudicate (Judge / Tournament Admin only)
        if (subAction === 'qualify/adjudicate' && method === 'POST') {
          if (!checkAuth(req, res, 'TOURNAMENT_ADMIN', tourneyId)) return;
          const session = await adjudicateOnlineSubmission(tourneyId, {
            playerId: body?.playerId,
            action: body?.action,
            scores: body?.scores,
            judgeNotes: body?.judgeNotes,
            verifiedBy: body?.verifiedBy,
            targetPlayerId: body?.targetPlayerId,
            newPlayer: body?.newPlayer,
          });
          const t = await getFullTournament(tourneyId);
          if (t && !t.isLocked) {
            t.tiers = generateDraftBracketsForTournament(t);
            await saveFullTournament(t);
          }
          if (session && (body?.action === 'VERIFY' || body?.action === 'EDIT_AND_VERIFY')) {
            const p = await getPlayer(session.playerId);
            await dispatchDiscordWebhook(tourneyId, 'VERIFIED', {
              playerName: p?.name || session.submittedTwitchUsername || 'Player',
              scores: session.scores,
              judgeName: body?.verifiedBy || 'Judge',
            });
          }
          return sendJson(res, 200, session);
        }

        // POST /api/tournaments/:id/qualify/disqualification (Tournament Admin only)
        // Explicit tournament-scoped DQ toggle. The full-tournament PUT never writes DQ state.
        if (subAction === 'qualify/disqualification' && method === 'POST') {
          if (!checkAuth(req, res, 'TOURNAMENT_ADMIN', tourneyId)) return;
          if (!body?.playerId || typeof body?.isDisqualified !== 'boolean') {
            return sendError(res, 400, 'playerId and isDisqualified are required');
          }
          await setTournamentPlayerDisqualification(tourneyId, {
            playerId: body.playerId,
            isDisqualified: body.isDisqualified,
            changedBy: body?.changedBy,
          });
          const t = await getFullTournament(tourneyId);
          if (!t) return sendError(res, 404, 'Tournament not found');
          if (!t.isLocked) {
            t.tiers = generateDraftBracketsForTournament(t);
            const saved = await saveFullTournament(t);
            return sendJson(res, 200, saved);
          }
          return sendJson(res, 200, t);
        }

        // POST /api/tournaments/:id/online-quals (Tournament Admin only)
        // Explicit open/close toggle. The full-tournament PUT never writes this flag.
        if (subAction === 'online-quals' && method === 'POST') {
          if (!checkAuth(req, res, 'TOURNAMENT_ADMIN', tourneyId)) return;
          if (typeof body?.open !== 'boolean') {
            return sendError(res, 400, 'open (boolean) is required');
          }
          await setOnlineQualsOpen(tourneyId, body.open);
          const t = await getFullTournament(tourneyId);
          if (!t) return sendError(res, 404, 'Tournament not found');
          return sendJson(res, 200, t);
        }

        // POST /api/tournaments/:id/discord-webhook/test (Tournament Admin only)
        // Sends a real test message to the given (possibly unsaved) URL, or the saved tournament/org webhook.
        if (subAction === 'discord-webhook/test' && method === 'POST') {
          if (!checkAuth(req, res, 'TOURNAMENT_ADMIN', tourneyId)) return;
          const result = await sendTestDiscordWebhook(
            tourneyId,
            typeof body?.url === 'string' ? body.url : undefined
          );
          if (!result.success) return sendError(res, 400, result.error || 'Webhook test failed');
          return sendJson(res, 200, result);
        }

        // POST /api/tournaments/:id/qualify/verify-all (Judge / Tournament Admin only)
        if (subAction === 'qualify/verify-all' && method === 'POST') {
          if (!checkAuth(req, res, 'TOURNAMENT_ADMIN', tourneyId)) return;
          const result = await verifyAllQualifierSubmissions(tourneyId, body?.verifiedBy || 'Judge');
          const t = await getFullTournament(tourneyId);
          if (t && !t.isLocked) {
            t.tiers = generateDraftBracketsForTournament(t);
            await saveFullTournament(t);
          }
          return sendJson(res, 200, result);
        }

        // DELETE /api/tournaments/:id/qualifiers (Destructive clear - Master Admin only!)
        if (subAction === 'qualifiers' && method === 'DELETE') {
          if (!checkAuth(req, res, 'SYSTEM_ADMIN')) return;
          const t = await getFullTournament(tourneyId);
          if (!t) return sendError(res, 404, 'Tournament not found');

          const hasRecordedScores = Object.values(t.matchScores || {}).some(
            record =>
              record.isComplete ||
              record.games.some(
                g => g.player1Points !== null || g.player2Points !== null || g.winnerPlayerId !== null
              ) ||
              record.player1Wins > 0 ||
              record.player2Wins > 0 ||
              Boolean(record.winnerPlayerId)
          );

          if (t.isLocked || hasRecordedScores) {
            return sendError(
              res,
              400,
              'Cannot clear qualifiers while bracket is locked or match scores exist. Clear matches first.'
            );
          }

          await clearTournamentQualifiers(t.id);
          t.qualifierSubmissions = [];
          t.qualifiers = [];
          t.manualSeeds = [];
          if (t.tournamentPlayers) {
            for (const pid of Object.keys(t.tournamentPlayers)) {
              t.tournamentPlayers[pid] = {
                ...t.tournamentPlayers[pid],
                qualsCompleted: false,
                isVerified: false,
              };
            }
          }
          if (!t.isLocked) {
            t.tiers = generateDraftBracketsForTournament(t);
          }
          const saved = await saveFullTournament(t);
          return sendJson(res, 200, saved);
        }

        // DELETE /api/tournaments/:id/matches (Destructive clear - Master Admin only!)
        if (subAction === 'matches' && method === 'DELETE') {
          if (!checkAuth(req, res, 'SYSTEM_ADMIN')) return;
          const t = await getFullTournament(tourneyId);
          if (!t) return sendError(res, 404, 'Tournament not found');

          await clearTournamentMatches(t.id);
          t.matchScores = {};
          t.isLocked = false;
          t.tiers = t.tiers.map(tier => ({ ...tier, isLocked: false }));
          t.tiers = generateDraftBracketsForTournament(t);
          const saved = await saveFullTournament(t);
          return sendJson(res, 200, saved);
        }

        // POST /api/tournaments/:id/clear-all (Destructive wipe - Master Admin only!)
        if (subAction === 'clear-all' && method === 'POST') {
          if (!checkAuth(req, res, 'SYSTEM_ADMIN')) return;
          const t = await getFullTournament(tourneyId);
          if (!t) return sendError(res, 404, 'Tournament not found');

          await clearTournamentMatches(t.id);
          await clearTournamentQualifiers(t.id);
          const db = getDb();
          await db.delete(tournamentPlayers).where(eq(tournamentPlayers.tournamentId, t.id));
          t.playersPool = [];
          t.qualifierSubmissions = [];
          t.qualifiers = [];
          t.manualSeeds = [];
          t.matchScores = {};
          t.tournamentPlayers = {};
          t.isLocked = false;
          t.tiers = t.tiers.map(tier => ({
            ...tier,
            isLocked: false,
            bracket: { rounds: [], totalMatches: 0, matchesById: {} } as any,
          }));
          const saved = await saveFullTournament(t);
          return sendJson(res, 200, saved);
        }

        // POST /api/tournaments/:id/simulate/seed-quals (Simulation - Master Admin only!)
        if (subAction === 'simulate/seed-quals' && method === 'POST') {
          if (!isSimulationAllowed()) return sendError(res, 403, SIMULATION_DISABLED_MESSAGE);
          if (!checkAuth(req, res, 'SYSTEM_ADMIN')) return;
          const t = await getFullTournament(tourneyId);
          if (!t) return sendError(res, 404, 'Tournament not found');

          const profiles = await loadSimulationPlayerSupply(t);

          const { players: selectedPlayers, submissions } = generateSimulatedQualifiers(t, profiles);
          t.playersPool = selectedPlayers;
          t.qualifierSubmissions = submissions;
          markSimulatedQualsCompleted(t);
          t.matchScores = {};
          t.isLocked = false;
          t.tiers = t.tiers.map(tier => ({ ...tier, isLocked: false }));
          t.tiers = generateDraftBracketsForTournament(t);

          const saved = await saveFullTournament(t);
          return sendJson(res, 200, saved);
        }

        // POST /api/tournaments/:id/simulate/full (Simulation - Master Admin only!)
        if (subAction === 'simulate/full' && method === 'POST') {
          if (!isSimulationAllowed()) return sendError(res, 403, SIMULATION_DISABLED_MESSAGE);
          if (!checkAuth(req, res, 'SYSTEM_ADMIN')) return;
          const t = await getFullTournament(tourneyId);
          if (!t) return sendError(res, 404, 'Tournament not found');

          const profiles = await loadSimulationPlayerSupply(t);

          const simulated = runFullSimulation(t, profiles);
          markSimulatedQualsCompleted(simulated);
          const saved = await saveFullTournament(simulated);
          return sendJson(res, 200, saved);
        }

        // DELETE /api/tournaments/:id/qualifiers/:subId
        const qualDelMatch = subAction.match(/^qualifiers\/([^/]+)$/);
        if (qualDelMatch && method === 'DELETE') {
          if (!checkAuth(req, res, 'TOURNAMENT_ADMIN', tourneyId)) return;
          const subId = qualDelMatch[1];
          const t = await getFullTournament(tourneyId);
          if (!t) return sendError(res, 404, 'Tournament not found');

          if (t.isLocked) {
            return sendError(
              res,
              400,
              'Cannot modify qualifier scores while brackets are locked. Unlock brackets first.'
            );
          }

          if (isUuid(subId)) {
            const db = getDb();
            await db
              .delete(qualifierSubmissions)
              .where(
                and(
                  eq(qualifierSubmissions.id, subId),
                  eq(qualifierSubmissions.tournamentId, t.id)
                )
              );
          }

          const fresh = await getFullTournament(t.id);
          if (!fresh) return sendError(res, 404, 'Tournament not found');

          if (!fresh.isLocked) {
            fresh.tiers = generateDraftBracketsForTournament(fresh);
            const saved = await saveFullTournament(fresh);
            return sendJson(res, 200, saved);
          }
          return sendJson(res, 200, fresh);
        }

        // DELETE /api/tournaments/:id/players/:playerId
        const playerDelMatch = subAction.match(/^players\/([^/]+)$/);
        if (playerDelMatch && method === 'DELETE') {
          if (!checkAuth(req, res, 'TOURNAMENT_ADMIN', tourneyId)) return;
          const playerId = playerDelMatch[1];
          const t = await getFullTournament(tourneyId);
          if (!t) return sendError(res, 404, 'Tournament not found');

          const hasRecordedMatches = Object.values(t.matchScores || {}).some(
            m =>
              (m.winnerPlayerId === playerId || m.loserPlayerId === playerId) ||
              (m.isComplete && (m.games || []).length > 0)
          );
          if (hasRecordedMatches) {
            return sendError(
              res,
              400,
              'Cannot remove competitor who has recorded matches. Clear match scores first.'
            );
          }

          if (t.isLocked) {
            return sendError(
              res,
              400,
              'Cannot remove competitor while brackets are locked. Unlock brackets first.'
            );
          }

          const playerSubs = (t.qualifierSubmissions || []).filter(s => s.playerId === playerId);
          const qualSubs = playerSubs.filter(s => !isPlaceholderSubmissionStatus(s.status));
          if (qualSubs.length > 0) {
            return sendError(
              res,
              400,
              `Cannot remove competitor from roster while they have recorded qualifier scores (${qualSubs.length} submission(s)). Delete their qualifier scores first.`
            );
          }

          if (isUuid(playerId)) {
            const db = getDb();
            // An unfinished online run goes with the roster entry.
            for (const sub of playerSubs) {
              if (isUuid(sub.id)) {
                await db.delete(qualifierSubmissions).where(eq(qualifierSubmissions.id, sub.id));
              }
            }
            await db
              .delete(tournamentPlayers)
              .where(
                and(
                  eq(tournamentPlayers.tournamentId, t.id),
                  eq(tournamentPlayers.playerId, playerId)
                )
              );
          }

          const fresh = await getFullTournament(t.id);
          if (!fresh) return sendError(res, 404, 'Tournament not found');

          fresh.manualSeeds = (fresh.manualSeeds || []).filter(id => id !== playerId);
          if (fresh.tournamentPlayers) {
            fresh.manualSeeds.forEach((id, idx) => {
              if (fresh.tournamentPlayers[id]) {
                fresh.tournamentPlayers[id] = {
                  ...fresh.tournamentPlayers[id],
                  seed: idx + 1,
                };
              }
            });
          }

          if (!fresh.isLocked) {
            fresh.tiers = generateDraftBracketsForTournament(fresh);
          }
          const saved = await saveFullTournament(fresh);
          return sendJson(res, 200, saved);
        }

        // POST /api/tournaments/:id/lock
        if (subAction === 'lock' && method === 'POST') {
          if (!checkAuth(req, res, 'TOURNAMENT_ADMIN', tourneyId)) return;
          const t = await getFullTournament(tourneyId);
          if (!t) return sendError(res, 404, 'Tournament not found');

          t.isLocked = true;
          t.tiers = t.tiers.map(tr => ({ ...tr, isLocked: true }));
          const saved = await saveFullTournament(t);
          return sendJson(res, 200, saved);
        }

        // POST /api/tournaments/:id/unlock
        if (subAction === 'unlock' && method === 'POST') {
          if (!checkAuth(req, res, 'TOURNAMENT_ADMIN', tourneyId)) return;
          const t = await getFullTournament(tourneyId);
          if (!t) return sendError(res, 404, 'Tournament not found');

          const hasRecordedScores = Object.values(t.matchScores || {}).some(
            record =>
              record.isComplete ||
              record.games.some(
                g => g.player1Points !== null || g.player2Points !== null || g.winnerPlayerId !== null
              ) ||
              record.player1Wins > 0 ||
              record.player2Wins > 0 ||
              Boolean(record.winnerPlayerId)
          );

          if (hasRecordedScores) {
            return sendError(
              res,
              400,
              'Cannot unlock: Match play has begun. Clear recorded scores before unlocking.'
            );
          }

          t.isLocked = false;
          t.tiers = t.tiers.map(tr => ({ ...tr, isLocked: false }));
          const saved = await saveFullTournament(t);
          return sendJson(res, 200, saved);
        }

        // POST /api/tournaments/:id/matches/swap-slots
        if (subAction === 'matches/swap-slots' && method === 'POST') {
          if (!checkAuth(req, res, 'TOURNAMENT_ADMIN', tourneyId)) return;
          const t = await getFullTournament(tourneyId);
          if (!t) return sendError(res, 404, 'Tournament not found');

          const { tierId, sourceMatchId, sourceSlot, targetMatchId, targetSlot } = body;
          const tier = t.tiers.find(tr => tr.id === tierId);
          if (!tier || !tier.bracket) return sendError(res, 404, 'Tier or bracket not found');

          const srcRecord = t.matchScores?.[sourceMatchId];
          const tgtRecord = t.matchScores?.[targetMatchId];
          const hasSrcScore =
            srcRecord &&
            (srcRecord.games?.length > 0 || srcRecord.isComplete || Boolean(srcRecord.winnerPlayerId));
          const hasTgtScore =
            tgtRecord &&
            (tgtRecord.games?.length > 0 || tgtRecord.isComplete || Boolean(tgtRecord.winnerPlayerId));

          if (hasSrcScore || hasTgtScore) {
            return sendError(
              res,
              400,
              'Cannot swap slots: Match play or scores have already begun in one of the matches.'
            );
          }

          const updatedBracket = swapMatchSlots(tier.bracket, {
            sourceMatchId,
            sourceSlot,
            targetMatchId,
            targetSlot,
          });
          t.tiers = t.tiers.map(tr => (tr.id === tierId ? { ...tr, bracket: updatedBracket } : tr));
          const saved = await saveFullTournament(t);
          return sendJson(res, 200, saved);
        }

        // PUT /api/tournaments/:id/matches/:matchId/score
        const matchScoreSub = subAction.match(/^matches\/([^/]+)\/score$/);
        if (matchScoreSub && method === 'PUT') {
          if (!checkAuth(req, res, 'TOURNAMENT_ADMIN', tourneyId)) return;
          const matchId = matchScoreSub[1];
          const t = await getFullTournament(tourneyId);
          if (!t) return sendError(res, 404, 'Tournament not found');

          const tierId = body.tierId;
          const tier = t.tiers.find(tr => tr.id === tierId);
          if (!tier || !tier.bracket) return sendError(res, 404, 'Tier or bracket not found');

          const targetMatch = tier.bracket.matchesById?.[matchId];
          if (!targetMatch) return sendError(res, 404, 'Match not found in tier bracket');

          const p1 = targetMatch.player1.player;
          const p2 = targetMatch.player2.player;
          const currentRecord = t.matchScores[matchId] || {
            matchId,
            tierId,
            organizationId: t.organizationId,
            bestOf: targetMatch.bestOf || tier.bestOf || 5,
            player1Wins: 0,
            player2Wins: 0,
            games: [],
            winnerPlayerId: null,
            loserPlayerId: null,
            isComplete: false,
          };

          const scoredGames: GameScoreEntry[] = body.scoredGames || body.games || [];
          const cleanedGames: GameScoreEntry[] = scoredGames
            .map(g => {
              const isZeroZero = g.player1Points === 0 && g.player2Points === 0 && !g.winnerPlayerId;
              const isEmpty = g.player1Points === null && g.player2Points === null && !g.winnerPlayerId;
              if (isEmpty || isZeroZero) {
                return {
                  gameNumber: g.gameNumber,
                  player1Points: null,
                  player2Points: null,
                  winnerPlayerId: null,
                };
              }
              return {
                gameNumber: g.gameNumber,
                player1Points: g.player1Points,
                player2Points: g.player2Points,
                winnerPlayerId: g.winnerPlayerId,
              };
            })
            .sort((a, b) => a.gameNumber - b.gameNumber);

          let p1Wins = 0;
          let p2Wins = 0;
          for (const g of cleanedGames) {
            if (p1 && g.winnerPlayerId === p1.id) p1Wins++;
            else if (p2 && g.winnerPlayerId === p2.id) p2Wins++;
          }

          const matchBestOf = body.bestOf || currentRecord.bestOf || targetMatch.bestOf || tier.bestOf || 5;
          const threshold = Math.ceil(matchBestOf / 2);
          let matchWinnerId: string | null = null;
          let matchLoserId: string | null = null;
          let isComplete = false;

          if (p1 && p1Wins >= threshold) {
            matchWinnerId = p1.id;
            matchLoserId = p2 ? p2.id : null;
            isComplete = true;
          } else if (p2 && p2Wins >= threshold) {
            matchWinnerId = p2.id;
            matchLoserId = p1 ? p1.id : null;
            isComplete = true;
          }

          const updatedRecord: MatchScoreRecord = {
            ...currentRecord,
            bestOf: matchBestOf,
            player1Wins: p1Wins,
            player2Wins: p2Wins,
            games: cleanedGames,
            winnerPlayerId: matchWinnerId,
            loserPlayerId: matchLoserId,
            isComplete,
            hasTiebreaker: Boolean(body.hasTiebreaker),
          };

          let updatedBracket = tier.bracket;
          if (matchWinnerId && isComplete) {
            try {
              updatedBracket = advanceMatchWinner(tier.bracket, matchId, matchWinnerId);
            } catch {}
          } else {
            try {
              updatedBracket = retractMatchWinner(tier.bracket, matchId);
            } catch {}
          }

          t.tiers = t.tiers.map(tr => (tr.id === tierId ? { ...tr, bracket: updatedBracket } : tr));
          t.matchScores[matchId] = updatedRecord;

          const saved = await saveFullTournament(t);
          return sendJson(res, 200, saved);
        }

        // POST /api/tournaments/:id/matches/:matchId/forfeit
        const matchForfeitSub = subAction.match(/^matches\/([^/]+)\/forfeit$/);
        if (matchForfeitSub && method === 'POST') {
          if (!checkAuth(req, res, 'TOURNAMENT_ADMIN', tourneyId)) return;
          const matchId = matchForfeitSub[1];
          const t = await getFullTournament(tourneyId);
          if (!t) return sendError(res, 404, 'Tournament not found');

          const tierId = body.tierId;
          const tier = t.tiers.find(tr => tr.id === tierId);
          if (!tier || !tier.bracket) return sendError(res, 404, 'Tier or bracket not found');

          const targetMatch = tier.bracket.matchesById?.[matchId];
          if (!targetMatch) return sendError(res, 404, 'Match not found in tier bracket');

          const p1 = targetMatch.player1.player;
          const p2 = targetMatch.player2.player;
          const winnerPlayerId = body.winnerPlayerId;
          const loserId = p1?.id === winnerPlayerId ? p2?.id ?? null : p1?.id ?? null;

          const currentRecord = t.matchScores[matchId] || {
            matchId,
            tierId,
            organizationId: t.organizationId,
            bestOf: targetMatch.bestOf || tier.bestOf,
            player1Wins: 0,
            player2Wins: 0,
            games: [],
            winnerPlayerId: null,
            loserPlayerId: null,
            isComplete: false,
          };

          const updatedRecord: MatchScoreRecord = {
            ...currentRecord,
            winnerPlayerId,
            loserPlayerId: loserId,
            isComplete: true,
            notes: 'Forfeit win',
            forfeitWinnerId: winnerPlayerId,
          };

          let updatedBracket = tier.bracket;
          try {
            updatedBracket = advanceMatchWinner(tier.bracket, matchId, winnerPlayerId);
          } catch {}

          t.tiers = t.tiers.map(tr => (tr.id === tierId ? { ...tr, bracket: updatedBracket } : tr));
          t.matchScores[matchId] = updatedRecord;

          const saved = await saveFullTournament(t);
          return sendJson(res, 200, saved);
        }

        // PUT /api/tournaments/:id/matches/:matchId/best-of
        const matchBestOfSub = subAction.match(/^matches\/([^/]+)\/best-of$/);
        if (matchBestOfSub && method === 'PUT') {
          if (!checkAuth(req, res, 'TOURNAMENT_ADMIN', tourneyId)) return;
          const matchId = matchBestOfSub[1];
          const t = await getFullTournament(tourneyId);
          if (!t) return sendError(res, 404, 'Tournament not found');

          const tierId = body.tierId;
          const tier = t.tiers.find(tr => tr.id === tierId);
          if (!tier || !tier.bracket) return sendError(res, 404, 'Tier or bracket not found');

          const targetMatch = tier.bracket.matchesById?.[matchId];
          if (!targetMatch) return sendError(res, 404, 'Match not found in tier bracket');

          const bestOf = body.bestOf || 3;
          const currentRecord = t.matchScores[matchId] || {
            matchId,
            tierId,
            organizationId: t.organizationId,
            bestOf,
            player1Wins: 0,
            player2Wins: 0,
            games: [],
            winnerPlayerId: null,
            loserPlayerId: null,
            isComplete: false,
          };

          const threshold = Math.ceil(bestOf / 2);
          const p1Wins = currentRecord.player1Wins;
          const p2Wins = currentRecord.player2Wins;
          const p1 = targetMatch.player1.player;
          const p2 = targetMatch.player2.player;
          let isComplete = false;
          let winnerPlayerId: string | null = null;
          let loserPlayerId: string | null = null;
          if (p1 && p1Wins >= threshold) {
            winnerPlayerId = p1.id;
            loserPlayerId = p2 ? p2.id : null;
            isComplete = true;
          } else if (p2 && p2Wins >= threshold) {
            winnerPlayerId = p2.id;
            loserPlayerId = p1 ? p1.id : null;
            isComplete = true;
          }

          let updatedBracket = tier.bracket;
          if (isComplete && winnerPlayerId) {
            try {
              updatedBracket = advanceMatchWinner(tier.bracket, matchId, winnerPlayerId);
            } catch {}
          } else {
            try {
              updatedBracket = retractMatchWinner(tier.bracket, matchId);
            } catch {}
          }

          const updatedRecord: MatchScoreRecord = {
            ...currentRecord,
            bestOf,
            isComplete,
            winnerPlayerId,
            loserPlayerId,
          };

          t.tiers = t.tiers.map(tr => (tr.id === tierId ? { ...tr, bracket: updatedBracket } : tr));
          t.matchScores[matchId] = updatedRecord;

          const saved = await saveFullTournament(t);
          return sendJson(res, 200, saved);
        }
      }

      return sendError(res, 404, `Not found: ${method} ${pathname}`);
    } catch (err: unknown) {
      console.error(`[API Error] ${method} ${pathname}:`, err);
      const msg = err instanceof Error ? err.message : 'Internal Server Error';
      return sendError(res, 500, msg);
    }
  };
}

/**
 * Creates and simulates a full sample tournament against PostgreSQL using authentic competitor names.
 */
export async function simulateSampleTournament(): Promise<Tournament> {
  await seedDefaultOrganizations();
  let dbPlayers = await listPlayers();

  // If DB has fewer than 32 players, populate authentic players
  if (dbPlayers.length < 32) {
    const toInsert = AUTHENTIC_COMPETITOR_NAMES.slice(0, 100).map(name => ({
      name,
      country: 'US',
      avatarType: 'flag' as const,
      personalBest: Math.floor(800000 + Math.random() * 600000),
      playstyle: 'Rolling',
      notes: 'Authentic competitor',
    }));
    await createPlayersBatch(toInsert);
    dbPlayers = await listPlayers();
  }

  const globalProfiles: PlayerProfile[] = dbPlayers.map(p => ({
    id: p.id,
    name: p.name,
    country: p.country || undefined,
    avatarType: p.avatarType,
    avatarUrl: p.avatarUrl || undefined,
    personalBest: p.personalBest,
    playstyle: (p.playstyle as PlayerProfile['playstyle']) || 'Rolling',
    isDisqualified: p.isDisqualified,
  }));

  const goldTierId = crypto.randomUUID();
  const silverTierId = crypto.randomUUID();
  const tourneyId = crypto.randomUUID();

  // Initial tournament definition with Gold (16) and Silver (16)
  const baseTourney: Tournament = {
    id: tourneyId,
    organizationId: 'org_ctwc',
    slug: `ctwc-open-${Date.now() % 10000}`,
    name: 'CTWC 2026 World Championship',
    date: '2026-10-18',
    location: 'Portland, Oregon',
    qualFormat: 'HIGH_SCORE',
    isLocked: false,
    seedingMethod: 'QUALIFIERS',
    manualSeeds: [],
    playersPool: [],
    qualifierSubmissions: [],
    tournamentPlayers: {},
    matchScores: {},
    useOrgBranding: true,
    tiers: [
      {
        id: goldTierId,
        slug: 'gold',
        name: 'Gold Championship',
        priority: 1,
        bracketType: 'TRADITIONAL',
        playerCount: 16,
        bestOf: 5,
        primaryColor: DEFAULT_TIER_THEME.primaryColor,
        secondaryColor: DEFAULT_TIER_THEME.secondaryColor,
        cardColor: DEFAULT_TIER_THEME.cardColor,
        textColor: DEFAULT_TIER_THEME.textColor,
        backgroundColor: DEFAULT_TIER_THEME.backgroundColor,
        isLocked: false,
        bracket: generateTraditionalBracket(
          globalProfiles.slice(0, 16).map((p, idx) => ({ id: p.id, name: p.name, seed: idx + 1 })),
          { tierId: goldTierId, bestOf: 5 }
        ),
      },
      {
        id: silverTierId,
        slug: 'silver',
        name: 'Silver Bracket',
        priority: 2,
        bracketType: 'FLAT',
        flatWidth: 2,
        playerCount: 16,
        bestOf: 3,
        primaryColor: TIER_THEMES.silver.primaryColor,
        secondaryColor: TIER_THEMES.silver.secondaryColor,
        cardColor: TIER_THEMES.silver.cardColor,
        textColor: TIER_THEMES.silver.textColor,
        backgroundColor: TIER_THEMES.silver.backgroundColor,
        isLocked: false,
        bracket: generateFlatBracket(
          globalProfiles.slice(16, 32).map((p, idx) => ({ id: p.id, name: p.name, seed: idx + 1 })),
          2,
          { tierId: silverTierId, bestOf: 3 }
        ),
      },
    ],
  };

  // Run full simulation
  const simulated = runFullSimulation(baseTourney, globalProfiles);

  // Persist into PostgreSQL
  const saved = await saveFullTournament(simulated);
  return saved;
}
