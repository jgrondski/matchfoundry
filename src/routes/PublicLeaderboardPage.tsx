import React from 'react';
import { useParams, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useTournament } from '../features/tournament/store';
import { TournamentLayout } from '../components/TournamentLayout';
import { SpectatorLayout } from '../components/SpectatorLayout';
import { LeaderboardTable } from '../features/qualifiers/components/LeaderboardTable';
import { ManualSeedingManager } from '../features/tournament/components/seeding/ManualSeedingManager';
import { LoadingScreen } from '../components/LoadingScreen';
import { ObsGutterList } from '../features/obs/components/ObsGutterList';
import { ObsPageFrame } from '../features/obs/components/ObsPageFrame';
import { getQualifierGutterRows, parseGutterCount } from '../features/obs/gutterRows';
import { Button } from '../components/ui';

export const PublicLeaderboardPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { getTournamentBySlug, isLoading, isHydrated } = useTournament();

  const isManageRoute = location.pathname.includes('/manage/');
  const isObsMode = searchParams.get('obs') === 'true';

  if (isLoading || !isHydrated) {
    return <LoadingScreen message="Loading leaderboard..." />;
  }

  const tournament = slug ? getTournamentBySlug(slug) : undefined;
  if (!tournament) {
    return (
      <div className="p-12 text-center text-fg-secondary">
        <h2 className="text-2xl font-bold">Tournament Not Found</h2>
        <Button variant="primary" onClick={() => navigate('/')} className="mt-4">
          All Tournaments
        </Button>
      </div>
    );
  }

  if (isObsMode && searchParams.get('layout') === 'gutter') {
    return (
      <ObsGutterList
        title={tournament.seedingMethod === 'MANUAL' ? 'Seeding' : 'Qualifiers'}
        rows={getQualifierGutterRows(tournament, parseGutterCount(searchParams.get('count')))}
        emptyText="No scores yet"
        chroma={searchParams.get('chroma')}
      />
    );
  }

  // If manual seeding is active, render the Manual Seeding Manager
  if (tournament.seedingMethod === 'MANUAL') {
    if (isObsMode) {
      return (
        <ObsPageFrame chroma={searchParams.get('chroma')}>
          <ManualSeedingManager tournament={tournament} canManage={false} isObsMode={true} />
        </ObsPageFrame>
      );
    }

    if (isManageRoute) {
      return (
        <TournamentLayout tournament={tournament} activeView="leaderboard">
          <main className="mx-auto w-full max-w-300 flex-1 px-6 py-8">
            <ManualSeedingManager tournament={tournament} canManage={true} />
          </main>
        </TournamentLayout>
      );
    }

    return (
      <SpectatorLayout tournament={tournament} activeView="leaderboard">
        <main className="mx-auto w-full max-w-300 flex-1 px-6 py-8">
          <ManualSeedingManager tournament={tournament} canManage={false} />
        </main>
      </SpectatorLayout>
    );
  }

  if (isObsMode) {
    return (
      <ObsPageFrame chroma={searchParams.get('chroma')}>
        <LeaderboardTable tournament={tournament} isObsMode={true} />
      </ObsPageFrame>
    );
  }

  if (isManageRoute) {
    return (
      <TournamentLayout tournament={tournament} activeView="leaderboard">
        <main className="mx-auto w-full max-w-300 flex-1 px-6 py-8">
          <LeaderboardTable tournament={tournament} canManage={true} />
        </main>
      </TournamentLayout>
    );
  }

  return (
    <SpectatorLayout tournament={tournament} activeView="leaderboard">
      <main className="mx-auto w-full max-w-300 flex-1 px-6 py-8">
        <LeaderboardTable tournament={tournament} canManage={false} />
      </main>
    </SpectatorLayout>
  );
};
