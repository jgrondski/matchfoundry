import React from 'react';
import { PlayerProfile } from '../../tournament/types';
import { CountryFlag } from '../flagUtils';
import { getEffectivePlayerName } from '../playerNameUtils';

export interface PlayerAvatarProps {
  player?: Pick<PlayerProfile, 'avatarType' | 'avatarUrl' | 'avatarThumbnailUrl' | 'country' | 'name' | 'displayName' | 'nickname'> | null;
  country?: string;
  size?: number | string;
  showName?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export const PlayerAvatar: React.FC<PlayerAvatarProps> = React.memo(({
  player,
  country,
  size = 20,
  showName = false,
  className,
  style,
}) => {
  const [hasImgError, setHasImgError] = React.useState(false);
  const finalCountry = player?.country ?? country;
  const isCustom = player?.avatarType === 'custom' && Boolean(player?.avatarUrl);
  const customSrc = player?.avatarThumbnailUrl || player?.avatarUrl;

  // Reset img error if source URL changes
  React.useEffect(() => {
    setHasImgError(false);
  }, [customSrc]);

  if (isCustom && customSrc && !hasImgError) {
    const dim = typeof size === 'number' ? `${size}px` : size;
    return (
      <span
        className={`inline-flex items-center gap-1.5 ${className || ''}`}
        style={{ display: 'inline-flex', alignItems: 'center' }}
      >
        <img
          src={customSrc}
          alt={player.name || 'Player'}
          onError={() => setHasImgError(true)}
          style={{
            width: dim,
            height: dim,
            minWidth: dim,
            minHeight: dim,
            borderRadius: '50%',
            objectFit: 'cover',
            display: 'inline-block',
            verticalAlign: 'middle',
            ...style,
          }}
        />
        {showName && player && <span>{getEffectivePlayerName(player)}</span>}
      </span>
    );
  }

  if (finalCountry) {
    return (
      <CountryFlag
        country={finalCountry}
        showName={showName}
        className={className}
        style={style}
      />
    );
  }

  // Fallback for players without assigned country (e.g. un-reconciled walk-ins):
  // Render the first letter of their Player Name in place of the country flag.
  const rawName = player?.name || player?.displayName || '';
  const initial = rawName.trim().charAt(0).toUpperCase() || '?';
  const dim = typeof size === 'number' ? `${size}px` : size;
  const numSize = typeof size === 'number' ? size : 20;
  const fontSize = typeof size === 'number' ? `${Math.max(10, Math.round(numSize * 0.55))}px` : '0.75em';

  return (
    <span
      className={`inline-flex items-center gap-1.5 ${className || ''}`}
      style={{ display: 'inline-flex', alignItems: 'center' }}
    >
      <span
        data-testid="player-initial-avatar"
        style={{
          width: dim,
          height: dim,
          minWidth: dim,
          minHeight: dim,
          borderRadius: '50%',
          background: 'var(--color-bg-surface-elevated, #27272a)',
          border: '1px solid var(--color-border, #3f3f46)',
          color: 'var(--color-text-main, #ffffff)',
          fontSize,
          fontWeight: 700,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          textTransform: 'uppercase',
          userSelect: 'none',
          verticalAlign: 'middle',
          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.2)',
          flexShrink: 0,
          ...style,
        }}
        title={player?.name || 'Player'}
      >
        {initial}
      </span>
      {showName && player && <span>{getEffectivePlayerName(player)}</span>}
    </span>
  );
});
