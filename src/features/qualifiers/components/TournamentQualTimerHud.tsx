import React from 'react';
import { Play, Pause, RotateCcw, Clock } from 'lucide-react';
import type { Tournament } from '../../tournament/types';
import { useTournamentQualTimer } from '../../tournament/qualTimer';
import { usePinAuth } from '../../auth/AuthContext';

export interface TournamentQualTimerHudProps {
  tournament: Tournament;
  isObsMode?: boolean;
  chroma?: string | null;
  compact?: boolean;
}

export const TournamentQualTimerHud: React.FC<TournamentQualTimerHudProps> = ({
  tournament,
  isObsMode = false,
  compact = false,
}) => {
  const { canManage } = usePinAuth();
  const { formattedTime, isRunning, isExpired, toggleRunning, resetTimer } =
    useTournamentQualTimer(tournament);

  // Hidden if not in qual mode or if quals bypassed / online-only
  const isQualMode = !tournament.isLocked && !tournament.qualsClosed;
  const isQualEvent =
    (tournament.seedingMethod || 'QUALIFIERS') === 'QUALIFIERS' &&
    (tournament.qualMode || 'HYBRID') !== 'ONLINE';

  if (!isQualMode || !isQualEvent) {
    return null;
  }

  const userCanManage = canManage(tournament.id) || canManage(tournament.slug);

  if (isObsMode) {
    return (
      <div
        data-testid="obs-qual-timer-hud"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.4rem 0.85rem',
          background: 'rgba(9, 13, 19, 0.88)',
          backdropFilter: 'blur(8px)',
          borderRadius: '8px',
          border: `1px solid ${isExpired ? 'rgba(239, 68, 68, 0.6)' : isRunning ? 'rgba(34, 197, 94, 0.4)' : 'rgba(245, 158, 11, 0.35)'}`,
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
          fontFamily: "'Space Grotesk', system-ui, sans-serif",
        }}
      >
        <Clock
          size={16}
          color={isExpired ? '#ef4444' : isRunning ? '#22c55e' : 'var(--color-gold-bright, #f59e0b)'}
        />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span
            style={{
              fontSize: '0.62rem',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: isExpired ? '#fca5a5' : isRunning ? '#86efac' : 'var(--color-gold-bright, #f59e0b)',
              lineHeight: 1,
            }}
          >
            {isExpired ? 'Quals Expired' : isRunning ? 'Qual Time Left' : 'Quals Paused'}
          </span>
          <span
            className="tabular-nums"
            style={{
              fontSize: '1.15rem',
              fontWeight: 900,
              color: isExpired ? '#ef4444' : '#ffffff',
              letterSpacing: '0.04em',
              lineHeight: 1.15,
            }}
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
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: compact ? '0.5rem' : '0.75rem',
        padding: compact ? '0.25rem 0.65rem' : '0.4rem 0.85rem',
        background: 'var(--color-bg-surface-elevated, #161e27)',
        border: `1px solid ${isExpired ? 'rgba(239, 68, 68, 0.5)' : isRunning ? 'rgba(34, 197, 94, 0.35)' : 'var(--color-border, #263342)'}`,
        borderRadius: 'var(--radius-md, 8px)',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
        <Clock
          size={compact ? 14 : 16}
          color={isExpired ? '#ef4444' : isRunning ? '#22c55e' : 'var(--color-gold-bright, #f59e0b)'}
        />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span
            style={{
              fontSize: '0.62rem',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: isExpired ? '#fca5a5' : isRunning ? '#86efac' : 'var(--color-text-muted, #94a3b8)',
              lineHeight: 1,
            }}
          >
            {isExpired ? 'Time Expired' : isRunning ? 'Qual Time' : 'Qual Paused'}
          </span>
          <span
            className="tabular-nums"
            style={{
              fontSize: compact ? '1rem' : '1.15rem',
              fontWeight: 900,
              color: isExpired ? '#ef4444' : '#ffffff',
              letterSpacing: '0.02em',
              lineHeight: 1.2,
            }}
          >
            {formattedTime}
          </span>
        </div>
      </div>

      {userCanManage && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginLeft: '0.25rem' }}>
          <button
            type="button"
            onClick={toggleRunning}
            title={isRunning ? 'Pause Qual Timer' : 'Start Qual Timer'}
            className="btn btn-secondary"
            style={{
              padding: compact ? '0.2rem 0.5rem' : '0.3rem 0.65rem',
              fontSize: '0.75rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.3rem',
              background: isRunning ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)',
              borderColor: isRunning ? 'rgba(239, 68, 68, 0.4)' : 'rgba(34, 197, 94, 0.4)',
              color: isRunning ? '#f87171' : '#4ade80',
              fontWeight: 700,
            }}
          >
            {isRunning ? (
              <>
                <Pause size={12} />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play size={12} fill="#4ade80" />
                <span>Start</span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={resetTimer}
            title="Reset timer to default starting duration"
            className="btn btn-secondary"
            style={{
              padding: compact ? '0.2rem 0.45rem' : '0.3rem 0.55rem',
              fontSize: '0.75rem',
              color: 'var(--color-text-secondary, #94a3b8)',
            }}
          >
            <RotateCcw size={12} />
          </button>
        </div>
      )}
    </div>
  );
};
