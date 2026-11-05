import React from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, CheckCircle2, GitBranch, Menu, Scale, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from './ui';
import type { Tournament } from '../features/tournament/types';
import type { SidebarNavView } from './TournamentSidebar';

export interface AdminBottomNavProps {
  /** undefined: only the Menu button renders. */
  slug?: string;
  currentTierSlug?: string;
  seedingMethod?: Tournament['seedingMethod'];
  pendingReviewCount: number;
  activeView?: SidebarNavView;
  menuOpen: boolean;
  onToggleMenu: () => void;
  /** The layout's guarded navigate. */
  onNavigate: (url: string) => boolean | void;
}

export const ADMIN_BOTTOM_NAV_HEIGHT_CLASS = 'h-14';

interface ShortcutItem {
  key: string;
  label: string;
  icon: LucideIcon;
  to: string;
  view: SidebarNavView;
}

const itemClass = (active: boolean) =>
  cn(
    'relative flex h-14 flex-col items-center justify-center gap-0.5 text-2xs font-semibold no-underline',
    active ? 'text-gold-bright' : 'text-fg-muted'
  );

export const AdminBottomNav: React.FC<AdminBottomNavProps> = ({
  slug,
  currentTierSlug,
  seedingMethod,
  pendingReviewCount,
  activeView,
  menuOpen,
  onToggleMenu,
  onNavigate,
}) => {
  const items: ShortcutItem[] = slug
    ? [
        {
          key: 'judge',
          label: 'Judge',
          icon: Scale,
          to: currentTierSlug ? `/${slug}/manage/judge?tier=${currentTierSlug}` : `/${slug}/manage/judge`,
          view: 'judge',
        },
        {
          key: 'quals',
          label: seedingMethod === 'MANUAL' ? 'Seeding' : 'Quals',
          icon: BarChart3,
          to: `/${slug}/manage/qualifiers`,
          view: 'leaderboard',
        },
        {
          key: 'review',
          label: 'Review',
          icon: CheckCircle2,
          to: `/${slug}/manage/review`,
          view: 'review',
        },
        {
          key: 'bracket',
          label: 'Bracket',
          icon: GitBranch,
          to: currentTierSlug ? `/${slug}/manage/bracket/${currentTierSlug}` : `/${slug}/manage/bracket`,
          view: 'bracket',
        },
      ]
    : [];

  return (
    <nav
      aria-label="Tournament management"
      className={cn(
        'fixed inset-x-0 bottom-0 grid grid-cols-5 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden',
        menuOpen ? 'z-1001' : 'z-50'
      )}
    >
      {items.map(item => {
        const active = activeView === item.view;
        const Icon = item.icon;
        const showCount = item.key === 'review' && pendingReviewCount > 0;
        return (
          <Link
            key={item.key}
            to={item.to}
            aria-current={active ? 'page' : undefined}
            aria-label={showCount ? `Review, ${pendingReviewCount} pending` : undefined}
            onClick={e => {
              if (onNavigate(item.to) === false) e.preventDefault();
            }}
            className={itemClass(active)}
          >
            <Icon size={20} />
            <span>{item.label}</span>
            {showCount && (
              <span className="absolute top-1.5 left-1/2 ml-2 min-w-4 rounded-full bg-gold px-1 text-center text-3xs font-bold text-canvas">
                {pendingReviewCount}
              </span>
            )}
          </Link>
        );
      })}
      <button
        type="button"
        aria-expanded={menuOpen}
        aria-controls="admin-menu-sheet"
        onClick={onToggleMenu}
        className={cn(itemClass(menuOpen), 'col-start-5 cursor-pointer border-0 bg-transparent')}
      >
        {menuOpen ? <X size={20} /> : <Menu size={20} />}
        <span>{menuOpen ? 'Close' : 'Menu'}</span>
      </button>
    </nav>
  );
};
