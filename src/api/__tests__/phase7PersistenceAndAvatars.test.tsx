import { describe, it, expect, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  createPlayer,
  listPlayers,
  getPlayerCareerStats,
} from '../players';
import {
  createTournament,
  getTournament,
  deleteTournament,
} from '../tournaments';
import { submitQualifierScore, getQualifierLeaderboard } from '../qualifiers';
import { createMatch, recordGameScore } from '../brackets';
import { generatePresignedAvatarUrls } from '../uploads';
import { PlayerAvatar } from '../../features/players/components/PlayerAvatar';
import { setDb, assertDatabaseConfig } from '../../db';
import { setupTestDb } from '../../db/testDb';
import { bracketTiers, matches, qualifierSubmissions, tournaments } from '../../db/schema';

describe('Phase 7: Relational Persistence & Avatar System', () => {
  let testDb: any;

  beforeEach(() => {
    const { db } = setupTestDb();
    testDb = db;
    setDb(db);
  });

  describe('1. Name Uniqueness with lower(trim(name)) constraint', () => {
    it('creates unique players successfully', async () => {
      const p1 = await createPlayer({ name: 'Jonas Neubauer', country: 'US', playstyle: 'DAS' });
      expect(p1.id).toBeDefined();
      expect(p1.name).toBe('Jonas Neubauer');
      expect(p1.avatarType).toBe('flag');

      const all = await listPlayers();
      expect(all.length).toBe(1);
    });

    it('rejects duplicate player names regardless of casing and leading/trailing whitespace', async () => {
      await createPlayer({ name: 'Alex Kerr', country: 'US' });

      await expect(createPlayer({ name: 'alex kerr', country: 'US' })).rejects.toThrow(
        /already exists/i
      );

      await expect(createPlayer({ name: '  ALEX KERR  ', country: 'US' })).rejects.toThrow(
        /already exists/i
      );

      await expect(createPlayer({ name: 'Alex Kerr  ', country: 'US' })).rejects.toThrow(
        /already exists/i
      );
    });
  });

  describe('2. Cascading Deletes & Orphan Prevention', () => {
    it('cleanly drops tiers, matches, games, and qualifiers when tournament is deleted', async () => {
      const { tournament, tiers } = await createTournament({
        name: 'CTWC 2026',
        qualFormat: 'HIGH_SCORE',
        tiers: [
          { name: 'Gold', bracketType: 'TRADITIONAL', numPlayers: 16, priorityOrder: 1 },
          { name: 'Silver', bracketType: 'FLAT', numPlayers: 8, priorityOrder: 2 },
        ],
      });
      expect(tiers.length).toBe(2);

      const p1 = await createPlayer({ name: 'Blue Scuti', country: 'US' });
      const p2 = await createPlayer({ name: 'Fractal', country: 'US' });

      // Add qualifier submissions
      await submitQualifierScore(tournament.id, p1.id, 1200000);
      await submitQualifierScore(tournament.id, p2.id, 1150000);

      // Create match
      const match = await createMatch({
        tierId: tiers[0].id,
        roundNumber: 1,
        player1Id: p1.id,
        player2Id: p2.id,
      });
      expect(match.id).toBeDefined();

      const initialTiers = await testDb.select().from(bracketTiers);
      expect(initialTiers).toHaveLength(2);

      const initialMatches = await testDb.select().from(matches);
      expect(initialMatches).toHaveLength(1);

      const initialSubs = await testDb.select().from(qualifierSubmissions);
      expect(initialSubs).toHaveLength(2);

      // Delete tournament
      const deleted = await deleteTournament(tournament.id);
      expect(deleted).toBe(true);

      // Verify zero orphans left in relational tables
      const remainingTourneys = await testDb.select().from(tournaments);
      expect(remainingTourneys).toHaveLength(0);

      const remainingTiers = await testDb.select().from(bracketTiers);
      expect(remainingTiers).toHaveLength(0);

      const remainingMatches = await testDb.select().from(matches);
      expect(remainingMatches).toHaveLength(0);

      const remainingSubs = await testDb.select().from(qualifierSubmissions);
      expect(remainingSubs).toHaveLength(0);

      const fetched = await getTournament(tournament.id);
      expect(fetched).toBeNull();
    });
  });

  describe('3. Unverified Bracket Match Score Protection', () => {
    it('rejects match score recording for unverified brackets', async () => {
      const { tournament, tiers } = await createTournament({
        name: 'Draft Open',
        qualFormat: 'HIGH_SCORE',
        isVerified: false,
        tiers: [{ name: 'Gold', bracketType: 'TRADITIONAL', numPlayers: 8, priorityOrder: 1 }],
      });

      const match = await createMatch({
        tierId: tiers[0].id,
        roundNumber: 1,
      });

      await expect(
        recordGameScore({
          tournamentId: tournament.id,
          matchId: match.id,
          gameNumber: 1,
          player1Score: 650000,
          player2Score: 540000,
        })
      ).rejects.toThrow(/Cannot record match scores for an unverified bracket/i);
    });

    it('accepts match score recording once bracket is verified', async () => {
      const { tournament, tiers } = await createTournament({
        name: 'Verified Open',
        qualFormat: 'HIGH_SCORE',
        isVerified: true,
        tiers: [{ name: 'Gold', bracketType: 'TRADITIONAL', numPlayers: 8, priorityOrder: 1 }],
      });

      const p1 = await createPlayer({ name: 'Player A' });
      const p2 = await createPlayer({ name: 'Player B' });

      const match = await createMatch({
        tierId: tiers[0].id,
        roundNumber: 1,
        player1Id: p1.id,
        player2Id: p2.id,
      });

      const game = await recordGameScore({
        tournamentId: tournament.id,
        matchId: match.id,
        gameNumber: 1,
        player1Score: 850000,
        player2Score: 720000,
      });

      expect(game.id).toBeDefined();
      expect(game.winnerId).toBe(p1.id);
      expect(game.loserId).toBe(p2.id);
      expect(game.player1Score).toBe(850000);
    });
  });

  describe('4. Dynamic Career Stats Performance & Calculation', () => {
    it('calculates player career stats accurately and executes in < 50ms for 1,000 queries', async () => {
      const playerId = 'player-scuti';
      const opponentId = 'player-dog';

      const mockMatches = [
        {
          player1Id: playerId,
          player2Id: opponentId,
          winnerId: playerId,
          games: [
            { player1Score: 1100000, player2Score: 900000, winnerId: playerId },
            { player1Score: 950000, player2Score: 1020000, winnerId: opponentId },
            { player1Score: 1250000, player2Score: 890000, winnerId: playerId },
          ],
        },
        {
          player1Id: opponentId,
          player2Id: playerId,
          winnerId: playerId,
          games: [
            { player1Score: 880000, player2Score: 1150000, winnerId: playerId },
            { player1Score: 910000, player2Score: 1080000, winnerId: playerId },
          ],
        },
      ];

      const stats = await getPlayerCareerStats(playerId, mockMatches);
      expect(stats.matchesPlayed).toBe(2);
      expect(stats.matchesWon).toBe(2);
      expect(stats.matchesLost).toBe(0);
      expect(stats.matchWinRate).toBe(1.0);
      expect(stats.gamesPlayed).toBe(5);
      expect(stats.gamesWon).toBe(4);
      expect(stats.gamesLost).toBe(1);
      expect(stats.gameWinRate).toBe(0.8);
      expect(stats.highestScore).toBe(1250000);
      expect(stats.averageScore).toBe(Math.round((1100000 + 950000 + 1250000 + 1150000 + 1080000) / 5));

      const startTime = performance.now();
      for (let i = 0; i < 1000; i++) {
        await getPlayerCareerStats(playerId, mockMatches);
      }
      const durationMs = performance.now() - startTime;
      expect(durationMs).toBeLessThan(50);
    });
  });

  describe('5. Avatar Pipeline & Component Rendering', () => {
    it('generates presigned avatar and thumbnail URLs for R2 bucket', () => {
      const urls = generatePresignedAvatarUrls('p-12345', 'webp', 'https://r2.myorg.com');
      expect(urls.avatarKey).toBe('avatars/p-12345.webp');
      expect(urls.thumbnailKey).toBe('thumbnails/p-12345.webp');
      expect(urls.avatarUploadUrl).toContain('https://r2.myorg.com/avatars/p-12345.webp?action=put');
      expect(urls.thumbnailUploadUrl).toContain('https://r2.myorg.com/thumbnails/p-12345.webp?action=put');
      expect(urls.avatarPublicUrl).toBe('https://r2.myorg.com/avatars/p-12345.webp');
    });

    it('renders custom avatar image when avatarType is custom and avatarUrl is present', () => {
      const player = {
        name: 'Tristop',
        country: 'US',
        avatarType: 'custom' as const,
        avatarUrl: 'https://r2.myorg.com/avatars/tristop.webp',
      };

      const html = renderToStaticMarkup(<PlayerAvatar player={player} size={28} />);
      expect(html).toContain('<img');
      expect(html).toContain('src="https://r2.myorg.com/avatars/tristop.webp"');
      expect(html).toContain('width:28px');
      expect(html).toContain('height:28px');
      expect(html).toContain('border-radius:50%');
    });

    it('falls back to country flag when avatarType is flag', () => {
      const player = {
        name: 'PixelAndy',
        country: 'US',
        avatarType: 'flag' as const,
      };

      const html = renderToStaticMarkup(<PlayerAvatar player={player} />);
      expect(html).toContain('<svg');
      expect(html).not.toContain('<img');
    });

    it('renders initial letter badge when player has no assigned country and no custom avatar (walk-in)', () => {
      const walkIn = {
        name: 'sharky',
        avatarType: 'flag' as const,
      };

      const html = renderToStaticMarkup(<PlayerAvatar player={walkIn} size={32} />);
      expect(html).toContain('data-testid="player-initial-avatar"');
      expect(html).toContain('>S<');
      expect(html).not.toContain('<svg');
      expect(html).not.toContain('<img');
    });
  });

  describe('6. Qualifier Leaderboard Aggregation across formats', () => {
    it('ranks correctly for HIGH_SCORE', async () => {
      const { tournament } = await createTournament({
        name: 'HighScore Tourney',
        qualFormat: 'HIGH_SCORE',
      });
      const p1 = await createPlayer({ name: 'Player One' });
      const p2 = await createPlayer({ name: 'Player Two' });

      await submitQualifierScore(tournament.id, p1.id, 900000);
      await submitQualifierScore(tournament.id, p1.id, 1200000);
      await submitQualifierScore(tournament.id, p2.id, 1100000);

      const lb = await getQualifierLeaderboard(tournament.id);
      expect(lb.length).toBe(2);
      expect(lb[0].playerId).toBe(p1.id);
      expect(lb[0].totalScore).toBe(1200000);
      expect(lb[0].rank).toBe(1);
      expect(lb[1].playerId).toBe(p2.id);
      expect(lb[1].totalScore).toBe(1100000);
      expect(lb[1].rank).toBe(2);
    });
  });

  describe('7. Startup Database Configuration Error Enforcement', () => {
    it('throws clear configuration error if DATABASE_URL is missing', () => {
      const origEnv = process.env.DATABASE_URL;
      delete process.env.DATABASE_URL;

      try {
        expect(() => assertDatabaseConfig()).toThrow(
          /Configuration Error: DATABASE_URL is missing\. Please copy \.env\.example to \.env and run "npm run db:up"\./
        );
      } finally {
        process.env.DATABASE_URL = origEnv;
      }
    });
  });
});
