import React, { useState } from 'react';
import { KeyRound, Eye, EyeOff, ShieldCheck, Check, AlertCircle } from 'lucide-react';
import { usePinAuth, getAuthHeaders } from '../../../auth/AuthContext';
import { SharedPinWarningModal, SharedTournamentInfo } from './SharedPinWarningModal';
import { labelClass, inputClass } from './types';
import { Button, IconButton, cn } from '../../../../components/ui';

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
    <section className="flex flex-col gap-4 rounded-lg border border-line bg-surface py-4 px-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <KeyRound size={18} color="var(--color-gold-bright)" />
          <h2 className="m-0 text-base font-bold text-fg">
            Access Security & PIN Management
          </h2>
        </div>
        {isSystemAdmin && (
          <span className="flex items-center gap-1 rounded-full border border-sky-400/35 bg-sky-400/15 py-0.5 px-2 text-2xs font-bold text-sky-400">
            <ShieldCheck size={12} />
            System Admin Scope
          </span>
        )}
      </div>

      <p className="m-0 text-caption leading-snug text-fg-secondary">
        Tournament PIN protects floor judge and management views (<code>/{tournamentSlug}/manage/*</code>).
      </p>

      {/* Reveal Existing PIN (System Admin Only) */}
      {isSystemAdmin && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-md border border-line-subtle bg-elevated p-3">
          <div>
            <div className="text-caption font-semibold text-fg">
              Current Tournament PIN:
            </div>
            <div className="text-xs text-fg-muted">
              Encrypted with AES-256-GCM.
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            {showRevealed && (
              <span className="rounded-sm border border-line bg-black/40 py-1 px-2.5 font-mono text-base font-bold tracking-widest text-gold-bright">
                {revealedPin}
              </span>
            )}
            <Button
              onClick={handleToggleReveal}
              disabled={isRevealing}
              className="gap-1.5 py-1.5 px-2.5 text-caption"
            >
              {showRevealed ? <EyeOff size={14} /> : <Eye size={14} />}
              <span>{isRevealing ? 'Decrypting...' : showRevealed ? 'Hide PIN' : 'Reveal PIN'}</span>
            </Button>
          </div>
        </div>
      )}

      {/* Update PIN Controls (Div container to prevent nested form interference) */}
      <div className="flex flex-col gap-2.5">
        <label className={labelClass}>Set New Tournament PIN</label>
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative min-w-45 flex-1">
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
              className={cn(inputClass, 'pr-10 tracking-widest')}
            />
            <IconButton
              aria-label={showNewPin ? 'Hide PIN' : 'Show PIN'}
              onClick={() => setShowNewPin(!showNewPin)}
              className="absolute right-2 top-1/2 flex -translate-y-1/2"
              tabIndex={-1}
            >
              {showNewPin ? <EyeOff size={16} /> : <Eye size={16} />}
            </IconButton>
          </div>
          <Button
            variant="primary"
            onClick={e => handleUpdatePin(e)}
            disabled={isUpdating || !newPin.trim()}
            className="py-2 px-4 text-caption"
          >
            {isUpdating ? 'Saving...' : 'Update PIN'}
          </Button>
        </div>

        {updateFeedback && (
          <div
            className={cn(
              'mt-1 flex items-center gap-2 text-caption',
              updateFeedback.type === 'success' ? 'text-green-bright' : 'text-red-bright'
            )}
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
