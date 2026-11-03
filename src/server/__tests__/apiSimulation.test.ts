import { describe, it, expect, beforeEach } from 'vitest';
import { setupTestDb } from '../../db/testDb';
import { setDb } from '../../db';
import { simulateSampleTournament, createApiMiddleware } from '../api';
import { createSessionToken } from '../pinCrypto';
import { getFullTournament, deleteTournament } from '../../api/tournaments';
import { tournaments, bracketTiers, qualifierSubmissions, tournamentPlayers } from '../../db/schema';
import { runFullSimulation, generateRealisticPlayers } from '../../features/tournament/simulation';
import { generateDoubleEliminationBracket } from '../../features/bracket/math';
import type { Tournament } from '../../features/tournament/types';

describe('API Server & Full Simulation Engine against PostgreSQL Schema', () => {
  let testDb: any;

  beforeEach(() => {
    const { db } = setupTestDb();
    testDb = db;
    setDb(db);
  });

  describe('1. Sample Tournament Simulation & Authentic Names', () => {
    it('creates, simulates, and persists a complete tournament without any "Player X" names', async () => {
      const simulated = await simulateSampleTournament();

      expect(simulated.id).toBeDefined();
      expect(simulated.name).toContain('CTWC');
      expect(simulated.tiers).toHaveLength(2);

      // Verify no "Player X" in competitors
      expect(simulated.playersPool.length).toBeGreaterThanOrEqual(32);
      for (const player of simulated.playersPool) {
        expect(player.name.startsWith('Player ')).toBe(false);
      }

      // Reload from DB to confirm relational round-trip
      const loaded = await getFullTournament(simulated.id);
      expect(loaded).toBeDefined();
      expect(loaded!.playersPool.length).toBe(simulated.playersPool.length);
      expect(loaded!.qualifierSubmissions.length).toBe(simulated.qualifierSubmissions.length);

      // Verify Gold (Traditional) tier simulated matches
      const goldTier = loaded!.tiers.find(t => t.slug === 'gold');
      expect(goldTier).toBeDefined();
      expect(goldTier!.bracketType).toBe('TRADITIONAL');
      const goldMatches = Object.values(loaded!.matchScores).filter(m => m.tierId === goldTier!.id);
      expect(goldMatches.length).toBe(15);
      expect(goldMatches.every(m => m.isComplete)).toBe(true);

      // Verify Silver (Flat) tier simulated matches
      const silverTier = loaded!.tiers.find(t => t.slug === 'silver');
      expect(silverTier).toBeDefined();
      expect(silverTier!.bracketType).toBe('FLAT');
      const silverMatches = Object.values(loaded!.matchScores).filter(m => m.tierId === silverTier!.id);
      expect(silverMatches.length).toBe(15);
      expect(silverMatches.every(m => m.isComplete)).toBe(true);

      // Verify DB table counts
      const dbTourneys = await testDb.select().from(tournaments);
      expect(dbTourneys).toHaveLength(1);
      const dbTiers = await testDb.select().from(bracketTiers);
      expect(dbTiers).toHaveLength(2);
      const dbSubs = await testDb.select().from(qualifierSubmissions);
      expect(dbSubs.length).toBe(simulated.qualifierSubmissions.length);
      const dbTPlayers = await testDb.select().from(tournamentPlayers);
      expect(dbTPlayers.length).toBe(simulated.playersPool.length);
    });

    it('cascades deletion cleanly with zero orphaned rows in any table', async () => {
      const simulated = await simulateSampleTournament();
      expect(await getFullTournament(simulated.id)).not.toBeNull();

      const deleted = await deleteTournament(simulated.id);
      expect(deleted).toBe(true);

      expect(await getFullTournament(simulated.id)).toBeNull();
      expect(await testDb.select().from(tournaments)).toHaveLength(0);
      expect(await testDb.select().from(bracketTiers)).toHaveLength(0);
      expect(await testDb.select().from(qualifierSubmissions)).toHaveLength(0);
      expect(await testDb.select().from(tournamentPlayers)).toHaveLength(0);
    });
  });

  describe('2. Double Elimination Variant Simulation', () => {
    it('simulates Traditional Double Elimination brackets to completion', async () => {
      const pool = generateRealisticPlayers(16);

      const doubleTierId = crypto.randomUUID();
      const tourneyId = crypto.randomUUID();

      const doubleTourney: Tournament = {
        id: tourneyId,
        organizationId: 'org_ctwc',
        slug: 'double-elim-test',
        name: 'Double Elim Championship',
        location: 'Denver, CO',
        qualFormat: 'HIGH_SCORE',
        isLocked: false,
        seedingMethod: 'QUALIFIERS',
        playersPool: pool,
        qualifierSubmissions: [],
        tournamentPlayers: {},
        matchScores: {},
        tiers: [
          {
            id: doubleTierId,
            slug: 'champ',
            name: 'Double Elimination Tier',
            priority: 1,
            bracketType: 'TRADITIONAL',
            eliminationType: 'DOUBLE',
            bracketRouting: 'TRADITIONAL_TREE',
            playerCount: 8,
            bestOf: 3,
            isLocked: false,
            bracket: generateDoubleEliminationBracket(
              pool.slice(0, 8).map((p, i) => ({ id: p.id, name: p.name, seed: i + 1 })),
              { tierId: doubleTierId, bestOf: 3, bracketRouting: 'TRADITIONAL_TREE' }
            ),
          },
        ],
      };

      const simulated = runFullSimulation(doubleTourney, pool);
      expect(simulated.isLocked).toBe(true);
      expect(simulated.tiers[0].isLocked).toBe(true);
      expect(Object.keys(simulated.matchScores).length).toBeGreaterThan(0);
    });
  });

  describe('3. Connect/Vite API Middleware HTTP Handling', () => {
    it('responds to /api/health with status ok and db connected', async () => {
      const middleware = createApiMiddleware();

      let statusCode = 0;
      let responseBody = '';
      const req: any = {
        url: '/api/health',
        method: 'GET',
      };
      const res: any = {
        setHeader: () => {},
        end: (body: string) => {
          responseBody = body;
        },
        set statusCode(val: number) {
          statusCode = val;
        },
        get statusCode() {
          return statusCode;
        },
      };

      await middleware(req, res, () => {});
      expect(statusCode).toBe(200);
      const parsed = JSON.parse(responseBody);
      expect(parsed.status).toBe('ok');
      expect(parsed.db).toBe('connected');
    });

    it('responds to /api/health with 503 error when database is unreachable', async () => {
      const middleware = createApiMiddleware();

      // Temporarily mock db to simulate unreachable PostgreSQL container
      setDb({
        execute: () => Promise.reject(new Error('Connection refused: 127.0.0.1:5433')),
      } as any);

      let statusCode = 0;
      let responseBody = '';
      const req: any = {
        url: '/api/health',
        method: 'GET',
      };
      const res: any = {
        setHeader: () => {},
        end: (body: string) => {
          responseBody = body;
        },
        set statusCode(val: number) {
          statusCode = val;
        },
        get statusCode() {
          return statusCode;
        },
      };

      await middleware(req, res, () => {});
      expect(statusCode).toBe(503);
      const parsed = JSON.parse(responseBody);
      expect(parsed.status).toBe('error');
      expect(parsed.db).toBe('disconnected');
      expect(parsed.error).toContain('Connection refused');

      // Restore testDb
      setDb(testDb);
    });

    it('responds to /api/simulate/sample and returns simulated tournament', async () => {
      const middleware = createApiMiddleware();

      let statusCode = 0;
      let responseBody = '';
      const req: any = {
        url: '/api/simulate/sample',
        method: 'POST',
        headers: {
          authorization: `Bearer ${createSessionToken({ role: 'MASTER_ADMIN' })}`,
        },
      };
      const res: any = {
        setHeader: () => {},
        end: (body: string) => {
          responseBody = body;
        },
        set statusCode(val: number) {
          statusCode = val;
        },
        get statusCode() {
          return statusCode;
        },
      };

      await middleware(req, res, () => {});
      expect(statusCode).toBe(201);
      const parsed = JSON.parse(responseBody);
      expect(parsed.id).toBeDefined();
      expect(parsed.tiers).toHaveLength(2);
    });
  });
});
