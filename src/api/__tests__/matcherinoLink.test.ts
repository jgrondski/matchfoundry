import { describe, it, expect, beforeEach } from 'vitest';
import { setupTestDb } from '../../db/testDb';
import { setDb } from '../../db';
import { getFullTournament, saveFullTournament, listTournamentSummaries } from '../tournaments';
import { createEmptyTournament } from '../../features/tournament/defaults';
import { getMatcherinoHref, getMatcherinoUrlError } from '../../features/tournament/matcherino';
import type { Tournament } from '../../features/tournament/types';

describe('getMatcherinoHref', () => {
  it.each([
    ['https://matcherino.com/t/kc-open', 'https://matcherino.com/t/kc-open'],
    ['matcherino.com/t/kc-open', 'https://matcherino.com/t/kc-open'],
    ['  http://matcherino.com/t/x  ', 'http://matcherino.com/t/x'],
  ])('%s -> %s', (input, expected) => {
    expect(getMatcherinoHref(input)).toBe(expected);
  });

  it.each(['', '   ', 'javascript:alert(1)', 'data:text/html,hi', 'not a url', 'localhost'])(
    'rejects %j',
    input => {
      expect(getMatcherinoHref(input)).toBeNull();
    }
  );

  it('the settings form flags only non-blank invalid input', () => {
    expect(getMatcherinoUrlError('')).toBeNull();
    expect(getMatcherinoUrlError('matcherino.com/t/x')).toBeNull();
    expect(getMatcherinoUrlError('javascript:alert(1)')).toMatch(/web address/);
  });
});

describe('Matcherino link persistence', () => {
  let runId: string;

  beforeEach(() => {
    const { db } = setupTestDb();
    setDb(db);
    runId = crypto.randomUUID().slice(0, 8);
  });

  async function save(overrides: Partial<Tournament>, base?: Tournament): Promise<Tournament> {
    return saveFullTournament({
      ...(base ||
        createEmptyTournament({ name: `Cup ${runId}`, slug: `cup-${runId}`, qualFormat: 'HIGH_SCORE' })),
      ...overrides,
    });
  }

  it('saves a normalized link and returns it on the full tournament and the front-page summary', async () => {
    const saved = await save({ matcherinoUrl: 'matcherino.com/t/kc-open' });
    expect(saved.matcherinoUrl).toBe('https://matcherino.com/t/kc-open');

    const full = await getFullTournament(saved.id);
    expect(full?.matcherinoUrl).toBe('https://matcherino.com/t/kc-open');

    const summary = (await listTournamentSummaries()).find(s => s.id === saved.id);
    expect(summary?.matcherinoUrl).toBe('https://matcherino.com/t/kc-open');
  });

  it('a save that omits the field keeps the stored link; an empty string clears it', async () => {
    const saved = await save({ matcherinoUrl: 'https://matcherino.com/t/a' });

    const { matcherinoUrl: _omit, ...withoutLink } = saved;
    const kept = await save({ name: `Renamed ${runId}` }, withoutLink as Tournament);
    expect(kept.matcherinoUrl).toBe('https://matcherino.com/t/a');

    const cleared = await save({ matcherinoUrl: '' }, kept);
    expect(cleared.matcherinoUrl).toBeUndefined();
  });

  it('never stores a non-web link', async () => {
    const saved = await save({ matcherinoUrl: 'javascript:alert(1)' });
    expect(saved.matcherinoUrl).toBeUndefined();
  });
});
