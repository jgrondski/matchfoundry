import React from 'react';
import { Trophy } from 'lucide-react';
import { SeededPlayer } from '../../types';
import { PlayerProfile } from '../../../tournament/types';
import { getContrastingTextColor } from '../../colorUtils';
import { PlayerAvatar } from '../../../players/components/PlayerAvatar';
import { cn } from '../../../../components/ui';

interface BracketChampionNodeProps {
  championPosition: { x: number; y: number; width: number; height: number };
  targetChampPlayer?: SeededPlayer | null;
  champProfile?: PlayerProfile | null;
  tierName: string;
  effectiveCardBg: string;
  primaryColor: string;
  secondaryColor: string;
  hoveredAncestry?: { isChampion?: boolean } | null;
  onChampHover: (champPlayerId?: string | null) => void;
  onPlayerClick: (pId: string, pName: string, country?: string) => void;
}

export const BracketChampionNode: React.FC<BracketChampionNodeProps> = ({
  championPosition,
  targetChampPlayer,
  champProfile,
  tierName,
  effectiveCardBg,
  primaryColor,
  secondaryColor,
  hoveredAncestry,
  onChampHover,
  onPlayerClick,
}) => {
  if (!championPosition || championPosition.width <= 0 || targetChampPlayer === undefined) {
    return null;
  }

  return (
    <div
      className="absolute z-3 flex flex-col items-center"
      style={{
        left: `${championPosition.x}px`,
        top: `${championPosition.y}px`,
        width: `${championPosition.width}px`,
      }}
    >
      {/* Plaque Box */}
      <div
        onMouseEnter={() => onChampHover(targetChampPlayer?.id)}
        onMouseLeave={() => onChampHover(null)}
        className={cn(
          'flex w-full items-stretch overflow-hidden rounded-sm border-[2.5px]',
          hoveredAncestry && !hoveredAncestry.isChampion && 'opacity-35'
        )}
        style={{
          height: `${championPosition.height}px`,
          background: effectiveCardBg,
          borderColor: primaryColor,
          boxShadow: targetChampPlayer
            ? hoveredAncestry?.isChampion
              ? `0 0 34px ${primaryColor}, inset 0 0 16px ${primaryColor}44`
              : `0 0 28px ${primaryColor}88`
            : `0 0 12px ${primaryColor}33`,
        }}
      >
        {/* Seed Box */}
        <div
          className="flex w-11.5 shrink-0 items-center justify-center border-r-2 font-mono text-xl font-black"
          style={{
            background: secondaryColor,
            color: getContrastingTextColor(secondaryColor),
            borderRightColor: primaryColor,
          }}
        >
          {targetChampPlayer?.seed ? targetChampPlayer.seed : '?'}
        </div>

        {/* Champion Name Box */}
        <div
          onClick={() => {
            if (targetChampPlayer?.id) {
              onPlayerClick(targetChampPlayer.id, targetChampPlayer.name, champProfile?.country);
            }
          }}
          className={cn(
            'flex flex-1 items-center justify-center gap-2 px-3.5 text-xl font-black tracking-wide text-white truncate bg-transparent',
            targetChampPlayer?.id ? 'cursor-pointer' : 'cursor-default'
          )}
          title={targetChampPlayer?.id ? 'View champion profile' : undefined}
        >
          {(champProfile?.country || champProfile?.avatarUrl) && (
            <PlayerAvatar player={champProfile} country={champProfile?.country} className="text-xl" />
          )}
          <span>{targetChampPlayer ? targetChampPlayer.name : 'TBD'}</span>
        </div>
      </div>

      {/* Champion Subtitle */}
      <div
        className="mt-2.5 flex items-center gap-1.5 text-base font-extrabold tracking-wider capitalize"
        style={{ color: primaryColor }}
      >
        <Trophy size={18} color={primaryColor} />
        <span>{tierName} Champion</span>
      </div>
    </div>
  );
};
