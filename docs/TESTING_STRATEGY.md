# Testing Strategy & Quality Assurance Architecture

## 1. Executive Summary & Core Philosophy

The Tournament Manager application serves high-stakes live competitive tournaments where downtime, authorization loopholes, or broken tournament brackets disrupt real events. 

To ensure stability across both active development and continuous integration (CI/CD), our testing strategy is anchored by two foundational tenets:

1. **The Walking Skeleton Principle**: Isolated unit tests alone do not prove a feature works for actual humans. Before declaring any feature or milestone complete, the end-to-end "walking skeleton" of the application (navigation, authorization gates, session persistence, routing, and UI presentation) must be verified through automated golden journeys.
2. **Deterministic Speed & Agent Ergonomics**: Test suites must run in seconds, not minutes. High-frequency tests remain 100% in-memory (using `pg-mem` and `vitest`), while end-to-end testing is reserved for a compact, ultra-fast suite of 3–5 headless Playwright journeys running against Vite's dev server in under 6 seconds.

---

## 2. The 3-Tier Testing Pyramid

```
                ▲
               / \
              /   \
             / E2E \       Tier 3: Golden User Journeys (Playwright CLI)
            /-------\      3-5 high-value end-to-end user workflows (~5s)
           /         \
          /   Integ   \    Tier 2: Component & Relational Integration (Vitest + RTL)
         /-------------\   State machines, drawers, forms, pg-mem schema checks (~2-4s)
        /               \
       /    Unit / Math  \ Tier 1: Mathematical & Algorithmic Correctness (Vitest)
      /-------------------\ Bracket pairings, tiebreakers, crypto, rank derivation (~1-2s)
```

### Tier 1: Unit & Algorithmic Tests (`vitest run src/features/bracket`)
- **Scope**: Bracket generation algorithms (`traditional.ts`, `flat.ts`, `double-elimination.ts`), tiebreaker math, rank derivation, round-specific best-of override resolution, cryptographic token generation (`pinCrypto.ts`).
- **Characteristics**: Pure functions, zero network/browser mocks needed, instantaneous (<2 seconds).
- **Execution**: Run automatically during active iteration on algorithms or bracket rules.

### Tier 2: Integration & Composed Page Tests (`vitest run src/components src/features/tournament src/api`)
- **Scope**: Multi-component interaction flows, form state dirty tracking, verification modals, drawer lifecycle, API middleware route validation with in-memory PostgreSQL (`pg-mem`).
- **Characteristics**: Fast, isolated in-memory execution using React Testing Library and JSDOM. Tests verify that components obey the 3-Tier UI Pattern (Route Gate $\rightarrow$ Keyed Feature View $\rightarrow$ Pure Presentational Leafs).
- **Parity Guard**: Unit tests in `pg-mem` do not replace PostgreSQL schema migration validation. Drizzle schema changes must also be validated against real Docker PostgreSQL with `npm run db:push`.

### Tier 3: Golden User Journeys (`npm run test:e2e` / Playwright)
- **Scope**: End-to-end smoke testing of complete user journeys exercising the real Vite dev server, client-side routing (`react-router-dom`), browser storage (`localStorage`), HTTP API middleware (`/api/*`), and real session headers.
- **Constraints**:
  - Keep this tier strictly focused on **3 to 5 mission-critical paths** (not dozens of redundant permutation tests).
  - Use headless Playwright via CLI (`npx playwright test`).
  - Strict rule: **Never spin up interactive browser subagents** (which burn context tokens and timeout). Headless Playwright CLI runs deterministically in ~5 seconds.

---

## 3. The Three Golden User Journeys

The golden journeys codified in [`e2e/golden-journeys.spec.ts`](file:///Users/jgrondski/src/repos/tournament-manager/e2e/golden-journeys.spec.ts) represent the primary user archetypes:

### Journey 1: Public Spectator (Zero Friction)
- **Goal**: Ensure the public broadcast experience is seamless, frictionless, and completely free of login prompts.
- **Path**:
  1. Unauthenticated spectator visits `/`.
  2. Public directory displays all active tournaments.
  3. Privileged actions ("Create New Tournament", "Simulate Tournament") are strictly hidden.
  4. Spectator clicks "Live Brackets" on `omen-open` $\rightarrow$ lands directly on the live bracket view with zero auth prompts or blocking modals.
  5. Spectator clicks `← All Tournaments` breadcrumb $\rightarrow$ returns smoothly to `/`.

### Journey 2: Security Route Gating & Emergency Recovery PIN
- **Goal**: Guarantee that unauthorized attempts to access protected management views are caught by route guards and can be reliably recovered via the immutable `.env` recovery key.
- **Path**:
  1. Logged-out visitor attempts to access `/:slug/manage/settings` directly.
  2. `RequireTournamentAdmin` route gate triggers and bounces visitor to `/admin?redirect=...`.
  3. Visitor enters `SYSTEM_ADMIN_RECOVERY_PIN` (`!Te67Omentris69420!`).
  4. Visitor clicks "Unlock Administration" $\rightarrow$ redirected back to the exact target settings page with full System Admin capabilities.
  5. System Admin navigates to `/organizations` and `/` without re-prompting.

### Journey 3: Delegated Tournament Admin Scoped Isolation
- **Goal**: Confirm that tournament directors can safely delegate management of a single tournament to local organizers while strictly isolating all other tournaments and global administrative controls.
- **Path**:
  1. System Admin sets and encrypts a new Tournament PIN for `omen-open` in Settings.
  2. System Admin logs out $\rightarrow$ route guard immediately secures the management screen and redirects to `/admin`.
  3. Tournament Admin logs in with the scoped tournament PIN.
  4. Tournament Admin accesses `omen-open` management portal.
  5. Global admin links (`/organizations`, `/players`) are completely hidden.
  6. On `/`, a dedicated **"Your Managed Tournament"** section displays only their tournament in admin mode.
  7. Attempting to directly navigate to `/organizations` bounces back to `/admin` requesting System Admin authorization.

---

## 4. Verification Command Matrix

| Command | Purpose | Target Speed | When to Run |
| :--- | :--- | :--- | :--- |
| `npm run test:brackets` | Math, bracket trees, tiebreakers | ~1–2s | Active bracket feature work |
| `npm run test:api` | Relational integrity, auth endpoints | ~3–5s | API or database changes |
| `npm run test:ui` | Components, forms, drawers, navigation | ~2–3s | UI component changes |
| `npm run test:e2e` | Playwright 3 Golden Journeys | ~5–6s | Pre-completion milestone validation & CI |
| `npm run typecheck` | TypeScript compilation (`tsc --noEmit`) | ~1–2s | Every code modification |
| `npm test` | Full Vitest test suite | ~6–8s | Pre-commit / Milestone completion |

---

## 5. CI/CD Pipeline Parity

In CI/CD environments (GitHub Actions, GitLab CI), tests run sequentially to prevent resource contention:

```yaml
# Example CI Step
- name: Run Quality Verification Suite
  run: |
    npm run typecheck
    npm test
    npm run test:e2e
```

- **Database**: Vitest tests run against `pg-mem`, which requires no active PostgreSQL server in CI.
- **Playwright**: Uses Vite's built-in dev server orchestration configured in `playwright.config.ts` (`webServer.command: "npm run dev"`, `reuseExistingServer: true`).
