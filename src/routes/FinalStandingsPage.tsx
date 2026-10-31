import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useTournament } from '../features/tournament/store';
import { TournamentLayout } from '../components/TournamentLayout';
import { SpectatorLayout } from '../components/SpectatorLayout';
import { FinalStandingsTable } from '../features/tournament/components/FinalStandingsTable';
import { ShareBracketModal } from '../features/bracket/components/ShareBracketModal';
import { LoadingScreen } from '../components/LoadingScreen';
import { Button, cn } from '../components/ui';

export const FinalStandingsPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { getTournamentBySlug, isLoading, isHydrated } = useTournament();

  const isManageRoute = location.pathname.includes('/manage/');
  const isObsMode = searchParams.get('obs') === 'true';

  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  useEffect(() => {
    if (isObsMode) {
      document.body.classList.add('obs-overlay-mode');
    } else {
      document.body.classList.remove('obs-overlay-mode');
    }
    return () => {
      document.body.classList.remove('obs-overlay-mode');
    };
  }, [isObsMode]);

  if (isLoading || !isHydrated) {
    return <LoadingScreen message="Loading final standings..." />;
  }

  const tournament = slug ? getTournamentBySlug(slug) : undefined;
  if (!tournament) {
    return (
      <div className="p-12 text-center text-fg-secondary">
        <h2>Tournament Not Found</h2>
        <Button variant="primary" onClick={() => navigate('/')} className="mt-4">
          Back to Tournaments
        </Button>
      </div>
    );
  }

  const isStandingsGated = tournament.tiers.length === 0 || !tournament.isLocked;

  if (isObsMode) {
    return (
      <div className="obs-mode-canvas min-h-screen w-full bg-transparent px-6 py-8">
        <div className="mx-auto w-full max-w-300">
          <FinalStandingsTable tournament={tournament} isObsMode={true} />
        </div>
      </div>
    );
  }

  const mainContent = (
    <main
      className={cn(
        'mx-auto flex-1 px-6',
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
    <SpectatorLayout
      tournament={tournament}
      activeView="standings"
      onOpenShare={() => setIsShareModalOpen(true)}
    >
      {mainContent}

      <ShareBracketModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        tournament={tournament}
      />
    </SpectatorLayout>
  );
};
