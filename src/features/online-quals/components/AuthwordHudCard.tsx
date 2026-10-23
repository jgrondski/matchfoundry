import React from 'react';
import { AlertTriangle, Info, ShieldCheck } from 'lucide-react';
import type { QualTimerLog } from '../../tournament/types';

export interface AuthwordHudCardProps {
  authWord: string | null;
  onReportCrash?: () => void;
  /**
   * Session timer log, used only for the reset-request banner. Elapsed time is recorded server-side for
   * judges but intentionally not shown: competitors run their own on-stream timer, and two clocks confuse.
   */
  timerLog?: QualTimerLog;
}

export const AuthwordHudCard: React.FC<AuthwordHudCardProps> = ({
  authWord,
  onReportCrash,
  timerLog,
}) => {
  return (
    <div
      style={{
        background: 'var(--color-bg-surface, #121820)',
        border: '1px solid rgba(245, 158, 11, 0.4)',
        borderRadius: '12px',
        padding: '1.5rem',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
      }}
      data-testid="authword-hud-card"
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <ShieldCheck size={20} color="var(--color-gold-bright, #fbbf24)" />
          <span style={{ fontSize: '0.9rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#e2e8f0' }}>
            Official Verification Authword
          </span>
        </div>

        {onReportCrash && (
          <button
            type="button"
            onClick={onReportCrash}
            style={{
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              borderRadius: '6px',
              padding: '0.35rem 0.75rem',
              color: '#fca5a5',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
            data-testid="report-crash-trigger"
          >
            <AlertTriangle size={14} />
            Report Stream Crash / Reset
          </button>
        )}
      </div>

      {/* Reset Request Active Banner */}
      {timerLog?.resetRequested && (
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

      {/* Authword Presentation Block */}
      <div
        style={{
          background: '#090d13',
          border: '2px solid var(--color-gold-bright, #f59e0b)',
          borderRadius: '10px',
          padding: '1.25rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary, #94a3b8)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.2rem' }}>
            NES Verification Code
          </div>
          <div
            style={{
              fontFamily: "'JetBrains Mono', 'Courier New', monospace",
              fontSize: '2.2rem',
              fontWeight: 900,
              letterSpacing: '0.22em',
              color: 'var(--color-gold-bright, #fbbf24)',
              textShadow: '0 0 16px rgba(245, 158, 11, 0.4)',
            }}
            data-testid="assigned-authword"
          >
            {authWord}
          </div>
        </div>

      </div>

      {/* Rule Notice */}
      <div
        style={{
          fontSize: '0.85rem',
          color: 'var(--color-text-secondary, #94a3b8)',
          lineHeight: 1.5,
          background: 'rgba(255, 255, 255, 0.02)',
          padding: '0.75rem 1rem',
          borderRadius: '8px',
          borderLeft: '3px solid var(--color-gold-bright, #f59e0b)',
        }}
      >
        <strong style={{ color: '#ffffff' }}>NES Authword Proof Rule:</strong> Play to &ge; 10,000 points, intentionally top out,
        and enter this exact word (<span style={{ color: 'var(--color-gold-bright, #fbbf24)', fontWeight: 700 }}>{authWord}</span>)
        on the high-score name screen on stream.
      </div>
    </div>
  );
};
