import React from 'react';
import { SeededPlayer } from '../../types';
import { PlayerAvatar } from '../../../players/components/PlayerAvatar';
import { BestOfSelect } from '../BestOfSelect';
import { colorWithAlpha } from '../../colorUtils';
import { cn } from '../../../../components/ui';

interface MatchupBannerProps {
  p1?: SeededPlayer | null;
  p2?: SeededPlayer | null;
  p1Seed?: number;
  p2Seed?: number;
  p1Name: string;
  p2Name: string;
  p1Wins: number;
  p2Wins: number;
  winThreshold: number;
  bestOf: number;
  isP1Override?: boolean;
  isP2Override?: boolean;
  primaryColor: string;
  onBestOfChange: (newBestOf: number) => void;
}

export const MatchupBanner: React.FC<MatchupBannerProps> = ({
  p1,
  p2,
  p1Seed,
  p2Seed,
  p1Name,
  p2Name,
  p1Wins,
  p2Wins,
  winThreshold,
  bestOf,
  isP1Override,
  isP2Override,
  primaryColor,
  onBestOfChange,
}) => {
  return (
    <div
      className="flex items-center py-5 px-6 gap-4"
      style={{
        background: `linear-gradient(180deg, ${colorWithAlpha(primaryColor, 0.10)} 0%, rgba(0, 0, 0, 0.35) 100%)`,
        borderBottom: `1px solid ${colorWithAlpha(primaryColor, 0.25, 'var(--color-line)')}`,
      }}
    >
      {/* Player 1 Section */}
      <div
        className="flex-1 text-center min-w-0 py-3 px-2 rounded-md transition-all duration-150"
        style={{
          background: p1Wins >= winThreshold
            ? colorWithAlpha(primaryColor, 0.12)
            : 'rgba(255, 255, 255, 0.02)',
          border: p1Wins >= winThreshold
            ? `2px solid ${primaryColor}`
            : `1px solid ${colorWithAlpha(primaryColor, 0.2, 'rgba(255, 255, 255, 0.06)')}`,
          boxShadow: p1Wins >= winThreshold
            ? `0 0 16px ${colorWithAlpha(primaryColor, 0.3)}`
            : 'none',
        }}
      >
        {/* Competitor Glowing Avatar Ring */}
        <div
          className="size-10.5 rounded-full flex items-center justify-center mt-0 mx-auto mb-2 text-base transition-all duration-200"
          style={{
            background: `linear-gradient(135deg, ${colorWithAlpha(primaryColor, 0.25)} 0%, rgba(0, 0, 0, 0.5) 100%)`,
            border: `2px solid ${p1Wins >= winThreshold ? primaryColor : colorWithAlpha(primaryColor, 0.4)}`,
            boxShadow: p1Wins >= winThreshold ? `0 0 14px ${colorWithAlpha(primaryColor, 0.45)}` : 'none',
          }}
        >
          {p1?.country || (p1 as any)?.avatarUrl ? (
            <PlayerAvatar player={p1 as any} country={p1?.country} />
          ) : (
            <span className="text-sm font-extrabold" style={{ color: primaryColor }}>
              {p1Name.slice(0, 2).toUpperCase()}
            </span>
          )}
        </div>

        <div className="flex items-center justify-center gap-1.5 mb-1.5">
          {p1Seed !== undefined && (
            <span className="text-2xs font-mono font-bold py-0.5 px-1.5 rounded-sm bg-white/6 text-fg-muted border border-line">
              #{p1Seed}
            </span>
          )}
        </div>

        <div
          className="text-lg font-bold text-white truncate flex items-center justify-center gap-1.5"
          style={{ color: p1Wins >= winThreshold ? primaryColor : undefined }}
          title={p1Name}
        >
          <span>{p1Name}</span>
          {isP1Override && (
            <span className="text-3xs py-0.5 px-1.5 bg-orange-600/20 text-orange-600 border border-orange-600/40 rounded-xs font-bold">
              OVERRIDE
            </span>
          )}
        </div>

        <div
          className={cn(
            'font-mono tabular-nums tracking-tight text-hero font-black leading-tight mt-1',
            p1Wins > 0 ? 'text-white' : 'text-fg-muted'
          )}
          style={{
            color: p1Wins >= winThreshold ? primaryColor : undefined,
            textShadow: p1Wins >= winThreshold ? `0 0 16px ${colorWithAlpha(primaryColor, 0.4)}` : 'none',
          }}
        >
          {p1Wins}
        </div>
      </div>

      {/* Center VS & Format Column */}
      <div className="flex flex-col items-center px-2 shrink-0">
        <span className="text-xs font-extrabold tracking-widest text-fg-muted mb-1.5">
          VS
        </span>
        <BestOfSelect
          value={bestOf}
          onChange={onBestOfChange}
          compact={true}
        />
        <span className="text-3xs text-fg-muted mt-1.5 font-semibold font-mono">
          First to {winThreshold}
        </span>
      </div>

      {/* Player 2 Section */}
      <div
        className="flex-1 text-center min-w-0 py-3 px-2 rounded-md transition-all duration-150"
        style={{
          background: p2Wins >= winThreshold
            ? colorWithAlpha(primaryColor, 0.12)
            : 'rgba(255, 255, 255, 0.02)',
          border: p2Wins >= winThreshold
            ? `2px solid ${primaryColor}`
            : `1px solid ${colorWithAlpha(primaryColor, 0.2, 'rgba(255, 255, 255, 0.06)')}`,
          boxShadow: p2Wins >= winThreshold
            ? `0 0 16px ${colorWithAlpha(primaryColor, 0.3)}`
            : 'none',
        }}
      >
        {/* Competitor Glowing Avatar Ring */}
        <div
          className="size-10.5 rounded-full flex items-center justify-center mt-0 mx-auto mb-2 text-base transition-all duration-200"
          style={{
            background: `linear-gradient(135deg, ${colorWithAlpha(primaryColor, 0.25)} 0%, rgba(0, 0, 0, 0.5) 100%)`,
            border: `2px solid ${p2Wins >= winThreshold ? primaryColor : colorWithAlpha(primaryColor, 0.4)}`,
            boxShadow: p2Wins >= winThreshold ? `0 0 14px ${colorWithAlpha(primaryColor, 0.45)}` : 'none',
          }}
        >
          {p2?.country || (p2 as any)?.avatarUrl ? (
            <PlayerAvatar player={p2 as any} country={p2?.country} />
          ) : (
            <span className="text-sm font-extrabold" style={{ color: primaryColor }}>
              {p2Name.slice(0, 2).toUpperCase()}
            </span>
          )}
        </div>

        <div className="flex items-center justify-center gap-1.5 mb-1.5">
          {p2Seed !== undefined && (
            <span className="text-2xs font-mono font-bold py-0.5 px-1.5 rounded-sm bg-white/6 text-fg-muted border border-line">
              #{p2Seed}
            </span>
          )}
        </div>

        <div
          className="text-lg font-bold text-white truncate flex items-center justify-center gap-1.5"
          style={{ color: p2Wins >= winThreshold ? primaryColor : undefined }}
          title={p2Name}
        >
          <span>{p2Name}</span>
          {isP2Override && (
            <span className="text-3xs py-0.5 px-1.5 bg-orange-600/20 text-orange-600 border border-orange-600/40 rounded-xs font-bold">
              OVERRIDE
            </span>
          )}
        </div>

        <div
          className={cn(
            'font-mono tabular-nums tracking-tight text-hero font-black leading-tight mt-1',
            p2Wins > 0 ? 'text-white' : 'text-fg-muted'
          )}
          style={{
            color: p2Wins >= winThreshold ? primaryColor : undefined,
            textShadow: p2Wins >= winThreshold ? `0 0 16px ${colorWithAlpha(primaryColor, 0.4)}` : 'none',
          }}
        >
          {p2Wins}
        </div>
      </div>
    </div>
  );
};
