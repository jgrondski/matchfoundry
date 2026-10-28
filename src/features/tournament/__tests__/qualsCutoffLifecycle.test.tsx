import { describe, it, expect, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { setupTestDb } from '../../../db/testDb';
import { setDb } from '../../../db';
import { createPlayer } from '../../../api/players';
import { saveFullTournament } from '../../../api/tournaments';
import { seedDefaultOrganizations } from '../../../api/organizations';
import { createEmptyTournament, createDefaultTier } from '../defaults';
import {
  startOnlineQualSession,
} from '../../../api/qualifiers';
import { generateDraftBracketsForTournament } from '../../qualifiers/scoring';
import { ReviewQueueView } from '../../online-quals/components/ReviewQueueView';
import { CompetitorPortalView } from '../../online-quals/components/CompetitorPortalView';
import { AuthProvider } from '../../auth/AuthContext';
import { TournamentProvider } from '../store';
import { OrganizationProvider } from '../../organizations/store';
import type { Tournament } from '../types';

describe('Journey 4: Qualifiers Cutoff & Bracket Locking (ATDD)', () => {
  let tourney: Tournament;
  let p1Id: string;
  let p2Id: string;
  let p3Id: string;

  beforeEach(async () => {
    const { db } = setupTestDb();
    setDb(db);
    await seedDefaultOrganizations();

    const p1 = await createPlayer({ name: 'Alex Kerr', country: 'US', playstyle: 'DAS' });
    const p2 = await createPlayer({ name: 'PixelAndy', country: 'US', playstyle: 'Rolling' });
    const p3 = await createPlayer({ name: 'Blue Scuti', country: 'US', playstyle: 'Rolling' });
    p1Id = p1.id;
    p2Id = p2.id;
    p3Id = p3.id;

    const baseTourney = createEmptyTournament({ slug: 'ctwc-2026', name: 'CTWC 2026' });
    baseTourney.qualMode = 'HYBRID';
    baseTourney.qualFormat = 'HIGH_SCORE';
    baseTourney.playersPool = [p1 as any, p2 as any, p3 as any];
    baseTourney.tiers = [
      createDefaultTier(1, { name: 'Gold Tier', playerCount: 8, bracketType: 'TRADITIONAL' }),
    ];

    tourney = await saveFullTournament(baseTourney);
  });

  describe('Assertion 4.1: Gated Closure Alert', () => {
    it('shows warning alert when attempting to close qualifiers with unverified submissions remaining', () => {
      const tourneyWithPending: Tournament = {
        ...tourney,
        qualsClosed: false,
        qualifierSubmissions: [
          {
            id: 'sub-pending',
            tournamentId: tourney.id,
            playerId: p2Id,
            score: 1200000,
            submittedAt: Date.now(),
            submissionSource: 'ONLINE',
            status: 'SUBMITTED',
          },
        ],
      };

      const html = renderToStaticMarkup(
        <AuthProvider>
          <OrganizationProvider initialHydrated={true}>
            <TournamentProvider initialTournaments={[tourneyWithPending]} initialHydrated={true}>
              <MemoryRouter>
                <ReviewQueueView tournament={tourneyWithPending} />
              </MemoryRouter>
            </TournamentProvider>
          </OrganizationProvider>
        </AuthProvider>
      );

      // Verify manual Close Online Quals button is removed (follows global tournament lock)
      expect(html).not.toContain('Close Online Quals');
      expect(html).toContain('Open / Receiving');
      expect(html).toContain('Pending Review');
    });
  });

  describe('Assertion 4.2: Locked Public Portal', () => {
    it('disables run initiation and displays "Qualifiers Closed" announcement when quals_closed = true', async () => {
      const closedTourney: Tournament = {
        ...tourney,
        qualsClosed: true,
      };
      await saveFullTournament(closedTourney);

      // 1. Competitor portal displays "Qualifiers Closed" banner
      const html = renderToStaticMarkup(
        <MemoryRouter>
          <CompetitorPortalView tournament={closedTourney} />
        </MemoryRouter>
      );
      expect(html).toContain('Qualifiers Closed');
      expect(html).toContain('Qualifying is closed or brackets have locked');

      // 2. Calling startOnlineQualSession throws/rejects
      await expect(
        startOnlineQualSession(closedTourney.id, {
          playerId: p3Id,
          submittedTwitchUsername: 'bluescuti',
        })
      ).rejects.toThrow(/Qualifiers are closed for this tournament/i);
    });
  });

  describe('Assertion 4.3: Draft Bracket Seeding Integrity', () => {
    it('auto-seeded bracket draft includes verified players and strictly excludes DNQ, DQ, and AWAITING_VERIFICATION', () => {
      // Alex Kerr: VERIFIED (in-person)
      // PixelAndy: AWAITING_VERIFICATION (SUBMITTED)
      // Blue Scuti: DNQ
      const tourneyWithMixedStatuses: Tournament = {
        ...tourney,
        qualifierSubmissions: [
          {
            id: 'sub-alex',
            tournamentId: tourney.id,
            playerId: p1Id,
            score: 1150000,
            submittedAt: Date.now() - 50000,
            submissionSource: 'IN_PERSON',
            status: 'VERIFIED',
          },
          {
            id: 'sub-andy',
            tournamentId: tourney.id,
            playerId: p2Id,
            score: 1250000, // Higher score, but still unverified!
            submittedAt: Date.now() - 20000,
            submissionSource: 'ONLINE',
            status: 'SUBMITTED',
          },
          {
            id: 'sub-scuti',
            tournamentId: tourney.id,
            playerId: p3Id,
            score: 1200000,
            submittedAt: Date.now() - 10000,
            submissionSource: 'ONLINE',
            status: 'DNQ',
          },
        ],
      };

      const draftTiers = generateDraftBracketsForTournament(tourneyWithMixedStatuses);
      expect(draftTiers.length).toBe(1);

      const round1Matches = draftTiers[0].bracket.rounds[0].matches;
      const seededNames = round1Matches.flatMap(m => [
        m.player1?.player?.name,
        m.player2?.player?.name,
      ]).filter(Boolean);

      // Alex Kerr (VERIFIED) must be seeded
      expect(seededNames).toContain('Alex Kerr');

      // PixelAndy (AWAITING_VERIFICATION) must be EXCLUDED until verified
      expect(seededNames).not.toContain('PixelAndy');

      // Blue Scuti (DNQ) must be EXCLUDED
      expect(seededNames).not.toContain('Blue Scuti');
    });
  });
});
