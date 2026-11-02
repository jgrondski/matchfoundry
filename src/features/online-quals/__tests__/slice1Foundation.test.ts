import { describe, it, expect, beforeEach } from 'vitest';
import { Readable } from 'node:stream';
import { setupTestDb } from '../../../db/testDb';
import { setDb } from '../../../db';
import { createApiMiddleware } from '../../../server/api';
import { createSessionToken } from '../../../server/pinCrypto';
import { saveFullTournament, getFullTournament } from '../../../api/tournaments';
import { setOnlineQualsOpen } from '../../../api/qualifiers';
import { seedDefaultOrganizations } from '../../../api/organizations';
import { createPlayer, getPlayer } from '../../../api/players';
import { createEmptyTournament, createDefaultTier } from '../../tournament/defaults';
import {
  isValidNesAuthword,
  sanitizeNesAuthword,
  generateNesAuthword,
  createInitialTimerLog,
  computeTimerTelemetry,
} from '../authwordEngine';
import {
  getPlayerQualifierStatus,
  generateDraftBracketsForTournament,
} from '../../qualifiers/scoring';
import type { Tournament, PlayerProfile } from '../../tournament/types';
import { runToken } from './runToken';

function createMockReq(options: {
  url: string;
  method?: string;
  body?: any;
  headers?: Record<string, string>;
}) {
  const bodyStr = options.body !== undefined ? JSON.stringify(options.body) : '';
  const stream = Readable.from(bodyStr ? [bodyStr] : []);
  const req = stream as any;
  req.url = options.url;
  req.method = options.method || 'GET';
  req.headers = options.headers || {};
  return req;
}

function createMockRes() {
  let statusCode = 200;
  let body = '';
  const headers: Record<string, string> = {};
  return {
    setHeader(name: string, val: string) {
      headers[name.toLowerCase()] = val;
    },
    getHeader(name: string) {
      return headers[name.toLowerCase()];
    },
    writeHead(code: number, headHeaders?: Record<string, string>) {
      statusCode = code;
      if (headHeaders) {
        for (const [k, v] of Object.entries(headHeaders)) {
          headers[k.toLowerCase()] = v;
        }
      }
      return this;
    },
    set statusCode(code: number) {
      statusCode = code;
    },
    get statusCode() {
      return statusCode;
    },
    end(chunk?: string) {
      if (chunk) body += chunk;
    },
    getBody() {
      return body ? JSON.parse(body) : null;
    },
    getStatusCode() {
      return statusCode;
    },
  };
}

describe('Phase 10 - Slice 1 Foundation Engine', () => {
  let middleware: ReturnType<typeof createApiMiddleware>;

  beforeEach(async () => {
    process.env.SYSTEM_ADMIN_RECOVERY_PIN = '999999';
    const { db } = setupTestDb();
    setDb(db);
    await seedDefaultOrganizations();
    middleware = createApiMiddleware();
  });

  describe('1. NES Authword Engine & Non-Blocking Timer Telemetry (Track 10C)', () => {
    it('validates official NES Tetris high-score charset [A-Z0-9.-!♥] of 6-8 chars', () => {
      expect(isValidNesAuthword('ROCKET')).toBe(true);
      expect(isValidNesAuthword('HYPER-1')).toBe(true);
      expect(isValidNesAuthword('NES.TET')).toBe(true);
      expect(isValidNesAuthword('DAS-WIN!')).toBe(true);
      expect(isValidNesAuthword('LOVE♥7')).toBe(true);

      // Invalid words: too short, too long, lowercase, space, prohibited characters
      expect(isValidNesAuthword('SHORT')).toBe(false);
      expect(isValidNesAuthword('TOOLONGWORD')).toBe(false);
      expect(isValidNesAuthword('rocket')).toBe(false);
      expect(isValidNesAuthword('ROC KET')).toBe(false);
      expect(isValidNesAuthword('ROCKET$')).toBe(false);
      expect(isValidNesAuthword('ROCKET#')).toBe(false);
    });

    it('sanitizes candidate words into uppercase NES-safe words', () => {
      expect(sanitizeNesAuthword(' rocket ')).toBe('ROCKET');
      expect(sanitizeNesAuthword('hyper_dash$')).toBe('HYPERDAS');
      expect(sanitizeNesAuthword('short')).toBeNull();
    });

    it('generates random NES authwords and avoids used words and incorporates custom words', () => {
      const customWords = ['MYCUSTOM', 'SPECIAL!'];
      const word1 = generateNesAuthword(customWords, ['ROCKET', 'BLASTER']);
      expect(isValidNesAuthword(word1)).toBe(true);
      expect(word1).not.toBe('ROCKET');
      expect(word1).not.toBe('BLASTER');

      // Uniqueness check across a loop
      const used: string[] = [];
      for (let i = 0; i < 20; i++) {
        const w = generateNesAuthword(['WORD001', 'WORD002', 'WORD003'], used);
        expect(used.includes(w)).toBe(false);
        used.push(w);
      }
    });

    it('computes countdown timer telemetry accurately without blocking over-time submissions', () => {
      const startMs = 1000000;
      const initialLog = createInitialTimerLog(startMs);

      // 1. Within 90-minute window (45 minutes elapsed)
      const midMs = startMs + 45 * 60 * 1000;
      const midTelemetry = computeTimerTelemetry(initialLog, 90, midMs);
      expect(midTelemetry.elapsedSeconds).toBe(45 * 60);
      expect(midTelemetry.remainingSeconds).toBe(45 * 60);
      expect(midTelemetry.overTime).toBe(false);

      // 2. Over-time submission (95 minutes elapsed)
      const lateMs = startMs + 95 * 60 * 1000;
      const lateTelemetry = computeTimerTelemetry(initialLog, 90, lateMs);
      expect(lateTelemetry.elapsedSeconds).toBe(95 * 60);
      expect(lateTelemetry.remainingSeconds).toBe(0);
      expect(lateTelemetry.overTime).toBe(true);

      // 3. Paused session telemetry calculation
      const logWithPause = {
        ...initialLog,
        pauses: [{ pausedAt: startMs + 10000, resumedAt: startMs + 20000, durationSeconds: 10 }],
      };
      const pausedTelemetry = computeTimerTelemetry(logWithPause, 90, startMs + 30000);
      expect(pausedTelemetry.elapsedSeconds).toBe(20); // 30s total - 10s pause
      expect(pausedTelemetry.totalPauseSeconds).toBe(10);
    });
  });

  describe('2. Twitch OAuth 2.0 & Player Auth Guard Extensions (Track 10B & Step 1A)', () => {
    it('authorizes via mock OAuth mode and redirects or returns JSON URL', async () => {
      const req = createMockReq({
        url: '/api/auth/twitch/authorize?mock=true&mock_username=SharkyDAS&redirect_uri=http://localhost:5173/omen/qualify',
        method: 'GET',
        headers: { accept: 'application/json' },
      });
      const res = createMockRes();

      await middleware(req, res as any, () => {});

      expect(res.getStatusCode()).toBe(200);
      const data = res.getBody();
      expect(data.mock).toBe(true);
      expect(data.code).toBe('mock_code_SharkyDAS');
      expect(data.url).toContain('code=mock_code_SharkyDAS');
    });

    it('exchanges mock authorization code for normalized Twitch user profile', async () => {
      const req = createMockReq({
        url: '/api/auth/twitch/callback',
        method: 'POST',
        body: { code: 'mock_code_SharkyDAS' },
      });
      const res = createMockRes();

      await middleware(req, res as any, () => {});

      expect(res.getStatusCode()).toBe(200);
      const data = res.getBody();
      expect(data.success).toBe(true);
      expect(data.twitchUser.id).toBe('tw_sharkydas');
      expect(data.twitchUser.login).toBe('sharkydas');
      expect(data.twitchUser.displayName).toBe('SharkyDAS');
      expect(data.twitchUser.profileImageUrl).toContain('sharkydas');
    });

    it('allows TOURNAMENT_ADMIN to create and update players (Step 1A alignment)', async () => {
      const tourneyToken = createSessionToken({
        role: 'TOURNAMENT_ADMIN',
        tournamentId: crypto.randomUUID(),
      });

      // 1. POST /api/players with TOURNAMENT_ADMIN token should succeed
      const postReq = createMockReq({
        url: '/api/players',
        method: 'POST',
        headers: { authorization: `Bearer ${tourneyToken}` },
        body: {
          name: 'WalkIn Player 1',
          country: 'CA',
          playstyle: 'DAS',
        },
      });
      const postRes = createMockRes();
      await middleware(postReq, postRes as any, () => {});

      expect(postRes.getStatusCode()).toBe(201);
      const createdPlayer = postRes.getBody();
      expect(createdPlayer.id).toBeDefined();
      expect(createdPlayer.name).toBe('WalkIn Player 1');

      // 2. PUT /api/players/:id with TOURNAMENT_ADMIN token should succeed
      const putReq = createMockReq({
        url: `/api/players/${createdPlayer.id}`,
        method: 'PUT',
        headers: { authorization: `Bearer ${tourneyToken}` },
        body: {
          personalBest: 950000,
        },
      });
      const putRes = createMockRes();
      await middleware(putReq, putRes as any, () => {});

      expect(putRes.getStatusCode()).toBe(200);
      expect(putRes.getBody().personalBest).toBe(950000);

      // 3. Unauthenticated requests to POST /api/players are rejected with 401
      const unauthReq = createMockReq({
        url: '/api/players',
        method: 'POST',
        body: { name: 'Hacker Player' },
      });
      const unauthRes = createMockRes();
      await middleware(unauthReq, unauthRes as any, () => {});
      expect(unauthRes.getStatusCode()).toBe(401);

      // 4. Batch player creation is still restricted to SYSTEM_ADMIN (403 for TOURNAMENT_ADMIN)
      const batchReq = createMockReq({
        url: '/api/players/batch',
        method: 'POST',
        headers: { authorization: `Bearer ${tourneyToken}` },
        body: [{ name: 'Batch 1' }, { name: 'Batch 2' }],
      });
      const batchRes = createMockRes();
      await middleware(batchReq, batchRes as any, () => {});
      expect(batchRes.getStatusCode()).toBe(403);
    });
  });

  describe('3. 3-Tier Identity Resolution Protocol (Track 10B & Journey 1)', () => {
    let tourney: Tournament;

    beforeEach(async () => {
      tourney = createEmptyTournament({ slug: 'omen-das', name: 'Omen DAS Championship' });
      tourney.id = crypto.randomUUID();
      tourney.organizationId = 'org_ctwc';
      tourney.qualMode = 'HYBRID';
      tourney.qualWindowMinutes = 90;
      await saveFullTournament(tourney);
      await setOnlineQualsOpen(tourney.id, true);
    });

    it('resolves Bucket 1: Verified repeat competitor (matchedPlayer with VERIFIED_MATCH)', async () => {
      // Create existing player with twitchId bound
      const existing = await createPlayer({
        name: 'Sharky DAS',
        country: 'US',
        twitchId: 'tw_sharkydas',
        twitchUsername: 'sharkydas',
      });

      const req = createMockReq({
        url: `/api/tournaments/${tourney.id}/qualify/resolve-identity`,
        method: 'POST',
        body: {
          twitchId: 'tw_sharkydas',
          twitchUsername: 'sharkydas',
        },
      });
      const res = createMockRes();
      await middleware(req, res as any, () => {});

      expect(res.getStatusCode()).toBe(200);
      const data = res.getBody();
      expect(data.identityStatus).toBe('VERIFIED_MATCH');
      expect(data.player.id).toBe(existing.id);
      expect(data.player.name).toBe('Sharky DAS');
    });

    it('resolves Bucket 2: Unlinked competitor claims existing roster profile (CLAIMED_PENDING_REVIEW)', async () => {
      // Create roster competitor without twitchId
      const rosterPlayer = await createPlayer({
        name: 'RetroGamer99',
        country: 'US',
        playstyle: 'DAS',
      });

      // 1. Resolve identity reports unclaimed roster options
      const resReq = createMockReq({
        url: `/api/tournaments/${tourney.id}/qualify/resolve-identity`,
        method: 'POST',
        body: {
          twitchId: 'tw_retrogamer_live',
          twitchUsername: 'retrogamer_live',
        },
      });
      const resRes = createMockRes();
      await middleware(resReq, resRes as any, () => {});

      expect(resRes.getStatusCode()).toBe(200);
      expect(resRes.getBody().identityStatus).toBeNull();
      expect(resRes.getBody().player).toBeNull();

      // 2. Claim roster profile
      const claimReq = createMockReq({
        url: `/api/tournaments/${tourney.id}/qualify/claim-identity`,
        method: 'POST',
        body: {
          twitchId: 'tw_retrogamer_live',
          twitchUsername: 'retrogamer_live',
          mode: 'CLAIM_ROSTER',
          playerId: rosterPlayer.id,
        },
      });
      const claimRes = createMockRes();
      await middleware(claimReq, claimRes as any, () => {});

      expect(claimRes.getStatusCode()).toBe(200);
      const claimData = claimRes.getBody();
      expect(claimData.identityStatus).toBe('CLAIMED_PENDING_REVIEW');
      expect(claimData.player.id).toBe(rosterPlayer.id);
    });

    it('resolves Bucket 3: Walk-in competitor registers new player profile (PROVISIONAL_NEW)', async () => {
      const claimReq = createMockReq({
        url: `/api/tournaments/${tourney.id}/qualify/claim-identity`,
        method: 'POST',
        body: {
          twitchId: 'tw_newbie_tetris',
          twitchUsername: 'newbie_tetris',
          mode: 'NEW_PLAYER',
          newPlayer: {
            name: 'NewbieTetris',
            country: 'JP',
            playstyle: 'Rolling',
          },
        },
      });
      const claimRes = createMockRes();
      await middleware(claimReq, claimRes as any, () => {});

      expect(claimRes.getStatusCode()).toBe(200);
      const claimData = claimRes.getBody();
      expect(claimData.identityStatus).toBe('PROVISIONAL_NEW');
      expect(claimData.player.name).toBe('NewbieTetris');
      expect(claimData.player.country).toBe('JP');

      // Verify real row was persisted in players table
      const dbPlayer = await getPlayer(claimData.player.id);
      expect(dbPlayer).toBeDefined();
      expect(dbPlayer?.name).toBe('NewbieTetris');
    });
  });

  describe('4. Online Qual Session Lifecycle (Tracks 10C, 10D & Journey 1)', () => {
    let tourney: Tournament;
    let player: PlayerProfile;

    beforeEach(async () => {
      tourney = createEmptyTournament({ slug: 'omen-open', name: 'Omen Open' });
      tourney.id = crypto.randomUUID();
      tourney.organizationId = 'org_ctwc';
      tourney.qualMode = 'ONLINE';
      tourney.qualWindowMinutes = 90;
      tourney.customAuthWords = ['NESCHAMP', 'WARPZONE'];
      tourney.tiers = [createDefaultTier(1, { id: crypto.randomUUID(), playerCount: 4 })];
      await saveFullTournament(tourney);
      await setOnlineQualsOpen(tourney.id, true);

      const dbPlayer = await createPlayer({
        name: 'SpeedyTetris',
        country: 'US',
        twitchId: 'tw_speedytetris',
        twitchUsername: 'speedytetris',
      });
      player = {
        id: dbPlayer.id,
        name: dbPlayer.name,
        country: dbPlayer.country || undefined,
        avatarType: dbPlayer.avatarType,
        personalBest: dbPlayer.personalBest,
        playstyle: 'DAS',
        isDisqualified: false,
      };
    });

    it('launches official qual session, generates NES Authword, and allows idempotent reload recovery', async () => {
      // 1. Launch session (POST /api/tournaments/:id/qualify/start)
      const startReq = createMockReq({
        url: `/api/tournaments/${tourney.id}/qualify/start`,
        method: 'POST',
        body: {
          playerId: player.id,
          submittedTwitchId: 'tw_speedytetris',
          submittedTwitchUsername: 'speedytetris',
          identityStatus: 'VERIFIED_MATCH',
        },
      });
      const startRes = createMockRes();
      await middleware(startReq, startRes as any, () => {});

      expect(startRes.getStatusCode()).toBe(200);
      const session1 = startRes.getBody();
      expect(session1.status).toBe('IN_PROGRESS');
      expect(isValidNesAuthword(session1.authWord)).toBe(true);
      expect(session1.timerLog).toBeDefined();
      expect(session1.timerLog.startedAt).toBeGreaterThan(0);

      // 2. Browser reload / recovery (GET /api/tournaments/:id/qualify/session)
      const getReq = createMockReq({
        url: `/api/tournaments/${tourney.id}/qualify/session?playerId=${player.id}`,
        method: 'GET',
      });
      const getRes = createMockRes();
      await middleware(getReq, getRes as any, () => {});

      expect(getRes.getStatusCode()).toBe(200);
      const session2 = getRes.getBody();
      expect(session2.authWord).toBe(session1.authWord);
      expect(session2.timerLog.startedAt).toBe(session1.timerLog.startedAt);

      // 3. Second start call is idempotent
      const startReq2 = createMockReq({
        url: `/api/tournaments/${tourney.id}/qualify/start`,
        method: 'POST',
        body: { playerId: player.id },
      });
      const startRes2 = createMockRes();
      await middleware(startReq2, startRes2 as any, () => {});
      expect(startRes2.getBody().authWord).toBe(session1.authWord);
    });

    it('submits final scores + VOD URL and transitions from IN_PROGRESS to SUBMITTED', async () => {
      // 1. Start session
      await middleware(
        createMockReq({
          url: `/api/tournaments/${tourney.id}/qualify/start`,
          method: 'POST',
          body: { playerId: player.id },
        }),
        createMockRes() as any,
        () => {}
      );

      // 2. Submit scores (POST /api/tournaments/:id/qualify/submit)
      const subReq = createMockReq({
        url: `/api/tournaments/${tourney.id}/qualify/submit`,
        method: 'POST',
        body: {
          playerId: player.id, resumeToken: await runToken(tourney.id, player.id),
          scores: [750000, 820000],
          twitchVodUrl: 'https://twitch.tv/videos/1234567890?t=00h15m00s',
        },
      });
      const subRes = createMockRes();
      await middleware(subReq, subRes as any, () => {});

      expect(subRes.getStatusCode()).toBe(200);
      const submitted = subRes.getBody();
      expect(submitted.status).toBe('SUBMITTED');
      expect(submitted.scores).toEqual([750000, 820000]);
      expect(submitted.twitchVodUrl).toBe('https://twitch.tv/videos/1234567890?t=00h15m00s');

      // 3. Leaderboard reports "awaiting verification" for SUBMITTED
      const fullT = await getFullTournament(tourney.id);
      expect(fullT).toBeDefined();
      const status = getPlayerQualifierStatus(fullT!, player.id);
      expect(status).toBe('awaiting verification');

      // 4. Draft bracket seeding includes unverified SUBMITTED submissions provisionally
      const draftTiers = generateDraftBracketsForTournament(fullT!);
      const tier1 = draftTiers[0];
      const unverifiedSeededIds = Object.values(tier1?.bracket?.matchesById || {}).flatMap(m => [
        m.player1?.player?.id,
        m.player2?.player?.id,
      ]);
      expect(unverifiedSeededIds).toContain(player.id);
    });
  });

  describe('5. Judge Adjudication & Identity Promotion (Tracks 10E & Journeys 2, 3)', () => {
    let tourney: Tournament;
    let player: PlayerProfile;
    let adminToken: string;

    beforeEach(async () => {
      tourney = createEmptyTournament({ slug: 'omen-review', name: 'Omen Review Tourney' });
      tourney.id = crypto.randomUUID();
      tourney.organizationId = 'org_ctwc';
      tourney.qualMode = 'ONLINE';
      tourney.isLocked = false;
      tourney.tiers = [createDefaultTier(1, { id: crypto.randomUUID(), playerCount: 4 })];
      await saveFullTournament(tourney);
      await setOnlineQualsOpen(tourney.id, true);

      const dbPlayer = await createPlayer({
        name: 'OmenDASCompetitor',
        country: 'US',
      });
      player = {
        id: dbPlayer.id,
        name: dbPlayer.name,
        country: dbPlayer.country || undefined,
        avatarType: dbPlayer.avatarType,
        personalBest: dbPlayer.personalBest,
        playstyle: 'DAS',
        isDisqualified: false,
      };

      adminToken = createSessionToken({
        role: 'TOURNAMENT_ADMIN',
        tournamentId: tourney.id,
      });

      // Start and submit scores
      await middleware(
        createMockReq({
          url: `/api/tournaments/${tourney.id}/qualify/start`,
          method: 'POST',
          body: {
            playerId: player.id,
            submittedTwitchId: 'tw_omendas',
            submittedTwitchUsername: 'omendas',
            identityStatus: 'CLAIMED_PENDING_REVIEW',
          },
        }),
        createMockRes() as any,
        () => {}
      );

      await middleware(
        createMockReq({
          url: `/api/tournaments/${tourney.id}/qualify/submit`,
          method: 'POST',
          body: {
            playerId: player.id, resumeToken: await runToken(tourney.id, player.id),
            scores: [880000, 910000],
            twitchVodUrl: 'https://twitch.tv/videos/999?t=01h00m',
          },
        }),
        createMockRes() as any,
        () => {}
      );
    });

    it('adjudicates with VERIFY action, updating status and seeding draft brackets', async () => {
      const adjReq = createMockReq({
        url: `/api/tournaments/${tourney.id}/qualify/adjudicate`,
        method: 'POST',
        headers: { authorization: `Bearer ${adminToken}` },
        body: {
          playerId: player.id,
          action: 'VERIFY',
          verifiedBy: 'Judge Dan',
          judgeNotes: 'Verified Authword on NES title screen at 01h12m',
        },
      });
      const adjRes = createMockRes();
      await middleware(adjReq, adjRes as any, () => {});

      expect(adjRes.getStatusCode()).toBe(200);
      const adjData = adjRes.getBody();
      expect(adjData.status).toBe('VERIFIED');
      expect(adjData.judgeNotes).toContain('Verified Authword');

      // Verify tournament now has draft bracket seeded with this verified player
      const updatedT = await getFullTournament(tourney.id);
      expect(updatedT).toBeDefined();
      const status = getPlayerQualifierStatus(updatedT!, player.id);
      expect(status).toBe('verified');
      const verifiedSeededIds = Object.values(updatedT!.tiers[0]?.bracket?.matchesById || {}).flatMap(m => [
        m.player1?.player?.id,
        m.player2?.player?.id,
      ]);
      expect(verifiedSeededIds).toContain(player.id);
    });

    it('adjudicates with CONFIRM_IDENTITY action, permanently binding twitchId to player', async () => {
      const adjReq = createMockReq({
        url: `/api/tournaments/${tourney.id}/qualify/adjudicate`,
        method: 'POST',
        headers: { authorization: `Bearer ${adminToken}` },
        body: {
          playerId: player.id,
          action: 'CONFIRM_IDENTITY',
          verifiedBy: 'Judge Dan',
        },
      });
      const adjRes = createMockRes();
      await middleware(adjReq, adjRes as any, () => {});

      expect(adjRes.getStatusCode()).toBe(200);
      expect(adjRes.getBody().identityStatus).toBe('VERIFIED_MATCH');

      // Check player profile in DB
      const dbPlayer = await getPlayer(player.id);
      expect(dbPlayer?.twitchId).toBe('tw_omendas');
      expect(dbPlayer?.twitchUsername).toBe('omendas');
    });

    it('adjudicates with SAVE then VERIFY, replacing scores and logging audit trail', async () => {
      const saveReq = createMockReq({
        url: `/api/tournaments/${tourney.id}/qualify/adjudicate`,
        method: 'POST',
        headers: { authorization: `Bearer ${adminToken}` },
        body: {
          playerId: player.id,
          action: 'SAVE',
          scores: [880000, 905000], // Edited from 910000
          judgeNotes: 'Topout was at 905000, not 910000',
          verifiedBy: 'Judge Dan',
        },
      });
      const saveRes = createMockRes();
      await middleware(saveReq, saveRes as any, () => {});
      expect(saveRes.getStatusCode()).toBe(200);

      const adjReq = createMockReq({
        url: `/api/tournaments/${tourney.id}/qualify/adjudicate`,
        method: 'POST',
        headers: { authorization: `Bearer ${adminToken}` },
        body: { playerId: player.id, action: 'VERIFY', verifiedBy: 'Judge Dan' },
      });
      const adjRes = createMockRes();
      await middleware(adjReq, adjRes as any, () => {});

      expect(adjRes.getStatusCode()).toBe(200);
      const data = adjRes.getBody();
      expect(data.status).toBe('VERIFIED');
      expect(data.scores).toEqual([880000, 905000]);
      expect(data.judgeNotes).toContain('[SCORES EDITED BY Judge Dan]');
    });

    it('adjudicates with DNQ action, marking status DNQ and clearing tournament registration', async () => {
      const adjReq = createMockReq({
        url: `/api/tournaments/${tourney.id}/qualify/adjudicate`,
        method: 'POST',
        headers: { authorization: `Bearer ${adminToken}` },
        body: {
          playerId: player.id,
          action: 'DNQ',
          judgeNotes: 'Authword missing from stream broadcast',
          verifiedBy: 'Judge Dan',
        },
      });
      const adjRes = createMockRes();
      await middleware(adjReq, adjRes as any, () => {});

      expect(adjRes.getStatusCode()).toBe(200);
      expect(adjRes.getBody().status).toBe('DNQ');

      const updatedT = await getFullTournament(tourney.id);
      const status = getPlayerQualifierStatus(updatedT!, player.id);
      expect(status).toBe('dnq');
    });

    it('adjudicates with DQ action, setting a tournament-scoped DQ (never the global player profile)', async () => {
      const adjReq = createMockReq({
        url: `/api/tournaments/${tourney.id}/qualify/adjudicate`,
        method: 'POST',
        headers: { authorization: `Bearer ${adminToken}` },
        body: {
          playerId: player.id,
          action: 'DQ',
          judgeNotes: 'Turbo controller used on stream',
          verifiedBy: 'Head Judge',
        },
      });
      const adjRes = createMockRes();
      await middleware(adjReq, adjRes as any, () => {});

      expect(adjRes.getStatusCode()).toBe(200);
      expect(adjRes.getBody().status).toBe('DQ');

      const dbPlayer = await getPlayer(player.id);
      expect(dbPlayer?.isDisqualified).toBe(false);

      const reloaded = await getFullTournament(tourney.id);
      expect(reloaded?.playersPool?.find(p => p.id === player.id)?.isDisqualified).toBe(true);
    });
  });
});
