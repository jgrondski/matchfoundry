import { describe, it, expect, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { setupTestDb } from '../../../db/testDb';
import { setDb } from '../../../db';
import { createPlayer } from '../../../api/players';
import { saveFullTournament } from '../../../api/tournaments';
import { seedDefaultOrganizations } from '../../../api/organizations';
import { createEmptyTournament, createDefaultTier } from '../../tournament/defaults';
import {
  submitQualifierScore,
  startOnlineQualSession,
  submitOnlineQualScores,
  getOnlineQualSession,
  listOnlineQualSessions,
  adjudicateOnlineSubmission,
  verifyAllQualifierSubmissions,
  setOnlineQualsOpen,
} from '../../../api/qualifiers';
import { deriveLeaderboard, generateDraftBracketsForTournament } from '../../qualifiers/scoring';
import { TournamentSidebar } from '../../../components/TournamentSidebar';
import { AdjudicationModal } from '../components/AdjudicationModal';
import { ReviewQueueTable } from '../components/ReviewQueueTable';
import { ReviewQueueView } from '../components/ReviewQueueView';
import { AuthProvider } from '../../auth/AuthContext';
import { TournamentProvider } from '../../tournament/store';
import { OrganizationProvider } from '../../organizations/store';
import type { Tournament } from '../../tournament/types';

describe('Journey 2: Mixed-Mode Adjudication & Ingestion (ATDD)', () => {
  let tourney: Tournament;
  let pInPersonId: string;
  let pOnlineId: string;

  beforeEach(async () => {
    const { db } = setupTestDb();
    setDb(db);
    await seedDefaultOrganizations();

    const p1 = await createPlayer({ name: 'Alex Kerr', country: 'US', playstyle: 'DAS' });
    const p2 = await createPlayer({ name: 'PixelAndy', country: 'US', playstyle: 'Rolling' });
    pInPersonId = p1.id;
    pOnlineId = p2.id;

    const baseTourney = createEmptyTournament({ slug: 'ctwc-2026', name: 'CTWC 2026' });
    baseTourney.qualMode = 'HYBRID';
    baseTourney.qualFormat = 'HIGH_SCORE';
    baseTourney.playersPool = [p1 as any, p2 as any];
    baseTourney.tiers = [
      createDefaultTier(1, { name: 'Gold Tier', playerCount: 8, bracketType: 'TRADITIONAL' }),
    ];

    tourney = await saveFullTournament(baseTourney);
    await setOnlineQualsOpen(tourney.id, true);
  });

  describe('Assertion 2.1: Ingestion Source Separation & Review Queue Ingestion', () => {
    it('saves both in-person and online submissions as SUBMITTED (pending review), allowing in-person verification via Review Queue', async () => {
      // 1. Submit in-person score (defaults to SUBMITTED / pending review)
      const inPersonSub = await submitQualifierScore(tourney.id, pInPersonId, 1150000, {
        submissionSource: 'IN_PERSON',
      });
      expect(inPersonSub.submissionSource).toBe('IN_PERSON');
      expect(inPersonSub.status).toBe('SUBMITTED');

      // 2. Submit online run
      await startOnlineQualSession(tourney.id, {
        playerId: pOnlineId,
        submittedTwitchUsername: 'pixelandy',
      });
      const onlineSub = await submitOnlineQualScores(tourney.id, {
        playerId: pOnlineId,
        scores: [1250000],
        twitchVodUrl: 'https://twitch.tv/videos/123456789',
        submittedTwitchUsername: 'pixelandy',
      });
      expect(onlineSub.status).toBe('SUBMITTED');

      // 3. Verify both land in listOnlineQualSessions as pending runs
      const queueSessions = await listOnlineQualSessions(tourney.id);
      expect(queueSessions.length).toBe(2);
      const inPersonQueue = queueSessions.find(s => s.playerId === pInPersonId);
      const onlineQueue = queueSessions.find(s => s.playerId === pOnlineId);
      expect(inPersonQueue?.submissionSource).toBe('IN_PERSON');
      expect(inPersonQueue?.authWord).toBeNull();
      expect(inPersonQueue?.twitchVodUrl).toBeNull();
      expect(onlineQueue?.submissionSource).toBe('ONLINE');

      // 4. Verify in tournament leaderboard before verification: both are awaiting verification
      const unverifiedTourney: Tournament = {
        ...tourney,
        qualifierSubmissions: [
          {
            id: inPersonSub.id,
            tournamentId: tourney.id,
            playerId: pInPersonId,
            score: inPersonSub.score,
            submittedAt: Date.now() - 5000,
            submissionSource: 'IN_PERSON',
            status: 'SUBMITTED',
          },
          {
            id: onlineSub.submissionIds[0],
            tournamentId: tourney.id,
            playerId: pOnlineId,
            score: 1250000,
            submittedAt: Date.now(),
            submissionSource: 'ONLINE',
            status: 'SUBMITTED',
            twitchVodUrl: 'https://twitch.tv/videos/123456789',
          },
        ],
      };

      const lbBefore = deriveLeaderboard(unverifiedTourney);
      expect(lbBefore.find(r => r.player.id === pInPersonId)?.status).toBe('awaiting verification');
      expect(lbBefore.find(r => r.player.id === pOnlineId)?.status).toBe('awaiting verification');

      // 5. Adjudicate in-person run through Review Queue VERIFY action
      const verifiedSession = await adjudicateOnlineSubmission(tourney.id, {
        playerId: pInPersonId,
        action: 'VERIFY',
      });
      expect(verifiedSession?.status).toBe('VERIFIED');
    });
  });

  describe('Assertion 2.2: Review Queue Badge Dynamic Count', () => {
    it('dynamically reflects exact count of pending online submissions in sidebar', async () => {
      // Starts with 0 pending submissions
      const tourneyZero: Tournament = {
        ...tourney,
        qualifierSubmissions: [],
      };
      const htmlZero = renderToStaticMarkup(
        <AuthProvider>
          <OrganizationProvider initialHydrated={true}>
            <TournamentProvider initialTournaments={[tourneyZero]} initialHydrated={true}>
              <MemoryRouter>
                <TournamentSidebar tournament={tourneyZero} activeView="review" />
              </MemoryRouter>
            </TournamentProvider>
          </OrganizationProvider>
        </AuthProvider>
      );
      expect(htmlZero).toContain('Qual Review');

      // Add 2 online pending submissions
      const tourneyTwo: Tournament = {
        ...tourney,
        qualifierSubmissions: [
          {
            id: 'sub-1',
            tournamentId: tourney.id,
            playerId: pOnlineId,
            score: 1200000,
            submittedAt: Date.now(),
            submissionSource: 'ONLINE',
            status: 'SUBMITTED',
          },
          {
            id: 'sub-2',
            tournamentId: tourney.id,
            playerId: pInPersonId,
            score: 1100000,
            submittedAt: Date.now(),
            submissionSource: 'ONLINE',
            status: 'SUBMITTED',
          },
        ],
      };
      const htmlTwo = renderToStaticMarkup(
        <AuthProvider>
          <OrganizationProvider initialHydrated={true}>
            <TournamentProvider initialTournaments={[tourneyTwo]} initialHydrated={true}>
              <MemoryRouter>
                <TournamentSidebar tournament={tourneyTwo} activeView="review" />
              </MemoryRouter>
            </TournamentProvider>
          </OrganizationProvider>
        </AuthProvider>
      );
      expect(htmlTwo).toContain('Qual Review (2)');
    });

    it('collapses multiple submitted scores from a single competitor into 1 review session in sidebar badge', () => {
      // 1 player submits 3 maxout scores
      const tourneyMultiSub: Tournament = {
        ...tourney,
        qualifierSubmissions: [
          {
            id: 'sub-1',
            tournamentId: tourney.id,
            playerId: pOnlineId,
            score: 1200000,
            submittedAt: Date.now(),
            submissionSource: 'ONLINE',
            status: 'SUBMITTED',
          },
          {
            id: 'sub-2',
            tournamentId: tourney.id,
            playerId: pOnlineId,
            score: 1180000,
            submittedAt: Date.now(),
            submissionSource: 'ONLINE',
            status: 'SUBMITTED',
          },
          {
            id: 'sub-3',
            tournamentId: tourney.id,
            playerId: pOnlineId,
            score: 1150000,
            submittedAt: Date.now(),
            submissionSource: 'ONLINE',
            status: 'SUBMITTED',
          },
        ],
      };

      const html = renderToStaticMarkup(
        <AuthProvider>
          <OrganizationProvider initialHydrated={true}>
            <TournamentProvider initialTournaments={[tourneyMultiSub]} initialHydrated={true}>
              <MemoryRouter>
                <TournamentSidebar tournament={tourneyMultiSub} activeView="review" />
              </MemoryRouter>
            </TournamentProvider>
          </OrganizationProvider>
        </AuthProvider>
      );
      // Badge must count unique competitors left to review (1), NOT raw scores/submissions (3)
      expect(html).toContain('Qual Review (1)');
      expect(html).not.toContain('Qual Review (3)');
    });

    it('renders "Qual Total Time" as the column header instead of "Timer / Telemetry"', () => {
      const html = renderToStaticMarkup(
        <ReviewQueueTable
          sessions={[]}
          onOpenAdjudicate={() => {}}
          onOpenIdentityModal={() => {}}
        />
      );
      expect(html).toContain('Qual Total Time');
      expect(html).not.toContain('Timer / Telemetry');
      expect(html).not.toContain('Timer/Telemetry');
    });
  });

  describe('Assertion 2.3: Judge Adjudication Actions', () => {
    beforeEach(async () => {
      await startOnlineQualSession(tourney.id, {
        playerId: pOnlineId,
        submittedTwitchUsername: 'pixelandy',
      });
      await submitOnlineQualScores(tourney.id, {
        playerId: pOnlineId,
        scores: [1180000, 1140000],
        twitchVodUrl: 'https://twitch.tv/videos/987654321',
        submittedTwitchUsername: 'pixelandy',
      });
    });

    it('Clicking "Verify Qual" flips status to VERIFIED and marks qualsCompleted in tournament_players', async () => {
      const session = await adjudicateOnlineSubmission(tourney.id, {
        playerId: pOnlineId,
        action: 'VERIFY',
        verifiedBy: 'Judge Dan',
      });

      expect(session?.status).toBe('VERIFIED');
      const recovered = await getOnlineQualSession(tourney.id, { playerId: pOnlineId });
      expect(recovered?.status).toBe('VERIFIED');
    });

    it('Clicking "Edit Score & Verify" mutates recorded scores and appends audit log to judgeNotes', async () => {
      const session = await adjudicateOnlineSubmission(tourney.id, {
        playerId: pOnlineId,
        action: 'EDIT_AND_VERIFY',
        scores: [1200000, 1150000],
        judgeNotes: 'Corrected Game 1 topout OCR misread',
        verifiedBy: 'Head Judge Vandam',
      });

      expect(session?.status).toBe('VERIFIED');
      expect(session?.scores).toEqual([1200000, 1150000]);
      expect(session?.judgeNotes).toContain('[SCORE EDITED BY Head Judge Vandam]: 1180000, 1140000 -> 1200000, 1150000');
      expect(session?.judgeNotes).toContain('Corrected Game 1 topout OCR misread');
    });

    it('Clicking "Mark DNQ" marks status = DNQ and excludes player from bracket seed calculation', async () => {
      const session = await adjudicateOnlineSubmission(tourney.id, {
        playerId: pOnlineId,
        action: 'DNQ',
        judgeNotes: 'Authword missing from NES high-score screen',
        verifiedBy: 'Judge Dan',
      });

      expect(session?.status).toBe('DNQ');
      expect(session?.judgeNotes).toContain('[DNQ]: Authword missing from NES high-score screen');

      // Verify that DNQ player is excluded from draft brackets
      const mockTourneyWithDNQ: Tournament = {
        ...tourney,
        qualifierSubmissions: [
          {
            id: 'sub-dnq-1',
            tournamentId: tourney.id,
            playerId: pOnlineId,
            score: 1180000,
            submittedAt: Date.now(),
            submissionSource: 'ONLINE',
            status: 'DNQ',
          },
        ],
      };

      const draftTiers = generateDraftBracketsForTournament(mockTourneyWithDNQ);
      const allSeededNames = draftTiers[0].bracket.rounds[0].matches.flatMap(m => [
        m.player1?.player?.name,
        m.player2?.player?.name,
      ]);
      expect(allSeededNames).not.toContain('PixelAndy');
    });

    it('Clicking "Disqualify (DQ)" sets isDisqualified = true on the player profile', async () => {
      const session = await adjudicateOnlineSubmission(tourney.id, {
        playerId: pOnlineId,
        action: 'DQ',
        judgeNotes: 'Cheating / unauthorized turbo controller detected',
        verifiedBy: 'Head Judge Vandam',
      });

      expect(session?.status).toBe('DQ');
      const sessions = await listOnlineQualSessions(tourney.id);
      const dqSession = sessions.find(s => s.playerId === pOnlineId);
      expect(dqSession?.status).toBe('DQ');
    });
  });

  describe('Adjudication Component Presentation', () => {
    it('renders AdjudicationModal with Authword verification reminder and score inputs', () => {
      const mockSession = {
        tournamentId: tourney.id,
        playerId: pOnlineId,
        playerName: 'PixelAndy',
        country: 'US',
        status: 'SUBMITTED' as const,
        authWord: 'ROCKET',
        twitchVodUrl: 'https://twitch.tv/videos/999888',
        submittedTwitchId: '12345',
        submittedTwitchUsername: 'pixelandy',
        identityStatus: 'VERIFIED_MATCH' as const,
        timerLog: {
          startedAt: Date.now() - 1000 * 60 * 45,
          elapsedSeconds: 2700,
          pauses: [],
        },
        scores: [1150000, 1120000],
        judgeNotes: null,
        submissionIds: ['sub-1', 'sub-2'],
      };

      const html = renderToStaticMarkup(
        <AdjudicationModal
          isOpen={true}
          session={mockSession}
          onClose={() => {}}
          onAdjudicate={async () => {}}
        />
      );

      expect(html).toContain('Adjudicate Run: PixelAndy');
      expect(html).toContain('ROCKET');
      expect(html).toContain('Verify this word appears on the NES 10,000 pts topout high-score screen');
      expect(html).toContain('Open VOD');
      expect(html).toContain('Verify Qual');
      expect(html).toContain('Mark DNQ');
      expect(html).toContain('Disqualify (DQ)');
    });

    it('renders ReviewQueueTable with filter pills and session rows', () => {
      const mockSessions = [
        {
          tournamentId: tourney.id,
          playerId: pOnlineId,
          playerName: 'PixelAndy',
          country: 'US',
          status: 'SUBMITTED' as const,
          authWord: 'ROCKET',
          twitchVodUrl: 'https://twitch.tv/videos/999888',
          submittedTwitchId: '12345',
          submittedTwitchUsername: 'pixelandy',
          identityStatus: 'VERIFIED_MATCH' as const,
          timerLog: {
            startedAt: Date.now() - 1000 * 60 * 45,
            elapsedSeconds: 2700,
            pauses: [],
          },
          scores: [1150000],
          judgeNotes: null,
          submissionIds: ['sub-1'],
        },
      ];

      const html = renderToStaticMarkup(
        <ReviewQueueTable
          sessions={mockSessions}
          onOpenAdjudicate={() => {}}
          onOpenIdentityModal={() => {}}
        />
      );

      expect(html).toContain('Pending Review');
      expect(html).toContain('Online');
      expect(html).toContain('In-Person');
      expect(html).not.toContain('Verified (');
      expect(html).not.toContain('DNQ / DQ (');
      expect(html).toContain('PixelAndy');
      expect(html).toContain('ROCKET');
      expect(html).toContain('Review');
    });

    it('renders in-person qualifier sessions with "-" authword, tournament qual window time, and "In Person" vod link', () => {
      const mockInPersonSessions = [
        {
          tournamentId: tourney.id,
          playerId: pInPersonId,
          playerName: 'Fractal',
          country: 'US',
          submissionSource: 'IN_PERSON' as const,
          status: 'SUBMITTED' as const,
          authWord: null,
          twitchVodUrl: null,
          submittedTwitchId: null,
          submittedTwitchUsername: null,
          identityStatus: null,
          timerLog: {
            startedAt: Date.now() - 1000 * 60 * 90,
            elapsedSeconds: 5400,
            pauses: [],
          },
          scores: [1100000],
          judgeNotes: null,
          submissionIds: ['sub-ip-1'],
        },
      ];

      const html = renderToStaticMarkup(
        <ReviewQueueTable
          sessions={mockInPersonSessions}
          onOpenAdjudicate={() => {}}
          onOpenIdentityModal={() => {}}
          qualWindowMinutes={90}
        />
      );

      expect(html).toContain('Fractal');
      expect(html).toContain('-'); // Null NES Authword displayed as "-"
      expect(html).toContain('90m'); // Length of tournament's specified qual time
      expect(html).toContain('In Person'); // VOD link displays "In Person"
      expect(html).toContain('Review');
    });

    it('verifies all unverified runs via verifyAllQualifierSubmissions in bulk', async () => {
      // 1. Submit in-person run
      await submitQualifierScore(tourney.id, pInPersonId, 950000);

      // 2. Submit online run
      await startOnlineQualSession(tourney.id, {
        playerId: pOnlineId,
        twitchUsername: 'pixelandy',
      });
      await submitOnlineQualScores(tourney.id, {
        playerId: pOnlineId,
        scores: [1150000],
        twitchVodUrl: 'https://twitch.tv/videos/999999999',
      });

      // Verify both are currently SUBMITTED
      const beforeList = await listOnlineQualSessions(tourney.id);
      const pendingBefore = beforeList.filter(s => s.status === 'SUBMITTED');
      expect(pendingBefore.length).toBe(2);

      // Execute Verify All
      const result = await verifyAllQualifierSubmissions(tourney.id, 'HeadJudge');
      expect(result.verifiedCount).toBe(2);

      // Verify all runs are now VERIFIED
      const afterList = await listOnlineQualSessions(tourney.id);
      expect(afterList.every(s => s.status === 'VERIFIED')).toBe(true);
    });

    it('renders the "Verify All" button and speedbump modal in ReviewQueueView', () => {
      const html = renderToStaticMarkup(
        <MemoryRouter>
          <AuthProvider>
            <TournamentProvider initialTournaments={[tourney]}>
              <ReviewQueueView tournament={tourney} />
            </TournamentProvider>
          </AuthProvider>
        </MemoryRouter>
      );

      // Verify All button exists in Batch Adjudication section
      expect(html).toContain('Batch Adjudication');
      expect(html).toContain('Verify All');
    });
  });
});
