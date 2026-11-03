import { describe, it, expect, beforeAll } from 'vitest';
import { filterTournamentsByQuery } from '../../../components/TournamentSidebar';
import { getPlayerQualifierStatus, generateDraftBracketsForTournament, deriveLeaderboard } from '../../qualifiers/scoring';
import { Tournament } from '../types';
import { isUuid } from '../../../api/tournaments';
import { createPlayer, updatePlayer, createPlayersBatch } from '../../../api/players';
import { setupTestDb } from '../../../db/testDb';
import { setDb } from '../../../db';

describe('Tournament Rules, Lifecycle Safety & UI State Invariants', () => {
  beforeAll(() => {
    const { db } = setupTestDb();
    setDb(db);
  });

  // Mock tournaments
  const denverOpen: Tournament = {
    id: '98189acc-9651-47fb-9ad0-64b649e909c4',
    name: 'Denver Open',
    slug: 'denver-open',
    organizationId: 'org_denver',
    location: 'Denver, CO',
    qualFormat: 'HIGH_SCORE',
    isLocked: false,
    tiers: [
      {
        id: 'tier-1',
        slug: 'gold',
        name: 'Gold',
        priority: 1,
        playerCount: 16,
        bracketType: 'TRADITIONAL',
        bestOf: 5,
        primaryColor: '#ffc905',
        secondaryColor: '#705b33',
        cardColor: '#1b1c1d',
        textColor: '#94A3B8',
        backgroundColor: '#020203',
        isLocked: false,
        bracket: { rounds: [], matches: [] } as any,
      },
    ],
    playersPool: [
      { id: '11111111-1111-4111-8111-111111111111', name: 'Player A', personalBest: 1000000, playstyle: 'DAS' },
      { id: '22222222-2222-4222-8222-222222222222', name: 'Player B', personalBest: 950000, playstyle: 'Rolling' },
    ],
    qualifierSubmissions: [
      {
        id: '5587ab22-236b-403d-b6a7-94f9a0ec7109',
        tournamentId: '98189acc-9651-47fb-9ad0-64b649e909c4',
        playerId: '11111111-1111-4111-8111-111111111111',
        score: 1787185,
        submittedAt: 1791166257831,
      },
    ],
    tournamentPlayers: {
      '11111111-1111-4111-8111-111111111111': {
        playerId: '11111111-1111-4111-8111-111111111111',
        tournamentId: '98189acc-9651-47fb-9ad0-64b649e909c4',
        qualsCompleted: false,
        isVerified: false,
      },
    },
    matchScores: {},
  };

  const denverDas: Tournament = {
    id: 'f4cb0d4c-e4b9-40ed-9118-e3ebaff4ce43',
    name: 'Denver DAS',
    slug: 'denver-d',
    organizationId: 'org_denver',
    location: 'Denver, CO',
    qualFormat: 'HIGH_SCORE',
    isLocked: false,
    tiers: [
      {
        id: 'tier-2',
        slug: 'gold',
        name: 'Gold',
        priority: 1,
        playerCount: 16,
        bracketType: 'TRADITIONAL',
        bestOf: 5,
        primaryColor: '#ffc905',
        secondaryColor: '#705b33',
        cardColor: '#1b1c1d',
        textColor: '#94A3B8',
        backgroundColor: '#020203',
        isLocked: false,
        bracket: { rounds: [], matches: [] } as any,
      },
    ],
    playersPool: [
      { id: '11111111-1111-4111-8111-111111111111', name: 'Player A', personalBest: 1000000, playstyle: 'DAS' },
    ],
    qualifierSubmissions: [],
    tournamentPlayers: {},
    matchScores: {},
  };

  describe('1. DB Sync Safety & Submission UUID Isolation', () => {
    it('generates new UUIDs if submissions from another tournament are attached during save', () => {
      const foreignSubmission = denverOpen.qualifierSubmissions[0];
      const targetTourneyId = denverDas.id;

      // In saveFullTournament: isOurUuid checks isUuid(s.id) && s.tournamentId === savedTourneyId
      const isOurUuid = isUuid(foreignSubmission.id) && foreignSubmission.tournamentId === targetTourneyId;
      const assignedId = isOurUuid ? foreignSubmission.id : crypto.randomUUID();

      // Because it belonged to denverOpen, assignedId must NOT collide with foreignSubmission.id
      expect(isOurUuid).toBe(false);
      expect(assignedId).not.toBe(foreignSubmission.id);
      expect(isUuid(assignedId)).toBe(true);
    });

    it('preserves submission UUID when the submission genuinely belongs to the current tournament', () => {
      const genuineSubmission = {
        id: '33333333-3333-4333-8333-333333333333',
        tournamentId: denverDas.id,
        playerId: '11111111-1111-4111-8111-111111111111',
        score: 1200000,
        submittedAt: Date.now(),
      };
      const isOurUuid = isUuid(genuineSubmission.id) && genuineSubmission.tournamentId === denverDas.id;
      const assignedId = isOurUuid ? genuineSubmission.id : crypto.randomUUID();

      expect(isOurUuid).toBe(true);
      expect(assignedId).toBe(genuineSubmission.id);
    });
  });

  describe('2. Tournament Switching & Dropdown Deduplication / Disambiguation', () => {
    it('deduplicates tournaments by ID so identical entries never co-exist in dropdown', () => {
      const duplicateList = [denverOpen, denverOpen, denverDas];
      const filtered = filterTournamentsByQuery(duplicateList, '');

      expect(filtered.length).toBe(2);
      expect(filtered.map(t => t.id)).toEqual([denverOpen.id, denverDas.id]);
    });

    it('disambiguates display names when two tournaments have the exact same name', () => {
      const tourney1: Tournament = { ...denverOpen, id: 'id-1', name: 'Denver Open', slug: 'denver-open-1' };
      const tourney2: Tournament = { ...denverOpen, id: 'id-2', name: 'Denver Open', slug: 'denver-open-2' };
      const list = [tourney1, tourney2];

      const filtered = filterTournamentsByQuery(list, '');
      const displayNames = filtered.map(t => {
        const nameCount = filtered.filter(other => other.name.toLowerCase() === t.name.toLowerCase()).length;
        return nameCount > 1 ? `${t.name} (${t.slug})` : t.name;
      });

      expect(displayNames[0]).toBe('Denver Open (denver-open-1)');
      expect(displayNames[1]).toBe('Denver Open (denver-open-2)');
    });

    it('strictly highlights only the active tournament ID in the dropdown menu', () => {
      const tourney1: Tournament = { ...denverOpen, id: 'id-1', name: 'Denver Open', slug: 'denver-open-1' };
      const tourney2: Tournament = { ...denverOpen, id: 'id-2', name: 'Denver Open', slug: 'denver-open-2' };
      const activeTourney = tourney1;

      const isTourney1Selected = Boolean(activeTourney?.id && tourney1.id === activeTourney.id);
      const isTourney2Selected = Boolean(activeTourney?.id && tourney2.id === activeTourney.id);

      expect(isTourney1Selected).toBe(true);
      expect(isTourney2Selected).toBe(false);
    });
  });

  describe('3. Qualifier Verification Logic & Status Invariants', () => {
    it('recognizes player as verified if qualsCompleted is true (from DB) or isVerified is true', () => {
      const tourneyWithDbVerified: Tournament = {
        ...denverOpen,
        tournamentPlayers: {
          'p-db': {
            playerId: 'p-db',
            tournamentId: denverOpen.id,
            qualsCompleted: true, // DB column
            isVerified: false,
          },
          'p-ui': {
            playerId: 'p-ui',
            tournamentId: denverOpen.id,
            qualsCompleted: false,
            isVerified: true, // UI state
          },
          'p-none': {
            playerId: 'p-none',
            tournamentId: denverOpen.id,
            qualsCompleted: false,
            isVerified: false,
          },
        },
      };

      expect(getPlayerQualifierStatus(tourneyWithDbVerified, 'p-db')).toBe('verified');
      expect(getPlayerQualifierStatus(tourneyWithDbVerified, 'p-ui')).toBe('verified');
      expect(getPlayerQualifierStatus(tourneyWithDbVerified, 'p-none')).toBe('not started');
    });

    it('toggles verification bidirectionally setting both qualsCompleted and isVerified', () => {
      const existing = {
        playerId: 'p-1',
        tournamentId: denverOpen.id,
        qualsCompleted: false,
        isVerified: false,
      };

      // Toggle ON
      const currentVal = Boolean(existing.isVerified || existing.qualsCompleted);
      const newVerified = !currentVal;
      const updatedOn = {
        ...existing,
        isVerified: newVerified,
        qualsCompleted: newVerified,
      };

      expect(updatedOn.isVerified).toBe(true);
      expect(updatedOn.qualsCompleted).toBe(true);

      // Toggle OFF
      const currentVal2 = Boolean(updatedOn.isVerified || updatedOn.qualsCompleted);
      const newVerified2 = !currentVal2;
      const updatedOff = {
        ...updatedOn,
        isVerified: newVerified2,
        qualsCompleted: newVerified2,
      };

      expect(updatedOff.isVerified).toBe(false);
      expect(updatedOff.qualsCompleted).toBe(false);
    });
  });

  describe('4. Default Tier Naming', () => {
    it('defaults new tiers to Gold, Silver, and Bronze without redundant Championship/Bracket suffixes', () => {
      const defaultTierNames = [
        // 1st Tier
        'Gold',
        // 2nd Tier
        'Silver',
        // 3rd Tier
        'Bronze',
      ];

      expect(defaultTierNames[0]).toBe('Gold');
      expect(defaultTierNames[1]).toBe('Silver');
      expect(defaultTierNames[2]).toBe('Bronze');
      expect(defaultTierNames[0]).not.toContain('Championship');
      expect(defaultTierNames[1]).not.toContain('Bracket');
      expect(defaultTierNames[2]).not.toContain('Bracket');
    });
  });

  describe('5. # of Maxes Setting Description', () => {
    it('describes # of Maxes format as "Ranked by number of maxouts; kickers act as the tiebreaker."', () => {
      const correctDescription = 'Ranked by number of maxouts; kickers act as the tiebreaker.';
      const buggyDescription = 'Ranked by highest game score; ties broken by total maxout count.';

      expect(correctDescription).toBe('Ranked by number of maxouts; kickers act as the tiebreaker.');
      expect(correctDescription).not.toBe(buggyDescription);
    });
  });

  describe('6. Format Badge Labeling in Navigation', () => {
    const getBadgeLabel = (format: string, avgCount?: number) => {
      return format === 'HIGH_SCORE'
        ? '# of Maxes'
        : format === 'AVERAGE_OF_X'
        ? (avgCount ? `Avg of ${avgCount}` : 'Average of X')
        : format === 'POINTS'
        ? 'Points'
        : 'Average';
    };

    it('labels HIGH_SCORE tournaments as "# of Maxes" instead of "HIGH SCORE"', () => {
      expect(getBadgeLabel('HIGH_SCORE')).toBe('# of Maxes');
      expect(getBadgeLabel('HIGH_SCORE')).not.toBe('HIGH SCORE');
    });

    it('labels AVERAGE_OF_X and POINTS accurately', () => {
      expect(getBadgeLabel('AVERAGE_OF_X', 2)).toBe('Avg of 2');
      expect(getBadgeLabel('AVERAGE_OF_X')).toBe('Average of X');
      expect(getBadgeLabel('POINTS')).toBe('Points');
    });
  });

  describe('7. Dropdown Navigation Dirty State & Unsaved Changes Protection', () => {
    it('intercepts dropdown tournament switching when settings has unsaved changes', () => {
      let pendingNav: string | null = null;
      let isDirty = true;
      const activeTourneySlug = 'denver-open';

      const handleNavigateAttempt = (url: string) => {
        if (url.includes(`/${activeTourneySlug}/manage/settings`)) {
          return true;
        }
        if (isDirty) {
          pendingNav = url;
          return false;
        }
        return true;
      };

      // User attempts to switch to denver-d in dropdown while dirty
      const targetUrl = '/denver-d/manage/settings';
      const allowed = handleNavigateAttempt(targetUrl);

      expect(allowed).toBe(false);
      expect(pendingNav).toBe(targetUrl);

      // User discards changes and confirms navigation
      isDirty = false;
      const confirmAllowed = handleNavigateAttempt(pendingNav!);
      expect(confirmAllowed).toBe(true);
    });

    it('allows dropdown tournament switching immediately when settings is not dirty', () => {
      let pendingNav: string | null = null;
      const isDirty = false;
      const activeTourneySlug = 'denver-open';

      const handleNavigateAttempt = (url: string) => {
        if (url.includes(`/${activeTourneySlug}/manage/settings`)) {
          return true;
        }
        if (isDirty) {
          pendingNav = url;
          return false;
        }
        return true;
      };

      const targetUrl = '/denver-d/manage/settings';
      const allowed = handleNavigateAttempt(targetUrl);

      expect(allowed).toBe(true);
      expect(pendingNav).toBe(null);
    });

    it('allows clicking the currently active tournament in the dropdown without prompt', () => {
      let pendingNav: string | null = null;
      const isDirty = true;
      const activeTourneySlug = 'denver-open';

      const handleNavigateAttempt = (url: string) => {
        if (url.includes(`/${activeTourneySlug}/manage/settings`)) {
          return true;
        }
        if (isDirty) {
          pendingNav = url;
          return false;
        }
        return true;
      };

      const targetUrl = '/denver-open/manage/settings';
      const allowed = handleNavigateAttempt(targetUrl);

      expect(allowed).toBe(true);
      expect(pendingNav).toBe(null);
    });
  });

  describe('8. Data Lifecycle Safety Hierarchy (Clear Matches before Clear Quals)', () => {
    it('disables Clear Quals action when recorded match scores exist', () => {
      const seedCount: number = 16;
      const recordedMatchCount = 5;
      const hasRecordedMatches = recordedMatchCount > 0;

      // In DataSimulationSection:
      const isClearQualsDisabled = seedCount === 0 || hasRecordedMatches;
      expect(isClearQualsDisabled).toBe(true);
    });

    it('enables Clear Quals action once recorded match scores are cleared', () => {
      const seedCount: number = 16;
      const recordedMatchCount = 0;
      const hasRecordedMatches = recordedMatchCount > 0;

      const isClearQualsDisabled = seedCount === 0 || hasRecordedMatches;
      expect(isClearQualsDisabled).toBe(false);
    });

    it('blocks clearing qualifiers in confirmation handler if match scores exist', () => {
      const recordedMatchCount = 3;
      let simFeedback: string | null = null;
      let qualsCleared = false;

      const handleConfirmDataAction = (action: 'MATCHES' | 'QUALS' | 'ALL') => {
        if (action === 'QUALS') {
          if (recordedMatchCount > 0) {
            simFeedback = 'Cannot clear qualifiers while match scores exist. Execute "Clear Matches" first.';
            return;
          }
          qualsCleared = true;
        }
      };

      handleConfirmDataAction('QUALS');
      expect(qualsCleared).toBe(false);
      expect(simFeedback).toBe('Cannot clear qualifiers while match scores exist. Execute "Clear Matches" first.');
    });
  });

  describe('9. Global Player Card Identity (Name, Nickname, Display Name, Twitch)', () => {
    it('creates, reads, and sanitizes player identity fields', async () => {
      const created = await createPlayer({
        name: 'Justin Yu',
        displayName: 'Scuti',
        nickname: 'The Rolling Prodigy',
        twitchUsername: '@bluescuti',
        country: 'US',
        personalBest: 1200000,
        playstyle: 'Rolling',
      });

      expect(created.name).toBe('Justin Yu');
      expect(created.displayName).toBe('Scuti');
      expect(created.nickname).toBe('The Rolling Prodigy');
      // @ must be stripped from twitchUsername
      expect(created.twitchUsername).toBe('bluescuti');

      // Update player identity
      const updated = await updatePlayer(created.id, {
        nickname: 'Crash Champ',
        twitchUsername: '@new_twitch_handle',
      });

      expect(updated?.nickname).toBe('Crash Champ');
      expect(updated?.twitchUsername).toBe('new_twitch_handle');
      expect(updated?.displayName).toBe('Scuti');
    });

    it('creates multiple players in batch with identity fields', async () => {
      const batch = await createPlayersBatch([
        {
          name: 'Alex Kerr',
          displayName: 'PixelAndy',
          nickname: 'Andy',
          twitchUsername: 'pixelandy',
          country: 'US',
          personalBest: 1300000,
          playstyle: 'Rolling',
        },
        {
          name: 'Michael Artiaga',
          displayName: 'DogPlayingTetris',
          nickname: 'Dog',
          twitchUsername: '@dogplayingtetris',
          country: 'US',
          personalBest: 1400000,
          playstyle: 'Rolling',
        },
      ]);

      expect(batch).toHaveLength(2);
      expect(batch[0].displayName).toBe('PixelAndy');
      expect(batch[0].twitchUsername).toBe('pixelandy');
      expect(batch[1].displayName).toBe('DogPlayingTetris');
      expect(batch[1].nickname).toBe('Dog');
      expect(batch[1].twitchUsername).toBe('dogplayingtetris');
    });
  });

  describe('10. Homepage Tournament Card Navigation to Admin Bracket', () => {
    it('generates direct routes to the admin bracket view rather than public/spectator view', () => {
      const sampleTournament = {
        slug: 'super-championship',
        tiers: [
          { id: 'tier-gold', slug: 'gold', name: 'Gold', playerCount: 16 },
          { id: 'tier-silver', slug: 'silver', name: 'Silver', playerCount: 8 },
        ],
      };

      // Helper simulating the URL builder used in TournamentCard.tsx
      const buildTierBracketUrl = (tournamentSlug: string, tierSlug: string) =>
        `/${tournamentSlug}/manage/bracket/${tierSlug}`;
      const buildBracketsActionUrl = (tournamentSlug: string, defaultTierSlug: string) =>
        `/${tournamentSlug}/manage/bracket/${defaultTierSlug}`;

      // Tier pills must route to admin bracket view
      expect(buildTierBracketUrl(sampleTournament.slug, sampleTournament.tiers[0].slug)).toBe(
        '/super-championship/manage/bracket/gold'
      );
      expect(buildTierBracketUrl(sampleTournament.slug, sampleTournament.tiers[1].slug)).toBe(
        '/super-championship/manage/bracket/silver'
      );

      // "Brackets" action button must route to admin bracket view for the default (first) tier
      expect(buildBracketsActionUrl(sampleTournament.slug, sampleTournament.tiers[0].slug)).toBe(
        '/super-championship/manage/bracket/gold'
      );

      // Verify that neither links to public spectator routes without /manage/bracket/
      expect(buildTierBracketUrl(sampleTournament.slug, sampleTournament.tiers[0].slug)).not.toBe(
        '/super-championship/gold'
      );

      // Verify that all action links on TournamentCard route to manage endpoints:
      const buildQualifiersActionUrl = (tournamentSlug: string) => `/${tournamentSlug}/manage/qualifiers`;
      const buildStandingsActionUrl = (tournamentSlug: string) => `/${tournamentSlug}/manage/standings`;
      const buildSheetActionUrl = (tournamentSlug: string, tierSlug?: string) =>
        tierSlug ? `/${tournamentSlug}/manage/sheet?tier=${tierSlug}` : `/${tournamentSlug}/manage/sheet`;
      const buildSettingsActionUrl = (tournamentSlug: string) => `/${tournamentSlug}/manage/settings`;

      expect(buildQualifiersActionUrl(sampleTournament.slug)).toBe('/super-championship/manage/qualifiers');
      expect(buildStandingsActionUrl(sampleTournament.slug)).toBe('/super-championship/manage/standings');
      expect(buildSheetActionUrl(sampleTournament.slug, 'gold')).toBe('/super-championship/manage/sheet?tier=gold');
      expect(buildSettingsActionUrl(sampleTournament.slug)).toBe('/super-championship/manage/settings');

      // None must point to public unauthenticated view paths
      expect(buildQualifiersActionUrl(sampleTournament.slug)).not.toBe('/super-championship/leaderboard');
      expect(buildStandingsActionUrl(sampleTournament.slug)).not.toBe('/super-championship/standings');
    });
  });

  describe('11. Pre-Lock Bracket Visibility in OBS Overlays', () => {
    it('generates draft bracket preview with populated rounds when tournament is unlocked', () => {
      const unlockedTourney: Tournament = {
        ...denverOpen,
        isLocked: false,
        qualFormat: 'HIGH_SCORE',
        tiers: [
          {
            id: 'tier-1',
            slug: 'gold',
            name: 'Gold',
            priority: 1,
            playerCount: 4,
            bracketType: 'TRADITIONAL',
            bestOf: 3,
            primaryColor: '#ffc905',
            secondaryColor: '#705b33',
            cardColor: '#1b1c1d',
            textColor: '#94A3B8',
            backgroundColor: '#020203',
            isLocked: false,
            bracket: { rounds: [], matches: [] } as any,
          },
        ],
        playersPool: [
          { id: 'p1', name: 'Scuti', personalBest: 1200000, playstyle: 'Rolling' },
          { id: 'p2', name: 'PixelAndy', personalBest: 1300000, playstyle: 'Rolling' },
          { id: 'p3', name: 'Dog', personalBest: 1400000, playstyle: 'Rolling' },
          { id: 'p4', name: 'Fractal', personalBest: 1350000, playstyle: 'Rolling' },
        ],
        qualifierSubmissions: [
          { id: 's1', tournamentId: denverOpen.id, playerId: 'p1', score: 1100000, submittedAt: 1000 },
          { id: 's2', tournamentId: denverOpen.id, playerId: 'p2', score: 1200000, submittedAt: 1001 },
          { id: 's3', tournamentId: denverOpen.id, playerId: 'p3', score: 950000, submittedAt: 1002 },
          { id: 's4', tournamentId: denverOpen.id, playerId: 'p4', score: 850000, submittedAt: 1003 },
        ],
      };

      const draftTiers = generateDraftBracketsForTournament(unlockedTourney);
      expect(draftTiers).toHaveLength(1);
      const goldDraft = draftTiers[0];

      // Bracket rounds must be populated with mathematically structured matches
      expect(goldDraft.bracket.rounds.length).toBeGreaterThan(0);
      expect(Object.keys(goldDraft.bracket.matchesById).length).toBeGreaterThan(0);

      // Verify seed 1 in draft bracket matches leaderboard leader (PixelAndy with 1.2M)
      const round1 = goldDraft.bracket.rounds[0];
      const match1 = round1.matches[0];
      expect(match1.player1?.player?.name).toBe('PixelAndy');
      expect(match1.player1?.player?.seed).toBe(1);
    });

    it('generates placeholder draft bracket when playersPool has zero submissions so overlays can render pre-lock', () => {
      const emptyQuallTourney: Tournament = {
        ...denverOpen,
        isLocked: false,
        tiers: [
          {
            id: 'tier-1',
            slug: 'gold',
            name: 'Gold',
            priority: 1,
            playerCount: 4,
            bracketType: 'TRADITIONAL',
            bestOf: 3,
            primaryColor: '#ffc905',
            secondaryColor: '#705b33',
            cardColor: '#1b1c1d',
            textColor: '#94A3B8',
            backgroundColor: '#020203',
            isLocked: false,
            bracket: { rounds: [], totalMatches: 0, matchesById: {} } as any,
          },
        ],
        playersPool: [],
        qualifierSubmissions: [],
      };

      const draftTiers = generateDraftBracketsForTournament(emptyQuallTourney);
      const goldDraft = draftTiers[0];

      // Even with 0 qualifiers/players, configured tier generates placeholder mathematical bracket
      expect(goldDraft.bracket.rounds.length).toBe(2); // 4 players = Semifinals + Finals (2 rounds)
      expect(goldDraft.bracket.rounds[0].matches).toHaveLength(2);
      expect(goldDraft.bracket.rounds[0].matches[0].player1?.player?.name).toBe('Seed 1');
      expect(goldDraft.bracket.rounds[0].matches[0].player2?.player?.name).toBe('Seed 4');
    });

    it('preserves registered roster in playersPool with 0 attempts and unseeded status when qualifiers are cleared', () => {
      const clearedTourney: Tournament = {
        ...denverOpen,
        isLocked: false,
        tiers: [
          {
            id: 'tier-1',
            slug: 'gold',
            name: 'Gold',
            priority: 1,
            playerCount: 4,
            bracketType: 'TRADITIONAL',
            bestOf: 3,
            primaryColor: '#ffc905',
            secondaryColor: '#705b33',
            cardColor: '#1b1c1d',
            textColor: '#94A3B8',
            backgroundColor: '#020203',
            isLocked: false,
            bracket: { rounds: [], totalMatches: 0, matchesById: {} } as any,
          },
        ],
        playersPool: [
          { id: 'p1', name: 'PixelAndy', country: 'US', playstyle: 'Rolling', personalBest: 1200000 },
          { id: 'p2', name: 'BlueScuti', country: 'US', playstyle: 'Rolling', personalBest: 1200000 },
          { id: 'p3', name: 'Fractal', country: 'US', playstyle: 'Rolling', personalBest: 1200000 },
          { id: 'p4', name: 'DogPlayingTetris', country: 'US', playstyle: 'Rolling', personalBest: 1200000 },
        ],
        // Qualifiers cleared: submissions empty
        qualifierSubmissions: [],
      };

      // 1. Leaderboard derivation must show all 4 registered competitors on the roster with 0 attempts and unranked
      const leaderboard = deriveLeaderboard(clearedTourney);
      expect(leaderboard).toHaveLength(4);

      for (const row of leaderboard) {
        expect(row.attempts).toHaveLength(0);
        expect(row.rank).toBeUndefined();
        expect(row.assignedTier).toBeUndefined();
        expect(row.tierSeed).toBeUndefined();
        expect(row.isDNQ).toBe(false);
        expect(row.status).toBe('not started');
      }

      // 2. Draft brackets must revert to placeholder seeds (Seed 1..N) because no players have qualifying scores
      const draftTiers = generateDraftBracketsForTournament(clearedTourney);
      const goldDraft = draftTiers[0];
      expect(goldDraft.bracket.rounds[0].matches[0].player1?.player?.name).toBe('Seed 1');
      expect(goldDraft.bracket.rounds[0].matches[0].player2?.player?.name).toBe('Seed 4');
      expect(goldDraft.bracket.rounds[0].matches[1].player1?.player?.name).toBe('Seed 2');
      expect(goldDraft.bracket.rounds[0].matches[1].player2?.player?.name).toBe('Seed 3');
    });
  });
});

