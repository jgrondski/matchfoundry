import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { TournamentProvider } from './features/tournament/store';
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
import { RequireTournamentAdmin, RequireMasterAdmin } from './features/auth/RouteGuards';
import { AdminLoginPage } from './routes/AdminLoginPage';
import { PublicQualifyPage } from './routes/PublicQualifyPage';
import { ManageReviewPage } from './routes/ManageReviewPage';

export const App: React.FC = () => {
  const [configError] = useState<string | null>(null);

  if (configError) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--color-bg-base, #0d1117)',
          color: 'var(--color-text-primary, #ffffff)',
          padding: '2rem',
          fontFamily: 'Inter, system-ui, sans-serif',
        }}
      >
        <div
          style={{
            maxWidth: '560px',
            background: 'var(--color-bg-surface, #161b22)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            borderRadius: '12px',
            padding: '2rem',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem', color: '#f87171' }}>
            <AlertTriangle size={28} />
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>Database Configuration Missing</h2>
          </div>
          <p style={{ color: 'var(--color-text-secondary, #8b949e)', fontSize: '0.95rem', lineHeight: 1.5, marginBottom: '1.5rem' }}>
            {configError}
          </p>
          <div
            style={{
              background: '#0d1117',
              border: '1px solid #30363d',
              borderRadius: '8px',
              padding: '1rem',
              fontFamily: 'monospace',
              fontSize: '0.88rem',
              color: '#58a6ff',
              marginBottom: '1.5rem',
            }}
          >
            <div># 1. Copy environment template:</div>
            <div style={{ color: '#e6edf3', marginBottom: '0.75rem' }}>cp .env.example .env</div>
            <div># 2. Start PostgreSQL container:</div>
            <div style={{ color: '#e6edf3', marginBottom: '0.75rem' }}>npm run db:up</div>
            <div># 3. Push schema:</div>
            <div style={{ color: '#e6edf3' }}>npm run db:push</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#8b949e', fontSize: '0.82rem' }}>
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

                {/* Global Player Directory (Master Admin Restricted) */}
                <Route
                  path="/players"
                  element={
                    <RequireMasterAdmin>
                      <PlayerDirectoryPage />
                    </RequireMasterAdmin>
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
