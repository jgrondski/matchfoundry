import React, { useState } from 'react';
import { KeyRound, Eye, EyeOff, ShieldCheck, Check, AlertCircle } from 'lucide-react';
import { usePinAuth, getAuthHeaders } from '../../../auth/AuthContext';
import { SharedPinWarningModal, SharedTournamentInfo } from './SharedPinWarningModal';
import { labelStyle, inputStyle } from './types';

interface TournamentSecuritySectionProps {
  tournamentId: string;
  tournamentSlug: string;
}

export const TournamentSecuritySection: React.FC<TournamentSecuritySectionProps> = ({
  tournamentId,
  tournamentSlug,
}) => {
  const { isSystemAdmin } = usePinAuth();
  const [newPin, setNewPin] = useState('');
  const [showNewPin, setShowNewPin] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateFeedback, setUpdateFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Shared PIN warning modal state
  const [isWarningModalOpen, setIsWarningModalOpen] = useState(false);
  const [sharedTournaments, setSharedTournaments] = useState<SharedTournamentInfo[]>([]);

  // System Admin reveal state
  const [revealedPin, setRevealedPin] = useState<string | null>(null);
  const [isRevealing, setIsRevealing] = useState(false);
  const [showRevealed, setShowRevealed] = useState(false);

  const handleUpdatePin = async (e?: React.SyntheticEvent, confirmed: boolean = false) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const pinToSave = newPin.trim();
    if (!pinToSave) {
      setUpdateFeedback({ type: 'error', message: 'PIN cannot be empty' });
      return;
    }
    setIsUpdating(true);
    setUpdateFeedback(null);

    const targetIdentifier = tournamentId || tournamentSlug;

    try {
      const res = await fetch(`/api/tournaments/${targetIdentifier}/pin`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ pin: pinToSave, confirmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update tournament PIN');
      }

      if (data.isShared && !data.success) {
        setSharedTournaments(data.sharedTournaments || []);
        setIsWarningModalOpen(true);
        setIsUpdating(false);
        return;
      }

      setIsWarningModalOpen(false);
      setSharedTournaments([]);
      const successMessage = data.isShared
        ? `Tournament PIN successfully updated! (Shared with ${data.sharedTournaments?.length || 1} other tournament${data.sharedTournaments?.length === 1 ? '' : 's'})`
        : 'Tournament PIN successfully updated!';
      setUpdateFeedback({ type: 'success', message: successMessage });
      setNewPin('');
      if (isSystemAdmin) {
        setRevealedPin(pinToSave);
      }
      setTimeout(() => setUpdateFeedback(null), 4000);
    } catch (err: any) {
      setUpdateFeedback({ type: 'error', message: err.message || 'Error updating PIN' });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleToggleReveal = async () => {
    if (showRevealed) {
      setShowRevealed(false);
      return;
    }

    const targetIdentifier = tournamentId || tournamentSlug;
    setIsRevealing(true);
    try {
      const res = await fetch(`/api/tournaments/${targetIdentifier}/reveal-pin`, {
        method: 'GET',
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to reveal PIN');
      }
      setRevealedPin(data.pin || '(No PIN configured)');
      setShowRevealed(true);
    } catch (err: any) {
      alert(err.message || 'Could not reveal PIN');
    } finally {
      setIsRevealing(false);
    }
  };

  return (
    <section
      style={{
        background: 'var(--color-bg-surface)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--color-border)',
        padding: '1rem 1.25rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <KeyRound size={18} color="var(--color-gold-bright)" />
          <h2 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: 'var(--color-text-primary)' }}>
            Access Security & PIN Management
          </h2>
        </div>
        {isSystemAdmin && (
          <span
            style={{
              fontSize: '0.7rem',
              fontWeight: 700,
              padding: '0.2rem 0.5rem',
              borderRadius: 'var(--radius-full)',
              background: 'rgba(56, 189, 248, 0.15)',
              border: '1px solid rgba(56, 189, 248, 0.35)',
              color: '#38bdf8',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
            }}
          >
            <ShieldCheck size={12} />
            System Admin Scope
          </span>
        )}
      </div>

      <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>
        Tournament PIN protects floor judge and management views (<code>/{tournamentSlug}/manage/*</code>).
        Spectator and OBS broadcast overlay routes remain friction-free and publicly accessible.
      </p>

      {/* Reveal Existing PIN (System Admin Only) */}
      {isSystemAdmin && (
        <div
          style={{
            padding: '0.75rem',
            borderRadius: 'var(--radius-md)',
            background: 'var(--color-bg-surface-elevated)',
            border: '1px solid var(--color-border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            flexWrap: 'wrap',
          }}
        >
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
              Current Tournament PIN:
            </div>
            <div style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)' }}>
              Encrypted at rest with AES-256-GCM. Reveal without resetting session.
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            {showRevealed && (
              <span
                style={{
                  fontFamily: 'monospace',
                  fontSize: '1rem',
                  fontWeight: 700,
                  color: 'var(--color-gold-bright)',
                  letterSpacing: '0.12em',
                  background: 'rgba(0, 0, 0, 0.4)',
                  padding: '0.25rem 0.65rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-border)',
                }}
              >
                {revealedPin}
              </span>
            )}
            <button
              type="button"
              onClick={handleToggleReveal}
              disabled={isRevealing}
              className="btn btn-secondary"
              style={{ fontSize: '0.78rem', padding: '0.35rem 0.65rem', gap: '0.35rem' }}
            >
              {showRevealed ? <EyeOff size={14} /> : <Eye size={14} />}
              <span>{isRevealing ? 'Decrypting...' : showRevealed ? 'Hide PIN' : 'Reveal PIN'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Update PIN Controls (Div container to prevent nested form interference) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
        <label style={labelStyle}>Set New Tournament PIN</label>
        <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '1', minWidth: '180px' }}>
            <input
              type={showNewPin ? 'text' : 'password'}
              value={newPin}
              onChange={e => setNewPin(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  e.stopPropagation();
                  handleUpdatePin(e);
                }
              }}
              placeholder="Enter new 4-8 digit PIN"
              style={{
                ...inputStyle,
                paddingRight: '2.5rem',
                letterSpacing: '0.08em',
              }}
            />
            <button
              type="button"
              onClick={() => setShowNewPin(!showNewPin)}
              style={{
                position: 'absolute',
                right: '8px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'transparent',
                border: 'none',
                color: 'var(--color-text-muted)',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
              }}
              tabIndex={-1}
            >
              {showNewPin ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <button
            type="button"
            onClick={e => handleUpdatePin(e)}
            disabled={isUpdating || !newPin.trim()}
            className="btn btn-primary"
            style={{ fontSize: '0.82rem', padding: '0.5rem 1rem' }}
          >
            {isUpdating ? 'Saving...' : 'Update PIN'}
          </button>
        </div>

        {updateFeedback && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              fontSize: '0.78rem',
              color: updateFeedback.type === 'success' ? '#34d399' : '#f87171',
              marginTop: '0.25rem',
            }}
          >
            {updateFeedback.type === 'success' ? <Check size={14} /> : <AlertCircle size={14} />}
            <span>{updateFeedback.message}</span>
          </div>
        )}
      </div>

      <SharedPinWarningModal
        isOpen={isWarningModalOpen}
        onClose={() => {
          setIsWarningModalOpen(false);
          setSharedTournaments([]);
        }}
        onConfirm={() => handleUpdatePin(undefined, true)}
        sharedTournaments={sharedTournaments}
        isSubmitting={isUpdating}
      />
    </section>
  );
};
