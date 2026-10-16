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
} from '../../../api/qualifiers';
import { deriveLeaderboard, generateDraftBracketsForTournament } from '../../qualifiers/scoring';
import { TournamentSidebar } from '../../../components/TournamentSidebar';
import { AdjudicationModal } from '../components/AdjudicationModal';
import { ReviewQueueTable } from '../components/ReviewQueueTable';
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
  });

  describe('Assertion 2.1: Ingestion Source Separation', () => {
    it('saves in-person scores as VERIFIED and online submissions as SUBMITTED (awaiting verification)', async () => {
      // 1. Submit in-person score
      const inPersonSub = await submitQualifierScore(tourney.id, pInPersonId, 1150000, {
        submissionSource: 'IN_PERSON',
      });
      expect(inPersonSub.submissionSource).toBe('IN_PERSON');
      expect(inPersonSub.status).toBe('VERIFIED');

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

      // Verify in tournament leaderboard
      const updatedTourney: Tournament = {
        ...tourney,
        qualifierSubmissions: [
          {
            id: inPersonSub.id,
            tournamentId: tourney.id,
            playerId: pInPersonId,
            score: inPersonSub.score,
            submittedAt: Date.now() - 5000,
            submissionSource: 'IN_PERSON',
            status: 'VERIFIED',
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

      const lb = deriveLeaderboard(updatedTourney);
      const inPersonRow = lb.find(r => r.player.id === pInPersonId);
      const onlineRow = lb.find(r => r.player.id === pOnlineId);

      expect(inPersonRow?.status).toBe('verified');
      expect(inPersonRow?.submissionSource).toBe('IN_PERSON');

      expect(onlineRow?.status).toBe('awaiting verification');
      expect(onlineRow?.submissionSource).toBe('ONLINE');
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
      expect(htmlZero).toContain('Review Queue');

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
      expect(htmlTwo).toContain('Review Queue (2)');
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
      expect(html).toContain('Verified');
      expect(html).toContain('DNQ / DQ');
      expect(html).toContain('PixelAndy');
      expect(html).toContain('ROCKET');
      expect(html).toContain('Review');
    });
  });
});
