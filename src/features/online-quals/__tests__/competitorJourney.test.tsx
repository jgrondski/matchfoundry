import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { PublicQualifyPage } from '../../../routes/PublicQualifyPage';
import { CompetitorPortalView } from '../components/CompetitorPortalView';
import { PreFlightModal } from '../components/PreFlightModal';
import { IdentityClaimModal } from '../components/IdentityClaimModal';
import { AuthwordHudCard } from '../components/AuthwordHudCard';
import { CountdownTimerHud } from '../components/CountdownTimerHud';
import { SubmissionFormCard } from '../components/SubmissionFormCard';
import { AwaitingVerificationCard } from '../components/AwaitingVerificationCard';
import { TournamentProvider } from '../../tournament/store';
import { OrganizationProvider } from '../../organizations/store';
import { AuthProvider } from '../../auth/AuthContext';
import { createEmptyTournament, createDefaultTier } from '../../tournament/defaults';
import type { Tournament, QualTimerLog } from '../../tournament/types';
import type { OnlineQualSessionSummary } from '../../../api/qualifiers';

describe('Journey 1: Online Competitor Qualification Flow (ATDD)', () => {
  const sampleTournament: Tournament = createEmptyTournament({
    id: 'omen-das-tourney',
    name: 'Omen DAS Championship 2026',
    slug: 'omen-das',
    qualMode: 'HYBRID',
    qualWindowMinutes: 90,
    qualFormat: 'AVERAGE_OF_X',
    qualAverageCount: 2,
    customAuthWords: ['OMENDAS', 'ROCKET'],
    playersPool: [
      {
        id: 'p-1',
        name: 'Sharky DAS',
        country: 'US',
        personalBest: 950000,
        playstyle: 'DAS',
        avatarType: 'flag',
        twitchId: 'tw_sharkydas',
      },
      {
        id: 'p-2',
        name: 'UnlinkedRosterPlayer',
        country: 'CA',
        personalBest: 800000,
        playstyle: 'DAS',
        avatarType: 'flag',
      },
    ],
    tiers: [
      createDefaultTier(1, {
        id: 'tier-gold',
        name: 'Gold Championship',
        slug: 'gold',
        playerCount: 16,
      }),
    ],
  });

  describe('1. Route Gate & Hydration Boundary (PublicQualifyPage)', () => {
    it('renders loading screen when store is not hydrated', () => {
      const html = renderToStaticMarkup(
        <MemoryRouter initialEntries={['/omen-das/qualify']}>
          <AuthProvider>
            <OrganizationProvider initialHydrated={false}>
              <TournamentProvider initialTournaments={[sampleTournament]} initialHydrated={false}>
                <Routes>
                  <Route path="/:slug/qualify" element={<PublicQualifyPage />} />
                </Routes>
              </TournamentProvider>
            </OrganizationProvider>
          </AuthProvider>
        </MemoryRouter>
      );

      expect(html).toContain('Loading qualification portal...');
      expect(html).not.toContain('Connect with Twitch to Begin');
    });

    it('renders 404 screen when tournament slug does not exist', () => {
      const html = renderToStaticMarkup(
        <MemoryRouter initialEntries={['/non-existent-tourney/qualify']}>
          <AuthProvider>
            <OrganizationProvider initialHydrated={true}>
              <TournamentProvider initialTournaments={[sampleTournament]} initialHydrated={true}>
                <Routes>
                  <Route path="/:slug/qualify" element={<PublicQualifyPage />} />
                </Routes>
              </TournamentProvider>
            </OrganizationProvider>
          </AuthProvider>
        </MemoryRouter>
      );

      expect(html).toContain('Tournament Not Found');
      expect(html).toContain('Back to Tournaments');
    });

    it('renders CompetitorPortalView cleanly when hydrated', () => {
      const html = renderToStaticMarkup(
        <MemoryRouter initialEntries={['/omen-das/qualify']}>
          <AuthProvider>
            <OrganizationProvider initialHydrated={true}>
              <TournamentProvider initialTournaments={[sampleTournament]} initialHydrated={true}>
                <Routes>
                  <Route path="/:slug/qualify" element={<PublicQualifyPage />} />
                </Routes>
              </TournamentProvider>
            </OrganizationProvider>
          </AuthProvider>
        </MemoryRouter>
      );

      expect(html).toContain('Omen DAS Championship 2026');
      expect(html).toContain('Competitor Qualification Check-In');
      expect(html).toContain('Window: 90 min');
      expect(html).toContain('HYBRID Qualifiers');
    });
  });

  describe('2. Streamlined Competitor Intake Check-In (No OAuth Required)', () => {
    it('renders competitor check-in form with Player Name and Twitch Handle inputs', () => {
      const html = renderToStaticMarkup(
        <MemoryRouter>
          <CompetitorPortalView tournament={sampleTournament} />
        </MemoryRouter>
      );

      expect(html).toContain('Competitor Qualification Check-In');
      expect(html).toContain('Player Name / Alias *');
      expect(html).toContain('Twitch Channel / Handle *');
      expect(html).toContain('Review Rules &amp; Checklist');
    });
  });

  describe('3. Identity Resolution & Claim Modal (Buckets 2 & 3)', () => {
    const mockTwitchUser = {
      id: 'tw_unlinked_competitor',
      login: 'unlinked_competitor',
      displayName: 'UnlinkedCompetitor',
      profileImageUrl: 'https://example.com/avatar.png',
    };

    const unclaimedRoster = [
      { id: 'p-2', name: 'UnlinkedRosterPlayer', country: 'CA', playstyle: 'DAS' },
    ];

    it('renders IdentityClaimModal with both Roster Claim and Walk-in tabs', () => {
      const html = renderToStaticMarkup(
        <IdentityClaimModal
          isOpen={true}
          unclaimedPlayers={unclaimedRoster}
          twitchUser={mockTwitchUser}
          onClaimRoster={vi.fn()}
          onRegisterNew={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      expect(html).toContain('Competitor Identity Resolution');
      expect(html).toContain('Connected as:');
      expect(html).toContain('UnlinkedCompetitor');
      expect(html).toContain('Claim Existing Roster (1)');
      expect(html).toContain('Register as Walk-In');
      expect(html).toContain('UnlinkedRosterPlayer [CA] (DAS)');
      expect(html).toContain('Claim Profile &amp; Proceed');
    });
  });

  describe('4. Pre-Flight Rules Briefing & Checklist Modal', () => {
    it('renders all 4 mandatory checklist items and rules summary', () => {
      const html = renderToStaticMarkup(
        <PreFlightModal
          isOpen={true}
          tournamentName="Omen DAS Championship 2026"
          qualWindowMinutes={90}
          qualFormat="AVERAGE_OF_X"
          qualAverageCount={2}
          twitchUsername="sharky_das"
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      expect(html).toContain('Pre-Flight Rules &amp; Checklist');
      expect(html).toContain('Average of top 2 games');
      expect(html).toContain('twitch.tv/sharky_das');
      expect(html).toContain('Store past broadcasts');
      expect(html).toContain('NES Authword proof rule');
      expect(html).toContain('90-minute window');
      expect(html).toContain('Confirm &amp; Begin Official Run');
    });
  });

  describe('5. Active Official Run HUD & Non-Blocking Countdown Timer', () => {
    const mockTimerLog: QualTimerLog = {
      startedAt: Date.now() - 30 * 60 * 1000, // 30 minutes elapsed
      elapsedSeconds: 30 * 60,
      pauses: [],
      overTime: false,
    };

    it('renders assigned NES Authword in bold high-contrast card', () => {
      const html = renderToStaticMarkup(
        <AuthwordHudCard authWord="ROCKET" onReportCrash={vi.fn()} />
      );

      expect(html).toContain('Official Verification Authword');
      expect(html).toContain('ROCKET');
      expect(html).toContain('Copy Authword');
      expect(html).toContain('Report Stream Crash / Reset');
      expect(html).toContain('NES Authword Proof Rule');
    });

    it('renders live countdown timer telemetry', () => {
      const html = renderToStaticMarkup(
        <CountdownTimerHud timerLog={mockTimerLog} qualWindowMinutes={90} isCompleted={false} />
      );

      expect(html).toContain('Time Remaining');
      expect(html).toContain('Official Window:');
      expect(html).toContain('90 minutes');
      expect(html).toContain('Elapsed:');
    });

    it('renders non-blocking alert banner when session is over-time', () => {
      const overTimeLog: QualTimerLog = {
        startedAt: Date.now() - 95 * 60 * 1000, // 95 minutes elapsed
        elapsedSeconds: 95 * 60,
        pauses: [],
        overTime: true,
      };

      const html = renderToStaticMarkup(
        <CountdownTimerHud timerLog={overTimeLog} qualWindowMinutes={90} isCompleted={false} />
      );

      expect(html).toContain('Official Window Expired');
      expect(html).toContain('Over-time telemetry is recorded for judges');
    });
  });

  describe('6. Score & Twitch VOD Submission Form', () => {
    it('renders game score inputs and Twitch VOD link input for AVERAGE_OF_X', () => {
      const html = renderToStaticMarkup(
        <SubmissionFormCard
          qualFormat="AVERAGE_OF_X"
          qualAverageCount={2}
          scores={[684200, 721450]}
          onScoresChange={vi.fn()}
          twitchVodUrl="https://twitch.tv/videos/2481093821?t=00h14m20s"
          onTwitchVodUrlChange={vi.fn()}
          onSubmit={vi.fn()}
        />
      );

      expect(html).toContain('Official Score Submission');
      expect(html).toContain('Top 2 Game Scores (Average of 2)');
      expect(html).toContain('Game 1:');
      expect(html).toContain('684,200');
      expect(html).toContain('Game 2:');
      expect(html).toContain('721,450');
      expect(html).toContain('Twitch Broadcast VOD URL *');
      expect(html).toContain('Submit Official Qual');
    });
  });

  describe('7. Awaiting Verification Lock Card ("I\'m Done" State)', () => {
    const mockCompletedSession: OnlineQualSessionSummary = {
      tournamentId: 'omen-das-tourney',
      playerId: 'p-1',
      status: 'SUBMITTED',
      authWord: 'ROCKET',
      twitchVodUrl: 'https://twitch.tv/videos/2481093821?t=00h14m20s',
      submittedTwitchId: 'tw_sharkydas',
      submittedTwitchUsername: 'sharkydas',
      identityStatus: 'VERIFIED_MATCH',
      timerLog: {
        startedAt: 1000000,
        submittedAt: 1000000 + 72 * 60 * 1000,
        elapsedSeconds: 72 * 60,
        pauses: [],
        overTime: false,
      },
      scores: [684200, 721450],
      judgeNotes: null,
      submissionIds: ['sub-1', 'sub-2'],
    };

    it('renders locked status with provisional placement pill and leaderboard link', () => {
      const html = renderToStaticMarkup(
        <MemoryRouter>
          <AwaitingVerificationCard session={mockCompletedSession} tournamentSlug="omen-das" />
        </MemoryRouter>
      );

      expect(html).toContain('Official Qual Submitted!');
      expect(html).toContain('Provisional Placement:');
      expect(html).toContain('⏳ Awaiting Verification');
      expect(html).toContain('ROCKET');
      expect(html).toContain('684,200, 721,450');
      expect(html).toContain('https://twitch.tv/videos/2481093821?t=00h14m20s');
      expect(html).toContain('View Live Leaderboard');
    });
  });
});
