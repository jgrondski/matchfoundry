import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Trophy, Building2, Users, Zap, ArrowRight, ShieldCheck, LogOut, KeyRound } from 'lucide-react';
import { useTournament } from '../features/tournament/store';
import { useOrganization } from '../features/organizations/store';
import { usePinAuth } from '../features/auth/AuthContext';

export const TopNavSwitcher: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { tournaments, activeTournament, globalPlayers } = useTournament();
  const { organizations } = useOrganization();
  const { isSystemAdmin, session, logout } = usePinAuth();

  const isTournaments = location.pathname === '/' || location.pathname.startsWith('/tournaments');
  const isOrganizations = location.pathname.startsWith('/organizations') || location.pathname.startsWith('/org/');
  const isPlayers = location.pathname.startsWith('/players');

  const navTabs = [
    {
      to: '/',
      label: 'Tournaments',
      icon: Trophy,
      count: tournaments.length,
      isActive: isTournaments,
    },
    {
      to: '/organizations',
      label: 'Organizations',
      icon: Building2,
      count: organizations.length,
      isActive: isOrganizations,
    },
    {
      to: '/players',
      label: 'Players',
      icon: Users,
      count: globalPlayers ? globalPlayers.length : 0,
      isActive: isPlayers,
    },
  ];

  const handleLogout = () => {
    logout();
    navigate('/', { replace: true });
  };

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0.75rem 1.5rem',
        background: 'rgba(9, 13, 22, 0.85)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--color-border-subtle, rgba(255,255,255,0.06))',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '1180px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'relative',
          boxSizing: 'border-box',
        }}
      >
        {/* Left: Brand / Switcher Home Link */}
        <Link
          to="/"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            textDecoration: 'none',
            color: 'var(--color-text-primary, #ffffff)',
            fontWeight: 800,
            fontSize: '1rem',
            letterSpacing: '-0.02em',
          }}
        >
          <Trophy size={18} color="var(--color-gold-bright, #ffc905)" />
          <span>
            MATCH<span style={{ color: 'var(--color-gold-bright, #ffc905)' }}>FOUNDRY</span>
            <sup style={{ fontSize: '0.65em', marginLeft: '1px', color: 'var(--color-gold-bright, #ffc905)' }}>™</sup>
          </span>
        </Link>

        {/* Center: Global Navigation Pills (Strictly restricted to System Admin) */}
        {isSystemAdmin ? (
          <nav
            aria-label="Global System Navigation"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
              alignItems: 'center',
              padding: '0.3rem',
              background: 'var(--color-bg-surface-elevated, #161922)',
              borderRadius: 'var(--radius-full, 9999px)',
              border: '1px solid var(--color-border, rgba(255,255,255,0.1))',
              boxShadow: '0 4px 14px rgba(0, 0, 0, 0.35)',
              gap: '0.25rem',
              width: '100%',
              maxWidth: '520px',
              margin: '0 auto',
              boxSizing: 'border-box',
            }}
          >
            {navTabs.map(tab => {
              const Icon = tab.icon;
              return (
                <Link
                  key={tab.to}
                  to={tab.to}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    padding: '0.45rem 0.75rem',
                    borderRadius: 'var(--radius-full, 9999px)',
                    fontSize: '0.85rem',
                    fontWeight: tab.isActive ? 700 : 500,
                    color: tab.isActive ? '#090d16' : 'var(--color-text-secondary, #94a3b8)',
                    background: tab.isActive
                      ? 'var(--color-gold-bright, #ffc905)'
                      : 'transparent',
                    textDecoration: 'none',
                    transition: 'all 0.18s ease',
                    boxShadow: tab.isActive ? '0 2px 8px rgba(255, 201, 5, 0.4)' : 'none',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <Icon size={16} color={tab.isActive ? '#090d16' : 'currentColor'} style={{ flexShrink: 0 }} />
                  <span>{tab.label}</span>
                  {tab.count !== null && (
                    <span
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        padding: '0.1rem 0.45rem',
                        borderRadius: 'var(--radius-full, 9999px)',
                        background: tab.isActive ? 'rgba(0, 0, 0, 0.2)' : 'rgba(255, 255, 255, 0.08)',
                        color: tab.isActive ? '#090d16' : 'var(--color-text-muted, #64748b)',
                      }}
                    >
                      {tab.count}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        ) : (
          <div style={{ flex: 1 }} />
        )}

        {/* Right: Auth Controls (Login / Log Out & Role Indicator) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          {/* Active Tournament Quick-Return Teleport Chip (if applicable) */}
          {activeTournament && (
            <Link
              to={activeTournament.isLocked && activeTournament.tiers?.length
                ? `/${activeTournament.slug}/manage/bracket/${activeTournament.tiers[0].slug}`
                : `/${activeTournament.slug}/manage/qualifiers`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.35rem 0.75rem',
                borderRadius: 'var(--radius-full, 9999px)',
                background: 'rgba(255, 201, 5, 0.1)',
                border: '1px solid rgba(255, 201, 5, 0.3)',
                color: 'var(--color-gold-bright, #ffc905)',
                fontSize: '0.78rem',
                fontWeight: 700,
                textDecoration: 'none',
                transition: 'all 0.18s ease',
              }}
              title={`Return to active tournament: ${activeTournament.name}`}
            >
              <Zap size={12} color="var(--color-gold-bright, #ffc905)" style={{ flexShrink: 0 }} />
              <span
                style={{
                  maxWidth: '140px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {activeTournament.name}
              </span>
              <ArrowRight size={12} color="var(--color-gold-bright, #ffc905)" style={{ flexShrink: 0 }} />
            </Link>
          )}

          {/* Role Status & Log Out Button */}
          {session ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.3rem 0.65rem',
                  borderRadius: 'var(--radius-full, 9999px)',
                  background: isSystemAdmin ? 'rgba(56, 189, 248, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                  border: isSystemAdmin ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid rgba(245, 158, 11, 0.4)',
                  color: isSystemAdmin ? '#38bdf8' : 'var(--color-gold-bright, #ffc905)',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                }}
                title={
                  isSystemAdmin
                    ? 'Authenticated with System Admin Key'
                    : session.tournamentSlugs && session.tournamentSlugs.length > 1
                    ? `Authenticated with Tournament Admin PIN (${session.tournamentSlugs.join(', ')})`
                    : `Authenticated with Tournament Admin PIN (${session.tournamentSlug || 'Scoped'})`
                }
              >
                <ShieldCheck size={12} />
                <span>
                  {isSystemAdmin
                    ? 'System Admin'
                    : session.tournamentSlugs && session.tournamentSlugs.length > 1
                    ? `Admin: ${session.tournamentSlugs.length} Tournaments`
                    : `Admin: ${session.tournamentSlug || 'Tournament'}`}
                </span>
              </span>

              <button
                type="button"
                onClick={handleLogout}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.3rem 0.65rem',
                  borderRadius: 'var(--radius-full, 9999px)',
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid var(--color-border, rgba(255,255,255,0.15))',
                  color: 'var(--color-text-secondary, #94a3b8)',
                  fontSize: '0.74rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                title="Log out and reset session to public spectator"
              >
                <LogOut size={12} />
                <span>Log Out</span>
              </button>
            </div>
          ) : (
            <Link
              to="/admin"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.35rem 0.8rem',
                borderRadius: 'var(--radius-full, 9999px)',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--color-border, rgba(255,255,255,0.12))',
                color: 'var(--color-text-secondary, #94a3b8)',
                fontSize: '0.78rem',
                fontWeight: 600,
                textDecoration: 'none',
                transition: 'all 0.15s ease',
              }}
              title="Staff & Organizer Login"
            >
              <KeyRound size={13} color="var(--color-gold-bright, #ffc905)" />
              <span>Staff Login</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
};
