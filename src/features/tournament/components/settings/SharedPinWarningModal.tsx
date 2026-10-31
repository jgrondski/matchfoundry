import React, { useId } from 'react';
import { AlertTriangle, KeyRound, X, ArrowRight, ShieldAlert } from 'lucide-react';
import { Overlay } from '../../../../components/overlay';
import { Button, IconButton } from '../../../../components/ui';

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
  const titleId = useId();

  if (!isOpen) return null;

  return (
    <Overlay
      open
      onClose={onClose}
      busy={isSubmitting}
      aria-labelledby={titleId}
      panelTestId="shared-pin-warning-modal"
      panelClassName="flex max-w-130 flex-col overflow-hidden rounded-lg border border-gold/50 bg-surface shadow-[0_20px_45px_rgba(0,0,0,0.7),0_0_25px_rgba(245,158,11,0.15)]"
    >
      {({ requestClose }) => (
        <>
          {/* Header */}
          <div className="flex items-center justify-between gap-4 border-b border-gold/25 bg-linear-180 from-gold/12 to-gold/3 py-5 px-6">
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-md border border-gold/40 bg-gold/20 text-gold">
                <ShieldAlert size={20} />
              </div>
              <div>
                <h3 id={titleId} className="m-0 text-base font-bold tracking-tight text-white">
                  Shared Tournament PIN Warning
                </h3>
                <p className="mx-0 mb-0 mt-0.5 text-xs text-gold-bright">
                  Multi-Tournament Access Overlap Detected
                </p>
              </div>
            </div>
            <IconButton
              aria-label="Close"
              onClick={requestClose}
              disabled={isSubmitting}
              className="flex rounded-xs"
              title="Cancel and close"
            >
              <X size={18} />
            </IconButton>
          </div>

          {/* Content Body */}
          <div className="flex flex-col gap-4.5 p-6">
            <p className="m-0 text-sm leading-normal text-fg">
              The PIN you entered matches the PIN configured on{' '}
              <strong>
                {sharedTournaments.length === 1
                  ? 'another tournament'
                  : `${sharedTournaments.length} other tournaments`}
              </strong>:
            </p>

            {/* List of Shared Tournaments */}
            <div className="flex max-h-40 flex-col gap-1.5 overflow-y-auto rounded-md border border-line-subtle bg-black/35 p-2">
              {sharedTournaments.map(t => (
                <div
                  key={t.id}
                  className="flex items-center justify-between rounded-sm border border-white/4 bg-white/3 py-2 px-3"
                >
                  <div className="flex items-center gap-2">
                    <KeyRound size={13} className="text-gold" />
                    <span className="text-caption font-semibold text-white">
                      {t.name}
                    </span>
                  </div>
                  <code className="rounded-xs bg-black/30 py-0.5 px-1.5 text-xs text-fg-secondary">
                    /{t.slug}
                  </code>
                </div>
              ))}
            </div>

            {/* Impact Explainer */}
            <div className="flex flex-col gap-1.5 rounded-md border border-gold/25 bg-gold/8 py-3.5 px-4">
              <div className="flex items-center gap-1.5 text-caption font-bold text-gold-bright">
                <AlertTriangle size={14} />
                <span>How shared PINs work:</span>
              </div>
              <p className="m-0 text-caption leading-normal text-fg-secondary">
                Tournament Admins logging in with this PIN will authenticate once and be granted management access to <strong>all matching tournaments</strong>. They will see both tournaments in their manager left navigation dropdown and home workspace.
              </p>
            </div>

            <p className="m-0 text-caption text-fg-muted">
              If you want this tournament to have strictly isolated administration, click <strong>Cancel</strong> and choose a unique PIN. Otherwise, click <strong>Continue</strong> to save the shared PIN.
            </p>
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-3 border-t border-line bg-elevated py-4 px-6">
            <Button
              onClick={requestClose}
              disabled={isSubmitting}
              className="py-2 px-4 text-caption"
              data-testid="shared-pin-cancel-btn"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={onConfirm}
              disabled={isSubmitting}
              className="gap-2 py-2 px-5 text-caption"
              data-testid="shared-pin-continue-btn"
            >
              <span>{isSubmitting ? 'Saving...' : 'Continue (Share PIN)'}</span>
              <ArrowRight size={14} />
            </Button>
          </div>
        </>
      )}
    </Overlay>
  );
};
