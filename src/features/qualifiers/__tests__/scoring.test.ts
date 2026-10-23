import { describe, it, expect } from 'vitest';
import {
  calculateHighScore,
  calculateMaxoutAndKicker,
  MAXOUT_THRESHOLD,
  calculateAverageOfX,
  calculatePoints,
  deriveLeaderboard,
  generateDraftBracketsForTournament,
  getPlayerQualifierStatus,
} from '../scoring';
import { Tournament, QualifierSubmission, PlayerProfile, TournamentTier } from '../../tournament/types';
import { generateTraditionalBracket } from '../../bracket/math';

describe('Qualifiers Scoring Engine', () => {
  const dummySubs: QualifierSubmission[] = [
    { id: 's1', tournamentId: 't1', playerId: 'p1', score: 950000, submittedAt: 1000 },
    { id: 's2', tournamentId: 't1', playerId: 'p1', score: 1150000, submittedAt: 2000 },
    { id: 's3', tournamentId: 't1', playerId: 'p1', score: 800000, submittedAt: 3000 },
  ];

  it('calculates HIGH_SCORE correctly as MAX(score)', () => {
    expect(calculateHighScore(dummySubs)).toBe(1150000);
    expect(calculateHighScore([])).toBe(0);
  });

  describe('calculateMaxoutAndKicker', () => {
    it('accurately counts maxouts (>= 999,999) and finds highest sub-maxout kicker', () => {
      expect(MAXOUT_THRESHOLD).toBe(999999);
      // dummySubs: 950k, 1150k (maxout), 800k -> 1 maxout, kicker 950k, best 1150k
      const res = calculateMaxoutAndKicker(dummySubs);
      expect(res.maxoutCount).toBe(1);
      expect(res.kickerScore).toBe(950000);
      expect(res.bestScore).toBe(1150000);
    });

    it('returns kicker 0 when competitor has only maxouts', () => {
      const allMaxouts: QualifierSubmission[] = [
        { id: 'm1', tournamentId: 't1', playerId: 'p1', score: 1000000, submittedAt: 1 },
        { id: 'm2', tournamentId: 't1', playerId: 'p1', score: 1050000, submittedAt: 2 },
      ];
      const res = calculateMaxoutAndKicker(allMaxouts);
      expect(res.maxoutCount).toBe(2);
      expect(res.kickerScore).toBe(0);
      expect(res.bestScore).toBe(1050000);
    });

    it('returns 0 maxouts and 0 kicker when submissions list is empty', () => {
      const res = calculateMaxoutAndKicker([]);
      expect(res.maxoutCount).toBe(0);
      expect(res.kickerScore).toBe(0);
      expect(res.bestScore).toBe(0);
    });
  });

  describe('calculateAverageOfX', () => {
    it('calculates in-progress running mean of attempts submitted so far', () => {
      // 2 attempts submitted, target is 3
      const twoSubs = dummySubs.slice(0, 2); // 950k + 1150k = 2100k
      const res = calculateAverageOfX(twoSubs, 3, false);
      expect(res.average).toBe(1050000);
      expect(res.count).toBe(2);
    });

    it('calculates completed average with missing attempts as 0', () => {
      // 2 attempts submitted, target is 3, quals closed / complete -> (950k + 1150k + 0) / 3 = 700000
      const twoSubs = dummySubs.slice(0, 2);
      const res = calculateAverageOfX(twoSubs, 3, true);
      expect(res.average).toBe(700000);
      expect(res.count).toBe(2);
    });

    it('handles empty attempts gracefully', () => {
      const res = calculateAverageOfX([], 3, true);
      expect(res.average).toBe(0);
      expect(res.count).toBe(0);
    });
  });

  describe('calculatePoints', () => {
    const pointsConfig = [
      { minScore: 1200000, points: 100 },
      { minScore: 1000000, points: 50 },
      { minScore: 800000, points: 20 },
    ];

    it('awards non-cumulative points for highest threshold met per attempt', () => {
      // s1: 950000 -> 20 pts
      // s2: 1150000 -> 50 pts
      // s3: 800000 -> 20 pts
      // total = 90
      const res = calculatePoints(dummySubs, pointsConfig);
      expect(res.totalPoints).toBe(90);
      expect(res.pointsPerAttempt).toEqual([20, 50, 20]);
    });

    it('awards 0 points when below lowest threshold', () => {
      const lowSub: QualifierSubmission[] = [
        { id: 's4', tournamentId: 't1', playerId: 'p1', score: 500000, submittedAt: 4000 },
      ];
      const res = calculatePoints(lowSub, pointsConfig);
      expect(res.totalPoints).toBe(0);
      expect(res.pointsPerAttempt).toEqual([0]);
    });
  });

  describe('deriveLeaderboard & Seeding', () => {
    const mockPlayers: PlayerProfile[] = [
      { id: 'p1', name: 'Alice', personalBest: 1200000, playstyle: 'Rolling' },
      { id: 'p2', name: 'Bob', personalBest: 1100000, playstyle: 'Rolling' },
      { id: 'p3', name: 'Charlie', personalBest: 1050000, playstyle: 'DAS' },
      { id: 'p4', name: 'Dave (DQ)', personalBest: 1300000, playstyle: 'Rolling', isDisqualified: true },
      { id: 'p5', name: 'Eve', personalBest: 950000, playstyle: 'DAS' },
      { id: 'p6', name: 'Frank', personalBest: 900000, playstyle: 'DAS' },
    ];

    const mockSubmissions: QualifierSubmission[] = [
      { id: 'sub1', tournamentId: 't1', playerId: 'p1', score: 1000000, submittedAt: 100 },
      { id: 'sub2', tournamentId: 't1', playerId: 'p2', score: 900000, submittedAt: 200 },
      { id: 'sub3', tournamentId: 't1', playerId: 'p3', score: 850000, submittedAt: 300 },
      { id: 'sub4', tournamentId: 't1', playerId: 'p4', score: 1200000, submittedAt: 50 }, // DQ player has high score
      { id: 'sub5', tournamentId: 't1', playerId: 'p5', score: 800000, submittedAt: 400 },
      { id: 'sub6', tournamentId: 't1', playerId: 'p6', score: 700000, submittedAt: 500 },
    ];

    const mockTiers: TournamentTier[] = [
      {
        id: 'gold',
        slug: 'gold',
        name: 'Gold',
        priority: 1,
        bracketType: 'TRADITIONAL',
        playerCount: 2, // ranks 1-2
        bestOf: 5,
        bracket: generateTraditionalBracket(
          [{ id: 'p1', name: 'Alice', seed: 1 }, { id: 'p2', name: 'Bob', seed: 2 }],
          { tierId: 'gold' }
        ),
        isLocked: false,
      },
      {
        id: 'silver',
        slug: 'silver',
        name: 'Silver',
        priority: 2,
        bracketType: 'TRADITIONAL',
        playerCount: 2, // ranks 3-4
        bestOf: 3,
        bracket: generateTraditionalBracket(
          [{ id: 'p3', name: 'Charlie', seed: 1 }, { id: 'p5', name: 'Eve', seed: 2 }],
          { tierId: 'silver' }
        ),
        isLocked: false,
      },
    ];

    const tournament: Tournament = {
      id: 't1',
      organizationId: 'org_ctwc',
      slug: 't1-slug',
      name: 'Test Tournament',
      date: '2026-03-20',
      location: 'Online',
      qualFormat: 'HIGH_SCORE',
      isLocked: false,
      tiers: mockTiers,
      matchScores: {},
      playersPool: mockPlayers,
      qualifierSubmissions: mockSubmissions,
      tournamentPlayers: {},
    };

    it('drops DQ players to the bottom without a rank, tier, or seed slot', () => {
      const rows = deriveLeaderboard(tournament);

      // Total 6 players
      expect(rows).toHaveLength(6);

      // Dave (1,200,000 maxout) is DQ'd: highest score, but takes no rank or seed
      // Rank 1 should be Alice (1,000,000 maxout) -> Gold Seed 1
      expect(rows[0].player.name).toBe('Alice');
      expect(rows[0].rank).toBe(1);
      expect(rows[0].assignedTier?.id).toBe('gold');
      expect(rows[0].tierSeed).toBe(1);

      // Rank 2 should be Bob (900,000) -> Gold Seed 2
      expect(rows[1].player.name).toBe('Bob');
      expect(rows[1].rank).toBe(2);
      expect(rows[1].assignedTier?.id).toBe('gold');
      expect(rows[1].tierSeed).toBe(2);

      // Ranks 3-4 -> Silver tier
      expect(rows[2].player.name).toBe('Charlie');
      expect(rows[2].rank).toBe(3);
      expect(rows[2].assignedTier?.id).toBe('silver');
      expect(rows[2].tierSeed).toBe(1);
      expect(rows[3].player.name).toBe('Eve');
      expect(rows[3].rank).toBe(4);
      expect(rows[3].assignedTier?.id).toBe('silver');
      expect(rows[3].tierSeed).toBe(2);

      // Rank 5: Frank (700,000) misses the cutoff -> DNQ
      expect(rows[4].player.name).toBe('Frank');
      expect(rows[4].rank).toBe(5);
      expect(rows[4].assignedTier).toBeUndefined();
      expect(rows[4].isDNQ).toBe(true);

      // Dave (DQ) sits at the bottom, unranked and unseeded
      expect(rows[5].player.name).toBe('Dave (DQ)');
      expect(rows[5].isDisqualified).toBe(true);
      expect(rows[5].rank).toBeUndefined();
      expect(rows[5].assignedTier).toBeUndefined();
      expect(rows[5].tierSeed).toBeUndefined();
    });

    it('breaks ties deterministically by earlier submission timestamp', () => {
      const tiedTournament: Tournament = {
        ...tournament,
        qualifierSubmissions: [
          { id: 'subA', tournamentId: 't1', playerId: 'p1', score: 1000000, submittedAt: 200 },
          { id: 'subB', tournamentId: 't1', playerId: 'p2', score: 1000000, submittedAt: 100 }, // p2 submitted earlier
        ],
      };

      const rows = deriveLeaderboard(tiedTournament);
      // p2 should be rank 1 because timestamp 100 < 200
      expect(rows[0].player.id).toBe('p2');
      expect(rows[0].rank).toBe(1);
      expect(rows[1].player.id).toBe('p1');
      expect(rows[1].rank).toBe(2);
    });

    it('sorts competitors according to exact Maxout count + kicker hierarchy in HIGH_SCORE mode', () => {
      // Competitor 1: 2 Maxouts (1.1M, 1.05M) + 900k kicker -> Rank 1
      // Competitor 2: 2 Maxouts (1.2M, 1.0M) + 850k kicker -> Rank 2 (2 maxouts, lower kicker)
      // Competitor 3: 1 Maxout (1.3M) + 950k kicker -> Rank 3 (1 maxout beats 0 maxouts)
      // Competitor 4: 1 Maxout (1.0M) + 800k kicker -> Rank 4 (1 maxout, lower kicker)
      // Competitor 5: 0 Maxouts (980k best) -> Rank 5
      // Competitor 6: 0 Maxouts (950k best) -> Rank 6
      const maxoutPlayers: PlayerProfile[] = [
        { id: 'c1', name: 'Two Max High Kicker', personalBest: 1200000, playstyle: 'Rolling' },
        { id: 'c2', name: 'Two Max Low Kicker', personalBest: 1200000, playstyle: 'Rolling' },
        { id: 'c3', name: 'One Max High Kicker', personalBest: 1300000, playstyle: 'Rolling' },
        { id: 'c4', name: 'One Max Low Kicker', personalBest: 1100000, playstyle: 'Rolling' },
        { id: 'c5', name: 'Zero Max 980k', personalBest: 980000, playstyle: 'DAS' },
        { id: 'c6', name: 'Zero Max 950k', personalBest: 950000, playstyle: 'DAS' },
      ];

      const maxoutSubmissions: QualifierSubmission[] = [
        // c1: 2 maxouts, kicker 900k
        { id: 's1', tournamentId: 't-max', playerId: 'c1', score: 1100000, submittedAt: 1 },
        { id: 's2', tournamentId: 't-max', playerId: 'c1', score: 1050000, submittedAt: 2 },
        { id: 's3', tournamentId: 't-max', playerId: 'c1', score: 900000, submittedAt: 3 },
        // c2: 2 maxouts, kicker 850k
        { id: 's4', tournamentId: 't-max', playerId: 'c2', score: 1200000, submittedAt: 4 },
        { id: 's5', tournamentId: 't-max', playerId: 'c2', score: 1000000, submittedAt: 5 },
        { id: 's6', tournamentId: 't-max', playerId: 'c2', score: 850000, submittedAt: 6 },
        // c3: 1 maxout (1.3M), kicker 950k
        { id: 's7', tournamentId: 't-max', playerId: 'c3', score: 1300000, submittedAt: 7 },
        { id: 's8', tournamentId: 't-max', playerId: 'c3', score: 950000, submittedAt: 8 },
        // c4: 1 maxout (1.0M), kicker 800k
        { id: 's9', tournamentId: 't-max', playerId: 'c4', score: 1000000, submittedAt: 9 },
        { id: 's10', tournamentId: 't-max', playerId: 'c4', score: 800000, submittedAt: 10 },
        // c5: 0 maxouts, best 980k
        { id: 's11', tournamentId: 't-max', playerId: 'c5', score: 980000, submittedAt: 11 },
        // c6: 0 maxouts, best 950k
        { id: 's12', tournamentId: 't-max', playerId: 'c6', score: 950000, submittedAt: 12 },
      ];

      const maxoutTournament: Tournament = {
        id: 't-max',
        organizationId: 'org_ctwc',
        slug: 't-max',
        name: 'Maxout Championship',
        date: '2026-09-10',
        location: 'Online',
        qualFormat: 'HIGH_SCORE',
        isLocked: false,
        tiers: mockTiers,
        matchScores: {},
        playersPool: maxoutPlayers,
        qualifierSubmissions: maxoutSubmissions,
        tournamentPlayers: {},
      };

      const rows = deriveLeaderboard(maxoutTournament);

      expect(rows).toHaveLength(6);

      // Rank 1: c1 (2 maxouts, kicker 900k)
      expect(rows[0].player.id).toBe('c1');
      expect(rows[0].rank).toBe(1);
      expect(rows[0].maxoutCount).toBe(2);
      expect(rows[0].kickerScore).toBe(900000);

      // Rank 2: c2 (2 maxouts, kicker 850k)
      expect(rows[1].player.id).toBe('c2');
      expect(rows[1].rank).toBe(2);
      expect(rows[1].maxoutCount).toBe(2);
      expect(rows[1].kickerScore).toBe(850000);

      // Rank 3: c3 (1 maxout, kicker 950k)
      expect(rows[2].player.id).toBe('c3');
      expect(rows[2].rank).toBe(3);
      expect(rows[2].maxoutCount).toBe(1);
      expect(rows[2].kickerScore).toBe(950000);

      // Rank 4: c4 (1 maxout, kicker 800k)
      expect(rows[3].player.id).toBe('c4');
      expect(rows[3].rank).toBe(4);
      expect(rows[3].maxoutCount).toBe(1);
      expect(rows[3].kickerScore).toBe(800000);

      // Rank 5: c5 (0 maxouts, best 980k)
      expect(rows[4].player.id).toBe('c5');
      expect(rows[4].rank).toBe(5);
      expect(rows[4].maxoutCount).toBe(0);
      expect(rows[4].finalScore).toBe(980000);

      // Rank 6: c6 (0 maxouts, best 950k)
      expect(rows[5].player.id).toBe('c6');
      expect(rows[5].rank).toBe(6);
      expect(rows[5].maxoutCount).toBe(0);
      expect(rows[5].finalScore).toBe(950000);
    });

    it('dynamically generates draft brackets with tier-relative seeding', () => {
      const draftTiers = generateDraftBracketsForTournament(tournament);

      // Gold tier bracket should feature Alice (Seed 1) vs Bob (Seed 2); DQ'd Dave takes no slot
      const goldBracket = draftTiers.find(t => t.id === 'gold')!.bracket;
      expect(goldBracket.rounds[0].matches[0].player1.player?.name).toBe('Alice');
      expect(goldBracket.rounds[0].matches[0].player1.player?.seed).toBe(1);
      expect(goldBracket.rounds[0].matches[0].player2.player?.name).toBe('Bob');
      expect(goldBracket.rounds[0].matches[0].player2.player?.seed).toBe(2);

      // Silver tier bracket should feature Charlie (Seed 1) vs Eve (Seed 2)
      const silverBracket = draftTiers.find(t => t.id === 'silver')!.bracket;
      expect(silverBracket.rounds[0].matches[0].player1.player?.name).toBe('Charlie');
      expect(silverBracket.rounds[0].matches[0].player1.player?.seed).toBe(1);
      expect(silverBracket.rounds[0].matches[0].player2.player?.name).toBe('Eve');
      expect(silverBracket.rounds[0].matches[0].player2.player?.seed).toBe(2);

      const seededIds = draftTiers.flatMap(t =>
        t.bracket.rounds.flatMap(r => r.matches.flatMap(m => [m.player1.player?.id, m.player2.player?.id]))
      );
      expect(seededIds).not.toContain('p4');
    });

    it('assigns ranks without marking players as DNQ when tournament has no tiers (bracketless quals)', () => {
      const tierlessTournament: Tournament = {
        ...tournament,
        tiers: [],
      };

      const rows = deriveLeaderboard(tierlessTournament);
      expect(rows).toHaveLength(6);

      // Eligible players ranked 1 through 5; DQ'd Dave unranked at the bottom
      expect(rows[0].rank).toBe(1);
      expect(rows[0].player.name).toBe('Alice');
      expect(rows[0].isDNQ).toBe(false);
      expect(rows[0].assignedTier).toBeUndefined();
      expect(rows[0].tierSeed).toBeUndefined();

      expect(rows[4].rank).toBe(5);
      expect(rows[4].player.name).toBe('Frank');
      expect(rows[4].isDNQ).toBe(false);

      expect(rows[5].player.name).toBe('Dave (DQ)');
      expect(rows[5].rank).toBeUndefined();
      expect(rows[5].isDNQ).toBe(false);
    });

    it('populates qualifier status on LeaderboardRankRow (not started, in progress, verified)', () => {
      const tourneyWithStatus: Tournament = {
        ...tournament,
        tournamentPlayers: {
          p1: { playerId: 'p1', tournamentId: 't1', isVerified: true },
        },
      };

      const rows = deriveLeaderboard(tourneyWithStatus);
      // Bob (p2) has submissions and is not verified -> 'in progress'
      const bob = rows.find(r => r.player.id === 'p2');
      expect(bob?.status).toBe('in progress');

      // Dave (p4) carries the tournament DQ flag -> 'dq'
      const dave = rows.find(r => r.player.id === 'p4');
      expect(dave?.status).toBe('dq');

      // Alice (p1) is marked isVerified: true -> 'verified'
      const alice = rows.find(r => r.player.id === 'p1');
      expect(alice?.status).toBe('verified');
    });

    it('deterministically tiebreaks 0-point players by peakScore in POINTS qualifier format', () => {
      const pointsTourney: Tournament = {
        id: 't-points',
        organizationId: 'org_test',
        slug: 't-points',
        name: 'Points Tournament',
        date: '2026-10-07',
        location: 'Online',
        qualFormat: 'POINTS',
        pointsConfig: [
          { minScore: 1000000, points: 100 },
          { minScore: 800000, points: 50 },
        ],
        isLocked: false,
        tiers: [],
        matchScores: {},
        playersPool: [
          { id: 'p_none', name: 'No Attempts Player', personalBest: 500000, playstyle: 'DAS' },
          { id: 'p_low', name: 'Low Peak Player', personalBest: 600000, playstyle: 'Rolling' },
          { id: 'p_high', name: 'High Peak Player', personalBest: 750000, playstyle: 'Rolling' },
          { id: 'p_scored', name: 'Scored Player', personalBest: 900000, playstyle: 'Rolling' },
        ],
        qualifierSubmissions: [
          // p_scored gets 50 points
          { id: 's1', tournamentId: 't-points', playerId: 'p_scored', score: 850000, submittedAt: 100 },
          // p_high gets 0 points (below 800k threshold), peakScore = 750,000
          { id: 's2', tournamentId: 't-points', playerId: 'p_high', score: 750000, submittedAt: 200 },
          { id: 's3', tournamentId: 't-points', playerId: 'p_high', score: 400000, submittedAt: 300 },
          // p_low gets 0 points (below 800k threshold), peakScore = 300,000 (submitted earlier)
          { id: 's4', tournamentId: 't-points', playerId: 'p_low', score: 300000, submittedAt: 50 },
          // p_none has 0 attempts -> 0 points, peakScore = 0
        ],
        tournamentPlayers: {},
      };

      const rows = deriveLeaderboard(pointsTourney);
      expect(rows).toHaveLength(4);

      // Rank 1: Scored Player (50 points)
      expect(rows[0].player.id).toBe('p_scored');
      expect(rows[0].finalScore).toBe(50);
      expect(rows[0].peakScore).toBe(850000);

      // Rank 2: High Peak Player (0 points, peakScore 750,000)
      expect(rows[1].player.id).toBe('p_high');
      expect(rows[1].finalScore).toBe(0);
      expect(rows[1].peakScore).toBe(750000);

      // Rank 3: Low Peak Player (0 points, peakScore 300,000 - despite earlier timestamp)
      expect(rows[2].player.id).toBe('p_low');
      expect(rows[2].finalScore).toBe(0);
      expect(rows[2].peakScore).toBe(300000);

      // Rank 4: No Attempts Player (0 points, peakScore 0)
      expect(rows[3].player.id).toBe('p_none');
      expect(rows[3].finalScore).toBe(0);
      expect(rows[3].peakScore).toBe(0);
    });
  });

  describe('getPlayerQualifierStatus', () => {
    const baseTourney: Tournament = {
      id: 't-test',
      organizationId: 'org_ctwc',
      slug: 't-test',
      name: 'Test Tournament',
      date: '2026-09-14',
      location: 'Local',
      qualFormat: 'HIGH_SCORE',
      isLocked: false,
      tiers: [],
      matchScores: {},
      playersPool: [
        { id: 'p1', name: 'Player 1', personalBest: 1000000, playstyle: 'DAS' },
        { id: 'p2', name: 'Player 2', personalBest: 1000000, playstyle: 'Rolling' },
        { id: 'p3', name: 'Player 3', personalBest: 1000000, playstyle: 'Rolling' },
      ],
      qualifierSubmissions: [
        { id: 's1', tournamentId: 't-test', playerId: 'p2', score: 950000, submittedAt: 1000 },
      ],
      tournamentPlayers: {
        p3: { playerId: 'p3', tournamentId: 't-test', isVerified: true },
      },
    };

    it('returns "not started" when competitor has 0 submissions and is not verified', () => {
      expect(getPlayerQualifierStatus(baseTourney, 'p1')).toBe('not started');
    });

    it('returns "in progress" when competitor has at least 1 submission and is not verified', () => {
      expect(getPlayerQualifierStatus(baseTourney, 'p2')).toBe('in progress');
    });

    it('returns "verified" when competitor is marked isVerified in tournamentPlayers', () => {
      expect(getPlayerQualifierStatus(baseTourney, 'p3')).toBe('verified');
    });

    it('returns "verified" for all players when tournament brackets are locked/finalized', () => {
      const lockedTourney: Tournament = {
        ...baseTourney,
        isLocked: true,
      };

      expect(getPlayerQualifierStatus(lockedTourney, 'p1')).toBe('verified');
      expect(getPlayerQualifierStatus(lockedTourney, 'p2')).toBe('verified');
      expect(getPlayerQualifierStatus(lockedTourney, 'p3')).toBe('verified');
    });
  });
});
