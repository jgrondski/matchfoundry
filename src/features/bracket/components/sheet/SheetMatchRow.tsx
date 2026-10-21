import React from 'react';
import { Check } from 'lucide-react';
import { Tournament, TournamentTier } from '../../../tournament/types';
import { BracketMatch, isMatchPlayable } from '../../types';
import { SheetSizeTokens, getMatchStatus } from '../../sheetUtils';
import { colorWithAlpha, getAlternateShade } from '../../colorUtils';
import { PlayerAvatar } from '../../../players/components/PlayerAvatar';
import { getEffectivePlayerName } from '../../../players/playerNameUtils';

interface SheetMatchRowProps {
  match: BracketMatch;
  matchIdx: number;
  round: { name: string; roundIdentifier?: string; roundNumber: number };
  tournament: Tournament;
  tier: TournamentTier;
  inheritedBestOf: number;
  effectiveGameCount: number;
  gameNumbers: number[];
  sizeTokens: SheetSizeTokens;
  competitorColWidth: number;
  isLoserRound: boolean;
  primaryColor: string;
  secondaryColor: string;
  cardColor: string;
  lowerBracketColor: string;
  hoveredMatchId: string | null;
  hoveredPlayerKey: string | null;
  onHoverMatch: (id: string | null) => void;
  onHoverPlayer: (key: string | null) => void;
  onSelectMatch: (match: BracketMatch, roundName: string) => void;
  onPlayerClick: (pId: string, pName: string, country?: string) => void;
}

export const SheetMatchRow: React.FC<SheetMatchRowProps> = ({
  match,
  matchIdx,
  round,
  tournament,
  tier,
  inheritedBestOf,
  effectiveGameCount: _effectiveGameCount,
  gameNumbers,
  sizeTokens,
  competitorColWidth,
  isLoserRound,
  primaryColor,
  secondaryColor,
  cardColor,
  lowerBracketColor,
  hoveredMatchId,
  hoveredPlayerKey,
  onHoverMatch,
  onHoverPlayer,
  onSelectMatch,
  onPlayerClick,
}) => {
  const record = tournament.matchScores[match.id];
  const status = getMatchStatus(match, record);
  const isHovered = hoveredMatchId === match.id;
  const isComplete = status.type === 'complete';

  // Lower bracket match check
  const isMatchInLosers =
    isLoserRound ||
    match.stage === 'LOSERS' ||
    (match.roundIdentifier?.startsWith('L') && match.roundIdentifier !== 'LF') ||
    match.roundIdentifier === 'LF' ||
    match.subTrack === 'PRE_MERGE_LOWER' ||
    match.subTrack === 'RE_CLIMB' ||
    match.roundIdentifier === 'PRE_L1' ||
    match.roundIdentifier === 'PRE_L2' ||
    match.roundIdentifier === '2C' ||
    match.roundIdentifier === 'PO';
  const matchAccentColor = isMatchInLosers ? lowerBracketColor : primaryColor;

  const p1 = match.player1.player;
  const p2 = match.player2.player;
  const p1Name = getEffectivePlayerName(p1) || (match.player1.sourceMatchId ? `Winner of #${tier.bracket.matchesById[match.player1.sourceMatchId]?.matchNumber || '?'}` : 'TBD');
  const p2Name = getEffectivePlayerName(p2) || (match.player2.sourceMatchId ? `Winner of #${tier.bracket.matchesById[match.player2.sourceMatchId]?.matchNumber || '?'}` : 'TBD');

  const p1Wins = record?.player1Wins || 0;
  const p2Wins = record?.player2Wins || 0;
  const matchBestOf = record?.bestOf || match.bestOf || inheritedBestOf;
  const hasTieGame = Boolean(record?.games?.some(g => g.winnerPlayerId === 'TIE' || (g.player1Points !== null && g.player1Points === g.player2Points && g.player1Points > 0)));
  const hasTiebreaker = Boolean(record?.hasTiebreaker || hasTieGame || (record?.games && record.games.length > matchBestOf));
  const p1ScoreDisplay = hasTiebreaker ? `${p1Wins} (t)` : `${p1Wins}`;
  const p2ScoreDisplay = hasTiebreaker ? `${p2Wins} (t)` : `${p2Wins}`;

  const p1IsWinner = Boolean(p1?.id && (match.winnerId === p1.id || (record?.isComplete && record?.winnerPlayerId === p1.id)));
  const p2IsWinner = Boolean(p2?.id && (match.winnerId === p2.id || (record?.isComplete && record?.winnerPlayerId === p2.id)));
  const isPlayable = isMatchPlayable(match);

  // Pure alternating zebra backgrounds
  const baseCard = cardColor;
  const altCard = getAlternateShade(baseCard, 5);
  const matchBaseBg = matchIdx % 2 === 0 ? baseCard : altCard;
  const matchHoverBg = colorWithAlpha(primaryColor, 0.10, 'rgba(255, 255, 255, 0.07)');
  const blockBg = isHovered ? matchHoverBg : matchBaseBg;

  // Block borders & hover highlight
  const hoverBorderColor = colorWithAlpha(primaryColor, 0.75, 'var(--color-gold, #f59e0b)');
  const topRowBorder = `1px solid ${colorWithAlpha(secondaryColor, 0.35, 'rgba(255, 255, 255, 0.08)')}`;
  const midRowBorder = '1px solid rgba(255, 255, 255, 0.04)';
  const botRowBorder = `1px solid ${colorWithAlpha(secondaryColor, 0.25, 'rgba(255, 255, 255, 0.06)')}`;

  const topBorder = topRowBorder;
  const botBorder = botRowBorder;
  const midBorder = isHovered ? `1px solid ${colorWithAlpha(primaryColor, 0.15, 'rgba(255, 255, 255, 0.04)')}` : midRowBorder;
  const leftBorder = '1px solid transparent';
  const rightBorder = '1px solid rgba(255, 255, 255, 0.05)';

  const matchNumShadow = isHovered
    ? `inset 1px 0 0 ${hoverBorderColor}, inset 0 1px 0 ${hoverBorderColor}, inset 0 -1px 0 ${hoverBorderColor}`
    : 'none';
  const completeShadow = isHovered
    ? `inset -1px 0 0 ${hoverBorderColor}, inset 0 1px 0 ${hoverBorderColor}, inset 0 -1px 0 ${hoverBorderColor}`
    : 'none';
  const row1Shadow = isHovered ? `inset 0 1px 0 ${hoverBorderColor}` : 'none';
  const row2Shadow = isHovered ? `inset 0 -1px 0 ${hoverBorderColor}` : 'none';

  const baseTdStyle: React.CSSProperties = {
    padding: sizeTokens.tdPadding,
    verticalAlign: 'middle',
    overflow: 'hidden',
    boxSizing: 'border-box',
    borderRight: '1px solid rgba(255, 255, 255, 0.04)',
  };

  const baseTdMergedStyle: React.CSSProperties = {
    padding: sizeTokens.tdMergedPadding,
    verticalAlign: 'middle',
    overflow: 'hidden',
    boxSizing: 'border-box',
    borderRight: '1px solid rgba(255, 255, 255, 0.04)',
  };

  return (
    <>
      {/* Row 1: Player 1 */}
      <tr
        onClick={() => {
          if (isPlayable && tournament.isLocked) {
            onSelectMatch(
              match,
              match.stage === 'GRAND_FINALS_RESET' ? 'Grand Finals' : round.name
            );
          }
        }}
        onMouseEnter={() => onHoverMatch(match.id)}
        onMouseLeave={() => onHoverMatch(null)}
        style={{
          background: blockBg,
          cursor: isPlayable && tournament.isLocked ? 'pointer' : 'default',
          opacity: isPlayable ? 1 : 0.72,
          transition: 'background 0.12s ease',
        }}
      >
        {/* Match # (RowSpan 2) */}
        <td
          rowSpan={2}
          style={{
            ...baseTdMergedStyle,
            borderTop: topBorder,
            borderBottom: botBorder,
            borderLeft: leftBorder,
            boxShadow: matchNumShadow,
            textAlign: 'center',
            fontWeight: 700,
            width: `${sizeTokens.colMatch}px`,
            minWidth: `${sizeTokens.colMatch}px`,
            maxWidth: `${sizeTokens.colMatch}px`,
          }}
        >
          <span
            style={{
              fontSize: sizeTokens.fontSizeMatchNum,
              padding: '0.12rem 0.4rem',
              borderRadius: 'var(--radius-sm)',
              fontWeight: 700,
              fontFamily: 'var(--font-mono)',
              background: colorWithAlpha(matchAccentColor, 0.15, 'rgba(255, 255, 255, 0.06)'),
              color: matchAccentColor,
              border: `1px solid ${colorWithAlpha(matchAccentColor, 0.4, 'rgba(255, 255, 255, 0.12)')}`,
              display: 'inline-block',
              lineHeight: 1.2,
            }}
          >
            #{match.matchNumber}
          </span>
        </td>

        {/* Player 1 Seed & Competitor Info */}
        <td style={{ ...baseTdStyle, borderTop: topBorder, borderBottom: midBorder, boxShadow: row1Shadow, width: `${competitorColWidth}px`, minWidth: `${competitorColWidth}px`, maxWidth: `${competitorColWidth}px`, textAlign: 'left' }}>
          <div
            onClick={(e) => {
              if (p1?.id) {
                e.stopPropagation();
                onPlayerClick(p1.id, p1.name, p1.country);
              }
            }}
            onMouseEnter={() => p1?.id && onHoverPlayer(`p1-${match.id}`)}
            onMouseLeave={() => onHoverPlayer(null)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.1rem 0.35rem',
              borderRadius: 'var(--radius-sm)',
              background: hoveredPlayerKey === `p1-${match.id}` ? colorWithAlpha(primaryColor, 0.15, 'rgba(255, 255, 255, 0.08)') : 'transparent',
              boxShadow: hoveredPlayerKey === `p1-${match.id}` ? `0 0 0 1px ${primaryColor}` : 'none',
              cursor: p1?.id ? 'pointer' : 'inherit',
              transition: 'all 0.12s ease',
              maxWidth: '100%',
              width: '100%',
              boxSizing: 'border-box',
            }}
            title={p1?.id ? "View competitor tournament profile" : undefined}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', width: `${sizeTokens.countrySeedWidth}px`, flexShrink: 0 }}>
              {(p1?.country || (p1 as any)?.avatarUrl) && <PlayerAvatar player={p1 as any} country={p1?.country} style={{ fontSize: sizeTokens.flagSize, lineHeight: 1 }} />}
              {p1?.seed && (
                <span
                  style={{
                    fontSize: sizeTokens.fontSizeSeed,
                    padding: '0.06rem 0.28rem',
                    borderRadius: 'var(--radius-sm)',
                    background: colorWithAlpha(matchAccentColor, 0.12, 'rgba(255, 255, 255, 0.08)'),
                    color: matchAccentColor,
                    border: `1px solid ${colorWithAlpha(matchAccentColor, 0.25, 'rgba(255, 255, 255, 0.1)')}`,
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 700,
                    lineHeight: 1.1,
                  }}
                >
                  #{p1.seed}
                </span>
              )}
            </span>
            <span
              style={{
                fontWeight: isComplete ? (p1IsWinner ? 800 : 400) : (p1IsWinner ? 700 : 500),
                fontSize: sizeTokens.fontSizePlayerName,
                color: hoveredPlayerKey === `p1-${match.id}`
                  ? primaryColor
                  : p1IsWinner
                  ? primaryColor
                  : 'var(--color-text-primary)',
                opacity: hoveredPlayerKey === `p1-${match.id}` ? 1 : isComplete && p2IsWinner ? 0.45 : 1,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                flex: 1,
                minWidth: 0,
              }}
            >
              {p1Name}
            </span>
            {match.player1.isManualOverride && (
              <span
                style={{
                  fontSize: '0.6rem',
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  padding: '0.05rem 0.28rem',
                  borderRadius: 'var(--radius-sm)',
                  background: 'rgba(245, 158, 11, 0.18)',
                  color: '#fbbf24',
                  border: '1px solid rgba(245, 158, 11, 0.4)',
                  textTransform: 'uppercase',
                  lineHeight: 1.1,
                }}
                title="Position manually placed by tournament organizer"
              >
                OVERRIDE
              </span>
            )}
          </div>
        </td>

        {/* Player 1 Games Won Score */}
        <td
          style={{
            ...baseTdStyle,
            borderTop: topBorder,
            borderBottom: midBorder,
            boxShadow: row1Shadow,
            textAlign: 'center',
            paddingRight: '14px',
            fontWeight: p1IsWinner ? 800 : 600,
            fontSize: sizeTokens.fontSizeGamesWon,
            width: `${sizeTokens.colGamesWon}px`,
            minWidth: `${sizeTokens.colGamesWon}px`,
            maxWidth: `${sizeTokens.colGamesWon}px`,
          }}
        >
          <span
            className="tabular-nums"
            style={{
              display: 'inline-block',
              padding: '0.08rem 0.4rem',
              borderRadius: 'var(--radius-sm)',
              background: p1IsWinner
                ? colorWithAlpha(primaryColor, 0.22, 'rgba(255, 255, 255, 0.08)')
                : 'transparent',
              color: p1IsWinner
                ? primaryColor
                : 'var(--color-text-primary)',
              opacity: isComplete && p2IsWinner ? 0.45 : 1,
              border: p1IsWinner ? `1px solid ${colorWithAlpha(primaryColor, 0.55, 'transparent')}` : '1px solid transparent',
              lineHeight: 1.2,
            }}
          >
            {p1ScoreDisplay}
          </span>
        </td>

        {/* Games 1 to effectiveGameCount for Player 1 */}
        {gameNumbers.map((gNum) => {
          const isBeyondBestOf = gNum > matchBestOf;
          const game = record?.games.find((g) => g.gameNumber === gNum);
          const p1Pts = game?.player1Points;
          const p2Pts = game?.player2Points;
          const p1WonGame =
            game?.winnerPlayerId === p1?.id ||
            (p1Pts !== null && p2Pts !== null && p1Pts !== undefined && p2Pts !== undefined && p1Pts > p2Pts);
          const isLoserScore = isComplete && p2IsWinner && !p1WonGame;

          return (
            <td
              key={gNum}
              style={{
                ...baseTdStyle,
                borderTop: topBorder,
                borderBottom: midBorder,
                boxShadow: row1Shadow,
                textAlign: 'right',
                padding: sizeTokens.gameCellPadding,
                width: `${sizeTokens.colGame}px`,
                minWidth: `${sizeTokens.colGame}px`,
                maxWidth: `${sizeTokens.colGame}px`,
                color: isBeyondBestOf ? 'var(--color-text-muted)' : 'var(--color-text-primary)',
                overflow: 'visible',
              }}
            >
              {isBeyondBestOf ? (
                <span style={{ opacity: 0.25 }}>—</span>
              ) : p1Pts !== null && p1Pts !== undefined ? (
                <span
                  className="tabular-nums"
                  style={{
                    padding: '0.1rem 0.32rem',
                    margin: 0,
                    borderRadius: 'var(--radius-sm)',
                    background: p1WonGame ? colorWithAlpha(matchAccentColor, 0.16, 'rgba(255, 255, 255, 0.08)') : 'transparent',
                    color: p1WonGame ? matchAccentColor : 'var(--color-text-primary)',
                    opacity: isLoserScore ? 0.45 : 1,
                    fontWeight: p1WonGame ? 700 : 400,
                    fontSize: sizeTokens.fontSizeGameScore,
                    fontFamily: 'var(--font-mono)',
                    border: p1WonGame ? `1px solid ${colorWithAlpha(matchAccentColor, 0.38, 'transparent')}` : '1px solid transparent',
                    display: 'inline-block',
                    lineHeight: 1.2,
                    boxSizing: 'border-box',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {p1Pts.toLocaleString()}
                </span>
              ) : (
                <span style={{ color: 'rgba(255, 255, 255, 0.15)', fontSize: '0.8rem', marginRight: '6px' }}>·</span>
              )}
            </td>
          );
        })}

        {/* Complete Status (RowSpan 2) */}
        <td
          rowSpan={2}
          style={{
            ...baseTdMergedStyle,
            borderTop: topBorder,
            borderBottom: botBorder,
            borderRight: rightBorder,
            boxShadow: completeShadow,
            textAlign: 'center',
            width: `${sizeTokens.colComplete}px`,
            minWidth: `${sizeTokens.colComplete}px`,
            maxWidth: `${sizeTokens.colComplete}px`,
          }}
        >
          {status.type === 'complete' && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                background: 'rgba(34, 197, 94, 0.16)',
                border: '1px solid rgba(34, 197, 94, 0.4)',
                color: '#4ade80',
                margin: '0 auto',
              }}
              title="Complete"
            >
              <Check size={12} strokeWidth={3} />
            </span>
          )}
          {status.type === 'in_progress' && (
            <span
              style={{
                fontSize: sizeTokens.fontSizeStatusBadge,
                fontWeight: 700,
                padding: '0.12rem 0.45rem',
                borderRadius: 'var(--radius-full)',
                background: colorWithAlpha(primaryColor, 0.18, 'rgba(245, 158, 11, 0.18)'),
                color: primaryColor,
                border: `1px solid ${colorWithAlpha(primaryColor, 0.45, 'rgba(245, 158, 11, 0.45)')}`,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                lineHeight: 1.2,
              }}
              title="In Progress"
            >
              <span
                style={{
                  width: '5px',
                  height: '5px',
                  borderRadius: '50%',
                  background: primaryColor,
                  boxShadow: `0 0 5px ${primaryColor}`,
                }}
              />
              Live
            </span>
          )}
          {status.type === 'not_started' && (
            <span
              style={{
                color: 'var(--color-text-muted)',
                fontSize: sizeTokens.fontSizeStatusBadge,
                opacity: 0.35,
              }}
              title="Waiting"
            >
              —
            </span>
          )}
        </td>
      </tr>

      {/* Row 2: Player 2 */}
      <tr
        onClick={() => {
          if (isPlayable && tournament.isLocked) {
            onSelectMatch(
              match,
              match.stage === 'GRAND_FINALS_RESET' ? 'Grand Finals' : round.name
            );
          }
        }}
        onMouseEnter={() => onHoverMatch(match.id)}
        onMouseLeave={() => onHoverMatch(null)}
        style={{
          background: blockBg,
          cursor: isPlayable && tournament.isLocked ? 'pointer' : 'default',
          opacity: isPlayable ? 1 : 0.72,
          transition: 'background 0.12s ease',
        }}
      >
        {/* Player 2 Seed & Competitor Info */}
        <td style={{ ...baseTdStyle, borderBottom: botBorder, boxShadow: row2Shadow, width: `${competitorColWidth}px`, minWidth: `${competitorColWidth}px`, maxWidth: `${competitorColWidth}px`, textAlign: 'left' }}>
          <div
            onClick={(e) => {
              if (p2?.id) {
                e.stopPropagation();
                onPlayerClick(p2.id, p2.name, p2.country);
              }
            }}
            onMouseEnter={() => p2?.id && onHoverPlayer(`p2-${match.id}`)}
            onMouseLeave={() => onHoverPlayer(null)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.1rem 0.35rem',
              borderRadius: 'var(--radius-sm)',
              background: hoveredPlayerKey === `p2-${match.id}` ? colorWithAlpha(primaryColor, 0.15, 'rgba(255, 255, 255, 0.08)') : 'transparent',
              boxShadow: hoveredPlayerKey === `p2-${match.id}` ? `0 0 0 1px ${primaryColor}` : 'none',
              cursor: p2?.id ? 'pointer' : 'inherit',
              transition: 'all 0.12s ease',
              maxWidth: '100%',
              width: '100%',
              boxSizing: 'border-box',
            }}
            title={p2?.id ? "View competitor tournament profile" : undefined}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', width: `${sizeTokens.countrySeedWidth}px`, flexShrink: 0 }}>
              {(p2?.country || (p2 as any)?.avatarUrl) && <PlayerAvatar player={p2 as any} country={p2?.country} style={{ fontSize: sizeTokens.flagSize, lineHeight: 1 }} />}
              {p2?.seed && (
                <span
                  style={{
                    fontSize: sizeTokens.fontSizeSeed,
                    padding: '0.06rem 0.28rem',
                    borderRadius: 'var(--radius-sm)',
                    background: colorWithAlpha(matchAccentColor, 0.12, 'rgba(255, 255, 255, 0.08)'),
                    color: matchAccentColor,
                    border: `1px solid ${colorWithAlpha(matchAccentColor, 0.25, 'rgba(255, 255, 255, 0.1)')}`,
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 700,
                    lineHeight: 1.1,
                  }}
                >
                  #{p2.seed}
                </span>
              )}
            </span>
            <span
              style={{
                fontWeight: isComplete ? (p2IsWinner ? 800 : 400) : (p2IsWinner ? 700 : 500),
                fontSize: sizeTokens.fontSizePlayerName,
                color: hoveredPlayerKey === `p2-${match.id}`
                  ? primaryColor
                  : p2IsWinner
                  ? primaryColor
                  : 'var(--color-text-primary)',
                opacity: hoveredPlayerKey === `p2-${match.id}` ? 1 : isComplete && p1IsWinner ? 0.45 : 1,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                flex: 1,
                minWidth: 0,
              }}
            >
              {p2Name}
            </span>
            {match.player2.isManualOverride && (
              <span
                style={{
                  fontSize: '0.6rem',
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  padding: '0.05rem 0.28rem',
                  borderRadius: 'var(--radius-sm)',
                  background: 'rgba(245, 158, 11, 0.18)',
                  color: '#fbbf24',
                  border: '1px solid rgba(245, 158, 11, 0.4)',
                  textTransform: 'uppercase',
                  lineHeight: 1.1,
                }}
                title="Position manually placed by tournament organizer"
              >
                OVERRIDE
              </span>
            )}
          </div>
        </td>

        {/* Player 2 Games Won Score */}
        <td
          style={{
            ...baseTdStyle,
            borderBottom: botBorder,
            boxShadow: row2Shadow,
            textAlign: 'center',
            paddingRight: '14px',
            fontWeight: p2IsWinner ? 800 : 600,
            fontSize: sizeTokens.fontSizeGamesWon,
            width: `${sizeTokens.colGamesWon}px`,
            minWidth: `${sizeTokens.colGamesWon}px`,
            maxWidth: `${sizeTokens.colGamesWon}px`,
          }}
        >
          <span
            className="tabular-nums"
            style={{
              display: 'inline-block',
              padding: '0.08rem 0.4rem',
              borderRadius: 'var(--radius-sm)',
              background: p2IsWinner
                ? colorWithAlpha(primaryColor, 0.22, 'rgba(255, 255, 255, 0.08)')
                : 'transparent',
              color: p2IsWinner
                ? primaryColor
                : 'var(--color-text-primary)',
              opacity: isComplete && p1IsWinner ? 0.45 : 1,
              border: p2IsWinner ? `1px solid ${colorWithAlpha(primaryColor, 0.55, 'transparent')}` : '1px solid transparent',
              lineHeight: 1.2,
            }}
          >
            {p2ScoreDisplay}
          </span>
        </td>

        {/* Games 1 to effectiveGameCount for Player 2 */}
        {gameNumbers.map((gNum) => {
          const isBeyondBestOf = gNum > matchBestOf;
          const game = record?.games.find((g) => g.gameNumber === gNum);
          const p1Pts = game?.player1Points;
          const p2Pts = game?.player2Points;
          const p2WonGame =
            game?.winnerPlayerId === p2?.id ||
            (p1Pts !== null && p2Pts !== null && p1Pts !== undefined && p2Pts !== undefined && p2Pts > p1Pts);
          const isLoserScore = isComplete && p1IsWinner && !p2WonGame;

          return (
            <td
              key={gNum}
              style={{
                ...baseTdStyle,
                borderBottom: botBorder,
                boxShadow: row2Shadow,
                textAlign: 'right',
                padding: sizeTokens.gameCellPadding,
                width: `${sizeTokens.colGame}px`,
                minWidth: `${sizeTokens.colGame}px`,
                maxWidth: `${sizeTokens.colGame}px`,
                color: isBeyondBestOf ? 'var(--color-text-muted)' : 'var(--color-text-primary)',
                overflow: 'visible',
              }}
            >
              {isBeyondBestOf ? (
                <span style={{ opacity: 0.25 }}>—</span>
              ) : p2Pts !== null && p2Pts !== undefined ? (
                <span
                  className="tabular-nums"
                  style={{
                    padding: '0.1rem 0.32rem',
                    margin: 0,
                    borderRadius: 'var(--radius-sm)',
                    background: p2WonGame ? colorWithAlpha(matchAccentColor, 0.16, 'rgba(255, 255, 255, 0.08)') : 'transparent',
                    color: p2WonGame ? matchAccentColor : 'var(--color-text-primary)',
                    opacity: isLoserScore ? 0.45 : 1,
                    fontWeight: p2WonGame ? 700 : 400,
                    fontSize: sizeTokens.fontSizeGameScore,
                    fontFamily: 'var(--font-mono)',
                    border: p2WonGame ? `1px solid ${colorWithAlpha(matchAccentColor, 0.38, 'transparent')}` : '1px solid transparent',
                    display: 'inline-block',
                    lineHeight: 1.2,
                    boxSizing: 'border-box',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {p2Pts.toLocaleString()}
                </span>
              ) : (
                <span style={{ color: 'rgba(255, 255, 255, 0.15)', fontSize: '0.8rem', marginRight: '6px' }}>·</span>
              )}
            </td>
          );
        })}
      </tr>
    </>
  );
};
