# SPEC.md: Tournament Manager

## 1. Project Overview
A web-based bracket and leaderboard manager built for competitive gaming tournaments (modeled on Classic Tetris tournament standards). The application provides real-time reactive updates, retro OBS overlays, customizable qualifying formats (High Score, Average of X, Points), flat and traditional bracket routing, double-elimination brackets with grand finals resets, global organization management with raw player metric indexing, self-service online qualifiers with Twitch OAuth and NES authwords, and mobile-responsive match recording for floor judges.

The system prioritizes human readability, deterministic rules, minimal runtime overhead, and zero over-engineered dead code for rare edge cases.

---

## 2. Project Status & Roadmap

* **Phase 1: Core Routing Engine (Complete)**
  * Pure mathematical functions for traditional single-elimination and flat brackets. Strict bye invariant enforced (no phantom match entities; players advance directly to their calculated entry round; total matches strictly equals $N - 1$).
* **Phase 2: Reactive UI & Match Recording (Complete)**
  * Visual bracket tree, mobile-responsive match card feed, and drawer-based score submission. Multi-game score tracking, dynamic match win derivations, forfeit flags, intentional topouts, and Best-of-X overrides.
* **Phase 3: Unified In-Memory Pipeline, Adaptive Qual Board & Operational Polish (Complete)**
  * Comprehensive in-memory operations platform in browser state (LocalStorage) delivering:
    * **Priority 1 (UI & Ergonomics):** Rebranding to "Tournament Manager", mode terminology unification (`isLocked`), modal guards, and form dirty-state navigation guards.
    * **Priority 2 (Lifecycle & Testing):** Streamlined lock/unlock safety invariants, fresh clean-slate onboarding (0 tournaments), and simulation sandbox controls ("Seed Qualifiers Only", "Simulate Full Tournament", "Clear All Tournament Data").
    * **Priority 3 (Global Standings):** Continuous #1 to #N sequential ranking across all tiers, exact competitive intra-round exit tiebreaker formula (exit game wins $\rightarrow$ loss score average $\rightarrow$ match record $\rightarrow$ game average $\rightarrow$ seed), and Qual vs. Final rank delta badges.
    * **Priority 4 (Qual Density & Detail Drawer):** High Score Maxout ($\ge 999,999$) count + kicker sorting engine, format-dense leaderboard columns (AoX attempts chips, Points breakdown), and slide-out `PlayerDetailDrawer` with chronological attempt audit logs and match history.
    * **Priority 5 (Master Directory & Roster):** Global Player Pool Directory (`classic_tetris_global_players`, `/players`) with "Generate Fake Players" modal, and tournament roster management with bulk global imports.
    * **Bracketless Tournament Creation:** Tournaments initialize with zero tiers; qual entry and player registration are active immediately on a pure qual board; tiers can be added, modified, or removed at any time with dynamic bracket seeding.
    * **Adaptive Qual Board:** Automatically toggles between a clean, pure qual board (no seed column, neutral styling) when 0 tiers exist, and full tiered bracket preview with tier cutoff dividers and rank tinting once tiers are added.
    * **3-State Qualifier Status Engine:** Tracks competitors across `'not started'` (0 attempts), `'in progress'` (1+ attempts), and `'verified'` (judge-verified), with verification toggles in the leaderboard and profile drawer, and auto-verification on bracket lock.
    * **Navigation & Visual Polish:** Top navbar aligned with bracket operations on the left and tournament management on the right; dedicated sub-bar for tier tabs; 1080p zero-scroll auto-fit and split-wings OBS broadcast overlays with chroma key presets (`/:slug/obs`); and dynamic SVG orthogonal bracket connector lines.
* **Phase 4: Tournament Organizations (Complete)**
  * Full organization management layer:
    * Required organization association for all tournaments (every tournament must belong to an organization).
    * Dedicated Organization Directory (`/organizations`) and Organization Detail/Settings page (`/org/:orgSlug`).
    * Inline organization creation shortcut from the tournament creation modal.
    * Top-level navigation tabs: `Tournaments` | `Organizations` | `Players`.
    * Org-level branding and default rules inheritance with per-tournament override toggles.
    * Org-level Discord webhook configuration with per-tournament fallback.
    * Raw multi-entity metric indexing: every score submission, match record, and tournament roster entry explicitly associates `(organizationId, playerId, tournamentId)`.
* **Phase 5: Double Elimination Bracket Engine (Complete)**
  * Comprehensive double-elimination routing:
    * Retain `bracketType: 'TRADITIONAL' | 'FLAT'`; introduce independent `eliminationType: 'SINGLE' | 'DOUBLE'`.
    * Standard cascading loser drop routing across both Traditional and Flat brackets (Winners R1/R2 losers feed Losers ladder) with strict bye invariants ($2N - 2$ total matches, no phantom matches, bye recipients who lose in W2 drop into L2).
    * Grand Finals Match 1 + dynamic Grand Finals Reset (Match 2) if the Losers Champion wins Match 1.
    * Stage-specific round overrides keyed by stage & round (`W1`, `W2`, `L1`, `L2`, `GF`, `GF_RESET`).
    * Sequential double-elimination global standings: placement determined by Losers bracket exit round, with intra-round ties broken via competitive exit tiebreakers.
    * Canvas visualizer layout: Winners tree on top, Losers tree on the bottom half, Grand Finals centered on the right, and dynamic GF Reset insertion.
    * Floor Judge feed: Stage filter tabs (`All`, `Winners`, `Losers`, `Grand Finals`) and precise drop placeholder labeling.
    * **Accelerated Hybrid Multi-Pod Engine:** Three distinct qualifier pods (Pod 1: Accelerated Round, Pod 2: Upper Bracket, Pod 3: Lower Bracket) feeding into a Single-Elimination Championship Tree (Top 16 / Top Cutoff).
    * **Multi-View Pod Ergonomics:** Adaptive side-by-side layout (Pod 1 $\rightarrow$ Pod 2 $\rightarrow$ Pod 3) for Fit and Split views, classic stacked layout for Standard view, scrollbar elimination in Fit view, and equal margin match centering in Pod 3.
    * **Competitor Journey Highlighting & Bracket Search:** Integrated toolbar search input with auto-complete, single-competitor path illumination across all feeder rounds, and synchronized zero-lag CSS transitions.
* **Phase 6: Direct / Manual Seeding & Roster Seeding Engine (Upcoming Immediate Phase)**
  * Full tournament seeding capability without requiring qualifier submissions:
    * `seedingMethod: 'QUALIFIERS' | 'MANUAL'` per tournament.
    * Bulk import participants via raw multiline paste (ordered top seeds first, auto-parsed and matched against global player pool).
    * Interactive manual seeding and reordering (drag-and-drop, move up/down, direct seed entry, and randomize/shuffle).
    * Dynamic tier cutoff distribution with visual tier dividers (Tier 1 Gold, Tier 2 Silver, etc.) and alternate/reserve tracking.
    * Seamless mathematical bracket generator hook bypassing `deriveLeaderboard` when in manual mode.
    * Standings, simulation sandbox, and verification/lock lifecycle support for manual seeds.
* **Phase 7: Relational Persistence & RBAC Foundation (Upcoming)**
  * Translation of finalized TypeScript contracts into Neon serverless PostgreSQL tables via Drizzle ORM schemas and server functions.
  * Granular Role-Based Access Control (RBAC): `ORG_OWNER`, `ORG_ADMIN`, `TOURNAMENT_ADMIN`, and `FLOOR_JUDGE`.
  * Serverless API endpoints and migration pipeline from browser LocalStorage.
* **Phase 8: Online Qualifiers & Competitor Self-Service Portal (Upcoming)**
  * Dedicated public competitor self-serve flow (`/:slug/qualify`) with Twitch OAuth 2.0 login and profile linking.
  * 6–8 character NES-compatible Authword Engine: family-friendly curated dictionary + admin custom word additions; $\ge 6$ letters dedicated to a real English word; no spaces; optional NES symbols/numbers (`!`, `.`, `-`, `♥`, `0-9`).
  * Optional countdown timer (inherits tournament/org duration, start/finish/pause logging, non-blocking submit).
  * Submission form: scores + Twitch VOD link $\rightarrow$ immediate unverified entry on leaderboard with compact mobile-friendly status badge (`awaiting verification`).
  * Online Judge Review Queue / Drawer: VOD link/embed, authword verification at 10k topout, timer log inspection, one-click verify, score edits, and DNQ/DQ flagging.
  * Discord Webhook dispatch: tournament-level webhook with fallback to org webhook (qual started, qual submitted).
  * Tournament mode setting: `IN_PERSON`, `ONLINE`, or `HYBRID`.
* **Phase 9: Match Data Export & Custom Analytics (Upcoming)**
  * Universal match data exporter with customizable field selection, reorderable columns, and presets:
    * Output formats: CSV, TSV (direct paste into Google Sheets), and Excel-compatible downloads.
    * Customizable field selection: Match ID, Tier, Stage, Round, Player 1/2 Names, Seeds, Game Scores, Winner, Duration, Forfeit.
    * Column reordering for seamless integration into community spreadsheets and tournament archives.
* **Phase 10: Production Deployment, PIN Security & Polish (Upcoming)**
  * Shared Passphrase (PIN) gating all `/manage/*` routes.
  * Vercel edge deployment and custom domain routing.
* **Future Polish & Mobile View Backlog (Detailed in Section 13):**
  * Publicly-accessible, mobile-friendly read-only bracket view with multi-view toggles (`Full Bracket`, `Mobile Bracket`, `Split Bracket`) and sharing links.
  * Mobile-responsive overhauls for the 4 data-dense views (Qualifiers, Standings, Roster, Global Players) and compact 360×800 global navigation & breadcrumbs.

---

## 3. Directory Structure (Strict Feature-Driven)
* `/src/features/bracket/` – Bracket trees, mathematical routing, node state, match score drawers, double-elimination routing & reset.
* `/src/features/organizations/` – Global organization directory, org profile, org branding & defaults, RBAC roles.
* `/src/features/qualifiers/` – Score submission, dynamic leaderboard sorting, tier cutoff assignments, competitor detail drawer, online qual review queue.
* `/src/features/online-quals/` – Twitch OAuth, authword engine, competitor self-service portal, countdown timer, Discord webhook integration.
* `/src/features/tournament/` – Admin setup forms, tier configuration (priority order, width, cutoffs, colors, elimination type), global standings.
* `/src/features/players/` – Global player pool directory (`classic_tetris_global_players`) and tournament roster registration.
* `/src/routes/` – Top-level page routes (`/organizations`, `/org/:orgSlug`, `/:slug/qualify`, `/manage/*`, `/obs/*`).
* `/src/components/` – Shared UI components (inputs, modals, buttons, table wrappers, top-level navigation tabs).

---

## 4. Universal Invariants & Exact Mathematical Rules

### 4.1 Bye Handling & Match Invariant
* **Single Elimination:**
  $$\text{total\_matches} = N - 1$$
* **Double Elimination:**
  $$\text{total\_matches} = 2N - 2 \quad (\text{or } 2N - 1 \text{ if Grand Finals Reset occurs})$$
* Byes are never represented as playable matches and never accept scores.
* Players receiving byes are placed directly into their calculated entry round:
  $$\text{entry\_round} = \text{total\_byes\_for\_seed} + 1$$
* **Double Elimination Bye Drops:** A player receiving a bye in Winners Round 1 who loses in Winners Round 2 drops into Losers Round 2 (never into Losers Round 1, preventing double-punishing bye recipients).
* Any node awaiting a feeder or bye recipient initializes with `player2_id: null`. Matches appear in score entry interfaces only when both competitors are confirmed.

### 4.2 Tier-Relative Seeding
* Leaderboard ranks must be normalized relative to the tier before passing to the bracket generator:
  $$\text{tier\_seed} = \text{global\_rank} - \text{tier\_start\_rank} + 1$$
* *Example:* In a 12-player Silver tier composed of leaderboard ranks 13 through 24, Rank 13 becomes Seed 1, Rank 14 becomes Seed 2, through Rank 24 becoming Seed 12.

### 4.3 Exact Tiebreaker Mathematical Formulas

#### 1. Qualifiers High Score & Maxout Engine:
* **Maxout Threshold:** Any score $\ge 999,999$ is a Maxout.
* For a competitor's set of qualifier submissions $S$:
  $$\text{maxout\_count} = |\{ s \in S \mid s.\text{score} \ge 999,999 \}|$$
  $$\text{kicker\_score} = \max(\{ s.\text{score} \mid s \in S \land s.\text{score} < 999,999 \} \cup \{ 0 \})$$
* **Sorting Hierarchy for High Score Mode:**
  1. $\text{maxout\_count}$ descending (e.g. 2 maxouts > 1 maxout > 0 maxouts).
  2. If $\text{maxout\_count} > 0$: $\text{kicker\_score}$ descending (if a player has only maxouts, kicker is 0).
  3. If $\text{maxout\_count} == 0$: highest score $\max(S)$ descending.
  4. Deterministic fallback: earlier submission timestamp ascending, then player ID ascending.

#### 2. Qualifiers Average of X Engine:
* In-progress: running arithmetic mean of attempts submitted so far.
* Finalized / Locked: missing attempts up to $X$ are computed as score 0:
  $$\text{final\_average} = \text{round}\left(\frac{\sum_{i=1}^n \text{score}_i}{\max(n, X)}\right)$$

#### 3. Competitive Intra-Round Exit Tiebreaker (Final Standings):
* For all players eliminated in the same bracket round $R$:
  * Let $M$ be the match in which the competitor was eliminated.
  * $\text{exit\_game\_wins}$: Games won by the player in match $M$.
  * Forfeit rule: unplayed games in a forfeit count as losses with score 0.
  * Let $L$ be the multiset of scores in games the player lost in match $M$ (including 0s for forfeit losses).
  * $\text{avg\_loss\_score}$:
    $$\text{avg\_loss\_score} = \begin{cases} \frac{\sum L}{|L|}, & \text{if } |L| > 0 \\ 0, & \text{if } |L| == 0 \end{cases}$$
* **Sorting Hierarchy within an Elimination Round:**
  1. $\text{exit\_game\_wins}$ descending (e.g. 2–3 loss > 1–3 loss > 0–3 loss).
  2. $\text{avg\_loss\_score}$ descending (highest average score across lost games in that exit match).
  3. Overall tournament match record (wins minus losses in tournament match play).
  4. Overall tournament game score average (average score across all tournament games played).
  5. Initial qualifying seed ascending (higher seed breaks the tie).

#### 4. Global Standings Sequential Ranking (#1 to #N):
* **Single Elimination Sequential Structure:**
  * Tier Champion $\rightarrow$ Runner-up $\rightarrow$ Semifinalists (sorted by Exit Tiebreaker) $\rightarrow$ Quarterfinalists $\rightarrow$ Round of 16, etc.
* **Double Elimination Sequential Structure:**
  * Rank 1: Grand Finals Winner (Champion)
  * Rank 2: Grand Finals Loser (Runner-up)
  * Rank 3: Losers Finals Loser
  * Rank 4: Losers Semifinals Loser
  * Ranks 5–6: Losers Round 4 Losers (sorted by Exit Tiebreaker)
  * Ranks 7–8: Losers Round 3 Losers (sorted by Exit Tiebreaker), etc.
* **Multi-Tier Stacking:** Tier 2 begins sequentially at $\text{Tier 1 Capacity} + 1$.
* **DNQ (Did Not Qualify):** Ranked immediately after all bracket participants in their qualifying order.
* **DQ (Disqualified):** Competitors with `isDisqualified: true` placed at the absolute bottom, labeled "DQ".

### 4.4 Personal Best (PB) Updates
* `player.personalBest` is strictly a manual field edited via the player management form. Match and qualifier scores must never auto-mutate this value.

### 4.5 Tournament Modes & Lifecycle
1. **Mode Terminology:**
   * Modes are **"Qualifiers Mode"** and **"Match Play Mode"**.
   * On `Tournament`, stored as `isLocked: boolean` (`false` = Qualifiers Mode, `true` = Match Play Mode).
2. **Qualifiers Mode (`isLocked === false`):**
   * Leaderboard accepts qualifier submissions and dynamically previews bracket seeding.
   * Match cards across all views are non-clickable.
3. **Lock Brackets & Begin Match Play (`isLocked === true`):**
   * Double-confirmation modal freezes seeds and instantiates static match records.
4. **Unlock Rule (Safety Invariant):**
   * Reverting back to Qualifiers Mode is permitted **only if exactly 0 match scores have been recorded**.
5. **Modal & Drawer Dismissal Safety:**
   * Modals and drawers never dismiss on backdrop/scrim click. Dismissal requires explicit Cancel, Save, or `X` click.

---

## 5. Phase 3 Specifications: Unified In-Memory Pipeline & Adaptive Qual Board (Complete)

### 5.1 Priorities 1–5 Core Implementation
* **Priority 1: UI Rebranding, Ergonomics, Modal Guards & Mode Terminology:**
  * Complete rebrand from "CTWC" to "Tournament Manager".
  * Unified mode terminology: "Qualifiers Mode" (`isLocked === false`) vs "Match Play Mode" (`isLocked === true`).
  * Lock down match cards in `BracketVisualizer`, `OrganizerSheetMatrix`, and `MatchCardFeed` during Qualifiers Mode.
  * Disabled backdrop dismissal on `MatchScoreDrawer`, `PlayerDetailDrawer`, and `QualifierEntryModal`.
  * Dirty state tracking on `TournamentAdminForm` ("Save Configuration" disabled until dirty) with unsaved changes navigation guard modal.
  * Form inputs guarded: submit button disabled until player and score are dirty and valid.
  * Dynamic tier color binding (`primaryColor`, `secondaryColor`) to round badges, borders, winner highlights, and trophy icons.
* **Priority 2: Tournament Lifecycle & Simulation Controls:**
  * Replaced legacy `isVerified` and `qualsClosed` with single source of truth `isLocked: boolean`.
  * Enforced unlock safety invariant: blocking unlock if any match has recorded scores.
  * Clean-slate defaults on fresh onboarding (0 tournaments on home switcher; modal routes to `/:slug/manage/settings` with 0 data).
  * Data Management controls in Settings: "Seed Qualifiers Only" (bracket capacity + 4 DNQs), "Simulate Full Tournament" (complete match outcomes to champions), and "Clear All Tournament Data" (guarded by red speedbump confirmation modal). Purged legacy demo pipelines.
* **Priority 3: Global Tournament Standings & Competitive Exit Tiebreakers:**
  * Refactored `standings.ts` to output a unified #1 to #N global list across all tiers.
  * Implemented exact intra-round exit tiebreaker formula (exit game wins $\rightarrow$ loss avg $\rightarrow$ match record $\rightarrow$ game avg $\rightarrow$ seed).
  * Continuous `FinalStandingsTable.tsx` with overview stat cards, performance analytics columns, and Qual vs. Final rank delta badges.
* **Priority 4: Qualifiers Table Density & Competitor Detail Drawer:**
  * Implemented Maxout count ($\ge 999,999$) + kicker score sorting hierarchy in `scoring.ts`.
  * Format-dense column rendering on `LeaderboardTable.tsx` adapting to `HIGH_SCORE`, `AVERAGE_OF_X`, and `POINTS`.
  * Slide-out `PlayerDetailDrawer.tsx` displaying competitor profile, chronological qualifier submission audit log, and match breakdown.
* **Priority 5: Global Player Pool Directory & Tournament Roster:**
  * Master player directory under LocalStorage key `classic_tetris_global_players` at `/players`.
  * "Generate Fake Players" prompt modal with presets (`+8`, `+16`, `+32`, `+64`) generating realistic competitors.
  * Tournament roster registration with "Import from Global Pool" and "Import All Available" actions.

### 5.2 Bracketless Creation & Adaptive Qual Board
* **Bracketless Tournament Onboarding:** Tournaments can be created with 0 tiers and 0 brackets (`tiers: []`). Organizers can begin registering competitors and logging qualifiers immediately.
* **Adaptive Qual Board:** When `tiers.length === 0`, `LeaderboardTable` renders as a pure qual board (omits Bracket Seed column, tier cutoffs, and tier tints). When bracket tiers are added in Settings, the full bracket-seeding leaderboard view activates seamlessly.
* **3-State Qualifier Status Engine:**
  * Competitors are dynamically tracked as:
    * `'not started'` (0 attempts recorded).
    * `'in progress'` (1+ attempts recorded, unverified).
    * `'verified'` (confirmed by judge or tournament admin).
  * Status badges rendered in `LeaderboardTable` and `PlayerDetailDrawer`.
  * Dedicated "Verify Score" judge button in `QualifierEntryModal` and `PlayerDetailDrawer`.
  * When locking brackets for match play, all qualified players automatically flip to `verified`.
* **Decoupled Seeding & Reactive Tier Population:** Simulation engine generates 25–30 competitors even when total bracket capacity is 0. Adding or modifying tiers in Settings reactively populates the top qualifiers from the leaderboard into the newly created tiers.
* **Navigation Realignment:** Top navbar aligned with bracket operations on the left (`Organizer Sheet`, `Floor Judge`, `Visual Bracket`) and administrative tools on the right (`Qualifiers`, `Standings`, `Register Players`, `Settings`).
* **Broadcast Studio & OBS Hub (`/:slug/obs`):** Full-bleed transparent canvases with chroma key presets (Green, Magenta, Blue, Transparent), 1080p zero-scroll auto-fit, and split wings.
* **Dynamic SVG Connectors:** Pure orthogonal SVG paths connecting feeder matches to downstream round nodes in `BracketVisualizer.tsx` and `bracketLayout.ts`.

---

## 6. Phase 4 Detailed Specifications: Tournament Organizations (Complete)

### 6.1 Core Entity & Store Architecture
* **Entity Definition:**
  ```typescript
  export interface Organization {
    id: string;
    slug: string; // unique URL slug, e.g. 'ctwc', 'ctm', 'lone-star'
    name: string; // e.g. 'Classic Tetris World Championship'
    description?: string;
    logoUrl?: string;
    website?: string;
    brandColor?: string; // primary accent color
    discordWebhookUrl?: string; // inherited by tournaments if not overridden
    defaultRules?: {
      qualFormat?: QualFormat;
      qualAverageCount?: number;
      qualWindowMinutes?: number;
      bestOf?: number;
      primaryColor?: string;
      secondaryColor?: string;
    };
    createdAt: number;
  }
  ```
* **LocalStorage Persistence:** Persisted under key `classic_tetris_organizations`.
* **Required Association:** Every `Tournament` has `organizationId: string` (required).

### 6.2 User Experience & Navigation
* **Top-Level Navigation Tabs:**
  * Header switcher includes three primary top-level tabs:
    `[ 🏆 Tournaments ]` | `[ 🏢 Organizations ]` | `[ 👥 Players ]`
* **Onboarding & Creation Flow:**
  * In `TournamentSwitcherPage`, clicking "+ Create New Tournament" presents an Organization dropdown with a prominent "+ New Organization" option.
  * If 0 organizations exist, the modal automatically prompts the user to name and create their first Organization in step 1.
* **Dedicated Management Views:**
  * `/organizations`: Master directory showing org cards, total tournaments, total registered competitors, logo, and quick actions.
  * `/org/:orgSlug`: Dedicated organization management view:
    * Overview header (logo, name, website, edit metadata modal).
    * Branding & default tournament rules configuration.
    * Org-level Discord Webhook configuration.
    * List of hosted tournaments with status badges and quick links.
* **Branding & Inheritance Toggle:**
  * In `TournamentAdminForm` (Settings): toggle *"Use Organization Branding"* (default true). When unchecked, allows customizing tournament colors and logo without altering parent org defaults.
* **Raw Metric Indexing:**
  * Every score submission, match record, and tournament roster entry explicitly associates `(organizationId, playerId, tournamentId)`, enabling instant high-speed indexing for org-specific player stats and overall career stats.

---

## 7. Phase 5 Detailed Specifications: Double Elimination Bracket Engine (Complete)

### 7.1 Tier Configuration & Types
* `TournamentTier` model updated with independent elimination style:
  ```typescript
  export type EliminationType = 'SINGLE' | 'DOUBLE';
  // TournamentTier:
  // bracketType: 'TRADITIONAL' | 'FLAT'
  // eliminationType: 'SINGLE' | 'DOUBLE' (default 'SINGLE')
  ```

### 7.2 Routing Engine & Cascading Loser Drops
* **Winners Bracket:** Routes identically to existing Traditional/Flat single-elimination.
* **Losers Bracket:**
  * Losers from Winners R1 drop into Losers R1 with crossover seeding to prevent early rematches.
  * Losers from Winners R2 drop into Losers R2 (or R3 depending on bracket size) to face surviving winners from earlier loser rounds.
  * Cascading logic applies identically whether Round 1 is Traditional or Flat.
* **Grand Finals & Dynamic Reset:**
  * Grand Finals Match 1: Winners Bracket Champion vs. Losers Bracket Champion.
  * If Winners Bracket Champion wins Match 1: Tier is complete.
  * If Losers Bracket Champion wins Match 1: System dynamically instantiates **Match 2 (Grand Finals Reset)**.
* **Stage-Specific Round Overrides:**
  * Round best-of overrides keyed by stage identifier: `'W1'`, `'W2'`, `'L1'`, `'L2'`, `'GF'`, `'GF_RESET'`.
  * Match 2 inherits the override for `GF_RESET` (falling back to `GF` / tier default).
* **Standings Integration:**
  * Sequential ranking determined by Losers bracket exit round (1st = GF winner, 2nd = GF loser, 3rd = Losers Final loser, 4th = Losers Semi loser, 5th–6th = Losers Quarter losers, etc.).
  * Ties within the same Losers round are broken using the competitive exit tiebreaker formula.
* **Canvas Layout:**
  * Visualizer renders the Winners tree on top, Losers tree directly below on the bottom half, and Grand Finals centered on the right.

---

## 8. Phase 6 Detailed Specifications: Direct / Manual Seeding & Roster Seeding Engine

### 8.1 Configuration & Data Model
* **Seeding Method on Tournament:**
  ```typescript
  export type SeedingMethod = 'QUALIFIERS' | 'MANUAL';

  export interface Tournament {
    // ...
    seedingMethod: SeedingMethod; // default 'QUALIFIERS'
    manualSeeds?: string[]; // ordered array of playerIds: index 0 = Seed 1, index 1 = Seed 2, etc.
  }
  ```
* **Setting Configuration (`TournamentAdminForm`):**
  * Admin toggle under Tournament Details: **Seeding Mode** (`Qualifiers Leaderboard` vs `Direct / Manual Seeding`).
  * When `MANUAL` is selected, `qualFormat`, `qualAverageCount`, and `qualWindowMinutes` are cleanly hidden or grayed out.
  * Can be switched back and forth in Qualifiers/Draft mode, but locked once match play begins (`isLocked === true`).

### 8.2 Bulk Import via Textarea
* **Raw Multiline Paste Modal / Component (`BulkSeedImportModal.tsx`):**
  * Large textarea accepting multiline text.
  * Robust line parser:
    * Strips line numbers, ranks, bullets, hashes (e.g. `1. `, `1) `, `#1 `, `- `, `1 - `).
    * Trims leading/trailing whitespace; filters out empty lines.
  * Player Resolution & Creation Pipeline:
    * Checks if name exists in tournament roster (`tournament.playersPool`).
    * If not in tournament, checks Master Global Player Pool (`classic_tetris_global_players`). If found, automatically imports them with their PB, country, and playstyle.
    * If completely new, creates a new `PlayerProfile` in the global pool and registers them to the tournament roster.
  * Seed Sequence:
    * The ordered list from top to bottom directly defines `manualSeeds` (line 1 $\rightarrow$ Seed 1, line 2 $\rightarrow$ Seed 2, ...).

### 8.3 Interactive Seeding & Reordering Interface (`ManualSeedingManager.tsx`)
* **Dedicated Management Screen (`/:slug/manage/seeding` or adaptive `/manage/qualifiers`):**
  * When `seedingMethod === 'MANUAL'`, the navigation tab adapts to **"Seeding"** (with quick link to switch to Qualifiers if desired).
  * **Visual Tier Boundary Dividers:**
    * Automatically calculates and renders colored tier divider bars across the seed list:
      * e.g., Seeds 1–16: **Gold Bracket** (with gold border/badge).
      * Seeds 17–32: **Silver Bracket** (with silver border/badge).
      * Seeds 33+: **Reserves / Alternate / Unassigned** (neutral styling).
  * **Reordering Controls:**
    * Drag-and-drop handles for instant pointer-based reordering.
    * Keyboard-accessible "Move Up" / "Move Down" / "Move to Top" / "Move to Bottom" buttons.
    * Direct "Set Seed Number" modal/input (e.g., jump player from Seed 28 to Seed 4, shifting others down).
    * "Randomize / Shuffle Seeds" button with confirmation speedbump modal (for casual/blind draw events).
    * "Reverse Seeds" button.
  * Quick "+ Add Competitor" search autocomplete dropdown from global pool.

### 8.4 Mathematical Bracket Generation & Standings Integration
* **`generateDraftBracketsForTournament` Hook:**
  * When `tournament.seedingMethod === 'MANUAL'`:
    * Bypasses `deriveLeaderboard(tournament)`.
    * Reads `tournament.manualSeeds`.
    * Distributes seeds into sorted tiers according to `tier.numPlayers`:
      * Tier 1 receives seeds $1 \dots \text{capacity}_1$, normalized to tier seeds $1 \dots \text{capacity}_1$.
      * Tier 2 receives seeds $\text{capacity}_1 + 1 \dots \text{capacity}_1 + \text{capacity}_2$, normalized to tier seeds $1 \dots \text{capacity}_2$, etc.
    * Bracket visualizer, match card feeds, and sheet matrices update reactively on every drag or paste.
* **Standings Integration (`standings.ts`):**
  * Initial seed baseline is derived directly from `manualSeeds`.
  * `rankDelta = initialSeed - finalRank` correctly computes over/underperformance relative to manual seed.
* **Simulation Controls (`simulation.ts`):**
  * Adapts "Seed Qualifiers Only" to "Generate Realistic Seeding" when in manual mode.

---

## 9. Phase 7 Detailed Specifications: Relational Persistence & RBAC Foundation

### 9.1 Database Schema (Neon PostgreSQL + Drizzle ORM)
All entities include `id` (UUID) and `created_at` (timestamp).

* **organizations:** `id`, `name`, `slug` (unique), `description`, `logo_url`, `website`, `brand_color`, `discord_webhook_url`, `default_rules` (jsonb).
* **org_memberships:** `id`, `organization_id` (FK), `user_id` (FK), `role` (enum: `ORG_OWNER`, `ORG_ADMIN`, `ORG_JUDGE`).
* **players:** `id`, `name` (unique), `pb` (int, manual), `is_disqualified` (boolean, default false), `notes` (text), `twitch_username` (text, nullable), `twitch_channel_id` (text, nullable).
* **tournaments:** `id`, `organization_id` (FK), `name`, `slug` (text, unique), `seeding_method` (enum: `QUALIFIERS`, `MANUAL`), `qual_format` (enum, nullable), `qual_mode` (enum: `IN_PERSON`, `ONLINE`, `HYBRID`), `qual_average_count` (int, nullable), `qual_window_minutes` (int, nullable), `discord_webhook_url` (text, nullable), `points_config` (jsonb, nullable), `manual_seeds` (jsonb, nullable), `is_locked` (boolean, default false).
* **bracket_tiers:** `id`, `tournament_id` (FK), `priority_order` (int), `name` (text), `bracket_type` (enum: `TRADITIONAL`, `FLAT`), `elimination_type` (enum: `SINGLE`, `DOUBLE`), `flat_width` (int, nullable), `num_players` (int), `best_of` (int), `round_overrides` (jsonb), `primary_color` (text), `secondary_color` (text).
* **tournament_players:** `tournament_id` (FK), `player_id` (FK), `organization_id` (FK), `tier_id` (FK, nullable), `seed` (int, nullable).
* **qualifier_submissions:** `id`, `tournament_id` (FK), `player_id` (FK), `organization_id` (FK), `score` (int), `submission_source` (enum: `IN_PERSON`, `ONLINE`), `auth_word` (text, nullable), `twitch_vod_url` (text, nullable), `is_verified` (boolean, default false), `timer_log` (jsonb, nullable), `status` (enum: `NOT_STARTED`, `IN_PROGRESS`, `SUBMITTED`, `VERIFIED`, `DNQ`).
* **matches:** `id`, `tier_id` (FK), `organization_id` (FK), `bracket_stage` (enum: `WINNERS`, `LOSERS`, `GRAND_FINALS`, `GRAND_FINALS_RESET`), `round_identifier` (text), `player1_id` (FK, nullable), `player2_id` (FK, nullable), `winner_id` (FK, nullable), `loser_id` (FK, nullable), `best_of` (int), `is_forfeit` (boolean, default false).
* **games:** `id`, `match_id` (FK), `player1_score` (int), `player2_score` (int), `winner_id` (FK), `loser_id` (FK), `is_intentional_topout` (boolean, default false).

### 9.2 Granular RBAC Permissions Architecture
* **Org Owner:** Full administrative control over organization settings, billing, webhooks, and assigning Org Admins.
* **Org Admin:** Create and manage tournaments under that organization, edit org defaults, manage player pool.
* **Tournament Admin / Floor Judge:** Scoped to specific tournaments; enter match scores, verify qualifiers, lock/unlock brackets.
* **Security Guard:** Gating editing operations so non-org admins cannot modify organization-level settings or tournaments.

---

## 10. Phase 8 Detailed Specifications: Online Qualifiers & Competitor Portal

### 10.1 Competitor User Journey
1. Competitor visits public tournament qual portal at `/:slug/qualify`.
2. Authenticates via Twitch OAuth 2.0 (retrieves Twitch handle, avatar, and channel link).
3. Views live qual leaderboard; clicks **"Start Official Qual"**.
4. Confirmation modal reminds competitor: *"Ensure your Twitch stream is live and 'Store past broadcasts' is enabled in your Creator Dashboard."*
5. Competitor clicks "Confirm & Begin":
   - System generates a 6–8 character NES Authword.
   - Status changes to `'in progress'` / `'started'`.
   - Optional Countdown Timer initializes based on `tournament.qualWindowMinutes`.
   - If configured, Discord webhook posts: *"🎮 [Player] started an official qual! Watch live: https://twitch.tv/[channel]"*.
6. Competitor streams play, scores $\ge 10,000$ points, tops out intentionally, and types the Authword on the NES high-score name screen.
7. Competitor enters game score(s) and pastes their Twitch VOD URL into the form, clicking **"Submit Official Qual"**.
8. **Immediate Leaderboard Impact:** The submission posts immediately to the live qual board with compact status badge `awaiting verification` (unverified).
9. If configured, Discord webhook posts: *"🏆 [Player] submitted qual score: [Score]. VOD: [link]"*.

### 10.2 Authword Engine Constraints
* Length: **6 to 8 characters**.
* Words: At least 6 characters dedicated to a real, family-friendly English word.
* Valid Characters: Restricted strictly to NES Tetris high-score character set:
  - Letters: `A–Z`
  - Numbers: `0–9`
  - Symbols: `.`, `-`, `!`, `♥`
  - **Spaces are strictly forbidden.**
* Dictionary Pool: Built-in curated list of ~1,000 family-friendly words + Tournament Settings field allowing admins to add custom approved words.

### 10.3 Optional Countdown Timer & Session Log
* Countdown timer displays on the competitor screen (inherits `qualWindowMinutes` from tournament settings or org default).
* Player can start, pause, and resume timer.
* Timer is non-blocking: expiring timer does **not** hard-disable the submit button.
* Submission captures session telemetry:
  ```typescript
  interface QualTimerLog {
    startedAt: number;
    submittedAt: number;
    elapsedSeconds: number;
    timerUsed: boolean;
    pauses: Array<{ pausedAt: number; resumedAt: number }>;
  }
  ```

### 10.4 Online Judge Review Queue & Mobile-Friendly Verification
* **Leaderboard Status Column:**
  - Compact, mobile-responsive indicator (`✓` green for verified, `⏳` amber for awaiting verification, `—` gray for unstarted, `DNQ` red for disqualified).
* **Judge Review Drawer:**
  - Filterable review queue for unverified submissions.
  - Displays Twitch handle, embedded/clickable Twitch VOD link, assigned Authword, and session timer telemetry.
  - Action buttons:
    - **Verify Qual:** Confirms score and flips status to `verified`.
    - **Edit Score:** Corrects score entry errors based on VOD review.
    - **Mark DNQ:** For abandoned runs or invalid authwords.
    - **Disqualify (DQ):** For rules violations.

---

## 11. Phase 9 Detailed Specifications: Match Data Export & Custom Analytics

### 11.1 Configurable Field Selection & Reordering
* Export modal accessible via Tournament Management:
  * Selectable columns with toggles:
    * `[x] Tournament Name`
    * `[x] Tier Name`
    * `[x] Stage (Winners / Losers / Grand Finals)`
    * `[x] Round Identifier / Round Number`
    * `[x] Match ID`
    * `[x] Player 1 Name`
    * `[x] Player 1 Seed`
    * `[x] Player 1 Match Wins`
    * `[x] Player 2 Name`
    * `[x] Player 2 Seed`
    * `[x] Player 2 Match Wins`
    * `[x] Winner Name`
    * `[x] Loser Name`
    * `[x] Game-by-Game Scores (e.g. Game 1: 520k - 480k, Game 2: ...)`
    * `[x] Forfeit Status`
    * `[x] Intentional Topouts`
  * Drag-and-drop or up/down column reordering to match exact personal spreadsheet layouts.
  * Presets: "Default CTWC Match Sheet", "Detailed Audit", "Simple Bracket Results".

### 11.2 Export Formats
* **CSV:** Standard comma-separated values with UTF-8 BOM encoding for seamless Excel import.
* **TSV / Copy to Clipboard:** Tab-separated text copied directly to system clipboard for immediate `Ctrl+V` into Google Sheets.
* **JSON:** Full raw tournament dump for external developers and archive tools.

---

## 12. Phase 10 Detailed Specifications: Production Deployment & Security Polish

* **Access Security:** Shared Passphrase (PIN) gating all `/manage/*` routes.
* **OBS Broadcast Displays (Complete in Phase 3):** Clean 16:9 transparent canvases with chroma key presets, auto-fit, and split wings.
* **Bracket Visuals (Complete in Phase 3):** Dynamic SVG orthogonal connector lines connecting feeder matches to downstream round nodes.
* **Hosting:** Vercel edge deployment and custom domain setup.

---

## 13. Implementation Details & Backlog to Revisit Later

### 11.1 Public-Facing, Mobile-Friendly Read-Only Bracket & Multi-View Display (Complete)
* **Option 1 Routing Architecture (Strict Public Spectator vs Director Isolation):**
  * **Public Spectator Portal (Clean Root `/:slug/*`):**
    * Publicly accessible, mobile-friendly read-only experience designed for sharing with competitors, spectators, and stream viewers:
      * `/:slug/brackets`, `/:slug/:tierSlug` – Live visual bracket tree, bilateral split wings, or mobile card feed.
      * `/:slug/leaderboard` (with `/:slug/quals` shortcut) – Read-only qualifier rankings without score entry inputs.
      * `/:slug/standings` – Read-only tournament final standings.
    * Rendered in dedicated **`SpectatorLayout`** with zero admin sidebar, featuring a streamlined top bar (tournament branding, public tab switcher `[ Brackets | Qualifiers | Standings ]`, "Share" button, and "Admin" mode shortcut).
    * Enforced `canManage={false}` across all public routes. Clicking any match node opens the **Read-Only Match Telemetry Modal** (`MatchTelemetryModal.tsx`) displaying series score, game-by-game point breakdowns, intentional topouts, and competitor profile links without edit inputs.
  * **Tournament Director Management App (`/:slug/manage/*`):**
    * Fully featured control center rendered in **`TournamentLayout`** with complete director sidebar navigation and "Public View ↗" shortcut:
      * `/:slug/manage/bracket`, `/:slug/manage/bracket/:tierSlug` – **100% interactive match management restored directly on the visual bracket tree** (`canManage={true}`). Clicking any match card opens `MatchScoreDrawer` to enter game scores, forfeit overrides, and advance winners.
      * `/:slug/manage/qualifiers` – Full qualifier score submission table.
      * `/:slug/manage/standings` – Tournament standings.
      * `/:slug/manage/sheet` – Master bracket matrix sheet.
      * `/:slug/manage/judge` – Floor judge station.
      * `/:slug/manage/players` – Tournament roster pool.
      * `/:slug/manage/settings` – Tournament configuration and tier creator.
* **Multi-View Display Toggle:**
  * Dedicated switcher button allowing users and spectators to toggle dynamically between 4 layout modes:
    1. **Standard:** Panoramic pan/zoom SVG visualizer for desktop displays and large tablets.
    2. **Fit Screen:** 1080p zero-scroll auto-fit layout.
    3. **Split Wings:** Bilateral wings layout (East vs West converging on Finals node).
    4. **Card Feed:** Vertically-stacked, responsive card-based progression feed (`MatchCardFeed.tsx` in read-only mode) optimized for smartphone viewports (auto-defaults on viewports $< 768\text{px}$).
* **Streamlined Shareability:**
  * Prominent "Share Bracket" button in `BracketTierBar` and `SpectatorLayout` opening `ShareBracketModal.tsx`:
    * Direct canonical URL copy with instant feedback.
    * High-resolution smartphone vector QR code generation for venue spectators, posters, and live streams.
    * 1-click Twitch chat command (`!bracket`) and Discord markdown snippets.
    * Quick share to X / Twitter.

### 11.2 Mobile-Friendly Responsive Overhaul (Target: 360×800 Viewport)
* **High-Priority Data-Dense Views (Prevent Information Truncation):**
  * Several desktop tables conceal vital competitive data on small phone viewports. Dedicated mobile-first card/accordion layouts are needed for:
    1. **Qualifiers Leaderboard (`/tournaments/:slug/qualifiers`):**
       * Replace wide multi-column table overflow with compact competitor cards.
       * Guarantee Rank, Player Name, Playstyle, Status indicator, and Scores (High Score, Maxout count, Kicker, or Average of X attempt chips) remain fully visible without horizontal clipping.
    2. **Final Standings (`/tournaments/:slug/standings`):**
       * Mobile card rows preserving Final Rank, Competitor info, Qual Seed + Delta badge, Stage Reached, and Game Score Average.
    3. **Tournament Competitor Roster (`/tournaments/:slug/manage/players`):**
       * Handheld list layout keeping player name, playstyle, PB, seed/tier assignment, and action buttons cleanly stacked.
    4. **Global Players Directory (`/players`):**
       * Responsive competitor cards displaying Personal Best (PB), playstyle, active tournament participation, and search/filter controls without squished table headers.
    5. **Other Pages:** General responsive polish across remaining admin, organization, and settings pages.
* **Global Navigation & Breadcrumb Mobile Adaptability:**
  * The global header (`Tournaments` | `Organizations` | `Players`), active tournament teleport chip, and breadcrumb trail currently exceed 360px width, causing wrap overflow and layout displacement on standard mobile devices (e.g., 360×800).
  * **Planned Responsive Solutions:**
    * Implement a compact hamburger menu or mobile tab bar when viewport width $< 768\text{px}$.
    * Collapse breadcrumbs into an icon-only or single-tier `← Back` link on small screens.
    * Dynamically truncate or iconify the active tournament return chip on mobile viewports.

### 11.3 Accelerated Hybrid Layout, Player Journey Highlighting & Operational Polish (Complete)
* **Accelerated Hybrid Multi-Pod Architecture (`ACCELERATED_HYBRID`):**
  * Models competitive structures featuring multiple qualification pods funneling into a single-elimination championship finals bracket (e.g. CTWC Accelerated Hybrid format):
    * **Pod 1 (Accelerated Round):** High-seed qualification gauntlet (seeds 1–16). Compacted canvas with 50% breathing room to eliminate internal scrollbars.
    * **Pod 2 (Upper Bracket):** Pre-Merge Upper bracket (seeds 17–48) divided into Part 1 and Part 2, filling remaining canvas space. Scrollbars only appear when match cards exceed pod boundaries.
    * **Pod 3 (Lower Bracket):** Consolidates Pre-Merge Lower R1, Pre-Merge Lower R2, 2nd Chance, and Play-Offs into a cohesive 4-column panel with emerald theming (`#10B981`).
    * **Championship Tree:** Single-elimination championship tree (Top 16 / Top Cutoff) crowning the tournament champion.
* **Multi-View Pod Adaptability:**
  * **Fit View (`?view=fit`):** Arranges Pod 1, Pod 2, and Pod 3 side-by-side horizontally. Eliminates internal scrollbars on Pod 2 by expanding minimum width allocation by 24px and computing precise 3-pod side-by-side bounding boxes (~2760px $\times$ ~895px) for the `fitScale` transform engine.
  * **Split View (`?view=split`):** Puts Pod 3 to the right of Pod 2 side-by-side. Enabled the "Split Wings" view mode button in `BracketTierBar` for Accelerated Hybrid tiers.
  * **Standard View (`?view=standard`):** Preserves the classic stacked layout with Pod 1 & 2 on the top row and Pod 3 spanning below.
  * **Pod 3 Match Centering:** Horizontally centers matches in Pod 3 across both stacked and side-by-side views via `<div style={{ width: 'fit-content', minWidth: 'max-content', margin: '0 auto' }}>`, guaranteeing equal left and right margins while preserving left-aligned scrolling on smaller screens.
  * **Responsive Collapse:** Automatically collapses `.qualifier-side-by-side-pods` into single-column layouts on viewports $\le 1024\text{px}$.
* **Bracket Competitor Search & Player Journey Highlighting:**
  * Added an interactive competitor search input directly in `BracketTierBar` with auto-complete dropdown suggestions.
  * Resolving or selecting a single competitor immediately activates `highlightedPlayerId`, illuminating their entire journey through all feeder rounds, match nodes, and SVG connector paths while dimming unrelated matches.
  * Clearing the search restores standard viewing.
  * Removed legacy competitor name hover blip animation, and synchronized highlight CSS transitions across lines, borders, backgrounds, and dimmed nodes for instant, lag-free state changes.
* **Match Drawer & Settings Ergonomics:**
  * **Match Drawer Isolation:** Constrained top accent gradient bar strictly to drawer width; applied clean solid surface backgrounds (`var(--color-bg-surface-elevated)`) to the drawer title header and footer action bar; preserved vibrant gradient styling exclusively for the matchup score section (`MatchupBanner.tsx`).
  * **Telemetry Modal Decluttering:** Removed "first to" label and playstyle chips on read-only match telemetry views (`MatchTelemetryModal.tsx`).
  * **Settings Ergonomics:** Inline "Apply" button and "Inherit Organizational Theme" checkbox in theme settings; removed redundant empty overrides banner; right-aligned "Qualifier Attempts" and "Recorded Matches" telemetry badges in the settings header.
  * **Search Input Unification:** Standardized competitor search input size, padding, icons, and alignment across Standings and Qualifiers pages.
### 11.4 Double-Elimination Flat Staged: 2-Wide & Uneven Fields (Deferred)
* **Current behavior:** `FLAT_STAGED` offers 4 or 8 wide. Seeds enter in waves of exactly W, so the field must be a multiple of W, except fields of at most 2W, which silently fall back to a traditional double-elim tree. Widths under 4 always fall back to traditional. Invalid setups (e.g. 9 players at 4 wide) are blocked in Settings with an explanation via `getDoubleEliminationConfigError()` instead of crashing the page.
* **To revisit:**
  * **True 2-wide flat staged** for even fields (10, 12, 14…). Needs a new endgame: the current finish ("Top 6 cross-drop" against winners semifinal losers) assumes W ≥ 4.
  * **Silent traditional fallback:** decide whether to warn when a flat staged tier will actually render as a traditional tree (e.g. 9 players at 8 wide).
  * **Odd / uneven fields** can never fill equal waves without byes, which are never playable matches (Section 4.1). Traditional tree remains the answer for these unless a ragged-wave design is specified.

### 11.5 Tournament ↔ Organization Association (Deferred)
* **Current behavior:** a tournament's org can already be changed in Manage → Settings ("Parent Organization Circuit"). No schema change or data migration is needed; org dashboards and metrics read `tournaments.organization_id` live.
* **Known issues:**
  * No "None (Independent)" option in the Settings dropdown or the Create Tournament modal once any org exists, so tournaments can't be created independent or detached from an org.
  * For an org-less tournament, the Settings form initializes to the *first* org (`TournamentAdminForm` `organizationId` state), so saving any unrelated setting silently attaches it to that org.
  * Tournament Admins can change their tournament's org through the full-tournament save; there is no org-admin approval.
* **Side effects of attaching to an org:** Discord qual announcements fall back to the org's webhook when the tournament has none; org branding applies if "Inherit Organizational Theme" is on. Slugs/URLs, qual rules, players, and scores are unaffected.
* **Decisions pending:** who may change a tournament's org (recommendation: System Admin only, read-only for Tournament Admins); whether "Independent" should be selectable at creation and for detaching; a pre-save notice summarizing the side effects when the org changes.
