# CLAUDE.md: Tournament Manager Operational Handbook

## 0. Git Branching & Operational Safety (Main Branch Precondition)
- **Always Start on `main`**: When asked to start making changes, ALWAYS verify that the current branch is `main`. If the repository is NOT on `main`, STOP immediately and ask the user for confirmation before touching any files.
- **Strict Git Boundaries (Zero Autonomous Branching, Commits, or Pushing)**:
  - NEVER create branches (`git branch`, `git checkout -b`, `git switch -c`). The user chooses all branch names and decides when/if to branch.
  - NEVER commit changes (`git commit`). All changes must remain strictly uncommitted in the working tree for user inspection.
  - NEVER push changes (`git push`). Remote pushing is completely prohibited.

## 1. Operating Environment & Cross-Platform Compatibility
- **Cross-Platform Parity**: Code and scripts MUST run identically on Windows (PowerShell) and macOS/Linux (Bash/Zsh).
- **Paths**: Never compare `import.meta.url === file://${process.argv[1]}` directly (fails on Windows slashes). Always normalize paths with `.replace(/\\/g, '/')`.
- **Database Connection**: Docker PostgreSQL runs on port 5433 (`POSTGRES_PORT=5433` in `.env`). Standalone Node scripts must invoke `process.loadEnvFile()` if `process.env.DATABASE_URL` is empty. Never hardcode port 5432.
- **Shell Syntax**: Avoid bash-specific pipes (`||`, `&&`, `rm -rf`, `export`) in instructions intended for PowerShell. Keep npm scripts cross-platform.

## 2. Token & Credit Efficiency Rules (Agent Ergonomics)
- **NO Headless Browser Subagents**: DO NOT spin up browser subagents or automated browser sessions unless the user explicitly requests it. They burn credits and timeout. Rely on focused `vitest` tests.
- **Zero Tests on Documentation**: For changes that are purely markdown (`.md`), comments, or docstrings, DO NOT run tests, builds, or typechecks.
- **Targeted Test Execution**: During active coding, run ONLY the relevant test file (e.g. `npx vitest run src/path/to/test.ts`). Reserve full `npm test` for final completion.
- **Typecheck over Full Lint Dump**: Use `npm run typecheck` (`tsc --noEmit`) for code correctness. Avoid full `npm run lint` dumps as pre-existing `no-explicit-any` warnings waste context tokens.
- **Respect Active Processes**: Check active terminal metadata before starting dev servers or DB studios to prevent port collisions (`npm run dev` and `npm run db:studio` are often already running).

## 3. Database & Drizzle Relational Invariants
- **Mock DB vs. Real Postgres**: `vitest` runs in `pg-mem`. Passing unit tests DO NOT guarantee Postgres migration parity. Schema changes in `src/db/schema.ts` MUST be validated by running `npm run db:push` against real Docker PostgreSQL.
- **Naming Parity**:
  - `bracket_tiers.num_players` (SQL) maps to `tier.playerCount` in TS. Support both defensively.
  - Bracket routing supports both `'TRADITIONAL_TREE'` and `'TRADITIONAL'`.
- **Foreign Keys**: Never alter primary key types (UUID <-> Text) in Drizzle without verifying existing foreign key cascades.

## 4. Universal Tournament Mathematical Invariants
- **Bye Rule**: Byes are NEVER represented as playable matches. Total matches: strictly $N - 1$ (Single Elim) or $2N - 2$ / $2N - 1$ (Double Elim).
- **Alternating Bye Pairing**: Highest seeds must receive byes and face lowest surviving seeds ($1 \text{ vs } N, 2 \text{ vs } N-1$). Never pair sequential seeds for byes ($1 \text{ vs } 2$).
- **Double Elim Drops**: Bye recipients losing in Winners R2 drop to Losers R2, never Losers R1.
- **Points Qual Tiebreaker**: Players with 0 points are deterministically tiebroken by highest single game score (`peakScore`).
- **Data Lifecycle Safety**:
  - Unlocking brackets (`isLocked = false`) is forbidden if any match scores exist.
  - Clearing qualifiers is forbidden if match scores exist (require "Clear Matches" first).

## 5. UI & State Hygiene
- **Modals & Drawers**: Backdrop/scrim clicks MUST NEVER dismiss dialogs or score drawers (`onClick={onClose}` on backdrops is prohibited). Dismissal requires explicit Cancel/Save/X.
- **Country Flags**: Country codes MUST be 2-letter uppercase ISO 3166-1 alpha-2 strings. Always provide a safe fallback icon for null or unknown countries.
- **Tier Switching**: Multi-tier feeds (`MatchCardFeed`) must use `key={tier.id}` to guarantee clean remounting without stale state.
- **Competitor Name Trimming**: Database enforces `lower(trim(name))` uniqueness. Always trim names before queries/inserts.

## 6. Primary Verification Commands
- `npx vitest run <file>` — Fast, targeted unit test during development.
- `npm run typecheck` — TypeScript check (`tsc --noEmit`).
- `npm test` — Full regression test suite (run at milestone completion).
- `npm run db:push` — Validate schema against real PostgreSQL.
