import { describe, it, expect, beforeEach } from 'vitest';
import { Readable } from 'node:stream';
import { setupTestDb } from '../../db/testDb';
import { setDb } from '../../db';
import { createApiMiddleware } from '../api';
import { createSessionToken, encryptPin } from '../pinCrypto';
import { saveFullTournament } from '../../api/tournaments';
import { seedDefaultOrganizations } from '../../api/organizations';
import { createEmptyTournament, createDefaultTier } from '../../features/tournament/defaults';

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

describe('API Authorization & Multi-Tier PIN Security Engine', () => {
  let middleware: ReturnType<typeof createApiMiddleware>;

  beforeEach(async () => {
    process.env.SYSTEM_ADMIN_RECOVERY_PIN = '999999';
    process.env.MASTER_ADMIN_RECOVERY_PIN = '999999';
    const { db } = setupTestDb();
    setDb(db);
    await seedDefaultOrganizations();
    middleware = createApiMiddleware();
  });

  describe('1. Authentication via PIN (/api/auth/pin)', () => {
    it('authenticates system recovery PIN and returns SYSTEM_ADMIN session token', async () => {
      const pin = process.env.SYSTEM_ADMIN_RECOVERY_PIN || '999999';
      const req = createMockReq({
        url: '/api/auth/pin',
        method: 'POST',
        body: { pin },
      });
      const res = createMockRes();

      await middleware(req, res as any, () => {});

      expect(res.getStatusCode()).toBe(200);
      const data = res.getBody();
      expect(data.role).toBe('SYSTEM_ADMIN');
      expect(data.token).toBeDefined();
    });

    it('authenticates tournament-specific PIN and returns TOURNAMENT_ADMIN session token', async () => {
      const tourneyId = crypto.randomUUID();
      const tourney = createEmptyTournament({ slug: 'test-tourney', name: 'Test Tournament' });
      tourney.id = tourneyId;
      tourney.slug = 'test-tourney';
      tourney.organizationId = 'org_ctwc';
      tourney.adminPinEncrypted = encryptPin('4567');
      await saveFullTournament(tourney);

      const req = createMockReq({
        url: '/api/auth/pin',
        method: 'POST',
        body: { pin: '4567', tournamentSlugOrId: 'test-tourney' },
      });
      const res = createMockRes();

      await middleware(req, res as any, () => {});

      expect(res.getStatusCode()).toBe(200);
      const data = res.getBody();
      expect(data.role).toBe('TOURNAMENT_ADMIN');
      expect(data.tournamentId).toBe(tourneyId);
      expect(data.token).toBeDefined();
    });

    it('authenticates shared PIN across multiple tournaments and returns all matching tournament IDs and slugs', async () => {
      const tourney1Id = crypto.randomUUID();
      const tourney1 = createEmptyTournament({ slug: 'tourney-alpha', name: 'Tournament Alpha' });
      tourney1.id = tourney1Id;
      tourney1.slug = 'tourney-alpha';
      tourney1.organizationId = 'org_ctwc';
      tourney1.adminPinEncrypted = encryptPin('7777');
      await saveFullTournament(tourney1);

      const tourney2Id = crypto.randomUUID();
      const tourney2 = createEmptyTournament({ slug: 'tourney-beta', name: 'Tournament Beta' });
      tourney2.id = tourney2Id;
      tourney2.slug = 'tourney-beta';
      tourney2.organizationId = 'org_ctwc';
      tourney2.adminPinEncrypted = encryptPin('7777'); // Same shared PIN
      await saveFullTournament(tourney2);

      const tourney3Id = crypto.randomUUID();
      const tourney3 = createEmptyTournament({ slug: 'tourney-gamma', name: 'Tournament Gamma' });
      tourney3.id = tourney3Id;
      tourney3.slug = 'tourney-gamma';
      tourney3.organizationId = 'org_ctwc';
      tourney3.adminPinEncrypted = encryptPin('8888'); // Different PIN
      await saveFullTournament(tourney3);

      // Log in with shared PIN "7777" without selecting a specific scope
      const req = createMockReq({
        url: '/api/auth/pin',
        method: 'POST',
        body: { pin: '7777' },
      });
      const res = createMockRes();
      await middleware(req, res as any, () => {});

      expect(res.getStatusCode()).toBe(200);
      const data = res.getBody();
      expect(data.role).toBe('TOURNAMENT_ADMIN');
      expect(data.tournamentIds).toContain(tourney1Id);
      expect(data.tournamentIds).toContain(tourney2Id);
      expect(data.tournamentIds).not.toContain(tourney3Id);
      expect(data.tournamentSlugs).toContain('tourney-alpha');
      expect(data.tournamentSlugs).toContain('tourney-beta');
      expect(data.tournamentSlugs).not.toContain('tourney-gamma');

      // Verify token authorizes mutations on both tourney-alpha and tourney-beta
      const token = data.token;

      const updateReq1 = createMockReq({
        url: `/api/tournaments/${tourney1Id}/pin`,
        method: 'PUT',
        body: { pin: '7777' },
        headers: { authorization: `Bearer ${token}` },
      });
      const updateRes1 = createMockRes();
      await middleware(updateReq1, updateRes1 as any, () => {});
      expect(updateRes1.getStatusCode()).toBe(200);

      const updateReq2 = createMockReq({
        url: `/api/tournaments/${tourney2Id}/pin`,
        method: 'PUT',
        body: { pin: '7777' },
        headers: { authorization: `Bearer ${token}` },
      });
      const updateRes2 = createMockRes();
      await middleware(updateReq2, updateRes2 as any, () => {});
      expect(updateRes2.getStatusCode()).toBe(200);
      expect(updateRes2.getBody().isShared).toBe(true);
      expect(updateRes2.getBody().success).toBe(false);
      expect(updateRes2.getBody().sharedTournaments[0].id).toBe(tourney1Id);

      // Confirm with confirmed: true
      const confirmReq2 = createMockReq({
        url: `/api/tournaments/${tourney2Id}/pin`,
        method: 'PUT',
        body: { pin: '7777', confirmed: true },
        headers: { authorization: `Bearer ${token}` },
      });
      const confirmRes2 = createMockRes();
      await middleware(confirmReq2, confirmRes2 as any, () => {});
      expect(confirmRes2.getStatusCode()).toBe(200);
      expect(confirmRes2.getBody().success).toBe(true);

      // But accessing tourney-gamma with this token fails with 403 Forbidden
      const updateReq3 = createMockReq({
        url: `/api/tournaments/${tourney3Id}/pin`,
        method: 'PUT',
        body: { pin: '9999' },
        headers: { authorization: `Bearer ${token}` },
      });
      const updateRes3 = createMockRes();
      await middleware(updateReq3, updateRes3 as any, () => {});
      expect(updateRes3.getStatusCode()).toBe(403);
    });

    it('returns 401 Unauthorized for invalid PIN', async () => {
      const req = createMockReq({
        url: '/api/auth/pin',
        method: 'POST',
        body: { pin: 'wrong-pin' },
      });
      const res = createMockRes();

      await middleware(req, res as any, () => {});

      expect(res.getStatusCode()).toBe(401);
      expect(res.getBody().error).toContain('Invalid PIN');
    });

    it('rejects dev fallback 0000 when SYSTEM_ADMIN_RECOVERY_PIN is explicitly set in env', async () => {
      process.env.SYSTEM_ADMIN_RECOVERY_PIN = '!Te67Omentris69420!';
      const req = createMockReq({
        url: '/api/auth/pin',
        method: 'POST',
        body: { pin: '0000' },
      });
      const res = createMockRes();

      await middleware(req, res as any, () => {});

      expect(res.getStatusCode()).toBe(401);
      expect(res.getBody().error).toContain('Invalid PIN');

      // But authenticates the real configured recovery PIN
      const req2 = createMockReq({
        url: '/api/auth/pin',
        method: 'POST',
        body: { pin: '!Te67Omentris69420!' },
      });
      const res2 = createMockRes();

      await middleware(req2, res2 as any, () => {});

      expect(res2.getStatusCode()).toBe(200);
      expect(res2.getBody().role).toBe('SYSTEM_ADMIN');
    });

    it('allows dev fallback 0000 only when no recovery PIN is configured in dev', async () => {
      delete process.env.SYSTEM_ADMIN_RECOVERY_PIN;
      delete process.env.MASTER_ADMIN_RECOVERY_PIN;
      const prevEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const req = createMockReq({
        url: '/api/auth/pin',
        method: 'POST',
        body: { pin: '0000' },
      });
      const res = createMockRes();

      await middleware(req, res as any, () => {});

      expect(res.getStatusCode()).toBe(200);
      expect(res.getBody().role).toBe('SYSTEM_ADMIN');

      process.env.NODE_ENV = prevEnv;
      process.env.SYSTEM_ADMIN_RECOVERY_PIN = '999999';
    });
  });

  describe('2. Unauthenticated Mutation Protection', () => {
    it('rejects unauthenticated POST /api/players with 401', async () => {
      const req = createMockReq({
        url: '/api/players',
        method: 'POST',
        body: { name: 'Unauthorized Player' },
      });
      const res = createMockRes();

      await middleware(req, res as any, () => {});

      expect(res.getStatusCode()).toBe(401);
      expect(res.getBody().error).toContain('Unauthorized');
    });

    it('rejects unauthenticated POST /api/tournaments with 401', async () => {
      const req = createMockReq({
        url: '/api/tournaments',
        method: 'POST',
        body: { name: 'Unauthorized Tournament' },
      });
      const res = createMockRes();

      await middleware(req, res as any, () => {});

      expect(res.getStatusCode()).toBe(401);
    });

    it('rejects unauthenticated match score updates with 401', async () => {
      const dummyId = crypto.randomUUID();
      const req = createMockReq({
        url: `/api/tournaments/${dummyId}/matches/m-1/score`,
        method: 'PUT',
        body: { tierId: 'tier-1', scoredGames: [] },
      });
      const res = createMockRes();

      await middleware(req, res as any, () => {});

      expect(res.getStatusCode()).toBe(401);
    });
  });

  describe('3. Tournament Admin Scope & Simulation Isolation', () => {
    it('forbids Tournament Admin from triggering System Admin simulation (/api/simulate/sample)', async () => {
      const token = createSessionToken({
        role: 'TOURNAMENT_ADMIN',
        tournamentId: crypto.randomUUID(),
      });
      const req = createMockReq({
        url: '/api/simulate/sample',
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
      });
      const res = createMockRes();

      await middleware(req, res as any, () => {});

      expect(res.getStatusCode()).toBe(403);
      expect(res.getBody().error).toContain('Requires System Admin permissions');
    });

    it('forbids Tournament Admin from triggering clear-all data wipe', async () => {
      const tourneyId = crypto.randomUUID();
      const token = createSessionToken({
        role: 'TOURNAMENT_ADMIN',
        tournamentId: tourneyId,
      });
      const req = createMockReq({
        url: `/api/tournaments/${tourneyId}/clear-all`,
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
      });
      const res = createMockRes();

      await middleware(req, res as any, () => {});

      expect(res.getStatusCode()).toBe(403);
      expect(res.getBody().error).toContain('Requires System Admin permissions');
    });

    it('forbids Tournament Admin from modifying a different tournament', async () => {
      const myId = crypto.randomUUID();
      const otherId = crypto.randomUUID();
      const token = createSessionToken({
        role: 'TOURNAMENT_ADMIN',
        tournamentId: myId,
      });
      const req = createMockReq({
        url: `/api/tournaments/${otherId}/lock`,
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
      });
      const res = createMockRes();

      await middleware(req, res as any, () => {});

      expect(res.getStatusCode()).toBe(403);
      expect(res.getBody().error).toContain('Tournament Admin scope does not match');
    });

    it('allows Tournament Admin to modify their own tournament (lock/unlock)', async () => {
      const tourneyId = crypto.randomUUID();
      const tierId = crypto.randomUUID();
      const tourney = createEmptyTournament({ slug: 'my-tourney', name: 'My Tournament' });
      tourney.id = tourneyId;
      tourney.organizationId = 'org_ctwc';
      tourney.tiers = [createDefaultTier(1, { id: tierId, name: 'Gold' })];
      tourney.isLocked = false;
      await saveFullTournament(tourney);

      const token = createSessionToken({
        role: 'TOURNAMENT_ADMIN',
        tournamentId: tourneyId,
      });
      const req = createMockReq({
        url: `/api/tournaments/${tourneyId}/lock`,
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
      });
      const res = createMockRes();

      await middleware(req, res as any, () => {});

      expect(res.getStatusCode()).toBe(200);
      expect(res.getBody().isLocked).toBe(true);
    });
  });

  describe('4. System Admin Privileges & PIN Reveal', () => {
    it('allows System Admin to reveal encrypted tournament PIN', async () => {
      const tourneyId = crypto.randomUUID();
      const tourney = createEmptyTournament({ slug: 'secret-tourney', name: 'Secret Tourney' });
      tourney.id = tourneyId;
      tourney.organizationId = 'org_ctwc';
      tourney.adminPinEncrypted = encryptPin('7492');
      await saveFullTournament(tourney);

      const systemToken = createSessionToken({ role: 'SYSTEM_ADMIN' });
      const req = createMockReq({
        url: `/api/tournaments/${tourneyId}/reveal-pin`,
        method: 'GET',
        headers: { authorization: `Bearer ${systemToken}` },
      });
      const res = createMockRes();

      await middleware(req, res as any, () => {});

      expect(res.getStatusCode()).toBe(200);
      expect(res.getBody().pin).toBe('7492');
    });

    it('forbids Tournament Admin from revealing PIN of any tournament', async () => {
      const tourneyId = crypto.randomUUID();
      const token = createSessionToken({
        role: 'TOURNAMENT_ADMIN',
        tournamentId: tourneyId,
      });
      const req = createMockReq({
        url: `/api/tournaments/${tourneyId}/reveal-pin`,
        method: 'GET',
        headers: { authorization: `Bearer ${token}` },
      });
      const res = createMockRes();

      await middleware(req, res as any, () => {});

      expect(res.getStatusCode()).toBe(403);
      expect(res.getBody().error).toContain('Requires System Admin permissions');
    });

    it('allows System Admin to clear-all data', async () => {
      const tourneyId = crypto.randomUUID();
      const tourney = createEmptyTournament({ slug: 'wipe-tourney', name: 'Wipe Me' });
      tourney.id = tourneyId;
      tourney.organizationId = 'org_ctwc';
      await saveFullTournament(tourney);

      const systemToken = createSessionToken({ role: 'SYSTEM_ADMIN' });
      const req = createMockReq({
        url: `/api/tournaments/${tourneyId}/clear-all`,
        method: 'POST',
        headers: { authorization: `Bearer ${systemToken}` },
      });
      const res = createMockRes();

      await middleware(req, res as any, () => {});

      expect(res.getStatusCode()).toBe(200);
      expect(res.getBody().playersPool).toEqual([]);
      expect(res.getBody().id).toBe(tourneyId);
    });
    it('allows Tournament Admin to modify their own tournament via slug', async () => {
      const tourneyId = crypto.randomUUID();
      const tourney = createEmptyTournament({ slug: 'omen-open', name: 'Omen Open' });
      tourney.id = tourneyId;
      tourney.slug = 'omen-open';
      tourney.organizationId = 'org_ctwc';
      await saveFullTournament(tourney);

      const token = createSessionToken({
        role: 'TOURNAMENT_ADMIN',
        tournamentId: tourneyId,
        tournamentSlug: 'omen-open',
      });
      // Updating PIN via slug route
      const req = createMockReq({
        url: '/api/tournaments/omen-open/pin',
        method: 'PUT',
        headers: { authorization: `Bearer ${token}` },
        body: { pin: '8844' },
      });
      const res = createMockRes();

      await middleware(req, res as any, () => {});

      expect(res.getStatusCode()).toBe(200);
      expect(res.getBody().success).toBe(true);

      // Verify login with new PIN
      const loginReq = createMockReq({
        url: '/api/auth/pin',
        method: 'POST',
        body: { pin: '8844', tournamentSlugOrId: 'omen-open' },
      });
      const loginRes = createMockRes();
      await middleware(loginReq, loginRes as any, () => {});

      expect(loginRes.getStatusCode()).toBe(200);
      expect(loginRes.getBody().role).toBe('TOURNAMENT_ADMIN');
      expect(loginRes.getBody().tournamentSlug).toBe('omen-open');

      // Verify System Admin can reveal it via slug
      const systemToken = createSessionToken({ role: 'SYSTEM_ADMIN' });
      const revealReq = createMockReq({
        url: '/api/tournaments/omen-open/reveal-pin',
        method: 'GET',
        headers: { authorization: `Bearer ${systemToken}` },
      });
      const revealRes = createMockRes();
      await middleware(revealReq, revealRes as any, () => {});

      expect(revealRes.getStatusCode()).toBe(200);
      expect(revealRes.getBody().pin).toBe('8844');
    });
  });

  describe('7. Global Player & Qualifier Walk-In Management', () => {
    it('allows Tournament Admin to create, update, and delete unattached players', async () => {
      const tourneyId = crypto.randomUUID();
      const token = createSessionToken({
        role: 'TOURNAMENT_ADMIN',
        tournamentId: tourneyId,
      });

      // Create player
      const createReq = createMockReq({
        url: '/api/players',
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
        body: { name: 'Walk-In Star', personalBest: 950000 },
      });
      const createRes = createMockRes();
      await middleware(createReq, createRes as any, () => {});

      expect(createRes.getStatusCode()).toBe(201);
      const created = createRes.getBody();
      expect(created.name).toBe('Walk-In Star');

      // Update player
      const updateReq = createMockReq({
        url: `/api/players/${created.id}`,
        method: 'PUT',
        headers: { authorization: `Bearer ${token}` },
        body: { personalBest: 980000 },
      });
      const updateRes = createMockRes();
      await middleware(updateReq, updateRes as any, () => {});

      expect(updateRes.getStatusCode()).toBe(200);
      expect(updateRes.getBody().personalBest).toBe(980000);

      // Delete unattached player
      const deleteReq = createMockReq({
        url: `/api/players/${created.id}`,
        method: 'DELETE',
        headers: { authorization: `Bearer ${token}` },
      });
      const deleteRes = createMockRes();
      await middleware(deleteReq, deleteRes as any, () => {});

      expect(deleteRes.getStatusCode()).toBe(200);
    });

    it('submitting qualifier with playerName auto-registers player in tournament playersPool', async () => {
      const tourneyId = crypto.randomUUID();
      const tourney = createEmptyTournament({ slug: 'walkin-tourney', name: 'Walk-in Tourney' });
      tourney.id = tourneyId;
      tourney.organizationId = 'org_ctwc';
      await saveFullTournament(tourney);

      const token = createSessionToken({
        role: 'TOURNAMENT_ADMIN',
        tournamentId: tourneyId,
      });

      const tempId = crypto.randomUUID();
      const qualReq = createMockReq({
        url: `/api/tournaments/${tourneyId}/qualifiers`,
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
        body: {
          playerId: tempId,
          score: 875000,
          playerName: 'Fresh Walkin Competitor',
        },
      });
      const qualRes = createMockRes();
      await middleware(qualReq, qualRes as any, () => {});

      expect(qualRes.getStatusCode()).toBe(201);
      const updatedTourney = qualRes.getBody();
      expect(updatedTourney.qualifierSubmissions.length).toBe(1);
      expect(updatedTourney.qualifierSubmissions[0].score).toBe(875000);
      // The player was auto-registered in playersPool
      expect(updatedTourney.playersPool.some((p: any) => p.name === 'Fresh Walkin Competitor')).toBe(true);
    });
  });
});
