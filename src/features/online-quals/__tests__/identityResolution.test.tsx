import { describe, it, expect, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { setupTestDb } from '../../../db/testDb';
import { setDb } from '../../../db';
import { createPlayer, getPlayer } from '../../../api/players';
import { saveFullTournament } from '../../../api/tournaments';
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
    });
  });
});
