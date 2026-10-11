import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Tournament, TournamentTier } from '../features/tournament/types';
import { useOrganization } from '../features/organizations/store';
import { usePinAuth } from '../features/auth/AuthContext';
import {
  Trophy,
  BarChart3,
  GitBranch,
  Layers,
  Share2,
  Building2,
  ArrowLeft,
  Settings,
  KeyRound,
} from 'lucide-react';
import { ErrorBoundary } from './ErrorBoundary';

export type SpectatorNavView = 'leaderboard' | 'standings' | 'bracket';

interface SpectatorLayoutProps {
  tournament: Tournament;
  activeView: SpectatorNavView;
  activeTier?: TournamentTier;
  children: React.ReactNode;
  contentStyle?: React.CSSProperties;
  className?: string;
  onOpenShare?: () => void;
}

export const SpectatorLayout: React.FC<SpectatorLayoutProps> = ({
  tournament,
  activeView,
  activeTier,
  children,
  contentStyle,
  className,
  onOpenShare,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isSystemAdmin, canManage } = usePinAuth();
  const hasManageAccess = isSystemAdmin || canManage(tournament.slug);
  const { getOrganizationById } = useOrganization();
  const org = tournament.organizationId ? getOrganizationById(tournament.organizationId) : undefined;

  const defaultTierSlug = activeTier?.slug || tournament.tiers[0]?.slug;
  const bracketUrl = defaultTierSlug ? `/${tournament.slug}/${defaultTierSlug}` : `/${tournament.slug}/brackets`;

  const navItems = [
    {
      id: 'bracket' as const,
      label: 'Brackets',
      icon: GitBranch,
      to: bracketUrl,
    },
    {
      id: 'leaderboard' as const,
      label: tournament.seedingMethod === 'MANUAL' ? 'Seeding' : 'Qualifiers',
      icon: BarChart3,
      to: `/${tournament.slug}/leaderboard`,
    },
    {
      id: 'standings' as const,
      label: 'Standings',
      icon: Trophy,
      to: `/${tournament.slug}/standings`,
    },
  ];

  return (
    <div
      className={className}
      style={{
        minHeight: '100vh',
        height: contentStyle?.height ? '100vh' : undefined,
        maxHeight: contentStyle?.height ? '100vh' : undefined,
        overflow: contentStyle?.overflow ? 'hidden' : undefined,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--color-bg-base)',
        width: '100%',
      }}
    >
      {/* Public Spectator Top Navigation Header */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          height: '56px',
          background: 'rgba(11, 14, 20, 0.94)',
          backdropFilter: 'blur(10px)',
          borderBottom: '1px solid var(--color-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 1.25rem',
          gap: '1rem',
          userSelect: 'none',
        }}
      >
        {/* Left: Global Back Link + Tournament Identity */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: 0 }}>
          <Link
            to="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.3rem 0.55rem',
              borderRadius: 'var(--radius-sm, 6px)',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--color-border-subtle, rgba(255,255,255,0.08))',
              color: 'var(--color-text-secondary, #94a3b8)',
              fontSize: '0.76rem',
              fontWeight: 600,
              textDecoration: 'none',
              flexShrink: 0,
              transition: 'all 0.15s ease',
            }}
            title="Return to All Tournaments Directory"
          >
            <ArrowLeft size={13} />
            <span className="hidden-mobile">All Tournaments</span>
          </Link>

          <Link
            to={`/${tournament.slug}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              textDecoration: 'none',
              flexShrink: 0,
            }}
            title="Tournament Public Home"
          >
            <div
              style={{
                width: '30px',
                height: '30px',
                borderRadius: '7px',
                background: 'var(--color-gold)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: 'var(--shadow-gold)',
              }}
            >
              <Layers size={16} color="#090d16" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <span
                style={{
                  fontSize: '0.92rem',
                  fontWeight: 800,
                  color: '#ffffff',
                  letterSpacing: '-0.02em',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: '220px',
                  lineHeight: 1.2,
                }}
              >
                {tournament.name}
              </span>
              {org && (
                <span
                  style={{
                    fontSize: '0.68rem',
                    color: 'var(--color-text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                  }}
                >
                  <Building2 size={10} />
                  {org.name}
                </span>
              )}
            </div>
          </Link>
        </div>

        {/* Center: Spectator Navigation Tabs */}
        <nav
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid var(--color-border-subtle)',
            borderRadius: 'var(--radius-full)',
            padding: '3px',
            gap: '3px',
          }}
          aria-label="Public tournament views"
        >
          {navItems.map(item => {
            const isActive = activeView === item.id;
            const Icon = item.icon;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => navigate(item.to)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.35rem 0.85rem',
                  borderRadius: 'var(--radius-full)',
                  fontSize: '0.78rem',
                  fontWeight: isActive ? 800 : 600,
                  background: isActive ? 'var(--color-gold-bg)' : 'transparent',
                  color: isActive ? 'var(--color-gold-bright)' : 'var(--color-text-secondary)',
                  border: isActive ? '1px solid var(--color-gold)' : '1px solid transparent',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: isActive ? '0 0 12px rgba(245, 158, 11, 0.2)' : 'none',
                }}
              >
                <Icon size={13} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Right: Actions (Share + Director Login) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexShrink: 0 }}>
          {onOpenShare && (
            <button
              type="button"
              onClick={onOpenShare}
              className="btn btn-primary"
              style={{
                padding: '0.35rem 0.75rem',
                fontSize: '0.75rem',
                gap: '0.35rem',
                borderRadius: 'var(--radius-sm)',
              }}
              title="Share live bracket with QR code & links"
            >
              <Share2 size={13} />
              <span className="hidden-mobile">Share</span>
            </button>
          )}

          {hasManageAccess ? (
            <Link
              to={defaultTierSlug ? `/${tournament.slug}/manage/bracket/${defaultTierSlug}` : `/${tournament.slug}/manage/bracket`}
              className="btn btn-secondary"
              style={{
                padding: '0.35rem 0.65rem',
                fontSize: '0.75rem',
                gap: '0.35rem',
                color: 'var(--color-gold-bright, #ffc905)',
                borderColor: 'rgba(255, 201, 5, 0.35)',
                background: 'rgba(255, 201, 5, 0.08)',
                borderRadius: 'var(--radius-sm)',
              }}
              title="Open Tournament Director Management Portal"
            >
              <Settings size={12} />
              <span>Manage</span>
            </Link>
          ) : (
            <Link
              to={`/admin?slug=${tournament.slug}&redirect=${encodeURIComponent(location.pathname)}`}
              className="btn btn-secondary"
              style={{
                padding: '0.35rem 0.65rem',
                fontSize: '0.75rem',
                gap: '0.35rem',
                color: 'var(--color-text-muted)',
                borderRadius: 'var(--radius-sm)',
              }}
              title="Staff & Director PIN Login"
            >
              <KeyRound size={12} />
              <span>Staff Login</span>
            </Link>
          )}
        </div>
      </header>

      {/* Main Page Content */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          ...contentStyle,
        }}
      >
        <ErrorBoundary fallbackTitle="Spectator View Failed to Render">
          {children}
        </ErrorBoundary>
      </div>
    </div>
  );
};
