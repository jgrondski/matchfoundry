import React, { useId } from 'react';
import { AlertTriangle, Info, X } from 'lucide-react';
import { Button, IconButton, cn, useAction } from '../ui';
import { Overlay } from './Overlay';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  body: React.ReactNode;
  tone?: 'danger' | 'warning' | 'info';
  confirmLabel: string;
  confirmVariant?: 'danger' | 'primary';
  cancelLabel?: string;
  onConfirm: () => void | Promise<unknown>;
  onCancel: () => void;
  busy?: boolean;
  confirmDisabled?: boolean;
  /** Loading text on the Confirm button while onConfirm runs. */
  confirmLoadingText?: React.ReactNode;
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
  confirmLoadingText = 'Working…',
  extraActions,
}) => {
  const titleId = useId();
  const action = useAction(onConfirm);
  const isBusy = busy || action.busy;
  const Icon = tone === 'info' ? Info : AlertTriangle;
  return (
    <Overlay
      open={open}
      onClose={onCancel}
      busy={isBusy}
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
            <IconButton aria-label="Close" onClick={requestClose} disabled={isBusy}>
              <X size={18} />
            </IconButton>
          </div>
          <div className="flex flex-col gap-4 p-6 text-sm text-fg">{body}</div>
          <div className="flex flex-wrap justify-end gap-3 border-t border-line bg-elevated px-6 py-4">
            <Button variant="secondary" onClick={requestClose} disabled={isBusy} data-autofocus>
              {cancelLabel}
            </Button>
            {extraActions}
            <Button
              variant={confirmVariant}
              onClick={() => void action.run()}
              loading={isBusy}
              loadingText={confirmLoadingText}
              disabled={confirmDisabled}
            >
              {confirmLabel}
            </Button>
          </div>
        </>
      )}
    </Overlay>
  );
};
