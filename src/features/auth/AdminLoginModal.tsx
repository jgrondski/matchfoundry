import React, { useId, useState } from 'react';
import { Overlay } from '../../components/overlay';
import { Button, IconButton } from '../../components/ui';
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
          <div className="flex items-center justify-between border-b border-line-subtle bg-black/20 px-6 py-5">
            <div className="flex items-center gap-2.5">
              <div className="flex size-8 items-center justify-center rounded-md bg-linear-135 from-gold-bright to-gold text-black">
                <KeyRound size={18} />
              </div>
              <div>
                <h3 id={titleId} className="m-0 text-base font-bold text-white">
                  Admin Access
                </h3>
                <p className="m-0 text-xs text-fg-muted">
                  {tournamentName ? `Unlock ${tournamentName}` : 'Enter Master or Tournament PIN'}
                </p>
              </div>
            </div>
            <IconButton aria-label="Close" onClick={requestClose}>
              <X size={18} />
            </IconButton>
          </div>

          {/* Body */}
          <form onSubmit={handleSubmit} className="p-6">
            {error && (
              <div className="mb-4 flex items-center gap-2 rounded-sm border border-red/40 bg-red/15 px-3.5 py-2.5 text-caption text-red-bright">
                <ShieldAlert size={16} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {successMsg && (
              <div className="mb-4 flex items-center gap-2 rounded-sm border border-green/40 bg-green/15 px-3.5 py-2.5 text-caption text-green-bright">
                <Check size={16} className="shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            <div className="mb-5">
              <label className="mb-1.5 block text-caption font-semibold text-fg-secondary">
                Security PIN
              </label>
              <div className="relative">
                <input
                  type={showPin ? 'text' : 'password'}
                  value={pin}
                  onChange={e => setPin(e.target.value)}
                  autoFocus
                  data-autofocus
                  placeholder="Enter 4-8 digit PIN"
                  className="w-full rounded-sm border border-line bg-canvas py-2.5 pl-3 pr-10 text-base tracking-widest text-white"
                />
                <IconButton
                  aria-label={showPin ? 'Hide PIN' : 'Show PIN'}
                  onClick={() => setShowPin(!showPin)}
                  className="absolute right-2 top-1/2 -translate-y-1/2"
                  tabIndex={-1}
                >
                  {showPin ? <EyeOff size={16} /> : <Eye size={16} />}
                </IconButton>
              </div>
              <p className="mx-0 mb-0 mt-2 text-xs text-fg-muted">
                Floor Judges & Tournament Directors enter tournament PIN. System Administrators enter Master PIN.
              </p>
            </div>

            <div className="flex justify-end gap-2.5">
              <Button variant="secondary" onClick={requestClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={isSubmitting || !pin.trim()}>
                {isSubmitting ? 'Verifying...' : 'Unlock'}
              </Button>
            </div>
          </form>
        </>
      )}
    </Overlay>
  );
};
