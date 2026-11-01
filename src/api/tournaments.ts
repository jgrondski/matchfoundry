import { tournaments, bracketTiers, organizations } from '../db/schema';
import { eq, or, and } from 'drizzle-orm';
import { getDb } from '../db';
import type { BracketType, BracketRouting, EliminationType } from '../features/bracket/types';
import type { TournamentMetadata, TierMetadata } from '../features/tournament/types';
import { DEFAULT_TIER_THEME, LEGACY_TIER_FALLBACK } from '../theme/palette';

export interface TierInput {
  name: string;
  slug?: string;
  bracketType: BracketType;
  numPlayers?: number;
  playerCount?: number;
  priorityOrder: number;
  flatWidth?: number;
  primaryColor?: string;
  secondaryColor?: string;
  eliminationType?: EliminationType;
  bracketRouting?: BracketRouting;
  bestOf?: number;
  metadata?: TierMetadata;
}

export interface TournamentInput {
  name: string;
  slug?: string;
  organizationId?: string;
  qualFormat: 'HIGH_SCORE' | 'AVERAGE_OF_X' | 'POINTS';
  qualAverageCount?: number;
  pointsConfig?: Array<{ minScore: number; points: number }>;
  qualMode?: 'IN_PERSON' | 'ONLINE' | 'HYBRID';
  qualWindowMinutes?: number;
  customAuthWords?: string[];
  isVerified?: boolean;
  metadata?: TournamentMetadata;
  tiers?: TierInput[];
}

export interface TournamentRecord {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  qualFormat: 'HIGH_SCORE' | 'AVERAGE_OF_X' | 'POINTS';
  qualAverageCount: number | null;
  pointsConfig: Array<{ minScore: number; points: number }> | null;
  qualMode?: 'IN_PERSON' | 'ONLINE' | 'HYBRID';
  qualWindowMinutes?: number;
  customAuthWords?: string[] | null;
  qualsClosed: boolean;
  isVerified: boolean;
  createdAt: Date;
}

export interface TierRecord {
  id: string;
  tournamentId: string;
  priorityOrder: number;
  name: string;
  bracketType: BracketType;
  flatWidth: number | null;
  numPlayers: number;
  playerCount: number;
  primaryColor: string;
  secondaryColor: string;
  createdAt: Date;
}

export async function createTournament(input: TournamentInput): Promise<{
  tournament: TournamentRecord;
  tiers: TierRecord[];
}> {
  const db = getDb();
  const orgId = input.organizationId || null;
  const computedSlug = input.slug || input.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const [t] = await db
    .insert(tournaments)
    .values({
      name: input.name,
      slug: computedSlug,
      organizationId: orgId,
      qualFormat: input.qualFormat,
      qualAverageCount: input.qualAverageCount || null,
      pointsConfig: input.pointsConfig || null,
      qualMode: input.qualMode || 'HYBRID',
      qualWindowMinutes: input.qualWindowMinutes ?? 90,
      customAuthWords: input.customAuthWords || null,
      isVerified: input.isVerified || false,
      metadata: input.metadata,
    })
    .returning();

  const createdTiers: TierRecord[] = [];
  if (input.tiers && input.tiers.length > 0) {
    for (const tier of input.tiers) {
      const tierMeta: TierMetadata = {
        eliminationType: tier.eliminationType || 'SINGLE',
        bracketRouting: tier.bracketRouting,
        bestOf: tier.bestOf || 3,
        ...(tier.metadata || {}),
      };
      const resolvedNumPlayers = tier.numPlayers ?? tier.playerCount ?? 16;
      const [tr] = await db
        .insert(bracketTiers)
        .values({
          tournamentId: t.id,
          name: tier.name,
          slug: tier.slug || tier.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
          priorityOrder: tier.priorityOrder,
          bracketType: tier.bracketType,
          flatWidth: tier.flatWidth || null,
          numPlayers: resolvedNumPlayers,
          primaryColor: tier.primaryColor || LEGACY_TIER_FALLBACK.primaryColor,
          secondaryColor: tier.secondaryColor || LEGACY_TIER_FALLBACK.secondaryColor,
          metadata: tierMeta,
        })
        .returning();
      createdTiers.push({
        ...tr,
        playerCount: tr.numPlayers,
      } as TierRecord);
    }
  }

  return { tournament: t as TournamentRecord, tiers: createdTiers };
}

export async function listTournaments(): Promise<TournamentRecord[]> {
  const db = getDb();
  return (await db.select().from(tournaments)) as TournamentRecord[];
}

export function isUuid(val: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
}

export async function getTournament(id: string): Promise<{
  tournament: TournamentRecord;
  tiers: TierRecord[];
} | null> {
  const db = getDb();
  const isIdUuid = isUuid(id);
  const condition = isIdUuid
    ? or(eq(tournaments.id, id), eq(tournaments.slug, id))
    : eq(tournaments.slug, id);
  const t = await db.select().from(tournaments).where(condition).limit(1);
  if (t.length === 0) return null;
  const tr = await db.select().from(bracketTiers).where(eq(bracketTiers.tournamentId, t[0].id));
  const mappedTiers: TierRecord[] = (tr as any[]).map(r => ({
    ...r,
    playerCount: r.numPlayers,
  }));
  return { tournament: t[0] as TournamentRecord, tiers: mappedTiers };
}

export async function deleteTournament(id: string): Promise<boolean> {
  const db = getDb();
  // Foreign keys with CASCADE delete tiers, tournamentPlayers, qualifierSubmissions, matches, and games
  const isIdUuid = isUuid(id);
  const condition = isIdUuid
    ? or(eq(tournaments.id, id), eq(tournaments.slug, id))
    : eq(tournaments.slug, id);
  const res = await db.delete(tournaments).where(condition).returning();
  return res.length > 0;
}


import { players, tournamentPlayers, qualifierSubmissions, matches, games } from '../db/schema';
import { desc, inArray } from 'drizzle-orm';
import type {
  Tournament,
  TournamentTier,
  PlayerProfile,
  TournamentPlayer,
  QualifierSubmission,
  MatchScoreRecord,
} from '../features/tournament/types';
import type { BracketMatch } from '../features/bracket/types';

export async function getFullTournament(idOrSlug: string): Promise<Tournament | null> {
  const db = getDb();
  const isIdUuid = isUuid(idOrSlug);
  const condition = isIdUuid
    ? or(eq(tournaments.id, idOrSlug), eq(tournaments.slug, idOrSlug))
    : eq(tournaments.slug, idOrSlug);

  const tList = await db.select().from(tournaments).where(condition).limit(1);
  if (tList.length === 0) return null;
  const t = tList[0];

  const tiersList = await db
    .select()
    .from(bracketTiers)
    .where(eq(bracketTiers.tournamentId, t.id))
    .orderBy(bracketTiers.priorityOrder);

  const subsList = await db
    .select()
    .from(qualifierSubmissions)
    .where(eq(qualifierSubmissions.tournamentId, t.id))
    .orderBy(desc(qualifierSubmissions.score));

  const tPlayersList = await db
    .select({
      tp: tournamentPlayers,
      player: players,
    })
    .from(tournamentPlayers)
    .innerJoin(players, eq(tournamentPlayers.playerId, players.id))
    .where(eq(tournamentPlayers.tournamentId, t.id));

  const tierIds = (tiersList as any[]).map((tr: any) => tr.id);
  const dbMatches = tierIds.length > 0
    ? await db.select().from(matches).where(inArray(matches.tierId, tierIds))
    : [];

  const matchIds = (dbMatches as any[]).map((m: any) => m.id);
  const dbGames = matchIds.length > 0
    ? await db.select().from(games).where(inArray(games.matchId, matchIds)).orderBy(games.gameNumber)
    : [];

  const gamesByMatch = new Map<string, any[]>();
  for (const g of dbGames as any[]) {
    if (!gamesByMatch.has(g.matchId)) gamesByMatch.set(g.matchId, []);
    gamesByMatch.get(g.matchId)!.push(g);
  }

  const relationalMatchScores: Record<string, MatchScoreRecord> = {};
  for (const m of dbMatches as any[]) {
    const mGames = gamesByMatch.get(m.id) || [];
    let p1Wins = 0;
    let p2Wins = 0;
    for (const g of mGames) {
      if (m.player1Id && g.winnerId === m.player1Id) p1Wins++;
      else if (m.player2Id && g.winnerId === m.player2Id) p2Wins++;
    }
    const bestOf = m.bestOf || 3;
    const threshold = Math.ceil(bestOf / 2);
    const isComplete = Boolean(
      m.isComplete ||
      (m.winnerId && (p1Wins >= threshold || p2Wins >= threshold || m.isForfeit))
    );

    relationalMatchScores[m.id] = {
      matchId: m.id,
      tierId: m.tierId,
      organizationId: t.organizationId,
      bestOf,
      player1Wins: p1Wins,
      player2Wins: p2Wins,
      games: mGames.map((g: any) => ({
        gameNumber: g.gameNumber,
        player1Points: g.player1Score,
        player2Points: g.player2Score,
        winnerPlayerId: g.winnerId,
      })),
      winnerPlayerId: m.winnerId,
      loserPlayerId: m.loserId,
      isComplete,
      notes: m.isForfeit ? 'Forfeit win' : undefined,
      forfeitWinnerId: m.isForfeit ? (m.winnerId || undefined) : undefined,
    };
  }

  const meta = (t.metadata as Record<string, any>) || {};

  const playersPool: PlayerProfile[] = (tPlayersList as any[]).map((row: any) => ({
    id: row.player.id,
    name: row.player.name,
    displayName: row.player.displayName || undefined,
    nickname: row.player.nickname || undefined,
    twitchUsername: row.player.twitchUsername || undefined,
    twitchId: row.player.twitchId || undefined,
    country: row.player.country || undefined,
    avatarType: (row.player.avatarType as any) || 'flag',
    avatarUrl: row.player.avatarUrl || undefined,
    avatarThumbnailUrl: row.player.avatarThumbnailUrl || undefined,
    personalBest: row.player.personalBest,
    playstyle: (row.player.playstyle as any) || 'Rolling',
    notes: row.player.notes || undefined,
    // DQ is tournament-scoped (tournament_players), never the global players flag
    isDisqualified: Boolean(row.tp.isDisqualified),
  }));

  const tournamentPlayersMap: Record<string, TournamentPlayer> = {};
  for (const row of tPlayersList as any[]) {
    tournamentPlayersMap[row.player.id] = {
      tournamentId: t.id,
      playerId: row.player.id,
      seed: row.tp.seed || undefined,
      qualsCompleted: Boolean(row.tp.qualsCompleted),
      isVerified: Boolean(row.tp.qualsCompleted),
    };
  }

  const qualifierSubmissionsList: QualifierSubmission[] = (subsList as any[]).map((s: any) => ({
    id: s.id,
    tournamentId: s.tournamentId,
    playerId: s.playerId,
    score: s.score,
    submittedAt: s.createdAt.getTime(),
    submissionSource: s.submissionSource || 'IN_PERSON',
    authWord: s.authWord || undefined,
    twitchVodUrl: s.twitchVodUrl || undefined,
    submittedTwitchId: s.submittedTwitchId || undefined,
    submittedTwitchUsername: s.submittedTwitchUsername || undefined,
    identityStatus: s.identityStatus || undefined,
    status: s.status || 'VERIFIED',
    timerLog: s.timerLog || undefined,
    judgeNotes: s.judgeNotes || undefined,
    playerNotes: s.playerNotes || undefined,
    verifiedBy: s.verifiedBy || undefined,
    verifiedAt: s.verifiedAt ? new Date(s.verifiedAt).getTime() : undefined,
  }));

  const compositeTiers: TournamentTier[] = (tiersList as any[]).map((tier: any) => {
    const tierMeta = (tier.metadata as Record<string, any>) || {};
    const bracket = tierMeta.bracket ? { ...tierMeta.bracket } : undefined;

    // Reconcile bracket rounds & matchesById with relational database matches
    if (bracket) {
      if (bracket.matchesById) {
        bracket.matchesById = { ...bracket.matchesById };
        for (const [mId, m] of Object.entries(bracket.matchesById)) {
          const score = relationalMatchScores[mId];
          if (score) {
            bracket.matchesById[mId] = {
              ...(m as any),
              winnerId: score.winnerPlayerId,
              loserId: score.loserPlayerId,
              bestOf: score.bestOf,
            };
          }
        }
      }
      if (bracket.rounds) {
        bracket.rounds = bracket.rounds.map((r: any) => ({
          ...r,
          matches: (r.matches || []).map((m: any) => {
            const score = relationalMatchScores[m.id];
            if (score) {
              return {
                ...m,
                winnerId: score.winnerPlayerId,
                loserId: score.loserPlayerId,
                bestOf: score.bestOf,
              };
            }
            return m;
          }),
        }));
      }
    }

    return {
      id: tier.id,
      slug: tier.slug || tier.id,
      name: tier.name,
      priority: tier.priorityOrder,
      bracketType: tier.bracketType as any,
      flatWidth: tier.flatWidth || undefined,
      playerCount: tier.numPlayers,
      primaryColor: tier.primaryColor,
      secondaryColor: tier.secondaryColor,
      cardColor: tierMeta.cardColor,
      textColor: tierMeta.textColor,
      backgroundColor: tierMeta.backgroundColor,
      lowerBracketColor: tierMeta.lowerBracketColor,
      textSize: tierMeta.textSize,
      eliminationType: tierMeta.eliminationType || 'SINGLE',
      bracketRouting: tierMeta.bracketRouting,
      finalsCutoff: tierMeta.finalsCutoff,
      bestOf: tierMeta.bestOf || 3,
      isLocked: Boolean(tierMeta.isLocked || meta.isLocked),
      roundBestOfOverrides: tierMeta.roundBestOfOverrides || {},
      bracket,
    };
  });

  const fullTourney: Tournament = {
    id: t.id,
    organizationId: t.organizationId || meta.organizationId || undefined,
    slug: t.slug,
    name: t.name,
    date: meta.date || '',
    location: meta.location || '',
    seedingMethod: meta.seedingMethod || 'QUALIFIERS',
    manualSeeds: meta.manualSeeds || [],
    qualFormat: t.qualFormat as any,
    qualAverageCount: t.qualAverageCount || undefined,
    pointsConfig: (t.pointsConfig as any) || undefined,
    qualMode: (t.qualMode as any) || meta.qualMode || 'HYBRID',
    qualWindowMinutes: t.qualWindowMinutes ?? meta.qualWindowMinutes ?? 90,
    qualTimer: (meta.qualTimer as any) || undefined,
    customAuthWords: (t.customAuthWords as string[]) || meta.customAuthWords || undefined,
    // Quals close exactly when brackets lock; the column mirrors isLocked and is never latched.
    qualsClosed: Boolean(meta.isLocked),
    onlineQualsOpen: Boolean(t.onlineQualsOpen),
    isLocked: Boolean(meta.isLocked),
    tiers: compositeTiers,
    matchScores: {
      ...(meta.matchScores || {}),
      ...relationalMatchScores,
    },
    playersPool,
    qualifierSubmissions: qualifierSubmissionsList,
    tournamentPlayers: tournamentPlayersMap,
    useOrgBranding: meta.useOrgBranding ?? true,
    logoUrl: meta.logoUrl || undefined,
    bannerUrl: meta.bannerUrl || undefined,
    discordWebhookUrl: t.discordWebhookUrl || meta.discordWebhookUrl || undefined,
    themeColors: meta.themeColors || undefined,
    // adminPinEncrypted is intentionally never returned; PIN checks read the DB row directly.
  };

  return fullTourney;
}

export async function listFullTournaments(): Promise<Tournament[]> {
  const db = getDb();
  const allT = await db.select().from(tournaments).orderBy(desc(tournaments.createdAt));
  const fullList: Tournament[] = [];
  for (const t of allT) {
    const full = await getFullTournament(t.id);
    if (full) fullList.push(full);
  }
  return fullList;
}

export async function saveFullTournament(tourney: Tournament): Promise<Tournament> {
  const db = getDb();
  const tourneyUuid = isUuid(tourney.id) ? tourney.id : crypto.randomUUID();
  const slug = tourney.slug || `tournament-${Date.now()}`;
  
  let orgId: string | null = null;
  if (tourney.organizationId) {
    const [matchingOrg] = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(or(eq(organizations.id, tourney.organizationId), eq(organizations.slug, tourney.organizationId)))
      .limit(1);

    if (matchingOrg) {
      orgId = matchingOrg.id;
    }
  }

  let existing = await db.select().from(tournaments).where(eq(tournaments.id, tourneyUuid)).limit(1);
  if (existing.length === 0 && slug) {
    existing = await db.select().from(tournaments).where(eq(tournaments.slug, slug)).limit(1);
  }

  const qualMode = tourney.qualMode || 'HYBRID';
  const qualWindowMinutes = tourney.qualWindowMinutes ?? 90;
  const customAuthWords = tourney.customAuthWords || null;

  const metadata = {
    organizationId: orgId,
    date: tourney.date || '',
    location: tourney.location || '',
    seedingMethod: tourney.seedingMethod || 'QUALIFIERS',
    manualSeeds: tourney.manualSeeds || [],
    qualMode,
    qualWindowMinutes,
    qualTimer: tourney.qualTimer || undefined,
    customAuthWords: customAuthWords || undefined,
    isLocked: Boolean(tourney.isLocked),
    useOrgBranding: tourney.useOrgBranding ?? true,
    logoUrl: tourney.logoUrl || null,
    bannerUrl: tourney.bannerUrl || null,
    // Omitted (undefined) keeps the stored URL: clients that were sent a redacted tournament
    // must not wipe the webhook when they save other fields.
    discordWebhookUrl:
      tourney.discordWebhookUrl !== undefined
        ? tourney.discordWebhookUrl || null
        : ((existing[0]?.metadata as Record<string, any> | null)?.discordWebhookUrl ?? null),
    themeColors: tourney.themeColors || null,
    matchScores: tourney.matchScores || {},
  };

  let savedTourneyId = tourneyUuid;

  if (existing.length > 0) {
    savedTourneyId = existing[0].id;
    const updatePayload: Record<string, any> = {
      name: tourney.name,
      slug,
      organizationId: orgId,
      qualFormat: tourney.qualFormat,
      qualAverageCount: tourney.qualAverageCount || null,
      pointsConfig: tourney.pointsConfig || null,
      qualMode,
      qualWindowMinutes,
      customAuthWords,
      qualsClosed: Boolean(tourney.isLocked),
      metadata,
    };
    if (tourney.adminPinEncrypted !== undefined) {
      updatePayload.adminPinEncrypted = tourney.adminPinEncrypted;
    }
    await db
      .update(tournaments)
      .set(updatePayload)
      .where(eq(tournaments.id, savedTourneyId));
  } else {
    const [inserted] = await db
      .insert(tournaments)
      .values({
        id: tourneyUuid,
        name: tourney.name,
        slug,
        organizationId: orgId,
        qualFormat: tourney.qualFormat,
        qualAverageCount: tourney.qualAverageCount || null,
        pointsConfig: tourney.pointsConfig || null,
        qualMode,
        qualWindowMinutes,
        customAuthWords,
        qualsClosed: Boolean(tourney.isLocked),
        isVerified: false,
        adminPinEncrypted: tourney.adminPinEncrypted || null,
        metadata,
      })
      .returning();
    savedTourneyId = inserted.id;
  }

  // Sync tiers
  const existingTiers = await db
    .select()
    .from(bracketTiers)
    .where(eq(bracketTiers.tournamentId, savedTourneyId));
  const existingTierIds = new Set((existingTiers as any[]).map((t: any) => t.id));
  const currentTierIds = new Set<string>();

  for (let idx = 0; idx < (tourney.tiers || []).length; idx++) {
    const t = tourney.tiers[idx];
    const tierUuid = isUuid(t.id)
      ? t.id
      : ((existingTiers as any[]).find((et: any) => et.slug === t.slug)?.id || crypto.randomUUID());
    currentTierIds.add(tierUuid);

    const tierMeta = {
      cardColor: t.cardColor,
      textColor: t.textColor,
      backgroundColor: t.backgroundColor,
      lowerBracketColor: t.lowerBracketColor,
      textSize: t.textSize,
      eliminationType: t.eliminationType,
      bracketRouting: t.bracketRouting,
      finalsCutoff: t.finalsCutoff,
      bestOf: t.bestOf,
      isLocked: t.isLocked,
      roundBestOfOverrides: t.roundBestOfOverrides,
      bracket: t.bracket,
    };

    if (existingTierIds.has(tierUuid)) {
      await db
        .update(bracketTiers)
        .set({
          priorityOrder: t.priority ?? idx + 1,
          name: t.name,
          slug: t.slug || t.id,
          bracketType: t.bracketType,
          flatWidth: t.flatWidth || null,
          numPlayers: t.playerCount ?? (t as any).numPlayers ?? 8,
          primaryColor: t.primaryColor || DEFAULT_TIER_THEME.primaryColor,
          secondaryColor: t.secondaryColor || DEFAULT_TIER_THEME.secondaryColor,
          metadata: tierMeta,
        })
        .where(eq(bracketTiers.id, tierUuid));
    } else {
      await db.insert(bracketTiers).values({
        id: tierUuid,
        tournamentId: savedTourneyId,
        priorityOrder: t.priority ?? idx + 1,
        name: t.name,
        slug: t.slug || t.id,
        bracketType: t.bracketType,
        flatWidth: t.flatWidth || null,
        numPlayers: t.playerCount ?? (t as any).numPlayers ?? 8,
        primaryColor: t.primaryColor || DEFAULT_TIER_THEME.primaryColor,
        secondaryColor: t.secondaryColor || DEFAULT_TIER_THEME.secondaryColor,
        metadata: tierMeta,
      });
    }
  }

  // Delete removed tiers
  for (const existingTier of existingTiers) {
    if (!currentTierIds.has(existingTier.id)) {
      await db.delete(bracketTiers).where(eq(bracketTiers.id, existingTier.id));
    }
  }

  // Sync relational matches and games for all active tiers
  for (let idx = 0; idx < (tourney.tiers || []).length; idx++) {
    const t = tourney.tiers[idx];
    const tierUuid = isUuid(t.id)
      ? t.id
      : ((existingTiers as any[]).find((et: any) => et.slug === t.slug)?.id || Array.from(currentTierIds)[idx]);

    if (!tierUuid) continue;

    // Delete existing matches for this tier (foreign key cascade deletes existing games)
    await db.delete(matches).where(eq(matches.tierId, tierUuid));

    const shouldPersistMatches = Boolean(
      tourney.isLocked ||
      t.isLocked ||
      (tourney.matchScores && Object.keys(tourney.matchScores).length > 0)
    );

    if (t.bracket && shouldPersistMatches) {
      const matchMap = new Map<string, BracketMatch>();
      if (t.bracket.matchesById) {
        for (const [mId, m] of Object.entries(t.bracket.matchesById)) {
          matchMap.set(mId, m);
        }
      }
      if (t.bracket.rounds) {
        for (const r of t.bracket.rounds) {
          for (const m of r.matches || []) {
            matchMap.set(m.id, m);
          }
        }
      }

      const matchesToInsert: Array<any> = [];
      const gamesToInsert: Array<any> = [];

      for (const m of matchMap.values()) {
        const scoreRec = tourney.matchScores?.[m.id];
        const p1Id = m.player1?.player?.id && isUuid(m.player1.player.id) ? m.player1.player.id : null;
        const p2Id = m.player2?.player?.id && isUuid(m.player2.player.id) ? m.player2.player.id : null;

        let winId = (scoreRec?.winnerPlayerId && isUuid(scoreRec.winnerPlayerId))
          ? scoreRec.winnerPlayerId
          : ((m.winnerId && isUuid(m.winnerId)) ? m.winnerId : null);
        let losId = (scoreRec?.loserPlayerId && isUuid(scoreRec.loserPlayerId))
          ? scoreRec.loserPlayerId
          : ((m.loserId && isUuid(m.loserId)) ? m.loserId : null);

        if (winId && !losId && p1Id && p2Id) {
          losId = winId === p1Id ? p2Id : p1Id;
        }

        const bestOf = scoreRec?.bestOf || m.bestOf || t.bestOf || 3;
        const threshold = Math.ceil(bestOf / 2);
        const p1Wins = scoreRec?.player1Wins ?? 0;
        const p2Wins = scoreRec?.player2Wins ?? 0;
        const isForfeit = Boolean(
          scoreRec?.forfeitWinnerId || scoreRec?.notes?.toLowerCase().includes('forfeit')
        );
        const isComplete = Boolean(
          scoreRec?.isComplete ||
          (winId && (p1Wins >= threshold || p2Wins >= threshold || isForfeit))
        );

        matchesToInsert.push({
          id: m.id,
          tierId: tierUuid,
          roundNumber: m.roundNumber || 1,
          matchNumber: m.matchNumber || null,
          stage: m.stage || null,
          roundIdentifier: m.roundIdentifier || null,
          player1Id: p1Id,
          player2Id: p2Id,
          winnerId: winId,
          loserId: losId,
          bestOf,
          isForfeit,
          isComplete,
          metadata: {
            nextMatchId: m.nextMatchId,
            nextMatchSlot: m.nextMatchSlot,
            loserNextMatchId: m.loserNextMatchId,
            loserNextMatchSlot: m.loserNextMatchSlot,
            slotA: m.slotA,
            slotB: m.slotB,
            player1SourceMatchId: m.player1?.sourceMatchId,
            player2SourceMatchId: m.player2?.sourceMatchId,
            isBye: m.isBye,
          },
        });

        if (scoreRec?.games && scoreRec.games.length > 0) {
          for (const g of scoreRec.games) {
            if (g.player1Points !== null || g.player2Points !== null || g.winnerPlayerId !== null) {
              const gWinId = g.winnerPlayerId && isUuid(g.winnerPlayerId) ? g.winnerPlayerId : null;
              let gLosId: string | null = null;
              if (gWinId && p1Id && p2Id) {
                gLosId = gWinId === p1Id ? p2Id : p1Id;
              }
              gamesToInsert.push({
                id: crypto.randomUUID(),
                matchId: m.id,
                gameNumber: g.gameNumber,
                player1Score: g.player1Points ?? 0,
                player2Score: g.player2Points ?? 0,
                winnerId: gWinId,
                loserId: gLosId,
                isIntentionalTopout: false,
              });
            }
          }
        }
      }

      if (matchesToInsert.length > 0) {
        const CHUNK = 50;
        for (let i = 0; i < matchesToInsert.length; i += CHUNK) {
          await db.insert(matches).values(matchesToInsert.slice(i, i + CHUNK));
        }
      }

      if (gamesToInsert.length > 0) {
        const CHUNK = 50;
        for (let i = 0; i < gamesToInsert.length; i += CHUNK) {
          await db.insert(games).values(gamesToInsert.slice(i, i + CHUNK));
        }
      }
    }
  }

  // Sync tournament players (non-destructive upsert merge)
  if (Array.isArray(tourney.playersPool)) {
    const existingDbPlayers = await db
      .select()
      .from(tournamentPlayers)
      .where(eq(tournamentPlayers.tournamentId, savedTourneyId));
    const existingDbPlayerIds = new Set((existingDbPlayers as any[]).map((tp: any) => tp.playerId));

    const validPlayers = tourney.playersPool.filter(p => isUuid(p.id));
    const playersToInsert = validPlayers.filter(p => !existingDbPlayerIds.has(p.id));

    if (playersToInsert.length > 0) {
      const CHUNK = 50;
      for (let i = 0; i < playersToInsert.length; i += CHUNK) {
        const chunk = playersToInsert.slice(i, i + CHUNK);
        await db.insert(tournamentPlayers).values(
          chunk.map(p => {
            const tp = tourney.tournamentPlayers?.[p.id];
            const isCompleted = Boolean(tp?.qualsCompleted ?? tp?.isVerified);
            return {
              tournamentId: savedTourneyId,
              playerId: p.id,
              seed: tp?.seed || null,
              qualsCompleted: isCompleted,
            };
          })
        );
      }
    }

    // Fetch existing qualifier submissions early so we can cross-reference verified online runs
    const existingDbSubs = await db
      .select()
      .from(qualifierSubmissions)
      .where(eq(qualifierSubmissions.tournamentId, savedTourneyId));

    // Update existing players' seeds or qualsCompleted if provided
    for (const p of validPlayers) {
      if (existingDbPlayerIds.has(p.id)) {
        const tp = tourney.tournamentPlayers?.[p.id];
        if (tp) {
          const existingPlayerRecord = (existingDbPlayers as any[]).find((r: any) => r.playerId === p.id);
          // Check if competitor has an active VERIFIED online submission in PostgreSQL
          const hasVerifiedDbOnlineSub = existingDbSubs.some(
            (s: any) => s.playerId === p.id && s.submissionSource === 'ONLINE' && s.status === 'VERIFIED'
          );
          const isDbCompleted = Boolean(existingPlayerRecord?.qualsCompleted || hasVerifiedDbOnlineSub);

          let isCompleted = Boolean(tp.qualsCompleted || tp.isVerified);
          // If the player is already verified in PostgreSQL by judge adjudication, do not let a stale
          // admin tab's qualsCompleted: false downgrade their status in DB.
          if (!isCompleted && isDbCompleted && hasVerifiedDbOnlineSub) {
            isCompleted = true;
          }

          await db
            .update(tournamentPlayers)
            .set({
              seed: tp.seed || null,
              qualsCompleted: isCompleted,
            })
            .where(
              and(
                eq(tournamentPlayers.tournamentId, savedTourneyId),
                eq(tournamentPlayers.playerId, p.id)
              )
            );
        }
      }
    }
  }

  // Sync qualifier submissions (non-destructive upsert merge)
  if (Array.isArray(tourney.qualifierSubmissions)) {
    const existingDbSubs = await db
      .select()
      .from(qualifierSubmissions)
      .where(eq(qualifierSubmissions.tournamentId, savedTourneyId));
    const existingDbSubMap = new Map((existingDbSubs as any[]).map(s => [s.id, s]));

    const validSubs = tourney.qualifierSubmissions.filter(s => isUuid(s.playerId));
    const toInsert: Array<typeof qualifierSubmissions.$inferInsert> = [];

    for (const s of validSubs) {
      const isOurUuid = isUuid(s.id) && s.tournamentId === savedTourneyId;
      if (isOurUuid && existingDbSubMap.has(s.id)) {
        const existingSub = existingDbSubMap.get(s.id)!;
        const isOnline = (existingSub as any).submissionSource === 'ONLINE';

        // Online submissions are owned exclusively by the /qualify/* endpoints (portal + judge adjudication).
        // A full-tournament PUT is a client snapshot that may be stale, so it never mutates them.
        if (isOnline) {
          continue;
        }

        const resolvedScore = s.score;

        const resolvedStatus = (s.status as any) || (existingSub as any).status || 'SUBMITTED';

        // Update existing record
        await db
          .update(qualifierSubmissions)
          .set({
            score: resolvedScore,
            status: resolvedStatus,
            submissionSource: (existingSub as any).submissionSource || (s.submissionSource as any) || 'IN_PERSON',
            authWord: (existingSub as any).authWord || s.authWord || null,
            twitchVodUrl: (existingSub as any).twitchVodUrl || s.twitchVodUrl || null,
            submittedTwitchId: (existingSub as any).submittedTwitchId || s.submittedTwitchId || null,
            submittedTwitchUsername: (existingSub as any).submittedTwitchUsername || s.submittedTwitchUsername || null,
            identityStatus: (existingSub as any).identityStatus || (s.identityStatus as any) || null,
            timerLog: (existingSub as any).timerLog || s.timerLog || null,
            judgeNotes: s.judgeNotes || (existingSub as any).judgeNotes || null,
            verifiedBy: s.verifiedBy || (existingSub as any).verifiedBy || null,
            verifiedAt: s.verifiedAt ? new Date(s.verifiedAt) : ((existingSub as any).verifiedAt || null),
          })
          .where(eq(qualifierSubmissions.id, s.id));
      } else {
        // Issue 1: If s.submissionSource === 'ONLINE', NEVER insert it via saveFullTournament!
        // Online submissions are created and replaced exclusively by the dedicated /qualify/* endpoints.
        // Inserting here resurrects deleted placeholder rows (e.g. replaced IN_PROGRESS or voided rows)
        // when a stale admin client sends an outdated qualifierSubmissions array in PUT.
        if (s.submissionSource === 'ONLINE') {
          continue;
        }

        // Also, if isOurUuid is true but existingDbSubMap does NOT have it, this was a previously persisted
        // submission in this tournament that was deleted via DELETE /qualifiers/:subId or clear. Do not resurrect!
        if (isOurUuid && existingDbSubs.length > 0) {
          continue;
        }

        toInsert.push({
          id: isOurUuid ? s.id : crypto.randomUUID(),
          tournamentId: savedTourneyId,
          playerId: s.playerId,
          score: s.score,
          submissionSource: (s.submissionSource as any) || 'IN_PERSON',
          authWord: s.authWord || null,
          twitchVodUrl: s.twitchVodUrl || null,
          submittedTwitchId: s.submittedTwitchId || null,
          submittedTwitchUsername: s.submittedTwitchUsername || null,
          identityStatus: (s.identityStatus as any) || null,
          status: (s.status as any) || 'SUBMITTED',
          timerLog: s.timerLog || null,
          judgeNotes: s.judgeNotes || null,
          verifiedBy: s.verifiedBy || null,
          verifiedAt: s.verifiedAt ? new Date(s.verifiedAt) : null,
          createdAt: new Date(s.submittedAt || Date.now()),
        });
      }
    }

    if (toInsert.length > 0) {
      const CHUNK = 50;
      for (let i = 0; i < toInsert.length; i += CHUNK) {
        await db.insert(qualifierSubmissions).values(toInsert.slice(i, i + CHUNK));
      }
    }
  }

  const loaded = await getFullTournament(savedTourneyId);
  return loaded || { ...tourney, id: savedTourneyId };
}

