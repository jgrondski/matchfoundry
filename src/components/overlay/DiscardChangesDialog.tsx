import React from 'react';
import { ConfirmDialog } from './ConfirmDialog';

export const DISCARD_TITLE = 'Discard unsaved changes?';
export const DISCARD_BODY = "You have changes that haven't been saved. If you leave now, they'll be lost.";

export interface DiscardChangesDialogProps {
  open: boolean;
  onKeepEditing: () => void;
  onDiscard: () => void;
}

export const DiscardChangesDialog: React.FC<DiscardChangesDialogProps> = ({ open, onKeepEditing, onDiscard }) => (
  <ConfirmDialog
    open={open}
    tone="warning"
    title={DISCARD_TITLE}
    body={<p>{DISCARD_BODY}</p>}
    cancelLabel="Keep Editing"
    confirmLabel="Discard Changes"
    confirmVariant="danger"
    onCancel={onKeepEditing}
    onConfirm={onDiscard}
  />
);
