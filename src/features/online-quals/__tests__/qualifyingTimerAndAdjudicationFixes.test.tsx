import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CountdownTimerHud } from '../components/CountdownTimerHud';
import { SubmissionFormCard } from '../components/SubmissionFormCard';
import { TournamentQualTimerHud } from '../../qualifiers/components/TournamentQualTimerHud';
import { getPlayerQualifierStatus, deriveLeaderboard } from '../../qualifiers/scoring';
import { getQualTimerRemainingSeconds, formatTimerSeconds } from '../../tournament/qualTimer';
import { createEmptyTournament, createDefaultTier } from '../../tournament/defaults';
import type { Tournament, QualifierSubmission } from '../../tournament/types';

describe('Regression & Feature Tests: Qualifying Options, Pacing Timer & Adjudication Verification', () => {
  const baseTournament: Tournament = createEmptyTournament({
    id: 'timer-test-tourney',
    name: 'Timer Test Tournament',
    slug: 'timer-test',
    qualMode: 'HYBRID',
    qualWindowMinutes: 90,
    qualFormat: 'AVERAGE_OF_X',
    qualAverageCount: 2,
    qualTimer: {
      durationMinutes: 90,
      isRunning: true,
      elapsedSeconds: 600, // 10 minutes already accumulated
      lastResumedAt: Date.now() - 60 * 1000, // 1 minute in current run
    },
    playersPool: [
      { id: 'player-1', name: 'Alpha Runner', country: 'US', personalBest: 900000, playstyle: 'DAS' },
      { id: 'player-2', name: 'Beta Runner', country: 'JP', personalBest: 850000, playstyle: 'Rolling' },
    ],
    tiers: [
      createDefaultTier(1, { id: 'tier-1', name: 'Tier 1', slug: 'tier-1', playerCount: 8 }),
    ],
  });

  describe('1. Tournament-Wide Qual Timer HUD & Calculations', () => {
    it('accurately calculates remaining seconds for running and paused timers', () => {
      // 90 min (5400s) - (600s + ~60s) = ~4740s (1h 19m)
      const runningRemaining = getQualTimerRemainingSeconds(baseTournament.qualTimer!);
      expect(runningRemaining).toBeGreaterThanOrEqual(4735);
      expect(runningRemaining).toBeLessThanOrEqual(4745);

      expect(formatTimerSeconds(runningRemaining)).toMatch(/^01:19:[0-5][0-9]$/);

      // Paused timer (60 min duration, 1200s elapsed, paused)
      const pausedRemaining = getQualTimerRemainingSeconds({
        durationMinutes: 60,
        isRunning: false,
        elapsedSeconds: 1200,
        lastResumedAt: null,
      });
      expect(pausedRemaining).toBe(2400);
      expect(formatTimerSeconds(2400)).toBe('40:00');
    });

    it('renders TournamentQualTimerHud when qualifiers are active', () => {
      const html = renderToStaticMarkup(
        <TournamentQualTimerHud tournament={baseTournament} />
      );

      expect(html).toContain('Qual Time');
      expect(html).toContain('01:19:');
    });

    it('automatically returns null and hides when tournament brackets are locked into match mode', () => {
      const lockedTourney: Tournament = {
        ...baseTournament,
        isLocked: true,
      };

      const html = renderToStaticMarkup(
        <TournamentQualTimerHud tournament={lockedTourney} />
      );

      expect(html).toBe('');
    });

    it('automatically returns null when quals are closed', () => {
      const closedTourney: Tournament = {
        ...baseTournament,
        qualsClosed: true,
      };

      const html = renderToStaticMarkup(
        <TournamentQualTimerHud tournament={closedTourney} />
      );

      expect(html).toBe('');
    });
  });

  describe('2. Competitor Pacing Timer (CountdownTimerHud)', () => {
    it('does NOT start automatically, displays Start Timer button and Optional badge', () => {
      const html = renderToStaticMarkup(
        <CountdownTimerHud qualWindowMinutes={90} isCompleted={false} />
      );

      expect(html).toContain('Optional Pacing Timer');
      expect(html).toContain('Start Timer');
      expect(html).toContain('Reset');
      expect(html).toContain('Official Window:');
      expect(html).toContain('90 minutes');
      expect(html).toContain('01:30:00');
    });

    it('renders edit time duration button when not completed', () => {
      const html = renderToStaticMarkup(
        <CountdownTimerHud qualWindowMinutes={45} isCompleted={false} />
      );

      expect(html).toContain('45 minutes');
      expect(html).toContain('Edit');
    });
  });

  describe('3. Deterministic AVERAGE_OF_X Submission Fields', () => {
    it('automatically renders exactly X score fields and hides Add Qualifier button', () => {
      const html = renderToStaticMarkup(
        <SubmissionFormCard
          qualFormat="AVERAGE_OF_X"
          qualAverageCount={3}
          scores={[600000, 700000]}
          onScoresChange={vi.fn()}
          twitchVodUrl="https://twitch.tv/videos/12345"
          onTwitchVodUrlChange={vi.fn()}
          onSubmit={vi.fn()}
        />
      );

      expect(html).toContain('Top 3 Game Scores (Average of 3)');
      expect(html).toContain('Game 1:');
      expect(html).toContain('Game 2:');
      expect(html).toContain('Game 3:');
      expect(html).not.toContain('Add Another Attempt');
      expect(html).not.toContain('title="Remove attempt"');
    });

    it('renders Add Attempt button for non-average formats like HIGH_SCORE', () => {
      const html = renderToStaticMarkup(
        <SubmissionFormCard
          qualFormat="HIGH_SCORE"
          scores={[600000]}
          onScoresChange={vi.fn()}
          twitchVodUrl="https://twitch.tv/videos/12345"
          onTwitchVodUrlChange={vi.fn()}
          onSubmit={vi.fn()}
        />
      );

      expect(html).toContain('Add Another Attempt');
    });
  });

  describe('4. Adjudication Verification Structural Fix', () => {
    it('correctly transitions player status from "awaiting verification" to "verified" when submissions are marked VERIFIED', () => {
      const unverifiedSubmission1: QualifierSubmission = {
        id: 'sub-alpha-1',
        tournamentId: baseTournament.id,
        playerId: 'player-1',
        score: 750000,
        submissionSource: 'ONLINE',
        status: 'SUBMITTED',
        submittedAt: Date.now() - 5000,
      };
      const unverifiedSubmission2: QualifierSubmission = {
        id: 'sub-alpha-2',
        tournamentId: baseTournament.id,
        playerId: 'player-1',
        score: 850000,
        submissionSource: 'ONLINE',
        status: 'SUBMITTED',
        submittedAt: Date.now() - 2000,
      };

      const tourneyWithPending: Tournament = {
        ...baseTournament,
        qualifierSubmissions: [unverifiedSubmission1, unverifiedSubmission2],
        tournamentPlayers: {
          'player-1': {
            playerId: 'player-1',
            tournamentId: baseTournament.id,
            isVerified: false,
            qualsCompleted: false,
          },
        },
      };

      // Before judge verification: status must be 'awaiting verification'
      expect(getPlayerQualifierStatus(tourneyWithPending, 'player-1')).toBe('awaiting verification');

      // Emulate togglePlayerQualifierVerified fix: flips both tournamentPlayer and qualifierSubmissions
      const verifiedSubmissions: QualifierSubmission[] = [
        {
          ...unverifiedSubmission1,
          status: 'VERIFIED',
          verifiedAt: Date.now(),
          verifiedBy: 'Judge',
        },
        {
          ...unverifiedSubmission2,
          status: 'VERIFIED',
          verifiedAt: Date.now(),
          verifiedBy: 'Judge',
        },
      ];

      const tourneyVerified: Tournament = {
        ...tourneyWithPending,
        qualifierSubmissions: verifiedSubmissions,
        tournamentPlayers: {
          'player-1': {
            playerId: 'player-1',
            tournamentId: baseTournament.id,
            isVerified: true,
            qualsCompleted: true,
          },
        },
      };

      // After judge verification: status must be 'verified'
      expect(getPlayerQualifierStatus(tourneyVerified, 'player-1')).toBe('verified');

      // Verified player must now have official non-provisional ranking on leaderboard
      // For Average of 2: (750,000 + 850,000) / 2 = 800,000
      const leaderboard = deriveLeaderboard(tourneyVerified);
      const playerRankRow = leaderboard.find(r => r.player.id === 'player-1');
      expect(playerRankRow).toBeDefined();
      expect(playerRankRow?.rank).toBe(1);
      expect(playerRankRow?.finalScore).toBe(800000);
    });
  });

  describe('5. Defensive Leaderboard & State Resilience against Stale Client Data (Wipe Bug Regression)', () => {
    it('defensively includes online competitors in leaderboard even if missing from tournament.playersPool', () => {
      // Simulate an online submission from "Omenvoir" who is in qualifierSubmissions
      // but not yet present in a stale client's playersPool
      const omenvoirSubmission: QualifierSubmission = {
        id: 'sub-omenvoir-1',
        tournamentId: baseTournament.id,
        playerId: 'player-omenvoir',
        score: 950000,
        submissionSource: 'ONLINE',
        status: 'SUBMITTED',
        submittedAt: Date.now(),
        submittedTwitchUsername: 'Omenvoir',
      };

      // Notice playersPool only has player-1 and player-2, NOT player-omenvoir
      const tourneyWithStalePool: Tournament = {
        ...baseTournament,
        playersPool: [
          { id: 'player-1', name: 'Alpha Runner', personalBest: 900000, country: 'US', playstyle: 'DAS' },
          { id: 'player-2', name: 'Beta Runner', personalBest: 850000, country: 'JP', playstyle: 'Rolling' },
        ],
        qualifierSubmissions: [omenvoirSubmission],
      };

      const leaderboard = deriveLeaderboard(tourneyWithStalePool);
      const omenRow = leaderboard.find(r => r.player.id === 'player-omenvoir');

      expect(omenRow).toBeDefined();
      expect(omenRow?.player.name).toBe('Omenvoir');
      expect(omenRow?.peakScore).toBe(950000);
    });

    it('preserves online qualifier presence on leaderboard when tournament settings or timers are toggled', () => {
      const omenvoirSubmission: QualifierSubmission = {
        id: 'sub-omenvoir-1',
        tournamentId: baseTournament.id,
        playerId: 'player-omenvoir',
        score: 950000,
        submissionSource: 'ONLINE',
        status: 'VERIFIED',
        submittedAt: Date.now(),
      };

      const tourneyBeforeTimerToggle: Tournament = {
        ...baseTournament,
        playersPool: [
          { id: 'player-omenvoir', name: 'Omenvoir', personalBest: 950000, country: 'US', playstyle: 'DAS' },
        ],
        qualifierSubmissions: [omenvoirSubmission],
        qualTimer: {
          durationMinutes: 90,
          isRunning: true,
          elapsedSeconds: 300,
          lastResumedAt: Date.now(),
        },
      };

      // Simulate admin pausing the qual timer
      const tourneyAfterTimerPause: Tournament = {
        ...tourneyBeforeTimerToggle,
        qualTimer: {
          ...tourneyBeforeTimerToggle.qualTimer!,
          isRunning: false,
          elapsedSeconds: 350,
          lastResumedAt: null,
        },
      };

      const leaderboard = deriveLeaderboard(tourneyAfterTimerPause);
      const omenRow = leaderboard.find(r => r.player.name === 'Omenvoir');

      expect(omenRow).toBeDefined();
      expect(omenRow?.rank).toBe(1);
      expect(omenRow?.peakScore).toBe(950000);
      expect(omenRow?.finalScore).toBe(950000);
    });
  });
});

