import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Tournament, TournamentTier } from '../../tournament/types';
import { setStoredTierSlug } from '../../tournament/tierStorage';
import { getContrastingTextColor } from '../colorUtils';
import { BracketViewMode } from '../bracketLayout';
import {
  Plus,
  Monitor,
  Maximize2,
  Split,
  ListFilter,
  Share2,
  Search,
  X,
} from 'lucide-react';
import { TournamentQualTimerHud } from '../../qualifiers/components/TournamentQualTimerHud';
import { Button, buttonClasses, Chip, cn, IconButton } from '../../../components/ui';

interface BracketTierBarProps {
  tournament: Tournament;
  activeTier: TournamentTier;
  viewMode?: BracketViewMode;
  onChangeViewMode?: (mode: BracketViewMode) => void;
  canManage?: boolean;
  onOpenShare?: () => void;
  playerSearchTerm?: string;
  onPlayerSearchTermChange?: (term: string) => void;
  highlightedPlayerName?: string | null;
}

export const BracketTierBar: React.FC<BracketTierBarProps> = ({
  tournament,
  activeTier,
  viewMode = 'standard',
  onChangeViewMode,
  canManage = true,
  onOpenShare,
  playerSearchTerm,
  onPlayerSearchTermChange,
  highlightedPlayerName,
}) => {
  const navigate = useNavigate();
  const sortedTiers = [...tournament.tiers].sort((a, b) => a.priority - b.priority);
  const isAcceleratedHybrid = activeTier.bracket?.bracketRouting === 'ACCELERATED_HYBRID';
  const tierBarRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!tierBarRef.current) return;
    const updateH = () => {
      if (tierBarRef.current) {
        document.documentElement.style.setProperty(
          '--bracket-tier-bar-height',
          `${tierBarRef.current.offsetHeight}px`
        );
      }
    };
    updateH();
    const observer = new ResizeObserver(updateH);
    observer.observe(tierBarRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={tierBarRef}
      id="bracket-tier-bar"
      className={cn(
        'z-42 flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface py-2.5 px-5 select-none',
        viewMode === 'fit' ? 'relative top-0' : ['sticky', canManage ? 'top-0' : 'top-14']
      )}
    >
      {/* Left: Tier Filter Chips */}
      <div className="flex flex-wrap items-center gap-3.5">
        <span className="mr-1 text-2xs font-bold uppercase tracking-wider text-fg-muted">
          Tier:
        </span>

        {sortedTiers.map(tier => {
          const isActive = tier.id === activeTier.id;
          const tierColor = tier.primaryColor || '#f59e0b';
          const contrastColor = getContrastingTextColor(tierColor);

          return (
            <Chip
              key={tier.id}
              active={isActive}
              accent={{ color: tierColor, textColor: contrastColor }}
              onClick={() => {
                if (!isActive) {
                  setStoredTierSlug(tournament.slug, tier.slug);
                  const targetUrl = canManage
                    ? `/${tournament.slug}/manage/bracket/${tier.slug}`
                    : `/${tournament.slug}/${tier.slug}`;
                  navigate(targetUrl);
                }
              }}
            >
              <span
                className="inline-block size-1.75 rounded-full"
                style={{ background: isActive ? contrastColor : tierColor }}
              />
              <span>{tier.name}</span>
              <span className={cn('text-2xs font-medium', isActive ? 'opacity-90' : 'opacity-70')}>
                ({tier.playerCount})
              </span>
            </Chip>
          );
        })}

        {canManage && (
          <Link
            to={`/${tournament.slug}/manage/settings`}
            className={buttonClasses({
              variant: 'secondary',
              className:
                'gap-1 rounded-full py-1 px-2.5 text-xs text-fg-muted hover:bg-highlight hover:border-fg-secondary',
            })}
            title="Configure Tiers in Tournament Settings"
          >
            <Plus size={13} />
            <span>Add Tier</span>
          </Link>
        )}
      </div>

      {/* Right: Player Search, View Mode Toggle & Share Button */}
      <div className="flex flex-wrap items-center gap-2.5">
        {!canManage && <TournamentQualTimerHud tournament={tournament} compact readOnly={true} />}
        {/* Bracket Player Search - Hidden on Mobile Feed */}
        {viewMode !== 'feed' && onPlayerSearchTermChange !== undefined && (
          <div className="relative flex w-46.25 max-w-full items-center">
            <Search
              size={13}
              color={highlightedPlayerName ? 'var(--color-gold-bright)' : 'var(--color-text-muted)'}
              className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2"
            />
            <input
              id="bracket-player-search-input"
              type="text"
              placeholder="Highlight player..."
              value={playerSearchTerm || ''}
              onChange={e => onPlayerSearchTermChange(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Escape') onPlayerSearchTermChange('');
              }}
              className={cn(
                'w-full rounded-sm border bg-canvas py-1.5 pl-7 text-caption text-fg outline-none transition-[border-color,box-shadow] duration-150',
                playerSearchTerm ? 'pr-6.5' : 'pr-2.5',
                highlightedPlayerName
                  ? 'border-gold-bright shadow-[0_0_8px_rgba(245,158,11,0.25)]'
                  : 'border-line shadow-none'
              )}
              title="Search player to highlight their bracket journey"
            />
            {playerSearchTerm && (
              <IconButton
                onClick={() => onPlayerSearchTermChange('')}
                title="Clear player search"
                aria-label="Clear player search"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5"
              >
                <X size={12} />
              </IconButton>
            )}
          </div>
        )}

        {onChangeViewMode && (
          <div className="inline-flex items-center gap-0.5 rounded-sm border border-line bg-canvas p-0.5">
            <Chip
              size="sm"
              active={viewMode === 'standard'}
              onClick={() => onChangeViewMode('standard')}
              title="Standard Tree with Horizontal Scroll"
            >
              <Maximize2 size={12} />
              <span>Standard</span>
            </Chip>

            <Chip
              size="sm"
              active={viewMode === 'fit'}
              onClick={() => onChangeViewMode('fit')}
              title="Auto-Fit to 1080p / Window (No scroll)"
            >
              <Monitor size={12} />
              <span>Fit Screen</span>
            </Chip>

            <Chip
              size="sm"
              active={viewMode === 'split'}
              onClick={() => onChangeViewMode('split')}
              title={isAcceleratedHybrid ? 'Side-by-Side Pods (Pod 3 to right of Pod 2)' : 'Bilateral Split Wings (Center Finals)'}
            >
              <Split size={12} />
              <span>Split Wings</span>
            </Chip>

            <Chip
              size="sm"
              active={viewMode === 'feed'}
              onClick={() => onChangeViewMode('feed')}
              title="Mobile Bracket Feed"
            >
              <ListFilter size={12} />
              <span>Mobile</span>
            </Chip>
          </div>
        )}

        {/* Share Bracket Button (Only in Manage Mode - Public View has Share in top SpectatorLayout header) */}
        {canManage && onOpenShare && (
          <Button
            variant="primary"
            size="sm"
            onClick={onOpenShare}
            title="Share bracket link & venue QR code"
          >
            <Share2 size={13} />
            <span>Share</span>
          </Button>
        )}
      </div>
    </div>
  );
};
