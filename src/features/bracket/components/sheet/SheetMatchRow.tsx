import React from 'react';
import { Check } from 'lucide-react';
import { Tournament, TournamentTier } from '../../../tournament/types';
import { BracketMatch, isMatchPlayable } from '../../types';
import { SheetSizeTokens, getMatchStatus } from '../../sheetUtils';
import { colorWithAlpha, getAlternateShade } from '../../colorUtils';
import { PlayerAvatar } from '../../../players/components/PlayerAvatar';
import { getEffectivePlayerName } from '../../../players/playerNameUtils';
import { cn } from '../../../../components/ui';

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

  const matchNumShadow = isHovered
    ? `inset 1px 0 0 ${hoverBorderColor}, inset 0 1px 0 ${hoverBorderColor}, inset 0 -1px 0 ${hoverBorderColor}`
    : 'none';
  const completeShadow = isHovered
    ? `inset -1px 0 0 ${hoverBorderColor}, inset 0 1px 0 ${hoverBorderColor}, inset 0 -1px 0 ${hoverBorderColor}`
    : 'none';
  const row1Shadow = isHovered ? `inset 0 1px 0 ${hoverBorderColor}` : 'none';
  const row2Shadow = isHovered ? `inset 0 -1px 0 ${hoverBorderColor}` : 'none';

  const tdCoreClass = 'align-middle overflow-hidden border-r border-r-white/4';
  const tdClass = cn(sizeTokens.tdPadding, tdCoreClass);
  const tdMergedClass = cn(sizeTokens.tdMergedPadding, tdCoreClass);
  const rowClass = cn(
    'transition-colors duration-100',
    isPlayable && tournament.isLocked ? 'cursor-pointer' : 'cursor-default',
    isPlayable ? 'opacity-100' : 'opacity-70'
  );

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
        className={rowClass}
        style={{ background: blockBg }}
      >
        {/* Match # (RowSpan 2) */}
        <td
          rowSpan={2}
          className={cn(tdMergedClass, 'text-center font-bold border-l border-l-transparent')}
          style={{
            borderTop: topBorder,
            borderBottom: botBorder,
            boxShadow: matchNumShadow,
            width: `${sizeTokens.colMatch}px`,
            minWidth: `${sizeTokens.colMatch}px`,
            maxWidth: `${sizeTokens.colMatch}px`,
          }}
        >
          <span
            className="py-0.5 px-1.5 rounded-sm font-bold font-mono inline-block leading-tight"
            style={{
              fontSize: sizeTokens.fontSizeMatchNum,
              background: colorWithAlpha(matchAccentColor, 0.15, 'rgba(255, 255, 255, 0.06)'),
              color: matchAccentColor,
              border: `1px solid ${colorWithAlpha(matchAccentColor, 0.4, 'rgba(255, 255, 255, 0.12)')}`,
            }}
          >
            #{match.matchNumber}
          </span>
        </td>

        {/* Player 1 Seed & Competitor Info */}
        <td className={cn(tdClass, 'text-left')} style={{ borderTop: topBorder, borderBottom: midBorder, boxShadow: row1Shadow, width: `${competitorColWidth}px`, minWidth: `${competitorColWidth}px`, maxWidth: `${competitorColWidth}px` }}>
          <div
            onClick={(e) => {
              if (p1?.id) {
                e.stopPropagation();
                onPlayerClick(p1.id, p1.name, p1.country);
              }
            }}
            onMouseEnter={() => p1?.id && onHoverPlayer(`p1-${match.id}`)}
            onMouseLeave={() => onHoverPlayer(null)}
            className={cn(
              'inline-flex items-center gap-1.5 py-0.5 px-1.5 rounded-sm transition-all duration-100 max-w-full w-full',
              p1?.id ? 'cursor-pointer' : '[cursor:inherit]'
            )}
            style={{
              background: hoveredPlayerKey === `p1-${match.id}` ? colorWithAlpha(primaryColor, 0.15, 'rgba(255, 255, 255, 0.08)') : 'transparent',
              boxShadow: hoveredPlayerKey === `p1-${match.id}` ? `0 0 0 1px ${primaryColor}` : 'none',
            }}
            title={p1?.id ? "View competitor tournament profile" : undefined}
          >
            <span className="inline-flex items-center gap-1.5 shrink-0" style={{ width: `${sizeTokens.countrySeedWidth}px` }}>
              {(p1?.country || (p1 as any)?.avatarUrl) && <PlayerAvatar player={p1 as any} country={p1?.country} className="leading-none" style={{ fontSize: sizeTokens.flagSize }} />}
              {p1?.seed && (
                <span
                  className="py-0 px-1 rounded-sm font-mono font-bold leading-tight"
                  style={{
                    fontSize: sizeTokens.fontSizeSeed,
                    background: colorWithAlpha(matchAccentColor, 0.12, 'rgba(255, 255, 255, 0.08)'),
                    color: matchAccentColor,
                    border: `1px solid ${colorWithAlpha(matchAccentColor, 0.25, 'rgba(255, 255, 255, 0.1)')}`,
                  }}
                >
                  #{p1.seed}
                </span>
              )}
            </span>
            <span
              className={cn(
                'truncate flex-1 min-w-0',
                isComplete ? (p1IsWinner ? 'font-extrabold' : 'font-normal') : (p1IsWinner ? 'font-bold' : 'font-medium'),
                hoveredPlayerKey === `p1-${match.id}` ? 'opacity-100' : isComplete && p2IsWinner ? 'opacity-45' : 'opacity-100'
              )}
              style={{
                fontSize: sizeTokens.fontSizePlayerName,
                color: hoveredPlayerKey === `p1-${match.id}`
                  ? primaryColor
                  : p1IsWinner
                  ? primaryColor
                  : 'var(--color-fg)',
              }}
            >
              {p1Name}
            </span>
            {match.player1.isManualOverride && (
              <span
                className="text-3xs font-bold tracking-wide py-0 px-1 rounded-sm bg-gold/18 text-gold-bright border border-gold/40 uppercase leading-tight"
                title="Position manually placed by tournament organizer"
              >
                OVERRIDE
              </span>
            )}
          </div>
        </td>

        {/* Player 1 Games Won Score */}
        <td
          className={cn(tdClass, 'text-center pr-3.5', p1IsWinner ? 'font-extrabold' : 'font-semibold')}
          style={{
            borderTop: topBorder,
            borderBottom: midBorder,
            boxShadow: row1Shadow,
            fontSize: sizeTokens.fontSizeGamesWon,
            width: `${sizeTokens.colGamesWon}px`,
            minWidth: `${sizeTokens.colGamesWon}px`,
            maxWidth: `${sizeTokens.colGamesWon}px`,
          }}
        >
          <span
            className={cn(
              'font-mono tabular-nums tracking-tight inline-block py-0.5 px-1.5 rounded-sm leading-tight',
              isComplete && p2IsWinner ? 'opacity-45' : 'opacity-100'
            )}
            style={{
              background: p1IsWinner
                ? colorWithAlpha(primaryColor, 0.22, 'rgba(255, 255, 255, 0.08)')
                : 'transparent',
              color: p1IsWinner
                ? primaryColor
                : 'var(--color-fg)',
              border: p1IsWinner ? `1px solid ${colorWithAlpha(primaryColor, 0.55, 'transparent')}` : '1px solid transparent',
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
              className={cn(
                sizeTokens.gameCellPadding,
                tdCoreClass,
                'text-right overflow-visible',
                isBeyondBestOf ? 'text-fg-muted' : 'text-fg'
              )}
              style={{
                borderTop: topBorder,
                borderBottom: midBorder,
                boxShadow: row1Shadow,
                width: `${sizeTokens.colGame}px`,
                minWidth: `${sizeTokens.colGame}px`,
                maxWidth: `${sizeTokens.colGame}px`,
              }}
            >
              {isBeyondBestOf ? (
                <span className="opacity-25">—</span>
              ) : p1Pts !== null && p1Pts !== undefined ? (
                <span
                  className={cn(
                    'font-mono tabular-nums tracking-tight py-0.5 px-1.5 m-0 rounded-sm inline-block leading-tight whitespace-nowrap',
                    isLoserScore ? 'opacity-45' : 'opacity-100',
                    p1WonGame ? 'font-bold' : 'font-normal'
                  )}
                  style={{
                    background: p1WonGame ? colorWithAlpha(matchAccentColor, 0.16, 'rgba(255, 255, 255, 0.08)') : 'transparent',
                    color: p1WonGame ? matchAccentColor : 'var(--color-fg)',
                    fontSize: sizeTokens.fontSizeGameScore,
                    border: p1WonGame ? `1px solid ${colorWithAlpha(matchAccentColor, 0.38, 'transparent')}` : '1px solid transparent',
                  }}
                >
                  {p1Pts.toLocaleString()}
                </span>
              ) : (
                <span className="text-white/15 text-caption mr-1.5">·</span>
              )}
            </td>
          );
        })}

        {/* Complete Status (RowSpan 2) */}
        <td
          rowSpan={2}
          className={cn(tdMergedClass, 'text-center border-r-white/5')}
          style={{
            borderTop: topBorder,
            borderBottom: botBorder,
            boxShadow: completeShadow,
            width: `${sizeTokens.colComplete}px`,
            minWidth: `${sizeTokens.colComplete}px`,
            maxWidth: `${sizeTokens.colComplete}px`,
          }}
        >
          {status.type === 'complete' && (
            <span
              className="inline-flex items-center justify-center size-5 rounded-full bg-green-500/16 border border-green-500/40 text-green-400 my-0 mx-auto"
              title="Complete"
            >
              <Check size={12} strokeWidth={3} />
            </span>
          )}
          {status.type === 'in_progress' && (
            <span
              className="font-bold py-0.5 px-2 rounded-full inline-flex items-center gap-1 leading-tight"
              style={{
                fontSize: sizeTokens.fontSizeStatusBadge,
                background: colorWithAlpha(primaryColor, 0.18, 'rgba(245, 158, 11, 0.18)'),
                color: primaryColor,
                border: `1px solid ${colorWithAlpha(primaryColor, 0.45, 'rgba(245, 158, 11, 0.45)')}`,
              }}
              title="In Progress"
            >
              <span
                className="size-1.25 rounded-full"
                style={{
                  background: primaryColor,
                  boxShadow: `0 0 5px ${primaryColor}`,
                }}
              />
              Live
            </span>
          )}
          {status.type === 'not_started' && (
            <span
              className="text-fg-muted opacity-35"
              style={{ fontSize: sizeTokens.fontSizeStatusBadge }}
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
        className={rowClass}
        style={{ background: blockBg }}
      >
        {/* Player 2 Seed & Competitor Info */}
        <td className={cn(tdClass, 'text-left')} style={{ borderBottom: botBorder, boxShadow: row2Shadow, width: `${competitorColWidth}px`, minWidth: `${competitorColWidth}px`, maxWidth: `${competitorColWidth}px` }}>
          <div
            onClick={(e) => {
              if (p2?.id) {
                e.stopPropagation();
                onPlayerClick(p2.id, p2.name, p2.country);
              }
            }}
            onMouseEnter={() => p2?.id && onHoverPlayer(`p2-${match.id}`)}
            onMouseLeave={() => onHoverPlayer(null)}
            className={cn(
              'inline-flex items-center gap-1.5 py-0.5 px-1.5 rounded-sm transition-all duration-100 max-w-full w-full',
              p2?.id ? 'cursor-pointer' : '[cursor:inherit]'
            )}
            style={{
              background: hoveredPlayerKey === `p2-${match.id}` ? colorWithAlpha(primaryColor, 0.15, 'rgba(255, 255, 255, 0.08)') : 'transparent',
              boxShadow: hoveredPlayerKey === `p2-${match.id}` ? `0 0 0 1px ${primaryColor}` : 'none',
            }}
            title={p2?.id ? "View competitor tournament profile" : undefined}
          >
            <span className="inline-flex items-center gap-1.5 shrink-0" style={{ width: `${sizeTokens.countrySeedWidth}px` }}>
              {(p2?.country || (p2 as any)?.avatarUrl) && <PlayerAvatar player={p2 as any} country={p2?.country} className="leading-none" style={{ fontSize: sizeTokens.flagSize }} />}
              {p2?.seed && (
                <span
                  className="py-0 px-1 rounded-sm font-mono font-bold leading-tight"
                  style={{
                    fontSize: sizeTokens.fontSizeSeed,
                    background: colorWithAlpha(matchAccentColor, 0.12, 'rgba(255, 255, 255, 0.08)'),
                    color: matchAccentColor,
                    border: `1px solid ${colorWithAlpha(matchAccentColor, 0.25, 'rgba(255, 255, 255, 0.1)')}`,
                  }}
                >
                  #{p2.seed}
                </span>
              )}
            </span>
            <span
              className={cn(
                'truncate flex-1 min-w-0',
                isComplete ? (p2IsWinner ? 'font-extrabold' : 'font-normal') : (p2IsWinner ? 'font-bold' : 'font-medium'),
                hoveredPlayerKey === `p2-${match.id}` ? 'opacity-100' : isComplete && p1IsWinner ? 'opacity-45' : 'opacity-100'
              )}
              style={{
                fontSize: sizeTokens.fontSizePlayerName,
                color: hoveredPlayerKey === `p2-${match.id}`
                  ? primaryColor
                  : p2IsWinner
                  ? primaryColor
                  : 'var(--color-fg)',
              }}
            >
              {p2Name}
            </span>
            {match.player2.isManualOverride && (
              <span
                className="text-3xs font-bold tracking-wide py-0 px-1 rounded-sm bg-gold/18 text-gold-bright border border-gold/40 uppercase leading-tight"
                title="Position manually placed by tournament organizer"
              >
                OVERRIDE
              </span>
            )}
          </div>
        </td>

        {/* Player 2 Games Won Score */}
        <td
          className={cn(tdClass, 'text-center pr-3.5', p2IsWinner ? 'font-extrabold' : 'font-semibold')}
          style={{
            borderBottom: botBorder,
            boxShadow: row2Shadow,
            fontSize: sizeTokens.fontSizeGamesWon,
            width: `${sizeTokens.colGamesWon}px`,
            minWidth: `${sizeTokens.colGamesWon}px`,
            maxWidth: `${sizeTokens.colGamesWon}px`,
          }}
        >
          <span
            className={cn(
              'font-mono tabular-nums tracking-tight inline-block py-0.5 px-1.5 rounded-sm leading-tight',
              isComplete && p1IsWinner ? 'opacity-45' : 'opacity-100'
            )}
            style={{
              background: p2IsWinner
                ? colorWithAlpha(primaryColor, 0.22, 'rgba(255, 255, 255, 0.08)')
                : 'transparent',
              color: p2IsWinner
                ? primaryColor
                : 'var(--color-fg)',
              border: p2IsWinner ? `1px solid ${colorWithAlpha(primaryColor, 0.55, 'transparent')}` : '1px solid transparent',
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
              className={cn(
                sizeTokens.gameCellPadding,
                tdCoreClass,
                'text-right overflow-visible',
                isBeyondBestOf ? 'text-fg-muted' : 'text-fg'
              )}
              style={{
                borderBottom: botBorder,
                boxShadow: row2Shadow,
                width: `${sizeTokens.colGame}px`,
                minWidth: `${sizeTokens.colGame}px`,
                maxWidth: `${sizeTokens.colGame}px`,
              }}
            >
              {isBeyondBestOf ? (
                <span className="opacity-25">—</span>
              ) : p2Pts !== null && p2Pts !== undefined ? (
                <span
                  className={cn(
                    'font-mono tabular-nums tracking-tight py-0.5 px-1.5 m-0 rounded-sm inline-block leading-tight whitespace-nowrap',
                    isLoserScore ? 'opacity-45' : 'opacity-100',
                    p2WonGame ? 'font-bold' : 'font-normal'
                  )}
                  style={{
                    background: p2WonGame ? colorWithAlpha(matchAccentColor, 0.16, 'rgba(255, 255, 255, 0.08)') : 'transparent',
                    color: p2WonGame ? matchAccentColor : 'var(--color-fg)',
                    fontSize: sizeTokens.fontSizeGameScore,
                    border: p2WonGame ? `1px solid ${colorWithAlpha(matchAccentColor, 0.38, 'transparent')}` : '1px solid transparent',
                  }}
                >
                  {p2Pts.toLocaleString()}
                </span>
              ) : (
                <span className="text-white/15 text-caption mr-1.5">·</span>
              )}
            </td>
          );
        })}
      </tr>
    </>
  );
};
