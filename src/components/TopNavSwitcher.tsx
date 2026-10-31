import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Trophy, Building2, Users, Zap, ArrowRight, ShieldCheck, LogOut, KeyRound } from 'lucide-react';
import { useTournament } from '../features/tournament/store';
import { useOrganization } from '../features/organizations/store';
import { usePinAuth } from '../features/auth/AuthContext';
import { cn } from './ui';

export const TopNavSwitcher: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { tournaments, activeTournament, globalPlayers } = useTournament();
  const { organizations } = useOrganization();
  const { isSystemAdmin, session, logout } = usePinAuth();

  const isTournaments = location.pathname === '/' || location.pathname.startsWith('/tournaments');
  const isOrganizations = location.pathname.startsWith('/organizations') || location.pathname.startsWith('/org/');
  const isPlayers = location.pathname.startsWith('/players');

  const isTournamentAdmin = session?.role === 'TOURNAMENT_ADMIN';
  const showAdminNav = isSystemAdmin || isTournamentAdmin;

  const navTabs = [
    {
      to: '/',
      label: 'Tournaments',
      icon: Trophy,
      count: tournaments.length,
      isActive: isTournaments,
      show: true,
    },
    {
      to: '/organizations',
      label: 'Organizations',
      icon: Building2,
      count: organizations.length,
      isActive: isOrganizations,
      show: isSystemAdmin,
    },
    {
      to: '/players',
      label: 'Players',
      icon: Users,
      count: globalPlayers ? globalPlayers.length : 0,
      isActive: isPlayers,
      show: isSystemAdmin || isTournamentAdmin,
    },
  ].filter(tab => tab.show);

  const handleLogout = () => {
    logout();
    navigate('/', { replace: true });
  };

  return (
    <header className="sticky top-0 z-1000 flex w-full items-center justify-center border-b border-line-subtle bg-canvas/85 px-6 py-3 backdrop-blur-md">
      <div className="relative flex w-full max-w-295 items-center justify-between">
        {/* Left: Brand / Switcher Home Link */}
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-base font-extrabold tracking-tight text-fg no-underline"
        >
          <Trophy size={18} color="var(--color-gold-bright, #ffc905)" />
          <span>
            MATCH<span className="text-gold-bright">FOUNDRY</span>
            <sup className="ml-px text-3xs text-gold-bright">™</sup>
          </span>
        </Link>

        {/* Center: Global Navigation Pills (Restricted to Authenticated Admins) */}
        {showAdminNav ? (
          <nav
            aria-label="Global System Navigation"
            className={cn(
              'mx-auto grid w-full items-center gap-1 rounded-full border border-line bg-elevated p-1 shadow-[0_4px_14px_rgba(0,0,0,0.35)]',
              navTabs.length === 2 ? 'max-w-90' : 'max-w-130'
            )}
            style={{ gridTemplateColumns: `repeat(${navTabs.length}, minmax(0, 1fr))` }}
          >
            {navTabs.map(tab => {
              const Icon = tab.icon;
              return (
                <Link
                  key={tab.to}
                  to={tab.to}
                  className={cn(
                    'inline-flex items-center justify-center gap-2 rounded-full px-3 py-2 text-sm whitespace-nowrap no-underline transition-all duration-200',
                    tab.isActive
                      ? 'bg-gold-bright font-bold text-canvas shadow-[0_2px_8px_rgba(255,201,5,0.4)]'
                      : 'bg-transparent font-medium text-fg-secondary shadow-none'
                  )}
                >
                  <Icon size={16} className="shrink-0" />
                  <span>{tab.label}</span>
                  {tab.count !== null && (
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-2xs font-bold',
                        tab.isActive ? 'bg-black/20 text-canvas' : 'bg-white/8 text-fg-muted'
                      )}
                    >
                      {tab.count}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        ) : (
          <div className="flex-1" />
        )}

        {/* Right: Auth Controls (Login / Log Out & Role Indicator) */}
        <div className="flex items-center gap-2.5">
          {/* Active Tournament Quick-Return Teleport Chip (if applicable) */}
          {activeTournament && (
            <Link
              to={activeTournament.isLocked && activeTournament.tiers?.length
                ? `/${activeTournament.slug}/manage/bracket/${activeTournament.tiers[0].slug}`
                : `/${activeTournament.slug}/manage/qualifiers`}
              className="inline-flex items-center gap-2 rounded-full border border-tier-gold/30 bg-tier-gold/10 px-3 py-1.5 text-caption font-bold text-gold-bright no-underline transition-all duration-200"
              title={`Return to active tournament: ${activeTournament.name}`}
            >
              <Zap size={12} color="var(--color-gold-bright, #ffc905)" className="shrink-0" />
              <span className="max-w-35 truncate">{activeTournament.name}</span>
              <ArrowRight size={12} color="var(--color-gold-bright, #ffc905)" className="shrink-0" />
            </Link>
          )}

          {/* Role Status & Log Out Button */}
          {session ? (
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold',
                  isSystemAdmin
                    ? 'border-sky-400/40 bg-sky-400/15 text-sky-400'
                    : 'border-gold/40 bg-gold/15 text-gold-bright'
                )}
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
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-line bg-white/6 px-2.5 py-1 text-xs font-semibold text-fg-secondary transition-all duration-150"
                title="Log out and reset session to public spectator"
              >
                <LogOut size={12} />
                <span>Log Out</span>
              </button>
            </div>
          ) : (
            <Link
              to="/admin"
              className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white/5 px-3 py-1.5 text-caption font-semibold text-fg-secondary no-underline transition-all duration-150"
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
