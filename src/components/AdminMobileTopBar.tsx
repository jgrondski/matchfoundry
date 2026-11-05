import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Eye } from 'lucide-react';
import { buttonClasses, cn } from './ui';

interface AdminMobileTopBarProps {
  /** Tournament name, or "MatchFoundry" when there is none. */
  title: string;
  /** Public view of the current tournament. */
  publicUrl?: string;
}

export const AdminMobileTopBar: React.FC<AdminMobileTopBarProps> = ({ title, publicUrl }) => (
  <header className="sticky top-0 z-90 flex h-12 items-center gap-2 border-b border-line bg-surface px-3 md:hidden">
    <Link to="/" aria-label="All tournaments" className={cn(buttonClasses({ variant: 'ghost', size: 'sm' }), '-ml-2 px-2')}>
      <ArrowLeft size={18} />
    </Link>
    <span className="min-w-0 flex-1 truncate text-sm font-bold text-fg">{title}</span>
    {publicUrl && (
      <Link to={publicUrl} className={buttonClasses({ variant: 'ghost', size: 'sm' })}>
        <Eye size={16} />
        Public
      </Link>
    )}
  </header>
);
