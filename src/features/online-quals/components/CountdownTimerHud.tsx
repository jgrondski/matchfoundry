import React, { useEffect, useState } from 'react';
import { Clock, AlertTriangle, Info } from 'lucide-react';
import { computeTimerTelemetry } from '../authwordEngine';
import type { QualTimerLog } from '../../tournament/types';

export interface CountdownTimerHudProps {
  timerLog: QualTimerLog;
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
  const [nowMs, setNowMs] = useState<number>(Date.now());

  useEffect(() => {
    if (isCompleted || timerLog.submittedAt) return;
    const interval = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [isCompleted, timerLog.submittedAt]);

  const telemetry = computeTimerTelemetry(
    timerLog,
    qualWindowMinutes,
    timerLog.submittedAt || nowMs
  );

  const isOverTime = telemetry.overTime;

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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Clock size={18} color={isOverTime ? '#f59e0b' : 'var(--color-text-secondary, #94a3b8)'} />
          <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#e2e8f0', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {isCompleted ? 'Final Recorded Time' : 'Time Remaining'}
          </span>
        </div>

        <div style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary, #94a3b8)' }}>
          Official Window: <strong>{qualWindowMinutes} minutes</strong>
        </div>
      </div>

      {/* Main Clock Face */}
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: '1rem',
          flexWrap: 'wrap',
        }}
      >
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
          {isCompleted ? formatDuration(telemetry.elapsedSeconds) : formatDuration(telemetry.remainingSeconds)}
        </div>

        <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary, #94a3b8)' }}>
          Elapsed: <strong style={{ color: '#ffffff' }}>{formatDuration(telemetry.elapsedSeconds)}</strong>
          {telemetry.totalPauseSeconds > 0 && (
            <span style={{ marginLeft: '0.5rem' }}>
              (Pauses: {formatDuration(telemetry.totalPauseSeconds)})
            </span>
          )}
        </div>
      </div>

      {/* Over-Time Non-Blocking Alert */}
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
      {timerLog.resetRequested && !isCompleted && (
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
