import React from 'react';
import { ConnectorPath } from '../../bracketLayout';
import { BracketMatch, SeededPlayer } from '../../types';
import { MatchScoreRecord } from '../../../tournament/types';
import { cn } from '../../../../components/ui';

interface BracketSvgConnectorsProps {
  totalWidth: number;
  totalHeight: number;
  paths: ConnectorPath[];
  championPath?: { d: string; finalsMatchId: string } | null;
  tournamentMatchScores: Record<string, MatchScoreRecord>;
  matchesById: Record<string, BracketMatch>;
  hoveredAncestry?: {
    matchIds: Set<string>;
    slotKeys: Set<string>;
    isChampion?: boolean;
    targetPlayerId?: string | null;
  } | null;
  targetChampPlayer?: SeededPlayer | null;
  primaryColor: string;
  secondaryColor: string;
}

export const BracketSvgConnectors: React.FC<BracketSvgConnectorsProps> = ({
  totalWidth,
  totalHeight,
  paths,
  championPath,
  tournamentMatchScores,
  matchesById,
  hoveredAncestry,
  targetChampPlayer,
  primaryColor,
  secondaryColor,
}) => {
  return (
    <svg
      className="pointer-events-none absolute top-0 left-0 z-1"
      style={{
        width: `${totalWidth}px`,
        height: `${totalHeight}px`,
      }}
    >
      {[...paths]
        .sort((a, b) => {
          if (!hoveredAncestry) return 0;
          const aIn =
            hoveredAncestry.matchIds.has(a.targetMatchId) &&
            (a.targetSlot
              ? hoveredAncestry.slotKeys.has(`${a.targetMatchId}-${a.targetSlot}`) &&
                a.sourceMatchIds.some((sId: string) => hoveredAncestry.matchIds.has(sId))
              : a.sourceMatchIds.some((sId: string) => hoveredAncestry.matchIds.has(sId)));
          const bIn =
            hoveredAncestry.matchIds.has(b.targetMatchId) &&
            (b.targetSlot
              ? hoveredAncestry.slotKeys.has(`${b.targetMatchId}-${b.targetSlot}`) &&
                b.sourceMatchIds.some((sId: string) => hoveredAncestry.matchIds.has(sId))
              : b.sourceMatchIds.some((sId: string) => hoveredAncestry.matchIds.has(sId)));
          return (aIn ? 1 : 0) - (bIn ? 1 : 0);
        })
        .map((path) => {
          const targetRecord = tournamentMatchScores[path.targetMatchId];
          const targetMatch = matchesById[path.targetMatchId];
          const isTargetComplete = Boolean(targetMatch?.winnerId || targetRecord?.isComplete);
          const isPathInAncestry = Boolean(
            hoveredAncestry &&
            hoveredAncestry.matchIds.has(path.targetMatchId) &&
            (
              path.targetSlot
                ? (
                    hoveredAncestry.slotKeys.has(`${path.targetMatchId}-${path.targetSlot}`) &&
                    path.sourceMatchIds.some((sId: string) => hoveredAncestry.matchIds.has(sId))
                  )
                : path.sourceMatchIds.some((sId: string) => hoveredAncestry.matchIds.has(sId))
            )
          );

          return (
            <path
              key={path.id}
              d={path.d}
              fill="none"
              stroke={isPathInAncestry ? primaryColor : isTargetComplete ? primaryColor : secondaryColor}
              strokeWidth={isPathInAncestry ? 4 : isTargetComplete ? 2.5 : 1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              className={cn(!isPathInAncestry && hoveredAncestry && 'opacity-20')}
              style={{
                filter: isPathInAncestry
                  ? `drop-shadow(0 0 10px ${primaryColor})`
                  : isTargetComplete
                  ? `drop-shadow(0 0 6px ${primaryColor}77)`
                  : undefined,
              }}
            />
          );
        })}

      {/* Champion horizontal stem connecting Finals to Champion plaque */}
      {championPath && (
        <path
          d={championPath.d}
          fill="none"
          stroke={primaryColor}
          strokeWidth={targetChampPlayer ? (hoveredAncestry?.isChampion ? 4 : 3) : 2}
          strokeLinecap="round"
          strokeDasharray={targetChampPlayer ? 'none' : '4 4'}
          className={cn(hoveredAncestry && !hoveredAncestry.isChampion && 'opacity-20')}
          style={{
            filter: targetChampPlayer
              ? hoveredAncestry?.isChampion
                ? `drop-shadow(0 0 12px ${primaryColor})`
                : `drop-shadow(0 0 8px ${primaryColor}99)`
              : undefined,
          }}
        />
      )}
    </svg>
  );
};
