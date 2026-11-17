import React from 'react';
import { useParams, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useTournament } from '../features/tournament/store';
import { TournamentLayout } from '../components/TournamentLayout';
import { SpectatorLayout } from '../components/SpectatorLayout';
import { FinalStandingsTable } from '../features/tournament/components/FinalStandingsTable';
import { LoadingScreen } from '../components/LoadingScreen';
import { ObsGutterList } from '../features/obs/components/ObsGutterList';
import { ObsPageFrame } from '../features/obs/components/ObsPageFrame';
import { getStandingsGutterRows, parseGutterCount } from '../features/obs/gutterRows';
import { Button, cn } from '../components/ui';

export const FinalStandingsPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { getTournamentBySlug, isLoading, isHydrated } = useTournament();

  const isManageRoute = location.pathname.includes('/manage/');
  const isObsMode = searchParams.get('obs') === 'true';

  if (isLoading || !isHydrated) {
    return <LoadingScreen message="Loading final standings..." />;
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

  const isStandingsGated = tournament.tiers.length === 0 || !tournament.isLocked;

  if (isObsMode && searchParams.get('layout') === 'gutter') {
    return (
      <ObsGutterList
        title="Standings"
        rows={getStandingsGutterRows(tournament, parseGutterCount(searchParams.get('count')))}
        emptyText="Awaiting results"
        chroma={searchParams.get('chroma')}
      />
    );
  }

  if (isObsMode) {
    return (
      <ObsPageFrame chroma={searchParams.get('chroma')}>
        <FinalStandingsTable tournament={tournament} isObsMode={true} />
      </ObsPageFrame>
    );
  }

  const mainContent = (
    <main
      className={cn(
        'mx-auto flex-1 px-6 max-md:px-4 max-md:py-4',
        isStandingsGated
          ? 'flex max-w-150 flex-col items-center justify-center gap-4 py-12 text-center'
          : 'w-full max-w-300 py-8'
      )}
    >
      <FinalStandingsTable tournament={tournament} />
    </main>
  );

  if (isManageRoute) {
    return (
      <TournamentLayout tournament={tournament} activeView="standings">
        {mainContent}
      </TournamentLayout>
    );
  }

  return (
    <SpectatorLayout tournament={tournament} activeView="standings">
      {mainContent}
    </SpectatorLayout>
  );
};
