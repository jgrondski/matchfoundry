import React, { useId, useState } from 'react';
import { Overlay } from '../../components/overlay';
import { usePinAuth } from './AuthContext';
import { KeyRound, ShieldAlert, Check, X, Eye, EyeOff } from 'lucide-react';

interface AdminLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  tournamentSlugOrId?: string;
  tournamentName?: string;
  onSuccess?: () => void;
}

export const AdminLoginModal: React.FC<AdminLoginModalProps> = ({
  isOpen,
  onClose,
  tournamentSlugOrId,
  tournamentName,
  onSuccess,
}) => {
  const { login } = usePinAuth();
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const titleId = useId();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin.trim()) {
      setError('Please enter a PIN');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await login(pin, tournamentSlugOrId);
      if (!res.success) {
        setError(res.error || 'Invalid PIN');
        setIsSubmitting(false);
        return;
      }
      setSuccessMsg('Access unlocked!');
      setTimeout(() => {
        setIsSubmitting(false);
        setPin('');
        setError(null);
        setSuccessMsg(null);
        onClose();
        if (onSuccess) onSuccess();
      }, 600);
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
      setIsSubmitting(false);
    }
  };

  return (
    <Overlay
      open
      onClose={onClose}
      dirty={pin !== ''}
      busy={isSubmitting}
      aria-labelledby={titleId}
      panelClassName="flex max-w-105 flex-col overflow-hidden rounded-md border border-line bg-surface shadow-[0_20px_40px_rgba(0,0,0,0.6)]"
    >
      {({ requestClose }) => (
        <>
          {/* Header */}
          <div
            style={{
              padding: '1.25rem 1.5rem',
              borderBottom: '1px solid var(--color-border-subtle, rgba(255,255,255,0.06))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'rgba(0, 0, 0, 0.2)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, var(--color-gold-bright, #ffd700), #f59e0b)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#000',
                }}
              >
                <KeyRound size={18} />
              </div>
              <div>
                <h3 id={titleId} style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#ffffff' }}>
                  Admin Access
                </h3>
                <p style={{ margin: 0, fontSize: '0.74rem', color: 'var(--color-text-muted, #8b949e)' }}>
                  {tournamentName ? `Unlock ${tournamentName}` : 'Enter Master or Tournament PIN'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={requestClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--color-text-muted, #8b949e)',
                cursor: 'pointer',
                padding: '0.25rem',
                display: 'flex',
              }}
            >
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <form onSubmit={handleSubmit} style={{ padding: '1.5rem' }}>
            {error && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.65rem 0.85rem',
                  backgroundColor: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  borderRadius: '6px',
                  color: '#f87171',
                  fontSize: '0.82rem',
                  marginBottom: '1rem',
                }}
              >
                <ShieldAlert size={16} style={{ flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}

            {successMsg && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.65rem 0.85rem',
                  backgroundColor: 'rgba(16, 185, 129, 0.15)',
                  border: '1px solid rgba(16, 185, 129, 0.4)',
                  borderRadius: '6px',
                  color: '#34d399',
                  fontSize: '0.82rem',
                  marginBottom: '1rem',
                }}
              >
                <Check size={16} style={{ flexShrink: 0 }} />
                <span>{successMsg}</span>
              </div>
            )}

            <div style={{ marginBottom: '1.25rem' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  color: 'var(--color-text-secondary, #c9d1d9)',
                  marginBottom: '0.4rem',
                }}
              >
                Security PIN
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPin ? 'text' : 'password'}
                  value={pin}
                  onChange={e => setPin(e.target.value)}
                  autoFocus
                  data-autofocus
                  placeholder="Enter 4-8 digit PIN"
                  style={{
                    width: '100%',
                    padding: '0.6rem 2.5rem 0.6rem 0.75rem',
                    backgroundColor: 'var(--color-bg-base, #0d1117)',
                    border: '1px solid var(--color-border, #30363d)',
                    borderRadius: '6px',
                    color: '#ffffff',
                    fontSize: '0.95rem',
                    letterSpacing: '0.08em',
                    boxSizing: 'border-box',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  style={{
                    position: 'absolute',
                    right: '8px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--color-text-muted, #8b949e)',
                    cursor: 'pointer',
                    padding: '4px',
                    display: 'flex',
                  }}
                  tabIndex={-1}
                >
                  {showPin ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <p
                style={{
                  margin: '0.45rem 0 0 0',
                  fontSize: '0.72rem',
                  color: 'var(--color-text-muted, #8b949e)',
                }}
              >
                Floor Judges & Tournament Directors enter tournament PIN. System Administrators enter Master PIN.
              </p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem' }}>
              <button
                type="button"
                onClick={requestClose}
                disabled={isSubmitting}
                style={{
                  padding: '0.55rem 1rem',
                  backgroundColor: 'transparent',
                  border: '1px solid var(--color-border, #30363d)',
                  borderRadius: '6px',
                  color: 'var(--color-text-secondary, #c9d1d9)',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !pin.trim()}
                style={{
                  padding: '0.55rem 1.25rem',
                  backgroundColor: 'var(--color-gold-bright, #ffd700)',
                  color: '#000000',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: isSubmitting || !pin.trim() ? 'not-allowed' : 'pointer',
                  opacity: isSubmitting || !pin.trim() ? 0.6 : 1,
                }}
              >
                {isSubmitting ? 'Verifying...' : 'Unlock'}
              </button>
            </div>
          </form>
        </>
      )}
    </Overlay>
  );
};
