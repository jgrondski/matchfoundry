import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTournament } from '../features/tournament/store';
import { SpectatorLayout } from '../components/SpectatorLayout';
import { LoadingScreen } from '../components/LoadingScreen';
import { CompetitorPortalView } from '../features/online-quals/components/CompetitorPortalView';

export const PublicQualifyPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { getTournamentBySlug, isLoading, isHydrated } = useTournament();

  if (isLoading || !isHydrated) {
    return <LoadingScreen message="Loading qualification portal..." />;
  }

  const tournament = slug ? getTournamentBySlug(slug) : undefined;
  if (!tournament) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-secondary, #94a3b8)' }}>
        <h2>Tournament Not Found</h2>
        <button
          onClick={() => navigate('/')}
          className="btn btn-primary"
          style={{
            marginTop: '1rem',
            padding: '0.65rem 1.25rem',
            background: 'var(--color-gold-bright, #f59e0b)',
            color: '#000000',
            border: 'none',
            borderRadius: '8px',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Back to Tournaments
        </button>
      </div>
    );
  }

  return (
    <SpectatorLayout tournament={tournament} activeView="qualify">
      <CompetitorPortalView key={tournament.id} tournament={tournament} />
    </SpectatorLayout>
  );
};
