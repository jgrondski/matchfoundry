import React, { useEffect, useState } from 'react';
import { Clock, Play, Pause, RotateCcw, Edit2, AlertTriangle, Info } from 'lucide-react';
import { computeTimerTelemetry } from '../authwordEngine';
import type { QualTimerLog } from '../../tournament/types';

export interface CountdownTimerHudProps {
  timerLog?: QualTimerLog;
  qualWindowMinutes: number;
  isCompleted?: boolean;
}

function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) {
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export const CountdownTimerHud: React.FC<CountdownTimerHudProps> = ({
  timerLog,
  qualWindowMinutes,
  isCompleted = false,
}) => {
  const initialMinutes = qualWindowMinutes > 0 ? qualWindowMinutes : 90;
  const [durationMinutes, setDurationMinutes] = useState<number>(initialMinutes);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(initialMinutes * 60);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editInput, setEditInput] = useState<string>(String(initialMinutes));

  // Countdown effect: does not auto-start, ticks only when isRunning is true
  useEffect(() => {
    if (!isRunning || isCompleted) return;
    const interval = setInterval(() => {
      setRemainingSeconds(s => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [isRunning, isCompleted]);

  // Compute telemetry if official timerLog is provided (for background judge audit)
  const [nowMs, setNowMs] = useState<number>(Date.now());
  useEffect(() => {
    if (isCompleted || timerLog?.submittedAt || !timerLog) return;
    const interval = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [isCompleted, timerLog]);

  const telemetry = timerLog
    ? computeTimerTelemetry(timerLog, durationMinutes, timerLog.submittedAt || nowMs)
    : null;

  const isOverTime = remainingSeconds === 0 || Boolean(telemetry?.overTime);
  const elapsedSeconds = Math.max(0, durationMinutes * 60 - remainingSeconds);

  return (
    <div
      style={{
        background: 'var(--color-bg-surface, #121820)',
        border: `1px solid ${isOverTime ? 'rgba(245, 158, 11, 0.5)' : 'var(--color-border, #263342)'}`,
        borderRadius: '12px',
        padding: '1.25rem 1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.85rem',
      }}
      data-testid="countdown-timer-hud"
    >
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Clock size={18} color={isOverTime ? '#f59e0b' : 'var(--color-text-secondary, #94a3b8)'} />
          <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#e2e8f0', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {isCompleted ? 'Final Recorded Time' : 'Time Remaining'}
          </span>
          <span
            style={{
              fontSize: '0.7rem',
              fontWeight: 700,
              padding: '0.15rem 0.5rem',
              borderRadius: '9999px',
              background: 'rgba(56, 189, 248, 0.12)',
              color: '#38bdf8',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            Optional Pacing Timer
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.82rem', color: 'var(--color-text-secondary, #94a3b8)' }}>
          <span>
            Official Window: <strong>{durationMinutes} minutes</strong>
          </span>

          {/* Edit Time Duration Inline */}
          {!isCompleted && (
            isEditing ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <input
                  type="number"
                  min="1"
                  max="600"
                  value={editInput}
                  onChange={e => setEditInput(e.target.value)}
                  style={{
                    width: '54px',
                    padding: '0.15rem 0.4rem',
                    borderRadius: '4px',
                    background: 'var(--color-bg-base, #0a0e14)',
                    border: '1px solid var(--color-border, #263342)',
                    color: '#ffffff',
                    fontSize: '0.8rem',
                    fontFamily: 'monospace',
                  }}
                  data-testid="timer-duration-input"
                />
                <span style={{ fontSize: '0.78rem' }}>min</span>
                <button
                  type="button"
                  onClick={() => {
                    const parsed = parseInt(editInput, 10);
                    if (parsed > 0) {
                      setDurationMinutes(parsed);
                      setRemainingSeconds(parsed * 60);
                      setIsRunning(false);
                    }
                    setIsEditing(false);
                  }}
                  style={{
                    padding: '0.15rem 0.45rem',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    borderRadius: '4px',
                    background: 'var(--color-gold-bright, #f59e0b)',
                    color: '#000',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  Set
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  style={{
                    padding: '0.15rem 0.35rem',
                    fontSize: '0.75rem',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--color-text-muted, #64748b)',
                    cursor: 'pointer',
                  }}
                >
                  ✕
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setEditInput(String(durationMinutes));
                  setIsEditing(true);
                }}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--color-border, #263342)',
                  borderRadius: '4px',
                  padding: '0.15rem 0.45rem',
                  color: 'var(--color-text-secondary, #94a3b8)',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                }}
                title="Change timer duration"
              >
                <Edit2 size={11} /> Edit
              </button>
            )
          )}
        </div>
      </div>

      {/* Main Clock Face & Pacing Controls */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '1rem', flexWrap: 'wrap' }}>
          <div
            style={{
              fontFamily: "'JetBrains Mono', 'Courier New', monospace",
              fontSize: '2.4rem',
              fontWeight: 800,
              color: isOverTime ? '#f59e0b' : '#38bdf8',
              letterSpacing: '0.05em',
            }}
            data-testid="timer-display"
          >
            {isCompleted
              ? formatDuration(telemetry?.elapsedSeconds || elapsedSeconds)
              : formatDuration(remainingSeconds)}
          </div>

          <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary, #94a3b8)' }}>
            Elapsed: <strong style={{ color: '#ffffff' }}>{formatDuration(telemetry?.elapsedSeconds || elapsedSeconds)}</strong>
            {telemetry && telemetry.totalPauseSeconds > 0 && (
              <span style={{ marginLeft: '0.5rem' }}>
                (Pauses: {formatDuration(telemetry.totalPauseSeconds)})
              </span>
            )}
          </div>
        </div>

        {/* Start/Stop and Reset Controls */}
        {!isCompleted && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={() => setIsRunning(!isRunning)}
              style={{
                padding: '0.45rem 0.95rem',
                borderRadius: '6px',
                fontSize: '0.85rem',
                fontWeight: 700,
                border: 'none',
                background: isRunning ? 'rgba(239, 68, 68, 0.2)' : 'rgba(34, 197, 94, 0.2)',
                color: isRunning ? '#f87171' : '#4ade80',
                borderWidth: '1px',
                borderStyle: 'solid',
                borderColor: isRunning ? 'rgba(239, 68, 68, 0.4)' : 'rgba(34, 197, 94, 0.5)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                transition: 'all 0.15s ease',
              }}
              data-testid="timer-start-stop-button"
            >
              {isRunning ? (
                <>
                  <Pause size={15} /> Pause Timer
                </>
              ) : (
                <>
                  <Play size={15} /> Start Timer
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setIsRunning(false);
                setRemainingSeconds(durationMinutes * 60);
              }}
              style={{
                padding: '0.45rem 0.85rem',
                borderRadius: '6px',
                fontSize: '0.85rem',
                fontWeight: 600,
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--color-border, #263342)',
                color: 'var(--color-text-secondary, #94a3b8)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
              data-testid="timer-reset-button"
            >
              <RotateCcw size={14} /> Reset
            </button>
          </div>
        )}
      </div>

      {/* Non-Blocking Over-Time Alert Banner */}
      {isOverTime && !isCompleted && (
        <div
          style={{
            background: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid rgba(245, 158, 11, 0.35)',
            borderRadius: '8px',
            padding: '0.75rem 1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            color: '#fbbf24',
            fontSize: '0.85rem',
          }}
          data-testid="overtime-banner"
        >
          <AlertTriangle size={18} style={{ flexShrink: 0 }} />
          <div>
            <strong>Official Window Expired:</strong> You may still finish and submit your run.
            Over-time telemetry is recorded for judges.
          </div>
        </div>
      )}

      {/* Reset Request Active Banner */}
      {timerLog?.resetRequested && !isCompleted && (
        <div
          style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            borderRadius: '8px',
            padding: '0.75rem 1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            color: '#fca5a5',
            fontSize: '0.85rem',
          }}
          data-testid="reset-requested-banner"
        >
          <Info size={18} style={{ flexShrink: 0 }} />
          <div>
            <strong>Reset Request Pending:</strong> "{timerLog.resetReason || 'Stream crash reported'}".
            Awaiting tournament judge review or session restart.
          </div>
        </div>
      )}
    </div>
  );
};
