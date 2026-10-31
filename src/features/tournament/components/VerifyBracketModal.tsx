import React, { useState, useId } from 'react';
import { Tournament } from '../types';
import { useTournament } from '../store';
import { Lock, ShieldAlert, CheckCircle2, X } from 'lucide-react';
import { Overlay } from '../../../components/overlay';

interface VerifyBracketModalProps {
  isOpen: boolean;
  onClose: () => void;
  tournament: Tournament;
}

export const VerifyBracketModal: React.FC<VerifyBracketModalProps> = ({
  isOpen,
  onClose,
  tournament,
}) => {
  const { lockTournament } = useTournament();
  const [step, setStep] = useState<1 | 2>(1);

  const [isLocking, setIsLocking] = useState(false);
  const titleId = useId();

  if (!isOpen) return null;

  const totalPlayers = tournament.tiers.reduce((acc, t) => acc + t.playerCount, 0);

  const handleConfirm = async () => {
    setIsLocking(true);
    try {
      await lockTournament(tournament.id);
      onClose();
    } finally {
      setIsLocking(false);
    }
  };

  return (
    <Overlay
      open
      onClose={onClose}
      busy={isLocking}
      aria-labelledby={titleId}
      panelClassName="max-w-130 overflow-hidden rounded-lg border border-gold bg-surface shadow-lg"
    >
      {({ requestClose }) => (
        <>
          {/* Header */}
          <div
            style={{
              padding: '1.25rem 1.5rem',
              background: 'var(--color-bg-surface-elevated)',
              borderBottom: '1px solid var(--color-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: 'var(--color-gold-bg)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--color-gold-bright)',
                }}
              >
                <Lock size={18} />
              </div>
              <div>
                <h3 id={titleId} style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                  Lock Brackets &amp; Begin Match Play
                </h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                  Double-confirmation seed freeze
                </p>
              </div>
            </div>
            <button
              onClick={requestClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--color-text-muted)',
                cursor: 'pointer',
                padding: '0.25rem',
              }}
            >
              <X size={18} />
            </button>
          </div>

          {/* Content */}
          <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {step === 1 ? (
              <>
                <div
                  style={{
                    background: 'rgba(245, 158, 11, 0.1)',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                    borderRadius: 'var(--radius-md)',
                    padding: '1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                  }}
                >
                  <div style={{ fontWeight: 700, color: 'var(--color-gold-bright)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <ShieldAlert size={16} />
                    Freeze Seeding &amp; Initialize Match Play Mode
                  </div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--color-text-primary)', lineHeight: 1.4 }}>
                    Locking brackets will freeze current qualifier standings into static match entities across all <strong>{tournament.tiers.length} tiers</strong> ({totalPlayers} competitors).
                  </p>
                  <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>
                    Subsequent qualifier score edits will be recorded in the qualifiers table, but will <strong>not</strong> re-seed or mutate the locked match pairings.
                  </p>
                </div>

                {/* Tiers Summary */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                    Tiers to lock:
                  </span>
                  {tournament.tiers.map(t => (
                    <div
                      key={t.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '0.5rem 0.75rem',
                        background: 'var(--color-bg-surface-highlight)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.85rem',
                      }}
                    >
                      <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{t.name}</span>
                      <span style={{ color: 'var(--color-text-muted)' }}>
                        {t.playerCount} players • {t.bracketType} (Bo{t.bestOf})
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div
                style={{
                  background: 'var(--color-bg-surface-elevated)',
                  border: '1px solid var(--color-gold)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1.25rem',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.75rem',
                }}
              >
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    background: 'var(--color-gold-bg)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--color-gold-bright)',
                  }}
                >
                  <Lock size={24} />
                </div>
                <h4 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#ffffff' }}>
                  Final Match Play Confirmation
                </h4>
                <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', maxWidth: '380px' }}>
                  Are you ready to officially begin match play? Floor judges and score submission drawers will become active immediately.
                </p>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div
            style={{
              padding: '1rem 1.5rem',
              background: 'var(--color-bg-surface-elevated)',
              borderTop: '1px solid var(--color-border)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '0.75rem',
            }}
          >
            <button
              onClick={requestClose}
              className="btn btn-secondary"
              style={{ padding: '0.5rem 1rem' }}
            >
              Cancel
            </button>
            {step === 1 ? (
              <button
                onClick={() => setStep(2)}
                className="btn btn-primary"
                style={{ padding: '0.5rem 1.25rem' }}
              >
                Proceed to Lock
              </button>
            ) : (
              <button
                onClick={handleConfirm}
                disabled={isLocking}
                className="btn btn-primary"
                style={{ padding: '0.5rem 1.25rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
              >
                {isLocking ? (
                  <div
                    style={{
                      width: '14px',
                      height: '14px',
                      borderRadius: '50%',
                      border: '2px solid rgba(255,255,255,0.3)',
                      borderTopColor: '#ffffff',
                      animation: 'spin 0.8s linear infinite',
                    }}
                  />
                ) : (
                  <CheckCircle2 size={16} />
                )}
                <span>{isLocking ? 'Locking Seeds...' : 'Yes, Lock Seeds & Begin Matches'}</span>
              </button>
            )}
          </div>
        </>
      )}
    </Overlay>
  );
};
