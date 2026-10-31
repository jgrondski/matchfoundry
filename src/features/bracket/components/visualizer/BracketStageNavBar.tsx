import React from 'react';
import { getContrastingTextColor } from '../../colorUtils';
import { ACCELERATED_HYBRID_POD_PALETTE } from '../../routingChips';
import { BracketViewMode } from '../../bracketLayout';
import { cn } from '../../../../components/ui';

export type HybridStageTab = 'qualifiers' | 'championship' | 'combined' | 'accel' | 'premerge' | 'upper' | 'lower';

interface BracketStageNavBarProps {
  activeHybridTab: HybridStageTab;
  onSelectTab: (tab: HybridStageTab) => void;
  effectiveObsView: BracketViewMode;
  primaryColor: string;
  finalsCutoff?: number;
  topOffset?: string;
}

export const BracketStageNavBar: React.FC<BracketStageNavBarProps> = ({
  activeHybridTab,
  onSelectTab,
  effectiveObsView,
  primaryColor,
  finalsCutoff = 16,
  topOffset,
}) => {
  const isEarlyRoundsTab =
    activeHybridTab === 'qualifiers' || activeHybridTab === 'accel' || activeHybridTab === 'premerge';
  const stageTabCls =
    'inline-flex cursor-pointer items-center gap-1.5 rounded-xs border-0 py-1.5 px-3.5 text-caption transition-all duration-150';
  const activeTabStyle = {
    background: primaryColor,
    color: getContrastingTextColor(primaryColor),
    boxShadow: `0 0 10px ${primaryColor}44`,
  };

  return (
    <div
      id="bracket-stage-nav-bar"
      className={cn(
        'z-41 flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-line bg-header/88 py-2 px-5 backdrop-blur-md',
        effectiveObsView === 'fit' ? 'relative top-0' : 'sticky'
      )}
      style={{
        top: effectiveObsView === 'fit' ? undefined : (topOffset || 'var(--bracket-tier-bar-height, 48px)'),
      }}
    >
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="text-xs font-extrabold uppercase tracking-widest text-fg-muted">
          Stage:
        </span>

        <div className="inline-flex items-center gap-1 rounded-sm border border-line bg-canvas p-1">
          {/* Tab 1: Early Rounds */}
          <button
            type="button"
            onClick={() => onSelectTab('qualifiers')}
            className={cn(stageTabCls, isEarlyRoundsTab ? 'font-extrabold' : 'font-semibold bg-transparent text-fg-secondary')}
            style={isEarlyRoundsTab ? { ...activeTabStyle } : undefined}
          >
            <span>Early Rounds</span>
          </button>

          {/* Tab 2: Top C */}
          <button
            type="button"
            onClick={() => onSelectTab('championship')}
            className={cn(stageTabCls, activeHybridTab === 'championship' ? 'font-extrabold' : 'font-semibold bg-transparent text-fg-secondary')}
            style={activeHybridTab === 'championship' ? { ...activeTabStyle } : undefined}
          >
            <span>Top {finalsCutoff}</span>
          </button>

          {/* Tab 3: Combined View */}
          <button
            type="button"
            onClick={() => onSelectTab('combined')}
            className={cn(stageTabCls, activeHybridTab === 'combined' ? 'font-extrabold' : 'font-semibold bg-transparent text-fg-secondary')}
            style={activeHybridTab === 'combined' ? { ...activeTabStyle } : undefined}
          >
            <span>Combined View</span>
          </button>
        </div>
      </div>

      {/* Embedded Right-Side Compact Dot Badge Legend */}
      <div className="flex flex-wrap items-center gap-3 text-xs select-none">
        <div className="inline-flex items-center gap-1.5">
          <span
            className="size-2 rounded-full"
            style={{
              background: ACCELERATED_HYBRID_POD_PALETTE.AR.border,
              boxShadow: `0 0 6px ${ACCELERATED_HYBRID_POD_PALETTE.AR.glow}`,
            }}
          />
          <span className="font-bold" style={{ color: ACCELERATED_HYBRID_POD_PALETTE.AR.text }}>
            Accelerated
          </span>
        </div>
        <span className="text-line">|</span>
        <div className="inline-flex items-center gap-1.5">
          <span
            className="size-2 rounded-full"
            style={{
              background: ACCELERATED_HYBRID_POD_PALETTE.UB.border,
              boxShadow: `0 0 6px ${ACCELERATED_HYBRID_POD_PALETTE.UB.glow}`,
            }}
          />
          <span className="font-bold" style={{ color: ACCELERATED_HYBRID_POD_PALETTE.UB.text }}>
            Upper Bracket
          </span>
        </div>
        <span className="text-line">|</span>
        <div className="inline-flex items-center gap-1.5">
          <span
            className="size-2 rounded-full"
            style={{
              background: ACCELERATED_HYBRID_POD_PALETTE.LB.border,
              boxShadow: `0 0 6px ${ACCELERATED_HYBRID_POD_PALETTE.LB.glow}`,
            }}
          />
          <span className="font-bold" style={{ color: ACCELERATED_HYBRID_POD_PALETTE.LB.text }}>
            Lower Bracket
          </span>
        </div>
      </div>
    </div>
  );
};
