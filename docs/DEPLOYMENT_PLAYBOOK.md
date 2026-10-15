# Tournament Manager: Cloud Deployment & CI/CD Playbook

This playbook provides a complete, step-by-step operational guide for connecting Tournament Manager to live cloud services (**Vercel** + **Neon Serverless PostgreSQL**), configuring automated **GitHub Actions CI/CD**, and transitioning git workflows from solo pre-release to collaborative branch/PR pipelines.

---

## 1. Architecture Overview

```
                                  +------------------------------------+
                                  |         GitHub Repository          |
                                  |  (Triggers CI & Vercel Webhook)    |
                                  +-----------------+------------------+
                                                    |
                         +--------------------------+--------------------------+
                         | (on push / PR)                                      | (on push to main)
                         v                                                     v
        +----------------------------------+                  +----------------------------------+
        |        GitHub Actions CI         |                  |        Vercel Production         |
        |  1. npm run typecheck            |                  |  • Vite SPA (Static Edge CDN)    |
        |  2. npm test (Vitest 480+ tests) |                  |  • /api/* (Serverless Functions) |
        |  3. npm run build (Bundle Check) |                  |  • Auto-Detects Neon Cloud DB    |
        +----------------------------------+                  +-----------------+----------------+
                                                                                |
                                                                                v
                                                              +----------------------------------+
                                                              |      Neon Cloud PostgreSQL       |
                                                              |  • Auto HTTP Serverless Driver   |
                                                              |  • Connection-pooling resilient  |
                                                              +----------------------------------+
```

### Core Architecture Components:
1. **Frontend**: Vite Single-Page Application (SPA) compiled to `dist/`, served via Vercel Edge Network at `https://www.matchfoundry.gg`.
2. **Backend API**: Node.js Serverless Function bundled into `api/index.js` via `esbuild` (`npm run build:api`) from TypeScript source `src/server/serverless.ts`. Committing `api/index.js` ensures Vercel discovers and deploys the Lambda alongside the static Vite SPA with 100% parity, zero cold-build discovery mismatches, and pre-resolved ESM imports. Routed via `vercel.json` (`/api/(.*)` -> `/api`).
3. **Database**: Neon Serverless PostgreSQL. In `src/db/index.ts`, connection strings containing `neon.tech` automatically switch to the `@neondatabase/serverless` connectionless HTTP driver (`drizzle-orm/neon-http`), eliminating connection pool exhaustion on serverless lambdas.
4. **CI/CD Quality Gate**: GitHub Actions (`.github/workflows/ci.yml`) automatically executes static typecheck, unit and integration tests, and production bundle builds on all pull requests and pushes to `main`.
5. **Continuous Deployment**: Feature branch PRs generate preview deployment URLs for testing; verified PR merges to `main` deploy to production `matchfoundry.gg`.

---

## 2. Environment Variables Inventory

Before deploying, ensure you have values for the following four environment variables:

| Variable | Description | Example / Default | Required In |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` | Neon PostgreSQL pooled or direct connection string with SSL | `postgresql://user:pass@ep-xyz.neon.tech/neondb?sslmode=require` | Local & Vercel |
| `SYSTEM_ADMIN_RECOVERY_PIN` | Permanent emergency recovery PIN for Master/System Admin access | `849201` (choose any secure 6-8 digit code) | Local & Vercel |
| `PIN_ENCRYPTION_KEY` | 32+ character secret key for AES-256-GCM encryption of tournament PINs at rest | Generated 32-byte hex string (see Step 2) | Local & Vercel |
| `NODE_ENV` | Runtime environment mode | `production` | Vercel |

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

The repository includes `.github/workflows/ci.yml` which automatically executes on every push to `main` and on all pull requests.

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    name: Typecheck & Test Suite
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: TypeScript typecheck
        run: npm run typecheck

      - name: Run test suite
        run: npm test

      - name: Build production bundle
        run: npm run build
```

#### How the CI Pipeline Protects Production:
1. **Zero-Flake Fast Feedback**: Vitest runs all 480+ unit and integration tests in an in-memory database (`pg-mem`) in under 3 seconds.
2. **Production Bundle Verification**: `npm run build` guarantees that all assets, routes, and CSS compile cleanly before code is deployed.
3. **Blocked Builds**: If any test or typecheck fails, GitHub Actions marks the commit with a red ❌ and notifies you.

---

### Step 4: Git Workflow Strategy — Moving from Solo to Teams

#### Current Solo Pre-Release Workflow (Push to `main`)
While working solo in pre-release, you can continue pushing directly to `main`:
1. Make code edits locally and verify with targeted tests:
   ```bash
   npm run typecheck
   npx vitest run src/path/to/test.ts
   ```
2. Commit and push:
   ```bash
   git add .
   git commit -m "feat: enhance bracket visualizer"
   git push origin main
   ```
3. **What happens automatically:**
   - GitHub Actions CI triggers immediately, running typecheck, the test suite, and bundle build.
   - Vercel detects the push to `main`, pulls the commit, and deploys directly to production.

#### Recommended Next Phase: Branch & PR Workflow (Multi-Developer Ready)
When expanding to multiple developers or when you want staging preview environments before touching production:

1. **Create a Feature Branch:**
   ```bash
   git checkout -b feat/custom-bracket-theming
   ```
2. **Develop and Commit on Branch:**
   ```bash
   git add .
   git commit -m "feat: add 5-color palette selector"
   git push -u origin feat/custom-bracket-theming
   ```
3. **Automatic Vercel Preview Deployments:**
   - Vercel automatically deploys every branch and pull request to an isolated Preview URL (e.g. `https://tournament-manager-git-feat-custom-bracket-theming.vercel.app`).
   - You can test full functionality on live mobile devices and desktops before merging!
4. **Open a Pull Request on GitHub:**
   - Open a PR from `feat/custom-bracket-theming` into `main`.
   - GitHub Actions CI will run and display a green checkmark when tests pass.
   - Vercel will post a comment directly on the PR with the live preview link and deployment status.
5. **Merge to Main:**
   - Click **Squash and Merge** or **Rebase and Merge** on GitHub.
   - Vercel automatically deploys the merged `main` branch to your Production URL.
6. **(Optional) Enable GitHub Branch Protection:**
   - In GitHub repository settings -> **Branches** -> **Add branch ruleset**:
     - Target branch: `main`
     - Check: **Require status checks to pass before merging** -> Add `Typecheck & Test Suite`.
     - Check: **Require a pull request before merging** (when ready to enforce PRs).

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
