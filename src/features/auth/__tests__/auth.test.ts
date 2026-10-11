import { describe, it, expect, beforeEach } from 'vitest';
import { getStoredSession, getAuthHeaders, getAuthToken, AuthSession } from '../AuthContext';

// Mock localStorage
const storage: Record<string, string> = {};
const localStorageMock = {
  getItem: (key: string) => storage[key] || null,
  setItem: (key: string, value: string) => {
    storage[key] = value.toString();
  },
  removeItem: (key: string) => {
    delete storage[key];
  },
  clear: () => {
    for (const k of Object.keys(storage)) {
      delete storage[k];
    }
  },
};

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

Object.defineProperty(global, 'window', {
  value: {
    localStorage: localStorageMock,
    addEventListener: () => {},
    removeEventListener: () => {},
  },
  writable: true,
});

describe('Frontend PIN Authentication & Session State Management', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  describe('1. Session Hydration & Expiration', () => {
    it('returns null when no session is in localStorage', () => {
      expect(getStoredSession()).toBeNull();
      expect(getAuthHeaders()).toEqual({});
      expect(getAuthToken()).toBeNull();
    });

    it('hydrates valid session and provides Authorization bearer headers', () => {
      const session: AuthSession = {
        token: 'signed-hmac-jwt-token',
        role: 'MASTER_ADMIN',
        expiresAt: Date.now() + 100000,
      };
      localStorageMock.setItem('tm_admin_auth', JSON.stringify(session));

      const loaded = getStoredSession();
      expect(loaded).not.toBeNull();
      expect(loaded?.role).toBe('SYSTEM_ADMIN');
      expect(loaded?.token).toBe('signed-hmac-jwt-token');

      expect(getAuthHeaders()).toEqual({
        Authorization: 'Bearer signed-hmac-jwt-token',
      });
      expect(getAuthToken()).toBe('signed-hmac-jwt-token');
    });

    it('purges and returns null for expired session token', () => {
      const expiredSession: AuthSession = {
        token: 'expired-jwt-token',
        role: 'TOURNAMENT_ADMIN',
        tournamentSlug: 'ctwc-2026',
        expiresAt: Date.now() - 5000, // 5s in past
      };
      localStorageMock.setItem('tm_admin_auth', JSON.stringify(expiredSession));

      const loaded = getStoredSession();
      expect(loaded).toBeNull();
      expect(localStorageMock.getItem('tm_admin_auth')).toBeNull();
      expect(getAuthHeaders()).toEqual({});
    });
  });

  describe('2. Permission Scoping Logic', () => {
    function evaluateCanManage(session: AuthSession | null, targetTourneySlugOrId?: string): boolean {
      if (!session) return false;
      if (session.role === 'MASTER_ADMIN') return true;
      if (session.role === 'TOURNAMENT_ADMIN') {
        if (!targetTourneySlugOrId) return true;
        return (
          session.tournamentId === targetTourneySlugOrId ||
          session.tournamentSlug === targetTourneySlugOrId
        );
      }
      return false;
    }

    it('grants Master Admin permission across any tournament or global views', () => {
      const masterSession: AuthSession = {
        token: 'master-token',
        role: 'MASTER_ADMIN',
      };
      expect(evaluateCanManage(masterSession, 'ctwc-2026')).toBe(true);
      expect(evaluateCanManage(masterSession, 'kc-open')).toBe(true);
      expect(evaluateCanManage(masterSession)).toBe(true);
    });

    it('scopes Tournament Admin strictly to their tournament ID or slug', () => {
      const tourneySession: AuthSession = {
        token: 'tourney-token',
        role: 'TOURNAMENT_ADMIN',
        tournamentId: 't-123',
        tournamentSlug: 'ctwc-2026',
      };
      expect(evaluateCanManage(tourneySession, 'ctwc-2026')).toBe(true);
      expect(evaluateCanManage(tourneySession, 't-123')).toBe(true);
      expect(evaluateCanManage(tourneySession, 'different-tournament')).toBe(false);
      expect(evaluateCanManage(tourneySession, 't-999')).toBe(false);
    });

    it('denies anonymous spectators from managing any tournament', () => {
      expect(evaluateCanManage(null, 'ctwc-2026')).toBe(false);
      expect(evaluateCanManage(null)).toBe(false);
    });
  });
});
