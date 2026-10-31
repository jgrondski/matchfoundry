import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { TournamentProvider, useTournament } from './features/tournament/store';
import { OrganizationProvider } from './features/organizations/store';
import { TournamentSwitcherPage } from './routes/TournamentSwitcherPage';
import { OrganizationDirectoryPage } from './routes/OrganizationDirectoryPage';
import { OrganizationDetailPage } from './routes/OrganizationDetailPage';
import { PublicTierBracketPage } from './routes/PublicTierBracketPage';
import { PublicLeaderboardPage } from './routes/PublicLeaderboardPage';
import { ManageSheetPage } from './routes/ManageSheetPage';
import { ManageJudgePage } from './routes/ManageJudgePage';
import { ManageTournamentSettingsPage } from './routes/ManageTournamentSettingsPage';
import { ManageTournamentPlayersPage } from './routes/ManageTournamentPlayersPage';
import { FinalStandingsPage } from './routes/FinalStandingsPage';
import { SlugRedirectPage } from './routes/SlugRedirectPage';
import { PlayerDirectoryPage } from './routes/PlayerDirectoryPage';
import { OBSHubPage } from './routes/OBSHubPage';
import { ObsOverlayPage } from './routes/ObsOverlayPage';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Database, AlertTriangle } from 'lucide-react';
import { AuthProvider } from './features/auth/AuthContext';
import { RequireTournamentAdmin, RequireMasterAdmin, RequireAnyAdmin } from './features/auth/RouteGuards';
import { AdminLoginPage } from './routes/AdminLoginPage';
import { PublicQualifyPage } from './routes/PublicQualifyPage';
import { ManageReviewPage } from './routes/ManageReviewPage';

/**
 * LiveRouteSync: Automatically revalidates live tournament data from the PostgreSQL API
 * on every route change and whenever the browser window regains focus.
 */
const LiveRouteSync: React.FC = () => {
  const location = useLocation();
  const { refreshTournament, refreshGlobalPlayers, refreshAllTournaments } = useTournament();

  useEffect(() => {
    if (typeof fetch === 'undefined') return;

    const segments = location.pathname.split('/').filter(Boolean);
    const nonTournamentPrefixes = new Set(['admin', 'login', 'organizations', 'org', 'players']);

    if (segments.length > 0 && !nonTournamentPrefixes.has(segments[0])) {
      const slug = segments[0] === 'obs' && segments[1] === 'overlay' ? segments[2] : segments[0];
      if (slug) {
        void refreshTournament(slug);
      }
    } else if (segments[0] === 'players') {
      void refreshGlobalPlayers();
    } else if (segments.length === 0) {
      // Front page: pick up tournaments whose online quals opened (or closed) since the list loaded.
      void refreshAllTournaments();
    }
  }, [location.pathname, refreshTournament, refreshGlobalPlayers, refreshAllTournaments]);

  // Window Focus Sync (spectator or admin returns from Twitch tab)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleFocus = () => {
      const segments = location.pathname.split('/').filter(Boolean);
      const nonTournamentPrefixes = new Set(['admin', 'login', 'organizations', 'org', 'players']);
      if (segments.length > 0 && !nonTournamentPrefixes.has(segments[0])) {
        const slug = segments[0] === 'obs' && segments[1] === 'overlay' ? segments[2] : segments[0];
        if (slug) {
          void refreshTournament(slug);
        }
      } else if (segments[0] === 'players') {
        void refreshGlobalPlayers();
      } else if (segments.length === 0) {
        void refreshAllTournaments();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [location.pathname, refreshTournament, refreshGlobalPlayers, refreshAllTournaments]);

  return null;
};

export const App: React.FC = () => {
  const [configError] = useState<string | null>(null);

  if (configError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas p-8 font-sans text-fg">
        <div className="max-w-140 rounded-md border border-red/40 bg-surface p-8 shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
          <div className="mb-5 flex items-center gap-3 text-red-bright">
            <AlertTriangle size={28} />
            <h2 className="m-0 text-xl font-bold">Database Configuration Missing</h2>
          </div>
          <p className="mb-6 text-base leading-normal text-fg-secondary">
            {configError}
          </p>
          <div className="mb-6 rounded-md border border-[#30363d] bg-canvas p-4 font-mono text-sm text-[#58a6ff]">
            <div># 1. Copy environment template:</div>
            <div className="mb-3 text-fg">cp .env.example .env</div>
            <div># 2. Start PostgreSQL container:</div>
            <div className="mb-3 text-fg">npm run db:up</div>
            <div># 3. Push schema:</div>
            <div className="text-fg">npm run db:push</div>
          </div>
          <div className="flex items-center gap-2 text-caption text-[#8b949e]">
            <Database size={16} />
            <span>PostgreSQL via Drizzle ORM is required for all application state.</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <AuthProvider>
      <OrganizationProvider>
        <TournamentProvider>
          <BrowserRouter>
            <LiveRouteSync />
            <ErrorBoundary>
              <Routes>
                {/* Home: Tournaments Switcher */}
                <Route path="/" element={<TournamentSwitcherPage />} />

                {/* Dedicated Admin Login */}
                <Route path="/admin" element={<AdminLoginPage />} />
                <Route path="/login" element={<Navigate to="/admin" replace />} />

                {/* Organizations Directory & Dashboard (Master Admin Restricted) */}
                <Route
                  path="/organizations"
                  element={
                    <RequireMasterAdmin>
                      <OrganizationDirectoryPage />
                    </RequireMasterAdmin>
                  }
                />
                <Route path="/org/:orgSlug" element={<OrganizationDetailPage />} />

                {/* Global Player Directory (Any Admin: System Admin or Tournament Admin) */}
                <Route
                  path="/players"
                  element={
                    <RequireAnyAdmin>
                      <PlayerDirectoryPage />
                    </RequireAnyAdmin>
                  }
                />

                {/* Tournament Shortlinks & Cutoffs */}
                <Route path="/:slug" element={<SlugRedirectPage />} />
                <Route path="/:slug/leaderboard" element={<PublicLeaderboardPage />} />
                <Route path="/:slug/quals" element={<Navigate to="../leaderboard" relative="path" replace />} />
                <Route path="/:slug/standings" element={<FinalStandingsPage />} />
                <Route path="/:slug/qualify" element={<PublicQualifyPage />} />

                {/* OBS Broadcast Studio Hub */}
                <Route path="/:slug/obs" element={<OBSHubPage />} />

                {/* Dedicated OBS Broadcast Overlay Endpoints */}
                <Route path="/:slug/obs/bracket" element={<ObsOverlayPage />} />
                <Route path="/:slug/obs/bracket/:tierSlug" element={<ObsOverlayPage />} />
                <Route path="/:slug/obs/match/:matchId" element={<ObsOverlayPage />} />
                <Route path="/obs/overlay/:slug/:tierSlug" element={<ObsOverlayPage />} />
                <Route path="/obs/match/:slug/:matchId" element={<ObsOverlayPage />} />

                {/* Management Views (Gated by Tournament Scope / Master Admin) */}
                <Route
                  path="/:slug/manage"
                  element={
                    <RequireTournamentAdmin>
                      <PublicTierBracketPage />
                    </RequireTournamentAdmin>
                  }
                />
                <Route
                  path="/:slug/manage/bracket"
                  element={
                    <RequireTournamentAdmin>
                      <PublicTierBracketPage />
                    </RequireTournamentAdmin>
                  }
                />
                <Route
                  path="/:slug/manage/bracket/:tierSlug"
                  element={
                    <RequireTournamentAdmin>
                      <PublicTierBracketPage />
                    </RequireTournamentAdmin>
                  }
                />
                <Route
                  path="/:slug/manage/sheet"
                  element={
                    <RequireTournamentAdmin>
                      <ManageSheetPage />
                    </RequireTournamentAdmin>
                  }
                />
                <Route
                  path="/:slug/manage/judge"
                  element={
                    <RequireTournamentAdmin>
                      <ManageJudgePage />
                    </RequireTournamentAdmin>
                  }
                />
                <Route
                  path="/:slug/manage/review"
                  element={
                    <RequireTournamentAdmin>
                      <ManageReviewPage />
                    </RequireTournamentAdmin>
                  }
                />
                <Route
                  path="/:slug/manage/qualifiers"
                  element={
                    <RequireTournamentAdmin>
                      <PublicLeaderboardPage />
                    </RequireTournamentAdmin>
                  }
                />
                <Route
                  path="/:slug/manage/seeding"
                  element={
                    <RequireTournamentAdmin>
                      <PublicLeaderboardPage />
                    </RequireTournamentAdmin>
                  }
                />
                <Route
                  path="/:slug/manage/standings"
                  element={
                    <RequireTournamentAdmin>
                      <FinalStandingsPage />
                    </RequireTournamentAdmin>
                  }
                />
                <Route
                  path="/:slug/manage/players"
                  element={
                    <RequireTournamentAdmin>
                      <ManageTournamentPlayersPage />
                    </RequireTournamentAdmin>
                  }
                />
                <Route
                  path="/:slug/manage/settings"
                  element={
                    <RequireTournamentAdmin>
                      <ManageTournamentSettingsPage />
                    </RequireTournamentAdmin>
                  }
                />

                {/* Route Aliases for Direct Friendly URLs */}
                <Route path="/:slug/view" element={<PublicTierBracketPage />} />
                <Route path="/:slug/brackets" element={<PublicTierBracketPage />} />
                <Route path="/:slug/bracket" element={<PublicTierBracketPage />} />
                <Route path="/:slug/seeding" element={<PublicLeaderboardPage />} />
                <Route
                  path="/:slug/sheet"
                  element={
                    <RequireTournamentAdmin>
                      <ManageSheetPage />
                    </RequireTournamentAdmin>
                  }
                />
                <Route
                  path="/:slug/judge"
                  element={
                    <RequireTournamentAdmin>
                      <ManageJudgePage />
                    </RequireTournamentAdmin>
                  }
                />
                <Route
                  path="/:slug/players"
                  element={
                    <RequireTournamentAdmin>
                      <ManageTournamentPlayersPage />
                    </RequireTournamentAdmin>
                  }
                />
                <Route
                  path="/:slug/settings"
                  element={
                    <RequireTournamentAdmin>
                      <ManageTournamentSettingsPage />
                    </RequireTournamentAdmin>
                  }
                />

                {/* Public Dynamic Tier Bracket */}
                <Route path="/:slug/:tierSlug" element={<PublicTierBracketPage />} />

                {/* Fallback to Home */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </ErrorBoundary>
          </BrowserRouter>
        </TournamentProvider>
      </OrganizationProvider>
    </AuthProvider>
  );
};
