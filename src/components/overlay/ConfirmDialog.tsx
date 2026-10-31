import React, { useId } from 'react';
import { AlertTriangle, Info, X } from 'lucide-react';
import { Button, IconButton, cn } from '../ui';
import { Overlay } from './Overlay';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  body: React.ReactNode;
  tone?: 'danger' | 'warning' | 'info';
  confirmLabel: string;
  confirmVariant?: 'danger' | 'primary';
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
  confirmDisabled?: boolean;
  /** Extra buttons rendered between Cancel and Confirm. */
  extraActions?: React.ReactNode;
}

const TONE = {
  danger: { border: 'border-red/50', icon: 'text-red' },
  warning: { border: 'border-gold', icon: 'text-gold-bright' },
  info: { border: 'border-line', icon: 'text-cyan' },
} as const;

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  body,
  tone = 'danger',
  confirmLabel,
  confirmVariant = 'danger',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  busy = false,
  confirmDisabled = false,
  extraActions,
}) => {
  const titleId = useId();
  const Icon = tone === 'info' ? Info : AlertTriangle;
  return (
    <Overlay
      open={open}
      onClose={onCancel}
      busy={busy}
      aria-labelledby={titleId}
      panelClassName={cn('max-w-[460px] overflow-hidden rounded-lg border bg-surface shadow-lg', TONE[tone].border)}
    >
      {({ requestClose }) => (
        <>
          <div className="flex items-center justify-between gap-3 border-b border-line bg-elevated px-6 py-5">
            <div className="flex items-center gap-2.5">
              <Icon size={20} className={TONE[tone].icon} />
              <h3 id={titleId} className="text-lg font-bold text-fg">{title}</h3>
            </div>
            <IconButton aria-label="Close" onClick={requestClose} disabled={busy}>
              <X size={18} />
            </IconButton>
          </div>
          <div className="flex flex-col gap-4 p-6 text-sm text-fg">{body}</div>
          <div className="flex flex-wrap justify-end gap-3 border-t border-line bg-elevated px-6 py-4">
            <Button variant="secondary" onClick={requestClose} disabled={busy} data-autofocus>
              {cancelLabel}
            </Button>
            {extraActions}
            <Button variant={confirmVariant} onClick={onConfirm} disabled={busy || confirmDisabled}>
              {confirmLabel}
            </Button>
          </div>
        </>
      )}
    </Overlay>
  );
};
