import React from 'react';
import { Trophy } from 'lucide-react';
import { blendOver, colorWithAlpha } from '../../colorUtils';
import { cn } from '../../../../components/ui';

import { HybridStageTab } from './BracketStageNavBar';

interface BracketBroadcastHeaderProps {
  tournamentName: string;
  tierName: string;
  eliminationType?: 'SINGLE' | 'DOUBLE' | string;
  isAcceleratedHybrid?: boolean;
  activeHybridTab?: HybridStageTab;
  finalsCutoff?: number;
  isObsMode?: boolean;
  chromaHex?: string | null;
  primaryColor: string;
  /** Opaque card color; on chroma the pills are drawn as solid blends over it instead of rgba. */
  cardBg?: string;
  isDraft?: boolean;
}

export const BracketBroadcastHeader: React.FC<BracketBroadcastHeaderProps> = ({
  tournamentName,
  tierName,
  eliminationType,
  isAcceleratedHybrid = false,
  activeHybridTab,
  finalsCutoff = 16,
  isObsMode = false,
  chromaHex = null,
  primaryColor,
  cardBg,
  isDraft = false,
}) => {
  const getStageLabel = () => {
    if (!isAcceleratedHybrid) {
      return eliminationType === 'DOUBLE' ? 'Double Elimination' : 'Single Elimination';
    }
    switch (activeHybridTab) {
      case 'championship':
        return `Accelerated Hybrid • Top ${finalsCutoff} Finals`;
      case 'accel':
        return `Accelerated Hybrid • Pod 1: Accelerated Round (Seeds 1–${finalsCutoff})`;
      case 'upper':
        return `Accelerated Hybrid • Pod 2: Upper Qualifying Bracket`;
      case 'lower':
        return `Accelerated Hybrid • Pod 3: Lower / Play-In Bracket`;
      case 'premerge':
        return `Accelerated Hybrid • Pre-Merge Gauntlet`;
      case 'combined':
        return `Accelerated Hybrid • Full Tournament (All Stages)`;
      case 'qualifiers':
      default:
        return `Accelerated Hybrid • Early Rounds (3 Pods)`;
    }
  };

  const isChroma = isObsMode && !!chromaHex;

  return (
    <div
      id="bracket-broadcast-header"
      className={cn(
        'flex w-full shrink-0 flex-wrap items-center justify-between gap-3 z-35',
        isObsMode ? 'py-2.5 px-5' : 'py-3 px-6',
        isChroma ? 'bg-transparent' : 'border-b bg-header/82 backdrop-blur-md'
      )}
      style={{
        borderBottomColor: isChroma ? undefined : colorWithAlpha(primaryColor, 0.25, 'var(--color-line)'),
      }}
    >
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Trophy size={isObsMode ? 18 : 20} color="var(--color-gold-bright)" />
          <span
            className={cn(
              'font-extrabold text-white tracking-tight leading-tight',
              isObsMode ? 'text-xl' : 'text-2xl'
            )}
          >
            {tournamentName}
          </span>
        </div>

        <span
          className="text-caption font-extrabold uppercase tracking-wider py-0.5 px-2.5 rounded-full border"
          style={{
            background: isChroma ? blendOver(primaryColor, cardBg, 0.22) : colorWithAlpha(primaryColor, 0.22),
            color: primaryColor,
            borderColor: isChroma ? blendOver(primaryColor, cardBg, 0.5) : colorWithAlpha(primaryColor, 0.5),
          }}
        >
          {tierName}
        </span>

        {isDraft && (
          <span
            className={cn(
              'inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider py-0.5 px-2.5 rounded-full text-gold-bright border',
              isChroma ? 'border-gold' : 'bg-gold/22 border-gold/55'
            )}
            style={isChroma ? { background: cardBg } : undefined}
          >
            <span className={cn('size-1.5 rounded-full bg-gold-bright', !isChroma && 'shadow-[0_0_6px_var(--color-gold-bright)]')} />
            Draft Preview
          </span>
        )}

        <span
          className={cn(
            'text-caption font-semibold',
            isChroma ? 'rounded-full px-2.5 py-0.5 text-fg-secondary' : 'text-fg-muted'
          )}
          style={isChroma ? { background: cardBg } : undefined}
        >
          {getStageLabel()}
        </span>
      </div>
    </div>
  );
};
