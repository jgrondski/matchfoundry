import React from 'react';
import { Trophy, Search, Video, ExternalLink, X } from 'lucide-react';
import { buttonClasses, cn, IconButton } from './ui';

export interface TournamentPageHeaderProps {
  eyebrow: string;
  title: string;
  icon?: React.ReactNode;
  subtitle?: React.ReactNode;
  searchTerm?: string;
  onSearchChange?: (term: string) => void;
  searchPlaceholder?: string;
  obsUrl?: string;
  action?: React.ReactNode;
  isObsMode?: boolean;
}

export const TournamentPageHeader: React.FC<TournamentPageHeaderProps> = ({
  eyebrow,
  title,
  icon,
  subtitle,
  searchTerm,
  onSearchChange,
  searchPlaceholder = 'Search competitor, country, style...',
  obsUrl,
  action,
  isObsMode = false,
}) => {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      {/* Title & Eyebrow */}
      <div>
        <div className="mb-1 flex items-center gap-2">
          <span className="text-caption font-bold tracking-widest text-gold-bright uppercase">{eyebrow}</span>
        </div>
        <h1
          className={cn(
            'm-0 flex items-center gap-2.5 font-extrabold tracking-tight text-white',
            isObsMode ? 'text-2xl' : 'text-3xl'
          )}
        >
          {icon || <Trophy color="var(--color-gold-bright)" size={isObsMode ? 24 : 28} />}
          {title}
        </h1>
        {subtitle && <div className="mt-1.5">{subtitle}</div>}
      </div>

      {/* Action Controls & Search Group */}
      {!isObsMode && (
        <div className="flex flex-wrap items-center gap-3">
          {action}

          {obsUrl && (
            <a
              href={obsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonClasses({
                variant: 'secondary',
                className:
                  'gap-1.5 px-3.5 py-2 text-caption whitespace-nowrap hover:border-fg-secondary hover:bg-highlight',
              })}
              title="Open OBS broadcast overlay in new tab (stripped chrome, transparent background)"
            >
              <Video size={15} color="var(--color-gold-bright)" />
              <span>OBS Overlay</span>
              <ExternalLink size={13} />
            </a>
          )}

          {onSearchChange !== undefined && (
            <div className="relative w-70 max-w-full">
              <Search
                size={16}
                color="var(--color-fg-muted)"
                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2"
              />
              <input
                type="text"
                placeholder={searchPlaceholder}
                value={searchTerm || ''}
                onChange={e => onSearchChange(e.target.value)}
                className={cn(
                  'w-full rounded-md border border-line bg-surface py-2 pl-9 text-sm text-fg outline-none transition-colors duration-150',
                  searchTerm ? 'pr-8' : 'pr-3.5'
                )}
              />
              {searchTerm && (
                <IconButton
                  onClick={() => onSearchChange('')}
                  title="Clear search"
                  aria-label="Clear search"
                  className="absolute top-1/2 right-2 -translate-y-1/2 p-0.5"
                >
                  <X size={14} />
                </IconButton>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
