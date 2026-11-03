import { describe, it, expect } from 'vitest';
import { DEFAULT_ORGANIZATIONS } from '../store';
import { computeOrganizationMetrics, computeOrgCompetitorLeaderboard } from '../metrics';
import { Tournament, PlayerProfile, Organization } from '../../tournament/types';
import { generateTraditionalBracket } from '../../bracket/math';

describe('Organizations Core Engine & Metrics', () => {
  it('initializes default organizations as empty array (no unbacked mock orgs)', () => {
    expect(DEFAULT_ORGANIZATIONS).toEqual([]);
  });

  it('computes accurate organization metrics from hosted tournaments', () => {
    const players: PlayerProfile[] = [
      { id: 'p1', name: 'Alice', personalBest: 1200000, playstyle: 'Rolling' },
      { id: 'p2', name: 'Bob', personalBest: 1100000, playstyle: 'DAS' },
      { id: 'p3', name: 'Charlie', personalBest: 1000000, playstyle: 'Rolling' },
    ];

    const bracket = generateTraditionalBracket(
      [{ id: 'p1', name: 'Alice', seed: 1 }, { id: 'p2', name: 'Bob', seed: 2 }],
      { tierId: 'gold', bestOf: 3 }
    );
    const finalMatchId = bracket.rounds[0].matches[0].id;

    const tourney1: Tournament = {
      id: 't-org-1',
      organizationId: 'org_test',
      slug: 'test-open-1',
      name: 'Test Open 1',
      location: 'Dallas, TX',
      qualFormat: 'AVERAGE_OF_X',
      isLocked: true,
      playersPool: players.slice(0, 2),
      tournamentPlayers: {
        p1: { playerId: 'p1', tournamentId: 't-org-1', organizationId: 'org_test' },
        p2: { playerId: 'p2', tournamentId: 't-org-1', organizationId: 'org_test' },
      },
      qualifierSubmissions: [
        { id: 's1', tournamentId: 't-org-1', organizationId: 'org_test', playerId: 'p1', score: 1050000, submittedAt: 10 },
        { id: 's2', tournamentId: 't-org-1', organizationId: 'org_test', playerId: 'p2', score: 950000, submittedAt: 20 },
      ],
      matchScores: {
        [finalMatchId]: {
          matchId: finalMatchId,
          tierId: 'gold',
          organizationId: 'org_test',
          bestOf: 3,
          player1Wins: 2,
          player2Wins: 0,
          winnerPlayerId: 'p1',
          loserPlayerId: 'p2',
          isComplete: true,
          games: [],
        },
      },
      tiers: [
        {
          id: 'gold',
          slug: 'gold',
          name: 'Gold Championship',
          priority: 1,
          bracketType: 'TRADITIONAL',
          playerCount: 2,
          bestOf: 3,
          bracket,
          isLocked: true,
        },
      ],
    };

    // Tournament belonging to a different org
    const otherOrgTourney: Tournament = {
      id: 't-other',
      organizationId: 'org_other',
      slug: 'other-tourney',
      name: 'Other Tourney',
      location: 'Austin, TX',
      qualFormat: 'HIGH_SCORE',
      isLocked: false,
      playersPool: [players[2]],
      tournamentPlayers: {},
      qualifierSubmissions: [
        { id: 's3', tournamentId: 't-other', organizationId: 'org_other', playerId: 'p3', score: 999999, submittedAt: 30 },
      ],
      matchScores: {},
      tiers: [],
    };

    const metrics = computeOrganizationMetrics('org_test', [tourney1, otherOrgTourney]);
    expect(metrics.totalTournaments).toBe(1);
    expect(metrics.totalCompetitors).toBe(2);
    expect(metrics.totalMatches).toBe(1);
    expect(metrics.totalSubmissions).toBe(2);
    expect(metrics.champions).toHaveLength(1);
    expect(metrics.champions[0].winnerName).toBe('Alice');
    expect(metrics.champions[0].tierName).toBe('Gold Championship');
  });

  it('computes org-specific competitor leaderboard with raw multi-entity metrics', () => {
    const players: PlayerProfile[] = [
      { id: 'p1', name: 'Alice', personalBest: 1200000, playstyle: 'Rolling', country: 'US' },
      { id: 'p2', name: 'Bob', personalBest: 1100000, playstyle: 'DAS', country: 'JP' },
    ];

    const tourneys: Tournament[] = [
      {
        id: 't1',
        organizationId: 'org_league',
        slug: 'league-1',
        name: 'League Event 1',
        location: 'Virtual',
        qualFormat: 'AVERAGE_OF_X',
        isLocked: true,
        tiers: [],
        playersPool: players,
        tournamentPlayers: {},
        qualifierSubmissions: [
          { id: 's1', tournamentId: 't1', organizationId: 'org_league', playerId: 'p1', score: 1050000, submittedAt: 100 },
          { id: 's2', tournamentId: 't1', organizationId: 'org_league', playerId: 'p2', score: 900000, submittedAt: 200 },
        ],
        matchScores: {
          m1: {
            matchId: 'm1',
            tierId: 'gold',
            organizationId: 'org_league',
            bestOf: 3,
            player1Wins: 2,
            player2Wins: 1,
            winnerPlayerId: 'p1',
            loserPlayerId: 'p2',
            isComplete: true,
            games: [],
          },
        },
      },
      {
        id: 't2',
        organizationId: 'org_league',
        slug: 'league-2',
        name: 'League Event 2',
        location: 'Virtual',
        qualFormat: 'AVERAGE_OF_X',
        isLocked: true,
        tiers: [],
        playersPool: players,
        tournamentPlayers: {},
        qualifierSubmissions: [
          { id: 's3', tournamentId: 't2', organizationId: 'org_league', playerId: 'p1', score: 1120000, submittedAt: 300 },
          { id: 's4', tournamentId: 't2', organizationId: 'org_league', playerId: 'p2', score: 980000, submittedAt: 400 },
        ],
        matchScores: {
          m2: {
            matchId: 'm2',
            tierId: 'gold',
            organizationId: 'org_league',
            bestOf: 3,
            player1Wins: 2,
            player2Wins: 0,
            winnerPlayerId: 'p1',
            loserPlayerId: 'p2',
            isComplete: true,
            games: [],
          },
        },
      },
    ];

    const leaderboard = computeOrgCompetitorLeaderboard('org_league', tourneys, players);
    expect(leaderboard).toHaveLength(2);

    // Alice: 2 wins, 0 losses, 100% winrate, best score 1,120,000, 2 maxouts
    expect(leaderboard[0].playerName).toBe('Alice');
    expect(leaderboard[0].matchWins).toBe(2);
    expect(leaderboard[0].matchLosses).toBe(0);
    expect(leaderboard[0].winRate).toBe(100);
    expect(leaderboard[0].bestScore).toBe(1120000);
    expect(leaderboard[0].maxoutCount).toBe(2);
    expect(leaderboard[0].tournamentsCount).toBe(2);

    // Bob: 0 wins, 2 losses, 0% winrate, best score 980,000, 0 maxouts
    expect(leaderboard[1].playerName).toBe('Bob');
    expect(leaderboard[1].matchWins).toBe(0);
    expect(leaderboard[1].matchLosses).toBe(2);
    expect(leaderboard[1].winRate).toBe(0);
    expect(leaderboard[1].bestScore).toBe(980000);
    expect(leaderboard[1].maxoutCount).toBe(0);
  });

  it('correctly resolves discord webhook URL fallback hierarchy', () => {
    const orgWithWebhook: Partial<Organization> = {
      id: 'org_test',
      slug: 'test',
      name: 'Test Org',
      discordWebhookUrl: 'https://discord.com/api/webhooks/org-default',
    };

    // Case 1: Tournament specifies custom webhook override
    const tourneyWithOverride: Partial<Tournament> = {
      discordWebhookUrl: 'https://discord.com/api/webhooks/regional-override',
    };
    const resolvedOverride = tourneyWithOverride.discordWebhookUrl?.trim() || orgWithWebhook.discordWebhookUrl;
    expect(resolvedOverride).toBe('https://discord.com/api/webhooks/regional-override');

    // Case 2: Tournament webhook is empty -> falls back to parent org webhook
    const tourneyWithoutWebhook: Partial<Tournament> = {
      discordWebhookUrl: '',
    };
    const resolvedFallback = tourneyWithoutWebhook.discordWebhookUrl?.trim() || orgWithWebhook.discordWebhookUrl;
    expect(resolvedFallback).toBe('https://discord.com/api/webhooks/org-default');

    // Case 3: Neither has webhook configured
    const orgWithoutWebhook: Partial<Organization> = {
      id: 'org_test',
      slug: 'test',
      name: 'Test Org',
      discordWebhookUrl: undefined,
    };
    const resolvedNone = tourneyWithoutWebhook.discordWebhookUrl?.trim() || orgWithoutWebhook.discordWebhookUrl;
    expect(resolvedNone).toBeUndefined();
  });

  it('verifies 5-color bracket theme palette inheritance and override capability', () => {
    const sampleOrg: Partial<Organization> = {
      id: 'org_ctwc',
      slug: 'ctwc',
      name: 'Classic Tetris World Championship',
      themeColors: {
        primaryColor: '#ffc905',
        secondaryColor: '#705b33',
        cardColor: '#1b1c1d',
        textColor: '#94A3B8',
        backgroundColor: '#020203',
      },
    };
    expect(sampleOrg.themeColors).toBeDefined();

    // 5 colors defined on organization:
    const { primaryColor, secondaryColor, cardColor, textColor, backgroundColor } = sampleOrg.themeColors!;
    expect(primaryColor).toBe('#ffc905');
    expect(secondaryColor).toBe('#705b33');
    expect(cardColor).toBe('#1b1c1d');
    expect(textColor).toBe('#94A3B8');
    expect(backgroundColor).toBe('#020203');

    // Inherited regional tournament
    const inheritedTourney: Partial<Tournament> = {
      useOrgBranding: true,
      themeColors: sampleOrg.themeColors,
    };
    expect(inheritedTourney.useOrgBranding).toBe(true);
    expect(inheritedTourney.themeColors?.primaryColor).toBe('#ffc905');

    // Regional flavor tournament overriding with its own distinct palette (e.g. Pacific Northwest flavor)
    const customFlavorTourney: Partial<Tournament> = {
      useOrgBranding: false,
      themeColors: {
        primaryColor: '#10b981',
        secondaryColor: '#047857',
        cardColor: '#062016',
        textColor: '#d1fae5',
        backgroundColor: '#020c08',
      },
    };
    expect(customFlavorTourney.useOrgBranding).toBe(false);
    expect(customFlavorTourney.themeColors?.primaryColor).toBe('#10b981');
  });
});
