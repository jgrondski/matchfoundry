export interface LayoutConfig {
  matchWidth: number;
  matchHeight: number;
  baseRowHeight: number; // matchHeight + compact gap for anchor round
  roundGap: number; // Horizontal gap between round columns
  headerHeight: number;
  paddingTop: number;
  paddingLeft: number;
  paddingRight: number;
  paddingBottom: number;
  championWidth: number;
  championHeight: number;
}

export const DEFAULT_LAYOUT_CONFIG: LayoutConfig = {
  matchWidth: 260,
  matchHeight: 80, // Fits header strip + 2 player rows perfectly without vertical clipping
  baseRowHeight: 112, // 80px card + 32px gap (refined vertical breathing room between matches)
  roundGap: 56, // Compact horizontal spacing for broadcast/OBS
  headerHeight: 66, // 34px badge + 32px gap to ensure distance between round headers and top matches matches inter-match distance
  paddingTop: 8, // Top boundary padding
  paddingLeft: 20,
  paddingRight: 32,
  paddingBottom: 24,
  championWidth: 280,
  championHeight: 76,
};

export const COMPACT_LAYOUT_CONFIG: LayoutConfig = {
  matchWidth: 136,
  matchHeight: 44,
  baseRowHeight: 56,
  roundGap: 20,
  headerHeight: 36,
  paddingTop: 8,
  paddingLeft: 12,
  paddingRight: 16,
  paddingBottom: 16,
  championWidth: 140,
  championHeight: 44,
};

export type BracketViewMode = 'standard' | 'fit' | 'split' | 'feed' | 'compact';

export interface MatchPosition {
  matchId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  centerY: number;
  centerX: number;
  isCompactFeeder?: boolean;
}

export interface RoundHeaderPosition {
  roundNumber: number;
  name: string;
  x: number;
  y: number;
  width: number;
  isFinals?: boolean;
}

export interface ConnectorPath {
  id: string;
  d: string;
  sourceMatchIds: string[];
  targetMatchId: string;
  targetSlot?: 1 | 2;
}

export interface BracketLayoutMetadata {
  totalWidth: number;
  totalHeight: number;
  matchPositions: Record<string, MatchPosition>;
  roundHeaders: RoundHeaderPosition[];
  paths: ConnectorPath[];
  championPosition: {
    x: number;
    y: number;
    width: number;
    height: number;
    centerY: number;
  };
  championPath?: {
    d: string;
    finalsMatchId: string;
  };
  viewMode?: BracketViewMode;
  stageHeaders?: Array<{
    id: string;
    title: string;
    x: number;
    y: number;
    width: number;
  }>;
}
