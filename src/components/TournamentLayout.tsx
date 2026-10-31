import React from 'react';
import { cn } from './ui';
import { Tournament, TournamentTier } from '../features/tournament/types';
import { TournamentSidebar, SidebarNavView } from './TournamentSidebar';
import { ErrorBoundary } from './ErrorBoundary';

interface TournamentLayoutProps {
  tournament?: Tournament;
  activeTier?: TournamentTier;
  activeView?: SidebarNavView;
  children: React.ReactNode;
  contentStyle?: React.CSSProperties;
  className?: string;
  onNavigate?: (url: string) => boolean | void;
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
};
