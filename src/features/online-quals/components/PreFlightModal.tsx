import React, { useState } from 'react';
import { CheckSquare, Square, X, ShieldCheck } from 'lucide-react';
import type { PointsThreshold } from '../../tournament/types';
import { qualFormatLabel } from '../../qualifiers/qualFormatLabel';
import { PointsInfoTip } from '../../qualifiers/components/PointsInfoTip';

export interface PreFlightModalProps {
  isOpen: boolean;
  tournamentName: string;
  qualWindowMinutes: number;
  qualFormat: string;
  qualAverageCount?: number;
  pointsConfig?: PointsThreshold[];
  twitchUsername: string;
  onConfirm: () => void;
  onCancel: () => void;
  isStarting?: boolean;
}

export const PreFlightModal: React.FC<PreFlightModalProps> = ({
  isOpen,
  tournamentName,
  qualWindowMinutes,
  qualFormat,
  qualAverageCount = 2,
  pointsConfig,
  twitchUsername,
  onConfirm,
  onCancel,
  isStarting = false,
}) => {
  const [checkLive, setCheckLive] = useState(false);
  const [checkVodStorage, setCheckVodStorage] = useState(false);
  const [checkAuthwordRule, setCheckAuthwordRule] = useState(false);
  const [checkTimeLimit, setCheckTimeLimit] = useState(false);
  const [checkStreamTimer, setCheckStreamTimer] = useState(false);

  if (!isOpen) return null;

  const allChecked = checkLive && checkVodStorage && checkStreamTimer && checkAuthwordRule && checkTimeLimit;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '1rem',
      }}
      data-testid="pre-flight-modal"
    >
      <div
        style={{
          background: 'var(--color-bg-surface, #121820)',
          border: '1px solid var(--color-border, #263342)',
          borderRadius: '14px',
          width: '100%',
          maxWidth: '580px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--color-border, #263342)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--color-bg-elevated, #1a222d)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <ShieldCheck size={22} color="var(--color-gold-bright, #fbbf24)" />
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#ffffff' }}>
              Qualifier Checklist
            </h3>
          </div>
          <button
            onClick={onCancel}
            disabled={isStarting}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--color-text-secondary, #94a3b8)',
              cursor: isStarting ? 'not-allowed' : 'pointer',
              padding: '0.25rem',
            }}
            title="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '1.5rem', overflowY: 'auto', maxHeight: '70vh' }}>
          {/* Rules Summary Box */}
          <div
            style={{
              background: 'rgba(245, 158, 11, 0.08)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              borderRadius: '8px',
              padding: '1rem',
              marginBottom: '1.5rem',
            }}
          >
            <div style={{ fontWeight: 700, color: 'var(--color-gold-bright, #fbbf24)', marginBottom: '0.25rem' }}>
              {tournamentName}
            </div>
            <div style={{ fontSize: '0.88rem', color: 'var(--color-text-secondary, #94a3b8)', lineHeight: 1.5 }}>
              <strong>Window:</strong> {qualWindowMinutes} minutes &bull; <strong>Format:</strong> {qualFormatLabel(qualFormat, qualAverageCount)}
              {qualFormat === 'POINTS' && (
                <>
                  {' '}
                  <PointsInfoTip pointsConfig={pointsConfig} />
                </>
              )}
            </div>
          </div>

          <p style={{ fontSize: '0.9rem', color: '#e2e8f0', marginBottom: '1rem', fontWeight: 600 }}>
            Before launching your official run, please verify every requirement:
          </p>

          {/* Checklist Items */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {/* Item 1: Stream Live */}
            <label
              onClick={() => setCheckLive(!checkLive)}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem',
                cursor: 'pointer',
                background: checkLive ? 'rgba(34, 197, 94, 0.08)' : 'rgba(255, 255, 255, 0.03)',
                border: `1px solid ${checkLive ? 'rgba(34, 197, 94, 0.4)' : 'var(--color-border, #263342)'}`,
                borderRadius: '8px',
                padding: '0.85rem',
              }}
            >
              <div
                style={{ cursor: 'pointer', color: checkLive ? '#22c55e' : 'var(--color-text-muted, #64748b)' }}
              >
                {checkLive ? <CheckSquare size={20} /> : <Square size={20} />}
              </div>
              <div style={{ fontSize: '0.88rem', color: '#f0f6fc' }}>
                <div>
                  My Twitch stream is currently <strong>LIVE</strong> at{' '}
                  <span style={{ color: '#a855f7' }}>twitch.tv/{twitchUsername}</span>.
                </div>
              </div>
            </label>

            {/* Item 2: Store past broadcasts */}
            <label
              onClick={() => setCheckVodStorage(!checkVodStorage)}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem',
                cursor: 'pointer',
                background: checkVodStorage ? 'rgba(34, 197, 94, 0.08)' : 'rgba(255, 255, 255, 0.03)',
                border: `1px solid ${checkVodStorage ? 'rgba(34, 197, 94, 0.4)' : 'var(--color-border, #263342)'}`,
                borderRadius: '8px',
                padding: '0.85rem',
              }}
            >
              <div
                style={{ cursor: 'pointer', color: checkVodStorage ? '#22c55e' : 'var(--color-text-muted, #64748b)' }}
              >
                {checkVodStorage ? <CheckSquare size={20} /> : <Square size={20} />}
              </div>
              <div style={{ fontSize: '0.88rem', color: '#f0f6fc' }}>
                <div>
                  <strong>Store past broadcasts</strong> is toggled <strong>ON</strong> in Creator Dashboard.
                </div>
              </div>
            </label>

            {/* Item 3: On-stream countdown timer (the portal does not display one) */}
            <label
              onClick={() => setCheckStreamTimer(!checkStreamTimer)}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem',
                cursor: 'pointer',
                background: checkStreamTimer ? 'rgba(34, 197, 94, 0.08)' : 'rgba(255, 255, 255, 0.03)',
                border: `1px solid ${checkStreamTimer ? 'rgba(34, 197, 94, 0.4)' : 'var(--color-border, #263342)'}`,
                borderRadius: '8px',
                padding: '0.85rem',
              }}
            >
              <div
                style={{ cursor: 'pointer', color: checkStreamTimer ? '#22c55e' : 'var(--color-text-muted, #64748b)' }}
              >
                {checkStreamTimer ? <CheckSquare size={20} /> : <Square size={20} />}
              </div>
              <div style={{ fontSize: '0.88rem', color: '#f0f6fc' }}>
                <div>
                  A visible <strong>{qualWindowMinutes}-minute countdown timer</strong> is on my Twitch scene.
                </div>
              </div>
            </label>

            {/* Item 4: Authword rule */}
            <label
              onClick={() => setCheckAuthwordRule(!checkAuthwordRule)}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem',
                cursor: 'pointer',
                background: checkAuthwordRule ? 'rgba(34, 197, 94, 0.08)' : 'rgba(255, 255, 255, 0.03)',
                border: `1px solid ${checkAuthwordRule ? 'rgba(34, 197, 94, 0.4)' : 'var(--color-border, #263342)'}`,
                borderRadius: '8px',
                padding: '0.85rem',
              }}
            >
              <div
                style={{ cursor: 'pointer', color: checkAuthwordRule ? '#22c55e' : 'var(--color-text-muted, #64748b)' }}
              >
                {checkAuthwordRule ? <CheckSquare size={20} /> : <Square size={20} />}
              </div>
              <div style={{ fontSize: '0.88rem', color: '#f0f6fc' }}>
                <div>
                  I understand the <strong>NES Authword proof rule</strong>.
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary, #94a3b8)', marginTop: '0.2rem' }}>
                  Before starting the timer, play a game to 10k, top out, and enter authword in the high score post-game.
                </div>
              </div>
            </label>

            {/* Item 5: Time window */}
            <label
              onClick={() => setCheckTimeLimit(!checkTimeLimit)}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem',
                cursor: 'pointer',
                background: checkTimeLimit ? 'rgba(34, 197, 94, 0.08)' : 'rgba(255, 255, 255, 0.03)',
                border: `1px solid ${checkTimeLimit ? 'rgba(34, 197, 94, 0.4)' : 'var(--color-border, #263342)'}`,
                borderRadius: '8px',
                padding: '0.85rem',
              }}
            >
              <div
                style={{ cursor: 'pointer', color: checkTimeLimit ? '#22c55e' : 'var(--color-text-muted, #64748b)' }}
              >
                {checkTimeLimit ? <CheckSquare size={20} /> : <Square size={20} />}
              </div>
              <div style={{ fontSize: '0.88rem', color: '#f0f6fc' }}>
                <div>
                  I understand the <strong>{qualWindowMinutes}-minute window</strong>.
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary, #94a3b8)', marginTop: '0.2rem' }}>
                  After authword, start the timer and begin playing. Any game in progress at the end of the timer will count.
                </div>
              </div>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderTop: '1px solid var(--color-border, #263342)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '0.75rem',
            background: 'var(--color-bg-elevated, #1a222d)',
          }}
        >
          <button
            onClick={onCancel}
            disabled={isStarting}
            style={{
              padding: '0.65rem 1.25rem',
              borderRadius: '8px',
              border: '1px solid var(--color-border, #263342)',
              background: 'transparent',
              color: 'var(--color-text-secondary, #94a3b8)',
              fontWeight: 600,
              cursor: isStarting ? 'not-allowed' : 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!allChecked || isStarting}
            style={{
              padding: '0.65rem 1.5rem',
              borderRadius: '8px',
              border: 'none',
              background: allChecked ? 'var(--color-gold-bright, #f59e0b)' : '#334155',
              color: allChecked ? '#000000' : '#94a3b8',
              fontWeight: 800,
              cursor: allChecked && !isStarting ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
            data-testid="confirm-begin-button"
          >
            {isStarting ? 'Launching Run...' : 'Confirm & Begin Qual'}
          </button>
        </div>
      </div>
    </div>
  );
};
