# MatchFoundry Testing Strategy

MatchFoundry runs live tournaments, where a broken bracket, a wrong tiebreaker, or an auth hole disrupts a real event. Tests exist to catch those before they ship, and they have to stay fast enough to run on every change.

---

## 1. Ground Rules

1. **Every bug fix ships with a regression test.** Write the test so it fails on the buggy behavior, then make it pass with the fix. A fix without one isn't done.
2. **Cover every bracket format the change touches.** Single Elimination, Traditional Double Elimination, Flat Staged Double Elimination, and Accelerated Hybrid behave differently. Also cover tier switching and stage/round filter combinations when relevant.
3. **Edge cases belong in Vitest, not Playwright.** Playwright only proves the main paths work end to end.
4. **Unit tests passing doesn't prove the schema works.** pg-mem is not PostgreSQL. Schema changes also need `npm run db:push` against the local Docker database.

---

## 2. The Four Tiers

### Tier 1: Pure Logic (Vitest)
* **What:** Bracket generation and routing (`src/features/bracket/math/`), layout math, tiebreakers and standings, qualifier scoring, authword generation, session derivation, PIN crypto.
* **How:** Import the function, call it, assert on the result. No database, no rendering, no mocks.
* **Keep logic here when you can.** If a component makes a decision (what status to show, whether a button is enabled), pull that decision into a pure function and test the function. `sessionDerivation.ts` and `onlineQualsStatus.ts` are examples.

### Tier 2: API, Database & Component Output (Vitest)
* **Database:** `setupTestDb()` from `src/db/testDb.ts` creates a fresh in-memory pg-mem database. Pass it to `setDb()` in `beforeEach` so each test starts clean.
  * **`testDb.ts` defines its tables in hand-written SQL, separate from `schema.ts`.** When you add or change a column in `schema.ts`, make the same change in `testDb.ts`, or tests will run against an outdated schema.
* **API:** Build the real middleware with `createApiMiddleware()` and call it with mock request/response objects (`createMockReq` / `createMockRes` helpers in the test file). Authenticate with `createSessionToken({ role, tournamentId })`. See `src/features/online-quals/__tests__/runLinksAndCleanup.test.ts` for a complete example.
* **Recovery PIN in tests:** Set `process.env.SYSTEM_ADMIN_RECOVERY_PIN` to an obviously fake value (e.g. `'999999'`) in the test. Never use a real PIN.
* **Components:** Vitest runs in a Node environment with no DOM, and React Testing Library is not installed. Render with `renderToStaticMarkup` from `react-dom/server` and assert on the HTML (text present or absent, `data-testid` attributes). Pass `vi.fn()` for callbacks. This checks what a component renders for a given state, not click behavior; test the logic behind clicks in Tier 1.

### Tier 3: Golden User Journeys (Playwright)
* **What:** A small number of end-to-end paths through a real browser, the real Vite dev server, routing, auth gates, and the API. Currently 5, all in `e2e/golden-journeys.spec.ts`. Add a journey only for a new, critical user path, not for variations of an existing one.
* **Overlay tests run alongside them.** `e2e/overlays.spec.ts` (4 tests) checks overlay dismissal in the same `chromium` project, but serves the app from the Tier 4 mocked fixtures instead of the database. `test:e2e` regenerates those fixtures first.
* **Requirements:**
  * Local Docker PostgreSQL running with the current schema (`npm run db:up`, `npm run db:push`). No seed data is needed.
  * `.env` with `DATABASE_URL` and `SYSTEM_ADMIN_RECOVERY_PIN`. `playwright.config.ts` loads `.env`; the suite stops immediately if the PIN is missing.
* **It builds its own data.** Before the journeys run, `e2e/support/testTournaments.ts` logs in through the API with the recovery PIN, deletes every tournament whose slug starts with `e2e-` and every player whose name starts with `E2E_` (leftovers from an aborted run), creates one `E2E_` player so the player directory isn't empty, and creates three fresh tournaments: `e2e-alpha-<run>` and `e2e-bravo-<run>` (unlocked, one Gold tier) and `e2e-charlie-<run>` (unlocked, HYBRID, online qualifying open). Afterwards it deletes them again. The journeys never read or change any other tournament, so they pass on any local database in any state. New journeys must follow the same rule: create what they need through the API and use the slugs the helper returns, never a hardcoded seeded slug.
* **It writes to the database.** Only run it against the local database, never with production environment variables.
* **Dev server:** Playwright starts `npm run dev`, or reuses one already running on port 5173.
* **CI:** the `Golden Journeys (Playwright)` job runs it on every pull request against a throwaway PostgreSQL service container that starts empty. Run it locally too before calling a milestone done.
* **Headless only.** Use `npm run test:e2e` (regenerates the visual fixtures, then `playwright test --project=chromium`); don't use interactive browser agents.

### Tier 4: Visual Regression (Playwright screenshots)
* **What:** 18 screenshots compared against committed baselines in `e2e/visual/__screenshots__/`: 8 pages (landing, bracket, leaderboard, standings, judge, manage qualifiers, review, settings) at desktop 1440×900 and mobile 360×800, plus 2 desktop-only overlays (match score drawer, qualifier entry modal). Specs are in `e2e/visual/visual.spec.ts`.
* **How:** Every `/api/*` request is mocked from the JSON files in `e2e/visual/fixtures/` (`e2e/visual/mockApi.ts`), and the browser clock is frozen, so a screenshot changes only when the rendering changes. A test also fails if the page requests an endpoint the mock doesn't cover.
* **Fixtures are generated in code.** `scripts/generateVisualFixtures.ts` runs the real API middleware against an in-memory pg-mem database, builds the sample tournament with `simulateSampleTournament()`, and seeds randomness, UUIDs and the clock, so every run writes identical files. No database, `.env` or seed data is needed. `test:visual`, `test:visual:update` and `test:e2e` regenerate the fixtures before every run. The fixtures are gitignored; only the screenshot baselines are committed.
* **Local only.** It is not part of `npm test` or CI.
* **Baselines:** only the coordinator runs `npm run test:visual:update`, after reviewing every failing diff in `test-results/`.

---

## 3. The Golden Journeys

1. **Public Spectator:** From `/` with no login, privileged actions are hidden; "Live Brackets" on the alpha tournament opens the bracket with no auth prompt; the breadcrumb returns to `/`.
2. **Route Gating & Recovery PIN:** A logged-out visit to `/:slug/manage/settings` redirects to `/admin?redirect=...`; the recovery PIN from `.env` unlocks System Admin and returns to the target page; `/organizations` and `/` work without another prompt.
3. **Tournament Admin Isolation:** System Admin sets a tournament PIN and logs out; logging in with that PIN opens only that tournament's management pages; `/organizations` and `/players` are hidden and redirect to `/admin` if visited directly; `/` shows "Your Managed Tournament".
4. **Shared Tournament PIN:** The same PIN set on two tournaments triggers a shared-PIN warning; logging in once with it unlocks both, and the tournament switcher lists only those two.
5. **Online Qualifier & Review:** A competitor checks in on the charlie tournament's `/:slug/qualify`, completes the pre-flight checklist, gets an Authword, submits scores and a VOD link, and appears on the leaderboard as awaiting verification; an admin verifies the run in the review queue, and the public leaderboard shows it as verified.

---

## 4. Where Tests Go

Put tests in a `__tests__/` folder next to the code they cover (`src/features/<feature>/__tests__/`, `src/server/__tests__/`, `src/api/__tests__/`, `src/routes/__tests__/`, `src/components/__tests__/`). Name files after the behavior under test (e.g. `dqReversibility.test.ts`). Use `.test.tsx` only when the file renders components.

---

## 5. Commands

| Command | Runs | When |
| :--- | :--- | :--- |
| `npx vitest run <file>` | One test file | While working on a change |
| `npm run test:brackets` | `src/features/bracket` | Bracket math or layout changes |
| `npm run test:api` | `src/api`, `src/server` | API, auth, or database changes |
| `npm run test:ui` | `src/components` and the tournament, qualifiers, players, organizations, and online-quals features | UI or feature changes |
| `npm run typecheck` | `tsc --noEmit` | Every code change |
| `npm test` | Full Vitest suite | Before finishing a milestone |
| `npm run test:e2e` | Playwright golden journeys and overlay tests (`--project=chromium`) | Before finishing a milestone (local only) |
| `npm run test:visual` | Visual regression screenshots against the baselines | Styling or layout changes (local only) |
| `npm run test:visual:update` | Regenerates the screenshot baselines | Coordinator only, after reviewing the diffs |
| `npm run visual:fixtures` | Regenerates `e2e/visual/fixtures/` from code | Run automatically by `test:e2e`, `test:visual` and `test:visual:update` |
| `npm run db:push` | Schema against local PostgreSQL | Any `schema.ts` change |

Documentation-only changes need no tests.

---

## 6. CI

`.github/workflows/ci.yml` on pull requests:
1. `Typecheck & Test Suite`: `npm run typecheck` and `npm test` (pg-mem; no database server needed).
2. `Golden Journeys (Playwright)`: `npm run test:e2e` against a throwaway PostgreSQL service container (Tier 3).
3. `Deploy to Vercel`, after job 1 passes: build, schema push to the Neon preview branch, preview deploy.

On merge to `main` only the deploy job runs (production schema push and deploy); the tests already passed on the PR. See [DEPLOYMENT_PLAYBOOK.md](DEPLOYMENT_PLAYBOOK.md).
