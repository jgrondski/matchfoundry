import React from 'react';
import { AlertTriangle, KeyRound, X, ArrowRight, ShieldAlert } from 'lucide-react';

export interface SharedTournamentInfo {
  id: string;
  name: string;
  slug: string;
}

interface SharedPinWarningModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  sharedTournaments: SharedTournamentInfo[];
  isSubmitting?: boolean;
}

export const SharedPinWarningModal: React.FC<SharedPinWarningModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  sharedTournaments,
  isSubmitting = false,
}) => {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.78)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '1rem',
      }}
      data-testid="shared-pin-warning-modal"
    >
      <div
        style={{
          background: 'var(--color-bg-surface, #161b22)',
          borderRadius: 'var(--radius-lg, 12px)',
          border: '1px solid rgba(245, 158, 11, 0.5)',
          maxWidth: '520px',
          width: '100%',
          boxShadow: '0 20px 45px rgba(0, 0, 0, 0.7), 0 0 25px rgba(245, 158, 11, 0.15)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          animation: 'fadeIn 0.2s ease-out',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            background: 'linear-gradient(180deg, rgba(245, 158, 11, 0.12) 0%, rgba(245, 158, 11, 0.03) 100%)',
            borderBottom: '1px solid rgba(245, 158, 11, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: 'rgba(245, 158, 11, 0.2)',
                border: '1px solid rgba(245, 158, 11, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#f59e0b',
                flexShrink: 0,
              }}
            >
              <ShieldAlert size={20} />
            </div>
            <div>
              <h3
                style={{
                  fontSize: '1.05rem',
                  fontWeight: 700,
                  color: '#ffffff',
                  margin: 0,
                  letterSpacing: '-0.01em',
                }}
              >
                Shared Tournament PIN Warning
              </h3>
              <p style={{ fontSize: '0.75rem', color: '#fbbf24', margin: '0.15rem 0 0' }}>
                Multi-Tournament Access Overlap Detected
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--color-text-muted, #8b949e)',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '4px',
              transition: 'color 0.15s ease',
            }}
            title="Cancel and close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div
          style={{
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.15rem',
          }}
        >
          <p
            style={{
              fontSize: '0.88rem',
              color: 'var(--color-text-primary, #ffffff)',
              lineHeight: 1.5,
              margin: 0,
            }}
          >
            The PIN you entered matches the PIN configured on{' '}
            <strong>
              {sharedTournaments.length === 1
                ? 'another tournament'
                : `${sharedTournaments.length} other tournaments`}
            </strong>:
          </p>

          {/* List of Shared Tournaments */}
          <div
            style={{
              background: 'rgba(0, 0, 0, 0.35)',
              border: '1px solid var(--color-border-subtle, rgba(255, 255, 255, 0.08))',
              borderRadius: 'var(--radius-md, 8px)',
              padding: '0.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.4rem',
              maxHeight: '160px',
              overflowY: 'auto',
            }}
          >
            {sharedTournaments.map(t => (
              <div
                key={t.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.45rem 0.75rem',
                  borderRadius: 'var(--radius-sm, 6px)',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.04)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <KeyRound size={13} color="#f59e0b" />
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#ffffff' }}>
                    {t.name}
                  </span>
                </div>
                <code
                  style={{
                    fontSize: '0.72rem',
                    color: '#94a3b8',
                    background: 'rgba(0, 0, 0, 0.3)',
                    padding: '0.15rem 0.4rem',
                    borderRadius: '4px',
                  }}
                >
                  /{t.slug}
                </code>
              </div>
            ))}
          </div>

          {/* Impact Explainer */}
          <div
            style={{
              background: 'rgba(245, 158, 11, 0.08)',
              border: '1px solid rgba(245, 158, 11, 0.25)',
              borderRadius: 'var(--radius-md, 8px)',
              padding: '0.85rem 1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.4rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#fbbf24', fontSize: '0.78rem', fontWeight: 700 }}>
              <AlertTriangle size={14} />
              <span>How shared PINs work:</span>
            </div>
            <p
              style={{
                fontSize: '0.78rem',
                color: 'var(--color-text-secondary, #cbd5e1)',
                margin: 0,
                lineHeight: 1.45,
              }}
            >
              Tournament Admins logging in with this PIN will authenticate once and be granted management access to <strong>all matching tournaments</strong>. They will see both tournaments in their manager left navigation dropdown and home workspace.
            </p>
          </div>

          <p
            style={{
              fontSize: '0.82rem',
              color: 'var(--color-text-muted, #94a3b8)',
              margin: 0,
            }}
          >
            If you want this tournament to have strictly isolated administration, click <strong>Cancel</strong> and choose a unique PIN. Otherwise, click <strong>Continue</strong> to save the shared PIN.
          </p>
        </div>

        {/* Modal Actions */}
        <div
          style={{
            padding: '1rem 1.5rem',
            background: 'var(--color-bg-surface-elevated, #0d1117)',
            borderTop: '1px solid var(--color-border, #30363d)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '0.75rem',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="btn btn-secondary"
            style={{
              fontSize: '0.82rem',
              padding: '0.5rem 1rem',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
            }}
            data-testid="shared-pin-cancel-btn"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            className="btn btn-primary"
            style={{
              fontSize: '0.82rem',
              padding: '0.5rem 1.25rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
            }}
            data-testid="shared-pin-continue-btn"
          >
            <span>{isSubmitting ? 'Saving...' : 'Continue (Share PIN)'}</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};
