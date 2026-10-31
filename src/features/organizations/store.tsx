import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Organization } from '../tournament/types';
import { CreateOrganizationInput } from './types';
import { getAuthHeaders, usePinAuth } from '../auth/AuthContext';
import { DEFAULT_TIER_THEME } from '../../theme/palette';

export const ORGANIZATIONS_STORAGE_KEY = 'classic_tetris_organizations';

export const DEFAULT_ORGANIZATIONS: Organization[] = [];

interface OrganizationContextType {
  organizations: Organization[];
  isLoading: boolean;
  isHydrated: boolean;
  getOrganizationById: (id: string) => Organization | undefined;
  getOrganizationBySlug: (slug: string) => Organization | undefined;
  createOrganization: (input: CreateOrganizationInput) => Promise<Organization>;
  updateOrganization: (id: string, updates: Partial<Organization>) => Promise<Organization | null>;
  deleteOrganization: (id: string, hasAssociatedTournaments?: boolean) => Promise<{ success: boolean; error?: string }>;
  orgError: string | null;
  clearOrgError: () => void;
}

export const OrganizationContext = createContext<OrganizationContextType | null>(null);

export const OrganizationProvider: React.FC<{
  children: React.ReactNode;
  initialOrganizations?: Organization[];
  initialHydrated?: boolean;
}> = ({ children, initialOrganizations, initialHydrated }) => {
  const [organizations, setOrganizations] = useState<Organization[]>(initialOrganizations || DEFAULT_ORGANIZATIONS);
  const [isLoading, setIsLoading] = useState<boolean>(!initialHydrated);
  const [isHydrated, setIsHydrated] = useState<boolean>(initialHydrated ?? false);
  const [orgError, setOrgError] = useState<string | null>(null);
  const clearOrgError = () => setOrgError(null);

  useEffect(() => {
    if (initialHydrated) return;
    let isMounted = true;
    setIsLoading(true);
    if (typeof window !== 'undefined' && typeof fetch === 'function') {
      fetch('/api/organizations', { headers: getAuthHeaders() })
        .then(res => {
          if (!res.ok) throw new Error('Failed to load organizations');
          return res.json();
        })
        .then(data => {
          if (isMounted && Array.isArray(data)) {
            setOrganizations(data);
          }
        })
        .catch(() => {
          if (isMounted) {
            setOrganizations([]);
          }
        })
        .finally(() => {
          if (isMounted) {
            setIsLoading(false);
            setIsHydrated(true);
          }
        });
    } else {
      setIsLoading(false);
      setIsHydrated(true);
    }
    return () => {
      isMounted = false;
    };
  }, []);

  // Webhook URLs are only returned to system admins, so reload when the session changes.
  const { session } = usePinAuth();
  const authToken = session?.token;
  const lastAuthTokenRef = useRef(authToken);
  useEffect(() => {
    if (lastAuthTokenRef.current === authToken) return;
    lastAuthTokenRef.current = authToken;
    fetch('/api/organizations', { headers: getAuthHeaders() })
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (Array.isArray(data)) setOrganizations(data);
      })
      .catch(() => {});
  }, [authToken]);

  const getOrganizationById = (id: string) => {
    return organizations.find(o => o.id === id);
  };

  const getOrganizationBySlug = (slug: string) => {
    return organizations.find(o => o.slug === slug || o.id === slug);
  };

  const createOrganization = async (input: CreateOrganizationInput): Promise<Organization> => {
    const slug = input.slug.trim().toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-');
    const theme = input.themeColors || input.branding?.themeColors || {
      primaryColor: input.brandColor || DEFAULT_TIER_THEME.primaryColor,
      secondaryColor: DEFAULT_TIER_THEME.secondaryColor,
      cardColor: DEFAULT_TIER_THEME.cardColor,
      textColor: DEFAULT_TIER_THEME.textColor,
      backgroundColor: DEFAULT_TIER_THEME.backgroundColor,
    };
    const shortName = input.shortName || input.name;
    const tierThemes = input.tierThemes && input.tierThemes.length > 0 ? input.tierThemes : [
      {
        id: `theme_${Date.now()}_primary`,
        name: 'Primary Tier',
        themeColors: theme,
      },
    ];
    const newOrg: Organization = {
      ...input,
      id: `org_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      slug: slug || `org-${Date.now()}`,
      shortName,
      brandColor: input.brandColor || theme.primaryColor,
      themeColors: theme,
      tierThemes,
      branding: {
        logoUrl: input.logoUrl || input.branding?.logoUrl,
        bannerUrl: input.bannerUrl || input.branding?.bannerUrl,
        themeColors: theme,
        brandColor: input.brandColor || theme.primaryColor,
      },
      createdAt: Date.now(),
    };

    if (typeof window !== 'undefined' && typeof fetch === 'function') {
      try {
        const res = await fetch('/api/organizations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
          body: JSON.stringify(newOrg),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const saved = await res.json();
        if (saved && saved.id) {
          setOrganizations(prev => [saved, ...prev.filter(o => o.id !== saved.id)]);
          return saved;
        }
      } catch (err: any) {
        setOrgError(`Failed to create organization: ${err.message}`);
        throw err;
      }
    }

    setOrganizations(prev => [newOrg, ...prev]);
    return newOrg;
  };

  const updateOrganization = async (id: string, updates: Partial<Organization>): Promise<Organization | null> => {
    if (typeof window !== 'undefined' && typeof fetch === 'function') {
      try {
        const res = await fetch(`/api/organizations/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
          body: JSON.stringify(updates),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const saved = await res.json();
        if (saved && saved.id) {
          setOrganizations(prev => prev.map(o => (o.id === id ? saved : o)));
          return saved;
        }
      } catch (err: any) {
        setOrgError(`Failed to update organization: ${err.message}`);
        throw err;
      }
    }
    setOrganizations(prev => prev.map(o => (o.id === id ? { ...o, ...updates } : o)));
    return organizations.find(o => o.id === id) || null;
  };

  const deleteOrganization = async (
    id: string,
    hasAssociatedTournaments?: boolean
  ): Promise<{ success: boolean; error?: string }> => {
    if (hasAssociatedTournaments) {
      return {
        success: false,
        error: 'Cannot delete organization while active tournaments belong to it. Please delete or reassign them first.',
      };
    }

    if (typeof window !== 'undefined' && typeof fetch === 'function') {
      try {
        const res = await fetch(`/api/organizations/${id}`, {
          method: 'DELETE',
          headers: getAuthHeaders(),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setOrganizations(prev => prev.filter(o => o.id !== id));
        return { success: true };
      } catch (err: any) {
        setOrgError(`Failed to delete organization: ${err.message}`);
        return { success: false, error: err.message };
      }
    }

    setOrganizations(prev => prev.filter(o => o.id !== id));
    return { success: true };
  };

  return (
    <OrganizationContext.Provider
      value={{
        organizations,
        isLoading,
        isHydrated,
        getOrganizationById,
        getOrganizationBySlug,
        createOrganization,
        updateOrganization,
        deleteOrganization,
        orgError,
        clearOrgError,
      }}
    >
      {orgError && (
        <div
          role="alert"
          className="sticky top-0 z-99999 flex items-center justify-between bg-red-600 px-5 py-3 text-sm font-semibold text-white shadow-md"
        >
          <div className="flex items-center gap-2">
            <span>⚠️</span>
            <span>{orgError}</span>
          </div>
          <button
            onClick={clearOrgError}
            className="cursor-pointer border-0 bg-transparent px-2 py-1 text-base font-bold text-white"
            title="Dismiss error"
          >
            ✕
          </button>
        </div>
      )}
      {children}
    </OrganizationContext.Provider>
  );
};

export const useOrganization = (): OrganizationContextType => {
  const ctx = useContext(OrganizationContext);
  if (!ctx) {
    throw new Error('useOrganization must be used within an OrganizationProvider');
  }
  return ctx;
};
