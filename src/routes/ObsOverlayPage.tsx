import React, { useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { ObsBracketView } from '../features/obs/components/ObsBracketView';
import { ObsMatchCardView } from '../features/obs/components/ObsMatchCardView';
import { BracketViewMode } from '../features/bracket/bracketLayout';
import { useBracketTier } from '../features/bracket/hooks/useBracketTier';

export const ObsOverlayPage: React.FC = () => {
  const { slug, tierSlug, matchId: routeMatchId } = useParams<{
    slug: string;
    tierSlug?: string;
    matchId?: string;
  }>();
  const [searchParams] = useSearchParams();

  const queryMatchId = searchParams.get('match') || undefined;
  const matchId = routeMatchId || queryMatchId;
  const viewMode = (searchParams.get('view') as BracketViewMode) || 'fit';
  const chroma = searchParams.get('chroma');

  useEffect(() => {
    document.body.classList.add('obs-overlay-mode');
    return () => {
      document.body.classList.remove('obs-overlay-mode');
    };
  }, []);

  const { tournament, tier, isLoading, notFound } = useBracketTier(slug, tierSlug, {
    initialViewMode: viewMode,
  });

  if (isLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-transparent text-fg-secondary">
        <span className="text-sm">Loading Tournament Broadcast Stream...</span>
      </div>
    );
  }

  if (notFound || !tournament) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-transparent text-red">
        <h3 className="text-lg font-bold">Tournament Not Found</h3>
      </div>
    );
  }

  if (matchId) {
    return (
      <ObsMatchCardView
        tournament={tournament}
        tier={tier || undefined}
        matchId={matchId}
        chroma={chroma}
      />
    );
  }

  if (!tier) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-transparent text-fg-secondary">
        <h3 className="text-lg font-bold">No Tier Bracket Configured</h3>
      </div>
    );
  }

  return (
    <ObsBracketView
      tournament={tournament}
      tier={tier}
      viewMode={viewMode}
      chroma={chroma}
    />
  );
};

