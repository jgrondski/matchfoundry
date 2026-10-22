import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTournament } from '../features/tournament/store';
import { TournamentLayout } from '../components/TournamentLayout';
import { ReviewQueueView } from '../features/online-quals/components/ReviewQueueView';
import { LoadingScreen } from '../components/LoadingScreen';
import { CheckCircle2 } from 'lucide-react';

/**
 * Tier 1: Route Gate (Hydration & Data Boundary)
 * - Zero local form state
 * - Zero useEffects
 * - Unconditional hook execution
 */
export const ManageReviewPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { getTournamentBySlug, isLoading, isHydrated } = useTournament();

  if (isLoading || !isHydrated) {
    return <LoadingScreen message="Loading review queue..." />;
  }

  const tournament = slug ? getTournamentBySlug(slug) : undefined;
  if (!tournament) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
        <h2>Tournament Not Found</h2>
        <button onClick={() => navigate('/')} className="btn btn-primary" style={{ marginTop: '1rem' }}>
          Back to Tournaments
        </button>
      </div>
    );
  }

  return (
    <TournamentLayout tournament={tournament} activeView="review">
      <main
        style={{
          flex: 1,
          padding: '2rem 1.5rem',
          maxWidth: '1200px',
          width: '100%',
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.5rem',
          boxSizing: 'border-box',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.2rem' }}>
            <span
              style={{
                fontSize: '0.78rem',
                fontWeight: 700,
                color: 'var(--color-gold-bright)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}
            >
              Qual Review
            </span>
          </div>
          <h1
            style={{
              fontSize: '1.85rem',
              fontWeight: 800,
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
              letterSpacing: '-0.02em',
              margin: 0,
            }}
          >
            <CheckCircle2 color="var(--color-gold-bright)" size={28} />
            Qual Review
          </h1>
          <p style={{ fontSize: '0.88rem', color: 'var(--color-text-muted)', marginTop: '0.35rem', marginBottom: 0 }}>
            Audit incoming NES Authwords against Twitch VOD recordings, verify competitor scores, and resolve claims.
          </p>
        </div>

        <ReviewQueueView key={tournament.id} tournament={tournament} />
      </main>
    </TournamentLayout>
  );
};
