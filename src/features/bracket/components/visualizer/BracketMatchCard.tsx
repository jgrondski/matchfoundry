import React from 'react';
import {
  BracketMatch,
  BracketRound,
  BracketStructure,
  isMatchPlayable,
} from '../../types';
import { Tournament, TournamentTier, PlayerProfile, GameScoreEntry } from '../../../tournament/types';
import { PlayerAvatar } from '../../../players/components/PlayerAvatar';
import { getEffectivePlayerName } from '../../../players/playerNameUtils';
import {
  colorWithAlpha,
  getAlternateShade,
} from '../../colorUtils';
import {
  getMatchBranchColor,
  getInboundChip,
  getOutboundChip,
  renderMicroChip,
} from '../../routingChips';
import { getHighlightedPlayerNameColor } from '../../journeyHighlight';
import { cn } from '../../../../components/ui';

interface BracketMatchCardProps {
  match: BracketMatch;
  round: BracketRound;
  mIdx: number;
  pos: { x: number; y: number; width: number; height: number };
  tournament: Tournament;
  bracket: BracketStructure;
  tier: TournamentTier;
  isPhase2View?: boolean;
  isObsMode?: boolean;
  primaryColor: string;
  secondaryColor: string;
  textColor: string;
  lowerBracketColor?: string;
  effectiveCardBg: string;
  shelfFontSize: string;
  seedDim: number;
  seedFontSize: string;
  flagFontSize: string;
  nameFontSize: string;
  scoreFontSize: string;
  scoreMinW: number;
  scoreH: number;
  isAcceleratedHybrid?: boolean;
  hoveredMatchId: string | null;
  setHoveredMatchId: (id: string | null) => void;
  hoveredOriginMatchId: string | null;
  setHoveredOriginMatchId: (id: string | null) => void;
  hoveredAncestry?: {
    matchIds: Set<string>;
    slotKeys: Set<string>;
    isChampion?: boolean;
    targetPlayerId?: string | null;
  } | null;
  focusedMatchId: string | null;
  onSlotHover: (matchId: string | null, slotNum: 1 | 2 | null) => void;
  onPlayerClick: (pId: string, pName: string, country?: string) => void;
  onChipClick: (targetMatchId: string) => void;
  onSelectMatch: (match: BracketMatch, roundName: string) => void;
}

export const BracketMatchCard: React.FC<BracketMatchCardProps> = ({
  match,
  round,
  mIdx,
  pos,
  tournament,
  bracket,
  tier,
  isPhase2View = false,
  isObsMode = false,
  primaryColor,
  secondaryColor,
  textColor,
  lowerBracketColor,
  effectiveCardBg,
  shelfFontSize,
  seedDim,
  seedFontSize,
  flagFontSize,
  nameFontSize,
  scoreFontSize,
  scoreMinW,
  scoreH,
  isAcceleratedHybrid = false,
  hoveredMatchId,
  setHoveredMatchId,
  hoveredOriginMatchId,
  setHoveredOriginMatchId,
  hoveredAncestry,
  focusedMatchId,
  onSlotHover,
  onPlayerClick,
  onChipClick,
  onSelectMatch,
}) => {
  const record = tournament.matchScores[match.id];
  const p1 = match.player1.player;
  const p2 = match.player2.player;
  const p1Profile = p1 ? (tournament.playersPool || []).find((p: PlayerProfile) => p.id === p1.id) : null;
  const p2Profile = p2 ? (tournament.playersPool || []).find((p: PlayerProfile) => p.id === p2.id) : null;

  const isPhase2OpeningRound =
    isPhase2View &&
    (round.roundIdentifier === 'CHAMP_R1' || match.roundIdentifier === 'CHAMP_R1');

  const p1SourceNum = match.player1.sourceMatchId
    ? match.player1.sourceMatchId.match(/-m(\d+)$/)?.[1]
    : undefined;
  const accelOriginLabel = `Accel #${p1SourceNum || mIdx + 1}`;

  const p2SourceNum = match.player2.sourceMatchId
    ? match.player2.sourceMatchId.match(/-m(\d+)$/)?.[1]
    : undefined;
  const playOffOriginLabel = `Play-off #${p2SourceNum || mIdx + 1}`;

  const isAdvanceRound =
    match.subTrack === 'ACCELERATED' ||
    match.roundIdentifier === 'AR' ||
    match.roundIdentifier === 'PO';

  const getSlotPlaceholder = (slot: typeof match.player1, fallbackNumber: number) => {
    if (isPhase2OpeningRound) {
      return fallbackNumber === 1
        ? `Winner of ${accelOriginLabel}`
        : `Winner of ${playOffOriginLabel}`;
    }
    if (match.roundIdentifier === '2C') {
      return fallbackNumber === 1
        ? `Winner of Lower Bracket R2 M#${mIdx + 1}`
        : `Loser of Accelerated Round M#${p2SourceNum || mIdx + 1}`;
    }
    if (match.roundIdentifier === 'PO') {
      return fallbackNumber === 1
        ? `Winner of Upper Bracket R2 M#${mIdx + 1}`
        : `Winner of Lower Bracket R3 M#${mIdx + 1}`;
    }
    if (match.roundIdentifier === 'PRE_L1') {
      return `Loser of Upper Bracket R1`;
    }
    if (match.roundIdentifier === 'PRE_L2') {
      return fallbackNumber === 1
        ? `Winner of Lower Bracket R1 M#${mIdx + 1}`
        : `Loser of Upper Bracket R1`;
    }
    if (!slot.sourceMatchId) return 'TBD';
    const src = bracket.matchesById[slot.sourceMatchId];
    if (!src) return 'TBD';
    const isLoserDrop = match.stage === 'LOSERS' && src.stage === 'WINNERS';
    return `${isLoserDrop ? 'Loser' : 'Winner'} of M#${src.matchNumber || fallbackNumber}`;
  };

  const p1Name = getEffectivePlayerName(p1) || getSlotPlaceholder(match.player1, 1);
  const p2Name = getEffectivePlayerName(p2) || getSlotPlaceholder(match.player2, 2);

  const p1Wins = record?.player1Wins || 0;
  const p2Wins = record?.player2Wins || 0;
  const matchBestOf = record?.bestOf || match.bestOf || tier.bestOf || 5;
  const hasTieGame = Boolean(
    record?.games?.some(
      (g: GameScoreEntry) =>
        g.winnerPlayerId === 'TIE' ||
        (g.player1Points !== null && g.player1Points === g.player2Points && g.player1Points > 0)
    )
  );
  const hasTiebreaker = Boolean(
    record?.hasTiebreaker || hasTieGame || (record?.games && record.games.length > matchBestOf)
  );
  const p1ScoreDisplay = hasTiebreaker ? `${p1Wins} (t)` : `${p1Wins}`;
  const p2ScoreDisplay = hasTiebreaker ? `${p2Wins} (t)` : `${p2Wins}`;

  const isPlayable = isMatchPlayable(match);
  const isComplete = Boolean(
    (p1?.id && match.winnerId === p1.id) ||
      (p2?.id && match.winnerId === p2.id) ||
      record?.isComplete
  );
  const inProgress = !isComplete && (p1Wins > 0 || p2Wins > 0);
  const p1Won = Boolean(p1?.id && (match.winnerId === p1.id || record?.winnerPlayerId === p1.id));
  const p2Won = Boolean(p2?.id && (match.winnerId === p2.id || record?.winnerPlayerId === p2.id));
  const finalsCutoff = bracket.finalsCutoff || 16;
  const isDoubleElim =
    tier.eliminationType === 'DOUBLE' ||
    bracket?.eliminationType === 'DOUBLE' ||
    Boolean(bracket?.rounds?.some((r: BracketRound) => r.stage === 'LOSERS' || r.name?.toLowerCase().includes('loser')));
  const p1InboundChip = isAcceleratedHybrid || isDoubleElim
    ? getInboundChip(1, match, bracket, mIdx, isPhase2OpeningRound, primaryColor, lowerBracketColor)
    : null;
  const p2InboundChip = isAcceleratedHybrid || isDoubleElim
    ? getInboundChip(2, match, bracket, mIdx, isPhase2OpeningRound, primaryColor, lowerBracketColor)
    : null;
  const p1OutboundChip = isAcceleratedHybrid || isDoubleElim
    ? getOutboundChip(1, match, isComplete, p1Won, p2Won, finalsCutoff, bracket, primaryColor, secondaryColor, lowerBracketColor)
    : null;
  const p2OutboundChip = isAcceleratedHybrid || isDoubleElim
    ? getOutboundChip(2, match, isComplete, p1Won, p2Won, finalsCutoff, bracket, primaryColor, secondaryColor, lowerBracketColor)
    : null;
  const isMatchHovered = hoveredMatchId === match.id;
  const isFocusedMatch = focusedMatchId === match.id;
  const isLoserMatch =
    match.stage === 'LOSERS' ||
    round.stage === 'LOSERS' ||
    match.roundIdentifier?.startsWith('L') ||
    round.roundIdentifier?.startsWith('L') ||
    match.id?.toLowerCase().includes('-l') ||
    match.id?.toLowerCase().includes('loser') ||
    round.name?.toLowerCase().includes('loser') ||
    round.name?.toLowerCase().includes('lower') ||
    round.name?.startsWith('LR') ||
    round.name?.includes('(L)');
  const branchAccentColor = isAcceleratedHybrid
    ? getMatchBranchColor(match, lowerBracketColor)
    : isDoubleElim && isLoserMatch
    ? lowerBracketColor
    : null;
  const isOriginHovered = hoveredOriginMatchId === match.id;
  const p1Leading = inProgress && p1Wins > p2Wins;
  const p2Leading = inProgress && p2Wins > p1Wins;
  const p1ZebraBg = getAlternateShade(effectiveCardBg, 7);

  const isCardInAncestry = hoveredAncestry?.matchIds.has(match.id);
  const isP1Ancestor = hoveredAncestry?.slotKeys.has(`${match.id}-1`);
  const isP2Ancestor = hoveredAncestry?.slotKeys.has(`${match.id}-2`);

  const isP1Target = Boolean(
    isP1Ancestor ||
    (hoveredAncestry?.targetPlayerId && p1?.id === hoveredAncestry.targetPlayerId)
  );
  const isP2Target = Boolean(
    isP2Ancestor ||
    (hoveredAncestry?.targetPlayerId && p2?.id === hoveredAncestry.targetPlayerId)
  );

  const isHighlightActive = Boolean(hoveredAncestry && isCardInAncestry);

  const cardBorderColor = hoveredAncestry
    ? isCardInAncestry
      ? secondaryColor
      : `${secondaryColor}44`
    : inProgress || isComplete || isMatchHovered
    ? primaryColor
    : secondaryColor;
  const cardSideBorderColor = branchAccentColor
    ? hoveredAncestry && !isCardInAncestry
      ? `${branchAccentColor}55`
      : branchAccentColor
    : cardBorderColor;
  const isCardBorderThick = !hoveredAncestry && (inProgress || isComplete);

  const p1NameColor = getHighlightedPlayerNameColor({
    isHighlightActive,
    isTargetSlot: isP1Target,
    isOpponentSlot: isP2Target,
    isComplete,
    isWinner: p1Won,
    isLeading: p1Leading,
    primaryColor,
    secondaryColor,
    textColor,
  });

  const p2NameColor = getHighlightedPlayerNameColor({
    isHighlightActive,
    isTargetSlot: isP2Target,
    isOpponentSlot: isP1Target,
    isComplete,
    isWinner: p2Won,
    isLeading: p2Leading,
    primaryColor,
    secondaryColor,
    textColor,
  });

  return (
    <div
      key={match.id}
      id={`bracket-match-${match.id}`}
      className={cn(
        'pointer-events-auto absolute overflow-visible transition-[transform,scale,box-shadow] duration-300',
        isFocusedMatch
          ? 'z-60 scale-[1.08]'
          : isCardInAncestry
          ? 'z-26'
          : isOriginHovered
          ? 'z-25'
          : isMatchHovered
          ? 'z-15'
          : 'z-2'
      )}
      style={{
        left: `${pos.x}px`,
        top: `${pos.y}px`,
        width: `${pos.width}px`,
        height: `${pos.height}px`,
      }}
    >
      {/* Entry (Inbound) Micro-Chips: OUTSIDE the match to the left */}
      {p1InboundChip && (
        <div
          className={cn(
            'pointer-events-auto absolute right-[calc(100%+6px)] top-5 z-30 flex h-7 items-center justify-end',
            hoveredAncestry && !isCardInAncestry && 'opacity-35'
          )}
        >
          {renderMicroChip(p1InboundChip, setHoveredOriginMatchId, onChipClick)}
        </div>
      )}

      {p2InboundChip && (
        <div
          className={cn(
            'pointer-events-auto absolute right-[calc(100%+6px)] top-12.5 z-30 flex h-7 items-center justify-end',
            hoveredAncestry && !isCardInAncestry && 'opacity-35'
          )}
        >
          {renderMicroChip(p2InboundChip, setHoveredOriginMatchId, onChipClick)}
        </div>
      )}

      {/* Match Card Body */}
      <div
        onClick={() => {
          if (!isObsMode && tournament.isLocked && isPlayable) {
            onSelectMatch(match, match.stage === 'GRAND_FINALS_RESET' ? 'Grand Finals' : round.name);
          }
        }}
        onMouseEnter={() => setHoveredMatchId(match.id)}
        onMouseLeave={() => setHoveredMatchId(null)}
        className={cn(
          'flex h-full w-full flex-col justify-start overflow-hidden rounded-sm shadow-[0_2px_6px_rgba(0,0,0,0.45)]',
          isCardBorderThick ? 'border-2' : 'border-[1.5px]',
          branchAccentColor && 'border-x-4',
          isFocusedMatch ? 'outline-offset-2 animate-match-zoom-pulse' : 'outline-offset-0',
          !isObsMode && tournament.isLocked && isPlayable ? 'cursor-pointer' : 'cursor-default',
          hoveredAncestry ? !isCardInAncestry && 'opacity-35' : !isPlayable && 'opacity-70'
        )}
        style={{
          background: effectiveCardBg,
          borderColor: `${cardBorderColor} ${cardSideBorderColor}`,
          boxShadow: isFocusedMatch
            ? `0 0 0 3px ${primaryColor}, 0 0 35px ${primaryColor}dd, 0 0 70px ${primaryColor}66`
            : hoveredAncestry
            ? 'none'
            : isOriginHovered
            ? `0 0 20px ${branchAccentColor || primaryColor}, 0 0 8px rgba(255, 255, 255, 0.6)`
            : inProgress
            ? `0 0 16px ${primaryColor}66`
            : isComplete
            ? `0 0 16px ${primaryColor}55`
            : isMatchHovered
            ? `0 4px 14px ${secondaryColor}40`
            : undefined,
          outline: isFocusedMatch
            ? `2.5px solid ${primaryColor}`
            : !hoveredAncestry && isOriginHovered
            ? `2px solid ${branchAccentColor || primaryColor}`
            : 'none',
        }}
      >
        {/* Match Header Strip */}
        <div
          className="flex h-5 min-h-5 max-h-5 items-center justify-between border-b-[1.5px] px-2 font-medium leading-[20px]"
          style={{
            background: effectiveCardBg,
            fontSize: shelfFontSize,
            color: textColor,
            borderBottomColor: hoveredAncestry
              ? isCardInAncestry
                ? secondaryColor
                : `${secondaryColor}44`
              : isComplete
              ? primaryColor
              : secondaryColor,
          }}
        >
          <div className="flex items-center gap-1.5">
            <span>Match #{match.matchNumber}</span>
            {isAdvanceRound && !isComplete && (
              <span className="text-3xs font-extrabold text-green">
                • Winner Advances
              </span>
            )}
          </div>
          <span>Bo{matchBestOf}</span>
        </div>

        {/* Slot 1: Player 1 */}
        <div
          onMouseEnter={() => onSlotHover(match.id, 1)}
          onMouseLeave={() => onSlotHover(null, null)}
          className={cn(
            'relative flex h-7 min-h-7 max-h-7 items-center justify-between px-2',
            isP1Target && 'z-10 rounded-xs'
          )}
          style={{
            background: isP1Target
              ? `${primaryColor}22`
              : isHighlightActive
                ? p1ZebraBg
                : isComplete
                ? (p1Won ? colorWithAlpha(primaryColor, 0.12, 'rgba(255, 255, 255, 0.04)') : effectiveCardBg)
                : p1ZebraBg,
            boxShadow: isP1Target ? `inset 0 0 0 2px ${primaryColor}, inset 0 0 10px ${primaryColor}88` : undefined,
          }}
        >
          {/* Left Sub-container (Ingress / Origin & Competitor Info) */}
          <div className="flex min-w-0 flex-1 items-center overflow-hidden">
            <div
              onClick={(e) => {
                // Only registered competitors open a profile; draft placeholder seeds ("Seed N") are inert
                if (p1 && p1Profile) {
                  e.stopPropagation();
                  onPlayerClick(p1.id, p1.name, p1Profile.country);
                }
              }}
              className={cn(
                'flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden px-1 rounded-sm',
                p1Profile ? 'cursor-pointer' : 'cursor-[inherit]'
              )}
              title={p1Profile ? 'View competitor tournament profile' : undefined}
            >
              {p1?.seed && (
                <span
                  className={cn(
                    'inline-flex shrink-0 items-center justify-center rounded-xs border-[1.5px] font-mono font-black',
                    isComplete && p2Won && !isHighlightActive && 'opacity-45'
                  )}
                  style={{
                    width: `${seedDim}px`,
                    height: `${seedDim}px`,
                    minWidth: `${seedDim}px`,
                    background: (isComplete && p1Won) || p1Leading
                      ? colorWithAlpha(primaryColor, 0.15, 'rgba(255, 255, 255, 0.08)')
                      : effectiveCardBg,
                    borderColor: (isComplete && p1Won) || p1Leading ? primaryColor : secondaryColor,
                    color: (isComplete && p1Won) || p1Leading ? primaryColor : textColor,
                    fontSize: seedFontSize,
                    lineHeight: `${seedDim}px`,
                  }}
                >
                  {p1.seed}
                </span>
              )}

              {(p1Profile?.country || p1Profile?.avatarUrl) && (
                <PlayerAvatar
                  player={p1Profile}
                  country={p1Profile?.country}
                  className={cn('shrink-0 leading-none', isComplete && p2Won && !isHighlightActive && 'opacity-45')}
                  style={{ fontSize: flagFontSize }}
                />
              )}

              <span
                className={cn(
                  'min-w-0 flex-1 truncate leading-tight',
                  (isComplete && p1Won) || p1Leading || (isHighlightActive && isP1Target)
                    ? 'font-black'
                    : isComplete && p2Won
                    ? 'font-medium'
                    : 'font-bold',
                  isComplete && p2Won && !isHighlightActive && 'opacity-45'
                )}
                style={{ fontSize: nameFontSize, color: p1NameColor }}
              >
                {p1Name}
              </span>
            </div>
          </div>

          {/* Right Sub-container (Egress / Destination & Score) */}
          <div className="ml-1 flex shrink-0 items-center">
            {/* Outbound Chip: Placed right-aligned, immediately to left of score container with 8px margin */}
            {p1OutboundChip && (
              <div className="mr-2 flex items-center">
                {renderMicroChip(p1OutboundChip, setHoveredOriginMatchId, onChipClick)}
              </div>
            )}

            {/* Score Box */}
            <span
              className={cn(
                'font-mono tabular-nums tracking-tight inline-flex shrink-0 items-center justify-center ml-0 rounded-xs leading-none',
                (isComplete && p1Won) || p1Leading ? 'font-black' : 'font-semibold',
                !isComplete && !inProgress && !((isComplete && p1Won) || p1Leading) ? 'border-[1.5px]' : 'border',
                isComplete && p2Won && !isHighlightActive && 'opacity-45'
              )}
              style={{
                fontSize: scoreFontSize,
                minWidth: `${scoreMinW}px`,
                height: `${scoreH}px`,
                color: (isComplete && p1Won) || p1Leading
                  ? primaryColor
                  : textColor,
                background: (isComplete && p1Won) || p1Leading
                  ? colorWithAlpha(primaryColor, 0.22, 'rgba(255, 255, 255, 0.08)')
                  : !isComplete && !inProgress
                  ? effectiveCardBg
                  : 'transparent',
                borderColor: (isComplete && p1Won) || p1Leading
                  ? colorWithAlpha(primaryColor, 0.55, 'transparent')
                  : !isComplete && !inProgress
                  ? secondaryColor
                  : 'transparent',
              }}
            >
              {!isComplete && !inProgress ? '-' : p1ScoreDisplay}
            </span>
          </div>
        </div>

        {/* Player Divider */}
        <div
          className="h-[1.5px] min-h-[1.5px] shrink-0"
          style={{
            background: hoveredAncestry
              ? isCardInAncestry
                ? secondaryColor
                : `${secondaryColor}44`
              : isComplete
              ? primaryColor
              : secondaryColor,
          }}
        />

        {/* Slot 2: Player 2 */}
        <div
          onMouseEnter={() => onSlotHover(match.id, 2)}
          onMouseLeave={() => onSlotHover(null, null)}
          className={cn(
            'relative flex h-7 min-h-7 max-h-7 items-center justify-between px-2',
            isP2Target && 'z-10 rounded-xs'
          )}
          style={{
            background: isP2Target
              ? `${primaryColor}22`
              : isHighlightActive
                ? effectiveCardBg
                : isComplete && p2Won
                ? colorWithAlpha(primaryColor, 0.12, 'rgba(255, 255, 255, 0.04)')
                : effectiveCardBg,
            boxShadow: isP2Target ? `inset 0 0 0 2px ${primaryColor}, inset 0 0 10px ${primaryColor}88` : undefined,
          }}
        >
          {/* Left Sub-container (Ingress / Origin & Competitor Info) */}
          <div className="flex min-w-0 flex-1 items-center overflow-hidden">
            <div
              onClick={(e) => {
                // Only registered competitors open a profile; draft placeholder seeds ("Seed N") are inert
                if (p2 && p2Profile) {
                  e.stopPropagation();
                  onPlayerClick(p2.id, p2.name, p2Profile.country);
                }
              }}
              className={cn(
                'flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden px-1 rounded-sm',
                p2Profile ? 'cursor-pointer' : 'cursor-[inherit]'
              )}
              title={p2Profile ? 'View competitor tournament profile' : undefined}
            >
              {p2?.seed && (
                <span
                  className={cn(
                    'inline-flex shrink-0 items-center justify-center rounded-xs border-[1.5px] font-mono font-black',
                    isComplete && p1Won && !isHighlightActive && 'opacity-45'
                  )}
                  style={{
                    width: `${seedDim}px`,
                    height: `${seedDim}px`,
                    minWidth: `${seedDim}px`,
                    background: (isComplete && p2Won) || p2Leading
                      ? colorWithAlpha(primaryColor, 0.15, 'rgba(255, 255, 255, 0.08)')
                      : effectiveCardBg,
                    borderColor: (isComplete && p2Won) || p2Leading ? primaryColor : secondaryColor,
                    color: (isComplete && p2Won) || p2Leading ? primaryColor : textColor,
                    fontSize: seedFontSize,
                    lineHeight: `${seedDim}px`,
                  }}
                >
                  {p2.seed}
                </span>
              )}

              {(p2Profile?.country || p2Profile?.avatarUrl) && (
                <PlayerAvatar
                  player={p2Profile}
                  country={p2Profile?.country}
                  className={cn('shrink-0 leading-none', isComplete && p1Won && !isHighlightActive && 'opacity-45')}
                  style={{ fontSize: flagFontSize }}
                />
              )}

              <span
                className={cn(
                  'min-w-0 flex-1 truncate leading-tight',
                  (isComplete && p2Won) || p2Leading || (isHighlightActive && isP2Target)
                    ? 'font-black'
                    : isComplete && p1Won
                    ? 'font-medium'
                    : 'font-bold',
                  isComplete && p1Won && !isHighlightActive && 'opacity-45'
                )}
                style={{ fontSize: nameFontSize, color: p2NameColor }}
              >
                {p2Name}
              </span>
            </div>
          </div>

          {/* Right Sub-container (Egress / Destination & Score) */}
          <div className="ml-1 flex shrink-0 items-center">
            {/* Outbound Chip: Placed right-aligned, immediately to left of score container with 8px margin */}
            {p2OutboundChip && (
              <div className="mr-2 flex items-center">
                {renderMicroChip(p2OutboundChip, setHoveredOriginMatchId, onChipClick)}
              </div>
            )}

            {/* Score Box */}
            <span
              className={cn(
                'font-mono tabular-nums tracking-tight inline-flex shrink-0 items-center justify-center ml-0 rounded-xs leading-none',
                (isComplete && p2Won) || p2Leading ? 'font-black' : 'font-semibold',
                !isComplete && !inProgress && !((isComplete && p2Won) || p2Leading) ? 'border-[1.5px]' : 'border',
                isComplete && p1Won && !isHighlightActive && 'opacity-45'
              )}
              style={{
                fontSize: scoreFontSize,
                minWidth: `${scoreMinW}px`,
                height: `${scoreH}px`,
                color: (isComplete && p2Won) || p2Leading
                  ? primaryColor
                  : textColor,
                background: (isComplete && p2Won) || p2Leading
                  ? colorWithAlpha(primaryColor, 0.22, 'rgba(255, 255, 255, 0.08)')
                  : !isComplete && !inProgress
                  ? effectiveCardBg
                  : 'transparent',
                borderColor: (isComplete && p2Won) || p2Leading
                  ? colorWithAlpha(primaryColor, 0.55, 'transparent')
                  : !isComplete && !inProgress
                  ? secondaryColor
                  : 'transparent',
              }}
            >
              {!isComplete && !inProgress ? '-' : p2ScoreDisplay}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
