import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../ui';
import { resolveDismissal, type DismissReason } from './dismissal';
import { pushOverlay, removeOverlay, isTopOverlay } from './overlayStack';
import { DiscardChangesDialog } from './DiscardChangesDialog';

export interface OverlayRenderApi {
  /** Use for every X and Cancel button. Applies the dirty/busy rules. */
  requestClose: () => void;
}

export interface OverlayProps {
  open: boolean;
  /** Actually closes the overlay (parent sets its open state to false). */
  onClose: () => void;
  variant?: 'modal' | 'drawer';
  dirty?: boolean;
  busy?: boolean;
  dismissible?: boolean;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  panelClassName?: string;
  /** Runtime-only styles (e.g. tier-themed gradients). Never static values. */
  panelStyle?: React.CSSProperties;
  panelTestId?: string;
  children: React.ReactNode | ((api: OverlayRenderApi) => React.ReactNode);
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export const Overlay: React.FC<OverlayProps> = props => (props.open ? <OverlayInner {...props} /> : null);

const OverlayInner: React.FC<OverlayProps> = ({
  onClose,
  variant = 'modal',
  dirty = false,
  busy = false,
  dismissible = true,
  panelClassName,
  panelStyle,
  panelTestId,
  children,
  ...aria
}) => {
  const id = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const pressStartedOnBackdrop = useRef(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const requestClose = (reason: DismissReason) => {
    const result = resolveDismissal(reason, { dirty, busy, dismissible });
    if (result === 'close') onClose();
    if (result === 'confirm') setConfirmOpen(true);
  };
  const requestCloseRef = useRef(requestClose);
  requestCloseRef.current = requestClose;

  // Stack registration, focus capture/restore.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    pushOverlay(id);
    const panel = panelRef.current;
    const target = panel?.querySelector<HTMLElement>('[data-autofocus]') ?? panel;
    target?.focus();
    return () => {
      removeOverlay(id);
      previouslyFocused?.focus?.();
    };
  }, [id]);

  // Escape: only the topmost overlay reacts.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || !isTopOverlay(id)) return;
      e.preventDefault();
      requestCloseRef.current('escape');
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [id]);

  // Warn before tab close or reload while there are unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  const trapTab = (e: React.KeyboardEvent) => {
    if (e.key !== 'Tab' || !panelRef.current) return;
    const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const content = (
    <div
      className={cn(
        'fixed inset-0 z-1000 flex bg-black/75 backdrop-blur-overlay animate-fade-in',
        variant === 'drawer' ? 'justify-end' : 'items-center justify-center p-4'
      )}
      onMouseDown={e => {
        pressStartedOnBackdrop.current = e.target === e.currentTarget;
      }}
      onClick={e => {
        if (pressStartedOnBackdrop.current && e.target === e.currentTarget) requestClose('backdrop');
        pressStartedOnBackdrop.current = false;
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        {...aria}
        tabIndex={-1}
        data-testid={panelTestId}
        onKeyDown={trapTab}
        // eslint-disable-next-line no-restricted-syntax -- runtime: caller-supplied themed panel styles
        style={panelStyle}
        className={cn(
          'relative outline-none',
          variant === 'drawer'
            ? 'flex h-full w-full max-w-[520px] flex-col overflow-hidden animate-slide-in-right'
            : 'max-h-[calc(100vh-2rem)] w-full overflow-y-auto animate-fade-in',
          panelClassName
        )}
      >
        {typeof children === 'function' ? children({ requestClose: () => requestClose('button') }) : children}
      </div>
      <DiscardChangesDialog
        open={confirmOpen}
        onKeepEditing={() => setConfirmOpen(false)}
        onDiscard={() => {
          setConfirmOpen(false);
          onClose();
        }}
      />
    </div>
  );

  return typeof document === 'undefined' ? content : createPortal(content, document.body);
};
