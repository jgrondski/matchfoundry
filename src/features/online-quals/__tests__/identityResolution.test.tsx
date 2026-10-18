import { describe, it, expect, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { setupTestDb } from '../../../db/testDb';
import { setDb } from '../../../db';
import { createPlayer, getPlayer } from '../../../api/players';
import { saveFullTournament, getFullTournament } from '../../../api/tournaments';
import { seedDefaultOrganizations } from '../../../api/organizations';
import { createEmptyTournament, createDefaultTier } from '../../tournament/defaults';
import {
  claimOrRegisterOnlineCompetitor,
  resolveTwitchIdentity,
  startOnlineQualSession,
  submitOnlineQualScores,
  getOnlineQualSession,
  adjudicateOnlineSubmission,
} from '../../../api/qualifiers';
import { IdentityResolutionModal } from '../components/IdentityResolutionModal';
import { AdjudicationModal } from '../components/AdjudicationModal';
import { ReviewQueueTable } from '../components/ReviewQueueTable';
import type { Tournament } from '../../tournament/types';

describe('Journey 3: Identity Binding & Overrides (ATDD)', () => {
  let tourney: Tournament;
  let p1Id: string;
  let p2Id: string;

  beforeEach(async () => {
    const { db } = setupTestDb();
    setDb(db);
    await seedDefaultOrganizations();

    const p1 = await createPlayer({ name: 'Jonas Neubauer', country: 'US', playstyle: 'DAS' });
    const p2 = await createPlayer({ name: 'Harry Hong', country: 'US', playstyle: 'DAS' });
    p1Id = p1.id;
    p2Id = p2.id;

    const baseTourney = createEmptyTournament({ slug: 'ctwc-2026', name: 'CTWC 2026' });
    baseTourney.qualMode = 'HYBRID';
    baseTourney.qualFormat = 'HIGH_SCORE';
    baseTourney.playersPool = [p1 as any, p2 as any];
    baseTourney.tiers = [
      createDefaultTier(1, { name: 'Gold Tier', playerCount: 8, bracketType: 'TRADITIONAL' }),
    ];

    tourney = await saveFullTournament(baseTourney);
  });

  describe('Assertion 3.1: Confirm Identity Binding', () => {
    it('permanently writes twitch_id to global player and subsequent logins auto-resolve as VERIFIED_MATCH', async () => {
      // 1. Competitor claims Jonas Neubauer during online qualification (Bucket 2)
      const claimResult = await claimOrRegisterOnlineCompetitor(tourney.id, {
        mode: 'CLAIM_ROSTER',
        playerId: p1Id,
        twitchId: 'twitch_jonas_123',
        twitchUsername: 'jonasneubauer',
      });
      expect(claimResult.identityStatus).toBe('CLAIMED_PENDING_REVIEW');

      // 2. Start & submit run
      await startOnlineQualSession(tourney.id, {
        playerId: p1Id,
        submittedTwitchId: 'twitch_jonas_123',
        submittedTwitchUsername: 'jonasneubauer',
        identityStatus: 'CLAIMED_PENDING_REVIEW',
      });
      await submitOnlineQualScores(tourney.id, {
        playerId: p1Id,
        scores: [1100000],
        twitchVodUrl: 'https://twitch.tv/videos/111222',
        submittedTwitchId: 'twitch_jonas_123',
        submittedTwitchUsername: 'jonasneubauer',
      });

      // 3. Judge reviews and confirms binding
      const adjudicated = await adjudicateOnlineSubmission(tourney.id, {
        playerId: p1Id,
        action: 'CONFIRM_IDENTITY',
        verifiedBy: 'Judge Dan',
      });
      expect(adjudicated?.identityStatus).toBe('VERIFIED_MATCH');

      // 4. Verify player profile in database now has twitchId permanently bound
      const p1Updated = await getPlayer(p1Id);
      expect(p1Updated?.twitchId).toBe('twitch_jonas_123');

      // 5. Subsequent OAuth login with that Twitch ID auto-resolves directly as VERIFIED_MATCH (Bucket 1)
      const futureLogin = await resolveTwitchIdentity(tourney.id, {
        twitchId: 'twitch_jonas_123',
        twitchUsername: 'jonasneubauer',
      });
      expect(futureLogin.identityStatus).toBe('VERIFIED_MATCH');
      expect(futureLogin.player.id).toBe(p1Id);
    });
  });

  describe('Assertion 3.2: Judge Reassign Competitor', () => {
    it('reassigns submission from Player A to Player B and updates scores and leaderboard accordingly', async () => {
      // Session accidentally started under Jonas (p1Id)
      await startOnlineQualSession(tourney.id, {
        playerId: p1Id,
        submittedTwitchId: 'twitch_harry_456',
        submittedTwitchUsername: 'harryhong',
      });
      await submitOnlineQualScores(tourney.id, {
        playerId: p1Id,
        scores: [1150000],
        twitchVodUrl: 'https://twitch.tv/videos/333444',
        submittedTwitchId: 'twitch_harry_456',
        submittedTwitchUsername: 'harryhong',
      });

      // Judge discovers mistake and reassigns run to Harry Hong (p2Id)
      const reassigned = await adjudicateOnlineSubmission(tourney.id, {
        playerId: p1Id,
        action: 'REASSIGN_PLAYER',
        targetPlayerId: p2Id,
        verifiedBy: 'Judge Dan',
      });

      expect(reassigned?.playerId).toBe(p2Id);
      expect(reassigned?.identityStatus).toBe('VERIFIED_MATCH');

      // Harry Hong profile in DB received Twitch ID
      const p2Updated = await getPlayer(p2Id);
      expect(p2Updated?.twitchId).toBe('twitch_harry_456');

      // Check session under Harry
      const harrySession = await getOnlineQualSession(tourney.id, { playerId: p2Id });
      expect(harrySession).not.toBeNull();
      expect(harrySession?.scores).toEqual([1150000]);

      // Check that Jonas no longer has this session
      const jonasSession = await getOnlineQualSession(tourney.id, { playerId: p1Id });
      expect(jonasSession).toBeNull();
    });
  });

  describe('Assertion 3.3: Promote Provisional Walk-In Competitor', () => {
    it('promotes PROVISIONAL_NEW player to permanent verified global player', async () => {
      // Walk-in registers alias "RetroMaster" (Bucket 3)
      const walkIn = await claimOrRegisterOnlineCompetitor(tourney.id, {
        mode: 'NEW_PLAYER',
        twitchId: 'twitch_retro_789',
        twitchUsername: 'retromaster',
        newPlayer: {
          name: 'RetroMaster',
          country: 'CA',
          playstyle: 'Rolling',
        },
      });
      expect(walkIn.identityStatus).toBe('PROVISIONAL_NEW');
      const walkInPlayerId = walkIn.player.id;

      // Completes online run
      await startOnlineQualSession(tourney.id, {
        playerId: walkInPlayerId,
        submittedTwitchId: 'twitch_retro_789',
        submittedTwitchUsername: 'retromaster',
        identityStatus: 'PROVISIONAL_NEW',
      });
      await submitOnlineQualScores(tourney.id, {
        playerId: walkInPlayerId,
        scores: [1050000],
        twitchVodUrl: 'https://twitch.tv/videos/555666',
        submittedTwitchId: 'twitch_retro_789',
        submittedTwitchUsername: 'retromaster',
      });

      // Judge promotes provisional player
      const promoted = await adjudicateOnlineSubmission(tourney.id, {
        playerId: walkInPlayerId,
        action: 'PROMOTE_PROVISIONAL',
        verifiedBy: 'Judge Dan',
      });

      expect(promoted?.identityStatus).toBe('VERIFIED_MATCH');

      // Permanent row in players
      const dbPlayer = await getPlayer(walkInPlayerId);
      expect(dbPlayer).not.toBeNull();
      expect(dbPlayer?.name).toBe('RetroMaster');
      expect(dbPlayer?.country).toBe('CA');
      expect(dbPlayer?.twitchId).toBe('twitch_retro_789');
    });
  });

  describe('IdentityResolutionModal Component Presentation', () => {
    it('renders IdentityResolutionModal with confirm binding tab', () => {
      const mockSession = {
        tournamentId: tourney.id,
        playerId: p1Id,
        playerName: 'Jonas Neubauer',
        country: 'US',
        status: 'SUBMITTED' as const,
        authWord: 'ROCKET',
        twitchVodUrl: 'https://twitch.tv/videos/123456',
        submittedTwitchId: 'twitch_123',
        submittedTwitchUsername: 'jonas',
        identityStatus: 'CLAIMED_PENDING_REVIEW' as const,
        timerLog: { startedAt: Date.now(), elapsedSeconds: 300, pauses: [] },
        scores: [1100000],
        judgeNotes: null,
        submissionIds: ['sub-1'],
      };

      const html = renderToStaticMarkup(
        <IdentityResolutionModal
          isOpen={true}
          session={mockSession}
          playersPool={tourney.playersPool || []}
          onClose={() => {}}
          onResolve={async () => {}}
        />
      );

      expect(html).toContain('Resolve Competitor Identity');
      expect(html).toContain('Confirm Binding');
      expect(html).toContain('Reassign Competitor');
      expect(html).toContain('Jonas Neubauer');
      expect(html).toContain('@jonas');
    });

    it('renders IdentityResolutionModal with promote tab for provisional players', () => {
      const mockSession = {
        tournamentId: tourney.id,
        playerId: 'prov-1',
        playerName: 'WalkInGamer',
        country: 'CA',
        status: 'SUBMITTED' as const,
        authWord: 'ROCKET',
        twitchVodUrl: 'https://twitch.tv/videos/123456',
        submittedTwitchId: 'twitch_999',
        submittedTwitchUsername: 'walkingamer',
        identityStatus: 'PROVISIONAL_NEW' as const,
        timerLog: { startedAt: Date.now(), elapsedSeconds: 300, pauses: [] },
        scores: [950000],
        judgeNotes: null,
        submissionIds: ['sub-1'],
      };

      const html = renderToStaticMarkup(
        <IdentityResolutionModal
          isOpen={true}
          session={mockSession}
          playersPool={tourney.playersPool || []}
          onClose={() => {}}
          onResolve={async () => {}}
        />
      );

      expect(html).toContain('Promote to Global');
      expect(html).toContain('WalkInGamer');
      expect(html).toContain('Create Separate Player');
    });

    it('renders IdentityResolutionModal with create_new tab for already verified players', () => {
      const mockSession = {
        tournamentId: tourney.id,
        playerId: p1Id,
        playerName: 'Jonas Neubauer',
        country: 'US',
        status: 'VERIFIED' as const,
        authWord: 'ROCKET',
        twitchVodUrl: 'https://twitch.tv/videos/123456',
        submittedTwitchId: 'twitch_123',
        submittedTwitchUsername: 'jonas',
        identityStatus: 'VERIFIED_MATCH' as const,
        timerLog: { startedAt: Date.now(), elapsedSeconds: 300, pauses: [] },
        scores: [1100000],
        judgeNotes: null,
        submissionIds: ['sub-1'],
      };

      const html = renderToStaticMarkup(
        <IdentityResolutionModal
          isOpen={true}
          session={mockSession}
          playersPool={tourney.playersPool || []}
          onClose={() => {}}
          onResolve={async () => {}}
        />
      );

      expect(html).toContain('Reassign Competitor');
      expect(html).toContain('Create Separate Player');
    });
  });

  describe('Assertion 3.4: Portal Auto-Match vs. Walk-In Intake Status', () => {
    it('sets CLAIMED_PENDING_REVIEW when auto-matching existing player and PROVISIONAL_NEW when creating walk-in', async () => {
      // 1. Enter name matching existing global player Jonas Neubauer
      const autoMatchedSession = await startOnlineQualSession(tourney.id, {
        playerName: 'Jonas Neubauer',
        twitchUsername: 'jonas_streamer',
      });
      expect(autoMatchedSession.playerId).toBe(p1Id);
      expect(autoMatchedSession.identityStatus).toBe('CLAIMED_PENDING_REVIEW');

      // 2. Enter a brand-new name
      const walkInSession = await startOnlineQualSession(tourney.id, {
        playerName: 'BrandNewPlayer2026',
        twitchUsername: 'new_streamer',
      });
      expect(walkInSession.playerId).not.toBe(p1Id);
      expect(walkInSession.playerId).not.toBe(p2Id);
      expect(walkInSession.identityStatus).toBe('PROVISIONAL_NEW');
    });
  });

  describe('Assertion 3.5: One-Click Verify Confirms Identity and Binds Twitch Metadata', () => {
    it('automatically upgrades CLAIMED_PENDING_REVIEW to VERIFIED_MATCH on VERIFY action', async () => {
      // 1. Session started with auto-matched identity
      const session = await startOnlineQualSession(tourney.id, {
        playerName: 'Jonas Neubauer',
        submittedTwitchUsername: 'jonas_official',
        submittedTwitchId: 'tw_jonas_verified',
      });
      expect(session.identityStatus).toBe('CLAIMED_PENDING_REVIEW');

      await submitOnlineQualScores(tourney.id, {
        playerId: p1Id,
        scores: [1200000],
        twitchVodUrl: 'https://twitch.tv/videos/999888',
        submittedTwitchUsername: 'jonas_official',
        submittedTwitchId: 'tw_jonas_verified',
      });

      // 2. Judge clicks Verify Qual (action: 'VERIFY')
      const verified = await adjudicateOnlineSubmission(tourney.id, {
        playerId: p1Id,
        action: 'VERIFY',
        verifiedBy: 'Floor Judge',
      });

      expect(verified?.status).toBe('VERIFIED');
      expect(verified?.identityStatus).toBe('VERIFIED_MATCH');

      // 3. Verify player profile in database received the twitch metadata
      const updatedPlayer = await getPlayer(p1Id);
      expect(updatedPlayer?.twitchId).toBe('tw_jonas_verified');
      expect(updatedPlayer?.twitchUsername).toBe('jonas_official');
    });
  });

  describe('Assertion 3.6: Ghost-Free Reassignment (REASSIGN_PLAYER)', () => {
    it('removes old player from tournament_players if they have no other submissions', async () => {
      // 1. Create a 3rd global player who will mistakenly receive the run
      const mistaken = await createPlayer({ name: 'Mistaken Runner', country: 'US' });

      await startOnlineQualSession(tourney.id, {
        playerId: mistaken.id,
        submittedTwitchUsername: 'real_harry_stream',
      });
      await submitOnlineQualScores(tourney.id, {
        playerId: mistaken.id,
        scores: [1020000],
        twitchVodUrl: 'https://twitch.tv/videos/777888',
        submittedTwitchUsername: 'real_harry_stream',
      });

      // Check tournament roster has mistaken player
      let reloaded = await getFullTournament(tourney.id);
      expect(reloaded?.playersPool?.some(p => p.id === mistaken.id)).toBe(true);

      // 2. Judge reassigns run to Harry Hong (p2Id)
      const reassigned = await adjudicateOnlineSubmission(tourney.id, {
        playerId: mistaken.id,
        action: 'REASSIGN_PLAYER',
        targetPlayerId: p2Id,
      });

      expect(reassigned?.playerId).toBe(p2Id);
      expect(reassigned?.identityStatus).toBe('VERIFIED_MATCH');

      // 3. Verify mistaken player is cleanly removed from tournament_players (zero ghost player left)
      reloaded = await getFullTournament(tourney.id);
      expect(reloaded?.playersPool?.some(p => p.id === mistaken.id)).toBe(false);
      expect(reloaded?.playersPool?.some(p => p.id === p2Id)).toBe(true);
    });
  });

  describe('Assertion 3.7: Split to New Separate Player (CREATE_NEW_PLAYER)', () => {
    it('creates a new player profile and transfers submissions without leaving ghost player behind', async () => {
      // 1. Start run that accidentally matched Jonas Neubauer (p1Id)
      await startOnlineQualSession(tourney.id, {
        playerId: p1Id,
        submittedTwitchUsername: 'jonas_junior_live',
      });
      await submitOnlineQualScores(tourney.id, {
        playerId: p1Id,
        scores: [890000],
        twitchVodUrl: 'https://twitch.tv/videos/555444',
        submittedTwitchUsername: 'jonas_junior_live',
      });

      // 2. Judge splits run by creating a new separate player "Jonas Junior"
      const createdSession = await adjudicateOnlineSubmission(tourney.id, {
        playerId: p1Id,
        action: 'CREATE_NEW_PLAYER',
        newPlayer: {
          name: 'Jonas Junior',
          country: 'SE',
          playstyle: 'Rolling',
        },
      });

      expect(createdSession?.playerId).not.toBe(p1Id);
      expect(createdSession?.identityStatus).toBe('VERIFIED_MATCH');
      expect(createdSession?.scores).toEqual([890000]);

      // 3. Verify new player profile in DB
      const newPlayer = await getPlayer(createdSession!.playerId);
      expect(newPlayer).not.toBeNull();
      expect(newPlayer?.name).toBe('Jonas Junior');
      expect(newPlayer?.country).toBe('SE');
      expect(newPlayer?.playstyle).toBe('Rolling');

      // 4. Verify Jonas Neubauer (who had no other submissions) was removed from this tournament's playersPool
      const reloaded = await getFullTournament(tourney.id);
      expect(reloaded?.playersPool?.some(p => p.id === p1Id)).toBe(false);
      expect(reloaded?.playersPool?.some(p => p.id === newPlayer!.id)).toBe(true);
    });

    it('safely disambiguates colliding player names during CREATE_NEW_PLAYER and binds manual twitchUsername on REASSIGN_PLAYER', async () => {
      await startOnlineQualSession(tourney.id, {
        playerId: p1Id,
        submittedTwitchUsername: 'omen_impostor',
      });
      await submitOnlineQualScores(tourney.id, {
        playerId: p1Id,
        scores: [810000],
        twitchVodUrl: 'https://twitch.tv/videos/111222',
        submittedTwitchUsername: 'omen_impostor',
      });

      // Attempt to create a new player with the exact same name as an existing player ('Jonas Neubauer')
      const splitSession = await adjudicateOnlineSubmission(tourney.id, {
        playerId: p1Id,
        action: 'CREATE_NEW_PLAYER',
        newPlayer: {
          name: 'Jonas Neubauer',
          country: 'US',
          playstyle: 'DAS',
        },
      });

      const createdPlayer = await getPlayer(splitSession!.playerId);
      expect(createdPlayer?.name).toBe('Jonas Neubauer (omen_impostor)');
      expect(createdPlayer?.twitchUsername).toBe('omen_impostor');

      // Reassign to Harry Hong (p2Id) and ensure manual twitchUsername is bound even without submittedTwitchId
      const reassigned = await adjudicateOnlineSubmission(tourney.id, {
        playerId: splitSession!.playerId,
        action: 'REASSIGN_PLAYER',
        targetPlayerId: p2Id,
      });
      expect(reassigned?.playerId).toBe(p2Id);
      const updatedHarry = await getPlayer(p2Id);
      expect(updatedHarry?.twitchUsername).toBe('omen_impostor');
    });
  });

  describe('Assertion 3.8: Unconditional Identity Controls in ReviewQueueTable & AdjudicationModal', () => {
    it('renders Identity button on VERIFIED_MATCH rows and Reconcile / Change Player button in AdjudicationModal', () => {
      const mockSession = {
        tournamentId: tourney.id,
        playerId: p1Id,
        playerName: 'Jonas Neubauer',
        country: 'US',
        status: 'VERIFIED' as const,
        authWord: 'ROCKET',
        twitchVodUrl: 'https://twitch.tv/videos/123456',
        submittedTwitchId: 'twitch_123',
        submittedTwitchUsername: 'jonas',
        identityStatus: 'VERIFIED_MATCH' as const,
        timerLog: { startedAt: Date.now(), elapsedSeconds: 300, pauses: [] },
        scores: [1100000],
        judgeNotes: null,
        submissionIds: ['sub-1'],
      };

      const tableHtml = renderToStaticMarkup(
        <ReviewQueueTable
          sessions={[mockSession]}
          onOpenAdjudicate={() => {}}
          onOpenIdentityModal={() => {}}
        />
      );
      expect(tableHtml).toContain('Identity');
      expect(tableHtml).toContain('Review');

      const closedModalHtml = renderToStaticMarkup(
        <AdjudicationModal
          isOpen={false}
          session={null}
          onClose={() => {}}
          onAdjudicate={async () => {}}
          onOpenIdentity={() => {}}
        />
      );
      expect(closedModalHtml).toBe('');

      const openModalHtml = renderToStaticMarkup(
        <AdjudicationModal
          isOpen={true}
          session={mockSession}
          onClose={() => {}}
          onAdjudicate={async () => {}}
          onOpenIdentity={() => {}}
        />
      );
      expect(openModalHtml).toContain('Reconcile / Change Player');
    });
  });
});
