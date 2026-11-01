import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTournament } from '../features/tournament/store';
import { SpectatorLayout } from '../components/SpectatorLayout';
import { LoadingScreen } from '../components/LoadingScreen';
import { Button } from '../components/ui';
import { CompetitorPortalView } from '../features/online-quals/components/CompetitorPortalView';

export const PublicQualifyPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { getTournamentBySlug, isLoading, isHydrated, isDbConnected, retryConnection } = useTournament();

  if (isLoading || !isHydrated) {
    return <LoadingScreen message="Loading qualification portal..." />;
  }

  const tournament = slug ? getTournamentBySlug(slug) : undefined;
  if (!tournament && !isDbConnected) {
    // Loading failed (often a phone waking up offline). Any run in progress is still saved.
    return (
      <div className="p-12 text-center text-fg-secondary" data-testid="qualify-connection-error">
        <h2 className="text-2xl font-bold">Can't reach the server</h2>
        <p>Check your connection and try again. Your run is still saved.</p>
        <Button
          variant="primary"
          onClick={() => void retryConnection()}
          className="mt-4 rounded-md border-0 bg-gold-bright bg-none px-5 py-2.5 font-bold text-black"
        >
          Retry
        </Button>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="p-12 text-center text-fg-secondary">
        <h2 className="text-2xl font-bold">Tournament Not Found</h2>
        <Button
          variant="primary"
          onClick={() => navigate('/')}
          className="mt-4 rounded-md border-0 bg-gold-bright bg-none px-5 py-2.5 font-bold text-black"
        >
          Back to Tournaments
        </Button>
      </div>
    );
  }

  return (
    <SpectatorLayout tournament={tournament} activeView="qualify">
      <CompetitorPortalView key={tournament.id} tournament={tournament} />
    </SpectatorLayout>
  );
};
