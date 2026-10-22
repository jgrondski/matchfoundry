import React, { useState } from 'react';
import { AlertTriangle, X, Send } from 'lucide-react';

export interface StreamCrashModalProps {
  isOpen: boolean;
  onSubmit: (reason: string) => Promise<void>;
  onClose: () => void;
  isSubmitting?: boolean;
}

export const StreamCrashModal: React.FC<StreamCrashModalProps> = ({
  isOpen,
  onSubmit,
  onClose,
  isSubmitting = false,
}) => {
  const [reason, setReason] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanReason = reason.trim();
    if (!cleanReason || isSubmitting) return;
    await onSubmit(cleanReason);
  };

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
      data-testid="stream-crash-modal"
    >
      <div
        style={{
          background: 'var(--color-bg-surface, #121820)',
          border: '1px solid rgba(239, 68, 68, 0.4)',
          borderRadius: '14px',
          width: '100%',
          maxWidth: '520px',
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
            background: 'rgba(239, 68, 68, 0.08)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <AlertTriangle size={20} color="#f87171" />
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#ffffff' }}>
              Report Stream Crash / Reset Request
            </h3>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--color-text-secondary, #94a3b8)',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              padding: '0.25rem',
            }}
            title="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: '1.5rem' }}>
          <p style={{ fontSize: '0.88rem', color: 'var(--color-text-secondary, #94a3b8)', lineHeight: 1.5, marginBottom: '1.25rem' }}>
            If you experienced an unavoidable broadcast crash, power outage, or hardware freeze, explain what happened
            below. Tournament judges will inspect your stream VOD. If approved, your session will be voided and a brand
            new NES Authword will be issued for a fresh qualification run.
          </p>

          <div style={{ marginBottom: '1.5rem' }}>
            <label
              style={{
                display: 'block',
                fontSize: '0.85rem',
                fontWeight: 700,
                color: '#ffffff',
                marginBottom: '0.5rem',
              }}
            >
              Description of Technical Failure *
            </label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="e.g. OBS crashed 14 minutes in, restarting broadcast now. Game 1 was interrupted."
              required
              rows={4}
              disabled={isSubmitting}
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: '8px',
                background: 'var(--color-bg-base, #0a0e14)',
                border: '1px solid var(--color-border, #263342)',
                color: '#ffffff',
                fontSize: '0.92rem',
                boxSizing: 'border-box',
                resize: 'vertical',
                lineHeight: 1.5,
              }}
              data-testid="crash-reason-textarea"
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              style={{
                padding: '0.65rem 1.25rem',
                borderRadius: '8px',
                border: '1px solid var(--color-border, #263342)',
                background: 'transparent',
                color: 'var(--color-text-secondary, #94a3b8)',
                fontWeight: 600,
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!reason.trim() || isSubmitting}
              style={{
                padding: '0.65rem 1.5rem',
                borderRadius: '8px',
                border: 'none',
                background: '#ef4444',
                color: '#ffffff',
                fontWeight: 800,
                cursor: reason.trim() && !isSubmitting ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
              data-testid="submit-crash-report-button"
            >
              <Send size={16} />
              {isSubmitting ? 'Sending Request...' : 'Send Reset Request to Judges'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
