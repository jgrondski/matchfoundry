import { useCallback, useEffect, useRef, useState } from 'react';
import { useGlobalBusy } from './busy';
import { useFeedback } from './feedback';
import { ACTION_FAILED_MESSAGE, ACTION_TIMEOUT_MESSAGE, ACTION_TIMEOUT_MS } from './actionConfig';

export class ActionTimeoutError extends Error {
  constructor() {
    super(ACTION_TIMEOUT_MESSAGE);
    this.name = 'ActionTimeoutError';
  }
}

export function raceWithTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new ActionTimeoutError()), ms);
    promise.then(
      v => { clearTimeout(timer); resolve(v); },
      e => { clearTimeout(timer); reject(e); }
    );
  });
}

export function actionErrorMessage(err: unknown): string {
  if (err instanceof ActionTimeoutError) return ACTION_TIMEOUT_MESSAGE;
  if (err instanceof Error && err.message) return err.message;
  return ACTION_FAILED_MESSAGE;
}

/** The framework-free core of useAction, exported for tests. Returns undefined on failure or timeout. */
export async function executeAction<R>(
  fn: () => Promise<R> | R,
  deps: { begin: () => void; end: () => void; showError: (m: string) => void; timeoutMs?: number }
): Promise<R | undefined> {
  deps.begin();
  try {
    return await raceWithTimeout(Promise.resolve().then(fn), deps.timeoutMs ?? ACTION_TIMEOUT_MS);
  } catch (err) {
    deps.showError(actionErrorMessage(err));
    return undefined;
  } finally {
    deps.end();
  }
}

/**
 * Wraps a click handler: sets `busy` for the button's loading state, holds the global busy lock,
 * enforces the timeout and shows failures in the banner. A second run while busy is ignored.
 * Handlers that want to handle an error themselves (for example the match conflict notice)
 * catch it inside fn and do not rethrow.
 */
export function useAction<A extends unknown[], R>(fn: (...args: A) => Promise<R> | R) {
  const { begin, end } = useGlobalBusy();
  const { showError } = useFeedback();
  const [busy, setBusy] = useState(false);
  const runningRef = useRef(false);
  const mountedRef = useRef(true);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const run = useCallback(async (...args: A): Promise<R | undefined> => {
    if (runningRef.current) return undefined;
    runningRef.current = true;
    setBusy(true);
    try {
      return await executeAction(() => fnRef.current(...args), { begin, end, showError });
    } finally {
      runningRef.current = false;
      if (mountedRef.current) setBusy(false);
    }
  }, [begin, end, showError]);

  return { run, busy };
}
