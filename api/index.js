var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/db/index.ts
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { neon } from "@neondatabase/serverless";
import pg from "pg";

// src/db/schema.ts
var schema_exports = {};
__export(schema_exports, {
  bracketTiers: () => bracketTiers,
  games: () => games,
  matches: () => matches,
  organizations: () => organizations,
  players: () => players,
  qualifierSubmissions: () => qualifierSubmissions,
  systemSettings: () => systemSettings,
  tournamentPlayers: () => tournamentPlayers,
  tournaments: () => tournaments
});
import { pgTable, uuid, text, integer, boolean, jsonb, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
var players = pgTable(
  "players",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    displayName: text("display_name"),
    nickname: text("nickname"),
    twitchUsername: text("twitch_username"),
    country: text("country"),
    avatarType: text("avatar_type", { enum: ["flag", "custom"] }).notNull().default("flag"),
    avatarUrl: text("avatar_url"),
    avatarThumbnailUrl: text("avatar_thumbnail_url"),
    personalBest: integer("personal_best").default(0).notNull(),
    playstyle: text("playstyle"),
    notes: text("notes"),
    isDisqualified: boolean("is_disqualified").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow().notNull()
  },
  (table) => [
    uniqueIndex("players_name_lower_idx").on(sql`lower(trim(${table.name}))`)
  ]
);
var organizations = pgTable(
  "organizations",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    shortName: text("short_name"),
    description: text("description"),
    website: text("website"),
    brandColor: text("brand_color"),
    themeColors: jsonb("theme_colors").$type(),
    tierThemes: jsonb("tier_themes").$type(),
    branding: jsonb("branding").$type(),
    discordWebhookUrl: text("discord_webhook_url"),
    defaultRules: jsonb("default_rules").$type(),
    createdAt: timestamp("created_at").defaultNow().notNull()
  },
  (table) => [
    uniqueIndex("organizations_slug_idx").on(table.slug)
  ]
);
var tournaments = pgTable("tournaments", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: text("organization_id").references(() => organizations.id, { onDelete: "restrict" }),
  name: text("name").notNull(),
  slug: text("slug").notNull().default(""),
  qualFormat: text("qual_format", { enum: ["HIGH_SCORE", "AVERAGE_OF_X", "POINTS"] }).notNull(),
  qualAverageCount: integer("qual_average_count"),
  pointsConfig: jsonb("points_config").$type(),
  qualsClosed: boolean("quals_closed").notNull().default(false),
  isVerified: boolean("is_verified").notNull().default(false),
  adminPinEncrypted: text("admin_pin_encrypted"),
  metadata: jsonb("metadata").$type(),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var bracketTiers = pgTable("bracket_tiers", {
  id: uuid("id").defaultRandom().primaryKey(),
  tournamentId: uuid("tournament_id").references(() => tournaments.id, { onDelete: "cascade" }).notNull(),
  priorityOrder: integer("priority_order").notNull(),
  name: text("name").notNull(),
  slug: text("slug").notNull().default(""),
  bracketType: text("bracket_type", { enum: ["TRADITIONAL", "FLAT"] }).notNull(),
  flatWidth: integer("flat_width"),
  numPlayers: integer("num_players").notNull(),
  primaryColor: text("primary_color").notNull().default("#FFD700"),
  secondaryColor: text("secondary_color").notNull().default("#000000"),
  metadata: jsonb("metadata").$type(),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var tournamentPlayers = pgTable("tournament_players", {
  id: uuid("id").defaultRandom().primaryKey(),
  tournamentId: uuid("tournament_id").references(() => tournaments.id, { onDelete: "cascade" }).notNull(),
  playerId: uuid("player_id").references(() => players.id, { onDelete: "restrict" }).notNull(),
  tierId: uuid("tier_id").references(() => bracketTiers.id, { onDelete: "set null" }),
  seed: integer("seed"),
  qualsCompleted: boolean("quals_completed").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var qualifierSubmissions = pgTable("qualifier_submissions", {
  id: uuid("id").defaultRandom().primaryKey(),
  tournamentId: uuid("tournament_id").references(() => tournaments.id, { onDelete: "cascade" }).notNull(),
  playerId: uuid("player_id").references(() => players.id, { onDelete: "restrict" }).notNull(),
  score: integer("score").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var matches = pgTable(
  "matches",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    tierId: uuid("tier_id").references(() => bracketTiers.id, { onDelete: "cascade" }).notNull(),
    roundNumber: integer("round_number").notNull(),
    matchNumber: integer("match_number"),
    stage: text("stage"),
    roundIdentifier: text("round_identifier"),
    player1Id: uuid("player1_id").references(() => players.id, { onDelete: "set null" }),
    player2Id: uuid("player2_id").references(() => players.id, { onDelete: "set null" }),
    winnerId: uuid("winner_id").references(() => players.id, { onDelete: "set null" }),
    loserId: uuid("loser_id").references(() => players.id, { onDelete: "set null" }),
    bestOf: integer("best_of").notNull().default(3),
    isForfeit: boolean("is_forfeit").notNull().default(false),
    isComplete: boolean("is_complete").notNull().default(false),
    metadata: jsonb("metadata").$type(),
    createdAt: timestamp("created_at").defaultNow().notNull()
  },
  (table) => [
    index("matches_player1_idx").on(table.player1Id),
    index("matches_player2_idx").on(table.player2Id)
  ]
);
var games = pgTable("games", {
  id: uuid("id").defaultRandom().primaryKey(),
  matchId: text("match_id").references(() => matches.id, { onDelete: "cascade" }).notNull(),
  gameNumber: integer("game_number").notNull(),
  player1Score: integer("player1_score").notNull().default(0),
  player2Score: integer("player2_score").notNull().default(0),
  winnerId: uuid("winner_id").references(() => players.id, { onDelete: "set null" }),
  loserId: uuid("loser_id").references(() => players.id, { onDelete: "set null" }),
  isIntentionalTopout: boolean("is_intentional_topout").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var systemSettings = pgTable("system_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").$type().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// src/db/config.ts
function assertDatabaseConfig() {
  if (typeof window !== "undefined") {
    return "";
  }
  const url = (typeof process !== "undefined" ? process.env?.DATABASE_URL : "") || "";
  if (!url) {
    throw new Error(
      'Configuration Error: DATABASE_URL is missing. Please copy .env.example to .env and run "npm run db:up".'
    );
  }
  return url;
}

// src/db/index.ts
var pgPool = null;
var currentDbInstance = null;
function getDb(connectionString) {
  if (currentDbInstance) {
    return currentDbInstance;
  }
  const url = connectionString || assertDatabaseConfig();
  if (url.includes("neon.tech")) {
    const sql4 = neon(url);
    currentDbInstance = drizzleNeon(sql4, { schema: schema_exports });
    return currentDbInstance;
  }
  if (!pgPool) {
    pgPool = new pg.Pool({ connectionString: url });
  }
  currentDbInstance = drizzlePg(pgPool, { schema: schema_exports });
  return currentDbInstance;
}

// src/server/api.ts
import { sql as sql3, eq as eq6, or as or3 } from "drizzle-orm";

// src/server/pinCrypto.ts
import crypto2 from "crypto";
if (typeof process !== "undefined" && typeof process.loadEnvFile === "function") {
  if (!process.env.SYSTEM_ADMIN_RECOVERY_PIN && !process.env.PIN_ENCRYPTION_KEY) {
    try {
      process.loadEnvFile();
    } catch {
    }
  }
}
var DEFAULT_DEV_KEY = "tournament-manager-secret-dev-pin-encryption-key-32b";
var SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1e3;
function deriveKey(rawKey) {
  const secret = rawKey || process.env.PIN_ENCRYPTION_KEY || DEFAULT_DEV_KEY;
  return crypto2.createHash("sha256").update(secret).digest();
}
function encryptPin(plaintextPin, secretKey) {
  if (!plaintextPin) {
    throw new Error("Cannot encrypt empty PIN");
  }
  const key = deriveKey(secretKey);
  const iv = crypto2.randomBytes(12);
  const cipher = crypto2.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintextPin, "utf8"),
    cipher.final()
  ]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${ciphertext.toString("hex")}`;
}
function decryptPin(encryptedPayload, secretKey) {
  if (!encryptedPayload) {
    throw new Error("Cannot decrypt empty payload");
  }
  const parts = encryptedPayload.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted PIN payload format");
  }
  const [ivHex, authTagHex, ciphertextHex] = parts;
  const key = deriveKey(secretKey);
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const ciphertext = Buffer.from(ciphertextHex, "hex");
  const decipher = crypto2.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final()
  ]);
  return decrypted.toString("utf8");
}
function safeCompareStrings(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return crypto2.timingSafeEqual(bufA, bufB);
}
function isSystemRecoveryPin(candidatePin) {
  let recoveryPin = (process.env.SYSTEM_ADMIN_RECOVERY_PIN || process.env.MASTER_ADMIN_RECOVERY_PIN || "").trim();
  if (recoveryPin.startsWith('"') && recoveryPin.endsWith('"') || recoveryPin.startsWith("'") && recoveryPin.endsWith("'")) {
    recoveryPin = recoveryPin.slice(1, -1).trim();
  }
  if (!recoveryPin || !candidatePin) return false;
  return safeCompareStrings(candidatePin.trim(), recoveryPin);
}
function createSessionToken(params, secretKey) {
  const issuedAt = Date.now();
  const expiresAt = issuedAt + (params.customDurationMs ?? SESSION_DURATION_MS);
  const normalizedRole = params.role === "MASTER_ADMIN" ? "SYSTEM_ADMIN" : params.role;
  const payload = {
    role: normalizedRole,
    ...params.tournamentId ? { tournamentId: params.tournamentId } : {},
    ...params.tournamentSlug ? { tournamentSlug: params.tournamentSlug } : {},
    ...params.tournamentIds && params.tournamentIds.length > 0 ? { tournamentIds: params.tournamentIds } : {},
    ...params.tournamentSlugs && params.tournamentSlugs.length > 0 ? { tournamentSlugs: params.tournamentSlugs } : {},
    issuedAt,
    expiresAt
  };
  const payloadStr = JSON.stringify(payload);
  const payloadB64 = Buffer.from(payloadStr, "utf8").toString("base64url");
  const key = deriveKey(secretKey);
  const signature = crypto2.createHmac("sha256", key).update(payloadB64).digest("base64url");
  return `${payloadB64}.${signature}`;
}
function verifySessionToken(token, secretKey) {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, providedSig] = parts;
  const key = deriveKey(secretKey);
  const expectedSig = crypto2.createHmac("sha256", key).update(payloadB64).digest("base64url");
  if (!safeCompareStrings(providedSig, expectedSig)) {
    return null;
  }
  try {
    const payloadStr = Buffer.from(payloadB64, "base64url").toString("utf8");
    const payload = JSON.parse(payloadStr);
    if (!payload.expiresAt || typeof payload.expiresAt !== "number") {
      return null;
    }
    if (Date.now() > payload.expiresAt) {
      return null;
    }
    if (payload.role === "MASTER_ADMIN") {
      payload.role = "SYSTEM_ADMIN";
    }
    return payload;
  } catch {
    return null;
  }
}

// src/api/players.ts
import { eq, sql as sql2 } from "drizzle-orm";
async function createPlayer(data) {
  const trimmed = data.name.trim();
  if (!trimmed) throw new Error("Player name is required");
  const lower = trimmed.toLowerCase();
  const db = getDb();
  const existing = await db.select().from(players).where(sql2`lower(trim(${players.name})) = ${lower}`).limit(1);
  if (existing.length > 0) {
    throw new Error(`Player with name "${trimmed}" already exists`);
  }
  const cleanTwitch = data.twitchUsername ? data.twitchUsername.trim().replace(/^@/, "") : null;
  const [created] = await db.insert(players).values({
    name: trimmed,
    displayName: data.displayName?.trim() || null,
    nickname: data.nickname?.trim() || null,
    twitchUsername: cleanTwitch || null,
    country: data.country || null,
    avatarType: data.avatarType || "flag",
    avatarUrl: data.avatarUrl || null,
    avatarThumbnailUrl: data.avatarThumbnailUrl || null,
    personalBest: data.personalBest ?? 0,
    playstyle: data.playstyle || null,
    notes: data.notes || null
  }).returning();
  return created;
}
async function createPlayersBatch(records) {
  const db = getDb();
  if (records.length === 0) return [];
  const inserted = await db.insert(players).values(records.map((r) => ({
    name: r.name.trim(),
    displayName: r.displayName?.trim() || null,
    nickname: r.nickname?.trim() || null,
    twitchUsername: r.twitchUsername ? r.twitchUsername.trim().replace(/^@/, "") : null,
    country: r.country || null,
    avatarType: r.avatarType || "flag",
    avatarUrl: r.avatarUrl || null,
    avatarThumbnailUrl: r.avatarThumbnailUrl || null,
    personalBest: r.personalBest ?? 0,
    playstyle: r.playstyle || null,
    notes: r.notes || null
  }))).onConflictDoNothing().returning();
  return inserted;
}
async function listPlayers() {
  const db = getDb();
  return await db.select().from(players);
}
async function getPlayer(id) {
  const db = getDb();
  const res = await db.select().from(players).where(eq(players.id, id)).limit(1);
  return res[0] || null;
}
async function updatePlayer(id, updates) {
  const db = getDb();
  const sanitized = { ...updates };
  if (typeof sanitized.twitchUsername === "string") {
    sanitized.twitchUsername = sanitized.twitchUsername.trim().replace(/^@/, "") || null;
  }
  const [updated] = await db.update(players).set(sanitized).where(eq(players.id, id)).returning();
  return updated || null;
}
async function deletePlayer(id) {
  const db = getDb();
  const res = await db.delete(players).where(eq(players.id, id)).returning();
  return res.length > 0;
}

// src/api/tournaments.ts
import { eq as eq2, or } from "drizzle-orm";
import { desc, inArray } from "drizzle-orm";
function isUuid(val) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
}
async function deleteTournament(id) {
  const db = getDb();
  const isIdUuid = isUuid(id);
  const condition = isIdUuid ? or(eq2(tournaments.id, id), eq2(tournaments.slug, id)) : eq2(tournaments.slug, id);
  const res = await db.delete(tournaments).where(condition).returning();
  return res.length > 0;
}
async function getFullTournament(idOrSlug) {
  const db = getDb();
  const isIdUuid = isUuid(idOrSlug);
  const condition = isIdUuid ? or(eq2(tournaments.id, idOrSlug), eq2(tournaments.slug, idOrSlug)) : eq2(tournaments.slug, idOrSlug);
  const tList = await db.select().from(tournaments).where(condition).limit(1);
  if (tList.length === 0) return null;
  const t = tList[0];
  const tiersList = await db.select().from(bracketTiers).where(eq2(bracketTiers.tournamentId, t.id)).orderBy(bracketTiers.priorityOrder);
  const subsList = await db.select().from(qualifierSubmissions).where(eq2(qualifierSubmissions.tournamentId, t.id)).orderBy(desc(qualifierSubmissions.score));
  const tPlayersList = await db.select({
    tp: tournamentPlayers,
    player: players
  }).from(tournamentPlayers).innerJoin(players, eq2(tournamentPlayers.playerId, players.id)).where(eq2(tournamentPlayers.tournamentId, t.id));
  const tierIds = tiersList.map((tr) => tr.id);
  const dbMatches = tierIds.length > 0 ? await db.select().from(matches).where(inArray(matches.tierId, tierIds)) : [];
  const matchIds = dbMatches.map((m) => m.id);
  const dbGames = matchIds.length > 0 ? await db.select().from(games).where(inArray(games.matchId, matchIds)).orderBy(games.gameNumber) : [];
  const gamesByMatch = /* @__PURE__ */ new Map();
  for (const g of dbGames) {
    if (!gamesByMatch.has(g.matchId)) gamesByMatch.set(g.matchId, []);
    gamesByMatch.get(g.matchId).push(g);
  }
  const relationalMatchScores = {};
  for (const m of dbMatches) {
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
      m.isComplete || m.winnerId && (p1Wins >= threshold || p2Wins >= threshold || m.isForfeit)
    );
    relationalMatchScores[m.id] = {
      matchId: m.id,
      tierId: m.tierId,
      organizationId: t.organizationId,
      bestOf,
      player1Wins: p1Wins,
      player2Wins: p2Wins,
      games: mGames.map((g) => ({
        gameNumber: g.gameNumber,
        player1Points: g.player1Score,
        player2Points: g.player2Score,
        winnerPlayerId: g.winnerId
      })),
      winnerPlayerId: m.winnerId,
      loserPlayerId: m.loserId,
      isComplete,
      notes: m.isForfeit ? "Forfeit win" : void 0,
      forfeitWinnerId: m.isForfeit ? m.winnerId || void 0 : void 0
    };
  }
  const meta = t.metadata || {};
  const playersPool = tPlayersList.map((row) => ({
    id: row.player.id,
    name: row.player.name,
    displayName: row.player.displayName || void 0,
    nickname: row.player.nickname || void 0,
    twitchUsername: row.player.twitchUsername || void 0,
    country: row.player.country || void 0,
    avatarType: row.player.avatarType || "flag",
    avatarUrl: row.player.avatarUrl || void 0,
    avatarThumbnailUrl: row.player.avatarThumbnailUrl || void 0,
    personalBest: row.player.personalBest,
    playstyle: row.player.playstyle || "Rolling",
    notes: row.player.notes || void 0,
    isDisqualified: row.player.isDisqualified
  }));
  const tournamentPlayersMap = {};
  for (const row of tPlayersList) {
    tournamentPlayersMap[row.player.id] = {
      tournamentId: t.id,
      playerId: row.player.id,
      seed: row.tp.seed || void 0,
      qualsCompleted: Boolean(row.tp.qualsCompleted),
      isVerified: Boolean(row.tp.qualsCompleted)
    };
  }
  const qualifierSubmissionsList = subsList.map((s) => ({
    id: s.id,
    tournamentId: s.tournamentId,
    playerId: s.playerId,
    score: s.score,
    submittedAt: s.createdAt.getTime()
  }));
  const compositeTiers = tiersList.map((tier) => {
    const tierMeta = tier.metadata || {};
    const bracket = tierMeta.bracket ? { ...tierMeta.bracket } : void 0;
    if (bracket) {
      if (bracket.matchesById) {
        bracket.matchesById = { ...bracket.matchesById };
        for (const [mId, m] of Object.entries(bracket.matchesById)) {
          const score = relationalMatchScores[mId];
          if (score) {
            bracket.matchesById[mId] = {
              ...m,
              winnerId: score.winnerPlayerId,
              loserId: score.loserPlayerId,
              bestOf: score.bestOf
            };
          }
        }
      }
      if (bracket.rounds) {
        bracket.rounds = bracket.rounds.map((r) => ({
          ...r,
          matches: (r.matches || []).map((m) => {
            const score = relationalMatchScores[m.id];
            if (score) {
              return {
                ...m,
                winnerId: score.winnerPlayerId,
                loserId: score.loserPlayerId,
                bestOf: score.bestOf
              };
            }
            return m;
          })
        }));
      }
    }
    return {
      id: tier.id,
      slug: tier.slug || tier.id,
      name: tier.name,
      priority: tier.priorityOrder,
      bracketType: tier.bracketType,
      flatWidth: tier.flatWidth || void 0,
      playerCount: tier.numPlayers,
      primaryColor: tier.primaryColor,
      secondaryColor: tier.secondaryColor,
      cardColor: tierMeta.cardColor,
      textColor: tierMeta.textColor,
      backgroundColor: tierMeta.backgroundColor,
      lowerBracketColor: tierMeta.lowerBracketColor,
      textSize: tierMeta.textSize,
      eliminationType: tierMeta.eliminationType || "SINGLE",
      bracketRouting: tierMeta.bracketRouting,
      finalsCutoff: tierMeta.finalsCutoff,
      bestOf: tierMeta.bestOf || 3,
      isLocked: Boolean(tierMeta.isLocked || t.qualsClosed),
      roundBestOfOverrides: tierMeta.roundBestOfOverrides || {},
      bracket
    };
  });
  const fullTourney = {
    id: t.id,
    organizationId: t.organizationId || meta.organizationId || void 0,
    slug: t.slug,
    name: t.name,
    date: meta.date || "",
    location: meta.location || "",
    seedingMethod: meta.seedingMethod || "QUALIFIERS",
    manualSeeds: meta.manualSeeds || [],
    qualFormat: t.qualFormat,
    qualAverageCount: t.qualAverageCount || void 0,
    pointsConfig: t.pointsConfig || void 0,
    isLocked: Boolean(t.qualsClosed || meta.isLocked),
    tiers: compositeTiers,
    matchScores: {
      ...meta.matchScores || {},
      ...relationalMatchScores
    },
    playersPool,
    qualifierSubmissions: qualifierSubmissionsList,
    tournamentPlayers: tournamentPlayersMap,
    useOrgBranding: meta.useOrgBranding ?? true,
    logoUrl: meta.logoUrl || void 0,
    bannerUrl: meta.bannerUrl || void 0,
    discordWebhookUrl: meta.discordWebhookUrl || void 0,
    themeColors: meta.themeColors || void 0,
    adminPinEncrypted: t.adminPinEncrypted || void 0
  };
  return fullTourney;
}
async function listFullTournaments() {
  const db = getDb();
  const allT = await db.select().from(tournaments).orderBy(desc(tournaments.createdAt));
  const fullList = [];
  for (const t of allT) {
    const full = await getFullTournament(t.id);
    if (full) fullList.push(full);
  }
  return fullList;
}
async function saveFullTournament(tourney) {
  const db = getDb();
  const tourneyUuid = isUuid(tourney.id) ? tourney.id : crypto.randomUUID();
  const slug = tourney.slug || `tournament-${Date.now()}`;
  let orgId = null;
  if (tourney.organizationId) {
    const [matchingOrg] = await db.select({ id: organizations.id }).from(organizations).where(or(eq2(organizations.id, tourney.organizationId), eq2(organizations.slug, tourney.organizationId))).limit(1);
    if (matchingOrg) {
      orgId = matchingOrg.id;
    }
  }
  let existing = await db.select().from(tournaments).where(eq2(tournaments.id, tourneyUuid)).limit(1);
  if (existing.length === 0 && slug) {
    existing = await db.select().from(tournaments).where(eq2(tournaments.slug, slug)).limit(1);
  }
  const metadata = {
    organizationId: orgId,
    date: tourney.date || "",
    location: tourney.location || "",
    seedingMethod: tourney.seedingMethod || "QUALIFIERS",
    manualSeeds: tourney.manualSeeds || [],
    isLocked: Boolean(tourney.isLocked),
    useOrgBranding: tourney.useOrgBranding ?? true,
    logoUrl: tourney.logoUrl || null,
    bannerUrl: tourney.bannerUrl || null,
    discordWebhookUrl: tourney.discordWebhookUrl || null,
    themeColors: tourney.themeColors || null,
    matchScores: tourney.matchScores || {}
  };
  let savedTourneyId = tourneyUuid;
  if (existing.length > 0) {
    savedTourneyId = existing[0].id;
    const updatePayload = {
      name: tourney.name,
      slug,
      organizationId: orgId,
      qualFormat: tourney.qualFormat,
      qualAverageCount: tourney.qualAverageCount || null,
      pointsConfig: tourney.pointsConfig || null,
      qualsClosed: Boolean(tourney.isLocked),
      metadata
    };
    if (tourney.adminPinEncrypted !== void 0) {
      updatePayload.adminPinEncrypted = tourney.adminPinEncrypted;
    }
    await db.update(tournaments).set(updatePayload).where(eq2(tournaments.id, savedTourneyId));
  } else {
    const [inserted] = await db.insert(tournaments).values({
      id: tourneyUuid,
      name: tourney.name,
      slug,
      organizationId: orgId,
      qualFormat: tourney.qualFormat,
      qualAverageCount: tourney.qualAverageCount || null,
      pointsConfig: tourney.pointsConfig || null,
      qualsClosed: Boolean(tourney.isLocked),
      isVerified: false,
      adminPinEncrypted: tourney.adminPinEncrypted || null,
      metadata
    }).returning();
    savedTourneyId = inserted.id;
  }
  const existingTiers = await db.select().from(bracketTiers).where(eq2(bracketTiers.tournamentId, savedTourneyId));
  const existingTierIds = new Set(existingTiers.map((t) => t.id));
  const currentTierIds = /* @__PURE__ */ new Set();
  for (let idx = 0; idx < (tourney.tiers || []).length; idx++) {
    const t = tourney.tiers[idx];
    const tierUuid = isUuid(t.id) ? t.id : existingTiers.find((et) => et.slug === t.slug)?.id || crypto.randomUUID();
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
      bracket: t.bracket
    };
    if (existingTierIds.has(tierUuid)) {
      await db.update(bracketTiers).set({
        priorityOrder: t.priority ?? idx + 1,
        name: t.name,
        slug: t.slug || t.id,
        bracketType: t.bracketType,
        flatWidth: t.flatWidth || null,
        numPlayers: t.playerCount ?? t.numPlayers ?? 8,
        primaryColor: t.primaryColor || "#ffc905",
        secondaryColor: t.secondaryColor || "#705b33",
        metadata: tierMeta
      }).where(eq2(bracketTiers.id, tierUuid));
    } else {
      await db.insert(bracketTiers).values({
        id: tierUuid,
        tournamentId: savedTourneyId,
        priorityOrder: t.priority ?? idx + 1,
        name: t.name,
        slug: t.slug || t.id,
        bracketType: t.bracketType,
        flatWidth: t.flatWidth || null,
        numPlayers: t.playerCount ?? t.numPlayers ?? 8,
        primaryColor: t.primaryColor || "#ffc905",
        secondaryColor: t.secondaryColor || "#705b33",
        metadata: tierMeta
      });
    }
  }
  for (const existingTier of existingTiers) {
    if (!currentTierIds.has(existingTier.id)) {
      await db.delete(bracketTiers).where(eq2(bracketTiers.id, existingTier.id));
    }
  }
  for (let idx = 0; idx < (tourney.tiers || []).length; idx++) {
    const t = tourney.tiers[idx];
    const tierUuid = isUuid(t.id) ? t.id : existingTiers.find((et) => et.slug === t.slug)?.id || Array.from(currentTierIds)[idx];
    if (!tierUuid) continue;
    await db.delete(matches).where(eq2(matches.tierId, tierUuid));
    const shouldPersistMatches = Boolean(
      tourney.isLocked || t.isLocked || tourney.matchScores && Object.keys(tourney.matchScores).length > 0
    );
    if (t.bracket && shouldPersistMatches) {
      const matchMap = /* @__PURE__ */ new Map();
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
      const matchesToInsert = [];
      const gamesToInsert = [];
      for (const m of matchMap.values()) {
        const scoreRec = tourney.matchScores?.[m.id];
        const p1Id = m.player1?.player?.id && isUuid(m.player1.player.id) ? m.player1.player.id : null;
        const p2Id = m.player2?.player?.id && isUuid(m.player2.player.id) ? m.player2.player.id : null;
        let winId = scoreRec?.winnerPlayerId && isUuid(scoreRec.winnerPlayerId) ? scoreRec.winnerPlayerId : m.winnerId && isUuid(m.winnerId) ? m.winnerId : null;
        let losId = scoreRec?.loserPlayerId && isUuid(scoreRec.loserPlayerId) ? scoreRec.loserPlayerId : m.loserId && isUuid(m.loserId) ? m.loserId : null;
        if (winId && !losId && p1Id && p2Id) {
          losId = winId === p1Id ? p2Id : p1Id;
        }
        const bestOf = scoreRec?.bestOf || m.bestOf || t.bestOf || 3;
        const threshold = Math.ceil(bestOf / 2);
        const p1Wins = scoreRec?.player1Wins ?? 0;
        const p2Wins = scoreRec?.player2Wins ?? 0;
        const isForfeit = Boolean(
          scoreRec?.forfeitWinnerId || scoreRec?.notes?.toLowerCase().includes("forfeit")
        );
        const isComplete = Boolean(
          scoreRec?.isComplete || winId && (p1Wins >= threshold || p2Wins >= threshold || isForfeit)
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
            isBye: m.isBye
          }
        });
        if (scoreRec?.games && scoreRec.games.length > 0) {
          for (const g of scoreRec.games) {
            if (g.player1Points !== null || g.player2Points !== null || g.winnerPlayerId !== null) {
              const gWinId = g.winnerPlayerId && isUuid(g.winnerPlayerId) ? g.winnerPlayerId : null;
              let gLosId = null;
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
                isIntentionalTopout: false
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
  if (Array.isArray(tourney.playersPool)) {
    await db.delete(tournamentPlayers).where(eq2(tournamentPlayers.tournamentId, savedTourneyId));
    const validPlayers = tourney.playersPool.filter((p) => isUuid(p.id));
    if (validPlayers.length > 0) {
      const CHUNK = 50;
      for (let i = 0; i < validPlayers.length; i += CHUNK) {
        const chunk = validPlayers.slice(i, i + CHUNK);
        await db.insert(tournamentPlayers).values(
          chunk.map((p) => {
            const tp = tourney.tournamentPlayers?.[p.id];
            const isCompleted = Boolean(tp?.qualsCompleted ?? tp?.isVerified);
            return {
              tournamentId: savedTourneyId,
              playerId: p.id,
              seed: tp?.seed || null,
              qualsCompleted: isCompleted
            };
          })
        );
      }
    }
  }
  if (Array.isArray(tourney.qualifierSubmissions)) {
    await db.delete(qualifierSubmissions).where(eq2(qualifierSubmissions.tournamentId, savedTourneyId));
    const validSubs = tourney.qualifierSubmissions.filter((s) => isUuid(s.playerId));
    if (validSubs.length > 0) {
      const CHUNK = 50;
      for (let i = 0; i < validSubs.length; i += CHUNK) {
        const chunk = validSubs.slice(i, i + CHUNK);
        await db.insert(qualifierSubmissions).values(
          chunk.map((s) => {
            const isOurUuid = isUuid(s.id) && s.tournamentId === savedTourneyId;
            return {
              id: isOurUuid ? s.id : crypto.randomUUID(),
              tournamentId: savedTourneyId,
              playerId: s.playerId,
              score: s.score,
              createdAt: new Date(s.submittedAt || Date.now())
            };
          })
        );
      }
    }
  }
  const loaded = await getFullTournament(savedTourneyId);
  return loaded || { ...tourney, id: savedTourneyId };
}

// src/api/qualifiers.ts
import { eq as eq3, desc as desc2 } from "drizzle-orm";
function isUuid2(val) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
}
async function submitQualifierScore(tournamentId, playerId, score) {
  if (score < 0) throw new Error("Score must be positive");
  const db = getDb();
  let resolvedTourneyId = tournamentId;
  if (!isUuid2(tournamentId)) {
    const [tourney] = await db.select({ id: tournaments.id, qualsClosed: tournaments.qualsClosed }).from(tournaments).where(eq3(tournaments.slug, tournamentId)).limit(1);
    if (!tourney) throw new Error("Tournament not found");
    if (tourney.qualsClosed) throw new Error("Qualifiers are closed for this tournament");
    resolvedTourneyId = tourney.id;
  } else {
    const t = await db.select().from(tournaments).where(eq3(tournaments.id, tournamentId)).limit(1);
    if (t.length === 0) throw new Error("Tournament not found");
    if (t[0].qualsClosed) throw new Error("Qualifiers are closed for this tournament");
  }
  const [created] = await db.insert(qualifierSubmissions).values({
    tournamentId: resolvedTourneyId,
    playerId,
    score
  }).returning();
  return created;
}
async function submitQualifiersBatch(tournamentId, submissions) {
  const db = getDb();
  if (submissions.length === 0) return [];
  let resolvedTourneyId = tournamentId;
  if (!isUuid2(tournamentId)) {
    const [tourney] = await db.select({ id: tournaments.id, qualsClosed: tournaments.qualsClosed }).from(tournaments).where(eq3(tournaments.slug, tournamentId)).limit(1);
    if (!tourney) throw new Error("Tournament not found");
    if (tourney.qualsClosed) throw new Error("Qualifiers are closed for this tournament");
    resolvedTourneyId = tourney.id;
  } else {
    const t = await db.select().from(tournaments).where(eq3(tournaments.id, tournamentId)).limit(1);
    if (t.length === 0) throw new Error("Tournament not found");
    if (t[0].qualsClosed) throw new Error("Qualifiers are closed for this tournament");
  }
  const inserted = await db.insert(qualifierSubmissions).values(submissions.map((s) => ({
    tournamentId: resolvedTourneyId,
    playerId: s.playerId,
    score: s.score
  }))).returning();
  return inserted;
}
async function clearTournamentQualifiers(tournamentId) {
  const db = getDb();
  let resolvedTourneyId = tournamentId;
  if (!isUuid2(tournamentId)) {
    const [tourney] = await db.select({ id: tournaments.id }).from(tournaments).where(eq3(tournaments.slug, tournamentId)).limit(1);
    if (!tourney) return false;
    resolvedTourneyId = tourney.id;
  }
  const res = await db.delete(qualifierSubmissions).where(eq3(qualifierSubmissions.tournamentId, resolvedTourneyId)).returning();
  return res.length > 0;
}

// src/api/brackets.ts
import { eq as eq4, inArray as inArray2, or as or2 } from "drizzle-orm";
async function clearTournamentMatches(tournamentId) {
  const db = getDb();
  let resolvedTourneyId = tournamentId;
  const isIdUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tournamentId);
  if (!isIdUuid) {
    const [tourney] = await db.select({ id: tournaments.id }).from(tournaments).where(eq4(tournaments.slug, tournamentId)).limit(1);
    if (!tourney) return false;
    resolvedTourneyId = tourney.id;
  }
  const tiers = await db.select({ id: bracketTiers.id }).from(bracketTiers).where(eq4(bracketTiers.tournamentId, resolvedTourneyId));
  if (tiers.length === 0) return false;
  const tierIds = tiers.map((t) => t.id);
  const res = await db.delete(matches).where(inArray2(matches.tierId, tierIds)).returning();
  return res.length > 0;
}

// src/api/organizations.ts
import { eq as eq5, desc as desc3 } from "drizzle-orm";

// src/features/organizations/store.tsx
import { createContext as createContext2, useContext as useContext2, useState as useState2, useEffect as useEffect2 } from "react";

// src/features/auth/AuthContext.tsx
import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { jsx } from "react/jsx-runtime";
var AuthContext = createContext(null);

// src/features/organizations/store.tsx
import { jsx as jsx2, jsxs } from "react/jsx-runtime";
var DEFAULT_ORGANIZATIONS = [];
var OrganizationContext = createContext2(null);

// src/api/organizations.ts
async function seedDefaultOrganizations() {
  const db = getDb();
  for (const org of DEFAULT_ORGANIZATIONS) {
    await db.insert(organizations).values({
      id: org.id,
      name: org.name,
      slug: org.slug,
      shortName: org.shortName || org.slug.toUpperCase(),
      description: org.description || null,
      website: org.website || null,
      brandColor: org.brandColor || null,
      themeColors: org.themeColors || null,
      tierThemes: org.tierThemes || null,
      branding: org.branding || null,
      discordWebhookUrl: org.discordWebhookUrl || null,
      defaultRules: org.defaultRules || null
    }).onConflictDoNothing();
  }
}
function formatOrganizationRecord(row) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    shortName: row.shortName || row.name,
    description: row.description || void 0,
    website: row.website || void 0,
    brandColor: row.brandColor || void 0,
    themeColors: row.themeColors || void 0,
    tierThemes: row.tierThemes || void 0,
    branding: row.branding || void 0,
    discordWebhookUrl: row.discordWebhookUrl || void 0,
    defaultRules: row.defaultRules || void 0,
    createdAt: row.createdAt ? new Date(row.createdAt).getTime() : Date.now()
  };
}
async function listOrganizations() {
  const db = getDb();
  await seedDefaultOrganizations();
  const rows = await db.select().from(organizations).orderBy(desc3(organizations.createdAt));
  return rows.map(formatOrganizationRecord);
}
async function getOrganizationById(id) {
  const db = getDb();
  await seedDefaultOrganizations();
  const [row] = await db.select().from(organizations).where(eq5(organizations.id, id)).limit(1);
  return row ? formatOrganizationRecord(row) : null;
}
async function createOrganization(input) {
  const db = getDb();
  await seedDefaultOrganizations();
  const slug = input.slug.trim().toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-");
  const shortName = input.shortName || input.name;
  const theme = input.themeColors || input.branding?.themeColors || {
    primaryColor: input.brandColor || "#ffc905",
    secondaryColor: "#705b33",
    cardColor: "#1b1c1d",
    textColor: "#94A3B8",
    backgroundColor: "#020203"
  };
  const tierThemes = input.tierThemes && input.tierThemes.length > 0 ? input.tierThemes : [
    {
      id: `theme_${Date.now()}_primary`,
      name: "Primary Tier",
      themeColors: theme
    }
  ];
  const orgId = input.id || `org_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
  const [row] = await db.insert(organizations).values({
    id: orgId,
    name: input.name,
    slug: slug || `org-${Date.now()}`,
    shortName,
    description: input.description || null,
    website: input.website || null,
    brandColor: input.brandColor || theme.primaryColor,
    themeColors: theme,
    tierThemes,
    branding: {
      logoUrl: input.logoUrl || input.branding?.logoUrl,
      bannerUrl: input.bannerUrl || input.branding?.bannerUrl,
      themeColors: theme,
      brandColor: input.brandColor || theme.primaryColor
    },
    discordWebhookUrl: input.discordWebhookUrl || null,
    defaultRules: input.defaultRules || null
  }).returning();
  return formatOrganizationRecord(row);
}
async function updateOrganization(id, updates) {
  const db = getDb();
  const existing = await getOrganizationById(id);
  if (!existing) return null;
  const updatedTheme = updates.themeColors || updates.branding?.themeColors || existing.themeColors;
  const [row] = await db.update(organizations).set({
    ...updates.name && { name: updates.name },
    ...updates.slug && { slug: updates.slug },
    ...updates.shortName !== void 0 && { shortName: updates.shortName },
    ...updates.description !== void 0 && { description: updates.description },
    ...updates.website !== void 0 && { website: updates.website },
    ...updates.brandColor !== void 0 && { brandColor: updates.brandColor },
    ...updatedTheme && { themeColors: updatedTheme },
    ...updates.tierThemes && { tierThemes: updates.tierThemes },
    ...updates.branding && { branding: updates.branding },
    ...updates.discordWebhookUrl !== void 0 && { discordWebhookUrl: updates.discordWebhookUrl },
    ...updates.defaultRules && { defaultRules: updates.defaultRules }
  }).where(eq5(organizations.id, id)).returning();
  return row ? formatOrganizationRecord(row) : null;
}
async function deleteOrganization(id) {
  const db = getDb();
  const associated = await db.select({ id: tournaments.id }).from(tournaments).where(eq5(tournaments.organizationId, id)).limit(1);
  if (associated.length > 0) {
    return {
      success: false,
      error: "Cannot delete organization because active tournaments are attached to it."
    };
  }
  await db.delete(organizations).where(eq5(organizations.id, id));
  return { success: true };
}

// src/features/bracket/math/seed-utils.ts
function getNextPowerOfTwo(n) {
  if (n <= 2) return 2;
  return Math.pow(2, Math.ceil(Math.log2(n)));
}
function getStandardLeaders(bracketSize) {
  if (bracketSize < 2 || (bracketSize & bracketSize - 1) !== 0) {
    throw new Error(`bracketSize must be a power of 2 >= 2, received ${bracketSize}`);
  }
  let leaders = [1];
  let currentRoundSize = 2;
  while (currentRoundSize < bracketSize) {
    const nextLeaders = [];
    const sum = currentRoundSize + 1;
    for (const leader of leaders) {
      nextLeaders.push(leader);
      nextLeaders.push(sum - leader);
    }
    leaders = nextLeaders;
    currentRoundSize *= 2;
  }
  return leaders;
}
function getStandardSeedingPairs(bracketSize) {
  const leaders = getStandardLeaders(bracketSize);
  const sum = bracketSize + 1;
  return leaders.map((leader) => [leader, sum - leader]);
}
function getRoundName(roundNumber, totalRounds, _matchCount, isRoundZero = false) {
  const roundsFromFinals = totalRounds - roundNumber;
  if (roundsFromFinals === 0) return "Finals";
  if (roundsFromFinals === 1) return "Semis";
  if (roundsFromFinals === 2) return "Quarters";
  if (isRoundZero && roundNumber === 1) {
    return "Round 0";
  }
  const adjustedNumber = isRoundZero ? roundNumber - 1 : roundNumber;
  return `Round ${adjustedNumber}`;
}

// src/features/bracket/math/traditional.ts
function generateTraditionalBracket(players2, options = {}) {
  if (players2.length < 2) {
    throw new Error(`Traditional bracket requires at least 2 players, received ${players2.length}`);
  }
  const { tierId, bestOf = 3, roundBestOfOverrides = {} } = options;
  const getBestOfForRound = (r) => roundBestOfOverrides[r] ?? bestOf;
  const totalPlayers = players2.length;
  const bracketSize = getNextPowerOfTwo(totalPlayers);
  const totalRounds = Math.log2(bracketSize);
  const totalByes = bracketSize - totalPlayers;
  const activeRound1MatchesCount = (totalPlayers - totalByes) / 2;
  const isRoundZero = activeRound1MatchesCount < totalByes;
  const playerBySeed = /* @__PURE__ */ new Map();
  for (const player of players2) {
    playerBySeed.set(player.seed, player);
  }
  const matchesById = {};
  const rounds = [];
  const createMatchId = (round, matchIndex) => tierId ? `${tierId}-r${round}-m${matchIndex + 1}` : `r${round}-m${matchIndex + 1}`;
  if (totalRounds === 1) {
    const matchId = createMatchId(1, 0);
    const m = {
      id: matchId,
      tierId,
      roundNumber: 1,
      matchNumber: 1,
      player1: { player: playerBySeed.get(1) ?? null },
      player2: { player: playerBySeed.get(2) ?? null },
      winnerId: null,
      loserId: null,
      bestOf: getBestOfForRound(1),
      isBye: false
    };
    matchesById[matchId] = m;
    rounds.push({
      roundNumber: 1,
      name: "Finals",
      matches: [m]
    });
    return {
      tierId,
      type: "TRADITIONAL",
      totalPlayers,
      totalRounds: 1,
      rounds,
      matchesById
    };
  }
  const roundsFrom2Onwards = [];
  for (let r = 2; r <= totalRounds; r++) {
    const matchCount = bracketSize / Math.pow(2, r);
    const roundMatches = [];
    for (let m = 0; m < matchCount; m++) {
      const matchId = createMatchId(r, m);
      const isFinalRound = r === totalRounds;
      const nextMatchId = isFinalRound ? void 0 : createMatchId(r + 1, Math.floor(m / 2));
      const nextMatchSlot = isFinalRound ? void 0 : m % 2 === 0 ? 1 : 2;
      const match = {
        id: matchId,
        tierId,
        roundNumber: r,
        matchNumber: m + 1,
        player1: { player: null },
        player2: { player: null },
        winnerId: null,
        loserId: null,
        nextMatchId,
        nextMatchSlot,
        bestOf: getBestOfForRound(r),
        isBye: false
      };
      roundMatches.push(match);
      matchesById[matchId] = match;
    }
    roundsFrom2Onwards.push(roundMatches);
  }
  for (let idx = 0; idx < roundsFrom2Onwards.length - 1; idx++) {
    const currentMatches = roundsFrom2Onwards[idx];
    for (const match of currentMatches) {
      if (match.nextMatchId && match.nextMatchSlot) {
        const nextMatch = matchesById[match.nextMatchId];
        if (match.nextMatchSlot === 1) {
          nextMatch.player1.sourceMatchId = match.id;
        } else {
          nextMatch.player2.sourceMatchId = match.id;
        }
      }
    }
  }
  const seedingPairs = getStandardSeedingPairs(bracketSize);
  const r2Matches = roundsFrom2Onwards[0];
  const round1Matches = [];
  let r1MatchIndex = 0;
  for (let r2Idx = 0; r2Idx < r2Matches.length; r2Idx++) {
    const r2Match = r2Matches[r2Idx];
    const topPairIdx = 2 * r2Idx;
    const bottomPairIdx = 2 * r2Idx + 1;
    const [seed1Top, seed2Top] = seedingPairs[topPairIdx];
    const [seed1Bottom, seed2Bottom] = seedingPairs[bottomPairIdx];
    const pTop1 = playerBySeed.get(seed1Top) ?? null;
    const pTop2 = playerBySeed.get(seed2Top) ?? null;
    if (pTop1 && pTop2) {
      const matchId = createMatchId(1, r1MatchIndex);
      const match = {
        id: matchId,
        tierId,
        roundNumber: 1,
        matchNumber: r1MatchIndex + 1,
        player1: { player: pTop1 },
        player2: { player: pTop2 },
        winnerId: null,
        loserId: null,
        nextMatchId: r2Match.id,
        nextMatchSlot: 1,
        bestOf: getBestOfForRound(1),
        isBye: false
      };
      round1Matches.push(match);
      matchesById[matchId] = match;
      r2Match.player1 = { player: null, sourceMatchId: match.id };
      r1MatchIndex++;
    } else if (pTop1 && !pTop2) {
      r2Match.player1 = { player: pTop1 };
    } else if (!pTop1 && pTop2) {
      r2Match.player1 = { player: pTop2 };
    }
    const pBot1 = playerBySeed.get(seed1Bottom) ?? null;
    const pBot2 = playerBySeed.get(seed2Bottom) ?? null;
    if (pBot1 && pBot2) {
      const matchId = createMatchId(1, r1MatchIndex);
      const match = {
        id: matchId,
        tierId,
        roundNumber: 1,
        matchNumber: r1MatchIndex + 1,
        player1: { player: pBot1 },
        player2: { player: pBot2 },
        winnerId: null,
        loserId: null,
        nextMatchId: r2Match.id,
        nextMatchSlot: 2,
        bestOf: getBestOfForRound(1),
        isBye: false
      };
      round1Matches.push(match);
      matchesById[matchId] = match;
      r2Match.player2 = { player: null, sourceMatchId: match.id };
      r1MatchIndex++;
    } else if (pBot1 && !pBot2) {
      r2Match.player2 = { player: pBot1 };
    } else if (!pBot1 && pBot2) {
      r2Match.player2 = { player: pBot2 };
    }
  }
  let globalMatchNumber = 1;
  round1Matches.forEach((m) => {
    m.matchNumber = globalMatchNumber++;
  });
  for (const rMatches of roundsFrom2Onwards) {
    rMatches.forEach((m) => {
      m.matchNumber = globalMatchNumber++;
    });
  }
  rounds.push({
    roundNumber: 1,
    name: getRoundName(1, totalRounds, round1Matches.length, isRoundZero),
    matches: round1Matches
  });
  for (let r = 2; r <= totalRounds; r++) {
    const rMatches = roundsFrom2Onwards[r - 2];
    rounds.push({
      roundNumber: r,
      name: getRoundName(r, totalRounds, rMatches.length, isRoundZero),
      matches: rMatches
    });
  }
  return {
    tierId,
    type: "TRADITIONAL",
    totalPlayers,
    totalRounds,
    rounds,
    matchesById
  };
}

// src/features/bracket/math/flat.ts
function generateFlatBracket(players2, flatWidth, options = {}) {
  if (players2.length < 2) {
    throw new Error(`Flat bracket requires at least 2 players, received ${players2.length}`);
  }
  if (flatWidth < 1) {
    throw new Error(`flatWidth must be >= 1, received ${flatWidth}`);
  }
  const { tierId, bestOf = 3, roundBestOfOverrides = {} } = options;
  const getBestOfForRound = (r) => roundBestOfOverrides[r] ?? bestOf;
  const totalPlayers = players2.length;
  const playerBySeed = /* @__PURE__ */ new Map();
  for (const player of players2) {
    playerBySeed.set(player.seed, player);
  }
  const sFinalPower = Math.floor(Math.log2(Math.max(2, 2 * flatWidth)));
  const sFinal = Math.pow(2, sFinalPower);
  const mChamp = sFinal / 2;
  if (totalPlayers <= sFinal) {
    const traditional = generateTraditionalBracket(players2, options);
    return {
      ...traditional,
      type: "FLAT",
      flatWidth
    };
  }
  const elimNeeded = totalPlayers - sFinal;
  const numPrelimRounds = Math.ceil(elimNeeded / flatWidth);
  const m1 = elimNeeded - (numPrelimRounds - 1) * flatWidth;
  const matchesById = {};
  const rounds = [];
  const createMatchId = (round, matchIndex) => tierId ? `${tierId}-r${round}-m${matchIndex + 1}` : `r${round}-m${matchIndex + 1}`;
  const roundMatchCounts = [];
  roundMatchCounts.push(m1);
  for (let i = 1; i < numPrelimRounds; i++) {
    roundMatchCounts.push(flatWidth);
  }
  let currChamp = mChamp;
  while (currChamp >= 1) {
    roundMatchCounts.push(currChamp);
    currChamp = Math.floor(currChamp / 2);
  }
  const totalRounds = roundMatchCounts.length;
  for (let r = 1; r <= totalRounds; r++) {
    const matchCount = roundMatchCounts[r - 1];
    const roundMatches = [];
    for (let m = 0; m < matchCount; m++) {
      const matchId = createMatchId(r, m);
      const match = {
        id: matchId,
        tierId,
        roundNumber: r,
        matchNumber: m + 1,
        player1: { player: null },
        player2: { player: null },
        winnerId: null,
        loserId: null,
        bestOf: getBestOfForRound(r),
        isBye: false
      };
      roundMatches.push(match);
      matchesById[matchId] = match;
    }
    rounds.push({
      roundNumber: r,
      name: getRoundName(r, totalRounds, matchCount),
      matches: roundMatches
    });
  }
  for (let r = numPrelimRounds + 1; r < totalRounds; r++) {
    const currentRound = rounds[r - 1];
    for (let m = 0; m < currentRound.matches.length; m++) {
      const match = currentRound.matches[m];
      match.nextMatchId = createMatchId(r + 1, Math.floor(m / 2));
      match.nextMatchSlot = m % 2 === 0 ? 1 : 2;
      const nextMatch = matchesById[match.nextMatchId];
      if (match.nextMatchSlot === 1) {
        nextMatch.player1.sourceMatchId = match.id;
      } else {
        nextMatch.player2.sourceMatchId = match.id;
      }
    }
  }
  for (let r = 1; r < numPrelimRounds; r++) {
    const currentRound = rounds[r - 1];
    const nextRound = rounds[r];
    for (let m = 0; m < currentRound.matches.length; m++) {
      const match = currentRound.matches[m];
      const targetMatch = nextRound.matches[m];
      match.nextMatchId = targetMatch.id;
      match.nextMatchSlot = 2;
      targetMatch.player2.sourceMatchId = match.id;
    }
  }
  const champPairs = getStandardSeedingPairs(sFinal);
  const champRound = rounds[numPrelimRounds];
  const sortedChampMatchIndices = Array.from({ length: mChamp }, (_, i) => i).sort((a, b) => champPairs[b][1] - champPairs[a][1]);
  const lastPrelimRound = rounds[numPrelimRounds - 1];
  const numPrelimFeeds = lastPrelimRound.matches.length;
  for (let i = 0; i < numPrelimFeeds; i++) {
    const prelimMatch = lastPrelimRound.matches[i];
    const targetMatchIndex = sortedChampMatchIndices[i];
    const targetMatch = champRound.matches[targetMatchIndex];
    prelimMatch.nextMatchId = targetMatch.id;
    prelimMatch.nextMatchSlot = 2;
    targetMatch.player2.sourceMatchId = prelimMatch.id;
  }
  const round1SeedsStart = totalPlayers - 2 * m1 + 1;
  for (let m = 0; m < m1; m++) {
    const match = rounds[0].matches[m];
    const highSeed = round1SeedsStart + m;
    const lowSeed = totalPlayers - m;
    match.player1 = { player: playerBySeed.get(highSeed) ?? null };
    match.player2 = { player: playerBySeed.get(lowSeed) ?? null };
  }
  let currentSeed = round1SeedsStart - 1;
  for (let r = 2; r <= numPrelimRounds; r++) {
    const round = rounds[r - 1];
    for (let m = 0; m < round.matches.length; m++) {
      const match = round.matches[m];
      if (!match.player1.player && currentSeed >= 1) {
        match.player1 = { player: playerBySeed.get(currentSeed) ?? null };
        currentSeed--;
      }
      if (!match.player2.player && !match.player2.sourceMatchId && currentSeed >= 1) {
        match.player2 = { player: playerBySeed.get(currentSeed) ?? null };
        currentSeed--;
      }
    }
  }
  for (let m = 0; m < mChamp; m++) {
    const champMatch = champRound.matches[m];
    const leaderSeed = champPairs[m][0];
    const opponentSeed = champPairs[m][1];
    champMatch.player1 = { player: playerBySeed.get(leaderSeed) ?? null };
    if (!champMatch.player2.sourceMatchId) {
      champMatch.player2 = { player: playerBySeed.get(opponentSeed) ?? null };
    }
  }
  let globalMatchNum = 1;
  for (const round of rounds) {
    for (const match of round.matches) {
      match.matchNumber = globalMatchNum++;
      if (matchesById[match.id]) {
        matchesById[match.id].matchNumber = match.matchNumber;
      }
    }
  }
  return {
    tierId,
    type: "FLAT",
    totalPlayers,
    totalRounds,
    flatWidth,
    rounds,
    matchesById
  };
}

// src/features/bracket/math/double-elimination.ts
function createBestOfResolver(defaultBestOf, roundBestOfOverrides = {}) {
  return (identifier, roundNum) => {
    if (roundBestOfOverrides[identifier] !== void 0) {
      return roundBestOfOverrides[identifier];
    }
    const alt = identifier.startsWith("WR") ? identifier.replace("WR", "W") : identifier.startsWith("LR") ? identifier.replace("LR", "L") : identifier.startsWith("W") ? identifier.replace("W", "WR") : identifier.startsWith("L") ? identifier.replace("L", "LR") : identifier;
    if (roundBestOfOverrides[alt] !== void 0) {
      return roundBestOfOverrides[alt];
    }
    if (roundBestOfOverrides[roundNum] !== void 0) {
      return roundBestOfOverrides[roundNum];
    }
    return defaultBestOf;
  };
}
function applyDoubleElimRoundNames(winnersRounds, losersRounds, grandFinalsRound) {
  const W = winnersRounds.length;
  for (let i = 0; i < W; i++) {
    const round = winnersRounds[i];
    const fromEnd = W - 1 - i;
    if (fromEnd === 0) {
      round.name = "Winners Finals";
    } else if (fromEnd === 1) {
      round.name = "Winners Semis";
    } else if (fromEnd === 2) {
      round.name = "Winners Quarters";
    } else {
      round.name = `Round ${i + 1} (Winners)`;
    }
  }
  const L = losersRounds.length;
  for (let j = 0; j < L; j++) {
    const round = losersRounds[j];
    const fromEnd = L - 1 - j;
    if (fromEnd === 0) {
      round.name = "Loser's Finals";
    } else if (fromEnd === 1) {
      round.name = "Loser's Semis";
    } else if (fromEnd === 2) {
      round.name = "Loser's Quarters";
    } else if (fromEnd === 3 && round.matches.length <= 2) {
      round.name = "Loser's Top 6";
    } else {
      round.name = `Round ${j + 1} (Losers)`;
    }
  }
  grandFinalsRound.name = "Finals";
}
function generateTraditionalDoubleElim(playersOrConfig, optionsArg) {
  let players2;
  let options;
  if (Array.isArray(playersOrConfig)) {
    players2 = playersOrConfig;
    options = optionsArg || {};
  } else {
    players2 = playersOrConfig.players;
    options = playersOrConfig.options || {};
  }
  if (players2.length < 2) {
    throw new Error(`Double elimination bracket requires at least 2 players, received ${players2.length}`);
  }
  const { tierId, bestOf = 3, roundBestOfOverrides = {} } = options;
  const getBestOf = createBestOfResolver(bestOf, roundBestOfOverrides);
  const totalPlayers = players2.length;
  const prefix = tierId ? `${tierId}-` : "";
  const playerBySeed = /* @__PURE__ */ new Map();
  for (const p of players2) {
    playerBySeed.set(p.seed, p);
  }
  if (totalPlayers === 2) {
    const p1 = playerBySeed.get(1) ?? players2[0];
    const p2 = playerBySeed.get(2) ?? players2[1];
    const w1MatchId = `${prefix}w1-m1`;
    const gf1MatchId = `${prefix}gf1`;
    const w1Match = {
      id: w1MatchId,
      tierId,
      stage: "WINNERS",
      roundIdentifier: "W1",
      roundNumber: 1,
      roundIndex: 0,
      matchNumber: 1,
      player1: { player: p1 },
      player2: { player: p2 },
      slotA: { type: "DIRECT" },
      slotB: { type: "DIRECT" },
      winnerId: null,
      loserId: null,
      nextMatchId: gf1MatchId,
      nextMatchSlot: 1,
      loserNextMatchId: gf1MatchId,
      loserNextMatchSlot: 2,
      bestOf: getBestOf("W1", 1),
      isBye: false
    };
    const gf1Match2 = {
      id: gf1MatchId,
      tierId,
      stage: "GRAND_FINALS",
      roundIdentifier: "GF",
      roundNumber: 2,
      roundIndex: 1,
      matchNumber: 2,
      player1: { player: null, sourceMatchId: w1MatchId },
      player2: { player: null, sourceMatchId: w1MatchId },
      slotA: { matchId: w1MatchId, type: "WINNER" },
      slotB: { matchId: w1MatchId, type: "LOSER" },
      winnerId: null,
      loserId: null,
      bestOf: getBestOf("GF", 2),
      isBye: false
    };
    return {
      tierId,
      type: "TRADITIONAL",
      eliminationType: "DOUBLE",
      bracketRouting: "TRADITIONAL_TREE",
      totalPlayers: 2,
      totalRounds: 2,
      rounds: [
        { roundNumber: 1, name: "Winners Finals", stage: "WINNERS", roundIdentifier: "W1", matches: [w1Match] },
        { roundNumber: 2, name: "Finals", stage: "GRAND_FINALS", roundIdentifier: "GF", matches: [gf1Match2] }
      ],
      matchesById: {
        [w1MatchId]: w1Match,
        [gf1MatchId]: gf1Match2
      }
    };
  }
  const B = getNextPowerOfTwo(totalPlayers);
  const K = Math.log2(B);
  const matchesById = {};
  const winnersRounds = [];
  const losersRounds = [];
  const seedingPairs = getStandardSeedingPairs(B);
  const wr1Matches = [];
  const wrMatchesByRound = {};
  const wr2Feeds = [];
  const wr1LoserFeeders = [];
  let wr1Counter = 0;
  for (let i = 0; i < seedingPairs.length; i++) {
    const [s1, s2] = seedingPairs[i];
    const p1 = playerBySeed.get(s1);
    const p2 = playerBySeed.get(s2);
    if (p1 && p2) {
      wr1Counter++;
      const id = `${prefix}w1-m${wr1Counter}`;
      const match = {
        id,
        tierId,
        stage: "WINNERS",
        roundIdentifier: "W1",
        roundNumber: 1,
        roundIndex: 0,
        matchNumber: 0,
        // Assigned sequentially later
        player1: { player: p1 },
        player2: { player: p2 },
        slotA: { type: "DIRECT" },
        slotB: { type: "DIRECT" },
        winnerId: null,
        loserId: null,
        bestOf: getBestOf("W1", 1),
        isBye: false
      };
      wr1Matches.push(match);
      matchesById[id] = match;
      wr2Feeds.push({ isBye: false, matchId: id });
      wr1LoserFeeders.push({ matchId: id, type: "LOSER" });
    } else {
      const byePlayer = p1 || p2;
      wr2Feeds.push({ isBye: true, player: byePlayer });
      wr1LoserFeeders.push(null);
    }
  }
  winnersRounds.push({
    roundNumber: 1,
    name: "WR1",
    stage: "WINNERS",
    roundIdentifier: "W1",
    matches: wr1Matches
  });
  wrMatchesByRound[1] = wr1Matches;
  const wr2Matches = [];
  const wr2MatchCount = B / 4;
  for (let m = 0; m < wr2MatchCount; m++) {
    const id = `${prefix}w2-m${m + 1}`;
    const feed1 = wr2Feeds[2 * m];
    const feed2 = wr2Feeds[2 * m + 1];
    const match = {
      id,
      tierId,
      stage: "WINNERS",
      roundIdentifier: "W2",
      roundNumber: 2,
      roundIndex: 1,
      matchNumber: 0,
      player1: feed1.isBye ? { player: feed1.player } : { player: null, sourceMatchId: feed1.matchId },
      player2: feed2.isBye ? { player: feed2.player } : { player: null, sourceMatchId: feed2.matchId },
      slotA: feed1.isBye ? { type: "DIRECT" } : { matchId: feed1.matchId, type: "WINNER" },
      slotB: feed2.isBye ? { type: "DIRECT" } : { matchId: feed2.matchId, type: "WINNER" },
      winnerId: null,
      loserId: null,
      bestOf: getBestOf("W2", 2),
      isBye: false
    };
    if (!feed1.isBye) {
      matchesById[feed1.matchId].nextMatchId = id;
      matchesById[feed1.matchId].nextMatchSlot = 1;
    }
    if (!feed2.isBye) {
      matchesById[feed2.matchId].nextMatchId = id;
      matchesById[feed2.matchId].nextMatchSlot = 2;
    }
    wr2Matches.push(match);
    matchesById[id] = match;
  }
  winnersRounds.push({
    roundNumber: 2,
    name: "WR2",
    stage: "WINNERS",
    roundIdentifier: "W2",
    matches: wr2Matches
  });
  wrMatchesByRound[2] = wr2Matches;
  let prevRoundMatches = wr2Matches;
  for (let r = 3; r <= K; r++) {
    const roundMatches = [];
    const count = prevRoundMatches.length / 2;
    const roundIdent = `W${r}`;
    const roundName = `WR${r}`;
    for (let m = 0; m < count; m++) {
      const id = `${prefix}w${r}-m${m + 1}`;
      const f1Match = prevRoundMatches[2 * m];
      const f2Match = prevRoundMatches[2 * m + 1];
      const match = {
        id,
        tierId,
        stage: "WINNERS",
        roundIdentifier: roundIdent,
        roundNumber: r,
        roundIndex: r - 1,
        matchNumber: 0,
        player1: { player: null, sourceMatchId: f1Match.id },
        player2: { player: null, sourceMatchId: f2Match.id },
        slotA: { matchId: f1Match.id, type: "WINNER" },
        slotB: { matchId: f2Match.id, type: "WINNER" },
        winnerId: null,
        loserId: null,
        bestOf: getBestOf(roundIdent, r),
        isBye: false
      };
      f1Match.nextMatchId = id;
      f1Match.nextMatchSlot = 1;
      f2Match.nextMatchId = id;
      f2Match.nextMatchSlot = 2;
      roundMatches.push(match);
      matchesById[id] = match;
    }
    winnersRounds.push({
      roundNumber: r,
      name: roundName,
      stage: "WINNERS",
      roundIdentifier: roundIdent,
      matches: roundMatches
    });
    wrMatchesByRound[r] = roundMatches;
    prevRoundMatches = roundMatches;
  }
  const totalPowerOfTwoLoserRounds = 2 * (K - 1);
  let lrRoundNumber = 1;
  let currentFeeders = [];
  const lr1SlotsCount = B / 4;
  const lr1Matches = [];
  for (let j = 0; j < lr1SlotsCount; j++) {
    const fA = wr1LoserFeeders[2 * j];
    const fB = wr1LoserFeeders[2 * j + 1];
    if (fA && fB) {
      const matchNumInRound = lr1Matches.length + 1;
      const id = `${prefix}l1-m${matchNumInRound}`;
      const match = {
        id,
        tierId,
        stage: "LOSERS",
        roundIdentifier: "L1",
        roundNumber: lrRoundNumber,
        roundIndex: lrRoundNumber - 1,
        matchNumber: 0,
        player1: { player: null, sourceMatchId: fA.matchId },
        player2: { player: null, sourceMatchId: fB.matchId },
        slotA: fA,
        slotB: fB,
        winnerId: null,
        loserId: null,
        bestOf: getBestOf("L1", lrRoundNumber),
        isBye: false
      };
      if (fA.matchId && matchesById[fA.matchId]) {
        matchesById[fA.matchId].loserNextMatchId = id;
        matchesById[fA.matchId].loserNextMatchSlot = 1;
      }
      if (fB.matchId && matchesById[fB.matchId]) {
        matchesById[fB.matchId].loserNextMatchId = id;
        matchesById[fB.matchId].loserNextMatchSlot = 2;
      }
      lr1Matches.push(match);
      matchesById[id] = match;
      currentFeeders.push({ matchId: id, type: "WINNER" });
    } else if (fA || fB) {
      currentFeeders.push(fA || fB);
    } else {
      currentFeeders.push(null);
    }
  }
  if (lr1Matches.length > 0) {
    losersRounds.push({
      roundNumber: lrRoundNumber++,
      name: "LR1",
      stage: "LOSERS",
      roundIdentifier: "L1",
      matches: lr1Matches
    });
  }
  for (let m = 2; m <= totalPowerOfTwoLoserRounds; m++) {
    const roundIdent = `L${m}`;
    const roundName = `LR${m}`;
    const roundMatches = [];
    const nextFeeders = [];
    if (m % 2 === 0) {
      const r = m / 2;
      const wrDropRound = wrMatchesByRound[r + 1];
      const slotCount = wrDropRound.length;
      for (let j = 0; j < slotCount; j++) {
        const fA = currentFeeders[j] || null;
        const wrSrc = wrDropRound[slotCount - 1 - j];
        const fB = { matchId: wrSrc.id, type: "LOSER" };
        if (fA) {
          const matchNumInRound = roundMatches.length + 1;
          const id = `${prefix}l${m}-m${matchNumInRound}`;
          const match = {
            id,
            tierId,
            stage: "LOSERS",
            roundIdentifier: roundIdent,
            roundNumber: lrRoundNumber,
            roundIndex: lrRoundNumber - 1,
            matchNumber: 0,
            player1: { player: null, sourceMatchId: fA.matchId },
            player2: { player: null, sourceMatchId: fB.matchId },
            slotA: fA,
            slotB: fB,
            winnerId: null,
            loserId: null,
            bestOf: getBestOf(roundIdent, lrRoundNumber),
            isBye: false
          };
          if (fA.matchId && matchesById[fA.matchId]) {
            if (fA.type === "LOSER") {
              matchesById[fA.matchId].loserNextMatchId = id;
              matchesById[fA.matchId].loserNextMatchSlot = 1;
            } else {
              matchesById[fA.matchId].nextMatchId = id;
              matchesById[fA.matchId].nextMatchSlot = 1;
            }
          }
          if (fB.matchId && matchesById[fB.matchId]) {
            matchesById[fB.matchId].loserNextMatchId = id;
            matchesById[fB.matchId].loserNextMatchSlot = 2;
          }
          roundMatches.push(match);
          matchesById[id] = match;
          nextFeeders.push({ matchId: id, type: "WINNER" });
        } else {
          nextFeeders.push(fB);
        }
      }
    } else {
      const slotCount = currentFeeders.length / 2;
      for (let k = 0; k < slotCount; k++) {
        const fA = currentFeeders[2 * k];
        const fB = currentFeeders[2 * k + 1];
        if (fA && fB) {
          const matchNumInRound = roundMatches.length + 1;
          const id = `${prefix}l${m}-m${matchNumInRound}`;
          const match = {
            id,
            tierId,
            stage: "LOSERS",
            roundIdentifier: roundIdent,
            roundNumber: lrRoundNumber,
            roundIndex: lrRoundNumber - 1,
            matchNumber: 0,
            player1: { player: null, sourceMatchId: fA.matchId },
            player2: { player: null, sourceMatchId: fB.matchId },
            slotA: fA,
            slotB: fB,
            winnerId: null,
            loserId: null,
            bestOf: getBestOf(roundIdent, lrRoundNumber),
            isBye: false
          };
          if (fA.matchId && matchesById[fA.matchId]) {
            if (fA.type === "LOSER") {
              matchesById[fA.matchId].loserNextMatchId = id;
              matchesById[fA.matchId].loserNextMatchSlot = 1;
            } else {
              matchesById[fA.matchId].nextMatchId = id;
              matchesById[fA.matchId].nextMatchSlot = 1;
            }
          }
          if (fB.matchId && matchesById[fB.matchId]) {
            if (fB.type === "LOSER") {
              matchesById[fB.matchId].loserNextMatchId = id;
              matchesById[fB.matchId].loserNextMatchSlot = 2;
            } else {
              matchesById[fB.matchId].nextMatchId = id;
              matchesById[fB.matchId].nextMatchSlot = 2;
            }
          }
          roundMatches.push(match);
          matchesById[id] = match;
          nextFeeders.push({ matchId: id, type: "WINNER" });
        } else if (fA || fB) {
          nextFeeders.push(fA || fB);
        } else {
          nextFeeders.push(null);
        }
      }
    }
    if (roundMatches.length > 0) {
      losersRounds.push({
        roundNumber: lrRoundNumber++,
        name: roundName,
        stage: "LOSERS",
        roundIdentifier: roundIdent,
        matches: roundMatches
      });
    }
    currentFeeders = nextFeeders;
  }
  const wfMatch = wrMatchesByRound[K][0];
  const lastLosersRound = losersRounds[losersRounds.length - 1];
  const lfMatch = lastLosersRound.matches[0];
  const gf1Id = `${prefix}gf1`;
  const gfRoundNum = winnersRounds.length + losersRounds.length + 1;
  const gf1Match = {
    id: gf1Id,
    tierId,
    stage: "GRAND_FINALS",
    roundIdentifier: "GF",
    roundNumber: gfRoundNum,
    roundIndex: gfRoundNum - 1,
    matchNumber: 0,
    player1: { player: null, sourceMatchId: wfMatch.id },
    player2: { player: null, sourceMatchId: lfMatch.id },
    slotA: { matchId: wfMatch.id, type: "WINNER" },
    slotB: { matchId: lfMatch.id, type: "WINNER" },
    winnerId: null,
    loserId: null,
    bestOf: getBestOf("GF", gfRoundNum),
    isBye: false
  };
  wfMatch.nextMatchId = gf1Id;
  wfMatch.nextMatchSlot = 1;
  lfMatch.nextMatchId = gf1Id;
  lfMatch.nextMatchSlot = 2;
  matchesById[gf1Id] = gf1Match;
  const grandFinalsRound = {
    roundNumber: gfRoundNum,
    name: "GF",
    stage: "GRAND_FINALS",
    roundIdentifier: "GF",
    matches: [gf1Match]
  };
  let globalMatchNum = 1;
  for (const round of winnersRounds) {
    for (const match of round.matches) {
      match.matchNumber = globalMatchNum++;
    }
  }
  for (const round of losersRounds) {
    for (const match of round.matches) {
      match.matchNumber = globalMatchNum++;
    }
  }
  gf1Match.matchNumber = globalMatchNum++;
  applyDoubleElimRoundNames(winnersRounds, losersRounds, grandFinalsRound);
  const allRounds = [...winnersRounds, ...losersRounds, grandFinalsRound];
  for (let rIdx = 0; rIdx < allRounds.length; rIdx++) {
    allRounds[rIdx].roundNumber = rIdx + 1;
    for (const match of allRounds[rIdx].matches) {
      match.roundNumber = rIdx + 1;
      match.roundIndex = rIdx;
    }
  }
  return {
    tierId,
    type: "TRADITIONAL",
    eliminationType: "DOUBLE",
    bracketRouting: "TRADITIONAL_TREE",
    totalPlayers,
    totalRounds: allRounds.length,
    rounds: allRounds,
    matchesById
  };
}
function generateFlatDoubleElim(playersOrConfig, flatWidthArg, optionsArg) {
  let players2;
  let flatWidth;
  let options;
  if (Array.isArray(playersOrConfig)) {
    players2 = playersOrConfig;
    flatWidth = flatWidthArg || 4;
    options = optionsArg || {};
  } else {
    players2 = playersOrConfig.players;
    flatWidth = playersOrConfig.flatWidth || 4;
    options = playersOrConfig.options || {};
  }
  const totalPlayers = players2.length;
  if (flatWidth < 4 || totalPlayers <= 2 * flatWidth) {
    return generateTraditionalDoubleElim({ players: players2, options });
  }
  if (totalPlayers % flatWidth !== 0) {
    throw new Error(`Participant count (${totalPlayers}) must be a multiple of flat width (${flatWidth}) for flat staged double elimination.`);
  }
  const { tierId, bestOf = 3, roundBestOfOverrides = {} } = options;
  const getBestOf = createBestOfResolver(bestOf, roundBestOfOverrides);
  const prefix = tierId ? `${tierId}-` : "";
  const playerBySeed = /* @__PURE__ */ new Map();
  for (const p of players2) {
    playerBySeed.set(p.seed, p);
  }
  const K = Math.floor(totalPlayers / flatWidth) - 1;
  const matchesById = {};
  const winnersRounds = [];
  const losersRounds = [];
  const wrMatchesByRound = [];
  const leaders = getStandardLeaders(2 * flatWidth);
  {
    const r1SeedStart = totalPlayers - 2 * flatWidth + 1;
    const r1Matches = [];
    for (let m = 0; m < flatWidth; m++) {
      const id = `${prefix}w1-m${m + 1}`;
      const relRank = leaders[m];
      const s1 = r1SeedStart + (relRank - 1);
      const s2 = totalPlayers - (relRank - 1);
      const p1 = playerBySeed.get(s1);
      const p2 = playerBySeed.get(s2);
      const match = {
        id,
        tierId,
        stage: "WINNERS",
        roundIdentifier: "W1",
        roundNumber: 1,
        roundIndex: 0,
        matchNumber: 0,
        player1: { player: p1 || null },
        player2: { player: p2 || null },
        slotA: { type: "DIRECT" },
        slotB: { type: "DIRECT" },
        winnerId: null,
        loserId: null,
        bestOf: getBestOf("W1", 1),
        isBye: false
      };
      r1Matches.push(match);
      matchesById[id] = match;
    }
    wrMatchesByRound.push(r1Matches);
    winnersRounds.push({
      roundNumber: 1,
      name: "WR1",
      stage: "WINNERS",
      roundIdentifier: "W1",
      matches: r1Matches
    });
  }
  for (let r = 2; r <= K; r++) {
    const roundNumber = r;
    const roundIdent = `W${r}`;
    const roundName = `WR${r}`;
    const rMatches = [];
    const seedStart = totalPlayers - (r + 1) * flatWidth + 1;
    const prevWinners = wrMatchesByRound[r - 2];
    for (let m = 0; m < flatWidth; m++) {
      const id = `${prefix}w${r}-m${m + 1}`;
      const relRank = leaders[m];
      const stepInSeed = seedStart + (relRank - 1);
      const stepInPlayer = playerBySeed.get(stepInSeed);
      const prevMatch = prevWinners[m];
      const match = {
        id,
        tierId,
        stage: "WINNERS",
        roundIdentifier: roundIdent,
        roundNumber,
        roundIndex: r - 1,
        matchNumber: 0,
        player1: { player: stepInPlayer || null },
        player2: { player: null, sourceMatchId: prevMatch?.id },
        slotA: { type: "DIRECT" },
        slotB: { matchId: prevMatch?.id, type: "WINNER" },
        winnerId: null,
        loserId: null,
        bestOf: getBestOf(roundIdent, roundNumber),
        isBye: false
      };
      if (prevMatch) {
        prevMatch.nextMatchId = id;
        prevMatch.nextMatchSlot = 2;
      }
      rMatches.push(match);
      matchesById[id] = match;
    }
    wrMatchesByRound.push(rMatches);
    winnersRounds.push({
      roundNumber,
      name: roundName,
      stage: "WINNERS",
      roundIdentifier: roundIdent,
      matches: rMatches
    });
  }
  let currentContractionWidth = flatWidth / 2;
  let currRoundNumber = K + 1;
  while (currentContractionWidth >= 1) {
    const roundIdent = `W${currRoundNumber}`;
    const roundName = `WR${currRoundNumber}`;
    const rMatches = [];
    const prevMatches = wrMatchesByRound[wrMatchesByRound.length - 1];
    for (let m = 0; m < currentContractionWidth; m++) {
      const id = `${prefix}w${currRoundNumber}-m${m + 1}`;
      const f1 = prevMatches[2 * m];
      const f2 = prevMatches[2 * m + 1];
      const match = {
        id,
        tierId,
        stage: "WINNERS",
        roundIdentifier: roundIdent,
        roundNumber: currRoundNumber,
        roundIndex: currRoundNumber - 1,
        matchNumber: 0,
        player1: { player: null, sourceMatchId: f1.id },
        player2: { player: null, sourceMatchId: f2.id },
        slotA: { matchId: f1.id, type: "WINNER" },
        slotB: { matchId: f2.id, type: "WINNER" },
        winnerId: null,
        loserId: null,
        bestOf: getBestOf(roundIdent, currRoundNumber),
        isBye: false
      };
      f1.nextMatchId = id;
      f1.nextMatchSlot = 1;
      f2.nextMatchId = id;
      f2.nextMatchSlot = 2;
      rMatches.push(match);
      matchesById[id] = match;
    }
    wrMatchesByRound.push(rMatches);
    winnersRounds.push({
      roundNumber: currRoundNumber,
      name: roundName,
      stage: "WINNERS",
      roundIdentifier: roundIdent,
      matches: rMatches
    });
    currentContractionWidth = Math.floor(currentContractionWidth / 2);
    currRoundNumber++;
  }
  let lrRoundNum = 1;
  const wr1Losers = wrMatchesByRound[0];
  const wr2Losers = wrMatchesByRound[1];
  const lr1Matches = [];
  for (let m = 0; m < flatWidth; m++) {
    const id = `${prefix}l1-m${m + 1}`;
    const wr1Src = wr1Losers[flatWidth - 1 - m];
    const wr2Src = wr2Losers[m];
    const match = {
      id,
      tierId,
      stage: "LOSERS",
      roundIdentifier: "L1",
      roundNumber: lrRoundNum,
      roundIndex: lrRoundNum - 1,
      matchNumber: 0,
      player1: { player: null, sourceMatchId: wr1Src.id },
      player2: { player: null, sourceMatchId: wr2Src.id },
      slotA: { matchId: wr1Src.id, type: "LOSER" },
      slotB: { matchId: wr2Src.id, type: "LOSER" },
      winnerId: null,
      loserId: null,
      bestOf: getBestOf("L1", lrRoundNum),
      isBye: false
    };
    wr1Src.loserNextMatchId = id;
    wr1Src.loserNextMatchSlot = 1;
    wr2Src.loserNextMatchId = id;
    wr2Src.loserNextMatchSlot = 2;
    lr1Matches.push(match);
    matchesById[id] = match;
  }
  losersRounds.push({
    roundNumber: lrRoundNum++,
    name: "LR1",
    stage: "LOSERS",
    roundIdentifier: "L1",
    matches: lr1Matches
  });
  let prevLosersMatches = lr1Matches;
  for (let p = 2; p <= K - 1; p++) {
    const roundIdent = `L${lrRoundNum}`;
    const roundName = `LR${lrRoundNum}`;
    const roundMatches = [];
    const wrDropRound = wrMatchesByRound[p];
    for (let m = 0; m < flatWidth; m++) {
      const id = `${prefix}l${lrRoundNum}-m${m + 1}`;
      const lrPrev = prevLosersMatches[m];
      const wrDrop = wrDropRound[flatWidth - 1 - m];
      const match = {
        id,
        tierId,
        stage: "LOSERS",
        roundIdentifier: roundIdent,
        roundNumber: lrRoundNum,
        roundIndex: lrRoundNum - 1,
        matchNumber: 0,
        player1: { player: null, sourceMatchId: lrPrev.id },
        player2: { player: null, sourceMatchId: wrDrop.id },
        slotA: { matchId: lrPrev.id, type: "WINNER" },
        slotB: { matchId: wrDrop.id, type: "LOSER" },
        winnerId: null,
        loserId: null,
        bestOf: getBestOf(roundIdent, lrRoundNum),
        isBye: false
      };
      lrPrev.nextMatchId = id;
      lrPrev.nextMatchSlot = 1;
      wrDrop.loserNextMatchId = id;
      wrDrop.loserNextMatchSlot = 2;
      roundMatches.push(match);
      matchesById[id] = match;
    }
    losersRounds.push({
      roundNumber: lrRoundNum++,
      name: roundName,
      stage: "LOSERS",
      roundIdentifier: roundIdent,
      matches: roundMatches
    });
    prevLosersMatches = roundMatches;
  }
  {
    const roundIdent = `L${lrRoundNum}`;
    const roundName = `LR${lrRoundNum}`;
    const roundMatches = [];
    const count = prevLosersMatches.length / 2;
    for (let m = 0; m < count; m++) {
      const id = `${prefix}l${lrRoundNum}-m${m + 1}`;
      const f1 = prevLosersMatches[2 * m];
      const f2 = prevLosersMatches[2 * m + 1];
      const match = {
        id,
        tierId,
        stage: "LOSERS",
        roundIdentifier: roundIdent,
        roundNumber: lrRoundNum,
        roundIndex: lrRoundNum - 1,
        matchNumber: 0,
        player1: { player: null, sourceMatchId: f1.id },
        player2: { player: null, sourceMatchId: f2.id },
        slotA: { matchId: f1.id, type: "WINNER" },
        slotB: { matchId: f2.id, type: "WINNER" },
        winnerId: null,
        loserId: null,
        bestOf: getBestOf(roundIdent, lrRoundNum),
        isBye: false
      };
      f1.nextMatchId = id;
      f1.nextMatchSlot = 1;
      f2.nextMatchId = id;
      f2.nextMatchSlot = 2;
      roundMatches.push(match);
      matchesById[id] = match;
    }
    losersRounds.push({
      roundNumber: lrRoundNum++,
      name: roundName,
      stage: "LOSERS",
      roundIdentifier: roundIdent,
      matches: roundMatches
    });
    prevLosersMatches = roundMatches;
  }
  {
    const roundIdent = `L${lrRoundNum}`;
    const roundName = `LR${lrRoundNum}`;
    const roundMatches = [];
    const semisRound = wrMatchesByRound[wrMatchesByRound.length - 2];
    const id1 = `${prefix}l${lrRoundNum}-m1`;
    const f1 = prevLosersMatches[0];
    const semi2 = semisRound[1];
    const match1 = {
      id: id1,
      tierId,
      stage: "LOSERS",
      roundIdentifier: roundIdent,
      roundNumber: lrRoundNum,
      roundIndex: lrRoundNum - 1,
      matchNumber: 0,
      player1: { player: null, sourceMatchId: f1.id },
      player2: { player: null, sourceMatchId: semi2.id },
      slotA: { matchId: f1.id, type: "WINNER" },
      slotB: { matchId: semi2.id, type: "LOSER" },
      winnerId: null,
      loserId: null,
      bestOf: getBestOf(roundIdent, lrRoundNum),
      isBye: false
    };
    f1.nextMatchId = id1;
    f1.nextMatchSlot = 1;
    semi2.loserNextMatchId = id1;
    semi2.loserNextMatchSlot = 2;
    roundMatches.push(match1);
    matchesById[id1] = match1;
    const id2 = `${prefix}l${lrRoundNum}-m2`;
    const f2 = prevLosersMatches[1];
    const semi1 = semisRound[0];
    const match2 = {
      id: id2,
      tierId,
      stage: "LOSERS",
      roundIdentifier: roundIdent,
      roundNumber: lrRoundNum,
      roundIndex: lrRoundNum - 1,
      matchNumber: 0,
      player1: { player: null, sourceMatchId: f2.id },
      player2: { player: null, sourceMatchId: semi1.id },
      slotA: { matchId: f2.id, type: "WINNER" },
      slotB: { matchId: semi1.id, type: "LOSER" },
      winnerId: null,
      loserId: null,
      bestOf: getBestOf(roundIdent, lrRoundNum),
      isBye: false
    };
    f2.nextMatchId = id2;
    f2.nextMatchSlot = 1;
    semi1.loserNextMatchId = id2;
    semi1.loserNextMatchSlot = 2;
    roundMatches.push(match2);
    matchesById[id2] = match2;
    losersRounds.push({
      roundNumber: lrRoundNum++,
      name: roundName,
      stage: "LOSERS",
      roundIdentifier: roundIdent,
      matches: roundMatches
    });
    prevLosersMatches = roundMatches;
  }
  {
    const roundIdent = `L${lrRoundNum}`;
    const roundName = `LR${lrRoundNum}`;
    const id = `${prefix}l${lrRoundNum}-m1`;
    const f1 = prevLosersMatches[0];
    const f2 = prevLosersMatches[1];
    const match = {
      id,
      tierId,
      stage: "LOSERS",
      roundIdentifier: roundIdent,
      roundNumber: lrRoundNum,
      roundIndex: lrRoundNum - 1,
      matchNumber: 0,
      player1: { player: null, sourceMatchId: f1.id },
      player2: { player: null, sourceMatchId: f2.id },
      slotA: { matchId: f1.id, type: "WINNER" },
      slotB: { matchId: f2.id, type: "WINNER" },
      winnerId: null,
      loserId: null,
      bestOf: getBestOf(roundIdent, lrRoundNum),
      isBye: false
    };
    f1.nextMatchId = id;
    f1.nextMatchSlot = 1;
    f2.nextMatchId = id;
    f2.nextMatchSlot = 2;
    const roundMatches = [match];
    matchesById[id] = match;
    losersRounds.push({
      roundNumber: lrRoundNum++,
      name: roundName,
      stage: "LOSERS",
      roundIdentifier: roundIdent,
      matches: roundMatches
    });
    prevLosersMatches = roundMatches;
  }
  {
    const roundIdent = `L${lrRoundNum}`;
    const roundName = `LR${lrRoundNum}`;
    const id = `${prefix}l${lrRoundNum}-m1`;
    const lrSurvivor = prevLosersMatches[0];
    const wfMatch2 = wrMatchesByRound[wrMatchesByRound.length - 1][0];
    const match = {
      id,
      tierId,
      stage: "LOSERS",
      roundIdentifier: roundIdent,
      roundNumber: lrRoundNum,
      roundIndex: lrRoundNum - 1,
      matchNumber: 0,
      player1: { player: null, sourceMatchId: lrSurvivor.id },
      player2: { player: null, sourceMatchId: wfMatch2.id },
      slotA: { matchId: lrSurvivor.id, type: "WINNER" },
      slotB: { matchId: wfMatch2.id, type: "LOSER" },
      winnerId: null,
      loserId: null,
      bestOf: getBestOf(roundIdent, lrRoundNum),
      isBye: false
    };
    lrSurvivor.nextMatchId = id;
    lrSurvivor.nextMatchSlot = 1;
    wfMatch2.loserNextMatchId = id;
    wfMatch2.loserNextMatchSlot = 2;
    const roundMatches = [match];
    matchesById[id] = match;
    losersRounds.push({
      roundNumber: lrRoundNum++,
      name: roundName,
      stage: "LOSERS",
      roundIdentifier: roundIdent,
      matches: roundMatches
    });
    prevLosersMatches = roundMatches;
  }
  const gfRoundNum = lrRoundNum;
  const wfMatch = wrMatchesByRound[wrMatchesByRound.length - 1][0];
  const lfMatch = prevLosersMatches[0];
  const gf1Id = `${prefix}gf1`;
  const gf1Match = {
    id: gf1Id,
    tierId,
    stage: "GRAND_FINALS",
    roundIdentifier: "GF",
    roundNumber: gfRoundNum,
    roundIndex: gfRoundNum - 1,
    matchNumber: 0,
    player1: { player: null, sourceMatchId: wfMatch.id },
    player2: { player: null, sourceMatchId: lfMatch.id },
    slotA: { matchId: wfMatch.id, type: "WINNER" },
    slotB: { matchId: lfMatch.id, type: "WINNER" },
    winnerId: null,
    loserId: null,
    bestOf: getBestOf("GF", gfRoundNum),
    isBye: false
  };
  wfMatch.nextMatchId = gf1Id;
  wfMatch.nextMatchSlot = 1;
  lfMatch.nextMatchId = gf1Id;
  lfMatch.nextMatchSlot = 2;
  matchesById[gf1Id] = gf1Match;
  const grandFinalsRound = {
    roundNumber: gfRoundNum,
    name: "GF",
    stage: "GRAND_FINALS",
    roundIdentifier: "GF",
    matches: [gf1Match]
  };
  let globalMatchNum = 1;
  for (const round of winnersRounds) {
    for (const match of round.matches) {
      match.matchNumber = globalMatchNum++;
    }
  }
  for (const round of losersRounds) {
    for (const match of round.matches) {
      match.matchNumber = globalMatchNum++;
    }
  }
  gf1Match.matchNumber = globalMatchNum++;
  applyDoubleElimRoundNames(winnersRounds, losersRounds, grandFinalsRound);
  const allRounds = [...winnersRounds, ...losersRounds, grandFinalsRound];
  for (let rIdx = 0; rIdx < allRounds.length; rIdx++) {
    allRounds[rIdx].roundNumber = rIdx + 1;
    for (const match of allRounds[rIdx].matches) {
      match.roundNumber = rIdx + 1;
      match.roundIndex = rIdx;
    }
  }
  return {
    tierId,
    type: "FLAT",
    eliminationType: "DOUBLE",
    bracketRouting: "FLAT_STAGED",
    flatWidth,
    totalPlayers,
    totalRounds: allRounds.length,
    rounds: allRounds,
    matchesById
  };
}
function generateAcceleratedHybrid(playersOrConfig, finalsCutoffArg, optionsArg) {
  let players2;
  let finalsCutoff;
  let options;
  if (Array.isArray(playersOrConfig)) {
    players2 = playersOrConfig;
    finalsCutoff = finalsCutoffArg || 16;
    options = optionsArg || {};
  } else {
    players2 = playersOrConfig.players;
    finalsCutoff = playersOrConfig.finalsCutoff || 16;
    options = playersOrConfig.options || {};
  }
  const totalPlayers = players2.length;
  if (totalPlayers < finalsCutoff) {
    throw new Error(`Accelerated hybrid bracket requires at least finalsCutoff (${finalsCutoff}) players, received ${totalPlayers}`);
  }
  const { tierId, bestOf = 3, roundBestOfOverrides = {} } = options;
  const getBestOf = createBestOfResolver(bestOf, roundBestOfOverrides);
  const prefix = tierId ? `${tierId}-` : "";
  const playerBySeed = /* @__PURE__ */ new Map();
  for (const p of players2) {
    playerBySeed.set(p.seed, p);
  }
  const matchesById = {};
  const rounds = [];
  let roundIndexCounter = 0;
  let roundNumberCounter = 1;
  const mAcc = finalsCutoff / 2;
  const arMatches = [];
  for (let m = 0; m < mAcc; m++) {
    const id = `${prefix}ar-m${m + 1}`;
    const s1 = m + 1;
    const s2 = finalsCutoff - m;
    const p1 = playerBySeed.get(s1);
    const p2 = playerBySeed.get(s2);
    const match = {
      id,
      tierId,
      stage: "WINNERS",
      phase: "QUALIFIERS",
      subTrack: "ACCELERATED",
      roundIdentifier: "AR",
      roundNumber: roundNumberCounter,
      roundIndex: roundIndexCounter,
      matchNumber: 0,
      player1: { player: p1 || null },
      player2: { player: p2 || null },
      slotA: { type: "DIRECT" },
      slotB: { type: "DIRECT" },
      winnerId: null,
      loserId: null,
      bestOf: getBestOf("AR", roundNumberCounter),
      isBye: false
    };
    arMatches.push(match);
    matchesById[id] = match;
  }
  const arRound = {
    roundNumber: roundNumberCounter++,
    name: "Accelerated Round",
    stage: "WINNERS",
    phase: "QUALIFIERS",
    roundIdentifier: "AR",
    matches: arMatches
  };
  roundIndexCounter++;
  const numPreMergePlayers = totalPlayers - finalsCutoff;
  const preMergeUpperRounds = [];
  const preMergeLowerRounds = [];
  let upperQualifierMatches = [];
  let lowerSurvivorMatches = [];
  if (numPreMergePlayers > 0) {
    const prePlayers = [];
    for (let s = finalsCutoff + 1; s <= totalPlayers; s++) {
      const p = playerBySeed.get(s);
      if (p) {
        prePlayers.push(p);
      } else {
        prePlayers.push({ id: `p${s}`, name: `Player ${s}`, seed: s });
      }
    }
    prePlayers.sort((a, b) => a.seed - b.seed);
    const normalizedPrePlayers = prePlayers.map((p, idx) => ({
      ...p,
      seed: idx + 1
    }));
    const preDE = generateTraditionalDoubleElim(normalizedPrePlayers, {
      tierId: tierId ? `${tierId}-pre` : "pre",
      bestOf,
      roundBestOfOverrides
    });
    const normalizedToRealPlayer = /* @__PURE__ */ new Map();
    prePlayers.forEach((p, idx) => {
      normalizedToRealPlayer.set(idx + 1, p);
    });
    const restorePlayer = (part) => {
      if (part.player && normalizedToRealPlayer.has(part.player.seed)) {
        part.player = normalizedToRealPlayer.get(part.player.seed);
      }
    };
    const rawWinnersRounds = preDE.rounds.filter(
      (r) => r.stage === "WINNERS" || r.roundIdentifier?.startsWith("W")
    );
    let upperHaltingIdx = rawWinnersRounds.findIndex((r) => r.matches.length === mAcc);
    if (upperHaltingIdx === -1) {
      upperHaltingIdx = rawWinnersRounds.findIndex((r) => r.matches.length <= mAcc);
      if (upperHaltingIdx === -1) {
        upperHaltingIdx = rawWinnersRounds.length - 1;
      }
    }
    const keptWinners = rawWinnersRounds.slice(0, upperHaltingIdx + 1);
    const rawLosersRounds = preDE.rounds.filter(
      (r) => r.stage === "LOSERS" || r.roundIdentifier?.startsWith("L")
    );
    let keptLosers = [];
    if (rawWinnersRounds[0].matches.length > mAcc) {
      let lowerHaltingIdx = -1;
      for (let i = 0; i < rawLosersRounds.length; i++) {
        const lr = rawLosersRounds[i];
        if (lr.matches.length === mAcc) {
          lowerHaltingIdx = i;
        } else if (lr.matches.length < mAcc && lowerHaltingIdx !== -1) {
          break;
        }
      }
      if (lowerHaltingIdx !== -1) {
        keptLosers = rawLosersRounds.slice(0, lowerHaltingIdx + 1);
      }
    }
    keptWinners.forEach((r, idx) => {
      const roundIdent = `PRE_W${idx + 1}`;
      r.roundIdentifier = roundIdent;
      r.name = `Upper Bracket R${idx + 1}`;
      r.stage = "WINNERS";
      r.phase = "QUALIFIERS";
      r.roundNumber = roundNumberCounter++;
      r.matches.forEach((m) => {
        m.stage = "WINNERS";
        m.phase = "QUALIFIERS";
        m.subTrack = "PRE_MERGE_UPPER";
        m.roundIdentifier = roundIdent;
        m.roundNumber = r.roundNumber;
        m.roundIndex = roundIndexCounter;
        restorePlayer(m.player1);
        restorePlayer(m.player2);
        matchesById[m.id] = m;
      });
      roundIndexCounter++;
      preMergeUpperRounds.push(r);
    });
    keptLosers.forEach((r, idx) => {
      const roundIdent = `PRE_L${idx + 1}`;
      r.roundIdentifier = roundIdent;
      r.name = `Lower Bracket R${idx + 1}`;
      r.stage = "LOSERS";
      r.phase = "QUALIFIERS";
      r.roundNumber = roundNumberCounter++;
      r.matches.forEach((m) => {
        m.stage = "LOSERS";
        m.phase = "QUALIFIERS";
        m.subTrack = "PRE_MERGE_LOWER";
        m.roundIdentifier = roundIdent;
        m.roundNumber = r.roundNumber;
        m.roundIndex = roundIndexCounter;
        restorePlayer(m.player1);
        restorePlayer(m.player2);
        matchesById[m.id] = m;
      });
      roundIndexCounter++;
      preMergeLowerRounds.push(r);
    });
    const upperHaltingRound = preMergeUpperRounds[preMergeUpperRounds.length - 1];
    upperQualifierMatches = upperHaltingRound ? upperHaltingRound.matches : [];
    for (const m of upperQualifierMatches) {
      m.nextMatchId = void 0;
      m.nextMatchSlot = void 0;
    }
    if (preMergeLowerRounds.length > 0) {
      const lowerHaltingRound = preMergeLowerRounds[preMergeLowerRounds.length - 1];
      lowerSurvivorMatches = lowerHaltingRound ? lowerHaltingRound.matches : [];
      for (const m of lowerSurvivorMatches) {
        m.nextMatchId = void 0;
        m.nextMatchSlot = void 0;
      }
    } else {
      lowerSurvivorMatches = upperQualifierMatches;
    }
  }
  const secondChanceMatches = [];
  const scRoundNumber = roundNumberCounter++;
  for (let m = 0; m < mAcc; m++) {
    const id = `${prefix}2c-m${m + 1}`;
    const arMatch = arMatches[m];
    const feederLower = lowerSurvivorMatches.length > 0 ? lowerSurvivorMatches[m % lowerSurvivorMatches.length] : void 0;
    const isLowerFeederWinner = preMergeLowerRounds.length > 0;
    const p1SrcId = feederLower?.id;
    const p2SrcId = arMatch.id;
    const match = {
      id,
      tierId,
      stage: "LOSERS",
      phase: "QUALIFIERS",
      subTrack: "RE_CLIMB",
      roundIdentifier: "2C",
      roundNumber: scRoundNumber,
      roundIndex: roundIndexCounter,
      matchNumber: 0,
      player1: { player: null, sourceMatchId: p1SrcId },
      player2: { player: null, sourceMatchId: p2SrcId },
      slotA: p1SrcId ? { matchId: p1SrcId, type: isLowerFeederWinner ? "WINNER" : "LOSER" } : void 0,
      slotB: { matchId: p2SrcId, type: "LOSER" },
      winnerId: null,
      loserId: null,
      bestOf: getBestOf("2C", scRoundNumber),
      isBye: false
    };
    if (feederLower) {
      if (isLowerFeederWinner) {
        feederLower.nextMatchId = id;
        feederLower.nextMatchSlot = 1;
      } else {
        feederLower.loserNextMatchId = id;
        feederLower.loserNextMatchSlot = 1;
      }
    }
    arMatch.loserNextMatchId = id;
    arMatch.loserNextMatchSlot = 2;
    secondChanceMatches.push(match);
    matchesById[id] = match;
  }
  const secondChanceRound = {
    roundNumber: scRoundNumber,
    name: `Lower Bracket R${preMergeLowerRounds.length + 1}`,
    stage: "LOSERS",
    phase: "QUALIFIERS",
    roundIdentifier: "2C",
    matches: secondChanceMatches
  };
  roundIndexCounter++;
  const playOffMatches = [];
  const poRoundNumber = roundNumberCounter++;
  for (let m = 0; m < mAcc; m++) {
    const id = `${prefix}po-m${m + 1}`;
    const upperMatch = upperQualifierMatches.length > 0 ? upperQualifierMatches[m % upperQualifierMatches.length] : void 0;
    const scMatch = secondChanceMatches[m];
    const p1SrcId = upperMatch?.id;
    const p2SrcId = scMatch.id;
    const match = {
      id,
      tierId,
      stage: "LOSERS",
      phase: "QUALIFIERS",
      subTrack: "RE_CLIMB",
      roundIdentifier: "PO",
      roundNumber: poRoundNumber,
      roundIndex: roundIndexCounter,
      matchNumber: 0,
      player1: { player: null, sourceMatchId: p1SrcId },
      player2: { player: null, sourceMatchId: p2SrcId },
      slotA: p1SrcId ? { matchId: p1SrcId, type: "WINNER" } : void 0,
      slotB: { matchId: p2SrcId, type: "WINNER" },
      winnerId: null,
      loserId: null,
      bestOf: getBestOf("PO", poRoundNumber),
      isBye: false
    };
    if (upperMatch) {
      upperMatch.nextMatchId = id;
      upperMatch.nextMatchSlot = 1;
    }
    scMatch.nextMatchId = id;
    scMatch.nextMatchSlot = 2;
    playOffMatches.push(match);
    matchesById[id] = match;
  }
  const playOffRound = {
    roundNumber: poRoundNumber,
    name: `Lower Bracket R${preMergeLowerRounds.length + 2}`,
    stage: "LOSERS",
    phase: "QUALIFIERS",
    roundIdentifier: "PO",
    matches: playOffMatches
  };
  roundIndexCounter++;
  const dummyChampPlayers = Array.from({ length: finalsCutoff }, (_, i) => ({
    id: `champ-p${i + 1}`,
    name: `Qualifier ${i + 1}`,
    seed: i + 1
  }));
  const champBracket = generateTraditionalBracket(dummyChampPlayers, {
    tierId: tierId ? `${tierId}-champ` : "champ",
    bestOf,
    roundBestOfOverrides
  });
  const champRounds = [];
  champBracket.rounds.forEach((r, rIdx) => {
    const roundNumber = roundNumberCounter++;
    const roundIdent = `CHAMP_R${rIdx + 1}`;
    r.roundNumber = roundNumber;
    r.stage = "GRAND_FINALS";
    r.phase = "CHAMPIONSHIP";
    r.roundIdentifier = roundIdent;
    r.name = rIdx === champBracket.rounds.length - 1 ? "Finals" : rIdx === champBracket.rounds.length - 2 ? "Semifinals" : rIdx === champBracket.rounds.length - 3 ? "Quarterfinals" : `Round of ${r.matches.length * 2}`;
    r.matches.forEach((m, mIdx) => {
      m.stage = "GRAND_FINALS";
      m.phase = "CHAMPIONSHIP";
      m.roundIdentifier = roundIdent;
      m.roundNumber = roundNumber;
      m.roundIndex = roundIndexCounter;
      if (rIdx === 0) {
        const arMatch = arMatches[mIdx % arMatches.length];
        const poMatch = playOffMatches[mIdx % playOffMatches.length];
        m.player1 = { player: null, sourceMatchId: arMatch.id };
        m.player2 = { player: null, sourceMatchId: poMatch.id };
        m.slotA = { matchId: arMatch.id, type: "WINNER" };
        m.slotB = { matchId: poMatch.id, type: "WINNER" };
        arMatch.nextMatchId = m.id;
        arMatch.nextMatchSlot = 1;
        poMatch.nextMatchId = m.id;
        poMatch.nextMatchSlot = 2;
      } else {
        m.player1 = { ...m.player1, player: null };
        m.player2 = { ...m.player2, player: null };
      }
      matchesById[m.id] = m;
    });
    roundIndexCounter++;
    champRounds.push(r);
  });
  rounds.push(arRound);
  rounds.push(...preMergeUpperRounds);
  rounds.push(...preMergeLowerRounds);
  rounds.push(secondChanceRound);
  rounds.push(playOffRound);
  rounds.push(...champRounds);
  let globalMatchNum = 1;
  for (const round of rounds) {
    for (const match of round.matches) {
      match.matchNumber = globalMatchNum++;
    }
  }
  return {
    tierId,
    type: "TRADITIONAL",
    eliminationType: "DOUBLE",
    bracketRouting: "ACCELERATED_HYBRID",
    finalsCutoff,
    totalPlayers,
    totalRounds: rounds.length,
    rounds,
    matchesById
  };
}
function generateDoubleEliminationBracket(players2, options = {}) {
  if (players2.length < 2) {
    throw new Error(`Double elimination bracket requires at least 2 players, received ${players2.length}`);
  }
  const routing = options.bracketRouting || "TRADITIONAL_TREE";
  switch (routing) {
    case "FLAT_STAGED": {
      const flatWidth = options.flatWidth || 4;
      return generateFlatDoubleElim({ players: players2, flatWidth, options });
    }
    case "ACCELERATED_HYBRID": {
      const finalsCutoff = options.finalsCutoff || 16;
      return generateAcceleratedHybrid({ players: players2, finalsCutoff, options });
    }
    case "TRADITIONAL_TREE":
    default:
      return generateTraditionalDoubleElim({ players: players2, options });
  }
}

// src/features/bracket/math/advance.ts
function advanceMatchWinner(bracket, matchId, winnerId) {
  const targetMatch = bracket.matchesById[matchId];
  if (!targetMatch) {
    throw new Error(`Match with id "${matchId}" not found in bracket.`);
  }
  const p1 = targetMatch.player1.player;
  const p2 = targetMatch.player2.player;
  let winnerPlayer = null;
  let loserId = null;
  if (p1 && p1.id === winnerId) {
    winnerPlayer = p1;
    loserId = p2 ? p2.id : null;
  } else if (p2 && p2.id === winnerId) {
    winnerPlayer = p2;
    loserId = p1 ? p1.id : null;
  } else {
    throw new Error(
      `Player with id "${winnerId}" is not a participant in match "${matchId}".`
    );
  }
  const updatedMatchesById = {};
  for (const [id, m] of Object.entries(bracket.matchesById)) {
    updatedMatchesById[id] = {
      ...m,
      player1: { ...m.player1, player: m.player1.player ? { ...m.player1.player } : null },
      player2: { ...m.player2, player: m.player2.player ? { ...m.player2.player } : null }
    };
  }
  const updatedMatch = updatedMatchesById[matchId];
  updatedMatch.winnerId = winnerId;
  updatedMatch.loserId = loserId;
  const propagateWinner = (m, winner) => {
    if (!m.nextMatchId || !m.nextMatchSlot) {
      return;
    }
    const nextMatch = updatedMatchesById[m.nextMatchId];
    if (!nextMatch) {
      return;
    }
    if (m.nextMatchSlot === 1) {
      nextMatch.player1 = {
        ...nextMatch.player1,
        player: winner,
        sourceMatchId: m.id
      };
    } else {
      nextMatch.player2 = {
        ...nextMatch.player2,
        player: winner,
        sourceMatchId: m.id
      };
    }
  };
  propagateWinner(updatedMatch, winnerPlayer);
  const loserPlayer = p1 && p1.id === loserId ? p1 : p2 && p2.id === loserId ? p2 : null;
  const propagateLoser = (m, loser) => {
    if (!m.loserNextMatchId || !m.loserNextMatchSlot || !loser) {
      return;
    }
    const loserNextMatch = updatedMatchesById[m.loserNextMatchId];
    if (!loserNextMatch) {
      return;
    }
    if (m.loserNextMatchSlot === 1) {
      loserNextMatch.player1 = {
        ...loserNextMatch.player1,
        player: loser,
        sourceMatchId: m.id
      };
    } else {
      loserNextMatch.player2 = {
        ...loserNextMatch.player2,
        player: loser,
        sourceMatchId: m.id
      };
    }
  };
  propagateLoser(updatedMatch, loserPlayer);
  const resetMatchId = `${updatedMatch.tierId ? updatedMatch.tierId + "-" : ""}gf-reset`;
  let grandFinalsResetMatchId = bracket.grandFinalsResetMatchId;
  if (updatedMatch.stage === "GRAND_FINALS" && updatedMatch.roundIdentifier === "GF") {
    const wbChamp = updatedMatch.player1.player;
    const lbChamp = updatedMatch.player2.player;
    if (lbChamp && winnerId === lbChamp.id && wbChamp) {
      const gfResetMatch = {
        id: resetMatchId,
        tierId: updatedMatch.tierId,
        stage: "GRAND_FINALS_RESET",
        roundIdentifier: "GF_RESET",
        roundNumber: updatedMatch.roundNumber,
        matchNumber: (updatedMatch.matchNumber || 0) + 1,
        player1: { player: { ...wbChamp }, sourceMatchId: updatedMatch.id },
        player2: { player: { ...lbChamp }, sourceMatchId: updatedMatch.id },
        winnerId: null,
        loserId: null,
        bestOf: updatedMatch.bestOf,
        isBye: false
      };
      updatedMatchesById[resetMatchId] = gfResetMatch;
      grandFinalsResetMatchId = resetMatchId;
    } else if (wbChamp && winnerId === wbChamp.id) {
      delete updatedMatchesById[resetMatchId];
      grandFinalsResetMatchId = void 0;
    }
  }
  const updatedRounds = bracket.rounds.map((round) => {
    let matches2 = round.matches.filter((m) => updatedMatchesById[m.id]).map((m) => updatedMatchesById[m.id]);
    if (round.stage === "GRAND_FINALS" && grandFinalsResetMatchId && updatedMatchesById[grandFinalsResetMatchId]) {
      const resetMatch = updatedMatchesById[grandFinalsResetMatchId];
      if (!matches2.some((m) => m.id === grandFinalsResetMatchId)) {
        matches2 = [...matches2, resetMatch];
      }
    }
    return {
      ...round,
      matches: matches2
    };
  });
  return {
    ...bracket,
    grandFinalsResetMatchId,
    rounds: updatedRounds,
    matchesById: updatedMatchesById
  };
}
function retractMatchWinner(bracket, matchId) {
  const targetMatch = bracket.matchesById[matchId];
  if (!targetMatch) {
    return bracket;
  }
  const retractedWinnerId = targetMatch.winnerId;
  const retractedLoserId = targetMatch.loserId;
  const updatedMatchesById = {};
  for (const [id, m] of Object.entries(bracket.matchesById)) {
    updatedMatchesById[id] = {
      ...m,
      player1: { ...m.player1, player: m.player1.player ? { ...m.player1.player } : null },
      player2: { ...m.player2, player: m.player2.player ? { ...m.player2.player } : null }
    };
  }
  const updatedMatch = updatedMatchesById[matchId];
  updatedMatch.winnerId = null;
  updatedMatch.loserId = null;
  const clearDownstream = (m, winnerIdToClear, loserIdToClear) => {
    const matchesToCheckForWinner = /* @__PURE__ */ new Set();
    if (m.nextMatchId) matchesToCheckForWinner.add(m.nextMatchId);
    if (winnerIdToClear) {
      for (const candidate of Object.values(updatedMatchesById)) {
        if (candidate.player1.player?.id === winnerIdToClear || candidate.player2.player?.id === winnerIdToClear || candidate.player1.sourceMatchId === m.id || candidate.player2.sourceMatchId === m.id) {
          matchesToCheckForWinner.add(candidate.id);
        }
      }
    }
    for (const nMatchId of matchesToCheckForWinner) {
      const nextMatch = updatedMatchesById[nMatchId];
      if (!nextMatch) continue;
      let clearedPlayer = false;
      if (m.nextMatchSlot === 1 && nextMatch.player1.sourceMatchId === m.id || winnerIdToClear && nextMatch.player1.player?.id === winnerIdToClear || nextMatch.player1.sourceMatchId === m.id) {
        if (nextMatch.player1.player !== null) {
          nextMatch.player1 = { player: null };
          clearedPlayer = true;
        }
      }
      if (m.nextMatchSlot === 2 && nextMatch.player2.sourceMatchId === m.id || winnerIdToClear && nextMatch.player2.player?.id === winnerIdToClear || nextMatch.player2.sourceMatchId === m.id) {
        if (nextMatch.player2.player !== null) {
          nextMatch.player2 = { player: null };
          clearedPlayer = true;
        }
      }
      if (clearedPlayer && (nextMatch.winnerId || nextMatch.loserId)) {
        const nextWinnerId = nextMatch.winnerId;
        const nextLoserId = nextMatch.loserId;
        nextMatch.winnerId = null;
        nextMatch.loserId = null;
        clearDownstream(nextMatch, nextWinnerId, nextLoserId);
      }
    }
    const matchesToCheckForLoser = /* @__PURE__ */ new Set();
    if (m.loserNextMatchId) matchesToCheckForLoser.add(m.loserNextMatchId);
    if (loserIdToClear) {
      for (const candidate of Object.values(updatedMatchesById)) {
        if (candidate.player1.player?.id === loserIdToClear || candidate.player2.player?.id === loserIdToClear || candidate.player1.sourceMatchId === m.id || candidate.player2.sourceMatchId === m.id) {
          matchesToCheckForLoser.add(candidate.id);
        }
      }
    }
    for (const lMatchId of matchesToCheckForLoser) {
      const loserNextMatch = updatedMatchesById[lMatchId];
      if (!loserNextMatch) continue;
      let clearedPlayer = false;
      if (m.loserNextMatchSlot === 1 && loserNextMatch.player1.sourceMatchId === m.id || loserIdToClear && loserNextMatch.player1.player?.id === loserIdToClear || loserNextMatch.player1.sourceMatchId === m.id) {
        if (loserNextMatch.player1.player !== null) {
          loserNextMatch.player1 = { player: null };
          clearedPlayer = true;
        }
      }
      if (m.loserNextMatchSlot === 2 && loserNextMatch.player2.sourceMatchId === m.id || loserIdToClear && loserNextMatch.player2.player?.id === loserIdToClear || loserNextMatch.player2.sourceMatchId === m.id) {
        if (loserNextMatch.player2.player !== null) {
          loserNextMatch.player2 = { player: null };
          clearedPlayer = true;
        }
      }
      if (clearedPlayer && (loserNextMatch.winnerId || loserNextMatch.loserId)) {
        const downstreamWinnerId = loserNextMatch.winnerId;
        const downstreamLoserId = loserNextMatch.loserId;
        loserNextMatch.winnerId = null;
        loserNextMatch.loserId = null;
        clearDownstream(loserNextMatch, downstreamWinnerId, downstreamLoserId);
      }
    }
  };
  clearDownstream(updatedMatch, retractedWinnerId, retractedLoserId);
  let grandFinalsResetMatchId = bracket.grandFinalsResetMatchId;
  const resetMatchId = `${updatedMatch.tierId ? updatedMatch.tierId + "-" : ""}gf-reset`;
  if (updatedMatch.stage === "GRAND_FINALS" && updatedMatch.roundIdentifier === "GF") {
    delete updatedMatchesById[resetMatchId];
    grandFinalsResetMatchId = void 0;
  }
  const updatedRounds = bracket.rounds.map((round) => ({
    ...round,
    matches: round.matches.filter((m) => updatedMatchesById[m.id]).map((m) => updatedMatchesById[m.id])
  }));
  return {
    ...bracket,
    grandFinalsResetMatchId,
    rounds: updatedRounds,
    matchesById: updatedMatchesById
  };
}
function swapMatchSlots(bracket, payload) {
  const { sourceMatchId, sourceSlot, targetMatchId, targetSlot } = payload;
  const sourceMatch = bracket.matchesById[sourceMatchId];
  const targetMatch = bracket.matchesById[targetMatchId];
  if (!sourceMatch) {
    throw new Error(`Source match with id "${sourceMatchId}" not found in bracket.`);
  }
  if (!targetMatch) {
    throw new Error(`Target match with id "${targetMatchId}" not found in bracket.`);
  }
  if (sourceMatch.roundNumber !== targetMatch.roundNumber) {
    throw new Error(
      `Cannot swap match slots across different rounds: Source round ${sourceMatch.roundNumber} vs Target round ${targetMatch.roundNumber}.`
    );
  }
  const sourceStage = sourceMatch.stage || "WINNERS";
  const targetStage = targetMatch.stage || "WINNERS";
  if (sourceStage !== targetStage) {
    throw new Error(
      `Cannot swap match slots across different bracket stages: ${sourceStage} vs ${targetStage}.`
    );
  }
  const updatedMatchesById = {};
  for (const [id, m] of Object.entries(bracket.matchesById)) {
    updatedMatchesById[id] = {
      ...m,
      player1: { ...m.player1, player: m.player1.player ? { ...m.player1.player } : null },
      player2: { ...m.player2, player: m.player2.player ? { ...m.player2.player } : null }
    };
  }
  const clonedSource = updatedMatchesById[sourceMatchId];
  const clonedTarget = updatedMatchesById[targetMatchId];
  const srcParticipant = sourceSlot === 1 ? clonedSource.player1 : clonedSource.player2;
  const tgtParticipant = targetSlot === 1 ? clonedTarget.player1 : clonedTarget.player2;
  const tempSrc = { ...srcParticipant };
  const tempTgt = { ...tgtParticipant };
  const srcHasPlayer = tempSrc.player !== null;
  const tgtHasPlayer = tempTgt.player !== null;
  if (sourceSlot === 1) {
    clonedSource.player1 = {
      ...tempTgt,
      isManualOverride: tgtHasPlayer ? true : void 0,
      originalSourceMatchId: tempTgt.originalSourceMatchId || tempTgt.sourceMatchId
    };
  } else {
    clonedSource.player2 = {
      ...tempTgt,
      isManualOverride: tgtHasPlayer ? true : void 0,
      originalSourceMatchId: tempTgt.originalSourceMatchId || tempTgt.sourceMatchId
    };
  }
  if (targetSlot === 1) {
    clonedTarget.player1 = {
      ...tempSrc,
      isManualOverride: srcHasPlayer ? true : void 0,
      originalSourceMatchId: tempSrc.originalSourceMatchId || tempSrc.sourceMatchId
    };
  } else {
    clonedTarget.player2 = {
      ...tempSrc,
      isManualOverride: srcHasPlayer ? true : void 0,
      originalSourceMatchId: tempSrc.originalSourceMatchId || tempSrc.sourceMatchId
    };
  }
  const updatedRounds = bracket.rounds.map((round) => ({
    ...round,
    matches: round.matches.filter((m) => updatedMatchesById[m.id]).map((m) => updatedMatchesById[m.id])
  }));
  return {
    ...bracket,
    rounds: updatedRounds,
    matchesById: updatedMatchesById
  };
}

// src/features/qualifiers/scoring.ts
var MAXOUT_THRESHOLD = 999999;
function getPlayerQualifierStatus(tournament, playerId) {
  if (tournament.isLocked) {
    return "verified";
  }
  const tPlayer = tournament.tournamentPlayers?.[playerId];
  if (tPlayer?.isVerified || tPlayer?.qualsCompleted) {
    return "verified";
  }
  const playerSubs = (tournament.qualifierSubmissions || []).filter(
    (s) => s.playerId === playerId
  );
  if (playerSubs.length === 0) {
    return "not started";
  }
  return "in progress";
}
function calculateMaxoutAndKicker(submissions) {
  if (submissions.length === 0) {
    return { maxoutCount: 0, kickerScore: 0, bestScore: 0 };
  }
  const scores = submissions.map((s) => s.score);
  const maxoutCount = scores.filter((s) => s >= MAXOUT_THRESHOLD).length;
  const nonMaxouts = scores.filter((s) => s < MAXOUT_THRESHOLD);
  const kickerScore = nonMaxouts.length > 0 ? Math.max(...nonMaxouts) : 0;
  const bestScore = Math.max(...scores);
  return { maxoutCount, kickerScore, bestScore };
}
function calculateAverageOfX(submissions, targetX = 2, isClosedOrComplete = false) {
  if (submissions.length === 0) {
    return { average: 0, count: 0, rawAverage: 0 };
  }
  const scores = submissions.map((s) => s.score);
  const sum = scores.reduce((a, b) => a + b, 0);
  if (isClosedOrComplete) {
    const divisor = Math.max(scores.length, targetX);
    const average = Math.round(sum / divisor);
    return { average, count: scores.length, rawAverage: sum / divisor };
  } else {
    const average = Math.round(sum / scores.length);
    return { average, count: scores.length, rawAverage: sum / scores.length };
  }
}
function calculatePoints(submissions, config = []) {
  if (submissions.length === 0 || config.length === 0) {
    return { totalPoints: 0, pointsPerAttempt: [] };
  }
  const sortedThresholds = [...config].sort((a, b) => b.minScore - a.minScore);
  const pointsPerAttempt = [];
  let totalPoints = 0;
  for (const sub of submissions) {
    const matched = sortedThresholds.find((t) => sub.score >= t.minScore);
    const earned = matched ? matched.points : 0;
    pointsPerAttempt.push(earned);
    totalPoints += earned;
  }
  return { totalPoints, pointsPerAttempt };
}
function deriveLeaderboard(tournament) {
  const pool = tournament.playersPool || [];
  const submissions = tournament.qualifierSubmissions || [];
  const tournamentPlayers2 = tournament.tournamentPlayers || {};
  const submissionsByPlayer = /* @__PURE__ */ new Map();
  for (const sub of submissions) {
    const list = submissionsByPlayer.get(sub.playerId) || [];
    list.push(sub);
    submissionsByPlayer.set(sub.playerId, list);
  }
  const rawRows = pool.map((player) => {
    const playerSubs = (submissionsByPlayer.get(player.id) || []).sort(
      (a, b) => a.submittedAt - b.submittedAt
    );
    const tPlayer = tournamentPlayers2[player.id];
    const isCompleted = tournament.isLocked || Boolean(tPlayer?.qualsCompleted);
    const isDisqualified = Boolean(player.isDisqualified);
    let finalScore = 0;
    let formattedDetail = "No attempts";
    let maxoutCount = void 0;
    let kickerScore = void 0;
    if (tournament.qualFormat === "HIGH_SCORE") {
      const res = calculateMaxoutAndKicker(playerSubs);
      finalScore = res.bestScore;
      maxoutCount = res.maxoutCount;
      kickerScore = res.kickerScore;
      if (res.maxoutCount > 0) {
        formattedDetail = res.kickerScore > 0 ? `${res.maxoutCount}x Max (Kicker: ${res.kickerScore.toLocaleString()})` : `${res.maxoutCount}x Max`;
      } else {
        formattedDetail = playerSubs.length > 0 ? `${playerSubs.length} ${playerSubs.length === 1 ? "attempt" : "attempts"}` : "0 attempts";
      }
    } else if (tournament.qualFormat === "AVERAGE_OF_X") {
      const targetX = tournament.qualAverageCount || 2;
      const res = calculateAverageOfX(playerSubs, targetX, isCompleted);
      finalScore = res.average;
      formattedDetail = `Ao${res.count} (${playerSubs.length}/${targetX})`;
    } else if (tournament.qualFormat === "POINTS") {
      const res = calculatePoints(playerSubs, tournament.pointsConfig || []);
      finalScore = res.totalPoints;
      formattedDetail = `${res.totalPoints} pts (${playerSubs.length} attempts)`;
    }
    const peakScore = playerSubs.length > 0 ? Math.max(...playerSubs.map((s) => s.score)) : 0;
    const earliestTimestamp = playerSubs.length > 0 ? Math.min(...playerSubs.map((s) => s.submittedAt)) : Number.MAX_SAFE_INTEGER;
    return {
      player,
      attempts: playerSubs.map((s) => s.score),
      formattedDetail,
      finalScore,
      peakScore,
      maxoutCount,
      kickerScore,
      isDisqualified,
      status: getPlayerQualifierStatus(tournament, player.id),
      earliestTimestamp
    };
  });
  const qualifiedRows = rawRows.filter((r) => r.attempts.length > 0);
  const unstartedRows = rawRows.filter((r) => r.attempts.length === 0);
  qualifiedRows.sort((a, b) => {
    if (tournament.qualFormat === "HIGH_SCORE") {
      const aMax = a.maxoutCount || 0;
      const bMax = b.maxoutCount || 0;
      if (bMax !== aMax) {
        return bMax - aMax;
      }
      if (bMax > 0) {
        const aKicker = a.kickerScore || 0;
        const bKicker = b.kickerScore || 0;
        if (bKicker !== aKicker) {
          return bKicker - aKicker;
        }
        if (b.finalScore !== a.finalScore) {
          return b.finalScore - a.finalScore;
        }
      } else {
        if (b.finalScore !== a.finalScore) {
          return b.finalScore - a.finalScore;
        }
      }
    } else if (tournament.qualFormat === "POINTS") {
      if (b.finalScore !== a.finalScore) {
        return b.finalScore - a.finalScore;
      }
      const aPeak = a.peakScore ?? 0;
      const bPeak = b.peakScore ?? 0;
      if (bPeak !== aPeak) {
        return bPeak - aPeak;
      }
    } else {
      if (b.finalScore !== a.finalScore) {
        return b.finalScore - a.finalScore;
      }
    }
    if (a.earliestTimestamp !== b.earliestTimestamp) {
      return a.earliestTimestamp - b.earliestTimestamp;
    }
    return a.player.id.localeCompare(b.player.id);
  });
  const sortedTiers = [...tournament.tiers].sort((a, b) => a.priority - b.priority);
  const tierRanges = [];
  let currentCutoff = 0;
  for (const tier of sortedTiers) {
    const startRank = currentCutoff + 1;
    const endRank = currentCutoff + tier.playerCount;
    tierRanges.push({ tier, startRank, endRank });
    currentCutoff = endRank;
  }
  let activeRankCounter = 1;
  const qualifiedResult = qualifiedRows.map((item, idx) => {
    const rank = activeRankCounter++;
    const matchingRange = tierRanges.find(
      (r) => rank >= r.startRank && rank <= r.endRank
    );
    if (matchingRange) {
      const tierSeed = rank - matchingRange.startRank + 1;
      return {
        ...item,
        rank,
        globalRank: idx + 1,
        assignedTier: matchingRange.tier,
        tierSeed,
        isDNQ: false
      };
    }
    if (tierRanges.length === 0) {
      return {
        ...item,
        rank,
        globalRank: idx + 1,
        assignedTier: void 0,
        tierSeed: void 0,
        isDNQ: false
      };
    }
    return {
      ...item,
      rank,
      globalRank: idx + 1,
      assignedTier: void 0,
      tierSeed: void 0,
      isDNQ: true
    };
  });
  unstartedRows.sort((a, b) => a.player.name.localeCompare(b.player.name));
  const unstartedResult = unstartedRows.map((item) => ({
    ...item,
    rank: void 0,
    globalRank: void 0,
    assignedTier: void 0,
    tierSeed: void 0,
    isDNQ: false
  }));
  return [...qualifiedResult, ...unstartedResult];
}
function generateFullTierBracket(tier, availablePlayers) {
  const capacity = Math.max(tier.playerCount || 2, 2);
  const fullSeeds = Array.from({ length: capacity }, (_, idx) => {
    const seedNum = idx + 1;
    const existing = availablePlayers.find((p) => p.seed === seedNum);
    if (existing) {
      return existing;
    }
    return {
      id: `placeholder-seed-${tier.id}-${seedNum}`,
      name: `Seed ${seedNum}`,
      seed: seedNum
    };
  });
  const options = {
    tierId: tier.id,
    bestOf: tier.bestOf,
    roundBestOfOverrides: tier.roundBestOfOverrides,
    bracketRouting: tier.bracketRouting,
    flatWidth: tier.flatWidth,
    finalsCutoff: tier.finalsCutoff
  };
  return tier.eliminationType === "DOUBLE" ? generateDoubleEliminationBracket(fullSeeds, options) : tier.bracketType === "FLAT" ? generateFlatBracket(fullSeeds, tier.flatWidth || 4, options) : generateTraditionalBracket(fullSeeds, options);
}
function generateDraftBracketsForTournament(tournament) {
  const sortedTiers = [...tournament.tiers].sort((a, b) => a.priority - b.priority);
  if (tournament.seedingMethod === "MANUAL") {
    const manualIds = tournament.manualSeeds || [];
    const playerMap = new Map((tournament.playersPool || []).map((p) => [p.id, p]));
    const validIds = manualIds.filter((id) => playerMap.has(id));
    let currentOffset = 0;
    return sortedTiers.map((tier) => {
      const tierCapacity = tier.playerCount;
      const tierPlayerIds = validIds.slice(currentOffset, currentOffset + tierCapacity);
      currentOffset += tierCapacity;
      const seededPlayers = tierPlayerIds.map((id, idx) => {
        const p = playerMap.get(id);
        return {
          id,
          name: p?.name || "Unknown",
          seed: idx + 1,
          country: p?.country,
          playstyle: p?.playstyle
        };
      });
      return {
        ...tier,
        bracket: generateFullTierBracket(tier, seededPlayers)
      };
    });
  }
  const leaderboard = deriveLeaderboard(tournament);
  return sortedTiers.map((tier) => {
    const tierRows = leaderboard.filter(
      (row) => row.assignedTier?.id === tier.id && row.tierSeed !== void 0
    );
    const seededPlayers = tierRows.map((row) => ({
      id: row.player.id,
      name: row.player.name,
      seed: row.tierSeed,
      country: row.player.country,
      playstyle: row.player.playstyle
    }));
    return {
      ...tier,
      bracket: generateFullTierBracket(tier, seededPlayers)
    };
  });
}

// src/features/tournament/data/authenticPlayers.ts
var AUTHENTIC_COMPETITOR_NAMES = [
  "810770",
  "20Dan03",
  "321mrhaatz",
  "3arrett",
  "3nt0n",
  "3rr0r400",
  "666_tim",
  "7thace",
  "8888q",
  "8CLICK",
  "a_benz11",
  "Abacys",
  "ihatelife1128",
  "sudertum",
  "abysse",
  "AdamMts02",
  "acorndogulous",
  "adamanatite",
  "AdirondackRick",
  "adrena1in_bdg",
  "adudeabides",
  "AelinaXY",
  "afaelr",
  "afmirror",
  "aGameScout",
  "AgusVitta",
  "aholloteul",
  "airetho",
  "der_ajax",
  "ajmiressi",
  "akafuku",
  "AkAtu__",
  "AKGrandmasterB",
  "Akideemus",
  "akuma0xd",
  "alden_combs",
  "alecat",
  "alejotetris",
  "sandro_vs_the_world",
  "alex_c",
  "ALEX_H",
  "Kitaru",
  "alexstroescu",
  "tetrisalext",
  "alexktetrisen",
  "ALEXL_812",
  "Elsantiagodelpueblo",
  "alice_fern01",
  "ctnallenbot",
  "ally_ok",
  "Almavapor",
  "almostnamedone",
  "AlohaAxe",
  "alphabethq",
  "Alwin___",
  "amatakiri",
  "AMJ_Productions",
  "anberdoodle",
  "anchikai",
  "andalusian_retrogamer",
  "andmind87",
  "Andre01001110",
  "andrew4043",
  "andreycclef94",
  "andrey____k",
  "PizzaPastaTetramino",
  "angrycoler",
  "anangryroro",
  "malezoltekrety",
  "anicomi",
  "anid29",
  "anjingbermaintetris",
  "VinesandWillows",
  "annishark",
  "anomalous_kh",
  "anpu2468",
  "anseltetris",
  "anxieCHRIS",
  "aoifetetris",
  "aproperdog",
  "arbarrro",
  "arcantiusx",
  "Archina",
  "archnash",
  "Arci (Sweden)",
  "ArcticXC",
  "LapzwansProducties",
  "arden_0451",
  "arhplaystetris",
  "ariszplaystetris",
  "armonsounds",
  "armstrong6263",
  "art_vandelay_tetris",
  "arthurvandork",
  "arthur_tetris",
  "ashg",
  "ashley_38",
  "asleepyallie",
  "asmadigames",
  "astatineeffect",
  "astrid_wlw",
  "astrophysiciann",
  "atalito",
  "hatkoster2",
  "ATOOSHKA93",
  "audioholiker",
  "aur9",
  "avaslive",
  "AVGeekW159",
  "avnjofficial",
  "Avogadruu",
  "avriixtwitch",
  "awning_guy",
  "axiom_105",
  "Zarzamoritas",
  "anfonyhoe",
  "B14NK17",
  "babbons2",
  "doublesmokedbaconandpie",
  "bacon382ttv",
  "baehoven_tetris",
  "Bajabberwabbers",
  "bakadrian13",
  "tBalaage",
  "balbarb",
  "banjo26_twitch",
  "huy12315",
  "bard_ow",
  "barryblanket",
  "batfoy",
  "bbforky",
  "bbot42",
  "baebeabae",
  "beadle111",
  "niko_ssbm",
  "BeastinShen",
  "beigehunter",
  "BenMullen297",
  "bendy1streams",
  "benfamir",
  "b3njy_b0y",
  "bennbanasik",
  "BennoLCK",
  "Bergtroll7",
  "bernimel",
  "betastrep",
  "betatetris",
  "bh180",
  "Big_Red01027",
  "bigboi4672",
  "biggiemac42",
  "big_lewwi",
  "BigPileGuam",
  "ImBigSippy",
  "bigw33d420",
  "billymacmakes",
  "birbia1",
  "TheBirbWizard",
  "birdnamednorah",
  "bunnybisbyclyde",
  "blaargmallcop",
  "blackberg",
  "blackcat_10",
  "blakegong",
  "realbland",
  "Blarg_Meister",
  "blauwalbube",
  "blazecc",
  "blazier",
  "blingus_b",
  "blockhead137",
  "filipinotetrisplayer187",
  "BlueSchizo",
  "bluescuti",
  "bluebob",
  "blurthefur",
  "boSTEIL",
  "boatsnjoes",
  "bobby",
  "boppypenguins",
  "b0rkedbear",
  "BossRoss_TV",
  "bot_1985",
  "bowser_tb",
  "boxie3210",
  "branestris",
  "BreakfastNoodles",
  "bv_09",
  "alongexpectedparty84",
  "brianwilliams42",
  "Brianc",
  "briantheone4340",
  "swankiesthail9",
  "britqk",
  "bro3256",
  "brodindamp",
  "bryandmendes",
  "BType_",
  "BubbleRhapsody",
  "bubbleg231",
  "mobuco",
  "chillinbuddy",
  "bug_3099",
  "buleskane",
  "bullseye_tech",
  "circularcyclone",
  "BurkeTKenny",
  "burki96",
  "burritodad",
  "Butter3dT0ast",
  "Bxnshy",
  "cdubs_cs",
  "c00bmaster",
  "c3dl",
  "cable2813",
  "thecalculatingpoet",
  "calebsgamesandstuff",
  "calibrate5",
  "calimanx_",
  "CameelHabibHabab",
  "cardek87",
  "carelessbtw",
  "sativa_mgs",
  "CasuallyPwning",
  "itscathy",
  "catsugiri",
  "catvinityTV",
  "cchristm",
  "p1_carter",
  "chaotichazel_12",
  "charkraa",
  "CharlesSparkley",
  "thehazelnutmilk",
  "cheez_e",
  "Chefboyargeebs",
  "chefgobes",
  "chessjerk",
  "chidoriplays",
  "chillalla_",
  "ChirpingMatt",
  "chipjockey",
  "chodelerone",
  "thrn1",
  "bsg4000",
  "CBrady79",
  "ForystChris",
  "ChrisJarzyna",
  "boomtang",
  "lilsquibbles",
  "liar_o7",
  "chroma________",
  "chromodynam1c",
  "ChronosReturns",
  "Chupalika",
  "ChushiGloria",
  "cimbraien",
  "cineq01",
  "cipollara",
  "civel17",
  "fancyclance",
  "heyitsmeclarity",
  "theclassicmisdrop",
  "claver4",
  "claw_hammer",
  "cleman73",
  "Clockworker2k",
  "ClubsodaWithLime",
  "coalbucket2",
  "amCobalt",
  "cobra6731",
  "CodeCracker01",
  "c0oki1",
  "coldcut6",
  "iliketocolor2",
  "martincolston",
  "blxxdspxll11",
  "blackstar_c",
  "combatslayer23",
  "mini_rafa1",
  "condensed_arin",
  "Coolguy4535",
  "corealign",
  "COuntNeko",
  "cousin_avi33",
  "Cousinouf",
  "coverdales4",
  "coxdannyj",
  "tetriscrab",
  "crabrangoon_24",
  "crafteekim",
  "crazilycrazy29",
  "creepercraftyt20",
  "croios7",
  "Crowhuntt",
  "cryticalapis",
  "CTBeNeLux",
  "classictetris_germany",
  "cub_03",
  "cuberru",
  "ucatetris",
  "curbaczzz",
  "c_uri",
  "curtam1e",
  "cwiekoszczak",
  "cwiiis",
  "cyansyber",
  "kaizo_kay",
  "cygerion",
  "cylersrc",
  "czarjordan",
  "its_dlo",
  "da3mon9420",
  "daasiann_",
  "Dabeast153",
  "dabliuwn",
  "dadodiciassette",
  "Dadtris",
  "dan___999",
  "danandr",
  "danidoodles8",
  "daniel_lum12",
  "DanieleMelonz",
  "danielsong39",
  "DanLDP",
  "danny_mage",
  "DanQZtwitch",
  "dansushi",
  "danvypants",
  "dark_shadow6000",
  "DarkAries",
  "DarkFox36",
  "incineroar_hpfrunner",
  "Darth__bunny",
  "DarthDreadz",
  "DAS_Master",
  "davesmithsays",
  "david_3bof",
  "davidvulich",
  "dawgplayingtetris",
  "dawidkbc",
  "dawsongrr",
  "DazMMV",
  "dazzeloids",
  "db_ygo",
  "dbpoofdaddy2023",
  "dbsssss",
  "DdtRegulator",
  "ddung_____",
  "sokoieoko",
  "De__Martian",
  "TheAccessDEANied",
  "Death_Taxes_N64",
  "decklad1",
  "deepshock_01",
  "deewee7",
  "deimos88",
  "dekk_cl",
  "Denis1080",
  "Depcow",
  "dermotninja",
  "deserteagle417",
  "devboss_longbar",
  "DevolitionDerby",
  "dexfore",
  "dgcubes",
  "dgordon888",
  "thediamonds8",
  "divinelyinspiredname",
  "diggsasura",
  "Answer2Question",
  "budulaev",
  "Dimnel",
  "dinkerson_",
  "dirkiedurky",
  "dishwasher_010",
  "DitShadows",
  "DivCaste",
  "Dizzy",
  "djaco98",
  "djmrboro",
  "dmhero",
  "dmj_81",
  "dmsy",
  "DobryCzlowiek1",
  "docpi314",
  "dogplayingtetris",
  "doge_nestris",
  "donlooz",
  "theMCDO",
  "doodle89",
  "doom338",
  "doomster89",
  "dorukkaptan95",
  "dqclan_",
  "storminorman_",
  "treswell",
  "drfuzzman",
  "drjules13",
  "DrKnock3rs",
  "dtheorem",
  "duckrental",
  "socheek",
  "gigaduzyk",
  "dyasalure",
  "dzag",
  "e_flat7",
  "eaglenight",
  "eandis99",
  "eclasx32",
  "ED",
  "MrSwartt",
  "eee_inn",
  "bogol243",
  "eggdizzy",
  "ekki50333",
  "el_pantzzzzz",
  "elijahn5",
  "eli65536",
  "elias42_",
  "ieli2tyree011",
  "eliwa131",
  "ellerystacks",
  "illerhas",
  "ellht01l",
  "Elpailtem",
  "elvalle24",
  "emokidstacks",
  "emptyZbVCEZ",
  "Emptyeye",
  "loote_",
  "literaldescend",
  "enrique_cy",
  "enscalight",
  "eq_pillow",
  "iuqe",
  "eradach",
  "cooliceage",
  "EricICX",
  "erilioness",
  "jillie_vanillie",
  "esauneagle",
  "essavibe",
  "eternalsnowww_",
  "ETFruitNinja",
  "ethan_taikotris",
  "ethanthoughts",
  "EumeliLP",
  "evanj_tetris",
  "evesylive",
  "evuusan",
  "evybabee",
  "excadrilltetris",
  "Exewin",
  "exity__",
  "f1champion_tetris",
  "f1prox407",
  "FABIO WONG",
  "tetris4fabrice",
  "failmanflo",
  "falkite123",
  "falseminute8894",
  "Famarok",
  "farhanalgustian_tetris",
  "FatherEsteban",
  "fatiguegd",
  "fatsam_sam_macau",
  "FBI_stevo",
  "felinho3006",
  "nerdyfelix_",
  "felixfelicis",
  "your__Emperor",
  "ferrowgc",
  "FFRPro21",
  "fh__jordan",
  "firedox532",
  "itsfireworks",
  "flashboy_lhq",
  "flashmonger",
  "fleetato",
  "flexiumnova",
  "IvanOdintsoff",
  "wannabetetrispro",
  "foiledthrice",
  "folded_tetris",
  "fouadztetris",
  "fractal",
  "fradog",
  "framedump",
  "rizz1010",
  "FRANKO",
  "frankthetrain",
  "franticthumb",
  "fredagsvik",
  "frdhlm",
  "alexfreeman",
  "frenchiestfrie223",
  "FreyasSpirit",
  "FridayWitch",
  "Tetrisfrieder",
  "fritzunterbrink",
  "froggoinkeeb",
  "fulter092",
  "fur_of_kitten",
  "furio4299",
  "furiousprogramming",
  "FormerFuture1",
  "iamfynny0",
  "gabrielrezende25",
  "gagesgardens",
  "galaxybiscuit_",
  "galoomba_",
  "GamingwithNino",
  "garionoldwolf",
  "gaster319",
  "gbrm8",
  "gbtoast",
  "gcstetris",
  "GDudge18",
  "GeeForce272",
  "gekkijb",
  "genialergandalf",
  "GenoThePuppet",
  "gvanhalderen",
  "GERALD",
  "gerald_freeman",
  "gerhard_adler",
  "miltankamiibo",
  "gerzithegiz",
  "gforce917",
  "spectral_presence",
  "xgiantxnin",
  "gildedlizard",
  "gi_0h",
  "Giovanniostuni",
  "girlysatan",
  "notengonombreusario",
  "glacier_tetris",
  "glanberen",
  "gleen2509",
  "Glitchcat7",
  "Goel25",
  "goldennickel",
  "Goober_LP",
  "gordan",
  "christiangorilla",
  "goSciu",
  "ourladygothwitch",
  "GrandDesigns82",
  "GrannyPanPan",
  "grantculverston",
  "grape223",
  "gravel1942",
  "restingzzz",
  "suitougreentea",
  "GregBoomCannon",
  "grego_the_greatest",
  "gresiu",
  "Groblin_y6y",
  "grzechooo",
  "GuardianPsycho",
  "guerreroasdf",
  "gummithecat",
  "guneng24345",
  "guntertetris",
  "guppy_dmg",
  "gus_t8v0",
  "gwafey",
  "h.r",
  "oghappydude",
  "halloweeen55",
  "HallucinatiKiyo",
  "hamadoshi",
  "lilcutiehana",
  "hangamaster",
  "harddropcafe",
  "harriemcracc",
  "harrison15701",
  "SuPaSaYaJiN",
  "fromhavensbedroom",
  "headjump",
  "Heater123",
  "seriousproducer",
  "frodo_dodo_",
  "HeistOnline",
  "Hello_world_10",
  "Helomair",
  "heppsxd",
  "hepta2",
  "Hezzuli",
  "flipkidd123",
  "hideri_nestris",
  "highestlevelwizard",
  "hikarutetrio",
  "hilbert__space",
  "himhim77",
  "hiphyemac96",
  "hiwd80",
  "hiybehub",
  "Holifyre",
  "homejacob",
  "hontnog",
  "hook64",
  "hubertus1512",
  "Huffulufugus_",
  "hunn14",
  "hunterfourz",
  "2lt_hyakutaro",
  "hydrantdude8",
  "HyLoHighLowHyLo",
  "thehypermisdropper",
  "is1x_",
  "iankeith",
  "iankanetsu",
  "iball1_",
  "Iceblade73",
  "Icefox",
  "id_kirby",
  "idudhjf",
  "mdkyw",
  "ilinilinilin",
  "Iljain",
  "madv0x",
  "ImDSS",
  "imoclol",
  "implode573",
  "indian_luke",
  "Inexistence124",
  "infamous (NJ)",
  "Insaniso_",
  "isabella",
  "isaque_nes",
  "IsE",
  "itsthefirehere",
  "ivory_99",
  "gamerzplay725",
  "theworldssmartestgenius",
  "j3tdagoat",
  "J4CKPTC",
  "jaanuush",
  "jack13berry",
  "jacksosmooth",
  "ThirstyJacobo",
  "twigxcabaret",
  "jahonjahon",
  "dk_mono",
  "rocketman",
  "jakeywinks",
  "tetrisjakub",
  "jamezo0",
  "Janutzska",
  "januaryneverends",
  "japorto",
  "jatloeftw",
  "javantea",
  "javu3",
  "jawnnjawn",
  "aaronjawshomoki",
  "JayDubbyy2k",
  "jayp33e",
  "jayplaystetris",
  "jan_zon",
  "jazzthief81",
  "JazzySpinalFusion",
  "j_d_h",
  "jdhcdaboi",
  "jedxo",
  "jedigrzyb",
  "jedievan4",
  "jedimarcus1337",
  "Jeez007bd",
  "digginout",
  "jejeremias",
  "jello_ssb",
  "JellyOMally",
  "jellonaviina",
  "Jen_98",
  "jermyp_",
  "jerpee",
  "jet",
  "TerhoA",
  "jlet",
  "Joacozep",
  "die_totgeburt",
  "plaguecorner",
  "link9400",
  "indierocker81",
  "EngJohann",
  "johntbyram",
  "wlhjohn622",
  "jxxojo",
  "jomancool54",
  "nubbinsgoody",
  "redshirttheory",
  "JONO103",
  "JORDAN_CAN",
  "JdMfX_",
  "joshualtolles",
  "joshthebestyes",
  "juicyguyzer",
  "juliakalim",
  "jrgagne99",
  "junkyard_dave",
  "just_callme_al",
  "maybejoe356",
  "just_wobert",
  "Justinman114",
  "justus808",
  "riisipuro_inc",
  "kaelgen",
  "k41n05",
  "Kaji_Sensei",
  "kalimotxojm",
  "kalnon",
  "kannplaystetris",
  "52kanon",
  "kantodream",
  "karin",
  "karol_majewski",
  "kasanepearto_",
  "Kat_kunoichi",
  "katiebug331",
  "BeimGoi",
  "kebabskitv",
  "CitricIce",
  "KennyTheBard",
  "endermine233",
  "k_ham51",
  "khyrosfinalcut",
  "kibi_byte",
  "kimberlysays",
  "kinetic_beast",
  "Kingsman36",
  "itskirbcore",
  "Kirby703",
  "kirj4va",
  "kitcot6",
  "kiwi",
  "kleinzoo",
  "klovelace10",
  "klystyr",
  "knexoos",
  "kocchira",
  "KofiOW",
  "KoiroKoiroVuhVuh",
  "kojtek1",
  "kolja_koala",
  "nukeycs2",
  "konekohana",
  "zoidbergthecowboy",
  "kool_koopa",
  "kooliooolio",
  "korbin",
  "vst_koryan",
  "kotwrptt",
  "kraftlmao",
  "krazysickgamer",
  "krim0r",
  "tetrissmb1nes",
  "kryptonick",
  "krzywy",
  "Kuboxxxxx",
  "kunfusingpoke",
  "kurdigamer772",
  "kurri_kraka_",
  "Kurzov22",
  "kvodeth",
  "kyiratetris",
  "kyiranes",
  "SleebyMaddy",
  "kyleprecise",
  "Kyon2570",
  "kyradev",
  "l_cpp",
  "ladyvader13",
  "lakabottv",
  "RAMCHOP",
  "Lana64",
  "lillilllliililli",
  "lapis_lazuli_tetris",
  "larvae12",
  "larvistart",
  "lastarot_qc",
  "laurenjesson",
  "lavolon",
  "adamirishxp",
  "lazer0monkey",
  "ldinos",
  "le0pardddd",
  "lnotj",
  "leauraxtwitch",
  "Led_Astray",
  "leeand_05",
  "leepinephrine121",
  "leighton",
  "leoniqorn",
  "lesbianswordfighting",
  "lestern",
  "letcreate123",
  "lettuceots",
  "lewis_944",
  "leymbda",
  "lg3rm",
  "Lifteris",
  "likeadcarry2",
  "liliana_of_the_dragon",
  "lilith9172",
  "limaocolirio",
  "Limen123",
  "limen_lavender",
  "liolio1230",
  "liptoneq196",
  "little_mac_12127",
  "lj_fin",
  "lmao_yeet1234",
  "LmaoTsetung",
  "mariachilocot",
  "logan_sacrey",
  "lokenze",
  "ipiecevibes",
  "londonb415",
  "longboytetris",
  "lord_noom",
  "lord4noni",
  "lorli_howdoyoupronounceit",
  "Loucy_InTheSky",
  "LouieSkouie",
  "wowpace",
  "lowrezrs",
  "lpiecelucas",
  "ltique",
  "LU_CHRIS",
  "LU_FELIX",
  "LU_JOSHUA",
  "LU_LUC",
  "LU_MAXIME",
  "LU_MIKE",
  "LU_TARA",
  "lucas__huang",
  "lucaseussen",
  "lucas3241",
  "das_kapita1",
  "luco107",
  "luis000030",
  "luis_Tetris",
  "LuisZabby",
  "mrkrabss33",
  "lukideluxe11",
  "Luminia33",
  "trentbread",
  "lutet88",
  "m149_nestetris",
  "MachietypeA",
  "Mackimations",
  "Madas88",
  "madpear_",
  "madsnestris",
  "maedhros1978",
  "frnkzdrt",
  "magkronberg",
  "MaiTeireida",
  "Maitrehuitien",
  "Maiwingkos",
  "Makoara",
  "malaya_m",
  "mankketta",
  "8mansion8",
  "mantaskutoplive",
  "manter7",
  "maoshizhong",
  "mar2dina",
  "marco_z_tetris",
  "marfram",
  "mari__712",
  "Marikh13",
  "MarioLafleur",
  "mariox854",
  "markpm0",
  "marktrishun",
  "marq_tetris",
  "martinb3010",
  "martscrusher",
  "maschell1",
  "mashingsapphic",
  "mastasz",
  "mqisie_",
  "gambattto",
  "mathmaster13",
  "mathwiz101",
  "RookoutRogue",
  "SmallChangeArcade",
  "mauricesy",
  "pigsaregods",
  "MaxoutClub",
  "maxxf386",
  "MayHoffer_",
  "mcd573",
  "yeehawmck",
  "mdsmvp",
  "meccsan",
  "m3cex",
  "meesy176",
  "megtheegg_",
  "MegaRetroMan",
  "melhk_",
  "melkrista",
  "melllow8484",
  "mel_nsoda",
  "meltedplague",
  "memeofalltime",
  "memoria214",
  "Mendion82",
  "mentaisauce",
  "meowabout",
  "MeowMixMix",
  "lwrbnd",
  "themetalbeast",
  "metrdrutu",
  "mfrerck",
  "Micetro",
  "MichuTetris",
  "MicroBlizz",
  "micwoj92",
  "miendiem",
  "mightyhydra24",
  "Mikaway1",
  "mike_flores",
  "mikewiz004",
  "mikeflo42",
  "mikerspd",
  "milewq",
  "milkymoo4148",
  "mil0streams",
  "minertyler100",
  "p1xode",
  "minofloof",
  "miraplaystetris",
  "mircron",
  "mirrorriker",
  "misclickerr",
  "mistec43",
  "mistetris",
  "Mithical9",
  "Mitolex",
  "Blep2Blop",
  "mleczakgnooy",
  "MLGCaptainVirgil",
  "mcomegalletas",
  "mohammadbadir",
  "moja314",
  "mojo_monkey",
  "MysticTraveler_",
  "monkey_yo",
  "moodeuce",
  "moonmancrew",
  "Moonglowsnow",
  "morelando_",
  "MorenazaDeFuego",
  "MorkosS",
  "moulis64",
  "mr_clydethecat",
  "mrakdundesu",
  "mrtheawesome",
  "mrberkguy",
  "mrbrain2",
  "mrdancecrazer",
  "yoniyoni2219",
  "vtuberplayingtetris",
  "mrheldin",
  "MrSkubaDoo",
  "ms_dr0p",
  "ms_drop",
  "mteffect",
  "Muffyio",
  "mushman3",
  "mutigion26",
  "Muunas",
  "eMWuK",
  "myles",
  "mysticalmidget",
  "n4ck323",
  "nadawanders",
  "Naderage",
  "Nansuchao",
  "nao787878",
  "natekoo28",
  "nddk1",
  "ninegeben",
  "1nek01",
  "nemesis1cc",
  "ZefanyaNenu",
  "Neotrisss",
  "ner5667",
  "NerdTheBox",
  "NerDzzzzz",
  "NESCardinality",
  "nesteve1771",
  "neuralg",
  "neuro630",
  "neutrisicacid",
  "Nevanator2005",
  "newcat07",
  "nfuturist",
  "ngc_man25",
  "nguyencraft0101",
  "niatetris",
  "nickeltetris",
  "nickfury1324",
  "nicko",
  "Nick",
  "nicmcee_",
  "NICOLA",
  "nifty",
  "heyonight",
  "niiworl",
  "nima74",
  "niner80",
  "Ninjaofninjas5",
  "nishi94",
  "nisnocsiwmai",
  "geometrickindaguy",
  "The1stNoel",
  "kilometerstheaverage",
  "nomarch",
  "n0mori",
  "n00d1e_",
  "Noqturn",
  "noraneko4602",
  "rthjk_",
  "Northing1",
  "Noskcaj",
  "nossijev",
  "notpeter",
  "notobiii",
  "NovawolfSRL",
  "Nowi1",
  "Noztrom",
  "therealnick117",
  "ntd12345",
  "ntek382",
  "nullkid10",
  "nyakozame",
  "Nyddrerora",
  "lanheg",
  "obelexobendre",
  "odinnlogi06",
  "odrachess",
  "OeufMeansEgg",
  "offwo200",
  "oglopplayingtetris",
  "ohay12",
  "oktopuse",
  "oldTapp3r",
  "Omenvoir",
  "omio9999",
  "onepoundbobby",
  "onlymx13",
  "oofed73",
  "oofietetris",
  "Opaux",
  "OrangeKing81",
  "orbanov1",
  "ororg",
  "Orucs",
  "oscargodinez7",
  "outcastttp",
  "OverthiefAyen",
  "owcakierowcabombowca",
  "og_readmore",
  "Packie619",
  "pacoistaco",
  "ph_mascarado",
  "Pandabear314",
  "ash_7897",
  "paradoink",
  "zaupas",
  "pastelcharlie",
  "paul_soup_",
  "Paulister",
  "peattetris",
  "peekayric",
  "penguinpanic",
  "PeNNiLeSS_ow",
  "pepe2381",
  "pepsiman4132",
  "perid0t1",
  "peridotva",
  "peterthechair",
  "peytonontetris",
  "phamtom_opera",
  "phenotype",
  "phloxae",
  "superslickpickle",
  "pickle_spears",
  "picsek98",
  "PiePusher11",
  "piernik",
  "XHARUHISUZUMIYAX",
  "pikastar",
  "pinescutely",
  "font_serif",
  "pissarse",
  "PiWTetris",
  "P1xelAndy",
  "PixelAtc",
  "PokerPJ",
  "pj290",
  "plasmicat",
  "PlutoCrashed",
  "pmbtetris",
  "PMYA",
  "hagenpoet",
  "pohonjati",
  "Poke",
  "pokemonfan1937",
  "Pokenerd_",
  "PolicyChanges",
  "polidon",
  "PolloSalazar358",
  "poo_diepio",
  "PoochyEXE",
  "green_tea133",
  "poopyoldhag",
  "panicportal",
  "porterichters",
  "possum_bakes",
  "potatoesean",
  "poulfa",
  "powernips",
  "powerslide_",
  "IIIPretzelIII",
  "prismaticcobras",
  "Procyon",
  "Professor_L",
  "psasz100",
  "psdanielxu",
  "fakepsyho",
  "psylaris",
  "Pumis1",
  "pummyzoi",
  "pumpyheart",
  "puppyball",
  "PyMbIH_",
  "pyrek1989",
  "qlexplore",
  "qombo_fc",
  "TotalRADNes",
  "QuatreTiers",
  "quetristenopunto",
  "QwizYoYo",
  "qxsen",
  "r3io4mf",
  "r75mm",
  "rachit1729",
  "radio613",
  "Radmirrrrr",
  "raduxsepul",
  "rage_rod",
  "rahmations",
  "raikourider",
  "thereignofrain",
  "RainbowwPhoenixx",
  "rambleonian",
  "ranceplayingtetris",
  "Rapta725",
  "antnetworktv",
  "rattailedjaguar",
  "Raul_1138",
  "ravalotwitch",
  "ravioli1301",
  "r_a_x_t",
  "raznavor",
  "rcdrone",
  "LarqTetris",
  "reddodargon",
  "redninjalyon",
  "princelina",
  "redshurt",
  "redstonepro23",
  "rfh316",
  "reeiii_64",
  "actuallyreid",
  "reimia_osu",
  "reku314",
  "remainingshater",
  "r3mm3dy",
  "remmywel11",
  "r_ens",
  "rensuchan",
  "retrocabeza",
  "retroguygaming",
  "RETRORIDER",
  "rev_up",
  "rexion_",
  "AyyItsReykon",
  "Rf3",
  "RGGlennon",
  "ribbiting",
  "rikib80",
  "riccardo_dl_plays_tetris",
  "RiceyRiceVSRG",
  "berenyi_kft",
  "richardwolfvi",
  "thegoddamnitrick",
  "ricksanchezzz666",
  "rigel305",
  "rikayamanovt",
  "rileylbl",
  "rinrin4641",
  "riogreywind",
  "RJohnathan101",
  "rmgbread",
  "roavin",
  "robintetris",
  "tetrismattress",
  "roborock22",
  "roccoricci",
  "rocketfish",
  "rod10s",
  "roguepotatobaduk",
  "tetris_roma",
  "roncli",
  "Ronster",
  "tetris_roo",
  "rorri_m",
  "Rory79",
  "rozelllia",
  "ROSS",
  "RoyTheDragon",
  "roystrang86",
  "rozvere",
  "eRuins",
  "bald_shaggy",
  "rvp64",
  "rxsowo",
  "rychessmaster1",
  "ryanhomi",
  "ryenwithane",
  "dupekorzechowy7",
  "Ryososto",
  "sablenn",
  "trxscyn",
  "sakurion",
  "SalmonTeriyaki",
  "saltedbread",
  "SaltedSofa12",
  "salvolc95",
  "samfinch413",
  "notsamts",
  "samurai177_",
  "Samysthedude",
  "mariosantosgod",
  "sargin_9722",
  "SassyFish256",
  "saturnic",
  "mcfloatlover",
  "saugau",
  "savecatz4",
  "s_lobster",
  "sawdethternius",
  "saymyname420691",
  "Scamper9",
  "Scha",
  "theschoolmaster",
  "Schtoikle",
  "SchwarzSSB",
  "scoopman_",
  "scottobozo",
  "sergeys100",
  "seaiio",
  "sealrv",
  "sean17433",
  "sean_on_twitch_",
  "akumaluxray",
  "sebie_1066",
  "selfurias",
  "semilogo",
  "serenityinsorrow",
  "seungoh1",
  "sevenpagewilson",
  "koeck88",
  "tshadowguy",
  "shakeqc",
  "SHAKIL ASSI",
  "ITZsharky1",
  "shaunanigans88",
  "spookgahetti",
  "ShiningFace",
  "shoppingtrollii",
  "shqdwnight",
  "shuichi29",
  "shulphuric",
  "bobslessons",
  "sidnevv",
  "sidneysurfs99",
  "sierrae_",
  "sight",
  "silas_cubes",
  "sillyshark123_",
  "daSilverG",
  "sinefuse",
  "kingleaf_tv",
  "sirmaser",
  "sixfour64",
  "idktetrisandstuff",
  "skailord",
  "SKALEJANDRO",
  "MomentoDeSkib",
  "skiplogic",
  "skqqps",
  "skupinamilion",
  "slackyness",
  "slayerr_69",
  "slickivy2212248",
  "smartsellergaming",
  "smd",
  "smoljordan",
  "smooth_motion",
  "snailien55",
  "snowgolfgal",
  "SnowLilyx28",
  "snowytetris",
  "snufkinison",
  "soapcandyx",
  "SodiumOverdose",
  "lecaptainrrr",
  "sonicthescrew",
  "soorvie",
  "sooshimanh",
  "sophialovesu_",
  "Sorakanis",
  "spaceminer321",
  "spaceyt512",
  "spectric4135",
  "SpeedPeruna",
  "speedself",
  "spindlyfrog",
  "spirit_vet",
  "spockchess",
  "SpoopyDoops",
  "SQR_Y3",
  "square_wave",
  "speedrunbeginner",
  "kallmest4r",
  "stackrabbit",
  "staNESlow",
  "statzgfx",
  "steelce__",
  "Steven598",
  "stevenator546",
  "stick_ang",
  "stijntje4201",
  "stnb03",
  "Stolenshortsword",
  "storm957",
  "stratusCD",
  "stuperfluous",
  "suds1821",
  "summerburst",
  "SumperKenny",
  "sundeco",
  "chobge",
  "TheSunAlwaysSetsOnUs",
  "thaoxifer",
  "supamines",
  "super_shocky",
  "superstep_yt",
  "svnestris",
  "sneikarmokko",
  "zwentastic",
  "SwaggieJ13",
  "aswedishchef",
  "SwidrSPD",
  "Swiftslayrr",
  "swinemeeper",
  "shane_mvm",
  "SzymenL0K0",
  "t1nysp3akzzz",
  "tacit_turn",
  "tacomom18",
  "taik0dude",
  "tale3339_xd",
  "talvot142",
  "Tamatomo",
  "tanakiro",
  "tankinus",
  "likable_outlier",
  "xxtarzanxx04",
  "tate_manning",
  "tavernofheart",
  "TBricks",
  "tcy069",
  "teabonejones",
  "tea4dinner",
  "teainrain",
  "Tebanoku",
  "Tecate",
  "teddaysr",
  "TeddyRugby",
  "TegaMech",
  "temphuibis",
  "tempoh",
  "teri2769",
  "wasmachstdugern",
  "tetchyfiend",
  "Tetrasaurus",
  "Tetris_Luki",
  "tetrisjazz",
  "tetrisliam",
  "tetrinexis",
  "tetrisranger_",
  "TetrisTime_",
  "tetristimer2000",
  "tetrium",
  "tetristimez",
  "tetrobi",
  "that70sdrip",
  "thatguywearingblue",
  "daniel_simpleflips",
  "tetrischeater",
  "TheCttv",
  "thedengler_",
  "TheguardianPM",
  "thejay_jay",
  "th3KandyKing",
  "thelovasman",
  "TheMisterValor",
  "theonlycedric",
  "the_pantzzzz",
  "eatablelmao",
  "TheRealRandom1785",
  "therealxtream",
  "ch3ssk1d",
  "soapphl",
  "thespiderman03",
  "starlittigershark",
  "Thisinthat",
  "thomas_qc_",
  "threestwoschess",
  "tiffyflowr",
  "tigerclone",
  "tillbaks",
  "GlasierXplor",
  "timelocked13",
  "timothykk_",
  "tired_rl_",
  "tizagot",
  "TETRISDLB",
  "tnisaint",
  "tobegh3",
  "tokapietris",
  "tolstoj",
  "thomas5543",
  "tomellosoulman",
  "tommydabe",
  "tommyntg",
  "toni_on_twitch",
  "topaz_25",
  "torbithepic",
  "toritheturtle07",
  "Torzsa",
  "tourist106",
  "toxicstabs",
  "tr3bas",
  "traceywooo",
  "tractieva",
  "trapzone707",
  "trashmanoftetris",
  "used_oliver",
  "Trentris",
  "treylorswift",
  "triplemachine",
  "tripleddot",
  "triskai_skye",
  "vincentiustris",
  "tristop",
  "true_enigma",
  "Tetrisschnecke",
  "TStorm281",
  "love_the_moon",
  "ttplaya_02",
  "ttparadigm",
  "tugi1220",
  "EarlSilasTupper",
  "cazdlt",
  "DemolitionTurtle",
  "turtlerta",
  "TVSSORA",
  "tweak_beacon",
  "twiftytheface",
  "twoquantumbits",
  "twotwos",
  "twqc42",
  "tydominoguyyt",
  "tyow",
  "tytris",
  "Ulf0rce",
  "infotechfellow",
  "hazardousii",
  "jacksonplayzzz2121",
  "unor1ginalname",
  "unskill_25",
  "untangledegg",
  "upchesss",
  "usernamegold1",
  "v4ectr",
  "vachetBeasty",
  "vacuus_",
  "valerie_maybe",
  "validusername16",
  "vallie42",
  "vance267",
  "vandypants",
  "baggelissonic",
  "vansh09122003",
  "ivascoi",
  "vee__why",
  "velonemo",
  "venialgaming",
  "ventinthesky",
  "vernieboi",
  "vexillion",
  "vibeyistired",
  "obser_vic",
  "vicious_rhubarb",
  "vidcoso6900",
  "vidi_tetris",
  "wouterbjk",
  "vilmakerstudios",
  "classicvomce",
  "vinzchillin",
  "dumbkittyviolet",
  "vischer",
  "kriszvxl4_live",
  "vizucubes",
  "vlad_maksimum",
  "alibagirzadeh",
  "Vorap",
  "vroenven",
  "waffletree",
  "wallbant",
  "coldeggyman",
  "wdsubia",
  "Weegloogi",
  "weisbr0t",
  "westongamingtetris",
  "whitemonster0",
  "WhoDis",
  "w___i___d___e",
  "wiirambo",
  "wike",
  "wikiales",
  "wildbeastpt",
  "williashatner",
  "williecubed",
  "willo1188",
  "willyb2213",
  "wilmerendo64",
  "wingfryer",
  "WinnerBit",
  "winterrakitty",
  "WMD_88",
  "Wolflord2005",
  "WorldoBlocks",
  "wtrmln_cowboy",
  "wyliecanttwitch",
  "Xeal337",
  "XarDPlay93",
  "xarexus",
  "Xarnax42",
  "xennylux",
  "xenophilius",
  "xeopold",
  "Xerminator",
  "xile_eldur",
  "XLink_TV",
  "xxxbalt",
  "xynthic",
  "xirofompila__",
  "yamalolzcsgo",
  "Yamacia",
  "yamircb",
  "theYamny",
  "yanaboh",
  "yasin",
  "YAYSMINA",
  "yeetyeetskeet",
  "YeezyBoi69420",
  "yelenas33",
  "YumeTsubasaCH",
  "yobi9",
  "yoreni2",
  "yoshimi_",
  "Yurilia",
  "Yusifhuseynzadeh",
  "eneques",
  "z_wing_",
  "thezachattackg",
  "zachgameswell",
  "zavier7763",
  "zboonez",
  "zelazowy1",
  "notzempro",
  "zenonblyat",
  "zeolade",
  "krypton_krus",
  "GotTheZest",
  "zicofurus",
  "zipdang04",
  "zipley",
  "zlettuce",
  "zognorm",
  "z0hassadar",
  "Zoltan_BRC",
  "zro_bot",
  "zubats",
  "zxvye",
  "zydras07",
  "zyildrl",
  "zylos_the_core",
  "zyxia03"
];

// src/features/tournament/simulation.ts
var REALISTIC_PLAYER_NAMES = AUTHENTIC_COMPETITOR_NAMES;
var COUNTRIES = [
  "US",
  "JP",
  "CA",
  "DE",
  "GB",
  "FR",
  "SE",
  "PL",
  "AU",
  "BR",
  "KR",
  "FI",
  "IS",
  "NL",
  "DK",
  "NO",
  "ES",
  "IT",
  "MX",
  "NZ"
];
var PLAYSTYLES = ["Rolling", "Rolling", "Rolling", "DAS", "Hypertap"];
var TAG_PREFIXES = ["Hyper", "Pixel", "Retro", "Turbo", "Shadow", "Quantum", "Aero", "Chrono", "Zenith", "Echo", "Neon", "Vortex"];
var TAG_SUFFIXES = ["Roll", "Tap", "Stack", "Drop", "Dash", "Shift", "Spark", "Master", "Knight", "Fox", "Blader", "Tetris"];
function generateFallbackTag(existingNames) {
  let attempt = 0;
  while (attempt < 1e3) {
    const pre = TAG_PREFIXES[Math.floor(Math.random() * TAG_PREFIXES.length)];
    const suf = TAG_SUFFIXES[Math.floor(Math.random() * TAG_SUFFIXES.length)];
    const num = Math.floor(10 + Math.random() * 89);
    const candidate = `${pre}${suf}_${num}`;
    if (!existingNames.has(candidate.toLowerCase())) {
      return candidate;
    }
    attempt++;
  }
  return `NeoStack_${Date.now() % 1e4}`;
}
function generateAdditionalFakePlayers(count, existingPool = []) {
  const existingNames = new Set(existingPool.map((p) => p.name.toLowerCase()));
  const newPlayers = [];
  let nameIdx = 0;
  while (newPlayers.length < count) {
    let name = "";
    while (nameIdx < REALISTIC_PLAYER_NAMES.length) {
      const candidate = REALISTIC_PLAYER_NAMES[nameIdx++];
      if (!existingNames.has(candidate.toLowerCase())) {
        name = candidate;
        break;
      }
    }
    if (!name) {
      name = generateFallbackTag(existingNames);
    }
    existingNames.add(name.toLowerCase());
    const playstyle = PLAYSTYLES[Math.floor(Math.random() * PLAYSTYLES.length)];
    const country = COUNTRIES[Math.floor(Math.random() * COUNTRIES.length)];
    const personalBest = Math.floor(7e5 + Math.random() * 65e4);
    const rawUuid = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${newPlayers.length + 1}`;
    const id = `p_sim_${rawUuid}`;
    newPlayers.push({
      id,
      name,
      personalBest,
      playstyle,
      country,
      notes: "Simulated competitor"
    });
  }
  return newPlayers;
}
function generateSimulatedQualifiers(tournament, globalPlayersPool = []) {
  const totalCapacity = tournament.tiers.reduce((acc, t) => acc + (t.playerCount || 0), 0);
  const extra1d6 = Math.floor(Math.random() * 6) + 1;
  const targetCount = totalCapacity > 0 ? Math.max(8, totalCapacity + extra1d6) : Math.max(24, (tournament.playersPool || []).length) + extra1d6;
  const players2 = [...tournament.playersPool || []];
  const existingIds = new Set(players2.map((p) => p.id));
  const existingNames = new Set(players2.map((p) => p.name.toLowerCase()));
  if (players2.length < targetCount && globalPlayersPool.length > 0) {
    const availableFromGlobal = globalPlayersPool.filter(
      (p) => !existingIds.has(p.id) && !existingNames.has(p.name.toLowerCase())
    );
    const shuffledGlobal = [...availableFromGlobal].sort(() => Math.random() - 0.5);
    for (const gp of shuffledGlobal) {
      if (players2.length >= targetCount) break;
      players2.push({ ...gp });
      existingIds.add(gp.id);
      existingNames.add(gp.name.toLowerCase());
    }
  }
  if (players2.length < targetCount) {
    const needed = targetCount - players2.length;
    const genericPlayers = generateAdditionalFakePlayers(needed, players2);
    players2.push(...genericPlayers);
  }
  const existingSubmissions = tournament.qualifierSubmissions || [];
  const existingSubmissionsByPlayer = /* @__PURE__ */ new Map();
  for (const sub of existingSubmissions) {
    const list = existingSubmissionsByPlayer.get(sub.playerId) || [];
    list.push(sub);
    existingSubmissionsByPlayer.set(sub.playerId, list);
  }
  const submissions = [...existingSubmissions];
  const baseTime = Date.now() - 36e5 * 4;
  const qualFormat = tournament.qualFormat || "AVERAGE_OF_X";
  const targetAttempts = qualFormat === "AVERAGE_OF_X" ? tournament.qualAverageCount || 2 : 3;
  players2.forEach((player, pIdx) => {
    const existing = existingSubmissionsByPlayer.get(player.id) || [];
    if (existing.length >= targetAttempts) {
      return;
    }
    const skillMultiplier = 1 - pIdx / players2.length * 0.45;
    let playerTargetAttempts = targetAttempts;
    let isLegendaryPointsRun = false;
    if (qualFormat === "POINTS") {
      if (pIdx === 0 && Math.random() < 0.2 || pIdx > 0 && pIdx < 3 && Math.random() < 0.08) {
        isLegendaryPointsRun = true;
        playerTargetAttempts = Math.random() < 0.5 ? 6 : 7;
      } else if (pIdx < 4) {
        playerTargetAttempts = 5;
      } else if (pIdx < Math.floor(players2.length * 0.5)) {
        playerTargetAttempts = 4;
      } else {
        playerTargetAttempts = 3;
      }
    }
    if (existing.length >= playerTargetAttempts) {
      return;
    }
    for (let attempt = existing.length + 1; attempt <= playerTargetAttempts; attempt++) {
      let score;
      if (qualFormat === "HIGH_SCORE") {
        const playerCurrentAttempts = submissions.filter((s) => s.playerId === player.id);
        const hasKickerAlready = playerCurrentAttempts.some((s) => s.score < 999999);
        const isLastAttempt = attempt === targetAttempts;
        let isMaxout = pIdx < Math.min(16, Math.floor(players2.length * 0.4)) && Math.random() < 0.75;
        if (isLastAttempt && !hasKickerAlready && Math.random() < 0.9) {
          isMaxout = false;
        }
        if (isMaxout) {
          score = Math.floor(1e6 + Math.random() * 3e5);
        } else {
          score = Math.floor(75e4 + Math.random() * 245e3);
        }
      } else if (qualFormat === "POINTS") {
        if (isLegendaryPointsRun) {
          score = Math.floor(16e5 + Math.random() * 55e4);
        } else {
          const baseScore = 7e5 + Math.random() * 115e4;
          score = Math.floor(baseScore * skillMultiplier);
        }
      } else {
        score = Math.floor((65e4 + Math.random() * 55e4) * skillMultiplier);
      }
      submissions.push({
        id: `sub_sim_${player.id}_${attempt}`,
        tournamentId: tournament.id,
        organizationId: tournament.organizationId,
        playerId: player.id,
        score,
        submittedAt: baseTime + pIdx * 6e4 + attempt * 12e4
      });
    }
  });
  return { players: players2, submissions };
}
function simulateTournamentMatches(tournament, tiersToSimulate) {
  const matchScores = { ...tournament.matchScores };
  let currentTiers = [...tiersToSimulate];
  currentTiers = currentTiers.map((tier) => {
    let bracket = { ...tier.bracket };
    let matchSimulated = true;
    let iterations = 0;
    while (matchSimulated && iterations < 100) {
      matchSimulated = false;
      iterations++;
      const playableMatches = Object.values(bracket.matchesById).filter(
        (m) => !m.isBye && !m.winnerId && m.player1.player && m.player2.player
      );
      for (const currentMatch of playableMatches) {
        const p1 = currentMatch.player1.player;
        const p2 = currentMatch.player2.player;
        if (!p1 || !p2) continue;
        const bestOf = currentMatch.bestOf || tier.bestOf || 5;
        const winThreshold = Math.ceil(bestOf / 2);
        let p1Wins = 0;
        let p2Wins = 0;
        const games2 = [];
        const p1Seed = p1.seed || 16;
        const p2Seed = p2.seed || 16;
        const p1Prob = p2Seed / (p1Seed + p2Seed);
        let gameNumber = 1;
        while (p1Wins < winThreshold && p2Wins < winThreshold) {
          const p1Won = Math.random() < Math.max(0.2, Math.min(0.8, p1Prob));
          const winnerId = p1Won ? p1.id : p2.id;
          if (p1Won) p1Wins++;
          else p2Wins++;
          const winningScore = Math.floor(75e4 + Math.random() * 35e4);
          const losingScore = Math.floor(winningScore - (5e4 + Math.random() * 25e4));
          games2.push({
            gameNumber,
            player1Points: p1Won ? winningScore : losingScore,
            player2Points: p1Won ? losingScore : winningScore,
            winnerPlayerId: winnerId
          });
          gameNumber++;
        }
        const matchWinnerId = p1Wins >= winThreshold ? p1.id : p2.id;
        const matchLoserId = matchWinnerId === p1.id ? p2.id : p1.id;
        matchScores[currentMatch.id] = {
          matchId: currentMatch.id,
          tierId: tier.id,
          organizationId: tournament.organizationId,
          bestOf,
          player1Wins: p1Wins,
          player2Wins: p2Wins,
          winnerPlayerId: matchWinnerId,
          loserPlayerId: matchLoserId,
          isComplete: true,
          games: games2
        };
        bracket = advanceMatchWinner(bracket, currentMatch.id, matchWinnerId);
        matchSimulated = true;
      }
    }
    return {
      ...tier,
      isLocked: true,
      bracket
    };
  });
  return { updatedTiers: currentTiers, matchScores };
}
function runFullSimulation(tournament, globalPlayersPool = []) {
  let tourney = { ...tournament };
  const totalCapacity = tourney.tiers.reduce((acc, t) => acc + t.playerCount, 0);
  if (tourney.seedingMethod === "MANUAL") {
    if ((tourney.manualSeeds?.length || 0) < totalCapacity) {
      const { players: players2 } = generateSimulatedQualifiers(tourney, globalPlayersPool);
      tourney = {
        ...tourney,
        playersPool: players2,
        manualSeeds: players2.map((p) => p.id),
        isLocked: false
      };
    }
  } else if ((tourney.qualifierSubmissions?.length || 0) < totalCapacity) {
    const { players: players2, submissions } = generateSimulatedQualifiers(tourney, globalPlayersPool);
    tourney = {
      ...tourney,
      playersPool: players2,
      qualifierSubmissions: submissions,
      isLocked: false
    };
  }
  tourney.tiers = generateDraftBracketsForTournament(tourney);
  const lockedTiers = tourney.tiers.map((t) => ({ ...t, isLocked: true }));
  tourney.isLocked = true;
  tourney.tiers = lockedTiers;
  const { updatedTiers, matchScores } = simulateTournamentMatches(tourney, tourney.tiers);
  tourney.tiers = updatedTiers;
  tourney.matchScores = matchScores;
  return tourney;
}

// src/server/api.ts
async function parseBody(req) {
  if (req.method === "GET" || req.method === "HEAD") return void 0;
  if (typeof req.on !== "function") return {};
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("Invalid JSON payload"));
      }
    });
    req.on("error", reject);
  });
}
function sendJson(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(data));
}
function sendError(res, status, message) {
  sendJson(res, status, { error: message });
}
function checkAuth(req, res, requiredRole, targetTournamentId) {
  const authHeader = req.headers && req.headers["authorization"] || "";
  if (!authHeader.startsWith("Bearer ")) {
    sendError(res, 401, "Unauthorized: Admin session token required");
    return null;
  }
  const token = authHeader.slice(7).trim();
  const session = verifySessionToken(token);
  if (!session) {
    sendError(res, 401, "Unauthorized: Invalid or expired session token");
    return null;
  }
  if (session.role === "SYSTEM_ADMIN" || session.role === "MASTER_ADMIN") {
    return session;
  }
  if (requiredRole === "TOURNAMENT_ADMIN") {
    if (session.role === "TOURNAMENT_ADMIN") {
      if (!targetTournamentId || session.tournamentId === targetTournamentId || session.tournamentSlug === targetTournamentId || session.tournamentIds?.includes(targetTournamentId) || session.tournamentSlugs?.includes(targetTournamentId)) {
        return session;
      }
      sendError(res, 403, "Forbidden: Tournament Admin scope does not match this tournament");
      return null;
    }
  }
  sendError(res, 403, "Forbidden: Requires System Admin permissions");
  return null;
}
function createApiMiddleware() {
  return async (req, res, _next) => {
    const forwardedUrl = req.headers?.["x-matched-path"] || req.headers?.["x-forwarded-url"] || req.url || "";
    let rawUrl = forwardedUrl;
    if (!rawUrl.startsWith("/api")) {
      rawUrl = "/api" + (rawUrl.startsWith("/") ? rawUrl : "/" + rawUrl);
    }
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") {
      res.statusCode = 204;
      res.end();
      return;
    }
    const url = new URL(rawUrl, "http://localhost");
    const pathname = url.pathname;
    const method = req.method || "GET";
    try {
      const body = await parseBody(req);
      if ((pathname === "/api" || pathname === "/api/") && method === "GET") {
        return sendJson(res, 200, { status: "ok", service: "matchfoundry-api", timestamp: Date.now() });
      }
      if (pathname === "/api/health" && method === "GET") {
        try {
          const db = getDb();
          await db.execute(sql3`SELECT 1`);
          return sendJson(res, 200, { status: "ok", db: "connected", timestamp: Date.now() });
        } catch (err) {
          return sendJson(res, 503, {
            status: "error",
            db: "disconnected",
            error: err.message || "Database connection failed",
            timestamp: Date.now()
          });
        }
      }
      if (pathname === "/api/client-log" && method === "POST") {
        console.error("[CLIENT RUNTIME ERROR]:", JSON.stringify(body, null, 2));
        return sendJson(res, 200, { ok: true });
      }
      if (pathname === "/api/auth/pin" && method === "POST") {
        const candidatePin = typeof body?.pin === "string" ? body.pin.trim() : "";
        const tournamentSlugOrId = typeof body?.tournamentSlugOrId === "string" ? body.tournamentSlugOrId.trim() : void 0;
        if (!candidatePin) {
          return sendError(res, 400, "PIN is required");
        }
        if (isSystemRecoveryPin(candidatePin)) {
          const token = createSessionToken({ role: "SYSTEM_ADMIN" });
          return sendJson(res, 200, {
            success: true,
            role: "SYSTEM_ADMIN",
            token
          });
        }
        try {
          const db = getDb();
          const masterSetting = await db.select().from(systemSettings).where(eq6(systemSettings.key, "master_credentials"));
          if (masterSetting.length > 0) {
            const val = masterSetting[0].value;
            if (val?.masterPinEncrypted) {
              const storedPin = decryptPin(val.masterPinEncrypted);
              if (safeCompareStrings(candidatePin, storedPin)) {
                const token = createSessionToken({ role: "SYSTEM_ADMIN" });
                return sendJson(res, 200, {
                  success: true,
                  role: "SYSTEM_ADMIN",
                  token
                });
              }
            }
          }
        } catch {
        }
        const rawRecoveryPin = (process.env.SYSTEM_ADMIN_RECOVERY_PIN || process.env.MASTER_ADMIN_RECOVERY_PIN || "").trim();
        const cleanRecoveryPin = rawRecoveryPin.replace(/^["']|["']$/g, "").trim();
        const hasConfiguredRecoveryPin = Boolean(cleanRecoveryPin);
        if (process.env.NODE_ENV !== "production" && !hasConfiguredRecoveryPin) {
          if (safeCompareStrings(candidatePin, "admin") || safeCompareStrings(candidatePin, "0000")) {
            const token = createSessionToken({ role: "SYSTEM_ADMIN" });
            return sendJson(res, 200, {
              success: true,
              role: "SYSTEM_ADMIN",
              token
            });
          }
        }
        try {
          const db = getDb();
          const allTourneys = await db.select().from(tournaments);
          const matchingTourneys = [];
          for (const t of allTourneys) {
            if (t.adminPinEncrypted) {
              try {
                const storedPin = decryptPin(t.adminPinEncrypted);
                if (safeCompareStrings(candidatePin, storedPin)) {
                  matchingTourneys.push(t);
                }
              } catch {
              }
            }
          }
          if (matchingTourneys.length > 0) {
            if (tournamentSlugOrId) {
              const scopedMatch = matchingTourneys.find(
                (t) => t.id === tournamentSlugOrId || t.slug === tournamentSlugOrId
              );
              if (!scopedMatch) {
                return sendError(res, 401, "Invalid PIN for selected tournament");
              }
            }
            const primaryTourney = tournamentSlugOrId ? matchingTourneys.find((t) => t.id === tournamentSlugOrId || t.slug === tournamentSlugOrId) || matchingTourneys[0] : matchingTourneys[0];
            const tournamentIds = matchingTourneys.map((t) => t.id);
            const tournamentSlugs = matchingTourneys.map((t) => t.slug);
            const token = createSessionToken({
              role: "TOURNAMENT_ADMIN",
              tournamentId: primaryTourney.id,
              tournamentSlug: primaryTourney.slug,
              tournamentIds,
              tournamentSlugs
            });
            return sendJson(res, 200, {
              success: true,
              role: "TOURNAMENT_ADMIN",
              tournamentId: primaryTourney.id,
              tournamentSlug: primaryTourney.slug,
              tournamentIds,
              tournamentSlugs,
              token
            });
          }
        } catch {
        }
        return sendError(res, 401, "Invalid PIN");
      }
      if (pathname === "/api/auth/session" && method === "GET") {
        const authHeader = req.headers && req.headers["authorization"] || "";
        if (!authHeader.startsWith("Bearer ")) {
          return sendJson(res, 200, { valid: false });
        }
        const session = verifySessionToken(authHeader.slice(7).trim());
        if (!session) {
          return sendJson(res, 200, { valid: false });
        }
        return sendJson(res, 200, {
          valid: true,
          role: session.role,
          tournamentId: session.tournamentId,
          tournamentSlug: session.tournamentSlug,
          tournamentIds: session.tournamentIds,
          tournamentSlugs: session.tournamentSlugs,
          expiresAt: session.expiresAt
        });
      }
      if ((pathname === "/api/auth/system-pin" || pathname === "/api/auth/master-pin") && method === "PUT") {
        if (!checkAuth(req, res, "SYSTEM_ADMIN")) return;
        const newPin = typeof body?.pin === "string" ? body.pin.trim() : "";
        if (!newPin) return sendError(res, 400, "New PIN is required");
        const db = getDb();
        const encrypted = encryptPin(newPin);
        const existing = await db.select().from(systemSettings).where(eq6(systemSettings.key, "master_credentials"));
        if (existing.length > 0) {
          await db.update(systemSettings).set({ value: { masterPinEncrypted: encrypted }, updatedAt: /* @__PURE__ */ new Date() }).where(eq6(systemSettings.key, "master_credentials"));
        } else {
          await db.insert(systemSettings).values({
            key: "master_credentials",
            value: { masterPinEncrypted: encrypted }
          });
        }
        return sendJson(res, 200, { success: true });
      }
      if (pathname === "/api/players" && method === "GET") {
        const dbPlayers = await listPlayers();
        const profiles = dbPlayers.map((p) => ({
          id: p.id,
          name: p.name,
          displayName: p.displayName || void 0,
          nickname: p.nickname || void 0,
          twitchUsername: p.twitchUsername || void 0,
          country: p.country || void 0,
          avatarType: p.avatarType,
          avatarUrl: p.avatarUrl || void 0,
          avatarThumbnailUrl: p.avatarThumbnailUrl || void 0,
          personalBest: p.personalBest,
          playstyle: p.playstyle || "Rolling",
          notes: p.notes || void 0,
          isDisqualified: p.isDisqualified
        }));
        return sendJson(res, 200, profiles);
      }
      if (pathname === "/api/players/batch" && method === "POST") {
        if (!checkAuth(req, res, "SYSTEM_ADMIN")) return;
        const list = Array.isArray(body) ? body : body.players || [];
        const created = await createPlayersBatch(list);
        return sendJson(res, 201, created);
      }
      if (pathname === "/api/players" && method === "POST") {
        if (!checkAuth(req, res, "SYSTEM_ADMIN")) return;
        const created = await createPlayer(body);
        return sendJson(res, 201, created);
      }
      const playerMatch = pathname.match(/^\/api\/players\/([^/]+)$/);
      if (playerMatch) {
        const playerId = playerMatch[1];
        if (method === "GET") {
          const p = await getPlayer(playerId);
          if (!p) return sendError(res, 404, "Player not found");
          return sendJson(res, 200, p);
        }
        if (method === "PUT") {
          if (!checkAuth(req, res, "SYSTEM_ADMIN")) return;
          const updated = await updatePlayer(playerId, body);
          if (!updated) return sendError(res, 404, "Player not found");
          return sendJson(res, 200, updated);
        }
        if (method === "DELETE") {
          if (!checkAuth(req, res, "SYSTEM_ADMIN")) return;
          const deleted = await deletePlayer(playerId);
          return sendJson(res, 200, { success: deleted });
        }
      }
      if (pathname === "/api/organizations" && method === "GET") {
        const orgs = await listOrganizations();
        return sendJson(res, 200, orgs);
      }
      if (pathname === "/api/organizations" && method === "POST") {
        if (!checkAuth(req, res, "SYSTEM_ADMIN")) return;
        const created = await createOrganization(body);
        return sendJson(res, 201, created);
      }
      const orgMatch = pathname.match(/^\/api\/organizations\/([^/]+)$/);
      if (orgMatch) {
        const orgId = orgMatch[1];
        if (method === "GET") {
          const org = await getOrganizationById(orgId);
          if (!org) return sendError(res, 404, "Organization not found");
          return sendJson(res, 200, org);
        }
        if (method === "PUT") {
          if (!checkAuth(req, res, "SYSTEM_ADMIN")) return;
          const updated = await updateOrganization(orgId, body);
          if (!updated) return sendError(res, 404, "Organization not found");
          return sendJson(res, 200, updated);
        }
        if (method === "DELETE") {
          if (!checkAuth(req, res, "SYSTEM_ADMIN")) return;
          const result = await deleteOrganization(orgId);
          if (!result.success) {
            return sendError(res, 400, result.error || "Failed to delete organization");
          }
          return sendJson(res, 200, { success: true });
        }
      }
      if (pathname === "/api/tournaments" && method === "GET") {
        const fullTourneys = await listFullTournaments();
        return sendJson(res, 200, fullTourneys);
      }
      if (pathname === "/api/tournaments" && method === "POST") {
        if (!checkAuth(req, res, "SYSTEM_ADMIN")) return;
        const saved = await saveFullTournament(body);
        return sendJson(res, 201, saved);
      }
      if (pathname === "/api/simulate/sample" && method === "POST") {
        if (!checkAuth(req, res, "SYSTEM_ADMIN")) return;
        const sampleTourney = await simulateSampleTournament();
        return sendJson(res, 201, sampleTourney);
      }
      const tourneySubMatch = pathname.match(/^\/api\/tournaments\/([^/]+)(?:\/(.*))?$/);
      if (tourneySubMatch) {
        const tourneyId = tourneySubMatch[1];
        const subAction = tourneySubMatch[2] || "";
        if (!subAction) {
          if (method === "GET") {
            const t = await getFullTournament(tourneyId);
            if (!t) return sendError(res, 404, "Tournament not found");
            return sendJson(res, 200, t);
          }
          if (method === "PUT") {
            if (!checkAuth(req, res, "TOURNAMENT_ADMIN", tourneyId)) return;
            const updated = await saveFullTournament({ ...body, id: tourneyId });
            return sendJson(res, 200, updated);
          }
          if (method === "DELETE") {
            if (!checkAuth(req, res, "SYSTEM_ADMIN")) return;
            const deleted = await deleteTournament(tourneyId);
            return sendJson(res, 200, { success: deleted });
          }
        }
        if (subAction === "pin" && method === "PUT") {
          if (!checkAuth(req, res, "TOURNAMENT_ADMIN", tourneyId)) return;
          const pin = typeof body?.pin === "string" ? body.pin.trim() : "";
          const confirmed = Boolean(body?.confirmed);
          if (!pin) return sendError(res, 400, "PIN is required");
          const db = getDb();
          const allTourneys = await db.select().from(tournaments);
          const currentTourney = allTourneys.find(
            (t) => t.id === tourneyId || t.slug === tourneyId
          );
          const matchingOtherTourneys = [];
          for (const t of allTourneys) {
            if (currentTourney && (t.id === currentTourney.id || t.slug === currentTourney.slug)) {
              continue;
            }
            if (t.adminPinEncrypted) {
              try {
                const storedPin = decryptPin(t.adminPinEncrypted);
                if (safeCompareStrings(pin, storedPin)) {
                  matchingOtherTourneys.push({
                    id: t.id,
                    name: t.name,
                    slug: t.slug
                  });
                }
              } catch {
              }
            }
          }
          if (matchingOtherTourneys.length > 0 && !confirmed) {
            return sendJson(res, 200, {
              success: false,
              isShared: true,
              sharedTournaments: matchingOtherTourneys,
              message: `This PIN is already shared with ${matchingOtherTourneys.map((t) => t.name).join(", ")}.`
            });
          }
          const encrypted = encryptPin(pin);
          const pinCond = isUuid(tourneyId) ? or3(eq6(tournaments.id, tourneyId), eq6(tournaments.slug, tourneyId)) : eq6(tournaments.slug, tourneyId);
          await db.update(tournaments).set({ adminPinEncrypted: encrypted }).where(pinCond);
          return sendJson(res, 200, {
            success: true,
            isShared: matchingOtherTourneys.length > 0,
            sharedTournaments: matchingOtherTourneys
          });
        }
        if (subAction === "reveal-pin" && method === "GET") {
          if (!checkAuth(req, res, "SYSTEM_ADMIN")) return;
          const db = getDb();
          const revealCond = isUuid(tourneyId) ? or3(eq6(tournaments.id, tourneyId), eq6(tournaments.slug, tourneyId)) : eq6(tournaments.slug, tourneyId);
          const rows = await db.select().from(tournaments).where(revealCond);
          if (rows.length === 0) return sendError(res, 404, "Tournament not found");
          const encrypted = rows[0].adminPinEncrypted;
          let plaintextPin = null;
          if (encrypted) {
            try {
              plaintextPin = decryptPin(encrypted);
            } catch {
              plaintextPin = null;
            }
          }
          return sendJson(res, 200, { pin: plaintextPin });
        }
        if (subAction === "qualifiers" && method === "POST") {
          if (!checkAuth(req, res, "TOURNAMENT_ADMIN", tourneyId)) return;
          await submitQualifierScore(tourneyId, body.playerId, body.score);
          const t = await getFullTournament(tourneyId);
          if (t && !t.isLocked) {
            t.tiers = generateDraftBracketsForTournament(t);
            const saved = await saveFullTournament(t);
            return sendJson(res, 201, saved);
          }
          return sendJson(res, 201, t);
        }
        if (subAction === "qualifiers/batch" && method === "POST") {
          if (!checkAuth(req, res, "TOURNAMENT_ADMIN", tourneyId)) return;
          await submitQualifiersBatch(tourneyId, body.submissions || body);
          const t = await getFullTournament(tourneyId);
          if (t && !t.isLocked) {
            t.tiers = generateDraftBracketsForTournament(t);
            const saved = await saveFullTournament(t);
            return sendJson(res, 201, saved);
          }
          return sendJson(res, 201, t);
        }
        if (subAction === "qualifiers" && method === "DELETE") {
          if (!checkAuth(req, res, "SYSTEM_ADMIN")) return;
          const t = await getFullTournament(tourneyId);
          if (!t) return sendError(res, 404, "Tournament not found");
          await clearTournamentQualifiers(t.id);
          t.qualifierSubmissions = [];
          t.qualifiers = [];
          t.manualSeeds = [];
          if (!t.isLocked) {
            t.tiers = generateDraftBracketsForTournament(t);
          }
          const saved = await saveFullTournament(t);
          return sendJson(res, 200, saved);
        }
        if (subAction === "matches" && method === "DELETE") {
          if (!checkAuth(req, res, "SYSTEM_ADMIN")) return;
          const t = await getFullTournament(tourneyId);
          if (!t) return sendError(res, 404, "Tournament not found");
          await clearTournamentMatches(t.id);
          t.matchScores = {};
          t.isLocked = false;
          t.tiers = t.tiers.map((tier) => ({ ...tier, isLocked: false }));
          t.tiers = generateDraftBracketsForTournament(t);
          const saved = await saveFullTournament(t);
          return sendJson(res, 200, saved);
        }
        if (subAction === "clear-all" && method === "POST") {
          if (!checkAuth(req, res, "SYSTEM_ADMIN")) return;
          const t = await getFullTournament(tourneyId);
          if (!t) return sendError(res, 404, "Tournament not found");
          await clearTournamentMatches(t.id);
          await clearTournamentQualifiers(t.id);
          t.playersPool = [];
          t.qualifierSubmissions = [];
          t.qualifiers = [];
          t.manualSeeds = [];
          t.matchScores = {};
          t.tournamentPlayers = {};
          t.isLocked = false;
          t.tiers = t.tiers.map((tier) => ({
            ...tier,
            isLocked: false,
            bracket: { rounds: [], totalMatches: 0, matchesById: {} }
          }));
          const saved = await saveFullTournament(t);
          return sendJson(res, 200, saved);
        }
        if (subAction === "simulate/seed-quals" && method === "POST") {
          if (!checkAuth(req, res, "SYSTEM_ADMIN")) return;
          const t = await getFullTournament(tourneyId);
          if (!t) return sendError(res, 404, "Tournament not found");
          const allDbPlayers = await listPlayers();
          const profiles = allDbPlayers.map((p) => ({
            id: p.id,
            name: p.name,
            country: p.country || void 0,
            avatarType: p.avatarType,
            avatarUrl: p.avatarUrl || void 0,
            personalBest: p.personalBest,
            playstyle: p.playstyle || "Rolling",
            isDisqualified: p.isDisqualified
          }));
          const { players: selectedPlayers, submissions } = generateSimulatedQualifiers(t, profiles);
          t.playersPool = selectedPlayers;
          t.qualifierSubmissions = submissions;
          t.matchScores = {};
          t.isLocked = false;
          t.tiers = t.tiers.map((tier) => ({ ...tier, isLocked: false }));
          t.tiers = generateDraftBracketsForTournament(t);
          const saved = await saveFullTournament(t);
          return sendJson(res, 200, saved);
        }
        if (subAction === "simulate/full" && method === "POST") {
          if (!checkAuth(req, res, "SYSTEM_ADMIN")) return;
          const t = await getFullTournament(tourneyId);
          if (!t) return sendError(res, 404, "Tournament not found");
          const allDbPlayers = await listPlayers();
          const profiles = allDbPlayers.map((p) => ({
            id: p.id,
            name: p.name,
            country: p.country || void 0,
            avatarType: p.avatarType,
            avatarUrl: p.avatarUrl || void 0,
            personalBest: p.personalBest,
            playstyle: p.playstyle || "Rolling",
            isDisqualified: p.isDisqualified
          }));
          const simulated = runFullSimulation(t, profiles);
          const saved = await saveFullTournament(simulated);
          return sendJson(res, 200, saved);
        }
        const qualDelMatch = subAction.match(/^qualifiers\/([^/]+)$/);
        if (qualDelMatch && method === "DELETE") {
          if (!checkAuth(req, res, "TOURNAMENT_ADMIN", tourneyId)) return;
          const subId = qualDelMatch[1];
          const t = await getFullTournament(tourneyId);
          if (!t) return sendError(res, 404, "Tournament not found");
          t.qualifierSubmissions = (t.qualifierSubmissions || []).filter((s) => s.id !== subId);
          if (!t.isLocked) {
            t.tiers = generateDraftBracketsForTournament(t);
          }
          const saved = await saveFullTournament(t);
          return sendJson(res, 200, saved);
        }
        if (subAction === "lock" && method === "POST") {
          if (!checkAuth(req, res, "TOURNAMENT_ADMIN", tourneyId)) return;
          const t = await getFullTournament(tourneyId);
          if (!t) return sendError(res, 404, "Tournament not found");
          t.isLocked = true;
          t.tiers = t.tiers.map((tr) => ({ ...tr, isLocked: true }));
          const saved = await saveFullTournament(t);
          return sendJson(res, 200, saved);
        }
        if (subAction === "unlock" && method === "POST") {
          if (!checkAuth(req, res, "TOURNAMENT_ADMIN", tourneyId)) return;
          const t = await getFullTournament(tourneyId);
          if (!t) return sendError(res, 404, "Tournament not found");
          const hasRecordedScores = Object.values(t.matchScores || {}).some(
            (record) => record.isComplete || record.games.some(
              (g) => g.player1Points !== null || g.player2Points !== null || g.winnerPlayerId !== null
            ) || record.player1Wins > 0 || record.player2Wins > 0 || Boolean(record.winnerPlayerId)
          );
          if (hasRecordedScores) {
            return sendError(
              res,
              400,
              "Cannot unlock: Match play has begun. Clear recorded scores before unlocking."
            );
          }
          t.isLocked = false;
          t.tiers = t.tiers.map((tr) => ({ ...tr, isLocked: false }));
          t.tiers = generateDraftBracketsForTournament(t);
          const saved = await saveFullTournament(t);
          return sendJson(res, 200, saved);
        }
        if (subAction === "matches/swap-slots" && method === "POST") {
          if (!checkAuth(req, res, "TOURNAMENT_ADMIN", tourneyId)) return;
          const t = await getFullTournament(tourneyId);
          if (!t) return sendError(res, 404, "Tournament not found");
          const { tierId, sourceMatchId, sourceSlot, targetMatchId, targetSlot } = body;
          const tier = t.tiers.find((tr) => tr.id === tierId);
          if (!tier || !tier.bracket) return sendError(res, 404, "Tier or bracket not found");
          const srcRecord = t.matchScores?.[sourceMatchId];
          const tgtRecord = t.matchScores?.[targetMatchId];
          const hasSrcScore = srcRecord && (srcRecord.games?.length > 0 || srcRecord.isComplete || Boolean(srcRecord.winnerPlayerId));
          const hasTgtScore = tgtRecord && (tgtRecord.games?.length > 0 || tgtRecord.isComplete || Boolean(tgtRecord.winnerPlayerId));
          if (hasSrcScore || hasTgtScore) {
            return sendError(
              res,
              400,
              "Cannot swap slots: Match play or scores have already begun in one of the matches."
            );
          }
          const updatedBracket = swapMatchSlots(tier.bracket, {
            sourceMatchId,
            sourceSlot,
            targetMatchId,
            targetSlot
          });
          t.tiers = t.tiers.map((tr) => tr.id === tierId ? { ...tr, bracket: updatedBracket } : tr);
          const saved = await saveFullTournament(t);
          return sendJson(res, 200, saved);
        }
        const matchScoreSub = subAction.match(/^matches\/([^/]+)\/score$/);
        if (matchScoreSub && method === "PUT") {
          if (!checkAuth(req, res, "TOURNAMENT_ADMIN", tourneyId)) return;
          const matchId = matchScoreSub[1];
          const t = await getFullTournament(tourneyId);
          if (!t) return sendError(res, 404, "Tournament not found");
          const tierId = body.tierId;
          const tier = t.tiers.find((tr) => tr.id === tierId);
          if (!tier || !tier.bracket) return sendError(res, 404, "Tier or bracket not found");
          const targetMatch = tier.bracket.matchesById?.[matchId];
          if (!targetMatch) return sendError(res, 404, "Match not found in tier bracket");
          const p1 = targetMatch.player1.player;
          const p2 = targetMatch.player2.player;
          const currentRecord = t.matchScores[matchId] || {
            matchId,
            tierId,
            organizationId: t.organizationId,
            bestOf: targetMatch.bestOf || tier.bestOf || 5,
            player1Wins: 0,
            player2Wins: 0,
            games: [],
            winnerPlayerId: null,
            loserPlayerId: null,
            isComplete: false
          };
          const scoredGames = body.scoredGames || body.games || [];
          const cleanedGames = scoredGames.map((g) => {
            const isZeroZero = g.player1Points === 0 && g.player2Points === 0 && !g.winnerPlayerId;
            const isEmpty = g.player1Points === null && g.player2Points === null && !g.winnerPlayerId;
            if (isEmpty || isZeroZero) {
              return {
                gameNumber: g.gameNumber,
                player1Points: null,
                player2Points: null,
                winnerPlayerId: null
              };
            }
            return {
              gameNumber: g.gameNumber,
              player1Points: g.player1Points,
              player2Points: g.player2Points,
              winnerPlayerId: g.winnerPlayerId
            };
          }).sort((a, b) => a.gameNumber - b.gameNumber);
          let p1Wins = 0;
          let p2Wins = 0;
          for (const g of cleanedGames) {
            if (p1 && g.winnerPlayerId === p1.id) p1Wins++;
            else if (p2 && g.winnerPlayerId === p2.id) p2Wins++;
          }
          const matchBestOf = body.bestOf || currentRecord.bestOf || targetMatch.bestOf || tier.bestOf || 5;
          const threshold = Math.ceil(matchBestOf / 2);
          let matchWinnerId = null;
          let matchLoserId = null;
          let isComplete = false;
          if (p1 && p1Wins >= threshold) {
            matchWinnerId = p1.id;
            matchLoserId = p2 ? p2.id : null;
            isComplete = true;
          } else if (p2 && p2Wins >= threshold) {
            matchWinnerId = p2.id;
            matchLoserId = p1 ? p1.id : null;
            isComplete = true;
          }
          const updatedRecord = {
            ...currentRecord,
            bestOf: matchBestOf,
            player1Wins: p1Wins,
            player2Wins: p2Wins,
            games: cleanedGames,
            winnerPlayerId: matchWinnerId,
            loserPlayerId: matchLoserId,
            isComplete,
            hasTiebreaker: Boolean(body.hasTiebreaker)
          };
          let updatedBracket = tier.bracket;
          if (matchWinnerId && isComplete) {
            try {
              updatedBracket = advanceMatchWinner(tier.bracket, matchId, matchWinnerId);
            } catch {
            }
          } else {
            try {
              updatedBracket = retractMatchWinner(tier.bracket, matchId);
            } catch {
            }
          }
          t.tiers = t.tiers.map((tr) => tr.id === tierId ? { ...tr, bracket: updatedBracket } : tr);
          t.matchScores[matchId] = updatedRecord;
          const saved = await saveFullTournament(t);
          return sendJson(res, 200, saved);
        }
        const matchForfeitSub = subAction.match(/^matches\/([^/]+)\/forfeit$/);
        if (matchForfeitSub && method === "POST") {
          if (!checkAuth(req, res, "TOURNAMENT_ADMIN", tourneyId)) return;
          const matchId = matchForfeitSub[1];
          const t = await getFullTournament(tourneyId);
          if (!t) return sendError(res, 404, "Tournament not found");
          const tierId = body.tierId;
          const tier = t.tiers.find((tr) => tr.id === tierId);
          if (!tier || !tier.bracket) return sendError(res, 404, "Tier or bracket not found");
          const targetMatch = tier.bracket.matchesById?.[matchId];
          if (!targetMatch) return sendError(res, 404, "Match not found in tier bracket");
          const p1 = targetMatch.player1.player;
          const p2 = targetMatch.player2.player;
          const winnerPlayerId = body.winnerPlayerId;
          const loserId = p1?.id === winnerPlayerId ? p2?.id ?? null : p1?.id ?? null;
          const currentRecord = t.matchScores[matchId] || {
            matchId,
            tierId,
            organizationId: t.organizationId,
            bestOf: targetMatch.bestOf || tier.bestOf,
            player1Wins: 0,
            player2Wins: 0,
            games: [],
            winnerPlayerId: null,
            loserPlayerId: null,
            isComplete: false
          };
          const updatedRecord = {
            ...currentRecord,
            winnerPlayerId,
            loserPlayerId: loserId,
            isComplete: true,
            notes: "Forfeit win",
            forfeitWinnerId: winnerPlayerId
          };
          let updatedBracket = tier.bracket;
          try {
            updatedBracket = advanceMatchWinner(tier.bracket, matchId, winnerPlayerId);
          } catch {
          }
          t.tiers = t.tiers.map((tr) => tr.id === tierId ? { ...tr, bracket: updatedBracket } : tr);
          t.matchScores[matchId] = updatedRecord;
          const saved = await saveFullTournament(t);
          return sendJson(res, 200, saved);
        }
        const matchBestOfSub = subAction.match(/^matches\/([^/]+)\/best-of$/);
        if (matchBestOfSub && method === "PUT") {
          if (!checkAuth(req, res, "TOURNAMENT_ADMIN", tourneyId)) return;
          const matchId = matchBestOfSub[1];
          const t = await getFullTournament(tourneyId);
          if (!t) return sendError(res, 404, "Tournament not found");
          const tierId = body.tierId;
          const tier = t.tiers.find((tr) => tr.id === tierId);
          if (!tier || !tier.bracket) return sendError(res, 404, "Tier or bracket not found");
          const targetMatch = tier.bracket.matchesById?.[matchId];
          if (!targetMatch) return sendError(res, 404, "Match not found in tier bracket");
          const bestOf = body.bestOf || 3;
          const currentRecord = t.matchScores[matchId] || {
            matchId,
            tierId,
            organizationId: t.organizationId,
            bestOf,
            player1Wins: 0,
            player2Wins: 0,
            games: [],
            winnerPlayerId: null,
            loserPlayerId: null,
            isComplete: false
          };
          const threshold = Math.ceil(bestOf / 2);
          const p1Wins = currentRecord.player1Wins;
          const p2Wins = currentRecord.player2Wins;
          const p1 = targetMatch.player1.player;
          const p2 = targetMatch.player2.player;
          let isComplete = false;
          let winnerPlayerId = null;
          let loserPlayerId = null;
          if (p1 && p1Wins >= threshold) {
            winnerPlayerId = p1.id;
            loserPlayerId = p2 ? p2.id : null;
            isComplete = true;
          } else if (p2 && p2Wins >= threshold) {
            winnerPlayerId = p2.id;
            loserPlayerId = p1 ? p1.id : null;
            isComplete = true;
          }
          let updatedBracket = tier.bracket;
          if (isComplete && winnerPlayerId) {
            try {
              updatedBracket = advanceMatchWinner(tier.bracket, matchId, winnerPlayerId);
            } catch {
            }
          } else {
            try {
              updatedBracket = retractMatchWinner(tier.bracket, matchId);
            } catch {
            }
          }
          const updatedRecord = {
            ...currentRecord,
            bestOf,
            isComplete,
            winnerPlayerId,
            loserPlayerId
          };
          t.tiers = t.tiers.map((tr) => tr.id === tierId ? { ...tr, bracket: updatedBracket } : tr);
          t.matchScores[matchId] = updatedRecord;
          const saved = await saveFullTournament(t);
          return sendJson(res, 200, saved);
        }
      }
      return sendError(res, 404, `Not found: ${method} ${pathname}`);
    } catch (err) {
      console.error(`[API Error] ${method} ${pathname}:`, err);
      const msg = err instanceof Error ? err.message : "Internal Server Error";
      return sendError(res, 500, msg);
    }
  };
}
async function simulateSampleTournament() {
  await seedDefaultOrganizations();
  let dbPlayers = await listPlayers();
  if (dbPlayers.length < 32) {
    const toInsert = AUTHENTIC_COMPETITOR_NAMES.slice(0, 100).map((name) => ({
      name,
      country: "US",
      avatarType: "flag",
      personalBest: Math.floor(8e5 + Math.random() * 6e5),
      playstyle: "Rolling",
      notes: "Authentic competitor"
    }));
    await createPlayersBatch(toInsert);
    dbPlayers = await listPlayers();
  }
  const globalProfiles = dbPlayers.map((p) => ({
    id: p.id,
    name: p.name,
    country: p.country || void 0,
    avatarType: p.avatarType,
    avatarUrl: p.avatarUrl || void 0,
    personalBest: p.personalBest,
    playstyle: p.playstyle || "Rolling",
    isDisqualified: p.isDisqualified
  }));
  const goldTierId = crypto.randomUUID();
  const silverTierId = crypto.randomUUID();
  const tourneyId = crypto.randomUUID();
  const baseTourney = {
    id: tourneyId,
    organizationId: "org_ctwc",
    slug: `ctwc-open-${Date.now() % 1e4}`,
    name: "CTWC 2026 World Championship",
    date: "2026-10-18",
    location: "Portland, Oregon",
    qualFormat: "HIGH_SCORE",
    isLocked: false,
    seedingMethod: "QUALIFIERS",
    manualSeeds: [],
    playersPool: [],
    qualifierSubmissions: [],
    tournamentPlayers: {},
    matchScores: {},
    useOrgBranding: true,
    tiers: [
      {
        id: goldTierId,
        slug: "gold",
        name: "Gold Championship",
        priority: 1,
        bracketType: "TRADITIONAL",
        playerCount: 16,
        bestOf: 5,
        primaryColor: "#ffc905",
        secondaryColor: "#705b33",
        cardColor: "#1b1c1d",
        textColor: "#94A3B8",
        backgroundColor: "#020203",
        isLocked: false,
        bracket: generateTraditionalBracket(
          globalProfiles.slice(0, 16).map((p, idx) => ({ id: p.id, name: p.name, seed: idx + 1 })),
          { tierId: goldTierId, bestOf: 5 }
        )
      },
      {
        id: silverTierId,
        slug: "silver",
        name: "Silver Bracket",
        priority: 2,
        bracketType: "FLAT",
        flatWidth: 2,
        playerCount: 16,
        bestOf: 3,
        primaryColor: "#CBD5E1",
        secondaryColor: "#3d4652",
        cardColor: "#0E1420",
        textColor: "#4f5c6d",
        backgroundColor: "#0B0E14",
        isLocked: false,
        bracket: generateFlatBracket(
          globalProfiles.slice(16, 32).map((p, idx) => ({ id: p.id, name: p.name, seed: idx + 1 })),
          2,
          { tierId: silverTierId, bestOf: 3 }
        )
      }
    ]
  };
  const simulated = runFullSimulation(baseTourney, globalProfiles);
  const saved = await saveFullTournament(simulated);
  return saved;
}

// src/server/serverless.ts
var middleware = createApiMiddleware();
async function handler(req, res) {
  try {
    return await middleware(req, res, () => {
      res.statusCode = 404;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "Endpoint not found", url: req.url }));
    });
  } catch (err) {
    console.error("[API Serverless Error]:", err);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({
      error: "Internal Server Error",
      name: err?.name,
      message: err?.message || String(err),
      stack: err?.stack
    }));
  }
}
export {
  handler as default
};
