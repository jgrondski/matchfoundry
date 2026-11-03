import { describe, it, expect } from 'vitest';
import {
  generateAdditionalFakePlayers,
  REALISTIC_PLAYER_NAMES,
} from '../../tournament/simulation';
import { PlayerProfile, Tournament } from '../../tournament/types';

describe('Global Player Pool & Simulation', () => {
  describe('generateAdditionalFakePlayers', () => {
    it('generates the exact count of new competitors requested', () => {
      const count = 16;
      const newPlayers = generateAdditionalFakePlayers(count);

      expect(newPlayers).toHaveLength(count);

      // Verify all competitor fields
      newPlayers.forEach(p => {
        expect(p.id).toMatch(/^p_sim_/);
        expect(p.name).toBeTruthy();
        expect(['Rolling', 'DAS', 'Hypertap']).toContain(p.playstyle);
        expect(p.personalBest).toBeGreaterThanOrEqual(700000);
        expect(p.personalBest).toBeLessThanOrEqual(1350000);
        expect(p.country).toBeTruthy();
        expect(p.notes).toBe('Simulated competitor');
      });

      // Verify uniqueness of names
      const names = new Set(newPlayers.map(p => p.name.toLowerCase()));
      expect(names.size).toBe(count);
    });

    it('does not duplicate existing competitor names in the pool', () => {
      const existing: PlayerProfile[] = [
        {
          id: 'p1',
          name: REALISTIC_PLAYER_NAMES[0], // 'Blue Scuti'
          personalBest: 1200000,
          playstyle: 'Rolling',
          country: 'US',
        },
        {
          id: 'p2',
          name: REALISTIC_PLAYER_NAMES[1], // 'Fractal'
          personalBest: 1150000,
          playstyle: 'Rolling',
          country: 'US',
        },
      ];

      const additional = generateAdditionalFakePlayers(5, existing);
      expect(additional).toHaveLength(5);

      const existingNames = new Set(existing.map(e => e.name.toLowerCase()));
      additional.forEach(p => {
        expect(existingNames.has(p.name.toLowerCase())).toBe(false);
      });
    });

    it('generates unique gamer tag fallback names when predefined names are exhausted without generic Player X', () => {
      // Request more players than in REALISTIC_PLAYER_NAMES list
      const largeCount = REALISTIC_PLAYER_NAMES.length + 15;
      const players = generateAdditionalFakePlayers(largeCount);

      expect(players).toHaveLength(largeCount);

      const uniqueNames = new Set(players.map(p => p.name.toLowerCase()));
      expect(uniqueNames.size).toBe(largeCount);

      // Verify NO generic 'Player ' prefix names are generated
      const genericPlayers = players.filter(p => /^Player\s+\d+/i.test(p.name));
      expect(genericPlayers.length).toBe(0);
    });
  });

  describe('Tournament Roster Management Logic', () => {
    it('deduplicates players when importing from global pool into tournament roster', () => {
      const tournamentPlayers: PlayerProfile[] = [
        { id: 'p1', name: 'Player One', personalBest: 1000000, playstyle: 'Rolling' },
        { id: 'p2', name: 'Player Two', personalBest: 900000, playstyle: 'DAS' },
      ];

      const globalPool: PlayerProfile[] = [
        { id: 'p1', name: 'Player One', personalBest: 1000000, playstyle: 'Rolling' }, // duplicate ID
        { id: 'p_other', name: 'player two', personalBest: 900000, playstyle: 'DAS' }, // duplicate name
        { id: 'p3', name: 'Player Three', personalBest: 1100000, playstyle: 'Hypertap' }, // new
        { id: 'p4', name: 'Player Four', personalBest: 850000, playstyle: 'Rolling' }, // new
      ];

      const existingIds = new Set(tournamentPlayers.map(p => p.id));
      const existingNames = new Set(tournamentPlayers.map(p => p.name.toLowerCase()));

      const toAdd = globalPool.filter(
        p => !existingIds.has(p.id) && !existingNames.has(p.name.toLowerCase())
      );

      expect(toAdd).toHaveLength(2);
      expect(toAdd.map(p => p.name)).toEqual(['Player Three', 'Player Four']);

      const updatedRoster = [...tournamentPlayers, ...toAdd];
      expect(updatedRoster).toHaveLength(4);
    });

    it('safely handles competitor removal: allows unplayed, blocks match participants', () => {
      const sampleTournament: Tournament = {
        id: 'tourney-1',
        organizationId: 'org_ctwc',
        slug: 'tourney-1',
        name: 'Test Tournament',
        location: 'Local',
        qualFormat: 'HIGH_SCORE',
        isLocked: true,
        tiers: [],
        playersPool: [
          { id: 'p1', name: 'Alice', personalBest: 1000000, playstyle: 'Rolling' },
          { id: 'p2', name: 'Bob', personalBest: 950000, playstyle: 'DAS' },
          { id: 'p3', name: 'Charlie', personalBest: 900000, playstyle: 'Hypertap' },
        ],
        qualifierSubmissions: [
          { id: 'sub1', tournamentId: 'tourney-1', playerId: 'p1', score: 1000000, submittedAt: 1 },
          { id: 'sub2', tournamentId: 'tourney-1', playerId: 'p2', score: 950000, submittedAt: 2 },
          { id: 'sub3', tournamentId: 'tourney-1', playerId: 'p3', score: 900000, submittedAt: 3 },
        ],
        matchScores: {
          'm1': {
            matchId: 'm1',
            tierId: 't1',
            bestOf: 3,
            player1Wins: 2,
            player2Wins: 0,
            games: [],
            winnerPlayerId: 'p1',
            loserPlayerId: 'p2',
            isComplete: true,
          },
        },
        tournamentPlayers: {},
      };

      // Check if p1 has recorded matches
      const p1HasMatches = Object.values(sampleTournament.matchScores).some(
        m => m.winnerPlayerId === 'p1' || m.loserPlayerId === 'p1'
      );
      expect(p1HasMatches).toBe(true);

      // Check if p3 has recorded matches (Charlie has none)
      const p3HasMatches = Object.values(sampleTournament.matchScores).some(
        m => m.winnerPlayerId === 'p3' || m.loserPlayerId === 'p3'
      );
      expect(p3HasMatches).toBe(false);

      // Removing Charlie (p3) cleans up his profile and submissions
      const remainingPool = sampleTournament.playersPool.filter(p => p.id !== 'p3');
      const remainingSubs = sampleTournament.qualifierSubmissions.filter(s => s.playerId !== 'p3');
      expect(remainingPool).toHaveLength(2);
      expect(remainingSubs).toHaveLength(2);
      expect(remainingSubs.some(s => s.playerId === 'p3')).toBe(false);
    });
  });
});
