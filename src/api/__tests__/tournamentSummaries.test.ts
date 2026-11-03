import { describe, it, expect, beforeEach } from 'vitest';
import { Readable } from 'node:stream';
import { drizzle } from 'drizzle-orm/node-postgres';
import { setupTestDb } from '../../db/testDb';
import { setDb } from '../../db';
import * as schema from '../../db/schema';
import { getFullTournament, saveFullTournament, listTournamentSummaries } from '../tournaments';
import { createPlayersBatch } from '../players';
import { submitQualifiersBatch } from '../qualifiers';
import { createOrganization } from '../organizations';
import { createApiMiddleware } from '../../server/api';
import { createEmptyTournament, createDefaultTier } from '../../features/tournament/defaults';
import { toTournamentSummary } from '../../features/tournament/summary';
import type { Tournament, TournamentSummary } from '../../features/tournament/types';

function createMockReq(url: string) {
  const req = Readable.from([]) as any;
  req.url = url;
  req.method = 'GET';
  req.headers = {};
  return req;
}

function createMockRes() {
  const headers = new Map<string, string>();
  const res = {
    statusCode: 200,
    body: '',
    setHeader(name: string, val: string) {
      headers.set(name.toLowerCase(), val);
    },
    getHeader(name: string) {
      return headers.get(name.toLowerCase());
    },
    end(chunk?: string) {
      if (typeof chunk === 'string') res.body = chunk;
    },
  };
  return res;
}

async function callApi(url: string): Promise<{ status: number; json: any }> {
  const res = createMockRes();
  await createApiMiddleware()(createMockReq(url), res as any, () => {});
  return { status: res.statusCode, json: JSON.parse(res.body) };
}

const pause = () => new Promise<void>(resolve => setTimeout(resolve, 5));

const sortIds = (s: TournamentSummary): TournamentSummary => ({ ...s, playerIds: [...s.playerIds].sort() });

describe('listTournamentSummaries', () => {
  let statements: string[];
  let runId: string;

  beforeEach(() => {
    const { pool } = setupTestDb();
    statements = [];
    const db = drizzle(pool as any, {
      schema,
      logger: { logQuery: (query: string) => statements.push(query) },
    });
    setDb(db);
    runId = crypto.randomUUID().slice(0, 8);
  });

  async function saveTournament(name: string, overrides: Partial<Tournament> = {}): Promise<Tournament> {
    const saved = await saveFullTournament(
      createEmptyTournament({
        name: `${name} ${runId}`,
        slug: `${name.toLowerCase()}-${runId}`,
        qualFormat: 'HIGH_SCORE',
        ...overrides,
      })
    );
    await pause();
    return saved;
  }

  async function buildThree(): Promise<Tournament[]> {
    const created = await createPlayersBatch(
      Array.from({ length: 4 }, (_, i) => ({ name: `SUM_${crypto.randomUUID()}_P${i + 1}`, country: 'US' }))
    );
    const withPlayers = await saveTournament('Players', {
      tiers: [createDefaultTier(1), createDefaultTier(2)],
      playersPool: created.map(p => ({ id: p.id, name: p.name, personalBest: 0, playstyle: 'Rolling' as const })),
      tournamentPlayers: Object.fromEntries(
        created.map((p, i) => [p.id, { playerId: p.id, tournamentId: '', seed: i + 1, qualsCompleted: false }])
      ),
    });
    await submitQualifiersBatch(
      withPlayers.id,
      created.map((p, i) => ({ playerId: p.id, score: 500_000 - i * 1_000 }))
    );
    const testOne = await saveTournament('Test', { isTest: true });
    const empty = await saveTournament('Empty');
    return [withPlayers, testOne, empty];
  }

  it('returns the same summary as the full tournament for each tournament', async () => {
    const created = await buildThree();
    const summaries = await listTournamentSummaries();

    for (const t of created) {
      const full = await getFullTournament(t.id);
      if (!full) throw new Error('tournament not found');
      const summary = summaries.find(s => s.id === t.id);
      expect(summary).toBeDefined();
      expect(sortIds(summary!)).toEqual(sortIds(toTournamentSummary(full)));
    }

    const withPlayers = summaries.find(s => s.id === created[0].id)!;
    expect(withPlayers.registeredPlayerCount).toBe(4);
    expect(withPlayers.hasRecordedResults).toBe(true);
    expect(summaries.find(s => s.id === created[1].id)!.isTest).toBe(true);
  });

  it('orders the list newest first', async () => {
    const created = await buildThree();
    const summaries = await listTournamentSummaries();
    expect(summaries.map(s => s.id)).toEqual(created.map(t => t.id).reverse());
  });

  it('issues exactly 5 statements regardless of tournament count', async () => {
    await buildThree();
    statements.length = 0;
    await listTournamentSummaries();
    expect(statements).toHaveLength(5);

    await saveTournament('Extra1');
    await saveTournament('Extra2');
    await saveTournament('Extra3');
    statements.length = 0;
    const summaries = await listTournamentSummaries();
    expect(summaries).toHaveLength(6);
    expect(statements).toHaveLength(5);
  });

  it('GET /api/tournaments returns summaries with no scores, players, PINs or webhooks', async () => {
    await buildThree();
    await saveTournament('Webhook', { discordWebhookUrl: 'https://discord.example/webhook' });
    const expected = await listTournamentSummaries();

    const { status, json } = await callApi('/api/tournaments');

    expect(status).toBe(200);
    expect(json).toEqual(JSON.parse(JSON.stringify(expected)));
    for (const item of json) {
      expect(item).not.toHaveProperty('discordWebhookUrl');
      expect(item).not.toHaveProperty('adminPinEncrypted');
      expect(item).not.toHaveProperty('matchScores');
      expect(item).not.toHaveProperty('playersPool');
      expect(item).not.toHaveProperty('qualifierSubmissions');
    }
  });

  it("GET /api/organizations/:id/tournaments returns only that organization's tournaments in full", async () => {
    const org = await createOrganization({ name: `Summary Org ${runId}`, slug: `summary-org-${runId}` });
    const orgTournament = await saveTournament('OrgOne', {
      organizationId: org.id,
      tiers: [createDefaultTier(1)],
      discordWebhookUrl: 'https://discord.example/org-webhook',
    });
    await saveTournament('Other');

    const { status, json } = await callApi(`/api/organizations/${org.id}/tournaments`);

    expect(status).toBe(200);
    expect(json.map((t: Tournament) => t.id)).toEqual([orgTournament.id]);
    for (const t of json as Tournament[]) {
      expect(t.tiers.length).toBeGreaterThan(0);
      t.tiers.forEach(tier => expect(tier.bracket).toBeDefined());
      expect(t).not.toHaveProperty('discordWebhookUrl');
    }
  });
});
