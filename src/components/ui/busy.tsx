import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

export interface BusyContextValue {
  busy: boolean;
  begin: () => void;
  end: () => void;
}

const noop = () => {};

/** Default: never busy, so components work without the provider (tests, isolated renders). */
// eslint-disable-next-line react-refresh/only-export-components
export const BusyContext = createContext<BusyContextValue>({ busy: false, begin: noop, end: noop });

// eslint-disable-next-line react-refresh/only-export-components
export function nextBusyCount(count: number, change: 'begin' | 'end'): number {
  return change === 'begin' ? count + 1 : Math.max(0, count - 1);
}

export function BusyProvider({ children }: { children: React.ReactNode }) {
  const [count, setCount] = useState(0);
  const begin = useCallback(() => setCount(c => nextBusyCount(c, 'begin')), []);
  const end = useCallback(() => setCount(c => nextBusyCount(c, 'end')), []);
  const value = useMemo(() => ({ busy: count > 0, begin, end }), [count, begin, end]);
  return <BusyContext.Provider value={value}>{children}</BusyContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useGlobalBusy(): BusyContextValue {
  return useContext(BusyContext);
}
