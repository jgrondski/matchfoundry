import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export type AuthRole = 'SYSTEM_ADMIN' | 'TOURNAMENT_ADMIN' | 'MASTER_ADMIN' | null;

export interface AuthSession {
  token: string;
  role: 'SYSTEM_ADMIN' | 'TOURNAMENT_ADMIN' | 'MASTER_ADMIN';
  tournamentId?: string;
  tournamentSlug?: string;
  tournamentIds?: string[];
  tournamentSlugs?: string[];
  expiresAt?: number;
}

const STORAGE_KEY = 'tm_admin_auth';

// Module-level accessor for non-React code (e.g. store apiCall or fetch interceptors)
export function getStoredSession(): AuthSession | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: AuthSession = JSON.parse(raw);
    if (parsed.expiresAt && Date.now() > parsed.expiresAt) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    // Normalize legacy role in storage
    if (parsed.role === 'MASTER_ADMIN') {
      parsed.role = 'SYSTEM_ADMIN';
    }
    return parsed;
  } catch {
    return null;
  }
}

export function getAuthHeaders(): Record<string, string> {
  const session = getStoredSession();
  if (session?.token) {
    return { Authorization: `Bearer ${session.token}` };
  }
  return {};
}

export function getAuthToken(): string | null {
  return getStoredSession()?.token || null;
}

export interface AuthContextType {
  session: AuthSession | null;
  role: AuthRole;
  isSystemAdmin: boolean;
  isMasterAdmin: boolean; // Backwards-compatible alias for isSystemAdmin
  canManage: (tournamentIdOrSlug?: string) => boolean;
  login: (pin: string, tournamentSlugOrId?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<AuthSession | null>(() => getStoredSession());

  useEffect(() => {
    // Sync session across tabs or on mount
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        setSession(getStoredSession());
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const login = useCallback(async (pin: string, tournamentSlugOrId?: string) => {
    try {
      const res = await fetch('/api/auth/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pin.trim(), tournamentSlugOrId: tournamentSlugOrId?.trim() }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Authentication failed' };
      }

      const role = data.role === 'MASTER_ADMIN' ? 'SYSTEM_ADMIN' : data.role;

      const newSession: AuthSession = {
        token: data.token,
        role,
        tournamentId: data.tournamentId,
        tournamentSlug: data.tournamentSlug,
        tournamentIds: data.tournamentIds || (data.tournamentId ? [data.tournamentId] : []),
        tournamentSlugs: data.tournamentSlugs || (data.tournamentSlug ? [data.tournamentSlug] : []),
        // Default 7 days
        expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
      };

      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(newSession));
      }
      setSession(newSession);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error during PIN authentication' };
    }
  }, []);

  const logout = useCallback(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(STORAGE_KEY);
    }
    setSession(null);
  }, []);

  const isSystemAdmin = Boolean(
    session && (session.role === 'SYSTEM_ADMIN' || session.role === 'MASTER_ADMIN')
  );

  const canManage = useCallback(
    (tournamentIdOrSlug?: string): boolean => {
      if (!session) return false;
      if (session.role === 'SYSTEM_ADMIN' || session.role === 'MASTER_ADMIN') return true;
      if (session.role === 'TOURNAMENT_ADMIN') {
        if (!tournamentIdOrSlug) return true;
        return (
          session.tournamentId === tournamentIdOrSlug ||
          session.tournamentSlug === tournamentIdOrSlug ||
          Boolean(session.tournamentIds?.includes(tournamentIdOrSlug)) ||
          Boolean(session.tournamentSlugs?.includes(tournamentIdOrSlug))
        );
      }
      return false;
    },
    [session]
  );

  return (
    <AuthContext.Provider
      value={{
        session,
        role: session?.role || null,
        isSystemAdmin,
        isMasterAdmin: isSystemAdmin,
        canManage,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function usePinAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    // Safe fallback if rendered outside AuthProvider (e.g. in some isolated tests)
    const stored = getStoredSession();
    const isSys = Boolean(stored && (stored.role === 'SYSTEM_ADMIN' || stored.role === 'MASTER_ADMIN'));
    return {
      session: stored,
      role: stored?.role || null,
      isSystemAdmin: isSys,
      isMasterAdmin: isSys,
      canManage: (idOrSlug?: string) => {
        if (!stored) return false;
        if (stored.role === 'SYSTEM_ADMIN' || stored.role === 'MASTER_ADMIN') return true;
        return (
          stored.role === 'TOURNAMENT_ADMIN' &&
          (!idOrSlug || stored.tournamentId === idOrSlug || stored.tournamentSlug === idOrSlug)
        );
      },
      login: async () => ({ success: false, error: 'AuthProvider missing' }),
      logout: () => {},
    };
  }
  return context;
}
