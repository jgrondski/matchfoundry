import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useTournament } from '../features/tournament/store';
import { TournamentLayout } from '../components/TournamentLayout';
import { SpectatorLayout } from '../components/SpectatorLayout';
import { LeaderboardTable } from '../features/qualifiers/components/LeaderboardTable';
import { ManualSeedingManager } from '../features/tournament/components/seeding/ManualSeedingManager';
import { ShareBracketModal } from '../features/bracket/components/ShareBracketModal';
import { LoadingScreen } from '../components/LoadingScreen';
import { Button } from '../components/ui';

export const PublicLeaderboardPage: React.FC = () => {
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
    return <LoadingScreen message="Loading leaderboard..." />;
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

  // If manual seeding is active, render the Manual Seeding Manager
  if (tournament.seedingMethod === 'MANUAL') {
    if (isObsMode) {
      return (
        <div className="obs-mode-canvas min-h-screen w-full bg-transparent px-6 py-8">
          <div className="mx-auto w-full max-w-300">
            <ManualSeedingManager tournament={tournament} canManage={false} isObsMode={true} />
          </div>
        </div>
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
      <SpectatorLayout
        tournament={tournament}
        activeView="leaderboard"
        onOpenShare={() => setIsShareModalOpen(true)}
      >
        <main className="mx-auto w-full max-w-300 flex-1 px-6 py-8">
          <ManualSeedingManager tournament={tournament} canManage={false} />
        </main>

        <ShareBracketModal
          isOpen={isShareModalOpen}
          onClose={() => setIsShareModalOpen(false)}
          tournament={tournament}
        />
      </SpectatorLayout>
    );
  }

  if (isObsMode) {
    return (
      <div className="obs-mode-canvas min-h-screen w-full bg-transparent px-6 py-8">
        <div className="mx-auto w-full max-w-300">
          <LeaderboardTable tournament={tournament} isObsMode={true} />
        </div>
      </div>
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
    <SpectatorLayout
      tournament={tournament}
      activeView="leaderboard"
      onOpenShare={() => setIsShareModalOpen(true)}
    >
      <main className="mx-auto w-full max-w-300 flex-1 px-6 py-8">
        <LeaderboardTable tournament={tournament} canManage={false} />
      </main>

      <ShareBracketModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        tournament={tournament}
      />
    </SpectatorLayout>
  );
};
