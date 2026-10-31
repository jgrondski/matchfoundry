import React from 'react';
import { ACCELERATED_HYBRID_POD_PALETTE } from '../../routingChips';
import { BracketLayoutMetadata } from '../../bracketLayout';
import { BracketRound, SeededPlayer } from '../../types';
import { BracketViewMode } from '../../layout/types';
import { cn } from '../../../../components/ui';

interface BracketQualifierPodGridProps {
  effectiveCardBg: string;
  secondaryColor: string;
  primaryColor: string;
  lowerBracketColor?: string;
  layoutAccel: BracketLayoutMetadata;
  accelRounds: BracketRound[];
  layoutPreMergeUpper: BracketLayoutMetadata;
  preUpperRounds: BracketRound[];
  layoutLowerBracket: BracketLayoutMetadata;
  lowerBracketRounds: BracketRound[];
  renderCanvas: (
    targetLayout: BracketLayoutMetadata,
    targetRounds: BracketRound[],
    isPhase1View?: boolean,
    isPhase2View?: boolean,
    targetChampPlayer?: SeededPlayer | null
  ) => React.ReactNode;
  effectiveObsView?: BracketViewMode;
}

export const BracketQualifierPodGrid: React.FC<BracketQualifierPodGridProps> = ({
  effectiveCardBg,
  secondaryColor,
  primaryColor,
  lowerBracketColor,
  layoutAccel,
  accelRounds,
  layoutPreMergeUpper,
  preUpperRounds,
  layoutLowerBracket,
  lowerBracketRounds,
  renderCanvas,
  effectiveObsView,
}) => {
  const isSideBySide = effectiveObsView === 'fit' || effectiveObsView === 'split';
  const effectiveLbColor = lowerBracketColor || ACCELERATED_HYBRID_POD_PALETTE.LB.border;

  const podCls =
    'flex flex-col overflow-hidden rounded-md border-[1.5px] border-x-4 shadow-[0_2px_8px_rgba(0,0,0,0.4)]';
  const upperPodMinWidth = `${(layoutPreMergeUpper?.totalWidth || 1168) + 24}px`;
  const lowerPodMinWidth = `${(layoutLowerBracket?.totalWidth || 1172) + 24}px`;

  const renderPod1 = () => (
    <div
      className={podCls}
      style={{
        background: effectiveCardBg,
        borderColor: `${secondaryColor} ${ACCELERATED_HYBRID_POD_PALETTE.AR.border}`,
      }}
    >
      <div
        className="flex items-center justify-between gap-2 border-b-[1.5px] py-2.5 px-3.5"
        style={{ background: effectiveCardBg, borderBottomColor: secondaryColor }}
      >
        <div className="flex items-center gap-2">
          <span
            className="text-caption font-black uppercase tracking-wider whitespace-nowrap"
            style={{ color: primaryColor }}
          >
            Pod 1: Accelerated Round
          </span>
          <span
            className="rounded-xs border py-0.5 px-2 text-3xs font-extrabold"
            style={{
              background: ACCELERATED_HYBRID_POD_PALETTE.AR.badgeBg,
              color: ACCELERATED_HYBRID_POD_PALETTE.AR.text,
              borderColor: `${ACCELERATED_HYBRID_POD_PALETTE.AR.border}88`,
            }}
          >
            AR
          </span>
        </div>
      </div>
      <div className="flex justify-center py-2 px-1.5">
        {renderCanvas(layoutAccel, accelRounds, true, false, null)}
      </div>
    </div>
  );

  const renderPod2 = () => (
    <div
      className={podCls}
      style={{
        background: effectiveCardBg,
        borderColor: `${secondaryColor} ${ACCELERATED_HYBRID_POD_PALETTE.UB.border}`,
        minWidth: upperPodMinWidth,
      }}
    >
      <div
        className="flex items-center justify-between gap-2 border-b-[1.5px] py-2.5 px-4"
        style={{ background: effectiveCardBg, borderBottomColor: secondaryColor }}
      >
        <div className="flex items-center gap-2">
          <span
            className="text-caption font-black uppercase tracking-wider"
            style={{ color: primaryColor }}
          >
            Pod 2: Upper Bracket
          </span>
          <span
            className="rounded-xs border py-0.5 px-2 text-3xs font-extrabold"
            style={{
              background: ACCELERATED_HYBRID_POD_PALETTE.UB.badgeBg,
              color: ACCELERATED_HYBRID_POD_PALETTE.UB.text,
              borderColor: `${ACCELERATED_HYBRID_POD_PALETTE.UB.border}88`,
            }}
          >
            UB
          </span>
        </div>
      </div>
      <div
        className={cn(
          'max-w-full overflow-y-hidden py-2 px-1',
          effectiveObsView === 'fit' ? 'overflow-x-hidden' : 'overflow-x-auto'
        )}
      >
        <div className="mx-auto w-fit min-w-max">
          {renderCanvas(layoutPreMergeUpper, preUpperRounds, true, false, null)}
        </div>
      </div>
    </div>
  );

  const renderPod3 = () => (
    <div
      className={cn(podCls, !isSideBySide && 'w-full')}
      style={{
        background: effectiveCardBg,
        borderColor: `${secondaryColor} ${effectiveLbColor}`,
        minWidth: isSideBySide ? lowerPodMinWidth : undefined,
      }}
    >
      <div
        className="flex items-center justify-between gap-2 border-b-[1.5px] py-2.5 px-4"
        style={{ background: effectiveCardBg, borderBottomColor: secondaryColor }}
      >
        <div className="flex items-center gap-2">
          <span
            className="text-caption font-black uppercase tracking-wider"
            style={{ color: primaryColor }}
          >
            Pod 3: Lower Bracket
          </span>
          <span
            className="rounded-xs border py-0.5 px-2 text-3xs font-extrabold"
            style={{
              background: ACCELERATED_HYBRID_POD_PALETTE.LB.badgeBg,
              color: ACCELERATED_HYBRID_POD_PALETTE.LB.text,
              borderColor: `${ACCELERATED_HYBRID_POD_PALETTE.LB.border}88`,
            }}
          >
            LB
          </span>
        </div>
      </div>
      <div
        className={cn(
          'max-w-full overflow-y-hidden py-2 px-1',
          effectiveObsView === 'fit' ? 'overflow-x-hidden' : 'overflow-x-auto'
        )}
      >
        <div className="mx-auto w-fit min-w-max">
          {renderCanvas(layoutLowerBracket, lowerBracketRounds, true, false, null)}
        </div>
      </div>
    </div>
  );

  // Below 1025px the pods stack in one column; the wide template comes from layout widths.
  if (isSideBySide) {
    return (
      <div
        className="grid w-full grid-cols-1 items-stretch gap-5 min-[1025px]:grid-cols-(--pod-cols)"
        style={{ '--pod-cols': `max-content minmax(${upperPodMinWidth}, 1fr) minmax(${lowerPodMinWidth}, 1fr)` } as React.CSSProperties}
      >
        {renderPod1()}
        {renderPod2()}
        {renderPod3()}
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-7">
      {/* Top Row: Pod 1 (Accelerated Round: compact) & Pod 2 (Upper Bracket: fills remaining space) */}
      <div
        className="grid w-full grid-cols-1 items-stretch gap-5 min-[1025px]:grid-cols-(--pod-cols)"
        style={{ '--pod-cols': `max-content minmax(${upperPodMinWidth}, 1fr)` } as React.CSSProperties}
      >
        {renderPod1()}
        {renderPod2()}
      </div>

      {/* Bottom Row: Pod 3: Lower Bracket */}
      {renderPod3()}
    </div>
  );
};
