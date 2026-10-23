import React from 'react';
import { Navigate, useParams, useLocation } from 'react-router-dom';
import { usePinAuth } from './AuthContext';

interface GuardProps {
  children: React.ReactNode;
}

/**
 * Route guard for tournament management views (/:slug/manage/*).
 * If the user has valid System Admin or Tournament Admin for this slug, renders children.
 * If unauthorized, redirects to the PIN login page preserving tournament context and return URL.
 */
export const RequireTournamentAdmin: React.FC<GuardProps> = ({ children }) => {
  const { slug } = useParams<{ slug: string }>();
  const location = useLocation();
  const { canManage } = usePinAuth();

  if (!canManage(slug)) {
    const returnPath = encodeURIComponent(location.pathname + location.search);
    const slugParam = slug ? `&slug=${encodeURIComponent(slug)}` : '';
    return <Navigate to={`/admin?redirect=${returnPath}${slugParam}`} replace />;
  }

  return <>{children}</>;
};

/**
 * Route guard for global admin views (/organizations, /players, system admin dashboards).
 * Only accessible by System Admins.
 * Unauthorized attempts redirect to /admin preserving return URL.
 */
export const RequireSystemAdmin: React.FC<GuardProps> = ({ children }) => {
  const location = useLocation();
  const { isSystemAdmin } = usePinAuth();

  if (!isSystemAdmin) {
    const returnPath = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/admin?redirect=${returnPath}&needSystem=true`} replace />;
  }

  return <>{children}</>;
};

/**
 * Route guard for views accessible to any authenticated admin (System Admin or Tournament Admin),
 * such as the Global Competitors Directory (/players).
 * Unauthenticated users are redirected to /admin.
 */
export const RequireAnyAdmin: React.FC<GuardProps> = ({ children }) => {
  const location = useLocation();
  const { isSystemAdmin, session } = usePinAuth();
  const isAnyAdmin = isSystemAdmin || session?.role === 'TOURNAMENT_ADMIN';

  if (!isAnyAdmin) {
    const returnPath = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/admin?redirect=${returnPath}`} replace />;
  }

  return <>{children}</>;
};

// Backwards-compatible alias
export const RequireMasterAdmin = RequireSystemAdmin;
