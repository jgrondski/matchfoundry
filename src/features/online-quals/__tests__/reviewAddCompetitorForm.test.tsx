import { describe, it, expect, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { setupTestDb } from '../../../db/testDb';
import { setDb } from '../../../db';
import { createPlayer, getPlayer } from '../../../api/players';
import { saveFullTournament } from '../../../api/tournaments';
import { seedDefaultOrganizations } from '../../../api/organizations';
import {
  adjudicateOnlineSubmission,
  claimOrRegisterOnlineCompetitor,
  setOnlineQualsOpen,
  startOnlineQualSession,
  submitOnlineQualScores,
} from '../../../api/qualifiers';
import { createEmptyTournament, createDefaultTier } from '../../tournament/defaults';
import { PlayerEditModal } from '../../players/components/PlayerEditModal';
import type { Tournament } from '../../tournament/types';
import { runToken } from './runToken';

// Qual Review's "Add Competitor" now uses the Players page form. These check that the form's
// extra fields reach the new (or promoted) player, and that the form opens prefilled.

describe('Qual Review Add Competitor uses the shared competitor form', () => {
  let tourney: Tournament;
  let jonasId: string;

  beforeEach(async () => {
    const { db } = setupTestDb();
    setDb(db);
    await seedDefaultOrganizations();
    const jonas = await createPlayer({ name: 'Jonas Neubauer', country: 'US', playstyle: 'DAS' });
    jonasId = jonas.id;
    const base = createEmptyTournament({ slug: 'review-add', name: 'Review Add' });
    base.qualMode = 'HYBRID';
    base.qualFormat = 'HIGH_SCORE';
    base.playersPool = [jonas as any];
    base.tiers = [createDefaultTier(1, { playerCount: 8 })];
    tourney = await saveFullTournament(base);
    await setOnlineQualsOpen(tourney.id, true);
  });

  async function submitRun(playerId: string, twitch: string) {
    await startOnlineQualSession(tourney.id, { playerId, submittedTwitchUsername: twitch });
    await submitOnlineQualScores(tourney.id, {
      playerId,
      resumeToken: await runToken(tourney.id, playerId),
      scores: [880000],
      twitchVodUrl: 'https://twitch.tv/videos/1',
      submittedTwitchUsername: twitch,
    });
  }

  const formFields = {
    country: 'SE',
    playstyle: 'Rolling',
    displayName: 'JJ',
    nickname: 'The Kid',
    twitchUsername: '@jj_live',
    personalBest: 1234567,
    notes: 'Walk-in from Stockholm',
  };

  it('CREATE_NEW_PLAYER saves preferred name, nickname, Twitch, PB and notes', async () => {
    await submitRun(jonasId, 'jonas_junior');
    const session = await adjudicateOnlineSubmission(tourney.id, {
      playerId: jonasId,
      action: 'CREATE_NEW_PLAYER',
      newPlayer: { name: 'Jonas Junior', ...formFields },
    });
    const created = await getPlayer(session!.playerId);
    expect(created).toMatchObject({
      name: 'Jonas Junior',
      country: 'SE',
      playstyle: 'Rolling',
      displayName: 'JJ',
      nickname: 'The Kid',
      twitchUsername: 'jj_live',
      personalBest: 1234567,
      notes: 'Walk-in from Stockholm',
    });
  });

  it('PROMOTE_PROVISIONAL applies the same fields to the walk-in profile', async () => {
    const walkIn = await claimOrRegisterOnlineCompetitor(tourney.id, {
      mode: 'NEW_PLAYER',
      twitchId: 'tw_1',
      twitchUsername: 'retro',
      newPlayer: { name: 'RetroMaster', country: 'CA', playstyle: 'DAS' },
    });
    const id = walkIn.player.id;
    await submitRun(id, 'retro');
    await adjudicateOnlineSubmission(tourney.id, {
      playerId: id,
      action: 'PROMOTE_PROVISIONAL',
      newPlayer: { name: 'RetroMaster', ...formFields },
    });
    const promoted = await getPlayer(id);
    expect(promoted).toMatchObject({
      name: 'RetroMaster',
      displayName: 'JJ',
      nickname: 'The Kid',
      personalBest: 1234567,
      notes: 'Walk-in from Stockholm',
      twitchUsername: 'jj_live',
    });
  });

  it('an older client sending only name/country/playstyle leaves the other fields alone', async () => {
    await submitRun(jonasId, 'jonas_junior');
    const session = await adjudicateOnlineSubmission(tourney.id, {
      playerId: jonasId,
      action: 'CREATE_NEW_PLAYER',
      newPlayer: { name: 'Jonas Junior', country: 'SE', playstyle: 'Rolling' },
    });
    const created = await getPlayer(session!.playerId);
    expect(created?.twitchUsername).toBe('jonas_junior');
    expect(created?.personalBest).toBe(0);
    expect(created?.displayName ?? null).toBeNull();
  });
});

describe('PlayerEditModal prefill', () => {
  it('opens as a new competitor with the prefilled values', () => {
    const html = renderToStaticMarkup(
      <PlayerEditModal
        isOpen
        onClose={() => {}}
        onSave={() => {}}
        existingNames={[]}
        prefill={{ name: 'WalkInGamer', twitchUsername: 'walkin', country: 'CA' }}
      />
    );
    expect(html).toContain('Add New Competitor');
    expect(html).toContain('value="WalkInGamer"');
    expect(html).toContain('value="walkin"');
    expect(html).toContain('Add Competitor');
  });
});
