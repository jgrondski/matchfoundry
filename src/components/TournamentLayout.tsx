import React, { useState } from 'react';
import { cn, useIsMobile } from './ui';
import { Overlay } from './overlay';
import { Tournament, TournamentTier } from '../features/tournament/types';
import {
  TournamentSidebar,
  SidebarNavView,
  getPublicViewUrl,
  resolveCurrentTierSlug,
} from './TournamentSidebar';
import { AdminMobileTopBar } from './AdminMobileTopBar';
import { AdminBottomNav } from './AdminBottomNav';
import { countPendingReviewSessions } from '../features/online-quals/sessionDerivation';
import { ErrorBoundary } from './ErrorBoundary';

interface TournamentLayoutProps {
  tournament?: Tournament;
  activeTier?: TournamentTier;
  activeView?: SidebarNavView;
  children: React.ReactNode;
  contentStyle?: React.CSSProperties;
  className?: string;
  onNavigate?: (url: string, onLeave?: () => void) => boolean | void;
}

export const TournamentLayout: React.FC<TournamentLayoutProps> = ({
  tournament,
  activeTier,
  activeView,
  children,
  contentStyle,
  className,
  onNavigate,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const isMobile = useIsMobile();

  const handleMenuNavigate = (url: string, onLeave?: () => void) => {
    const allowed = onNavigate?.(url, onLeave);
    if (allowed !== false) setMenuOpen(false);
    return allowed;
  };

  if (!isMobile) {
    return (
      <div className={cn('flex min-h-screen w-full bg-canvas', className)}>
        <TournamentSidebar
          tournament={tournament}
          activeTier={activeTier}
          activeView={activeView}
          onNavigate={onNavigate}
        />
        <div className="flex min-w-0 flex-1 flex-col" style={{ ...contentStyle }}>
          <ErrorBoundary fallbackTitle="View Failed to Render">
            {children}
          </ErrorBoundary>
        </div>
      </div>
    );
  }

  const tierSlug = resolveCurrentTierSlug(tournament, activeTier);

  return (
    <div className={cn('flex min-h-screen w-full bg-canvas max-md:flex-col', className)}>
      <AdminMobileTopBar
        title={tournament?.name ?? 'MatchFoundry'}
        publicUrl={tournament ? getPublicViewUrl(tournament.slug, tierSlug) : undefined}
      />
      <div
        className="flex min-w-0 flex-1 flex-col max-md:pb-[calc(3.5rem+env(safe-area-inset-bottom))]"
        style={{ ...contentStyle }}
      >
        <ErrorBoundary fallbackTitle="View Failed to Render">
          {children}
        </ErrorBoundary>
      </div>
      <AdminBottomNav
        slug={tournament?.slug}
        currentTierSlug={tierSlug}
        seedingMethod={tournament?.seedingMethod}
        pendingReviewCount={countPendingReviewSessions(tournament)}
        activeView={activeView}
        menuOpen={menuOpen}
        onToggleMenu={() => setMenuOpen(o => !o)}
        onNavigate={handleMenuNavigate}
      />
      <Overlay
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        variant="drawer"
        aria-label="Tournament menu"
        panelClassName="max-md:mb-[calc(3.5rem+env(safe-area-inset-bottom))] max-md:pb-0 max-md:max-h-[calc(92dvh-3.5rem)] border-t border-line bg-surface"
      >
        <div id="admin-menu-sheet">
          <TournamentSidebar
            tournament={tournament}
            activeTier={activeTier}
            activeView={activeView}
            variant="sheet"
            onNavigate={handleMenuNavigate}
          />
        </div>
      </Overlay>
    </div>
  );
};
