import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTournament } from '../features/tournament/store';
import { TournamentLayout } from '../components/TournamentLayout';
import { ReviewQueueView } from '../features/online-quals/components/ReviewQueueView';
import { LoadingScreen } from '../components/LoadingScreen';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '../components/ui';

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
      <div className="p-12 text-center text-fg-secondary">
        <h2 className="text-2xl font-bold">Tournament Not Found</h2>
        <Button variant="primary" onClick={() => navigate('/')} className="mt-4">
          Back to Tournaments
        </Button>
      </div>
    );
  }

  return (
    <TournamentLayout tournament={tournament} activeView="review">
      <main className="mx-auto flex w-full max-w-300 flex-1 flex-col gap-6 px-6 py-8">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <span className="text-caption font-bold tracking-widest text-gold-bright uppercase">
              Qual Review
            </span>
          </div>
          <h1 className="m-0 flex items-center gap-2.5 text-3xl font-extrabold tracking-tight text-white">
            <CheckCircle2 color="var(--color-gold-bright)" size={28} />
            Qual Review
          </h1>
          <p className="mt-1.5 mb-0 text-sm text-fg-muted">
            Verify authwords and scores; reconcile users.
          </p>
        </div>

        <ReviewQueueView key={tournament.id} tournament={tournament} />
      </main>
    </TournamentLayout>
  );
};
