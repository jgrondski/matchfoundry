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
      style={{
        position: viewMode === 'fit' ? 'relative' : 'sticky',
        top: viewMode === 'fit' ? 0 : (canManage ? 0 : '56px'),
        zIndex: 42,
        padding: '0.65rem 1.25rem',
        background: 'var(--color-bg-surface)',
        borderBottom: '1px solid var(--color-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.75rem',
        userSelect: 'none',
      }}
    >
      {/* Left: Tier Filter Chips */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap' }}>
        <span
          style={{
            fontSize: '0.7rem',
            fontWeight: 700,
            color: 'var(--color-text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            marginRight: '0.2rem',
          }}
        >
          Tier:
        </span>

        {sortedTiers.map(tier => {
          const isActive = tier.id === activeTier.id;
          const tierColor = tier.primaryColor || '#f59e0b';
          const contrastColor = getContrastingTextColor(tierColor);

          return (
            <button
              key={tier.id}
              type="button"
              onClick={() => {
                if (!isActive) {
                  setStoredTierSlug(tournament.slug, tier.slug);
                  const targetUrl = canManage
                    ? `/${tournament.slug}/manage/bracket/${tier.slug}`
                    : `/${tournament.slug}/${tier.slug}`;
                  navigate(targetUrl);
                }
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.35rem 0.85rem',
                borderRadius: 'var(--radius-full)',
                fontSize: '0.78rem',
                fontWeight: isActive ? 800 : 600,
                background: isActive ? tierColor : 'var(--color-bg-base)',
                color: isActive ? contrastColor : 'var(--color-text-secondary)',
                border: isActive ? `1px solid ${tierColor}` : '1px solid var(--color-border)',
                cursor: isActive ? 'default' : 'pointer',
                transition: 'all 0.15s ease',
                boxShadow: isActive ? `0 0 10px ${tierColor}40` : 'none',
              }}
            >
              <span
                style={{
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  background: isActive ? contrastColor : tierColor,
                  display: 'inline-block',
                }}
              />
              <span>{tier.name}</span>
              <span
                style={{
                  fontSize: '0.7rem',
                  opacity: isActive ? 0.9 : 0.7,
                  fontWeight: 500,
                }}
              >
                ({tier.playerCount})
              </span>
            </button>
          );
        })}

        {canManage && (
          <Link
            to={`/${tournament.slug}/manage/settings`}
            className="btn btn-secondary"
            style={{
              padding: '0.3rem 0.65rem',
              fontSize: '0.75rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.3rem',
              borderRadius: 'var(--radius-full)',
              color: 'var(--color-text-muted)',
            }}
            title="Configure Tiers in Tournament Settings"
          >
            <Plus size={13} />
            <span>Add Tier</span>
          </Link>
        )}
      </div>

      {/* Right: Player Search, View Mode Toggle & Share Button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
        <TournamentQualTimerHud tournament={tournament} compact />
        {/* Bracket Player Search - Hidden on Mobile Feed */}
        {viewMode !== 'feed' && onPlayerSearchTermChange !== undefined && (
          <div
            style={{
              position: 'relative',
              width: '185px',
              maxWidth: '100%',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <Search
              size={13}
              color={highlightedPlayerName ? 'var(--color-gold-bright)' : 'var(--color-text-muted)'}
              style={{
                position: 'absolute',
                left: '8px',
                top: '50%',
                transform: 'translateY(-50%)',
                pointerEvents: 'none',
              }}
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
              style={{
                width: '100%',
                padding: playerSearchTerm
                  ? '0.32rem 1.6rem 0.32rem 1.7rem'
                  : '0.32rem 0.65rem 0.32rem 1.7rem',
                borderRadius: 'var(--radius-sm)',
                border: highlightedPlayerName
                  ? '1px solid var(--color-gold-bright)'
                  : '1px solid var(--color-border)',
                background: 'var(--color-bg-base)',
                color: 'var(--color-text-primary)',
                fontSize: '0.78rem',
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                boxShadow: highlightedPlayerName
                  ? '0 0 8px rgba(245, 158, 11, 0.25)'
                  : 'none',
              }}
              title="Search player to highlight their bracket journey"
            />
            {playerSearchTerm && (
              <button
                type="button"
                onClick={() => onPlayerSearchTermChange('')}
                title="Clear player search"
                aria-label="Clear player search"
                style={{
                  position: 'absolute',
                  right: '6px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 'none',
                  padding: '2px',
                  cursor: 'pointer',
                  color: 'var(--color-text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={12} />
              </button>
            )}
          </div>
        )}

        {onChangeViewMode && (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              background: 'var(--color-bg-base)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)',
              padding: '2px',
              gap: '2px',
            }}
          >
            <button
              type="button"
              onClick={() => onChangeViewMode('standard')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.3rem 0.6rem',
                borderRadius: 'var(--radius-xs)',
                fontSize: '0.72rem',
                fontWeight: viewMode === 'standard' ? 700 : 500,
                background: viewMode === 'standard' ? 'var(--color-bg-surface-elevated)' : 'transparent',
                color: viewMode === 'standard' ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                border: 'none',
                cursor: 'pointer',
              }}
              title="Standard Tree with Horizontal Scroll"
            >
              <Maximize2 size={12} />
              <span>Standard</span>
            </button>

            <button
              type="button"
              onClick={() => onChangeViewMode('fit')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.3rem 0.6rem',
                borderRadius: 'var(--radius-xs)',
                fontSize: '0.72rem',
                fontWeight: viewMode === 'fit' ? 700 : 500,
                background: viewMode === 'fit' ? 'var(--color-bg-surface-elevated)' : 'transparent',
                color: viewMode === 'fit' ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                border: 'none',
                cursor: 'pointer',
              }}
              title="Auto-Fit to 1080p / Window (No scroll)"
            >
              <Monitor size={12} />
              <span>Fit Screen</span>
            </button>

            <button
              type="button"
              onClick={() => onChangeViewMode('split')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.3rem 0.6rem',
                borderRadius: 'var(--radius-xs)',
                fontSize: '0.72rem',
                fontWeight: viewMode === 'split' ? 700 : 500,
                background: viewMode === 'split' ? 'var(--color-bg-surface-elevated)' : 'transparent',
                color: viewMode === 'split' ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                border: 'none',
                cursor: 'pointer',
              }}
              title={isAcceleratedHybrid ? 'Side-by-Side Pods (Pod 3 to right of Pod 2)' : 'Bilateral Split Wings (Center Finals)'}
            >
              <Split size={12} />
              <span>Split Wings</span>
            </button>

            <button
              type="button"
              onClick={() => onChangeViewMode('feed')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.3rem 0.6rem',
                borderRadius: 'var(--radius-xs)',
                fontSize: '0.72rem',
                fontWeight: viewMode === 'feed' ? 700 : 500,
                background: viewMode === 'feed' ? 'var(--color-bg-surface-elevated)' : 'transparent',
                color: viewMode === 'feed' ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                border: 'none',
                cursor: 'pointer',
              }}
              title="Mobile Bracket Feed"
            >
              <ListFilter size={12} />
              <span>Mobile</span>
            </button>
          </div>
        )}

        {/* Share Bracket Button (Only in Manage Mode - Public View has Share in top SpectatorLayout header) */}
        {canManage && onOpenShare && (
          <button
            type="button"
            onClick={onOpenShare}
            className="btn btn-primary"
            style={{
              padding: '0.35rem 0.75rem',
              fontSize: '0.75rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              borderRadius: 'var(--radius-sm)',
            }}
            title="Share bracket link & venue QR code"
          >
            <Share2 size={13} />
            <span>Share</span>
          </button>
        )}
      </div>
    </div>
  );
};
