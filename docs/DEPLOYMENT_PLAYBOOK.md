# Tournament Manager: Cloud Deployment & CI/CD Playbook

This playbook provides a complete, step-by-step operational guide for connecting Tournament Manager to live cloud services (**Vercel** + **Neon Serverless PostgreSQL**), configuring automated **GitHub Actions CI/CD**, and transitioning git workflows from solo pre-release to collaborative branch/PR pipelines.

---

## 1. Architecture Overview

```
  Pull request into main                         Merge (push) to main
  ----------------------                         --------------------
  GitHub Actions, in parallel:                   GitHub Actions:
   • Typecheck & Test Suite                       • Deploy to Vercel (no re-test;
       npm run typecheck, npm test                  the PR already passed)
   • Golden Journeys (Playwright)                     npm run build
       throwaway Postgres in the job                  db:push:ci -> PRODUCTION Neon
   • Deploy to Vercel (after the tests pass)          vercel deploy --prod
       npm run build                                         |
       db:push:ci -> PREVIEW Neon branch                     v
       vercel deploy (Preview URL)                 matchfoundry.gg + production Neon
              |
              v
  Preview URL + Neon "preview" branch
```

### Core Architecture Components:
1. **Frontend**: Vite Single-Page Application (SPA) compiled to `dist/`, served via Vercel Edge Network at `https://www.matchfoundry.gg`.
2. **Backend API**: Node.js Serverless Function bundled on-the-fly in GitHub Actions CI/CD (`npm run build`) from TypeScript source `src/server/serverless.ts` into `api/index.js`, and deployed directly to Vercel via `vercel deploy --prebuilt`. Zero runtime artifacts are committed to Git (`api/*.js` in `.gitignore`), routed via `vercel.json` (`/api/(.*)` -> `/api`).
3. **Database**: Neon Serverless PostgreSQL. In `src/db/index.ts`, connection strings containing `neon.tech` automatically switch to the `@neondatabase/serverless` connectionless HTTP driver (`drizzle-orm/neon-http`), eliminating connection pool exhaustion on serverless lambdas.
4. **CI/CD Quality Gate & Schema Migration**: GitHub Actions (`.github/workflows/ci.yml`). On pull requests it runs the typecheck, the Vitest suite and the Playwright golden journeys, then pushes the schema to the Neon **preview** branch and deploys a preview. On merge to `main` it skips the tests (the PR already passed them on the same code), pushes the schema to **production** Neon, and deploys to production.
5. **Continuous Deployment**: Feature branch PRs generate preview deployment URLs for testing; verified PR merges to `main` deploy to production `matchfoundry.gg`.

---

## Database Environments

There are three databases, one per deploy target:

| Deploy target | Database | Schema pushed by |
| :--- | :--- | :--- |
| Local dev (`npm run dev`) | Local Docker PostgreSQL (`.env`) | You (`npm run db:push`) |
| CI golden journeys | Throwaway PostgreSQL service container, created and destroyed with the job | The e2e job (`db:push:ci`) |
| Vercel **Preview** (PR deploys) | Neon branch `preview` | The deploy job on every PR run, using the `PREVIEW_DATABASE_URL` GitHub secret |
| Vercel **Production** (`main` → `matchfoundry.gg`) | Neon production branch | The deploy job on merge to `main`, using the `DATABASE_URL` GitHub secret |

### One-time setup

1. **Neon: create the preview branch.** In the Neon console, open the project → **Branches** → **New branch**. Name it `preview`, parent: the production branch, auto-delete: **never**. It is permanent infrastructure: Vercel and the GitHub secret point at it, so an expired branch breaks every PR deploy. To clean it up, use **Reset from parent** instead; that keeps the same connection string. Including data gives previews realistic tournaments; choose schema-only if you would rather not copy production data. Copy its connection string (the same kind, pooled or direct, as your production `DATABASE_URL`).
2. **Vercel: give Preview its own `DATABASE_URL`.** Project → **Settings** → **Environment Variables**. Edit the existing `DATABASE_URL` so it applies to **Production** only, then add a second `DATABASE_URL` for **Preview** with the preview branch's connection string. Keep `PIN_ENCRYPTION_KEY` identical for Production and Preview if the preview branch was created with data; otherwise tournament PINs copied from production can't be decrypted. If the Neon integration for Vercel is installed with automatic per-preview branches, turn that off so it doesn't replace this variable. Also add `DISCORD_WEBHOOK_OVERRIDE_URL` for **Preview** only, set to a webhook in a private test channel: the preview branch holds real tournament and organization webhook URLs, and this redirects every post to the test channel. A preview with no valid override posts nothing to Discord.
3. **GitHub: add the `PREVIEW_DATABASE_URL` secret.** Repository → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**, with the same preview connection string. Until this exists, the PR deploy job stops with an error rather than falling back to production.

### Rules that still apply

1. **Production is migrated on merge, just before the new code deploys.** For that short window the old code runs against the new schema, so schema changes must stay **additive and backward-compatible**: nullable or defaulted columns, new tables, and new indexes. No drops, renames, or type changes.
2. **`--force` applies data-loss statements without asking.** Read the verbose SQL in the PR's CI log (preview) before merging; production will get the same statements. If it shows anything other than the change you expected, a database has drifted from the schema. Stop and investigate.
3. **drizzle-kit still prompts in some cases, even with `--force`.** One example is adding a unique *constraint* to a table that already has rows: it asks whether to truncate the table, and CI has no terminal, so the step crashes. Use `uniqueIndex(...)` instead of `.unique()`.
4. **The preview branch is shared by all open PRs.** Two PRs with conflicting schema changes will fight over it, and an abandoned PR can leave columns or tables there. To start fresh, use **Reset from parent** on the `preview` branch in Neon, then rerun CI on any open PR.

---

## 2. Environment Variables Inventory

Before deploying, ensure you have values for the following four environment variables:

| Variable | Description | Example / Default | Required In |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` | Neon PostgreSQL pooled or direct connection string with SSL. In Vercel, set it twice: Production → production branch, Preview → `preview` branch | `postgresql://user:pass@ep-xyz.neon.tech/neondb?sslmode=require` | Local & Vercel |
| `SYSTEM_ADMIN_RECOVERY_PIN` | Permanent emergency recovery PIN for Master/System Admin access | `849201` (choose any secure 6-8 digit code) | Local & Vercel |
| `PIN_ENCRYPTION_KEY` | 32+ character secret key for AES-256-GCM encryption of tournament PINs at rest | Generated 32-byte hex string (see Step 2) | Local & Vercel |
| `NODE_ENV` | Runtime environment mode | `production` | Vercel |
| `DISCORD_WEBHOOK_OVERRIDE_URL` | Sends every Discord announcement and webhook test to this test-channel webhook instead of the tournament's or organization's. Set it for **Preview only**; never for Production | `https://discord.com/api/webhooks/<id>/<token>` | Vercel Preview (optional locally) |

GitHub Actions also needs these repository secrets: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `DATABASE_URL` (production Neon, used on merge to `main`) and `PREVIEW_DATABASE_URL` (the Neon `preview` branch, used on PRs).

---

## 3. Step-by-Step Deployment Runbook

### Step 1: Provision Neon Serverless PostgreSQL

1. **Sign Up / Log In:**
   - Go to [neon.tech](https://neon.tech) and sign up (free tier provides generous compute and storage).
2. **Create Project:**
   - Click **Create Project**.
   - Project Name: `tournament-manager`.
   - Postgres Version: 16 (or latest default).
   - Region: Select region closest to your users (e.g., `US East (Ohio)` or `US East (N. Virginia)`).
3. **Retrieve Connection String:**
   - On the Neon project dashboard, locate the **Connection Details** card.
   - Select **Connection string** with `Pooled connection` (or direct) and `psql` / `Node.js`.
   - Copy the connection URI. It will look like:
     ```
     postgresql://alex_owner:AbC123dEf@ep-blue-water-123456-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require
     ```
4. **Push Database Schema to Neon:**
   From your local development machine, push all Drizzle schemas (`tournaments`, `bracket_tiers`, `matches`, `qualifier_scores`, `competitors`, `organizations`) directly to Neon:

   * **macOS / Linux (Bash / Zsh):**
     ```bash
     DATABASE_URL="postgresql://alex_owner:AbC123dEf@ep-blue-water-123456-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require" npm run db:push
     ```

   * **Windows (PowerShell):**
     ```powershell
     $env:DATABASE_URL="postgresql://alex_owner:AbC123dEf@ep-blue-water-123456-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require"
     npm run db:push
     ```

5. **Seed Initial Authentic Competitors & Sample Tournaments (Optional but Recommended):**
   Populate your Neon database with authentic competitors and sample tournaments:

   * **macOS / Linux (Bash / Zsh):**
     ```bash
     DATABASE_URL="postgresql://alex_owner:AbC123dEf@ep-blue-water-123456-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require" npm run db:seed
     ```

   * **Windows (PowerShell):**
     ```powershell
     $env:DATABASE_URL="postgresql://alex_owner:AbC123dEf@ep-blue-water-123456-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require"
     npm run db:seed
     ```

6. **Verify Tables in Neon:**
   - In the Neon console, click the **Tables** or **SQL Editor** tab.
   - Verify that tables `tournaments`, `bracket_tiers`, `qualifier_scores`, `matches`, `competitors`, and `organizations` are populated.

---

### Step 2: Deploy to Vercel via Git Integration

Vercel provides native Git integration: linking your GitHub repository once enables automatic deployments whenever `main` is pushed, plus isolated preview deployments on pull requests.

1. **Sign Up / Log In to Vercel:**
   - Go to [vercel.com](https://vercel.com) and log in with your GitHub account.
2. **Import Repository:**
   - Click **Add New...** -> **Project**.
   - Under "Import Git Repository", search for `tournament-manager` and click **Import**.
3. **Configure Project Settings:**
   - **Framework Preset**: `Vite` (auto-detected).
   - **Root Directory**: `./`.
   - **Build Command**: `npm run build` (runs `tsc --noEmit && vite build`).
   - **Output Directory**: `dist`.
   - **Install Command**: `npm install`.
4. **Configure Environment Variables:**
   Under **Environment Variables**, add the four variables (apply them to **Production**, **Preview**, and **Development**):

   * `DATABASE_URL`: Your Neon connection string (copied in Step 1).
   * `SYSTEM_ADMIN_RECOVERY_PIN`: Your secret emergency PIN (e.g. `948215`).
   * `PIN_ENCRYPTION_KEY`: A random 32-character encryption key.
     * *Quick generator command:*
       ```bash
       node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
       ```
   * `NODE_ENV`: `production`
5. **Deploy:**
   - Click **Deploy**.
   - Vercel will clone the repo, install dependencies, compile the Vite production bundle, build the serverless API function, and deploy to a live URL (e.g. `https://tournament-manager-xyz.vercel.app`).

---

### Step 3: CI/CD Automation (GitHub Actions Quality Gate)

`.github/workflows/ci.yml` has three jobs:

| Job | Runs on | What it does |
| :--- | :--- | :--- |
| `Typecheck & Test Suite` | Pull requests | `npm run typecheck` and `npm test` (Vitest on in-memory `pg-mem`). |
| `Golden Journeys (Playwright)` | Pull requests | Starts a throwaway PostgreSQL service, pushes the schema to it, installs Chromium and runs `npm run test:e2e`. The suite builds and deletes its own data (see `docs/TESTING_STRATEGY.md`, Tier 3). Uses a fake recovery PIN and never sees a real database secret. On failure, the Playwright report and traces are uploaded as the `playwright-results` artifact. |
| `Deploy to Vercel` | Pull requests (after `Typecheck & Test Suite` passes) and pushes to `main` | `npm run build`, schema push (preview branch for PRs, production for `main`), `vercel build` and `vercel deploy`. Comments the preview URL on PRs. |

A push to `main` runs only the deploy job: the merged code is the code the PR's checks already passed, as long as the "require branches to be up to date" rule below is on. A newer push to a PR cancels that PR's older run; production deploys always run to completion, one at a time.

#### Required GitHub settings
Repository → **Settings** → **Rules** → **Rulesets** → ruleset for `main`:
- Require a pull request before merging.
- Require status checks to pass: `Typecheck & Test Suite`. Add `Golden Journeys (Playwright)` once it has been reliable for a few PRs.
- **Require branches to be up to date before merging.** This is what makes skipping tests on `main` safe: without it, a PR tested against an older `main` could merge into a newer one untested.

---

### Step 4: Git Workflow (Branch & PR)

All changes reach production through a pull request into `main`.

1. **Create a feature branch:**
   ```bash
   git checkout -b feat/custom-bracket-theming
   ```
2. **Develop locally and verify with targeted tests:**
   ```bash
   npm run typecheck
   npx vitest run src/path/to/test.ts
   ```
3. **Commit and push the branch:**
   ```bash
   git add .
   git commit -m "feat: add 5-color palette selector"
   git push -u origin feat/custom-bracket-theming
   ```
4. **Open a pull request into `main`:**
   - GitHub Actions runs the typecheck, the test suite and the golden journeys.
   - Once the typecheck and tests pass, CI pushes the schema to the Neon `preview` branch, deploys a Preview URL and comments the link on the PR. Data created on a preview stays in the preview branch.
5. **Merge:**
   - Merge the PR on GitHub once checks pass. CI pushes the schema to production and deploys `main` to production, without rerunning the tests.

---

## 5. Post-Deployment Verification Checklist (Walking Skeleton)

Run this 5-minute verification checklist immediately after your live Vercel deployment:

### 1. API Health & Database Connectivity Check
- Open your browser or run:
  ```bash
  curl https://<your-app>.vercel.app/api/health
  ```
- **Expected response (HTTP 200):**
  ```json
  {"status":"ok","database":"connected","driver":"neon-serverless"}
  ```

### 2. Friction-Zero Public Spectator Journey
- Navigate to `https://<your-app>.vercel.app/`.
- Verify the tournament cards render without requiring any login.
- Click a tournament card -> navigate to `/:slug/brackets`, `/:slug/quals`, and `/:slug/standings`.
- Verify the visual bracket, leaderboard, and standings render immediately.

### 3. System Admin Recovery PIN Unlock
- Navigate to `https://<your-app>.vercel.app/admin`.
- Enter your configured `SYSTEM_ADMIN_RECOVERY_PIN`.
- Verify you are authenticated as System Admin:
  - Top header displays `System Admin` badge.
  - Left navigation unlocks `/manage/settings`, `/organizations`, and `/players`.

### 4. Tournament Admin PIN Scope Isolation
- Navigate to a tournament's settings (`/:slug/manage/settings`).
- Configure a tournament PIN (e.g. `4488`).
- Click **Lock / Log Out**.
- Attempt to enter `/admin` using `4488`.
- Verify:
  - The manager left-nav appears *only* for that tournament.
  - Global directories (`/organizations`, `/players`) remain sealed.

### 5. Live Score Mutation & Persistence
- Open a match score drawer on `/:slug/manage/matches` or from the bracket view.
- Enter game scores and click **Save Match**.
- Refresh the browser (hard refresh `Cmd+Shift+R` / `Ctrl+Shift+R`).
- Verify the saved score persists from Neon Cloud PostgreSQL.

---

## 6. Operational Runbook & Maintenance

### How to Apply Schema Updates to Production
Whenever you modify tables in `src/db/schema.ts`:
1. Test schema migrations locally against your Docker Postgres instance (`npm run db:push`).
2. Run against Neon:
   * **macOS / Linux:**
     ```bash
     DATABASE_URL="<your-neon-url>" npm run db:push
     ```
   * **Windows:**
     ```powershell
     $env:DATABASE_URL="<your-neon-url>"
     npm run db:push
     ```
3. Commit your schema changes and push to `main` — Vercel will deploy the updated application code matching your new schema.

### One-Click Instant Rollback
If a faulty deployment ever reaches production:
1. Go to the [Vercel Dashboard](https://vercel.com) -> **Deployments**.
2. Find the last known healthy deployment.
3. Click the three dots (`...`) -> **Promote to Production**.
4. The previous deployment becomes instantly active in ~1 second with zero downtime.

### Real-Time Logs & Debugging
- To view live logs from serverless API endpoints:
  - Vercel Dashboard -> **Logs** -> Filter by `/api/*`.
- Server-side runtime errors and API database latencies appear in real-time.
