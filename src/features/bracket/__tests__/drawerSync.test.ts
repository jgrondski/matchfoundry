import { describe, it, expect } from 'vitest';
import { shouldResyncDrawer } from '../drawerSync';

const synced = JSON.stringify([{ p1: '800000', p2: '700000', winner: 'a' }]);
const typed = JSON.stringify([{ p1: '810000', p2: '700000', winner: 'a' }]);

describe('shouldResyncDrawer', () => {
  it('resyncs when the drawer has never synced', () => {
    expect(
      shouldResyncDrawer({ lastSyncedMatchId: null, lastSyncedGamesJson: null, currentGamesJson: '[]', matchId: 'm1' })
    ).toBe(true);
  });

  it('resyncs when the match changed', () => {
    expect(
      shouldResyncDrawer({ lastSyncedMatchId: 'm1', lastSyncedGamesJson: synced, currentGamesJson: typed, matchId: 'm2' })
    ).toBe(true);
  });

  it('takes a refresh when nothing has been typed since the last sync', () => {
    expect(
      shouldResyncDrawer({ lastSyncedMatchId: 'm1', lastSyncedGamesJson: synced, currentGamesJson: synced, matchId: 'm1' })
    ).toBe(true);
  });

  it('keeps the judge\'s typing when the games differ from the last sync', () => {
    expect(
      shouldResyncDrawer({ lastSyncedMatchId: 'm1', lastSyncedGamesJson: synced, currentGamesJson: typed, matchId: 'm1' })
    ).toBe(false);
  });
});
