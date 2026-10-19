import { describe, it, expect, beforeEach } from 'vitest';
import { setupTestDb } from '../../db/testDb';
import { setDb } from '../../db';
import { players, qualifierSubmissions, tournamentPlayers } from '../../db/schema';
import { createApiMiddleware } from '../../server/api';
import { createSessionToken } from '../../server/pinCrypto';
import { createTournament, getFullTournament, saveFullTournament } from '../tournaments';
import { eq } from 'drizzle-orm';

describe('Player Deletion & Lifecycle Integrity (Regression)', () => {
  let db: any;
  let middleware: any;

  beforeEach(() => {
    const testDb = setupTestDb();
    db = testDb.db;
    setDb(db);
    middleware = createApiMiddleware();
  });

  const makeHttpRequest = async (url: string, method: string, body?: any) => {
    let statusCode = 0;
    let responseBody = '';
    const req: any = {
      url,
      method,
      headers: {
        authorization: `Bearer ${createSessionToken({ role: 'SYSTEM_ADMIN' })}`,
        'content-type': 'application/json',
      },
      body,
      on: (event: string, callback: any) => {
        if (event === 'data' && body) {
          callback(Buffer.from(JSON.stringify(body)));
        }
        if (event === 'end') {
          callback();
        }
      },
    };
    const res: any = {
      setHeader: () => {},
      end: (data: string) => {
        responseBody = data;
      },
      set statusCode(val: number) {
        statusCode = val;
      },
      get statusCode() {
        return statusCode;
      },
    };
    await middleware(req, res, () => {});
    return {
      status: statusCode,
      body: responseBody ? JSON.parse(responseBody) : null,
    };
  };

  it('1. DELETE /api/players/:id succeeds for an unattached global player', async () => {
    const playerId = crypto.randomUUID();
    await db.insert(players).values({
      id: playerId,
      name: 'Unattached Player',
      country: 'US',
    });

    const res = await makeHttpRequest(`/api/players/${playerId}`, 'DELETE');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });

    const check = await db.select().from(players).where(eq(players.id, playerId));
    expect(check.length).toBe(0);
  });

  it('2. DELETE /api/players/:id returns 400 (not 500) when player is enrolled in a tournament', async () => {
    const playerId = crypto.randomUUID();
    await db.insert(players).values({
      id: playerId,
      name: 'Omenvoir',
      country: 'US',
    });

    const { tournament } = await createTournament({
      name: 'Omen DAS',
      organizationId: 'org_ctwc',
      qualFormat: 'HIGH_SCORE',
      tiers: [{ name: 'Gold', bracketType: 'TRADITIONAL', numPlayers: 8, priorityOrder: 1 }],
    });

    // Enroll player and add a qualifier submission
    await db.insert(tournamentPlayers).values({
      tournamentId: tournament.id,
      playerId,
    });
    await db.insert(qualifierSubmissions).values({
      tournamentId: tournament.id,
      playerId,
      score: 850000,
    });

    // Attempting to delete Omenvoir must be blocked with HTTP 400 with a descriptive error
    const res = await makeHttpRequest(`/api/players/${playerId}`, 'DELETE');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/enrolled in/i);
    expect(res.body.error).toContain('Omen DAS');

    // Player still exists in DB
    const check = await db.select().from(players).where(eq(players.id, playerId));
    expect(check.length).toBe(1);
    expect(check[0].name).toBe('Omenvoir');
  });

  it('3. DELETE /api/players deletes all unattached players while preserving enrolled players', async () => {
    const unattachedId1 = crypto.randomUUID();
    const unattachedId2 = crypto.randomUUID();
    const enrolledId = crypto.randomUUID();

    await db.insert(players).values([
      { id: unattachedId1, name: 'Simulated 1' },
      { id: unattachedId2, name: 'Simulated 2' },
      { id: enrolledId, name: 'Active Enrolled' },
    ]);

    const { tournament } = await createTournament({
      name: 'Active Championship',
      organizationId: 'org_ctwc',
      qualFormat: 'HIGH_SCORE',
      tiers: [{ name: 'Gold', bracketType: 'TRADITIONAL', numPlayers: 8, priorityOrder: 1 }],
    });

    await db.insert(tournamentPlayers).values({
      tournamentId: tournament.id,
      playerId: enrolledId,
    });

    const res = await makeHttpRequest('/api/players', 'DELETE');
    expect(res.status).toBe(200);
    expect(res.body.deletedIds).toContain(unattachedId1);
    expect(res.body.deletedIds).toContain(unattachedId2);
    expect(res.body.deletedIds).not.toContain(enrolledId);
    expect(res.body.skippedCount).toBe(1);

    const remaining = await db.select().from(players);
    expect(remaining.map((p: any) => p.id)).toEqual([enrolledId]);
  });

  it('4. DELETE /api/tournaments/:id/players/:playerId is blocked when isLocked or has qualifier scores, and succeeds when unwound', async () => {
    const playerId = crypto.randomUUID();
    await db.insert(players).values({
      id: playerId,
      name: 'Roster Player',
    });

    const { tournament } = await createTournament({
      name: 'Locked Tourney',
      organizationId: 'org_ctwc',
      qualFormat: 'HIGH_SCORE',
      tiers: [{ name: 'Gold', bracketType: 'TRADITIONAL', numPlayers: 8, priorityOrder: 1 }],
    });

    await db.insert(tournamentPlayers).values({
      tournamentId: tournament.id,
      playerId,
    });
    await db.insert(qualifierSubmissions).values({
      tournamentId: tournament.id,
      playerId,
      score: 500000,
    });

    // Lock tournament (Stage 4)
    await makeHttpRequest(`/api/tournaments/${tournament.id}/lock`, 'POST');

    // Removing competitor while locked must be blocked with HTTP 400
    const blockedRes = await makeHttpRequest(`/api/tournaments/${tournament.id}/players/${playerId}`, 'DELETE');
    expect(blockedRes.status).toBe(400);
    expect(blockedRes.body.error).toMatch(/locked/i);

    // Unlock tournament
    await makeHttpRequest(`/api/tournaments/${tournament.id}/unlock`, 'POST');

    // Removing competitor while qualifier submission exists must still be blocked with HTTP 400 (Stage 3 blocks Stage 2)
    const blockedByQualRes = await makeHttpRequest(`/api/tournaments/${tournament.id}/players/${playerId}`, 'DELETE');
    expect(blockedByQualRes.status).toBe(400);
    expect(blockedByQualRes.body.error).toMatch(/qualifier score/i);

    // Get qualifier submission to delete it
    const subs = await db.select().from(qualifierSubmissions).where(eq(qualifierSubmissions.playerId, playerId));
    expect(subs.length).toBe(1);

    // Delete qualifier submission (unwind Stage 3)
    const deleteQualRes = await makeHttpRequest(`/api/tournaments/${tournament.id}/qualifiers/${subs[0].id}`, 'DELETE');
    expect(deleteQualRes.status).toBe(200);

    // Now removing competitor from tournament roster succeeds (unwind Stage 2)
    const removeRes = await makeHttpRequest(`/api/tournaments/${tournament.id}/players/${playerId}`, 'DELETE');
    expect(removeRes.status).toBe(200);

    // tournamentPlayer row was cleaned up
    const tpCheck = await db.select().from(tournamentPlayers).where(eq(tournamentPlayers.playerId, playerId));
    const qsCheck = await db.select().from(qualifierSubmissions).where(eq(qualifierSubmissions.playerId, playerId));
    expect(tpCheck.length).toBe(0);
    expect(qsCheck.length).toBe(0);

    // Now global player deletion succeeds! (unwind Stage 1)
    const deleteGlobalRes = await makeHttpRequest(`/api/players/${playerId}`, 'DELETE');
    expect(deleteGlobalRes.status).toBe(200);
    expect(deleteGlobalRes.body).toEqual({ success: true });
  });

  it('5. Qualifier modifications (POST / DELETE / clear) are blocked when isLocked', async () => {
    const playerId = crypto.randomUUID();
    await db.insert(players).values({
      id: playerId,
      name: 'Locked Quals Competitor',
    });

    const { tournament } = await createTournament({
      name: 'Locked Quals Tourney',
      organizationId: 'org_ctwc',
      qualFormat: 'HIGH_SCORE',
      tiers: [{ name: 'Gold', bracketType: 'TRADITIONAL', numPlayers: 8, priorityOrder: 1 }],
    });

    await db.insert(tournamentPlayers).values({
      tournamentId: tournament.id,
      playerId,
    });
    const [sub] = await db.insert(qualifierSubmissions).values({
      tournamentId: tournament.id,
      playerId,
      score: 600000,
    }).returning();

    // Lock tournament
    await makeHttpRequest(`/api/tournaments/${tournament.id}/lock`, 'POST');

    // 1. Attempting to clear qualifiers while locked must be blocked with HTTP 400
    const res = await makeHttpRequest(`/api/tournaments/${tournament.id}/qualifiers`, 'DELETE');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/locked/i);

    // 2. Attempting to add qualifier while locked must be blocked with HTTP 400
    const addRes = await makeHttpRequest(`/api/tournaments/${tournament.id}/qualifiers`, 'POST', {
      playerId,
      score: 700000,
    });
    expect(addRes.status).toBe(400);
    expect(addRes.body.error).toMatch(/locked/i);

    // 3. Attempting to delete individual qualifier submission while locked must be blocked with HTTP 400
    const deleteSubRes = await makeHttpRequest(`/api/tournaments/${tournament.id}/qualifiers/${sub.id}`, 'DELETE');
    expect(deleteSubRes.status).toBe(400);
    expect(deleteSubRes.body.error).toMatch(/locked/i);
  });

  it('6. POST /api/tournaments/:id/unlock followed by lock preserves manual slot swaps', async () => {
    // Create 8 competitors
    const competitorIds: string[] = [];
    for (let i = 1; i <= 8; i++) {
      const pid = crypto.randomUUID();
      competitorIds.push(pid);
      await db.insert(players).values({
        id: pid,
        name: `Comp_${i}`,
      });
    }

    const { tournament } = await createTournament({
      name: 'Slot Swap Tourney',
      organizationId: 'org_ctwc',
      qualFormat: 'HIGH_SCORE',
      tiers: [{ name: 'Gold', bracketType: 'TRADITIONAL', numPlayers: 8, priorityOrder: 1 }],
    });

    // Add players and qualifiers
    for (let i = 0; i < 8; i++) {
      await db.insert(tournamentPlayers).values({
        tournamentId: tournament.id,
        playerId: competitorIds[i],
      });
      await db.insert(qualifierSubmissions).values({
        tournamentId: tournament.id,
        playerId: competitorIds[i],
        score: (8 - i) * 100000,
      });
    }

    // Refresh draft bracket and lock
    const tourneyWithTiers = await getFullTournament(tournament.id);
    const { generateDraftBracketsForTournament } = await import('../../features/qualifiers/scoring');
    tourneyWithTiers!.tiers = generateDraftBracketsForTournament(tourneyWithTiers!);
    await saveFullTournament(tourneyWithTiers!);
    await makeHttpRequest(`/api/tournaments/${tournament.id}/lock`, 'POST');

    const lockedTourney = await getFullTournament(tournament.id);
    const goldTier = lockedTourney!.tiers[0];
    const r1Matches = Object.values(goldTier.bracket.matchesById).filter((m: any) => m.roundNumber === 1);
    expect(r1Matches.length).toBeGreaterThanOrEqual(2);

    const m1 = r1Matches[0];
    const m2 = r1Matches[1];

    // Swap slots
    const swapRes = await makeHttpRequest(`/api/tournaments/${tournament.id}/matches/swap-slots`, 'POST', {
      tierId: goldTier.id,
      sourceMatchId: m1.id,
      sourceSlot: 1,
      targetMatchId: m2.id,
      targetSlot: 1,
    });
    expect(swapRes.status).toBe(200);

    const swappedTourney = await getFullTournament(tournament.id);
    const swappedGold = swappedTourney!.tiers[0];
    const swappedPlayer1 = swappedGold.bracket.matchesById[m1.id].player1.player?.id;

    // Misclick: Unlock then immediate Re-Lock
    const unlockRes = await makeHttpRequest(`/api/tournaments/${tournament.id}/unlock`, 'POST');
    expect(unlockRes.status).toBe(200);

    const relockRes = await makeHttpRequest(`/api/tournaments/${tournament.id}/lock`, 'POST');
    expect(relockRes.status).toBe(200);

    // Verify manual slot swap was preserved!
    const relockedTourney = await getFullTournament(tournament.id);
    const relockedGold = relockedTourney!.tiers[0];
    expect(relockedGold.bracket.matchesById[m1.id].player1.player?.id).toBe(swappedPlayer1);
  });
});
