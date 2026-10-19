import React from 'react';
import { PlayerProfile } from '../../tournament/types';
import { CountryFlag } from '../flagUtils';

export interface PlayerAvatarProps {
  player?: Pick<PlayerProfile, 'avatarType' | 'avatarUrl' | 'avatarThumbnailUrl' | 'country' | 'name'> | null;
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
  const finalCountry = player?.country ?? country;
  const isCustom = player?.avatarType === 'custom' && Boolean(player?.avatarUrl);
  const customSrc = player?.avatarThumbnailUrl || player?.avatarUrl;

  if (isCustom && customSrc) {
    const dim = typeof size === 'number' ? `${size}px` : size;
    return (
      <span
        className={`inline-flex items-center gap-1.5 ${className || ''}`}
        style={{ display: 'inline-flex', alignItems: 'center' }}
      >
        <img
          src={customSrc}
          alt={player.name || 'Player'}
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
        {showName && player.name && <span>{player.name}</span>}
      </span>
    );
  }

  return (
    <CountryFlag
      country={finalCountry}
      showName={showName}
      className={className}
      style={style}
    />
  );
});
