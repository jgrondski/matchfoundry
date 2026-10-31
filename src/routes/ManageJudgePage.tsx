import React from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useTournament } from '../features/tournament/store';
import { Tournament } from '../features/tournament/types';
import { getStoredTierSlug, setStoredTierSlug } from '../features/tournament/tierStorage';
import { TournamentLayout } from '../components/TournamentLayout';
import { MatchCardFeed } from '../features/bracket/components/MatchCardFeed';
import { getContrastingTextColor } from '../features/bracket/colorUtils';
import { GitBranch } from 'lucide-react';
import { LoadingScreen } from '../components/LoadingScreen';
import { Button, buttonClasses, Chip, cn } from '../components/ui';
import { THEME_FALLBACK } from '../theme/palette';

/**
 * Tier 1: Route Gate (Hydration & Data Boundary)
 * - Zero local form state
 * - Zero useEffects
 * - Unconditional hook execution
 */
export const ManageJudgePage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { getTournamentBySlug, isLoading, isHydrated } = useTournament();

  if (isLoading || !isHydrated) {
    return <LoadingScreen message="Loading floor judge..." />;
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

  return <ManageJudgeView key={tournament.id} tournament={tournament} />;
};

/**
 * Tier 2: Keyed Feature View
 * - key={tournament.id} guarantees clean state reset on tournament switch
 * - Purely derives active tier from URL search params without useEffect sync loops
 */
interface ManageJudgeViewProps {
  tournament: Tournament;
}

const ManageJudgeView: React.FC<ManageJudgeViewProps> = ({ tournament }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const sortedTiers = [...tournament.tiers].sort((a, b) => a.priority - b.priority);
  const storedTier = getStoredTierSlug(tournament.slug);
  const requestedTierSlug = searchParams.get('tier') || storedTier || sortedTiers[0]?.slug;
  const tier = sortedTiers.find(t => t.slug === requestedTierSlug || t.id === requestedTierSlug) || sortedTiers[0];

  if (!tier) {
    return (
      <TournamentLayout tournament={tournament} activeView="judge">
        <main className="mx-auto flex max-w-150 flex-1 flex-col items-center justify-center gap-4 px-6 py-12 text-center">
          <h2 className="text-2xl font-bold text-fg">No Bracket Tiers Configured</h2>
          <p className="text-sm leading-normal text-fg-secondary">
            Floor Judge requires at least one bracket tier to manage matches. Once bracket tiers are configured, matches will appear here for scoring.
          </p>
          <div className="mt-2 flex flex-wrap justify-center gap-3">
            <Button variant="secondary" onClick={() => navigate(`/${tournament.slug}/leaderboard`)}>
              🏆 View Qualifiers
            </Button>
            <Button variant="primary" onClick={() => navigate(`/${tournament.slug}/manage/settings`)}>
              ⚙️ Configure Tiers in Settings
            </Button>
          </div>
        </main>
      </TournamentLayout>
    );
  }

  const handleSelectTier = (tSlug: string) => {
    setStoredTierSlug(tournament.slug, tSlug);
    setSearchParams({ tier: tSlug });
  };

  return (
    <TournamentLayout
      tournament={tournament}
      activeTier={tier}
      activeView="judge"
    >
      {/* In-Page Tier Selector Bar */}
      <div className="sticky top-0 z-40 flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface px-5 py-2.5 select-none">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold tracking-wider text-fg-muted uppercase">
            Tier:
          </span>
          {sortedTiers.map(t => {
            const isActive = t.id === tier.id;
            const tierColor = t.primaryColor || THEME_FALLBACK.primaryColor;
            const contrastColor = getContrastingTextColor(tierColor);

            return (
              <Chip
                key={t.id}
                active={isActive}
                accent={{ color: tierColor, textColor: contrastColor }}
                onClick={() => handleSelectTier(t.slug)}
              >
                <span
                  className="inline-block size-1.75 rounded-full"
                  style={{ background: isActive ? contrastColor : tierColor }}
                />
                <span>{t.name}</span>
                <span className={cn('text-2xs font-medium', isActive ? 'opacity-90' : 'opacity-70')}>
                  ({t.playerCount})
                </span>
              </Chip>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            to={`/${tournament.slug}/manage/bracket/${tier.slug}`}
            className={buttonClasses({
              variant: 'secondary',
              size: 'sm',
              className: 'text-fg-secondary hover:border-fg-secondary hover:bg-highlight',
            })}
            title="Open Visual Bracket for this Tier"
          >
            <GitBranch size={13} />
            <span>View Bracket</span>
          </Link>
        </div>
      </div>

      <main className="mx-auto w-full max-w-130 flex-1 px-2 py-3">
        <div className="mb-3.5 px-1 py-0">
          <div className="mb-0.5 flex items-center gap-2">
            <span className="text-2xs font-bold tracking-widest text-gold-bright uppercase">
              Judge's Score Sheet
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
        />
      </main>
    </TournamentLayout>
  );
};
