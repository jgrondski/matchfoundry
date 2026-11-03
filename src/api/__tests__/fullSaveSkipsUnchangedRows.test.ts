import { describe, it, expect, beforeEach } from 'vitest';
import { drizzle } from 'drizzle-orm/node-postgres';
import { setupTestDb } from '../../db/testDb';
import { setDb } from '../../db';
import * as schema from '../../db/schema';
import { getFullTournament, saveFullTournament } from '../tournaments';
import { createPlayersBatch } from '../players';
import { submitQualifiersBatch } from '../qualifiers';
import { createEmptyTournament } from '../../features/tournament/defaults';
import type { Tournament } from '../../features/tournament/types';

// A full-tournament save (settings, qual timer) used to issue one UPDATE per player and per qual
// score, even when nothing changed. These tests count the UPDATEs the save actually sends.
describe('saveFullTournament skips unchanged player and qual-score rows', () => {
  let statements: string[];

  beforeEach(() => {
    const { pool } = setupTestDb();
    statements = [];
    const db = drizzle(pool as any, {
      schema,
      logger: { logQuery: (query: string) => statements.push(query.toLowerCase()) },
    });
    setDb(db);
  });

  const updatesTo = (table: string) =>
    statements.filter(q => q.startsWith('update') && q.includes(`"${table}"`)).length;

  async function buildTournament(): Promise<Tournament> {
    const runId = crypto.randomUUID().slice(0, 8);
    const created = await createPlayersBatch(
      Array.from({ length: 6 }, (_, i) => ({ name: `SKIP_${runId}_P${i + 1}`, country: 'US' }))
    );
    const tournamentPlayers = Object.fromEntries(
      created.map((p, i) => [p.id, { playerId: p.id, seed: i + 1, qualsCompleted: false }])
    );
    const saved = await saveFullTournament(
      createEmptyTournament({
        name: `Skip ${runId}`,
        slug: `skip-${runId}`,
        qualFormat: 'HIGH_SCORE',
        playersPool: created.map(p => ({ id: p.id, name: p.name })),
        tournamentPlayers,
      } as Partial<Tournament>)
    );
    await submitQualifiersBatch(
      saved.id,
      created.map((p, i) => ({ playerId: p.id, score: 500_000 - i * 1_000 }))
    );
    const loaded = await getFullTournament(saved.id);
    if (!loaded) throw new Error('tournament not found');
    return loaded;
  }

  it('sends no player or qual-score UPDATEs when only a setting changes', async () => {
    const t = await buildTournament();
    expect(t.qualifierSubmissions.length).toBe(6);

    statements.length = 0;
    const saved = await saveFullTournament({ ...t, location: 'Changed City' });

    expect(saved.location).toBe('Changed City');
    expect(updatesTo('tournament_players')).toBe(0);
    expect(updatesTo('qualifier_submissions')).toBe(0);
  });

  it('still updates exactly the player seed and qual score that changed', async () => {
    const t = await buildTournament();
    const [first, second] = t.playersPool;
    const changedSub = t.qualifierSubmissions.find(s => s.playerId === second.id)!;

    statements.length = 0;
    const saved = await saveFullTournament({
      ...t,
      tournamentPlayers: {
        ...t.tournamentPlayers,
        [first.id]: { ...t.tournamentPlayers[first.id], seed: 99 },
      },
      qualifierSubmissions: t.qualifierSubmissions.map(s =>
        s.id === changedSub.id ? { ...s, score: 123_456 } : s
      ),
    });

    expect(updatesTo('tournament_players')).toBe(1);
    expect(updatesTo('qualifier_submissions')).toBe(1);
    expect(saved.tournamentPlayers[first.id].seed).toBe(99);
    expect(saved.qualifierSubmissions.find(s => s.id === changedSub.id)?.score).toBe(123_456);
  });
});
