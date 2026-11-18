import React from 'react';
import { Play, Pause, RotateCcw, Clock } from 'lucide-react';
import type { Tournament } from '../../tournament/types';
import { useTournamentQualTimer } from '../../tournament/qualTimer';
import { usePinAuth } from '../../auth/AuthContext';
import { Button, cn } from '../../../components/ui';

export interface TournamentQualTimerHudProps {
  tournament: Tournament;
  isObsMode?: boolean;
  chroma?: string | null;
  compact?: boolean;
  readOnly?: boolean;
  sidebar?: boolean;
  isCollapsed?: boolean;
  /** OBS gutter column: full width, stacked, with the largest countdown. Needs isObsMode. */
  gutter?: boolean;
}

export const TournamentQualTimerHud: React.FC<TournamentQualTimerHudProps> = ({
  tournament,
  isObsMode = false,
  compact = false,
  readOnly = false,
  sidebar = false,
  isCollapsed = false,
  gutter = false,
}) => {
  const { canManage } = usePinAuth();
  const { formattedTime, isRunning, isExpired, toggleRunning, resetTimer } =
    useTournamentQualTimer(tournament);

  // Hidden if not in qual mode or if quals bypassed
  const isQualMode = !tournament.isLocked && !tournament.qualsClosed;
  const isQualEvent = (tournament.seedingMethod || 'QUALIFIERS') === 'QUALIFIERS';

  if (!isQualMode || !isQualEvent) {
    return null;
  }

  const userCanManage = canManage(tournament.id) || canManage(tournament.slug);

  if (sidebar) {
    if (isCollapsed) {
      return (
        <div
          data-testid="sidebar-qual-timer-hud"
          className={cn(
            'flex flex-col items-center justify-center py-1.5 px-1 rounded-sm bg-white/3 border',
            isExpired ? 'border-red/50' : isRunning ? 'border-green-500/35' : 'border-line-subtle',
            userCanManage && !readOnly ? 'cursor-pointer' : 'cursor-default'
          )}
          onClick={userCanManage && !readOnly ? toggleRunning : undefined}
          title={isExpired ? 'Timer Expired' : isRunning ? 'Pause Timer' : 'Start Timer'}
        >
          <Clock
            size={14}
            className={cn(isExpired ? 'text-red' : isRunning ? 'text-green-500' : 'text-gold-bright')}
          />
          <span
            className={cn(
              'font-mono tabular-nums tracking-tight text-3xs font-extrabold mt-0.5 leading-none',
              isExpired ? 'text-red' : 'text-white'
            )}
          >
            {formattedTime.split(':').slice(0, 2).join(':')}
          </span>
        </div>
      );
    }

    return (
      <div
        data-testid="sidebar-qual-timer-hud"
        className={cn(
          'w-full p-2 bg-white/3 border rounded-sm flex flex-col gap-1.5',
          isExpired ? 'border-red/50' : isRunning ? 'border-green-500/35' : 'border-line-subtle'
        )}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Clock
              size={13}
              className={cn(isExpired ? 'text-red' : isRunning ? 'text-green-500' : 'text-gold-bright')}
            />
            <span
              className={cn(
                'text-3xs font-extrabold uppercase tracking-wider',
                isExpired ? 'text-red-300' : isRunning ? 'text-green-300' : 'text-fg-muted'
              )}
            >
              {isExpired ? 'Quals Expired' : isRunning ? 'Qual Time' : 'Quals Paused'}
            </span>
          </div>
          <span
            className={cn(
              'font-mono tabular-nums text-base font-black tracking-wide',
              isExpired ? 'text-red' : 'text-white'
            )}
          >
            {formattedTime}
          </span>
        </div>

        {userCanManage && !readOnly && (
          <div className="flex items-center gap-1 w-full">
            <button
              type="button"
              onClick={toggleRunning}
              title={isRunning ? 'Pause Timer' : 'Start Timer'}
              className={cn(
                'flex-1 inline-flex items-center justify-center gap-1 py-1 px-1.5 rounded-sm text-2xs font-bold cursor-pointer border',
                isRunning
                  ? 'border-red/40 bg-red/15 text-red-bright'
                  : 'border-green-500/40 bg-green-500/15 text-green-400'
              )}
            >
              {isRunning ? (
                <>
                  <Pause size={10} />
                  <span>Pause</span>
                </>
              ) : (
                <>
                  <Play size={10} className="fill-green-400" />
                  <span>Start</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={resetTimer}
              title="Reset Timer"
              className="inline-flex items-center justify-center py-1 px-1.5 rounded-sm text-2xs cursor-pointer border border-line-subtle bg-white/4 text-fg-secondary"
            >
              <RotateCcw size={10} />
            </button>
          </div>
        )}
      </div>
    );
  }

  if (isObsMode) {
    // Solid fill, no blur or shadow: it sits on the OBS chroma key, and anything translucent gets keyed out.
    // Borders are solid colors too, for the same reason.
    const obsBorder = isExpired ? 'border-red' : isRunning ? 'border-green-500' : 'border-gold';
    const obsIconColor = isExpired ? 'text-red' : isRunning ? 'text-green-500' : 'text-gold-bright';
    const obsLabel = isExpired ? 'Quals Expired' : isRunning ? 'Qual Time Left' : 'Quals Paused';
    const obsLabelColor = isExpired ? 'text-red-300' : isRunning ? 'text-green-300' : 'text-gold-bright';

    if (gutter) {
      // Just the digits, sized to the gutter's width (container query units) so they fill the column at
      // any OBS source size. No label: the border color shows running (green), paused (gold) or expired (red).
      return (
        <div
          data-testid="obs-qual-timer-hud"
          title={obsLabel}
          className={cn('@container w-full rounded-sm border-2 bg-canvas px-1 font-sans', obsBorder)}
        >
          <span
            className={cn(
              // Monospace digits are ~0.6em wide: "00:00:00" (8 chars) fills the width at 19cqw, "00:00" at 30cqw.
              'block text-center font-mono tabular-nums font-black leading-none py-[0.08em]',
              formattedTime.length > 5 ? 'text-[clamp(2rem,19cqw,12rem)]' : 'text-[clamp(2rem,30cqw,16rem)]',
              isExpired ? 'text-red' : 'text-white'
            )}
          >
            {formattedTime}
          </span>
        </div>
      );
    }

    return (
      <div
        data-testid="obs-qual-timer-hud"
        className={cn(
          'inline-flex items-center bg-canvas rounded-md font-sans',
          compact ? 'gap-2 py-1.5 px-3.5 border' : 'gap-3 py-2 px-4 border-2',
          obsBorder
        )}
      >
        <Clock size={compact ? 16 : 30} className={obsIconColor} />
        <div className="flex flex-col">
          <span
            className={cn(
              'font-extrabold uppercase tracking-widest leading-none',
              compact ? 'text-3xs' : 'text-sm',
              obsLabelColor
            )}
          >
            {obsLabel}
          </span>
          <span
            className={cn(
              'font-mono tabular-nums font-black tracking-wide leading-tight',
              compact ? 'text-lg' : 'text-4xl',
              isExpired ? 'text-red' : 'text-white'
            )}
          >
            {formattedTime}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="tournament-qual-timer-hud"
      className={cn(
        'inline-flex items-center bg-elevated border rounded-md shadow-[0_2px_8px_rgba(0,0,0,0.3)]',
        compact ? 'flex-wrap gap-2.5 py-1 px-3' : 'gap-3 py-2 px-4',
        isExpired ? 'border-red/50' : isRunning ? 'border-green-500/35' : 'border-line'
      )}
    >
      <div className={cn('flex items-center gap-2.5', compact && 'min-w-0')}>
        <Clock
          size={compact ? 20 : 26}
          className={cn(isExpired ? 'text-red' : isRunning ? 'text-green-500' : 'text-gold-bright')}
        />
        <div className={cn('flex flex-col', compact && 'min-w-0')}>
          <span
            className={cn(
              'font-extrabold uppercase tracking-wider leading-none',
              compact ? 'text-2xs' : 'text-xs',
              isExpired ? 'text-red-300' : isRunning ? 'text-green-300' : 'text-fg-muted'
            )}
          >
            {isExpired ? 'Time Expired' : isRunning ? 'Qual Time' : 'Qual Paused'}
          </span>
          <span
            className={cn(
              'font-mono tabular-nums font-black tracking-wide leading-tight',
              compact ? 'text-2xl' : 'text-3xl',
              isExpired ? 'text-red' : 'text-white'
            )}
          >
            {formattedTime}
          </span>
        </div>
      </div>

      {userCanManage && !readOnly && (
        <div className="flex items-center gap-1.5 ml-1">
          <Button
            variant="secondary"
            onClick={toggleRunning}
            title={isRunning ? 'Pause Timer' : 'Start Timer'}
            className={cn(
              'text-xs inline-flex items-center gap-1 font-bold',
              compact ? 'py-1 px-2' : 'py-1 px-2.5',
              isRunning
                ? 'bg-red/15 border-red/40 text-red-bright enabled:hover:bg-red/15 enabled:hover:border-red/40'
                : 'bg-green-500/15 border-green-500/40 text-green-400 enabled:hover:bg-green-500/15 enabled:hover:border-green-500/40'
            )}
          >
            {isRunning ? (
              <>
                <Pause size={12} />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play size={12} className="fill-green-400" />
                <span>Start</span>
              </>
            )}
          </Button>
          <Button
            variant="secondary"
            onClick={resetTimer}
            title="Reset Timer"
            className="py-1 px-2 text-xs text-fg-secondary"
          >
            <RotateCcw size={12} />
          </Button>
        </div>
      )}
    </div>
  );
};
