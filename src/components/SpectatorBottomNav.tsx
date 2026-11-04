import React from 'react';
import { Link } from 'react-router-dom';
import type { SpectatorNavItem } from './SpectatorLayout';
import { cn } from './ui';

interface SpectatorBottomNavProps {
  items: SpectatorNavItem[];
  activeView: SpectatorNavItem['id'];
}

export const SpectatorBottomNav: React.FC<SpectatorBottomNavProps> = ({ items, activeView }) => (
  <nav
    aria-label="Tournament sections"
    className="fixed inset-x-0 bottom-0 z-50 grid border-t border-line bg-canvas/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
    style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
  >
    {items.map(item => {
      const active = item.id === activeView;
      const Icon = item.icon;
      return (
        <Link
          key={item.id}
          to={item.to}
          aria-current={active ? 'page' : undefined}
          className={cn(
            'flex h-14 flex-col items-center justify-center gap-0.5 text-2xs font-semibold no-underline',
            active ? 'text-gold-bright' : 'text-fg-muted'
          )}
        >
          <Icon size={20} />
          <span>{item.label}</span>
        </Link>
      );
    })}
  </nav>
);
