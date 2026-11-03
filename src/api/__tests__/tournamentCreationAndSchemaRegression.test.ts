import { describe, it, expect, beforeEach } from 'vitest';
import { setupTestDb } from '../../db/testDb';
import { setDb } from '../../db';
import {
  tournaments,
  matches,
  games,
  players,
  tournamentPlayers,
  qualifierSubmissions,
} from '../../db/schema';
import { eq, inArray } from 'drizzle-orm';
import {
  createTournament,
  getFullTournament,
  saveFullTournament,
} from '../tournaments';
import { createApiMiddleware } from '../../server/api';
import { createSessionToken } from '../../server/pinCrypto';
import { runFullSimulation } from '../../features/tournament/simulation';
import type { PlayerProfile, Tournament } from '../../features/tournament/types';

describe('Tournament Creation & Schema Regression Tests', () => {
  let db: any;
  let middleware: any;

  beforeEach(() => {
    const testDb = setupTestDb();
    db = testDb.db;
    setDb(db);
    middleware = createApiMiddleware();
  });

  const createCompetitors = async (count: number): Promise<PlayerProfile[]> => {
    const list: any[] = [];
    for (let i = 1; i <= count; i++) {
      list.push({
        id: crypto.randomUUID(),
        name: `Player_${i}_${Date.now() % 10000}`,
        country: i % 2 === 0 ? 'US' : 'JP',
        personalBest: 850000 + i * 15000,
        playstyle: i % 3 === 0 ? 'DAS' : 'Rolling',
      });
    }
    await db.insert(players).values(list);
    return list.map(p => ({
      ...p,
      avatarType: 'flag' as const,
      isDisqualified: false,
    }));
  };

  const makeHttpRequest = async (url: string, method: string, body?: any) => {
    let statusCode = 0;
    let responseBody = '';
    const req: any = {
      url,
      method,
      headers: {
        authorization: `Bearer ${createSessionToken({ role: 'SYSTEM_ADMIN' })}`,
      },
      body,
      on: (event: string, callback: any) => {
        if (event === 'data' && body) {
          callback(Buffer.from(JSON.stringify(body)));
        }
        if (event === 'end') {
          callback();
        }
      },
    };
    const res: any = {
      setHeader: () => {},
      end: (data: string) => {
        responseBody = data;
      },
      set statusCode(val: number) {
        statusCode = val;
      },
      get statusCode() {
        return statusCode;
      },
    };
    await middleware(req, res, () => {});
    return {
      status: statusCode,
      body: responseBody ? JSON.parse(responseBody) : null,
    };
  };

  describe('1. Tournament Creation with Organization ID & Slug', () => {
    it('successfully creates and saves tournament with organizationId, slug, and metadata', async () => {
      const testTourney: Tournament = {
        id: crypto.randomUUID(),
        organizationId: 'org_ctwc',
        name: 'Championship Open',
        slug: 'championship-open',
        location: 'Online',
        seedingMethod: 'QUALIFIERS',
        qualFormat: 'AVERAGE_OF_X',
        qualAverageCount: 2,
        isLocked: false,
        tiers: [
          {
            id: crypto.randomUUID(),
            slug: 'gold-tier',
            name: 'Gold Tier',
            priority: 1,
            bracketType: 'TRADITIONAL',
            playerCount: 8,
            primaryColor: '#FFD700',
            secondaryColor: '#000000',
            eliminationType: 'SINGLE',
            bestOf: 3,
            isLocked: false,
            bracket: { type: 'TRADITIONAL', totalPlayers: 8, totalRounds: 3, rounds: [], matchesById: {} },
          },
        ],
        playersPool: [],
        qualifierSubmissions: [],
        tournamentPlayers: {},
        matchScores: {},
      };

      const saved = await saveFullTournament(testTourney);
      expect(saved.name).toBe('Championship Open');
      expect(saved.slug).toBe('championship-open');
      expect(saved.organizationId).toBe('org_ctwc');

      // Verify direct schema query selecting organization_id, slug, and metadata
      const [tRow] = await db
        .select()
        .from(tournaments)
        .where(eq(tournaments.id, saved.id));

      expect(tRow).toBeDefined();
      expect(tRow.organizationId).toBe('org_ctwc');
      expect(tRow.slug).toBe('championship-open');
      expect(tRow.name).toBe('Championship Open');

      // Verify retrieval through getFullTournament
      const fetchedBySlug = await getFullTournament('championship-open');
      expect(fetchedBySlug).toBeDefined();
      expect(fetchedBySlug?.id).toBe(saved.id);
      expect(fetchedBySlug?.organizationId).toBe('org_ctwc');

      const fetchedById = await getFullTournament(saved.id);
      expect(fetchedById).toBeDefined();
      expect(fetchedById?.slug).toBe('championship-open');
    });

    it('creates tournament via POST /api/tournaments and retrieves via GET /api/tournaments/:id', async () => {
      const res = await makeHttpRequest('/api/tournaments', 'POST', {
        name: 'Championship Open HTTP',
        slug: 'championship-open-http',
        organizationId: 'org_ctm',
        qualFormat: 'HIGH_SCORE',
        tiers: [
          {
            name: 'Masters',
            bracketType: 'TRADITIONAL',
            playerCount: 8,
            priority: 1,
            eliminationType: 'DOUBLE',
            bracketRouting: 'TRADITIONAL',
          },
        ],
      });

      expect(res.status).toBe(201);
      expect(res.body).toBeDefined();
      expect(res.body.organizationId).toBe('org_ctm');
      expect(res.body.slug).toBe('championship-open-http');

      const getRes = await makeHttpRequest(`/api/tournaments/${res.body.id}`, 'GET');
      expect(getRes.status).toBe(200);
      expect(getRes.body.name).toBe('Championship Open HTTP');
      expect(getRes.body.organizationId).toBe('org_ctm');
    });
  });

  describe('2. Comprehensive Bracket Types & Double Elimination Variants', () => {
    it('persists and retrieves Single Elimination: Traditional', async () => {
      const competitors = await createCompetitors(8);
      const { tournament } = await createTournament({
        name: 'Single Elim Traditional',
        organizationId: 'org_ctwc',
        qualFormat: 'HIGH_SCORE',
        tiers: [
          {
            name: 'Gold',
            bracketType: 'TRADITIONAL',
            numPlayers: 8,
            priorityOrder: 1,
            eliminationType: 'SINGLE',
          },
        ],
      });

      const full = await getFullTournament(tournament.id);
      expect(full).toBeDefined();
      if (!full) return;

      full.playersPool = competitors;
      full.manualSeeds = competitors.map(c => c.id);
      full.seedingMethod = 'MANUAL';

      const simulated = runFullSimulation(full, competitors);
      const saved = await saveFullTournament(simulated);
      expect(saved.tiers[0].bracket).toBeDefined();

      const dbMatches = await db
        .select()
        .from(matches)
        .where(eq(matches.tierId, saved.tiers[0].id));
      expect(dbMatches.length).toBe(7);

      const dbGames = await db
        .select()
        .from(games)
        .where(inArray(games.matchId, dbMatches.map((m: any) => m.id)));
      expect(dbGames.length).toBeGreaterThanOrEqual(14);
    });

    it('persists and retrieves Single Elimination: Flat', async () => {
      const competitors = await createCompetitors(8);
      const { tournament } = await createTournament({
        name: 'Single Elim Flat',
        organizationId: 'org_ctm',
        qualFormat: 'HIGH_SCORE',
        tiers: [
          {
            name: 'Silver Flat',
            bracketType: 'FLAT',
            flatWidth: 4,
            numPlayers: 8,
            priorityOrder: 1,
            eliminationType: 'SINGLE',
          },
        ],
      });

      const full = await getFullTournament(tournament.id);
      expect(full).toBeDefined();
      if (!full) return;

      full.playersPool = competitors;
      full.manualSeeds = competitors.map(c => c.id);
      full.seedingMethod = 'MANUAL';

      const simulated = runFullSimulation(full, competitors);
      const saved = await saveFullTournament(simulated);
      expect(saved.tiers[0].bracketType).toBe('FLAT');
      expect(saved.tiers[0].flatWidth).toBe(4);

      const dbMatches = await db
        .select()
        .from(matches)
        .where(eq(matches.tierId, saved.tiers[0].id));
      expect(dbMatches.length).toBeGreaterThan(0);
    });

    it('persists and retrieves Double Elimination: Traditional', async () => {
      const competitors = await createCompetitors(8);
      const { tournament } = await createTournament({
        name: 'Double Elim Traditional Variant',
        organizationId: 'org_ctwc',
        qualFormat: 'AVERAGE_OF_X',
        qualAverageCount: 2,
        tiers: [
          {
            name: 'Championship',
            bracketType: 'TRADITIONAL',
            numPlayers: 8,
            priorityOrder: 1,
            eliminationType: 'DOUBLE',
            bracketRouting: 'TRADITIONAL',
          },
        ],
      });

      const full = await getFullTournament(tournament.id);
      if (!full) return;

      full.playersPool = competitors;
      full.manualSeeds = competitors.map(c => c.id);
      full.seedingMethod = 'MANUAL';

      const simulated = runFullSimulation(full, competitors);
      const saved = await saveFullTournament(simulated);

      expect(saved.tiers[0].eliminationType).toBe('DOUBLE');
      expect(saved.tiers[0].bracketRouting).toBe('TRADITIONAL');

      const reloaded = await getFullTournament(saved.id);
      expect(reloaded?.tiers[0].eliminationType).toBe('DOUBLE');
      expect(reloaded?.tiers[0].bracketRouting).toBe('TRADITIONAL');
    });

    it('persists and retrieves Double Elimination: Flat Staged', async () => {
      const competitors = await createCompetitors(16);
      const { tournament } = await createTournament({
        name: 'Double Elim Flat Staged Variant',
        organizationId: 'org_ctm',
        qualFormat: 'HIGH_SCORE',
        tiers: [
          {
            name: 'Staged Bracket',
            bracketType: 'FLAT',
            flatWidth: 4,
            numPlayers: 16,
            priorityOrder: 1,
            eliminationType: 'DOUBLE',
            bracketRouting: 'FLAT_STAGED',
          },
        ],
      });

      const full = await getFullTournament(tournament.id);
      if (!full) return;

      full.playersPool = competitors;
      full.manualSeeds = competitors.map(c => c.id);
      full.seedingMethod = 'MANUAL';

      const simulated = runFullSimulation(full, competitors);
      const saved = await saveFullTournament(simulated);

      expect(saved.tiers[0].bracketRouting).toBe('FLAT_STAGED');
      const reloaded = await getFullTournament(saved.id);
      expect(reloaded?.tiers[0].bracketRouting).toBe('FLAT_STAGED');
      expect(reloaded?.tiers[0].flatWidth).toBe(4);
    });

    it('persists and retrieves Double Elimination: Accelerated Hybrid', async () => {
      const competitors = await createCompetitors(16);
      const { tournament } = await createTournament({
        name: 'Double Elim Accelerated Hybrid Variant',
        organizationId: 'org_ctwc',
        qualFormat: 'POINTS',
        pointsConfig: [{ minScore: 100000, points: 10 }, { minScore: 500000, points: 50 }],
        tiers: [
          {
            name: 'Accelerated Hybrid Tier',
            bracketType: 'TRADITIONAL',
            numPlayers: 16,
            priorityOrder: 1,
            eliminationType: 'DOUBLE',
            bracketRouting: 'ACCELERATED_HYBRID',
          },
        ],
      });

      const full = await getFullTournament(tournament.id);
      if (!full) return;

      full.playersPool = competitors;
      full.manualSeeds = competitors.map(c => c.id);
      full.seedingMethod = 'MANUAL';

      const simulated = runFullSimulation(full, competitors);
      const saved = await saveFullTournament(simulated);

      expect(saved.tiers[0].bracketRouting).toBe('ACCELERATED_HYBRID');
      const reloaded = await getFullTournament(saved.id);
      expect(reloaded?.tiers[0].bracketRouting).toBe('ACCELERATED_HYBRID');
      expect(reloaded?.pointsConfig).toHaveLength(2);
    });
  });

  describe('3. Multi-Tier Management & Tier-Switching States', () => {
    it('preserves multi-tier state across tier switching and updates', async () => {
      const competitors = await createCompetitors(24);

      const { tournament } = await createTournament({
        name: 'Multi-Tier Spectacular',
        organizationId: 'org_ctwc',
        qualFormat: 'HIGH_SCORE',
        tiers: [
          {
            name: 'Gold Masters',
            slug: 'gold-masters',
            bracketType: 'TRADITIONAL',
            numPlayers: 8,
            priorityOrder: 1,
            eliminationType: 'DOUBLE',
            bracketRouting: 'TRADITIONAL',
            primaryColor: '#FFD700',
            secondaryColor: '#B8860B',
          },
          {
            name: 'Silver Challenger',
            slug: 'silver-challenger',
            bracketType: 'FLAT',
            flatWidth: 4,
            numPlayers: 16,
            priorityOrder: 2,
            eliminationType: 'SINGLE',
            primaryColor: '#C0C0C0',
            secondaryColor: '#808080',
          },
        ],
      });

      const full = await getFullTournament(tournament.id);
      expect(full?.tiers).toHaveLength(2);
      expect(full?.tiers[0].name).toBe('Gold Masters');
      expect(full?.tiers[1].name).toBe('Silver Challenger');

      // Simulate tier switching: modify tier 2 settings and preserve tier 1
      if (!full) return;
      full.playersPool = competitors;
      full.tiers[1].playerCount = 8;
      full.tiers[1].flatWidth = 2;
      full.tiers[0].primaryColor = '#FFDF00';

      const saved = await saveFullTournament(full);
      expect(saved.tiers).toHaveLength(2);
      expect(saved.tiers[0].primaryColor).toBe('#FFDF00');
      expect(saved.tiers[1].playerCount).toBe(8);
      expect(saved.tiers[1].flatWidth).toBe(2);

      const reloaded = await getFullTournament(saved.id);
      expect(reloaded?.tiers[0].name).toBe('Gold Masters');
      expect(reloaded?.tiers[1].name).toBe('Silver Challenger');
      expect(reloaded?.tiers[0].priority).toBe(1);
      expect(reloaded?.tiers[1].priority).toBe(2);
    });
  });

  describe('4. Filter Interactions & Qualifier Processing', () => {
    it('properly filters and persists player qualifier submissions and seed assignments', async () => {
      const competitors = await createCompetitors(16);
      const { tournament } = await createTournament({
        name: 'Qualifiers Filtering Tournament',
        organizationId: 'org_ctm',
        qualFormat: 'HIGH_SCORE',
        tiers: [
          {
            name: 'Main Bracket',
            bracketType: 'TRADITIONAL',
            numPlayers: 8,
            priorityOrder: 1,
          },
        ],
      });

      const full = await getFullTournament(tournament.id);
      if (!full) return;

      // Assign qualifier scores to competitors
      full.playersPool = competitors;
      full.qualifierSubmissions = competitors.map((p, idx) => ({
        id: crypto.randomUUID(),
        tournamentId: full.id,
        playerId: p.id,
        score: 600000 + idx * 25000,
        submittedAt: Date.now() - idx * 1000,
      }));

      // Top 8 qualify for tier 1
      full.tournamentPlayers = {};
      const sortedByScore = [...full.qualifierSubmissions].sort((a, b) => b.score - a.score);
      sortedByScore.slice(0, 8).forEach((sub, seedIdx) => {
        full.tournamentPlayers[sub.playerId] = {
          tournamentId: full.id,
          playerId: sub.playerId,
          tierId: full.tiers[0].id,
          seed: seedIdx + 1,
          qualsCompleted: true,
        };
      });

      const saved = await saveFullTournament(full);
      expect(saved.qualifierSubmissions).toHaveLength(16);
      const seededPlayers = Object.values(saved.tournamentPlayers).filter(tp => tp.seed !== undefined);
      expect(seededPlayers).toHaveLength(8);
      expect(Object.keys(saved.tournamentPlayers)).toHaveLength(16);

      // Verify database tables tournament_players and qualifier_submissions
      const dbSubs = await db
        .select()
        .from(qualifierSubmissions)
        .where(eq(qualifierSubmissions.tournamentId, saved.id));
      expect(dbSubs.length).toBe(16);

      const dbTP = await db
        .select()
        .from(tournamentPlayers)
        .where(eq(tournamentPlayers.tournamentId, saved.id));
      expect(dbTP.length).toBe(16);

      const reloaded = await getFullTournament(saved.id);
      expect(reloaded?.qualifierSubmissions).toHaveLength(16);
      const reloadedSeeded = Object.values(reloaded?.tournamentPlayers || {}).filter(tp => tp.seed !== undefined);
      expect(reloadedSeeded).toHaveLength(8);
    });
  });
});
