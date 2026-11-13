import React from 'react';
import { Check } from 'lucide-react';
import { SeededPlayer } from '../../types';
import { colorWithAlpha, getContrastingTextColor } from '../../colorUtils';
import { ScoreInput, cn } from '../../../../components/ui';
import { formatScore } from '../../../../utils/scores';
import { TIE, gameOutcome } from '../../matchRules';
import { draftToInput, type GameDraft } from './drawerModel';

interface GameScoreCardProps {
  game: GameDraft;
  idx: number;
  bestOf: number;
  p1?: SeededPlayer | null;
  p2?: SeededPlayer | null;
  p1Name: string;
  p2Name: string;
  primaryColor: string;
  gameCardBg: string;
  /** Completed matches show their games without inputs. */
  readOnly?: boolean;
  onScoreChange: (gameIndex: number, playerSlot: 1 | 2, digits: string) => void;
  onManualWinnerToggle: (gameIndex: number, winnerId: string) => void;
}

export const GameScoreCard: React.FC<GameScoreCardProps> = ({
  game,
  idx,
  bestOf,
  p1,
  p2,
  p1Name,
  p2Name,
  primaryColor,
  gameCardBg,
  readOnly = false,
  onScoreChange,
  onManualWinnerToggle,
}) => {
  const gameNum = idx + 1;
  const isTiebreakerGame = gameNum > bestOf;
  const input = draftToInput(game);
  const bothScored = input.player1Points !== null && input.player2Points !== null;
  const outcome = gameOutcome(input, p1?.id, p2?.id);
  const margin = bothScored ? formatScore(Math.abs(input.player1Points! - input.player2Points!)) : null;
  // With both scores in, the higher score wins. Picking a winner by hand is only for a game
  // whose scores were not recorded.
  const canPickWinner = !readOnly && !bothScored;

  const winnerPick = (player: SeededPlayer | null | undefined, name: string, align: 'start' | 'end') => {
    const isWinner = Boolean(player && outcome === player.id);
    const label = (
      <span
        className={cn('text-xs truncate', isWinner ? 'font-bold' : 'font-medium')}
        style={{ color: isWinner ? primaryColor : 'var(--color-fg-secondary)' }}
      >
        {name}
      </span>
    );
    const marker = canPickWinner ? (
      <button
        type="button"
        onClick={() => player && onManualWinnerToggle(idx, player.id)}
        title="Set winner"
        aria-label={`${name} won Game ${gameNum}`}
        aria-pressed={isWinner}
        className="size-5 rounded-full flex items-center justify-center cursor-pointer p-0 transition-all duration-150 shrink-0 max-md:relative max-md:after:absolute max-md:after:-inset-3"
        style={{
          border: isWinner ? `2px solid ${primaryColor}` : '1px solid var(--color-line)',
          background: isWinner ? primaryColor : 'transparent',
          color: getContrastingTextColor(primaryColor),
        }}
      >
        {isWinner && <Check size={13} strokeWidth={3.5} />}
      </button>
    ) : isWinner ? (
      <Check size={14} strokeWidth={3.5} className="shrink-0" color={primaryColor} />
    ) : null;
    return (
      <div className={cn('flex items-center gap-1.5 mb-1 min-h-5', align === 'end' && 'justify-end')}>
        {align === 'start' ? (
          <>
            {marker}
            {label}
          </>
        ) : (
          <>
            {label}
            {marker}
          </>
        )}
      </div>
    );
  };

  const scoreField = (slot: 1 | 2, value: string, player: SeededPlayer | null | undefined, name: string) => {
    const isWinner = Boolean(player && outcome === player.id);
    const fieldClass =
      'font-mono tabular-nums tracking-tight w-full py-2 px-2.5 bg-black/45 rounded-sm text-white text-base font-bold text-center outline-none';
    const border = isWinner ? `1px solid ${colorWithAlpha(primaryColor, 0.65)}` : '1px solid var(--color-line)';
    const boxShadow = isWinner ? `0 0 10px ${colorWithAlpha(primaryColor, 0.2)}` : 'none';
    if (readOnly) {
      return (
        <div className={fieldClass} style={{ border, boxShadow }} data-testid={`game-${gameNum}-p${slot}-score`}>
          {value === '' ? '—' : formatScore(Number(value))}
        </div>
      );
    }
    return (
      <ScoreInput
        value={value}
        onValueChange={digits => onScoreChange(idx, slot, digits)}
        placeholder="0"
        aria-label={`${name} score, Game ${gameNum}`}
        data-testid={`game-${gameNum}-p${slot}-score`}
        className={fieldClass}
        style={{ border, boxShadow }}
      />
    );
  };

  return (
    <div
      className="py-3.5 px-4 rounded-md shadow-[0_2px_6px_rgba(0,0,0,0.25)] max-md:px-3"
      data-testid={`game-card-${gameNum}`}
      style={{
        background: gameCardBg,
        border: isTiebreakerGame
          ? `1px solid ${colorWithAlpha(primaryColor, 0.45)}`
          : `1px solid ${colorWithAlpha(primaryColor, 0.22, 'var(--color-line)')}`,
      }}
    >
      <div className="flex justify-between items-center mb-2.5">
        <div className="flex items-center gap-2">
          <span
            className="text-caption font-bold font-mono text-white"
            style={{ color: isTiebreakerGame ? primaryColor : undefined }}
          >
            Game {gameNum}
          </span>
          {isTiebreakerGame && (
            <span
              className="text-3xs font-bold py-0.5 px-1.5 rounded-full"
              style={{
                background: colorWithAlpha(primaryColor, 0.15),
                color: primaryColor,
                border: `1px solid ${colorWithAlpha(primaryColor, 0.3)}`,
              }}
            >
              Tiebreaker
            </span>
          )}
          {outcome === TIE && (
            <span className="text-3xs py-0.5 px-2 rounded-sm bg-cyan-soft text-cyan font-bold border border-cyan/30">
              TIE (NO WIN)
            </span>
          )}
        </div>
        {margin && (
          <span className="text-xs text-cyan font-mono font-semibold bg-cyan/10 py-0.5 px-2 rounded-sm border border-cyan/25">
            Δ {margin} pts
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 items-start">
        <div>
          {winnerPick(p1, p1Name, 'start')}
          {scoreField(1, game.p1, p1, p1Name)}
        </div>
        <div>
          {winnerPick(p2, p2Name, 'end')}
          {scoreField(2, game.p2, p2, p2Name)}
        </div>
      </div>
    </div>
  );
};
