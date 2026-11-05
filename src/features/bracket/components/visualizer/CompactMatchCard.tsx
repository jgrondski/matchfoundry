import React from 'react';
import { MatchCardModel, MatchSideModel } from '../../matchCardModel';
import { cn } from '../../../../components/ui';

interface CompactMatchCardProps {
  model: MatchCardModel;
  pos: { x: number; y: number; width: number; height: number };
  accentColor: string;      // primaryColor, or lowerBracketColor for losers-bracket matches (same rule as BracketMatchCard)
  cardBg: string;           // effectiveCardBg
  matchDomId: string;       // `bracket-match-${match.id}`, so scroll-to-match keeps working
  onSelect?: () => void;    // undefined when the full view would not be clickable
}

const CompactRow: React.FC<{
  side: MatchSideModel;
  opponent: MatchSideModel;
  model: MatchCardModel;
  isSecond?: boolean;
}> = ({ side, opponent, model, isSecond = false }) => {
  const isLoser = model.isComplete && opponent.won;
  const showWins = !side.isPlaceholder;
  return (
    <div
      className={cn(
        'flex h-1/2 items-center gap-1.5 px-1.5 text-2xs',
        isSecond && 'border-t border-line-subtle',
        side.isPlaceholder
          ? 'italic text-fg-muted'
          : side.won
          ? 'font-bold text-fg'
          : isLoser
          ? 'text-fg-muted opacity-70'
          : 'text-fg'
      )}
    >
      <span className="w-4 shrink-0 text-right font-mono text-3xs text-fg-muted">
        {side.isPlaceholder || side.seed === null ? '' : side.seed}
      </span>
      <span className="min-w-0 flex-1 truncate">{side.name}</span>
      {showWins && (
        <span className={cn('shrink-0 font-mono font-bold', side.leading && 'text-gold-bright')}>
          {!model.isComplete && !model.inProgress ? '-' : side.winsDisplay}
        </span>
      )}
    </div>
  );
};

/**
 * Compact bracket match: seed, name and match wins only, positioned by the layout engine.
 */
export const CompactMatchCard: React.FC<CompactMatchCardProps> = ({
  model,
  pos,
  accentColor,
  cardBg,
  matchDomId,
  onSelect,
}) => {
  return (
    <div
      id={matchDomId}
      className={cn(
        'absolute flex flex-col overflow-hidden rounded-sm border border-line border-l-2',
        onSelect && 'cursor-pointer'
      )}
      style={{
        left: pos.x,
        top: pos.y,
        width: pos.width,
        height: pos.height,
        background: cardBg,
        borderLeftColor: accentColor,
      }}
      {...(onSelect
        ? {
            role: 'button',
            tabIndex: 0,
            onClick: onSelect,
            onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect();
              }
            },
          }
        : {})}
    >
      <CompactRow side={model.p1} opponent={model.p2} model={model} />
      <CompactRow side={model.p2} opponent={model.p1} model={model} isSecond />
    </div>
  );
};
