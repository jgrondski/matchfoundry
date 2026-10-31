import React from 'react';
import { cn } from '../../../components/ui';
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
      <span className={cn('inline-flex items-center gap-1.5', className)}>
        <img
          src={customSrc}
          alt={player.name || 'Player'}
          onError={() => setHasImgError(true)}
          className="inline-block rounded-full object-cover align-middle"
          style={{
            width: dim,
            height: dim,
            minWidth: dim,
            minHeight: dim,
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
        style={style ? { ...style } : undefined}
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
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <span
        data-testid="player-initial-avatar"
        className="inline-flex shrink-0 items-center justify-center rounded-full border border-line bg-elevated font-bold uppercase text-fg shadow-[0_1px_2px_rgba(0,0,0,0.2)] align-middle select-none"
        style={{
          width: dim,
          height: dim,
          minWidth: dim,
          minHeight: dim,
          fontSize,
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
