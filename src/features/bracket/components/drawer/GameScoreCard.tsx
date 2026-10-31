import React from 'react';
import { Check, Trash2 } from 'lucide-react';
import { SeededPlayer } from '../../types';
import { colorWithAlpha, getContrastingTextColor } from '../../colorUtils';
import { cn } from '../../../../components/ui';

interface GameScoreCardProps {
  game: { p1: string; p2: string; winner: string | null };
  idx: number;
  bestOf: number;
  p1?: SeededPlayer | null;
  p2?: SeededPlayer | null;
  p1Name: string;
  p2Name: string;
  primaryColor: string;
  gameCardBg: string;
  onScoreChange: (gameIndex: number, playerSlot: 1 | 2, value: string) => void;
  onManualWinnerToggle: (gameIndex: number, winnerId: string | null) => void;
  onDeleteTiebreakerGame: (idx: number) => void;
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
  onScoreChange,
  onManualWinnerToggle,
  onDeleteTiebreakerGame,
}) => {
  const gameNum = idx + 1;
  const isTiebreakerGame = gameNum > bestOf;
  const num1 = parseInt(game.p1, 10);
  const num2 = parseInt(game.p2, 10);
  const hasScores = !isNaN(num1) && !isNaN(num2);
  const margin = hasScores ? Math.abs(num1 - num2).toLocaleString() : null;

  return (
    <div
      className="py-3.5 px-4 rounded-md shadow-[0_2px_6px_rgba(0,0,0,0.25)]"
      style={{
        background: gameCardBg,
        border: isTiebreakerGame
          ? `1px solid ${colorWithAlpha(primaryColor, 0.45)}`
          : `1px solid ${colorWithAlpha(primaryColor, 0.22, 'var(--color-border)')}`,
      }}
    >
      {/* Game card top bar */}
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
          {game.winner === 'TIE' && (
            <span className="text-3xs py-0.5 px-2 rounded-sm bg-cyan-soft text-cyan font-bold border border-cyan/30">
              TIE (NO WIN)
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {margin && (
            <span className="text-xs text-cyan font-mono font-semibold bg-cyan/10 py-0.5 px-2 rounded-sm border border-cyan/25">
              Δ {margin} pts
            </span>
          )}
          {isTiebreakerGame && ((!game.p1 || game.p1 === '0' || isNaN(num1) || num1 === 0) && (!game.p2 || game.p2 === '0' || isNaN(num2) || num2 === 0)) && (
            <button
              type="button"
              onClick={() => onDeleteTiebreakerGame(idx)}
              title="Delete tiebreaker game"
              className="inline-flex items-center gap-1 py-0.5 px-2 rounded-sm bg-red/12 border border-red/30 text-red-300 text-2xs font-semibold cursor-pointer"
            >
              <Trash2 size={11} />
              <span>Delete</span>
            </button>
          )}
        </div>
      </div>

      {/* Input Grid */}
      <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-center">
        {/* Player 1 Input */}
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <button
              type="button"
              onClick={() => p1 && onManualWinnerToggle(idx, p1.id)}
              title="Set winner"
              className="size-5 rounded-full flex items-center justify-center cursor-pointer p-0 transition-all duration-150 shrink-0"
              style={{
                border: game.winner === p1?.id ? `2px solid ${primaryColor}` : '1px solid var(--color-border)',
                background: game.winner === p1?.id ? primaryColor : 'transparent',
                color: getContrastingTextColor(primaryColor),
              }}
            >
              {game.winner === p1?.id && <Check size={13} strokeWidth={3.5} />}
            </button>
            <span
              className={cn('text-xs truncate', game.winner === p1?.id ? 'font-bold' : 'font-medium')}
              style={{ color: game.winner === p1?.id ? primaryColor : 'var(--color-text-secondary)' }}
            >
              {p1Name}
            </span>
          </div>
          <input
            type="text"
            inputMode="numeric"
            placeholder="0"
            value={game.p1 ? Number(game.p1).toLocaleString() : ''}
            onChange={e => onScoreChange(idx, 1, e.target.value)}
            className="font-mono tabular-nums tracking-tight w-full py-2 px-2.5 bg-black/45 rounded-sm text-white text-base font-bold text-center outline-none"
            style={{
              border: game.winner === p1?.id ? `1px solid ${colorWithAlpha(primaryColor, 0.65)}` : '1px solid var(--color-border)',
              boxShadow: game.winner === p1?.id ? `0 0 10px ${colorWithAlpha(primaryColor, 0.2)}` : 'none',
            }}
          />
        </div>

        {/* Interactive TIE Button */}
        <div className="flex flex-col items-center justify-center pt-5">
          <button
            type="button"
            onClick={() => onManualWinnerToggle(idx, 'TIE')}
            title={game.winner === 'TIE' ? 'Clear tie' : 'Declare Game as Tie (no win awarded)'}
            className={cn(
              'py-1 px-2.5 text-2xs font-bold tracking-wider rounded-sm border cursor-pointer transition-all duration-150',
              game.winner === 'TIE' ? 'border-cyan bg-cyan-soft text-cyan' : 'border-line bg-white/3 text-fg-muted'
            )}
          >
            TIE
          </button>
        </div>

        {/* Player 2 Input */}
        <div>
          <div className="flex items-center justify-end gap-1.5 mb-1">
            <span
              className={cn('text-xs truncate', game.winner === p2?.id ? 'font-bold' : 'font-medium')}
              style={{ color: game.winner === p2?.id ? primaryColor : 'var(--color-text-secondary)' }}
            >
              {p2Name}
            </span>
            <button
              type="button"
              onClick={() => p2 && onManualWinnerToggle(idx, p2.id)}
              title="Set winner"
              className="size-5 rounded-full flex items-center justify-center cursor-pointer p-0 transition-all duration-150 shrink-0"
              style={{
                border: game.winner === p2?.id ? `2px solid ${primaryColor}` : '1px solid var(--color-border)',
                background: game.winner === p2?.id ? primaryColor : 'transparent',
                color: getContrastingTextColor(primaryColor),
              }}
            >
              {game.winner === p2?.id && <Check size={13} strokeWidth={3.5} />}
            </button>
          </div>
          <input
            type="text"
            inputMode="numeric"
            placeholder="0"
            value={game.p2 ? Number(game.p2).toLocaleString() : ''}
            onChange={e => onScoreChange(idx, 2, e.target.value)}
            className="font-mono tabular-nums tracking-tight w-full py-2 px-2.5 bg-black/45 rounded-sm text-white text-base font-bold text-center outline-none"
            style={{
              border: game.winner === p2?.id ? `1px solid ${colorWithAlpha(primaryColor, 0.65)}` : '1px solid var(--color-border)',
              boxShadow: game.winner === p2?.id ? `0 0 10px ${colorWithAlpha(primaryColor, 0.2)}` : 'none',
            }}
          />
        </div>
      </div>
    </div>
  );
};
