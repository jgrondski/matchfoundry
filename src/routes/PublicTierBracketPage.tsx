import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useSearchParams, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useTournament } from '../features/tournament/store';
import { Tournament, TournamentTier } from '../features/tournament/types';
import { BracketMatch } from '../features/bracket/types';
import { TournamentLayout } from '../components/TournamentLayout';
import { SpectatorLayout } from '../components/SpectatorLayout';
import { BracketVisualizer } from '../features/bracket/components/BracketVisualizer';
import { BracketTierBar } from '../features/bracket/components/BracketTierBar';
import { BracketViewMode } from '../features/bracket/bracketLayout';
import { MatchCardFeed } from '../features/bracket/components/MatchCardFeed';
import { ShareBracketModal } from '../features/bracket/components/ShareBracketModal';
import { useBracketTier } from '../features/bracket/hooks/useBracketTier';
import { ObsBracketView } from '../features/obs/components/ObsBracketView';
import { LoadingScreen } from '../components/LoadingScreen';
import { Button, cn } from '../components/ui';

/**
 * Tier 1: Route Gate (Hydration & Data Boundary)
 * - Zero local search or modal state
 * - Zero state-tracking useEffects
 * - Handles loading, aliases, redirects, and missing data boundaries
 */
export const PublicTierBracketPage: React.FC = () => {
  const { slug, tierSlug } = useParams<{ slug: string; tierSlug: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { getTournamentBySlug, isLoading: isStoreLoading, isHydrated } = useTournament();

  const isManageRoute = location.pathname.includes('/manage/');
  const isObsMode = searchParams.get('obs') === 'true';
  const urlView = searchParams.get('view') as BracketViewMode | null;

  const initialViewMode: BracketViewMode = urlView || (isObsMode ? 'fit' : 'standard');

  const {
    tournament,
    tier,
    isLoading: isBracketLoading,
  } = useBracketTier(slug, tierSlug, { initialViewMode });

  const tournamentFallback = slug ? getTournamentBySlug(slug) : undefined;
  const tierData = tournament && tier ? { tournament, tier } : undefined;

  // Loading state gate: prevent false "Bracket Not Found" flash while database initializes
  if (isStoreLoading || isBracketLoading || !isHydrated) {
    return <LoadingScreen message="Loading tournament bracket..." />;
  }

  // Handle missing tier / friendly aliases (e.g. /:slug/brackets, /:slug/view, /:slug/manage/bracket)
  if (!tierData) {
    if (tournamentFallback && tournamentFallback.tiers.length > 0) {
      const sorted = [...tournamentFallback.tiers].sort((a, b) => a.priority - b.priority);
      const targetTier = sorted.find(t => t.slug === tierSlug || t.id === tierSlug) || sorted[0];
      const prefix = isManageRoute
        ? `/${tournamentFallback.slug}/manage/bracket`
        : `/${tournamentFallback.slug}`;
      const targetPath = `${prefix}/${targetTier.slug}`;
      if (location.pathname !== targetPath) {
        return <Navigate to={targetPath} replace />;
      }
    }

    if (tournamentFallback && tournamentFallback.tiers.length === 0) {
      const emptyContent = (
        <main className="mx-auto flex max-w-150 flex-1 flex-col items-center justify-center gap-4 px-6 py-12 text-center">
          <h2 className="text-2xl font-bold text-fg">No Bracket Tiers Configured</h2>
          <p className="text-sm leading-normal text-fg-secondary">
            This tournament does not have any bracket tiers yet. Qualifiers can be entered and ranked on the leaderboard, or you can create bracket tiers in Settings.
          </p>
          <div className="mt-2 flex flex-wrap justify-center gap-3">
            <Button variant="secondary" onClick={() => navigate(isManageRoute ? `/${tournamentFallback.slug}/manage/qualifiers` : `/${tournamentFallback.slug}/leaderboard`)}>
              🏆 View Qualifiers
            </Button>
            {isManageRoute && (
              <Button variant="primary" onClick={() => navigate(`/${tournamentFallback.slug}/manage/settings`)}>
                ⚙️ Configure Tiers in Settings
              </Button>
            )}
          </div>
        </main>
      );

      return isManageRoute ? (
        <TournamentLayout tournament={tournamentFallback} activeView="bracket">
          {emptyContent}
        </TournamentLayout>
      ) : (
        <SpectatorLayout tournament={tournamentFallback} activeView="bracket">
          {emptyContent}
        </SpectatorLayout>
      );
    }

    return (
      <div className="p-12 text-center text-fg-secondary">
        <h2 className="text-2xl font-bold">Bracket Not Found</h2>
        <p>Could not find tier "{tierSlug}" in tournament "{slug}".</p>
        <Button variant="primary" onClick={() => navigate('/')} className="mt-4">
          Back to Tournaments
        </Button>
      </div>
    );
  }

  return (
    <TierBracketView
      key={tierData.tier.id}
      tournament={tierData.tournament}
      tier={tierData.tier}
      isManageRoute={isManageRoute}
      isObsMode={isObsMode}
      urlView={urlView}
      chroma={searchParams.get('chroma')}
    />
  );
};

/**
 * Tier 2: Keyed Feature View
 * - key={tier.id} ensures fresh, deterministic state on tier changes without useEffect resets
 * - Manages view mode, search filtering, and share modal
 */
interface TierBracketViewProps {
  tournament: Tournament;
  tier: TournamentTier;
  isManageRoute: boolean;
  isObsMode: boolean;
  urlView: BracketViewMode | null;
  chroma: string | null;
}

const TierBracketView: React.FC<TierBracketViewProps> = ({
  tournament,
  tier,
  isManageRoute,
  isObsMode,
  urlView,
  chroma,
}) => {
  const canManage = isManageRoute;
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [playerSearchTerm, setPlayerSearchTerm] = useState('');

  // View mode resolution
  const [localViewMode, setLocalViewMode] = useState<BracketViewMode>(() => {
    if (urlView) return urlView;
    if (isObsMode) return 'fit';
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      return 'feed';
    }
    return 'standard';
  });

  // Sync with explicit URL view changes
  useEffect(() => {
    if (urlView) {
      setLocalViewMode(urlView);
    }
  }, [urlView]);

  // Synchronize OBS body styling
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

  // Compute highlighted player in active tier bracket
  const highlightedPlayer = useMemo(() => {
    const q = playerSearchTerm.trim().toLowerCase();
    if (!q || !tier.bracket) return null;

    const playerMap = new Map<string, { id: string; name: string }>();
    Object.values(tier.bracket.matchesById).forEach((m: BracketMatch) => {
      if (m.player1?.player?.id && m.player1.player.name) {
        playerMap.set(m.player1.player.id, { id: m.player1.player.id, name: m.player1.player.name });
      }
      if (m.player2?.player?.id && m.player2.player.name) {
        playerMap.set(m.player2.player.id, { id: m.player2.player.id, name: m.player2.player.name });
      }
    });

    const candidates = Array.from(playerMap.values());
    const matches = candidates.filter(p => p.name.toLowerCase().includes(q));

    if (matches.length === 1) return matches[0];
    if (matches.length > 1) {
      const exact = matches.find(p => p.name.toLowerCase() === q);
      if (exact) return exact;
    }
    return null;
  }, [playerSearchTerm, tier.bracket]);

  // OBS Overlay Mode
  if (isObsMode) {
    return (
      <ObsBracketView
        tournament={tournament}
        tier={tier}
        viewMode={localViewMode}
        chroma={chroma}
      />
    );
  }

  const tierBg = tier.backgroundColor || 'var(--color-canvas)';

  const pageContent = (
    <>
      <BracketTierBar
        tournament={tournament}
        activeTier={tier}
        viewMode={localViewMode}
        onChangeViewMode={setLocalViewMode}
        canManage={canManage}
        onOpenShare={() => setIsShareModalOpen(true)}
        playerSearchTerm={playerSearchTerm}
        onPlayerSearchTermChange={setPlayerSearchTerm}
        highlightedPlayerName={highlightedPlayer?.name || null}
      />

      {localViewMode === 'feed' ? (
        <main className="mx-auto w-full max-w-130 flex-1 px-2 py-3">
          <div className="mb-3.5 px-1 py-0">
            <div className="mb-0.5 flex items-center gap-2">
              <span className="text-2xs font-bold tracking-widest text-gold-bright uppercase">
                {canManage ? 'Manage Bracket' : 'Tournament Bracket'}
              </span>
              <span className="text-2xs text-fg-muted">•</span>
              <span
                className="text-2xs font-bold tracking-wide uppercase"
                style={{ color: tier.primaryColor || 'var(--color-gold-bright)' }}
              >
                {tier.name}
              </span>
            </div>
            <h1 className="m-0 text-2xl leading-tight font-extrabold tracking-tight text-white">
              {tournament.name}
            </h1>
          </div>

          <MatchCardFeed
            key={tier.id}
            tournament={tournament}
            tier={tier}
            canManage={canManage}
          />
        </main>
      ) : (
        <main
          className={cn(
            'flex min-h-0 flex-1 flex-col p-0',
            localViewMode === 'fit' ? 'overflow-hidden' : 'overflow-visible'
          )}
        >
          <BracketVisualizer
            tournament={tournament}
            tier={tier}
            isObsMode={false}
            canManage={canManage}
            obsView={localViewMode}
            highlightedPlayerId={highlightedPlayer?.id || null}
          />
        </main>
      )}

      {/* Share Bracket Modal */}
      <ShareBracketModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        tournament={tournament}
        tier={tier}
      />
    </>
  );

  if (isManageRoute) {
    return (
      <TournamentLayout
        tournament={tournament}
        activeTier={tier}
        activeView="bracket"
        contentStyle={{
          background: tierBg,
          minHeight: localViewMode === 'fit' ? '100vh' : '100vh',
          height: localViewMode === 'fit' ? '100vh' : undefined,
          maxHeight: localViewMode === 'fit' ? '100vh' : undefined,
          overflow: localViewMode === 'fit' ? 'hidden' : undefined,
        }}
      >
        {pageContent}
      </TournamentLayout>
    );
  }

  return (
    <SpectatorLayout
      tournament={tournament}
      activeTier={tier}
      activeView="bracket"
      onOpenShare={() => setIsShareModalOpen(true)}
      contentStyle={{
        background: tierBg,
        minHeight: localViewMode === 'fit' ? 'calc(100vh - 56px)' : '100vh',
        height: localViewMode === 'fit' ? 'calc(100vh - 56px)' : undefined,
        maxHeight: localViewMode === 'fit' ? 'calc(100vh - 56px)' : undefined,
        overflow: localViewMode === 'fit' ? 'hidden' : undefined,
      }}
    >
      {pageContent}
    </SpectatorLayout>
  );
};
