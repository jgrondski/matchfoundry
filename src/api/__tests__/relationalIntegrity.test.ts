import { describe, it, expect, beforeEach } from 'vitest';
import { setupTestDb } from '../../db/testDb';
import { setDb } from '../../db';
import { matches, games, tournaments, bracketTiers, players, qualifierSubmissions, tournamentPlayers } from '../../db/schema';
import { eq, inArray, and } from 'drizzle-orm';
import {
  createTournament,
  getFullTournament,
  saveFullTournament,
  deleteTournament,
} from '../tournaments';
import { runFullSimulation } from '../../features/tournament/simulation';
import { generateDraftBracketsForTournament, deriveLeaderboard } from '../../features/qualifiers/scoring';
import { createApiMiddleware } from '../../server/api';
import { createSessionToken } from '../../server/pinCrypto';
import type { PlayerProfile } from '../../features/tournament/types';

describe('Relational Matches & Games PostgreSQL Integrity (Regression)', () => {
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
        name: `Competitor_${i}_${Date.now() % 10000}`,
        country: 'US',
        personalBest: 950000 + i * 10000,
        playstyle: 'Rolling',
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

  describe('1. Relational Persistence Across All Bracket Types', () => {
    it('persists relational matches and games for Single Elimination: Traditional', async () => {
      const competitors = await createCompetitors(8);

      const { tournament } = await createTournament({
        name: 'Single Elim Test',
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

      // Verify directly from PostgreSQL schema
      const goldTier = saved.tiers[0];
      const dbMatches = await db
        .select()
        .from(matches)
        .where(eq(matches.tierId, goldTier.id));

      expect(dbMatches.length).toBe(7); // 8-player single elim has exactly 7 matches

      // Verify every match has a real row and valid bestOf
      for (const m of dbMatches) {
        expect(m.id).toBeTruthy();
        expect(m.tierId).toBe(goldTier.id);
        expect(m.bestOf).toBeGreaterThanOrEqual(3);
        expect(m.isComplete).toBe(true);
        expect(m.winnerId).toBeTruthy();
        expect(m.loserId).toBeTruthy();
      }

      // Verify games table has rows linked to matches
      const matchIds = dbMatches.map((m: any) => m.id);
      const dbGames = await db
        .select()
        .from(games)
        .where(inArray(games.matchId, matchIds));

      expect(dbGames.length).toBeGreaterThanOrEqual(14); // At least 2 games per best-of-3 match (7 * 2 = 14)

      for (const g of dbGames) {
        expect(g.id).toBeTruthy();
        expect(matchIds).toContain(g.matchId);
        expect(g.gameNumber).toBeGreaterThanOrEqual(1);
        expect(g.winnerId).toBeTruthy();
        expect(g.player1Score).toBeGreaterThan(0);
        expect(g.player2Score).toBeGreaterThan(0);
      }
    });

    it('persists relational matches and games for Double Elimination: Traditional', async () => {
      const competitors = await createCompetitors(8);

      const { tournament } = await createTournament({
        name: 'Double Elim Traditional Test',
        organizationId: 'org_ctwc',
        qualFormat: 'HIGH_SCORE',
        tiers: [
          {
            name: 'Gold Double',
            bracketType: 'TRADITIONAL',
            numPlayers: 8,
            priorityOrder: 1,
            eliminationType: 'DOUBLE',
            bracketRouting: 'TRADITIONAL',
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

      const tierId = saved.tiers[0].id;
      const dbMatches = await db
        .select()
        .from(matches)
        .where(eq(matches.tierId, tierId));

      // Traditional 8-player double elimination has 14 or 15 matches (winners, losers, finals + reset)
      expect(dbMatches.length).toBeGreaterThanOrEqual(14);

      // Verify stages and round identifiers are stored
      const stages = new Set(dbMatches.map((m: any) => m.stage));
      expect(stages.has('WINNERS')).toBe(true);
      expect(stages.has('LOSERS')).toBe(true);
      expect(stages.has('GRAND_FINALS')).toBe(true);

      const dbGames = await db
        .select()
        .from(games)
        .where(inArray(games.matchId, dbMatches.map((m: any) => m.id)));

      expect(dbGames.length).toBeGreaterThanOrEqual(28); // Each completed match has at least 2 games
    });

    it('persists relational matches and games for Double Elimination: Flat Staged', async () => {
      const competitors = await createCompetitors(16);

      const { tournament } = await createTournament({
        name: 'Flat Staged Double Test',
        organizationId: 'org_ctm',
        qualFormat: 'HIGH_SCORE',
        tiers: [
          {
            name: 'Flat Staged Tier',
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
      expect(full).toBeDefined();
      if (!full) return;

      full.playersPool = competitors;
      full.manualSeeds = competitors.map(c => c.id);
      full.seedingMethod = 'MANUAL';

      const simulated = runFullSimulation(full, competitors);
      const saved = await saveFullTournament(simulated);

      const tierId = saved.tiers[0].id;
      const dbMatches = await db
        .select()
        .from(matches)
        .where(eq(matches.tierId, tierId));

      expect(dbMatches.length).toBeGreaterThan(0);

      const dbGames = await db
        .select()
        .from(games)
        .where(inArray(games.matchId, dbMatches.map((m: any) => m.id)));

      expect(dbGames.length).toBeGreaterThan(0);
    });

    it('persists relational matches and games for Double Elimination: Accelerated Hybrid', async () => {
      const competitors = await createCompetitors(16);

      const { tournament } = await createTournament({
        name: 'Accelerated Hybrid Test',
        organizationId: 'org_ctwc',
        qualFormat: 'HIGH_SCORE',
        tiers: [
          {
            name: 'Accelerated Tier',
            bracketType: 'TRADITIONAL',
            numPlayers: 16,
            priorityOrder: 1,
            eliminationType: 'DOUBLE',
            bracketRouting: 'ACCELERATED_HYBRID',
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

      const tierId = saved.tiers[0].id;
      const dbMatches = await db
        .select()
        .from(matches)
        .where(eq(matches.tierId, tierId));

      expect(dbMatches.length).toBeGreaterThanOrEqual(15);

      const dbGames = await db
        .select()
        .from(games)
        .where(inArray(games.matchId, dbMatches.map((m: any) => m.id)));

      expect(dbGames.length).toBeGreaterThan(0);
    });
  });

  describe('2. Relational Cascade Deletion', () => {
    it('leaves zero orphaned rows in matches and games tables when tournament is deleted', async () => {
      const competitors = await createCompetitors(8);

      const { tournament } = await createTournament({
        name: 'To Delete Tournament',
        organizationId: 'org_ctwc',
        qualFormat: 'HIGH_SCORE',
        tiers: [
          {
            name: 'Gold',
            bracketType: 'TRADITIONAL',
            numPlayers: 8,
            priorityOrder: 1,
          },
        ],
      });

      const full = await getFullTournament(tournament.id);
      if (!full) throw new Error('Not found');

      full.playersPool = competitors;
      full.manualSeeds = competitors.map(c => c.id);
      full.seedingMethod = 'MANUAL';

      const simulated = runFullSimulation(full, competitors);
      const saved = await saveFullTournament(simulated);

      const tierId = saved.tiers[0].id;
      const preMatches = await db.select().from(matches).where(eq(matches.tierId, tierId));
      expect(preMatches.length).toBeGreaterThan(0);
      const matchIds = preMatches.map((m: any) => m.id);
      const preGames = await db.select().from(games).where(inArray(games.matchId, matchIds));
      expect(preGames.length).toBeGreaterThan(0);

      // Now perform deletion of the tournament
      await deleteTournament(saved.id);

      // Verify cascading removal in DB
      const postMatches = await db.select().from(matches).where(eq(matches.tierId, tierId));
      expect(postMatches.length).toBe(0);

      const postGames = await db.select().from(games).where(inArray(games.matchId, matchIds));
      expect(postGames.length).toBe(0);

      const postTiers = await db.select().from(bracketTiers).where(eq(bracketTiers.tournamentId, saved.id));
      expect(postTiers.length).toBe(0);
    });
  });

  describe('3. Relational Rehydration from PostgreSQL', () => {
    it('reconstructs match scores and series outcomes accurately when re-fetched from database', async () => {
      const competitors = await createCompetitors(8);

      const { tournament } = await createTournament({
        name: 'Rehydration Test',
        organizationId: 'org_ctwc',
        qualFormat: 'HIGH_SCORE',
        tiers: [
          {
            name: 'Gold',
            bracketType: 'TRADITIONAL',
            numPlayers: 8,
            priorityOrder: 1,
          },
        ],
      });

      const full = await getFullTournament(tournament.id);
      if (!full) throw new Error('Not found');

      full.playersPool = competitors;
      full.manualSeeds = competitors.map(c => c.id);
      full.seedingMethod = 'MANUAL';

      const simulated = runFullSimulation(full, competitors);
      await saveFullTournament(simulated);

      // Fetch fresh from PostgreSQL via getFullTournament
      const rehydrated = await getFullTournament(tournament.id);
      expect(rehydrated).toBeDefined();
      if (!rehydrated) return;

      expect(Object.keys(rehydrated.matchScores).length).toBe(7);

      for (const [, score] of Object.entries(rehydrated.matchScores)) {
        expect(score.isComplete).toBe(true);
        expect(score.winnerPlayerId).toBeTruthy();
        expect(score.player1Wins + score.player2Wins).toBeGreaterThanOrEqual(2);
        expect(score.games.length).toBeGreaterThanOrEqual(2);
      }
    });
  });

  describe('4. Live Match Scoring & Forfeit Updates via Server API', () => {
    it('records series games directly in PostgreSQL games table and updates matches table', async () => {
      const competitors = await createCompetitors(8);

      const { tournament } = await createTournament({
        name: 'Live Match Scoring Test',
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
      if (!full) throw new Error('Not found');

      full.playersPool = competitors;
      full.manualSeeds = competitors.map(c => c.id);
      full.seedingMethod = 'MANUAL';
      full.tiers = generateDraftBracketsForTournament(full);
      full.isLocked = true;
      full.tiers[0].isLocked = true;

      const saved = await saveFullTournament(full);
      const tier = saved.tiers[0];
      const firstMatch = tier.bracket?.rounds?.[0]?.matches?.[0];
      expect(firstMatch).toBeDefined();
      if (!firstMatch) return;

      const p1Id = firstMatch.player1.player!.id;
      const p2Id = firstMatch.player2.player!.id;

      // Send game 1 score update via PUT /api/tournaments/:id/matches/:matchId/score
      const gameScorePayload = {
        tierId: tier.id,
        games: [
          {
            gameNumber: 1,
            player1Points: 850000,
            player2Points: 720000,
            winnerPlayerId: p1Id,
          },
        ],
      };

      const res = await makeHttpRequest(
        `/api/tournaments/${saved.id}/matches/${firstMatch.id}/score`,
        'PUT',
        gameScorePayload
      );

      expect(res.status).toBe(200);

      // Verify row in games table
      const matchGames = await db
        .select()
        .from(games)
        .where(eq(games.matchId, firstMatch.id));

      expect(matchGames.length).toBe(1);
      expect(matchGames[0].player1Score).toBe(850000);
      expect(matchGames[0].player2Score).toBe(720000);
      expect(matchGames[0].winnerId).toBe(p1Id);

      // Verify match state in matches table
      const [updatedMatch] = await db
        .select()
        .from(matches)
        .where(eq(matches.id, firstMatch.id));

      expect(updatedMatch.isComplete).toBe(false);
      expect(updatedMatch.winnerId).toBeNull();

      // Now send Game 2 win for p1 (completing best of 3)
      const completeSeriesPayload = {
        tierId: tier.id,
        games: [
          {
            gameNumber: 1,
            player1Points: 850000,
            player2Points: 720000,
            winnerPlayerId: p1Id,
          },
          {
            gameNumber: 2,
            player1Points: 920000,
            player2Points: 800000,
            winnerPlayerId: p1Id,
          },
        ],
      };

      const res2 = await makeHttpRequest(
        `/api/tournaments/${saved.id}/matches/${firstMatch.id}/score`,
        'PUT',
        completeSeriesPayload
      );

      expect(res2.status).toBe(200);

      const [completedMatch] = await db
        .select()
        .from(matches)
        .where(eq(matches.id, firstMatch.id));

      expect(completedMatch.isComplete).toBe(true);
      expect(completedMatch.winnerId).toBe(p1Id);
      expect(completedMatch.loserId).toBe(p2Id);
    });

    it('records forfeit wins directly in PostgreSQL matches table and advances winner', async () => {
      const competitors = await createCompetitors(8);

      const { tournament } = await createTournament({
        name: 'Forfeit Match Test',
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
      if (!full) throw new Error('Not found');

      full.playersPool = competitors;
      full.manualSeeds = competitors.map(c => c.id);
      full.seedingMethod = 'MANUAL';
      full.tiers = generateDraftBracketsForTournament(full);
      full.isLocked = true;
      full.tiers[0].isLocked = true;

      const saved = await saveFullTournament(full);
      const tier = saved.tiers[0];
      const matchToForfeit = tier.bracket?.rounds?.[0]?.matches?.[1];
      expect(matchToForfeit).toBeDefined();
      if (!matchToForfeit) return;

      const forfeitWinner = matchToForfeit.player2.player!.id;

      const res = await makeHttpRequest(
        `/api/tournaments/${saved.id}/matches/${matchToForfeit.id}/forfeit`,
        'POST',
        {
          tierId: tier.id,
          winnerPlayerId: forfeitWinner,
        }
      );

      expect(res.status).toBe(200);

      const [dbMatch] = await db
        .select()
        .from(matches)
        .where(eq(matches.id, matchToForfeit.id));

      expect(dbMatch.isForfeit).toBe(true);
      expect(dbMatch.isComplete).toBe(true);
      expect(dbMatch.winnerId).toBe(forfeitWinner);
    });
  });

  describe('5. Zero-Optimism Failure Handling & Database Protection', () => {
    it('rejects unlocking tournament if match scores exist and keeps database locked', async () => {
      const competitors = await createCompetitors(8);

      const { tournament } = await createTournament({
        name: 'Unlock Protection Test',
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
      if (!full) throw new Error('Not found');

      full.playersPool = competitors;
      full.manualSeeds = competitors.map(c => c.id);
      full.seedingMethod = 'MANUAL';

      const simulated = runFullSimulation(full, competitors);
      const saved = await saveFullTournament(simulated);

      // Attempt to unlock when match scores are present
      const res = await makeHttpRequest(`/api/tournaments/${saved.id}/unlock`, 'POST');

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Cannot unlock');

      // Verify DB remains locked
      const [dbTourney] = await db
        .select()
        .from(tournaments)
        .where(eq(tournaments.id, saved.id));

      expect(dbTourney.qualsClosed).toBe(true);
    });

    it('returns 404 when submitting score for non-existent match and leaves DB untouched', async () => {
      const { tournament } = await createTournament({
        name: 'Error Handling Test',
        organizationId: 'org_ctwc',
        qualFormat: 'HIGH_SCORE',
        tiers: [
          {
            name: 'Gold',
            bracketType: 'TRADITIONAL',
            numPlayers: 8,
            priorityOrder: 1,
          },
        ],
      });

      const res = await makeHttpRequest(
        `/api/tournaments/${tournament.id}/matches/non-existent-match-id/score`,
        'PUT',
        {
          tierId: 'invalid-tier',
          games: [],
        }
      );

      expect(res.status).toBe(404);
      expect(res.body.error).toContain('not found');
    });
  });

  describe('6. Comprehensive Clearance Regression Across All Bracket Types (Zero Optimism)', () => {
    it('clears all matches, games, qualifiers, and players via POST /clear-all by UUID (Single Elimination: Traditional)', async () => {
      const competitors = await createCompetitors(8);

      const { tournament } = await createTournament({
        name: 'Clear All UUID Test',
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
      if (!full) throw new Error('Not found');

      full.playersPool = competitors;
      full.manualSeeds = competitors.map(c => c.id);
      full.seedingMethod = 'MANUAL';

      const simulated = runFullSimulation(full, competitors);
      const saved = await saveFullTournament(simulated);
      const tierId = saved.tiers[0].id;

      // Verify before clearance: relational tables have rows
      const preMatches = await db.select().from(matches).where(eq(matches.tierId, tierId));
      expect(preMatches.length).toBe(7);
      const preGames = await db.select().from(games).where(inArray(games.matchId, preMatches.map((m: any) => m.id)));
      expect(preGames.length).toBeGreaterThanOrEqual(14);
      const prePlayers = await db.select().from(tournamentPlayers).where(eq(tournamentPlayers.tournamentId, saved.id));
      expect(prePlayers.length).toBe(8);

      // Invoke clear-all via API with tournament UUID
      const res = await makeHttpRequest(`/api/tournaments/${saved.id}/clear-all`, 'POST');
      expect(res.status).toBe(200);

      // CRITICAL VERIFICATION: Zero optimistic assumptions - Database MUST have 0 matches and 0 games
      const postMatches = await db.select().from(matches).where(eq(matches.tierId, tierId));
      expect(postMatches.length).toBe(0);

      const postGames = await db.select().from(games).where(inArray(games.matchId, preMatches.map((m: any) => m.id)));
      expect(postGames.length).toBe(0);

      const postPlayers = await db.select().from(tournamentPlayers).where(eq(tournamentPlayers.tournamentId, saved.id));
      expect(postPlayers.length).toBe(0);

      const postSubs = await db.select().from(qualifierSubmissions).where(eq(qualifierSubmissions.tournamentId, saved.id));
      expect(postSubs.length).toBe(0);

      // Verify tournament flags
      const [dbTourney] = await db.select().from(tournaments).where(eq(tournaments.id, saved.id));
      expect(dbTourney.qualsClosed).toBe(false);

      // Verify returned payload
      expect(res.body.isLocked).toBe(false);
      expect(res.body.playersPool.length).toBe(0);
      expect(res.body.tiers[0].bracket.matchesById).toEqual({});
    });

    it('clears all matches, games, qualifiers, and players via POST /clear-all by SLUG across Double Elimination variants (Traditional, Flat Staged, Accelerated Hybrid)', async () => {
      const variants = [
        {
          name: 'Double Trad Slug Tourney',
          slug: 'clear-double-trad-slug',
          bracketType: 'TRADITIONAL',
          eliminationType: 'DOUBLE',
          bracketRouting: 'TRADITIONAL',
          playerCount: 8,
        },
        {
          name: 'Flat Staged Slug Tourney',
          slug: 'clear-flat-staged-slug',
          bracketType: 'FLAT',
          eliminationType: 'DOUBLE',
          bracketRouting: 'FLAT_STAGED',
          flatWidth: 4,
          playerCount: 16,
        },
        {
          name: 'Accelerated Hybrid Slug Tourney',
          slug: 'clear-accel-hybrid-slug',
          bracketType: 'TRADITIONAL',
          eliminationType: 'DOUBLE',
          bracketRouting: 'ACCELERATED_HYBRID',
          playerCount: 16,
        },
      ];

      for (const variant of variants) {
        const competitors = await createCompetitors(variant.playerCount);

        const { tournament } = await createTournament({
          name: variant.name,
          slug: variant.slug,
          organizationId: 'org_ctwc',
          qualFormat: 'HIGH_SCORE',
          tiers: [
            {
              name: 'Main Tier',
              bracketType: variant.bracketType as any,
              numPlayers: variant.playerCount,
              priorityOrder: 1,
              eliminationType: variant.eliminationType as any,
              bracketRouting: variant.bracketRouting as any,
              flatWidth: variant.flatWidth,
            },
          ],
        });

        const full = await getFullTournament(tournament.id);
        if (!full) throw new Error('Not found');

        full.playersPool = competitors;
        full.manualSeeds = competitors.map(c => c.id);
        full.seedingMethod = 'MANUAL';

        const simulated = runFullSimulation(full, competitors);
        const saved = await saveFullTournament(simulated);
        const tierId = saved.tiers[0].id;

        // Verify matches and games existed prior to clearance
        const preMatches = await db.select().from(matches).where(eq(matches.tierId, tierId));
        expect(preMatches.length).toBeGreaterThan(0);
        const preGames = await db.select().from(games).where(inArray(games.matchId, preMatches.map((m: any) => m.id)));
        expect(preGames.length).toBeGreaterThan(0);

        // CLEAR VIA SLUG URL
        const res = await makeHttpRequest(`/api/tournaments/${variant.slug}/clear-all`, 'POST');
        expect(res.status).toBe(200);

        // Verify PostgreSQL tables: matches, games, tournament_players, qualifier_submissions MUST ALL BE 0
        const postMatches = await db.select().from(matches).where(eq(matches.tierId, tierId));
        expect(postMatches.length).toBe(0);

        const postGames = await db.select().from(games).where(inArray(games.matchId, preMatches.map((m: any) => m.id)));
        expect(postGames.length).toBe(0);

        const postPlayers = await db.select().from(tournamentPlayers).where(eq(tournamentPlayers.tournamentId, saved.id));
        expect(postPlayers.length).toBe(0);

        const postSubs = await db.select().from(qualifierSubmissions).where(eq(qualifierSubmissions.tournamentId, saved.id));
        expect(postSubs.length).toBe(0);
      }
    });

    it('clears multi-tier tournament completely across tier-switching and filter interactions', async () => {
      const competitors = await createCompetitors(24);

      const { tournament } = await createTournament({
        name: 'Multi Tier Clearance Test',
        slug: 'multi-tier-clear-slug',
        organizationId: 'org_ctwc',
        qualFormat: 'HIGH_SCORE',
        tiers: [
          {
            name: 'Gold Championship',
            slug: 'gold',
            bracketType: 'TRADITIONAL',
            numPlayers: 16,
            priorityOrder: 1,
            eliminationType: 'SINGLE',
          },
          {
            name: 'Silver Bracket',
            slug: 'silver',
            bracketType: 'FLAT',
            numPlayers: 8,
            priorityOrder: 2,
            eliminationType: 'SINGLE',
            flatWidth: 4,
          },
        ],
      });

      const full = await getFullTournament(tournament.id);
      if (!full) throw new Error('Not found');

      full.playersPool = competitors;
      full.manualSeeds = competitors.map(c => c.id);
      full.seedingMethod = 'MANUAL';

      const simulated = runFullSimulation(full, competitors);
      const saved = await saveFullTournament(simulated);

      const goldTierId = saved.tiers[0].id;
      const silverTierId = saved.tiers[1].id;

      // Verify both tiers have matches and games in PostgreSQL
      const preGoldMatches = await db.select().from(matches).where(eq(matches.tierId, goldTierId));
      expect(preGoldMatches.length).toBe(15);
      const preSilverMatches = await db.select().from(matches).where(eq(matches.tierId, silverTierId));
      expect(preSilverMatches.length).toBe(7);

      // Invoke clear-all via slug
      const res = await makeHttpRequest('/api/tournaments/multi-tier-clear-slug/clear-all', 'POST');
      expect(res.status).toBe(200);

      // Verify PostgreSQL has 0 matches for Gold and 0 matches for Silver
      const postGoldMatches = await db.select().from(matches).where(eq(matches.tierId, goldTierId));
      expect(postGoldMatches.length).toBe(0);

      const postSilverMatches = await db.select().from(matches).where(eq(matches.tierId, silverTierId));
      expect(postSilverMatches.length).toBe(0);

      const allMatches = await db.select().from(matches).where(inArray(matches.tierId, [goldTierId, silverTierId]));
      expect(allMatches.length).toBe(0);

      const allGames = await db.select().from(games);
      expect(allGames.length).toBe(0);
    });

    it('clears recorded match scores via DELETE /matches (by SLUG and UUID) and resets tournament to unplayed draft', async () => {
      const competitors = await createCompetitors(8);

      const { tournament } = await createTournament({
        name: 'Clear Matches Only Test',
        slug: 'clear-matches-slug',
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
      if (!full) throw new Error('Not found');

      full.playersPool = competitors;
      full.manualSeeds = competitors.map(c => c.id);
      full.seedingMethod = 'MANUAL';

      const simulated = runFullSimulation(full, competitors);
      const saved = await saveFullTournament(simulated);
      const tierId = saved.tiers[0].id;

      const preGames = await db.select().from(games);
      expect(preGames.length).toBeGreaterThanOrEqual(14);

      // Delete matches via slug URL
      const res = await makeHttpRequest('/api/tournaments/clear-matches-slug/matches', 'DELETE');
      expect(res.status).toBe(200);

      // Games must be 0
      const postGames = await db.select().from(games);
      expect(postGames.length).toBe(0);

      // Matches in DB must be 0 (unlocked draft mode does not retain played match rows)
      const postMatches = await db.select().from(matches).where(eq(matches.tierId, tierId));
      expect(postMatches.length).toBe(0);

      // Returned tournament has empty matchScores and is unlocked
      expect(res.body.isLocked).toBe(false);
      expect(Object.keys(res.body.matchScores || {}).length).toBe(0);

      // Players and seeds are retained for re-play
      expect(res.body.playersPool.length).toBe(8);
      expect(res.body.manualSeeds.length).toBe(8);
    });

    it('allows seamless re-seeding and re-simulation after clear-all with zero orphaned records', async () => {
      const competitors = await createCompetitors(8);

      const { tournament } = await createTournament({
        name: 'Re-Simulation Cycle Test',
        slug: 'resim-cycle-slug',
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
      if (!full) throw new Error('Not found');

      full.playersPool = competitors;
      full.manualSeeds = competitors.map(c => c.id);
      full.seedingMethod = 'MANUAL';

      // 1. Initial simulation
      const sim1 = runFullSimulation(full, competitors);
      const saved1 = await saveFullTournament(sim1);
      const tierId = saved1.tiers[0].id;
      expect((await db.select().from(matches).where(eq(matches.tierId, tierId))).length).toBe(7);

      // 2. Clear all
      await makeHttpRequest('/api/tournaments/resim-cycle-slug/clear-all', 'POST');
      expect((await db.select().from(matches).where(eq(matches.tierId, tierId))).length).toBe(0);

      // 3. Re-seed new competitors and re-simulate
      const newCompetitors = await createCompetitors(8);
      const freshFull = await getFullTournament('resim-cycle-slug');
      if (!freshFull) throw new Error('Not found');

      freshFull.playersPool = newCompetitors;
      freshFull.manualSeeds = newCompetitors.map(c => c.id);
      freshFull.seedingMethod = 'MANUAL';

      const sim2 = runFullSimulation(freshFull, newCompetitors);
      const saved2 = await saveFullTournament(sim2);
      expect(saved2.id).toBe(saved1.id);

      // 4. Verify clean relational state after re-simulation
      const reMatches = await db.select().from(matches).where(eq(matches.tierId, tierId));
      expect(reMatches.length).toBe(7);
      for (const m of reMatches) {
        expect(m.isComplete).toBe(true);
      }
    });
  });

  describe('7. Online Qualifier Submission & Non-Destructive Update Regression', () => {
    it('preserves online qualifier registration and scores in PostgreSQL when admin saves settings or toggles timer via saveFullTournament / PUT', async () => {
      // 1. Create a tournament
      const [comp1] = await createCompetitors(1);
      const created = await createTournament({
        name: 'Omen DAS Test Tourney',
        slug: 'omen-das-test',
        qualMode: 'HYBRID',
        qualFormat: 'AVERAGE_OF_X',
        qualAverageCount: 2,
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
      const tournament = created.tournament;

      // 2. An online competitor "Omenvoir" registers and submits scores
      const [omenvoir] = await createCompetitors(1);
      const submitRes = await makeHttpRequest(`/api/tournaments/${tournament.id}/qualify/submit`, 'POST', {
        playerId: omenvoir.id,
        scores: [950000, 920000],
        twitchVodUrl: 'https://twitch.tv/videos/12345678',
        submittedTwitchUsername: 'Omenvoir',
      });
      expect(submitRes.status).toBe(200);

      // Verify that Omenvoir is now recorded in tournament_players and qualifier_submissions
      const tPlayersAfterSubmit = await db
        .select()
        .from(tournamentPlayers)
        .where(eq(tournamentPlayers.tournamentId, tournament.id));
      expect(tPlayersAfterSubmit.some((tp: any) => tp.playerId === omenvoir.id)).toBe(true);

      const subsAfterSubmit = await db
        .select()
        .from(qualifierSubmissions)
        .where(eq(qualifierSubmissions.tournamentId, tournament.id));
      expect(subsAfterSubmit.length).toBe(2);
      expect(subsAfterSubmit.every((s: any) => s.playerId === omenvoir.id)).toBe(true);

      // 3. Simulate an admin who loaded the page earlier (before Omenvoir registered)
      // and now saves tournament settings or toggles the qual timer via PUT /api/tournaments/:id
      // The admin's payload has an empty or pre-existing playersPool, and empty qualifierSubmissions!
      const updateRes = await makeHttpRequest(`/api/tournaments/${tournament.id}`, 'PUT', {
        name: 'Omen DAS Test Tourney Updated',
        slug: 'omen-das-test',
        qualMode: 'HYBRID',
        qualTimer: {
          durationMinutes: 90,
          isRunning: false,
          elapsedSeconds: 120,
          lastResumedAt: null,
        },
        playersPool: [comp1], // Notice omenvoir is NOT in the admin's playersPool!
        qualifierSubmissions: [], // Notice omenvoir's scores are NOT in the admin's submissions payload!
      });
      expect(updateRes.status).toBe(200);

      // 4. VERIFY: Omenvoir MUST STILL BE in tournament_players and qualifier_submissions in PostgreSQL!
      const tPlayersAfterPut = await db
        .select()
        .from(tournamentPlayers)
        .where(eq(tournamentPlayers.tournamentId, tournament.id));
      expect(tPlayersAfterPut.some((tp: any) => tp.playerId === omenvoir.id)).toBe(true);

      const subsAfterPut = await db
        .select()
        .from(qualifierSubmissions)
        .where(eq(qualifierSubmissions.tournamentId, tournament.id));
      expect(subsAfterPut.length).toBe(2);
      expect(subsAfterPut.every((s: any) => s.playerId === omenvoir.id)).toBe(true);

      // 5. Verify getFullTournament returns Omenvoir in playersPool, qualifierSubmissions, and leaderboard
      const reloaded = await getFullTournament(tournament.id);
      expect(reloaded).not.toBeNull();
      expect(reloaded?.playersPool?.some(p => p.id === omenvoir.id)).toBe(true);
      expect(reloaded?.qualifierSubmissions?.length).toBe(2);

      const leaderboard = deriveLeaderboard(reloaded!);
      const omenRow = leaderboard.find(r => r.player.id === omenvoir.id);
      expect(omenRow).toBeDefined();
      expect(omenRow?.finalScore).toBe(935000); // (950000 + 920000) / 2
    });

    it('permanently deletes an individual qualifier submission via DELETE /api/tournaments/:id/qualifiers/:subId', async () => {
      const created = await createTournament({
        name: 'Delete Qual Test',
        slug: 'delete-qual-test',
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
      const tourney = created.tournament;

      const [comp] = await createCompetitors(1);
      const submitRes = await makeHttpRequest(`/api/tournaments/${tourney.id}/qualify/submit`, 'POST', {
        playerId: comp.id,
        scores: [888000],
        twitchVodUrl: 'https://twitch.tv/videos/12345678',
        submittedTwitchUsername: 'DeleteRunner',
      });
      expect(submitRes.status).toBe(200);

      const subsBefore = await db
        .select()
        .from(qualifierSubmissions)
        .where(eq(qualifierSubmissions.tournamentId, tourney.id));
      expect(subsBefore.length).toBe(1);
      const subIdToDelete = subsBefore[0].id;

      // Delete the individual submission
      const delRes = await makeHttpRequest(`/api/tournaments/${tourney.id}/qualifiers/${subIdToDelete}`, 'DELETE');
      expect(delRes.status).toBe(200);

      // Verify row is permanently deleted from PostgreSQL
      const subsAfter = await db
        .select()
        .from(qualifierSubmissions)
        .where(eq(qualifierSubmissions.id, subIdToDelete));
      expect(subsAfter.length).toBe(0);

      // Verify reloaded tournament reflects deletion
      const fresh = await getFullTournament(tourney.id);
      expect(fresh?.qualifierSubmissions?.length).toBe(0);
    });

    it('blocks removing competitor with qualifier submissions via DELETE /api/tournaments/:id/players/:playerId until scores are cleared', async () => {
      const created = await createTournament({
        name: 'Delete Player Test',
        slug: 'delete-player-test',
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
      const tourney = created.tournament;

      const [comp] = await createCompetitors(1);
      await makeHttpRequest(`/api/tournaments/${tourney.id}/qualify/submit`, 'POST', {
        playerId: comp.id,
        scores: [777000],
        twitchVodUrl: 'https://twitch.tv/videos/12345678',
        submittedTwitchUsername: 'RemoveMe',
      });

      // Verify player and submission exist
      expect((await db.select().from(tournamentPlayers).where(eq(tournamentPlayers.tournamentId, tourney.id))).length).toBe(1);
      const subs = await db.select().from(qualifierSubmissions).where(eq(qualifierSubmissions.tournamentId, tourney.id));
      expect(subs.length).toBe(1);

      // Attempting to remove competitor while qualifier submission exists must be blocked with HTTP 400 (Stage 3 blocks Stage 2)
      const blockedRes = await makeHttpRequest(`/api/tournaments/${tourney.id}/players/${comp.id}`, 'DELETE');
      expect(blockedRes.status).toBe(400);
      expect(blockedRes.body.error).toMatch(/qualifier score/i);

      // Delete the qualifier submission first
      const delQualRes = await makeHttpRequest(`/api/tournaments/${tourney.id}/qualifiers/${subs[0].id}`, 'DELETE');
      expect(delQualRes.status).toBe(200);

      // Now removing competitor succeeds
      const delRes = await makeHttpRequest(`/api/tournaments/${tourney.id}/players/${comp.id}`, 'DELETE');
      expect(delRes.status).toBe(200);

      // Verify competitor is deleted from tournament_players and qualifier_submissions
      const tPlayersAfter = await db
        .select()
        .from(tournamentPlayers)
        .where(and(eq(tournamentPlayers.tournamentId, tourney.id), eq(tournamentPlayers.playerId, comp.id)));
      expect(tPlayersAfter.length).toBe(0);

      const subsAfter = await db
        .select()
        .from(qualifierSubmissions)
        .where(and(eq(qualifierSubmissions.tournamentId, tourney.id), eq(qualifierSubmissions.playerId, comp.id)));
      expect(subsAfter.length).toBe(0);

      // Verify getFullTournament reflects removal
      const fresh = await getFullTournament(tourney.id);
      expect(fresh?.playersPool?.some(p => p.id === comp.id)).toBe(false);
    });

    it('prevents stale IN_PROGRESS payload in PUT from downgrading a SUBMITTED online qualifier in PostgreSQL', async () => {
      const created = await createTournament({
        name: 'Stale Downgrade Test',
        slug: 'stale-downgrade-test',
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
      const tourney = created.tournament;

      const [comp] = await createCompetitors(1);
      await makeHttpRequest(`/api/tournaments/${tourney.id}/qualify/submit`, 'POST', {
        playerId: comp.id,
        scores: [990000],
        twitchVodUrl: 'https://twitch.tv/videos/12345678',
        submittedTwitchUsername: 'ProRunner',
      });

      const [dbSub] = await db
        .select()
        .from(qualifierSubmissions)
        .where(eq(qualifierSubmissions.tournamentId, tourney.id));
      expect(dbSub.status).toBe('SUBMITTED');
      expect(dbSub.score).toBe(990000);

      // Admin sends stale PUT with the submission row as IN_PROGRESS and score 0
      const putRes = await makeHttpRequest(`/api/tournaments/${tourney.id}`, 'PUT', {
        name: 'Stale Downgrade Test Renamed',
        slug: 'stale-downgrade-test',
        qualifierSubmissions: [
          {
            id: dbSub.id,
            tournamentId: tourney.id,
            playerId: comp.id,
            score: 0,
            status: 'IN_PROGRESS',
            submissionSource: 'ONLINE',
          },
        ],
      });
      expect(putRes.status).toBe(200);

      // Verify DB row was NOT downgraded back to IN_PROGRESS or 0
      const [reloadedDbSub] = await db
        .select()
        .from(qualifierSubmissions)
        .where(eq(qualifierSubmissions.id, dbSub.id));
      expect(reloadedDbSub.status).toBe('SUBMITTED');
      expect(reloadedDbSub.score).toBe(990000);
    });

    it('does not resurrect replaced IN_PROGRESS placeholder row when stale admin sends old submissions', async () => {
      const created = await createTournament({
        name: 'Resurrection Protection Test',
        slug: 'resurrection-test',
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
      const tourney = created.tournament;
      const [comp] = await createCompetitors(1);

      // 1. Competitor starts run -> creates placeholder IN_PROGRESS row
      const startRes = await makeHttpRequest(`/api/tournaments/${tourney.id}/qualify/start`, 'POST', {
        playerId: comp.id,
        playerName: comp.name,
        twitchUsername: 'SpeedyRunner',
      });
      expect(startRes.status).toBe(200);
      const startData = startRes.body;
      const placeholderId = startData.submissionIds?.[0];
      expect(placeholderId).toBeDefined();

      // Verify placeholder exists in DB
      const subsDuringRun = await db
        .select()
        .from(qualifierSubmissions)
        .where(eq(qualifierSubmissions.tournamentId, tourney.id));
      expect(subsDuringRun.length).toBe(1);
      expect(subsDuringRun[0].id).toBe(placeholderId);
      expect(subsDuringRun[0].status).toBe('IN_PROGRESS');

      // 2. Competitor submits official scores -> placeholder is deleted and replaced by SUBMITTED row(s)
      const submitRes = await makeHttpRequest(`/api/tournaments/${tourney.id}/qualify/submit`, 'POST', {
        playerId: comp.id,
        scores: [975000],
        twitchVodUrl: 'https://twitch.tv/videos/9999999',
        submittedTwitchUsername: 'SpeedyRunner',
      });
      expect(submitRes.status).toBe(200);

      // In DB, placeholderId is now deleted, and a new row with score 975000 exists
      const subsAfterSubmit = await db
        .select()
        .from(qualifierSubmissions)
        .where(eq(qualifierSubmissions.tournamentId, tourney.id));
      expect(subsAfterSubmit.length).toBe(1);
      expect(subsAfterSubmit[0].id).not.toBe(placeholderId);
      expect(subsAfterSubmit[0].score).toBe(975000);

      // 3. Stale admin tab (which captured placeholderId before submit) sends PUT /api/tournaments/:id
      const putRes = await makeHttpRequest(`/api/tournaments/${tourney.id}`, 'PUT', {
        name: 'Resurrection Protection Test Renamed',
        slug: 'resurrection-test',
        qualifierSubmissions: [
          {
            id: placeholderId,
            tournamentId: tourney.id,
            playerId: comp.id,
            score: 0,
            status: 'IN_PROGRESS',
            submissionSource: 'ONLINE',
          },
        ],
      });
      expect(putRes.status).toBe(200);

      // 4. VERIFY: The deleted placeholder was NOT resurrected! DB should strictly still have 1 submission
      const subsAfterStalePut = await db
        .select()
        .from(qualifierSubmissions)
        .where(eq(qualifierSubmissions.tournamentId, tourney.id));
      expect(subsAfterStalePut.length).toBe(1);
      expect(subsAfterStalePut[0].status).toBe('SUBMITTED');
      expect(subsAfterStalePut[0].score).toBe(975000);
    });

    it('prevents stale SUBMITTED snapshot in PUT from downgrading a judge-adjudicated VERIFIED run and preserves qualsCompleted', async () => {
      const created = await createTournament({
        name: 'Judge Adjudication Guard Test',
        slug: 'judge-guard-test',
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
      const tourney = created.tournament;
      const [comp] = await createCompetitors(1);

      // 1. Submit online score
      await makeHttpRequest(`/api/tournaments/${tourney.id}/qualify/submit`, 'POST', {
        playerId: comp.id,
        scores: [890000],
        twitchVodUrl: 'https://twitch.tv/videos/1111111',
        submittedTwitchUsername: 'VerifiedTarget',
      });

      // 2. Judge verifies run via POST /qualify/adjudicate
      const adjRes = await makeHttpRequest(`/api/tournaments/${tourney.id}/qualify/adjudicate`, 'POST', {
        playerId: comp.id,
        action: 'VERIFY',
        verifiedBy: 'SeniorJudge',
      });
      expect(adjRes.status).toBe(200);

      // Verify in DB that submission is VERIFIED and tournamentPlayers.qualsCompleted is true
      const [dbSub] = await db
        .select()
        .from(qualifierSubmissions)
        .where(eq(qualifierSubmissions.tournamentId, tourney.id));
      expect(dbSub.status).toBe('VERIFIED');
      expect(dbSub.verifiedBy).toBe('SeniorJudge');

      const [dbTp] = await db
        .select()
        .from(tournamentPlayers)
        .where(eq(tournamentPlayers.tournamentId, tourney.id));
      expect(dbTp.qualsCompleted).toBe(true);

      // 3. Stale admin tab sends PUT with pre-adjudication snapshot (status SUBMITTED, no verifiedAt/verifiedBy, qualsCompleted false)
      const putRes = await makeHttpRequest(`/api/tournaments/${tourney.id}`, 'PUT', {
        name: 'Judge Adjudication Guard Test Renamed',
        slug: 'judge-guard-test',
        tournamentPlayers: {
          [comp.id]: {
            playerId: comp.id,
            tournamentId: tourney.id,
            qualsCompleted: false,
          },
        },
        qualifierSubmissions: [
          {
            id: dbSub.id,
            tournamentId: tourney.id,
            playerId: comp.id,
            score: 890000,
            status: 'SUBMITTED',
            submissionSource: 'ONLINE',
          },
        ],
      });
      expect(putRes.status).toBe(200);

      // 4. VERIFY: Status remains VERIFIED and qualsCompleted remains true
      const [reloadedSub] = await db
        .select()
        .from(qualifierSubmissions)
        .where(eq(qualifierSubmissions.id, dbSub.id));
      expect(reloadedSub.status).toBe('VERIFIED');
      expect(reloadedSub.verifiedBy).toBe('SeniorJudge');

      const [reloadedTp] = await db
        .select()
        .from(tournamentPlayers)
        .where(eq(tournamentPlayers.tournamentId, tourney.id));
      expect(reloadedTp.qualsCompleted).toBe(true);
    });

    it('enforces tournament tenant isolation when deleting an individual qualifier submission', async () => {
      // Create Tournament A
      const tourneyA = (await createTournament({
        name: 'Tourney A Isolation',
        slug: 'tourney-a-iso',
        qualFormat: 'HIGH_SCORE',
        tiers: [{ name: 'T1', bracketType: 'TRADITIONAL', numPlayers: 4, priorityOrder: 1, eliminationType: 'SINGLE' }],
      })).tournament;

      // Create Tournament B
      const tourneyB = (await createTournament({
        name: 'Tourney B Isolation',
        slug: 'tourney-b-iso',
        qualFormat: 'HIGH_SCORE',
        tiers: [{ name: 'T1', bracketType: 'TRADITIONAL', numPlayers: 4, priorityOrder: 1, eliminationType: 'SINGLE' }],
      })).tournament;

      const [comp] = await createCompetitors(1);

      // Submit score to Tournament A
      await makeHttpRequest(`/api/tournaments/${tourneyA.id}/qualify/submit`, 'POST', {
        playerId: comp.id,
        scores: [650000],
        twitchVodUrl: 'https://twitch.tv/videos/iso-test',
        submittedTwitchUsername: 'IsoPlayer',
      });

      const [subA] = await db
        .select()
        .from(qualifierSubmissions)
        .where(eq(qualifierSubmissions.tournamentId, tourneyA.id));
      expect(subA).toBeDefined();

      // Attempt to delete subA by targeting Tournament B's endpoint: DELETE /api/tournaments/:tourneyB.id/qualifiers/:subA.id
      const crossDelRes = await makeHttpRequest(`/api/tournaments/${tourneyB.id}/qualifiers/${subA.id}`, 'DELETE');
      expect(crossDelRes.status).toBe(200);

      // VERIFY: subA still exists in Tournament A because the deletion was scoped to Tourney B!
      const [subAAfter] = await db
        .select()
        .from(qualifierSubmissions)
        .where(eq(qualifierSubmissions.id, subA.id));
      expect(subAAfter).toBeDefined();
      expect(subAAfter.id).toBe(subA.id);
    });
  });
});

