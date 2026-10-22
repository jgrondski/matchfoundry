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

  const baseCardBorder = hoveredAncestry
    ? isCardInAncestry
      ? `1.5px solid ${secondaryColor}`
      : `1.5px solid ${secondaryColor}44`
    : inProgress || isComplete
    ? `2px solid ${primaryColor}`
    : isMatchHovered
    ? `1.5px solid ${primaryColor}`
    : `1.5px solid ${secondaryColor}`;

  const cardBorderTop = baseCardBorder;
  const cardBorderBottom = baseCardBorder;
  const cardBorderLeft = branchAccentColor
    ? `4px solid ${hoveredAncestry && !isCardInAncestry ? `${branchAccentColor}55` : branchAccentColor}`
    : baseCardBorder;
  const cardBorderRight = branchAccentColor
    ? `4px solid ${hoveredAncestry && !isCardInAncestry ? `${branchAccentColor}55` : branchAccentColor}`
    : baseCardBorder;

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
      style={{
        position: 'absolute',
        left: `${pos.x}px`,
        top: `${pos.y}px`,
        width: `${pos.width}px`,
        height: `${pos.height}px`,
        overflow: 'visible',
        zIndex: isFocusedMatch
          ? 60
          : isCardInAncestry
          ? 26
          : isOriginHovered
          ? 25
          : isMatchHovered
          ? 15
          : 2,
        pointerEvents: 'auto',
        transform: isFocusedMatch ? 'scale(1.08)' : undefined,
        transition: 'transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.35s ease',
      }}
    >
      {/* Entry (Inbound) Micro-Chips: OUTSIDE the match to the left */}
      {p1InboundChip && (
        <div
          style={{
            position: 'absolute',
            right: 'calc(100% + 6px)',
            top: '20px',
            height: '28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            zIndex: 30,
            pointerEvents: 'auto',
            opacity: hoveredAncestry ? (isCardInAncestry ? 1 : 0.35) : 1,
          }}
        >
          {renderMicroChip(p1InboundChip, setHoveredOriginMatchId, onChipClick)}
        </div>
      )}

      {p2InboundChip && (
        <div
          style={{
            position: 'absolute',
            right: 'calc(100% + 6px)',
            top: '49.5px',
            height: '28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            zIndex: 30,
            pointerEvents: 'auto',
            opacity: hoveredAncestry ? (isCardInAncestry ? 1 : 0.35) : 1,
          }}
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
        style={{
          width: '100%',
          height: '100%',
          background: effectiveCardBg,
          borderRadius: '5px',
          borderTop: cardBorderTop,
          borderBottom: cardBorderBottom,
          borderLeft: cardBorderLeft,
          borderRight: cardBorderRight,
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
            : '0 2px 6px rgba(0, 0, 0, 0.45)',
          outline: isFocusedMatch
            ? `2.5px solid ${primaryColor}`
            : !hoveredAncestry && isOriginHovered
            ? `2px solid ${branchAccentColor || primaryColor}`
            : 'none',
          outlineOffset: isFocusedMatch ? '2px' : '0px',
          animation: isFocusedMatch ? 'matchZoomPulse 2.4s ease-in-out' : undefined,
          cursor: !isObsMode && tournament.isLocked && isPlayable ? 'pointer' : 'default',
          opacity: hoveredAncestry
            ? isCardInAncestry
              ? 1
              : 0.35
            : isPlayable
            ? 1
            : 0.72,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-start',
          boxSizing: 'border-box',
        }}
      >
        {/* Match Header Strip */}
        <div
          style={{
            height: '20px',
            minHeight: '20px',
            maxHeight: '20px',
            padding: '0 0.55rem',
            background: effectiveCardBg,
            fontSize: shelfFontSize,
            color: textColor,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: hoveredAncestry
              ? isCardInAncestry
                ? `1.5px solid ${secondaryColor}`
                : `1.5px solid ${secondaryColor}44`
              : isComplete
              ? `1.5px solid ${primaryColor}`
              : `1.5px solid ${secondaryColor}`,
            boxSizing: 'border-box',
            lineHeight: '20px',
            fontWeight: 500,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span>Match #{match.matchNumber}</span>
            {isAdvanceRound && !isComplete && (
              <span style={{ color: '#10b981', fontSize: '0.62rem', fontWeight: 800 }}>
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
          style={{
            height: '28px',
            minHeight: '28px',
            maxHeight: '28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 0.55rem',
            background: isHighlightActive
              ? p1ZebraBg
              : isComplete
              ? (p1Won ? colorWithAlpha(primaryColor, 0.12, 'rgba(255, 255, 255, 0.04)') : effectiveCardBg)
              : p1ZebraBg,
            boxSizing: 'border-box',
            position: 'relative',
            ...(isP1Target
              ? {
                  boxShadow: `inset 0 0 0 2px ${primaryColor}, inset 0 0 10px ${primaryColor}88`,
                  background: `${primaryColor}22`,
                  zIndex: 10,
                  borderRadius: '3px',
                }
              : {}),
          }}
        >
          {/* Left Sub-container (Ingress / Origin & Competitor Info) */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              minWidth: 0,
              flex: 1,
              overflow: 'hidden',
            }}
          >
            <div
              onClick={(e) => {
                if (p1?.id) {
                  e.stopPropagation();
                  onPlayerClick(p1.id, p1.name, p1Profile?.country);
                }
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                overflow: 'hidden',
                padding: '0.05rem 0.2rem',
                borderRadius: 'var(--radius-sm)',
                cursor: p1?.id ? 'pointer' : 'inherit',
                minWidth: 0,
                flex: 1,
              }}
              title={p1?.id ? 'View competitor tournament profile' : undefined}
            >
              {p1?.seed && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: `${seedDim}px`,
                    height: `${seedDim}px`,
                    minWidth: `${seedDim}px`,
                    background: (isComplete && p1Won) || p1Leading
                      ? colorWithAlpha(primaryColor, 0.15, 'rgba(255, 255, 255, 0.08)')
                      : effectiveCardBg,
                    border: `1.5px solid ${(isComplete && p1Won) || p1Leading ? primaryColor : secondaryColor}`,
                    color: (isComplete && p1Won) || p1Leading ? primaryColor : textColor,
                    opacity: isComplete && p2Won && !isHighlightActive ? 0.45 : 1,
                    fontWeight: 900,
                    fontSize: seedFontSize,
                    fontFamily: 'var(--font-mono)',
                    borderRadius: '3px',
                    flexShrink: 0,
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
                  style={{
                    fontSize: flagFontSize,
                    lineHeight: 1,
                    flexShrink: 0,
                    opacity: isComplete && p2Won && !isHighlightActive ? 0.45 : 1,
                  }}
                />
              )}

              <span
                style={{
                  flex: 1,
                  minWidth: 0,
                  fontSize: nameFontSize,
                  fontWeight:
                    (isComplete && p1Won) || p1Leading || (isHighlightActive && isP1Target)
                      ? 900
                      : isComplete && p2Won
                      ? 500
                      : 700,
                  color: p1NameColor,
                  opacity: isComplete && p2Won && !isHighlightActive ? 0.45 : 1,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  lineHeight: 1.1,
                }}
              >
                {p1Name}
              </span>
            </div>
          </div>

          {/* Right Sub-container (Egress / Destination & Score) */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              flexShrink: 0,
              marginLeft: '4px',
            }}
          >
            {/* Outbound Chip: Placed right-aligned, immediately to left of score container with 8px margin */}
            {p1OutboundChip && (
              <div style={{ marginRight: '8px', display: 'flex', alignItems: 'center' }}>
                {renderMicroChip(p1OutboundChip, setHoveredOriginMatchId, onChipClick)}
              </div>
            )}

            {/* Score Box */}
            <span
              className="tabular-nums"
              style={{
                fontSize: scoreFontSize,
                fontWeight: (isComplete && p1Won) || p1Leading ? 900 : 600,
                minWidth: `${scoreMinW}px`,
                height: `${scoreH}px`,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: (isComplete && p1Won) || p1Leading
                  ? primaryColor
                  : textColor,
                background: (isComplete && p1Won) || p1Leading
                  ? colorWithAlpha(primaryColor, 0.22, 'rgba(255, 255, 255, 0.08)')
                  : !isComplete && !inProgress
                  ? effectiveCardBg
                  : 'transparent',
                border: (isComplete && p1Won) || p1Leading
                  ? `1px solid ${colorWithAlpha(primaryColor, 0.55, 'transparent')}`
                  : !isComplete && !inProgress
                  ? `1.5px solid ${secondaryColor}`
                  : '1px solid transparent',
                opacity: isComplete && p2Won && !isHighlightActive ? 0.45 : 1,
                borderRadius: '3px',
                marginLeft: 0,
                flexShrink: 0,
                lineHeight: 1,
              }}
            >
              {!isComplete && !inProgress ? '-' : p1ScoreDisplay}
            </span>
          </div>
        </div>

        {/* Player Divider */}
        <div
          style={{
            height: '1.5px',
            minHeight: '1.5px',
            background: hoveredAncestry
              ? isCardInAncestry
                ? secondaryColor
                : `${secondaryColor}44`
              : isComplete
              ? primaryColor
              : secondaryColor,
            flexShrink: 0,
          }}
        />

        {/* Slot 2: Player 2 */}
        <div
          onMouseEnter={() => onSlotHover(match.id, 2)}
          onMouseLeave={() => onSlotHover(null, null)}
          style={{
            height: '28px',
            minHeight: '28px',
            maxHeight: '28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 0.55rem',
            background: isHighlightActive
              ? effectiveCardBg
              : isComplete && p2Won
              ? colorWithAlpha(primaryColor, 0.12, 'rgba(255, 255, 255, 0.04)')
              : effectiveCardBg,
            boxSizing: 'border-box',
            position: 'relative',
            ...(isP2Target
              ? {
                  boxShadow: `inset 0 0 0 2px ${primaryColor}, inset 0 0 10px ${primaryColor}88`,
                  background: `${primaryColor}22`,
                  zIndex: 10,
                  borderRadius: '3px',
                }
              : {}),
          }}
        >
          {/* Left Sub-container (Ingress / Origin & Competitor Info) */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              minWidth: 0,
              flex: 1,
              overflow: 'hidden',
            }}
          >
            <div
              onClick={(e) => {
                if (p2?.id) {
                  e.stopPropagation();
                  onPlayerClick(p2.id, p2.name, p2Profile?.country);
                }
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                overflow: 'hidden',
                padding: '0.05rem 0.2rem',
                borderRadius: 'var(--radius-sm)',
                cursor: p2?.id ? 'pointer' : 'inherit',
                minWidth: 0,
                flex: 1,
              }}
              title={p2?.id ? 'View competitor tournament profile' : undefined}
            >
              {p2?.seed && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: `${seedDim}px`,
                    height: `${seedDim}px`,
                    minWidth: `${seedDim}px`,
                    background: (isComplete && p2Won) || p2Leading
                      ? colorWithAlpha(primaryColor, 0.15, 'rgba(255, 255, 255, 0.08)')
                      : effectiveCardBg,
                    border: `1.5px solid ${(isComplete && p2Won) || p2Leading ? primaryColor : secondaryColor}`,
                    color: (isComplete && p2Won) || p2Leading ? primaryColor : textColor,
                    opacity: isComplete && p1Won && !isHighlightActive ? 0.45 : 1,
                    fontWeight: 900,
                    fontSize: seedFontSize,
                    fontFamily: 'var(--font-mono)',
                    borderRadius: '3px',
                    flexShrink: 0,
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
                  style={{
                    fontSize: flagFontSize,
                    lineHeight: 1,
                    flexShrink: 0,
                    opacity: isComplete && p1Won && !isHighlightActive ? 0.45 : 1,
                  }}
                />
              )}

              <span
                style={{
                  flex: 1,
                  minWidth: 0,
                  fontSize: nameFontSize,
                  fontWeight:
                    (isComplete && p2Won) || p2Leading || (isHighlightActive && isP2Target)
                      ? 900
                      : isComplete && p1Won
                      ? 500
                      : 700,
                  color: p2NameColor,
                  opacity: isComplete && p1Won && !isHighlightActive ? 0.45 : 1,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  lineHeight: 1.1,
                }}
              >
                {p2Name}
              </span>
            </div>
          </div>

          {/* Right Sub-container (Egress / Destination & Score) */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              flexShrink: 0,
              marginLeft: '4px',
            }}
          >
            {/* Outbound Chip: Placed right-aligned, immediately to left of score container with 8px margin */}
            {p2OutboundChip && (
              <div style={{ marginRight: '8px', display: 'flex', alignItems: 'center' }}>
                {renderMicroChip(p2OutboundChip, setHoveredOriginMatchId, onChipClick)}
              </div>
            )}

            {/* Score Box */}
            <span
              className="tabular-nums"
              style={{
                fontSize: scoreFontSize,
                fontWeight: (isComplete && p2Won) || p2Leading ? 900 : 600,
                minWidth: `${scoreMinW}px`,
                height: `${scoreH}px`,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: (isComplete && p2Won) || p2Leading
                  ? primaryColor
                  : textColor,
                background: (isComplete && p2Won) || p2Leading
                  ? colorWithAlpha(primaryColor, 0.22, 'rgba(255, 255, 255, 0.08)')
                  : !isComplete && !inProgress
                  ? effectiveCardBg
                  : 'transparent',
                border: (isComplete && p2Won) || p2Leading
                  ? `1px solid ${colorWithAlpha(primaryColor, 0.55, 'transparent')}`
                  : !isComplete && !inProgress
                  ? `1.5px solid ${secondaryColor}`
                  : '1px solid transparent',
                opacity: isComplete && p1Won && !isHighlightActive ? 0.45 : 1,
                borderRadius: '3px',
                marginLeft: 0,
                flexShrink: 0,
                lineHeight: 1,
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
