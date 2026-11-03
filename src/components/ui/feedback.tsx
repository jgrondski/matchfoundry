import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { IconButton } from './IconButton';

interface FeedbackContextValue {
  showError: (message: string) => void;
  dismiss: () => void;
}

const FeedbackContext = createContext<FeedbackContextValue | null>(null);

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const showError = useCallback((m: string) => setMessage(m), []);
  const dismiss = useCallback(() => setMessage(null), []);
  const value = useMemo(() => ({ showError, dismiss }), [showError, dismiss]);
  return (
    <FeedbackContext.Provider value={value}>
      <FeedbackBanner message={message} onDismiss={dismiss} />
      {children}
    </FeedbackContext.Provider>
  );
}

/** Falls back to console.error outside the provider so isolated renders and tests never crash. */
// eslint-disable-next-line react-refresh/only-export-components
export function useFeedback(): FeedbackContextValue {
  const ctx = useContext(FeedbackContext);
  return ctx ?? { showError: (m: string) => console.error('[feedback]', m), dismiss: () => {} };
}

export function FeedbackBanner({ message, onDismiss }: { message: string | null; onDismiss: () => void }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      data-testid="feedback-banner"
      className="fixed inset-x-0 top-0 z-2000 flex items-start justify-between gap-3 bg-red-600 px-4 py-3 text-sm font-semibold text-white shadow-md sm:px-5"
    >
      <div className="flex min-w-0 items-start gap-2">
        <AlertTriangle size={18} className="mt-px shrink-0" aria-hidden="true" />
        <span className="break-words">{message}</span>
      </div>
      <IconButton aria-label="Dismiss error" ignoreBusy onClick={onDismiss} className="min-h-11 min-w-11 text-white enabled:hover:bg-white/10 enabled:hover:text-white">
        <X size={18} />
      </IconButton>
    </div>
  );
}
