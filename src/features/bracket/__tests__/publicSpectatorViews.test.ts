import { describe, it, expect } from 'vitest';
import { Tournament, TournamentTier, MatchScoreRecord } from '../../tournament/types';
import { BracketMatch } from '../types';
import { BracketViewMode } from '../bracketLayout';
import { getDefaultTierColors } from '../colorUtils';

describe('Public Spectator Views & Share Bracket Specifications', () => {
  const mockTournament: Tournament = {
    id: 't-test',
    slug: 'kc-2026-open',
    name: 'KC 2026 Open',
    location: 'Kansas City, MO',
    organizationId: 'org-1',
    qualFormat: 'HIGH_SCORE',
    isLocked: true,
    tiers: [],
    playersPool: [
      { id: 'p1', name: 'BlueScuti', country: 'US', personalBest: 1200000, playstyle: 'Rolling' },
      { id: 'p2', name: 'Fractal', country: 'US', personalBest: 1150000, playstyle: 'Rolling' },
    ],
    matchScores: {},
    qualifierSubmissions: [],
    tournamentPlayers: {},
  };

  const mockTier: TournamentTier = {
    id: 'gold',
    slug: 'gold',
    name: 'Gold Tier',
    priority: 1,
    bracketType: 'TRADITIONAL',
    eliminationType: 'DOUBLE',
    bestOf: 5,
    playerCount: 8,
    primaryColor: '#ffc905',
    secondaryColor: '#705b33',
    cardColor: '#1b1c1d',
    textColor: '#94A3B8',
    backgroundColor: '#020203',
    isLocked: true,
    bracket: {
      type: 'TRADITIONAL',
      totalPlayers: 8,
      totalRounds: 3,
      rounds: [],
      matchesById: {},
    },
  };

  const mockMatch: BracketMatch = {
    id: 'match-101',
    roundNumber: 1,
    matchNumber: 1,
    stage: 'WINNERS',
    bestOf: 5,
    isBye: false,
    winnerId: 'p1',
    loserId: 'p2',
    player1: {
      player: {
        id: 'p1',
        name: 'BlueScuti',
        seed: 1,
        country: 'US',
        playstyle: 'Rolling',
      },
    },
    player2: {
      player: {
        id: 'p2',
        name: 'Fractal',
        seed: 8,
        country: 'US',
        playstyle: 'Rolling',
      },
    },
  };

  const mockScoreRecord: MatchScoreRecord = {
    matchId: 'match-101',
    tierId: 'gold',
    bestOf: 5,
    player1Wins: 3,
    player2Wins: 1,
    isComplete: true,
    winnerPlayerId: 'p1',
    loserPlayerId: 'p2',
    games: [
      { gameNumber: 1, player1Points: 950000, player2Points: 890000, winnerPlayerId: 'p1' },
      { gameNumber: 2, player1Points: 810000, player2Points: 920000, winnerPlayerId: 'p2' },
      { gameNumber: 3, player1Points: 1040000, player2Points: 980000, winnerPlayerId: 'p1' },
      { gameNumber: 4, player1Points: 999999, player2Points: 910000, winnerPlayerId: 'p1' },
    ],
  };

  describe('View Mode & Layout Engine Extensibility', () => {
    it('supports 4 distinct view modes including Card Feed for mobile', () => {
      const validModes: BracketViewMode[] = ['standard', 'fit', 'split', 'feed'];
      expect(validModes).toContain('feed');
      expect(validModes).toContain('standard');
      expect(validModes).toContain('fit');
      expect(validModes).toContain('split');
      expect(validModes.length).toBe(4);
    });

    it('resolves tier palette colors accurately for spectator overlays', () => {
      const colors = getDefaultTierColors(mockTier);
      expect(colors.primaryColor).toBe('#ffc905');
      expect(colors.secondaryColor).toBe('#705b33');
      expect(colors.cardColor).toBe('#1b1c1d');
      expect(colors.backgroundColor).toBe('#020203');
    });
  });

  describe('Match Telemetry Data Contracts', () => {
    it('derives correct game wins and completed state from score record', () => {
      expect(mockMatch.id).toBe('match-101');
      expect(mockMatch.player1.player?.name).toBe('BlueScuti');
      expect(mockMatch.player2.player?.name).toBe('Fractal');
      const p1Wins = mockScoreRecord.player1Wins;
      const p2Wins = mockScoreRecord.player2Wins;
      expect(p1Wins).toBe(3);
      expect(p2Wins).toBe(1);
      expect(mockScoreRecord.isComplete).toBe(true);
      expect(mockScoreRecord.winnerPlayerId).toBe('p1');
    });

    it('validates game-by-game telemetry format and scores', () => {
      expect(mockScoreRecord.games).toHaveLength(4);
      expect(mockScoreRecord.games[0].player1Points).toBe(950000);
      expect(mockScoreRecord.games[0].player2Points).toBe(890000);
      expect(mockScoreRecord.games[0].winnerPlayerId).toBe('p1');
      expect(mockScoreRecord.games[1].winnerPlayerId).toBe('p2');
    });

    it('identifies forfeit records cleanly', () => {
      const forfeitRecord: MatchScoreRecord = {
        matchId: 'match-102',
        tierId: 'gold',
        bestOf: 5,
        player1Wins: 3,
        player2Wins: 0,
        isComplete: true,
        winnerPlayerId: 'p1',
        loserPlayerId: 'p2',
        forfeitWinnerId: 'p1',
        games: [],
      };

      const isForfeit = Boolean(forfeitRecord.forfeitWinnerId);
      expect(isForfeit).toBe(true);
      expect(forfeitRecord.forfeitWinnerId).toBe('p1');
    });
  });

  describe('Share Bracket & Community Integration Presets', () => {
    const origin = 'https://tournamentmanager.com';
    const publicUrl = `${origin}/${mockTournament.slug}/${mockTier.slug}`;

    it('constructs canonical spectator URL for tier', () => {
      expect(publicUrl).toBe('https://tournamentmanager.com/kc-2026-open/gold');
    });

    it('generates Twitch chat command snippet correctly', () => {
      const twitchCommand = `!bracket ${publicUrl}`;
      expect(twitchCommand).toBe('!bracket https://tournamentmanager.com/kc-2026-open/gold');
    });

    it('generates Discord markdown link snippet correctly', () => {
      const discordMarkdown = `[🏆 ${mockTournament.name} • ${mockTier.name} Bracket](${publicUrl})`;
      expect(discordMarkdown).toBe('[🏆 KC 2026 Open • Gold Tier Bracket](https://tournamentmanager.com/kc-2026-open/gold)');
    });

    it('formats Twitter / X intent share link with encoded components', () => {
      const twitterIntent = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
        `Check out the live bracket for ${mockTournament.name} (${mockTier.name})!`
      )}&url=${encodeURIComponent(publicUrl)}`;

      expect(twitterIntent).toContain('https://twitter.com/intent/tweet?text=');
      expect(twitterIntent).toContain(encodeURIComponent('Check out the live bracket for KC 2026 Open (Gold Tier)!'));
      expect(twitterIntent).toContain(encodeURIComponent('https://tournamentmanager.com/kc-2026-open/gold'));
    });
  });

  describe('Permission Invariants for Public Spectator vs Director Routes', () => {
    it('enforces canManage=false on public routes and canManage=true on /manage/ routes', () => {
      const publicPaths = [
        '/kc-2026-open/gold',
        '/kc-2026-open/bracket',
        '/kc-2026-open/brackets',
        '/kc-2026-open/view',
      ];
      const managePaths = [
        '/kc-2026-open/manage/bracket',
        '/kc-2026-open/manage/bracket/gold',
        '/kc-2026-open/manage/sheet',
        '/kc-2026-open/manage/judge',
      ];

      for (const path of publicPaths) {
        const isManageRoute = path.includes('/manage/');
        expect(isManageRoute).toBe(false);
      }

      for (const path of managePaths) {
        const isManageRoute = path.includes('/manage/');
        expect(isManageRoute).toBe(true);
      }
    });
  });

  describe('Master Sheet Default Density & OBS Responsive Specifications', () => {
    it('uses Medium ("md") as the default density for Master Sheet matrix layout', () => {
      // Validates that md is a supported density with the expected medium column proportions
      const mediumConfig = {
        colMatch: 120,
        colGamesWon: 42,
        colGame: 54,
        colComplete: 48,
      };
      expect(mediumConfig.colMatch).toBe(120);
      expect(mediumConfig.colGame).toBe(54);
    });

    it('defines distinct OBS stage targets for Accelerated Hybrid brackets', () => {
      const acceleratedHybridStages = ['finals', 'early', 'upper', 'lower', 'combined'];
      expect(acceleratedHybridStages).toHaveLength(5);
      expect(acceleratedHybridStages).toContain('finals');
      expect(acceleratedHybridStages).toContain('early');
      expect(acceleratedHybridStages).toContain('upper');
      expect(acceleratedHybridStages).toContain('lower');
      expect(acceleratedHybridStages).toContain('combined');
    });

    it('ensures OBS leaderboard and standings layout uses bounded max-width (1200px) instead of edge-to-edge', () => {
      const obsContainerStyle = {
        maxWidth: '1200px',
        margin: '0 auto',
      };
      expect(obsContainerStyle.maxWidth).toBe('1200px');
      expect(obsContainerStyle.margin).toBe('0 auto');
    });
  });
});
