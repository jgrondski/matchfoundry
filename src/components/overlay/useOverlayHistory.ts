import { useEffect, useRef } from 'react';

const pendingBack = new Map<string, ReturnType<typeof setTimeout>>();

/**
 * True while the popstate from our own history.back() (removing a closed overlay's entry) is
 * being dispatched. It is not a user Back press, so an overlay still open underneath (for
 * example the drawer under a closed Discard prompt) must ignore it.
 */
let selfInitiatedPop = false;

function removeOwnEntry(): void {
  selfInitiatedPop = true;
  // Registered after every overlay listener, so it runs last and clears the flag.
  window.addEventListener('popstate', () => { selfInitiatedPop = false; }, { once: true });
  window.history.back();
}

/**
 * Pushes a same-URL history entry while an overlay is open, so Back closes the overlay
 * instead of leaving the page. onBack returns true when the overlay is closing, or false
 * when it stays open (dirty prompt or busy); in that case the entry is pushed again.
 */
export function useOverlayHistory(id: string, isTop: () => boolean, onBack: () => boolean): void {
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;
  const closedByBack = useRef(false);

  useEffect(() => {
    const hrefAtOpen = window.location.href;
    const scheduled = pendingBack.get(id);
    if (scheduled) {
      // StrictMode remount: the previous entry is still in place.
      clearTimeout(scheduled);
      pendingBack.delete(id);
    } else {
      window.history.pushState({ ...window.history.state, overlay: id }, '');
    }
    const onPopState = () => {
      if (selfInitiatedPop) return;
      if (!isTop()) return;
      if (onBackRef.current()) {
        closedByBack.current = true;
      } else {
        window.history.pushState({ ...window.history.state, overlay: id }, '');
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => {
      window.removeEventListener('popstate', onPopState);
      if (closedByBack.current) return;
      // Closed by a button, the backdrop or Escape: remove our entry, unless the app navigated away.
      pendingBack.set(
        id,
        setTimeout(() => {
          pendingBack.delete(id);
          if (window.location.href === hrefAtOpen && window.history.state?.overlay === id) {
            removeOwnEntry();
          }
        }, 0)
      );
    };
  }, [id, isTop]);
}
