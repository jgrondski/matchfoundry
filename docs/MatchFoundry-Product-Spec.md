# MatchFoundry Product Spec

How MatchFoundry works: the tournament rules it enforces and how each shipped feature behaves. This is reference material, not a roadmap. For status, upcoming phases, and the deferred backlog, see [implementation_plan.md](implementation_plan.md). The database schema lives in `src/db/schema.ts`.

---

## 1. Product Overview
A web-based bracket and leaderboard manager built for competitive gaming tournaments (modeled on Classic Tetris tournament standards). The application provides real-time reactive updates, retro OBS overlays, customizable qualifying formats (High Score, Average of X, Points), flat and traditional bracket routing, double-elimination brackets with grand finals resets, global organization management with raw player metric indexing, self-service online qualifiers with Twitch OAuth and NES authwords, and mobile-responsive match recording for floor judges.

The system prioritizes human readability, deterministic rules, minimal runtime overhead, and zero over-engineered dead code for rare edge cases.

---

## 2. Directory Structure (Strict Feature-Driven)
* `/src/features/bracket/` – Bracket trees, mathematical routing, node state, match score drawers, double-elimination routing & reset.
* `/src/features/organizations/` – Global organization directory, org profile, org branding & defaults.
* `/src/features/qualifiers/` – Score submission, dynamic leaderboard sorting, tier cutoff assignments, competitor detail drawer.
* `/src/features/online-quals/` – Authword engine, competitor self-service portal, review queue, Discord webhook messages.
* `/src/features/tournament/` – Admin setup forms, tier configuration (priority order, width, cutoffs, colors, elimination type), global standings.
* `/src/features/players/` – Global player directory and tournament roster registration.
* `/src/routes/` – Top-level page routes (`/organizations`, `/org/:orgSlug`, `/:slug/qualify`, `/:slug/manage/*`, `/:slug/obs/*`).
* `/src/components/` – Shared UI components (inputs, modals, buttons, table wrappers, top-level navigation tabs).

---

## 3. Universal Invariants & Exact Mathematical Rules

### 3.1 Bye Handling & Match Invariant
* **Single Elimination:**
  $$\text{total\_matches} = N - 1$$
* **Double Elimination:**
  $$\text{total\_matches} = 2N - 2 \quad (\text{or } 2N - 1 \text{ if Grand Finals Reset occurs})$$
* Byes are never represented as playable matches and never accept scores.
* Players receiving byes are placed directly into their calculated entry round:
  $$\text{entry\_round} = \text{total\_byes\_for\_seed} + 1$$
* **Double Elimination Bye Drops:** A player receiving a bye in Winners Round 1 who loses in Winners Round 2 drops into Losers Round 2 (never into Losers Round 1, preventing double-punishing bye recipients).
* Any node awaiting a feeder or bye recipient initializes with `player2_id: null`. Matches appear in score entry interfaces only when both competitors are confirmed.

### 3.2 Tier-Relative Seeding
* Leaderboard ranks must be normalized relative to the tier before passing to the bracket generator:
  $$\text{tier\_seed} = \text{global\_rank} - \text{tier\_start\_rank} + 1$$
* *Example:* In a 12-player Silver tier composed of leaderboard ranks 13 through 24, Rank 13 becomes Seed 1, Rank 14 becomes Seed 2, through Rank 24 becoming Seed 12.

### 3.3 Exact Tiebreaker Mathematical Formulas

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

#### 3. Points Qualifier Tiebreaker:
* Players with 0 points are deterministically tiebroken by highest single game score (`peakScore`).

#### 4. Competitive Intra-Round Exit Tiebreaker (Final Standings):
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

#### 5. Global Standings Sequential Ranking (#1 to #N):
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

### 3.4 Personal Best (PB) Updates
* `player.personalBest` is strictly a manual field edited via the player management form. Match and qualifier scores must never auto-mutate this value.

### 3.5 Tournament Modes & Lifecycle
1. **Mode Terminology:**
   * Modes are **"Qualifiers Mode"** and **"Match Play Mode"**.
   * On `Tournament`, stored as `isLocked: boolean` (`false` = Qualifiers Mode, `true` = Match Play Mode).
2. **Qualifiers Mode (`isLocked === false`):**
   * Leaderboard accepts qualifier submissions and dynamically previews bracket seeding.
   * Match cards across all views are non-clickable.
3. **Lock Brackets & Begin Match Play (`isLocked === true`):**
   * Double-confirmation modal freezes seeds and instantiates static match records.
   * All qualified players automatically flip to `verified`.
4. **Unlock Rule (Safety Invariant):**
   * Reverting back to Qualifiers Mode is permitted **only if exactly 0 match scores have been recorded**.
   * Clearing qualifiers is forbidden while match scores exist ("Clear Matches" first).
5. **Modal & Drawer Dismissal Safety:**
   * Pop-ups and side drawers that only show information, and confirmation prompts, close when you click or tap outside them or press Escape. A form with unsaved changes asks first ("Discard unsaved changes?" with Keep Editing and Discard Changes) before closing by outside click, Escape, `X`, or Cancel; an outside click or Escape on that prompt keeps editing. Nothing closes while a save is in progress, and a successful Save closes the form without asking.

---

## 4. Feature Reference

### 4.1 Qual Board, Qualifier Status & Simulation
* **Bracketless Tournaments:** Tournaments can be created with 0 tiers (`tiers: []`). Organizers can register competitors and log qualifiers immediately.
* **Adaptive Qual Board:** When `tiers.length === 0`, `LeaderboardTable` renders as a pure qual board (no Bracket Seed column, tier cutoffs, or tier tints) and no one is marked DNQ. Once tiers are added in Settings, the full bracket-seeding leaderboard view activates, and the top qualifiers reactively populate the new tiers.
* **Qualifier Status:**
  * `'not started'` (0 attempts), `'in progress'` (1+ attempts, unverified), `'awaiting verification'` (online run submitted), `'verified'` (confirmed by a judge or admin).
  * Status badges render in `LeaderboardTable` and `PlayerDetailDrawer`.
* **Leaderboard Source Filters:** `[All]`, `[In-Person]`, `[Online]`, `[Awaiting Verification]`.
* **Format-Dense Columns:** `LeaderboardTable` adapts its columns to `HIGH_SCORE`, `AVERAGE_OF_X` (exactly X score fields), and `POINTS`.
* **Player Detail Drawer:** Competitor profile, chronological qualifier submission audit log, and match breakdown.
* **Data Management & Simulation (System Admin only):** "Seed Qualifiers Only" (bracket capacity + 4 DNQs), "Simulate Full Tournament" (complete match outcomes to champions), and "Clear All Tournament Data" (behind a confirmation speedbump).

### 4.2 Organizations
* **Entity:** `slug`, `name`, `description`, `logoUrl`, `website`, `brandColor`, `discordWebhookUrl` (inherited by tournaments that don't set their own), and `defaultRules` (`qualFormat`, `qualAverageCount`, `qualWindowMinutes`, `bestOf`, `primaryColor`, `secondaryColor`).
* **Association:** `tournaments.organizationId` is nullable; independent tournaments are allowed. (Known issues with changing or detaching a tournament's org are tracked in the plan's backlog.)
* **Navigation:** Top-level tabs `[ Tournaments ] | [ Organizations ] | [ Players ]`.
  * `/organizations`: directory of org cards with total tournaments, total registered competitors, logo, and quick actions.
  * `/org/:orgSlug`: org header, branding & default tournament rules, org-level Discord webhook, and hosted tournaments with status badges.
* **Branding Inheritance:** "Inherit Organizational Theme" toggle in tournament Settings. When off, the tournament sets its own colors without altering org defaults.
* **Raw Metric Indexing:** Every score submission, match record, and roster entry associates `(organizationId, playerId, tournamentId)` for org-specific and career player stats.

### 4.3 Double Elimination
* **Tier Types:** `bracketType: 'TRADITIONAL' | 'FLAT'`, `eliminationType: 'SINGLE' | 'DOUBLE'` (default `'SINGLE'`). Double-elim layouts use `BracketRouting`: `'TRADITIONAL'` (also `'TRADITIONAL_TREE'`), `'FLAT_STAGED'`, `'ACCELERATED_HYBRID'`.
* **Winners Bracket:** Routes identically to Traditional/Flat single elimination.
* **Losers Bracket:**
  * Losers from Winners R1 drop into Losers R1 with crossover seeding to prevent early rematches.
  * Losers from Winners R2 drop into Losers R2 (or R3 depending on bracket size) to face surviving winners from earlier loser rounds.
  * Cascading logic applies identically whether Round 1 is Traditional or Flat.
* **Grand Finals & Dynamic Reset:**
  * Grand Finals Match 1: Winners Bracket Champion vs. Losers Bracket Champion.
  * If the Winners Bracket Champion wins Match 1, the tier is complete.
  * If the Losers Bracket Champion wins Match 1, the system instantiates **Match 2 (Grand Finals Reset)**.
* **Stage-Specific Round Overrides:** Best-of overrides keyed by stage: `'W1'`, `'W2'`, `'L1'`, `'L2'`, `'GF'`, `'GF_RESET'`. Match 2 uses `GF_RESET`, falling back to `GF` and then the tier default.
* **Standings:** Ranked by Losers bracket exit round (see 3.3 #5); ties within a round use the exit tiebreaker.
* **Canvas Layout:** Winners tree on top, Losers tree below, Grand Finals centered on the right.
* **Flat Staged Limits:** `FLAT_STAGED` supports 4 or 8 wide. The field must be a multiple of W, except fields of at most 2W, which fall back to a traditional tree. Invalid setups are blocked in Settings with an explanation via `getDoubleEliminationConfigError()`.

### 4.4 Accelerated Hybrid Layout
Models multiple qualification pods funneling into a single-elimination championship bracket (e.g. the CTWC Accelerated Hybrid format):
* **Pod 1 (Accelerated Round):** High-seed qualification gauntlet (seeds 1–16).
* **Pod 2 (Upper Bracket):** Pre-Merge Upper bracket (seeds 17–48), split into Part 1 and Part 2.
* **Pod 3 (Lower Bracket):** Pre-Merge Lower R1, Pre-Merge Lower R2, 2nd Chance, and Play-Offs in one 4-column panel with emerald theming (`#10B981`).
* **Championship Tree:** Single-elimination Top 16 / Top Cutoff tree crowning the champion.
* **View Modes:** Fit (`?view=fit`, pods side by side), Split (`?view=split`, Pod 3 beside Pod 2), Standard (`?view=standard`, Pods 1 & 2 on top, Pod 3 below). Pods collapse to a single column at $\le 1024\text{px}$.

### 4.5 Direct / Manual Seeding
* **Configuration:** `seedingMethod: 'QUALIFIERS' | 'MANUAL'` (default `'QUALIFIERS'`) and `manualSeeds?: string[]` (ordered player IDs; index 0 = Seed 1). When `MANUAL`, qualifier format settings are hidden. Switchable in Qualifiers Mode, locked once match play begins.
* **Bulk Import (`BulkSeedImportModal.tsx`):**
  * Multiline paste. The parser strips line numbers, ranks, bullets, and hashes (`1. `, `1) `, `#1 `, `- `, `1 - `), trims whitespace, and drops empty lines.
  * Each name resolves against the tournament roster, then the global player directory (importing PB, country, and playstyle), and otherwise creates a new player and registers them.
  * Line order defines seed order.
* **Seeding Manager (`ManualSeedingManager.tsx`, `/:slug/manage/seeding`):**
  * Colored tier divider bars across the seed list (e.g. Seeds 1–16 Gold, 17–32 Silver, 33+ Reserves).
  * Drag-and-drop; Move Up / Down / Top / Bottom buttons; "Set Seed Number" jump; Randomize (with confirmation); Reverse.
  * "+ Add Competitor" autocomplete from the global directory.
* **Bracket Generation:** In manual mode `generateDraftBracketsForTournament` skips the leaderboard and distributes `manualSeeds` into tiers by capacity, normalized per tier (3.2). Visualizer, card feed, and sheet update reactively.
* **Standings:** Initial seed comes from `manualSeeds`; `rankDelta = initialSeed - finalRank`.
* **Simulation:** "Seed Qualifiers Only" becomes "Generate Realistic Seeding".

### 4.6 Online Qualifiers
* **Qual Modes:** `qualMode: 'IN_PERSON' | 'ONLINE' | 'HYBRID'`. In-person scores (via `QualifierEntryModal`) save as `IN_PERSON` and pending review (`SUBMITTED`); portal scores save as `ONLINE` and `SUBMITTED` (awaiting verification).
* **Competitor Journey (`/:slug/qualify`):**
  1. Competitor connects Twitch (OAuth 2.0). Unmatched accounts choose to claim a pre-registered roster profile or register a new alias; neither blocks starting a run.
  2. Pre-flight modal confirms the stream is live and "Store past broadcasts" is enabled.
  3. Starting a run assigns an NES Authword and issues a private run link (token). The competitor is added to the roster only on submit.
  4. Competitor scores $\ge 10,000$, tops out intentionally, and enters the Authword on the NES high-score name screen.
  5. Competitor enters score(s) and the Twitch VOD URL and submits. The run appears on the leaderboard immediately as `awaiting verification`.
* **Run Recovery:** Drafts autosave by token and restore by run link, or by name + Twitch account. Competitors can discard an unfinished run (a player record the run created is removed with it); submitted runs cannot be discarded. Unfinished runs are hidden from the leaderboard and don't block roster removal or player deletion. Runs more than an hour past their window are flagged as abandoned. Tokens and drafts are never exposed in public data.
* **Identity Resolution:**
  * `VERIFIED_MATCH`: `players.twitch_id` matches the session; auto-linked.
  * `CLAIMED_PENDING_REVIEW`: competitor claimed an existing roster profile; a judge ratifies.
  * `PROVISIONAL_NEW`: a new competitor with a new alias, country, and playstyle; a judge promotes them to a global player.
* **Authword Engine:**
  * 6–8 characters from the NES high-score charset: `A–Z`, `0–9`, `.`, `-`, `!`, `♥`. Spaces are forbidden (`/^[A-Z0-9.\-!♥]{6,8}$/`).
  * Built-in curated list of family-friendly words ($\ge 6$ letters), merged with tournament `customAuthWords`.
* **Qualifying Timer:** A tournament-wide qual window timer (`qualWindowMinutes`) that admins can run and pause; it hides once quals close or brackets lock. It is non-blocking: expiry never disables submission. Per-run timing is recorded in `timer_log` (`QualTimerLog`: `startedAt`, `submittedAt`, `elapsedSeconds`, `pauses`).
* **Review Queue (`/:slug/manage/review`):**
  * Sidebar badge with the count of pending online submissions.
  * Shows Twitch handle, a link to the VOD, the assigned Authword, and timer telemetry.
  * Actions: Save (scores and notes, with a score-edit audit line in `judge_notes`; does not change status), Verify Qual (becomes Save & Verify when there are unsaved edits; disabled when the qual has no scores), Unverify (verified quals only; returns to pending), Mark DNQ, Disqualify (DQ), plus identity actions (Confirm Identity Binding, Reassign to a different player, Promote to Global Player). A verified qual is locked: its scores, attempts and notes can't change and it can't be DNQ'd, DQ'd, reassigned or removed from the roster until it is unverified.
  * Each competitor has one qual per tournament (`qualifier_runs`); scores are child rows, so a qual remains (with zero scores) when every score is removed.
  * Reassigning a qual to a player who already has one: if that player's qual has no scores (and is neither verified nor in progress) it is replaced; otherwise the reassignment is refused, and the reconcile dialog marks those players and says why (remove their scores, remove them from the roster, wait for or discard their run, or unverify first).
  * Identity badges: "New Player" marks a run that created a new player record (not found in the player list); "Claimed" marks a claimed roster profile awaiting a judge. No badge otherwise.
* **Closing Quals:** Closing qualifiers with unverified submissions requires confirmation. Once closed, `/:slug/qualify` shows "Qualifying Closed" and draft seeding includes every player with at least one score except DNQ and DQ; unverified scores are seeded provisionally.
* **Discord Webhooks:** Optional posts on qual start, submit, and verify. A tournament without its own webhook falls back to its org's.

### 4.7 Public Spectator Views vs. Management App
* **Public Spectator (`/:slug/*`, `SpectatorLayout`):** No login, no admin sidebar, `canManage={false}`.
  * `/:slug/brackets`, `/:slug/:tierSlug` – Live bracket tree, split wings, or mobile card feed.
  * `/:slug/leaderboard` (`/:slug/quals` shortcut) – Read-only qualifier rankings.
  * `/:slug/standings` – Read-only final standings.
  * `/:slug/qualify` – Online qualifier portal.
  * Clicking a match opens the read-only `MatchTelemetryModal` (series score, game-by-game breakdown, intentional topouts, profile links).
* **Management App (`/:slug/manage/*`, `TournamentLayout`):** PIN-gated (Tournament Admin or System Admin).
  * `bracket` / `bracket/:tierSlug` (interactive tree; matches open `MatchScoreDrawer`), `qualifiers`, `seeding`, `review`, `standings`, `sheet` (organizer matrix), `judge` (floor judge station), `players` (roster), `settings`.
* **Access Tiers:** System Admin (all orgs, global player directory, PIN reveals, simulation and destructive data controls; emergency `SYSTEM_ADMIN_RECOVERY_PIN`) and Tournament Admin (scoped to their tournament). Tournament PINs are stored AES-256-GCM encrypted.
* **Bracket View Modes:** Standard (pan/zoom), Fit Screen (1080p zero-scroll), Split Wings (bilateral wings converging on the Finals), Card Feed (`MatchCardFeed`, default below 768px).
* **Player Journey Highlighting:** Competitor search in `BracketTierBar` highlights a player's full path (matches and connector lines) and dims the rest.
* **Sharing:** "Share Bracket" (`ShareBracketModal.tsx`): canonical URL copy, QR code, Twitch `!bracket` and Discord snippets, share to X.

### 4.8 OBS Broadcast Overlays (`/:slug/obs`)
* Full-bleed canvases with chroma key presets (Green, Magenta, Blue, Transparent), 1080p zero-scroll auto-fit, and split wings.
* Bracket and match-card overlays (`ObsBracketView.tsx`, `ObsMatchCardView.tsx`) render projected draft brackets before match play is locked.
* Orthogonal SVG connectors link feeder matches to downstream rounds (`BracketVisualizer.tsx`, `bracketLayout.ts`).
