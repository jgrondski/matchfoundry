import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Tournament, TournamentTier } from '../features/tournament/types';
import { useOrganization } from '../features/organizations/store';
import { usePinAuth } from '../features/auth/AuthContext';
import { isOnlineQualsOpen } from '../features/online-quals/onlineQualsStatus';
import { getTournamentTargetUrl } from './TournamentSidebar';
import {
  Trophy,
  BarChart3,
  GitBranch,
  Layers,
  Share2,
  Building2,
  ArrowLeft,
  Settings,
  KeyRound,
  Gamepad2,
} from 'lucide-react';
import { ErrorBoundary } from './ErrorBoundary';
import { Button, buttonClasses, Chip, cn } from './ui';

export type SpectatorNavView = 'leaderboard' | 'standings' | 'bracket' | 'qualify';

interface SpectatorLayoutProps {
  tournament: Tournament;
  activeView: SpectatorNavView;
  activeTier?: TournamentTier;
  children: React.ReactNode;
  contentStyle?: React.CSSProperties;
  className?: string;
  onOpenShare?: () => void;
}

export const SpectatorLayout: React.FC<SpectatorLayoutProps> = ({
  tournament,
  activeView,
  activeTier,
  children,
  contentStyle,
  className,
  onOpenShare,
}) => {
  const navigate = useNavigate();
  const { isSystemAdmin, canManage } = usePinAuth();
  const hasManageAccess = isSystemAdmin || canManage(tournament.slug);
  const { getOrganizationById } = useOrganization();
  const org = tournament.organizationId ? getOrganizationById(tournament.organizationId) : undefined;

  const defaultTierSlug = activeTier?.slug || tournament.tiers[0]?.slug;
  const bracketUrl = defaultTierSlug ? `/${tournament.slug}/${defaultTierSlug}` : `/${tournament.slug}/brackets`;
  // Manage-side equivalent of this public view; used by Manage and as the post-login destination.
  const managePath =
    activeView === 'bracket'
      ? defaultTierSlug
        ? `/${tournament.slug}/manage/bracket/${defaultTierSlug}`
        : `/${tournament.slug}/manage/bracket`
      : getTournamentTargetUrl(tournament, activeView === 'qualify' ? 'review' : activeView);

  const navItems = [
    {
      id: 'bracket' as const,
      label: 'Brackets',
      icon: GitBranch,
      to: bracketUrl,
    },
    {
      id: 'leaderboard' as const,
      label: tournament.seedingMethod === 'MANUAL' ? 'Seeding' : 'Qualifiers',
      icon: BarChart3,
      to: `/${tournament.slug}/leaderboard`,
    },
    {
      id: 'standings' as const,
      label: 'Standings',
      icon: Trophy,
      to: `/${tournament.slug}/standings`,
    },
    ...(isOnlineQualsOpen(tournament)
      ? [
          {
            id: 'qualify' as const,
            label: 'Qualify',
            icon: Gamepad2,
            to: `/${tournament.slug}/qualify`,
          },
        ]
      : []),
  ];

  return (
    <div
      className={cn(
        'flex min-h-screen w-full flex-col bg-canvas',
        contentStyle?.height && 'h-screen max-h-screen',
        contentStyle?.overflow && 'overflow-hidden',
        className
      )}
    >
      {/* Public Spectator Top Navigation Header */}
      <header className="sticky top-0 z-50 flex h-14 items-center justify-between gap-4 border-b border-line bg-[rgba(11,14,20,0.94)] px-5 backdrop-blur-md select-none">
        {/* Left: Global Back Link + Tournament Identity */}
        <div className="flex min-w-0 items-center gap-2.5">
          <Link
            to="/"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-sm border border-line-subtle bg-white/5 px-2 py-1 text-xs font-semibold text-fg-secondary no-underline transition-all duration-150"
            title="Return to All Tournaments Directory"
          >
            <ArrowLeft size={13} />
            <span>All Tournaments</span>
          </Link>

          <Link
            to={`/${tournament.slug}`}
            className="flex shrink-0 items-center gap-2 no-underline"
            title="Tournament Public Home"
          >
            <div className="flex size-7.5 items-center justify-center rounded-sm bg-gold shadow-gold">
              <Layers size={16} color="#090d16" />
            </div>
            <div className="flex min-w-0 flex-col">
              <span className="max-w-55 truncate text-base leading-tight font-extrabold tracking-tight text-white">
                {tournament.name}
              </span>
              {org && (
                <span className="flex items-center gap-1 text-2xs text-fg-muted">
                  <Building2 size={10} />
                  {org.name}
                </span>
              )}
            </div>
          </Link>
        </div>

        {/* Center: Spectator Navigation Tabs */}
        <nav
          className="inline-flex items-center gap-1 rounded-full border border-line-subtle bg-white/3 p-1"
          aria-label="Public tournament views"
        >
          {navItems.map(item => {
            const isActive = activeView === item.id;
            const Icon = item.icon;

            return (
              <Chip
                key={item.id}
                active={isActive}
                onClick={() => navigate(item.to)}
                className={cn('gap-1.5', !isActive && 'border-transparent bg-transparent')}
              >
                <Icon size={13} />
                <span>{item.label}</span>
              </Chip>
            );
          })}
        </nav>

        {/* Right: Actions (Share + Director Login) */}
        <div className="flex shrink-0 items-center gap-2.5">
          {onOpenShare && (
            <Button
              variant="primary"
              size="sm"
              onClick={onOpenShare}
              title="Share live bracket with QR code & links"
            >
              <Share2 size={13} />
              <span>Share</span>
            </Button>
          )}

          {hasManageAccess ? (
            <Link
              to={managePath}
              className={buttonClasses({
                variant: 'secondary',
                size: 'sm',
                className: 'border-tier-gold/35 bg-tier-gold/8 px-2.5 text-gold-bright',
              })}
              title="Open Tournament Director Management Portal"
            >
              <Settings size={12} />
              <span>Manage</span>
            </Link>
          ) : (
            <Link
              to={`/admin?slug=${tournament.slug}&redirect=${encodeURIComponent(managePath)}`}
              className={buttonClasses({
                variant: 'secondary',
                size: 'sm',
                className: 'px-2.5 text-fg-muted hover:border-fg-secondary hover:bg-highlight',
              })}
              title="Staff & Director PIN Login"
            >
              <KeyRound size={12} />
              <span>Staff Login</span>
            </Link>
          )}
        </div>
      </header>

      {/* Main Page Content */}
      <div className="flex min-w-0 flex-1 flex-col" style={{ ...contentStyle }}>
        <ErrorBoundary fallbackTitle="Spectator View Failed to Render">
          {children}
        </ErrorBoundary>
      </div>
    </div>
  );
};
