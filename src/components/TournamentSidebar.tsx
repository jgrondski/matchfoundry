import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Tournament, TournamentTier } from '../features/tournament/types';
import { useTournament } from '../features/tournament/store';
import { useOrganization } from '../features/organizations/store';
import { getStoredTierSlug } from '../features/tournament/tierStorage';
import { VerifyBracketModal } from '../features/tournament/components/VerifyBracketModal';
import { countPendingReviewSessions } from '../features/online-quals/sessionDerivation';
import { TournamentQualTimerHud } from '../features/qualifiers/components/TournamentQualTimerHud';
import {
  Layers,
  ChevronDown,
  Trophy,
  BarChart3,
  Sheet,
  GitBranch,
  Scale,
  Video,
  Users,
  Settings,
  Globe2,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  AlertTriangle,
  Check,
  CheckCircle2,
  Building2,
  Search,
  ExternalLink,
  KeyRound,
  LogOut,
} from 'lucide-react';
import { usePinAuth } from '../features/auth/AuthContext';
import { AdminLoginModal } from '../features/auth/AdminLoginModal';
import { cn, IconButton } from './ui';

export type SidebarNavView =
  | 'leaderboard'
  | 'standings'
  | 'sheet'
  | 'bracket'
  | 'judge'
  | 'review'
  | 'obs'
  | 'players'
  | 'settings'
  | 'globalPlayers'
  | 'organizations'
  | 'tournaments';

export function filterTournamentsByQuery(tournaments: Tournament[], query: string): Tournament[] {
  const seenIds = new Set<string>();
  const uniqueTournaments: Tournament[] = [];
  for (const t of tournaments) {
    if (t?.id && !seenIds.has(t.id)) {
      seenIds.add(t.id);
      uniqueTournaments.push(t);
    }
  }
  if (!query.trim()) return uniqueTournaments;
  const q = query.toLowerCase().trim();
  return uniqueTournaments.filter(t => t.name.toLowerCase().includes(q) || t.slug.toLowerCase().includes(q));
}

export function getTournamentTargetUrl(targetTourney: Tournament, view?: SidebarNavView, isManage: boolean = true): string {
  const storedTier = getStoredTierSlug(targetTourney.slug);
  const tierSlug =
    storedTier && targetTourney.tiers?.some(t => t.slug === storedTier)
      ? storedTier
      : targetTourney.tiers?.[0]?.slug;

  if (isManage) {
    switch (view) {
      case 'standings':
        return `/${targetTourney.slug}/manage/standings`;
      case 'sheet':
        return tierSlug ? `/${targetTourney.slug}/manage/sheet?tier=${tierSlug}` : `/${targetTourney.slug}/manage/sheet`;
      case 'bracket':
        return tierSlug ? `/${targetTourney.slug}/manage/bracket/${tierSlug}` : `/${targetTourney.slug}/manage/bracket`;
      case 'judge':
        return tierSlug ? `/${targetTourney.slug}/manage/judge?tier=${tierSlug}` : `/${targetTourney.slug}/manage/judge`;
      case 'review':
        return `/${targetTourney.slug}/manage/review`;
      case 'obs':
        return `/${targetTourney.slug}/obs`;
      case 'players':
        return `/${targetTourney.slug}/manage/players`;
      case 'settings':
        return `/${targetTourney.slug}/manage/settings`;
      case 'leaderboard':
      default:
        return `/${targetTourney.slug}/manage/qualifiers`;
    }
  }

  // Public Spectator Target URLs
  switch (view) {
    case 'standings':
      return `/${targetTourney.slug}/standings`;
    case 'sheet':
    case 'judge':
    case 'players':
    case 'settings':
    case 'bracket':
      return tierSlug ? `/${targetTourney.slug}/${tierSlug}` : `/${targetTourney.slug}/brackets`;
    case 'obs':
      return `/${targetTourney.slug}/obs`;
    case 'leaderboard':
    default:
      return `/${targetTourney.slug}/leaderboard`;
  }
}

interface TournamentSidebarProps {
  tournament?: Tournament;
  activeTier?: TournamentTier;
  activeView?: SidebarNavView;
  onNavigate?: (url: string) => boolean | void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const TournamentSidebar: React.FC<TournamentSidebarProps> = ({
  tournament,
  activeTier,
  activeView,
  onNavigate,
  isCollapsed: controlledIsCollapsed,
  onToggleCollapse,
}) => {
  const { tournaments, unlockBrackets, setActiveTournamentId, isDbConnected, retryConnection } = useTournament();
  const { getOrganizationById } = useOrganization();
  const navigate = useNavigate();

  // Internal collapse state with localStorage persistence if not controlled externally
  const [internalCollapsed, setInternalCollapsed] = useState<boolean>(() => {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('tm_sidebar_collapsed') === 'true';
    }
    return false;
  });

  const isCollapsed = controlledIsCollapsed !== undefined ? controlledIsCollapsed : internalCollapsed;

  const handleToggle = () => {
    if (onToggleCollapse) {
      onToggleCollapse();
    } else {
      const nextState = !isCollapsed;
      setInternalCollapsed(nextState);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('tm_sidebar_collapsed', String(nextState));
      }
    }
  };

  const [isTournamentMenuOpen, setIsTournamentMenuOpen] = useState(false);
  const [tournamentSearchQuery, setTournamentSearchQuery] = useState('');
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);

  const activeTourney = tournament || tournaments[0];
  const slug = activeTourney?.slug;
  const storedTierSlug = slug ? getStoredTierSlug(slug) : null;
  const currentTierSlug =
    activeTier?.slug ||
    (storedTierSlug && activeTourney?.tiers.some(t => t.slug === storedTierSlug)
      ? storedTierSlug
      : activeTourney?.tiers[0]?.slug);
  const currentOrg = activeTourney?.organizationId ? getOrganizationById(activeTourney.organizationId) : undefined;

  const { isSystemAdmin, canManage, logout } = usePinAuth();
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const isAuthorized = slug ? canManage(slug) : isSystemAdmin;

  useEffect(() => {
    if (activeTourney?.id) {
      setActiveTournamentId(activeTourney.id);
    }
  }, [activeTourney?.id, setActiveTournamentId]);

  const handleLinkClick = (e: React.MouseEvent, url: string) => {
    if (url.includes('/manage') && !canManage(slug)) {
      e.preventDefault();
      setIsAdminModalOpen(true);
      return;
    }
    if (url === '/organizations' && !isSystemAdmin) {
      e.preventDefault();
      setIsAdminModalOpen(true);
      return;
    }
    if (url === '/players' && !(isAuthorized || isSystemAdmin)) {
      e.preventDefault();
      setIsAdminModalOpen(true);
      return;
    }
    if (onNavigate) {
      const allowed = onNavigate(url);
      if (allowed === false) {
        e.preventDefault();
      }
    }
  };

  const handleDropdownNavigate = (url: string) => {
    if (onNavigate) {
      const allowed = onNavigate(url);
      if (allowed === false) {
        setIsTournamentMenuOpen(false);
        return;
      }
    }
    setIsTournamentMenuOpen(false);
    setTournamentSearchQuery('');
    navigate(url);
  };

  const [isUnlocking, setIsUnlocking] = useState(false);

  const handleUnlockClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!activeTourney || isUnlocking) return;
    setIsUnlocking(true);
    try {
      const res = await unlockBrackets(activeTourney.id);
      if (!res.success && res.error) {
        setUnlockError(res.error);
      } else {
        setUnlockError(null);
      }
    } finally {
      setIsUnlocking(false);
    }
  };

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-tournament-menu]')) {
        setIsTournamentMenuOpen(false);
        setTournamentSearchQuery('');
      }
    };
    if (isTournamentMenuOpen) {
      document.addEventListener('click', handleClickOutside);
    }
    return () => document.removeEventListener('click', handleClickOutside);
  }, [isTournamentMenuOpen]);

  const pendingReviewCount = useMemo(
    () => countPendingReviewSessions(activeTourney),
    [activeTourney]
  );

  const navItems = [
    {
      key: 'leaderboard' as const,
      label: activeTourney?.seedingMethod === 'MANUAL' ? 'Seeding' : 'Qualifiers',
      icon: BarChart3,
      to: slug ? (isAuthorized ? `/${slug}/manage/qualifiers` : `/${slug}/leaderboard`) : '/',
      badge: null,
    },
    {
      key: 'standings' as const,
      label: 'Standings',
      icon: Trophy,
      to: slug ? (isAuthorized ? `/${slug}/manage/standings` : `/${slug}/standings`) : '/',
      badge: null,
    },
    {
      key: 'sheet' as const,
      label: 'Master Sheet',
      icon: Sheet,
      to: slug ? (currentTierSlug ? `/${slug}/manage/sheet?tier=${currentTierSlug}` : `/${slug}/manage/sheet`) : '/',
      badge: !isAuthorized ? '🔒' : null,
    },
    {
      key: 'bracket' as const,
      label: 'Brackets',
      icon: GitBranch,
      to: slug
        ? isAuthorized
          ? (currentTierSlug ? `/${slug}/manage/bracket/${currentTierSlug}` : `/${slug}/manage/bracket`)
          : (currentTierSlug ? `/${slug}/${currentTierSlug}` : `/${slug}/brackets`)
        : '/',
      badge: activeTourney?.tiers.length ? `${activeTourney.tiers.length} Tiers` : null,
    },
    {
      key: 'judge' as const,
      label: 'Floor Judge',
      icon: Scale,
      to: slug ? (currentTierSlug ? `/${slug}/manage/judge?tier=${currentTierSlug}` : `/${slug}/manage/judge`) : '/',
      badge: !isAuthorized ? '🔒' : null,
    },
    {
      key: 'review' as const,
      label: pendingReviewCount > 0 ? `Qual Review (${pendingReviewCount})` : 'Qual Review',
      icon: CheckCircle2,
      to: slug ? (isAuthorized ? `/${slug}/manage/review` : `/${slug}/manage/review`) : '/',
      badge: !isAuthorized
        ? '🔒'
        : pendingReviewCount > 0
        ? String(pendingReviewCount)
        : null,
    },
    {
      key: 'obs' as const,
      label: 'OBS Hub',
      icon: Video,
      to: slug ? `/${slug}/obs` : '/',
      badge: null,
    },
    {
      key: 'players' as const,
      label: 'Players',
      icon: Users,
      to: slug ? `/${slug}/manage/players` : '/',
      badge: !isAuthorized ? '🔒' : (activeTourney?.playersPool?.length ? String(activeTourney.playersPool.length) : null),
    },
    {
      key: 'settings' as const,
      label: 'Settings',
      icon: Settings,
      to: slug ? `/${slug}/manage/settings` : '/',
      badge: !isAuthorized ? '🔒' : null,
    },
  ];

  const manageableTournaments = tournaments.filter(
    t => isSystemAdmin || canManage(t.slug) || canManage(t.id)
  );
  const filteredTournaments = filterTournamentsByQuery(manageableTournaments, tournamentSearchQuery);

  // Shared classes for the main nav and system links.
  const sideLinkClass = (isActive: boolean) =>
    cn(
      'flex items-center gap-2.5 rounded-sm border-l-3 py-2 text-caption no-underline transition-colors duration-100',
      isCollapsed ? 'justify-center px-0' : 'justify-start px-3',
      isActive
        ? 'border-l-gold-bright bg-gold-soft font-bold text-gold-bright'
        : 'border-l-transparent bg-transparent font-medium text-fg-secondary'
    );
  const sideButtonClass = cn(
    'flex w-full cursor-pointer items-center gap-2.5 rounded-sm border-0 bg-white/3 py-2 text-left text-caption font-semibold',
    isCollapsed ? 'justify-center px-0' : 'justify-start px-3'
  );
  const statusPillClass = cn(
    'flex w-full items-center gap-1.5 rounded-full border text-2xs font-bold transition-all duration-150',
    isCollapsed ? 'px-1 py-1.5' : 'px-2 py-1'
  );
  const quickHopLinkClass =
    'flex items-center gap-2 rounded-sm px-2 py-1.5 text-xs font-semibold text-fg-secondary no-underline';
  const sectionLabelClass = 'pb-1 text-3xs font-bold tracking-wider text-fg-muted uppercase';

  return (
    <>
      <aside
        className={cn(
          'sticky top-0 z-90 flex h-screen flex-col overflow-x-hidden overflow-y-auto border-r border-line bg-surface transition-[width,min-width] duration-200 select-none',
          isCollapsed ? 'w-15 min-w-15' : 'w-55 min-w-55'
        )}
      >
        {/* Brand Header */}
        <div
          className={cn(
            'flex items-center gap-2.5 border-b border-line-subtle py-3.5',
            isCollapsed ? 'justify-center px-2' : 'justify-start px-4'
          )}
        >
          <Link
            to="/"
            onClick={e => handleLinkClick(e, '/')}
            className="flex items-center gap-2 overflow-hidden no-underline"
            title="MatchFoundry™ Home"
          >
            <div className="flex size-7 shrink-0 items-center justify-center rounded-sm bg-gold shadow-gold">
              <Layers size={16} color="#090d16" />
            </div>
            {!isCollapsed && (
              <span className="text-sm leading-tight font-extrabold tracking-tight whitespace-nowrap text-fg">
                MATCH<span className="text-gold-bright">FOUNDRY</span>
                <sup className="ml-px text-3xs text-gold-bright">™</sup>
              </span>
            )}
          </Link>
        </div>

        {/* DB Offline Indicator */}
        {!isDbConnected && (
          <div
            onClick={() => retryConnection()}
            className={cn(
              'flex cursor-pointer items-center gap-1.5 border-b border-red/40 bg-red/18 py-1.5 text-2xs font-bold text-red-bright',
              isCollapsed ? 'justify-center px-1' : 'justify-start px-3'
            )}
            title="PostgreSQL Offline! Click to retry connection."
          >
            <span className="size-1.5 shrink-0 rounded-full bg-red" />
            {!isCollapsed && <span>DB OFFLINE (RETRY)</span>}
          </div>
        )}

        {/* Tournament Switcher & Mode Pill */}
        {activeTourney && (
          <div
            className={cn('relative border-b border-line-subtle bg-black/15 py-2.5', isCollapsed ? 'px-1.5' : 'px-3')}
            data-tournament-menu
          >
            {/* Org Shortcut Chip */}
            {currentOrg && !isCollapsed && (
              <div className="mb-1.5 flex items-center justify-between px-0.5">
                <Link
                  to={`/org/${currentOrg.slug}`}
                  onClick={e => handleLinkClick(e, `/org/${currentOrg.slug}`)}
                  className="inline-flex min-w-0 items-center gap-1.5 no-underline"
                  title={`View Organization: ${currentOrg.name}`}
                >
                  <Building2 size={11} color="var(--color-gold-bright, #ffc905)" />
                  <span className="truncate text-2xs font-bold tracking-wide text-gold-bright uppercase">
                    {currentOrg.shortName || currentOrg.slug.toUpperCase()}
                  </span>
                </Link>
                <Link
                  to={`/org/${currentOrg.slug}`}
                  onClick={e => handleLinkClick(e, `/org/${currentOrg.slug}`)}
                  className="text-3xs font-semibold text-fg-muted no-underline"
                  title={`View ${currentOrg.name} Dashboard`}
                >
                  Org Hub ↗
                </Link>
              </div>
            )}

            {/* Tournament Selector Dropdown Button */}
            <button
              type="button"
              onClick={() => setIsTournamentMenuOpen(prev => !prev)}
              className={cn(
                'flex w-full cursor-pointer items-center overflow-hidden rounded-sm border border-line bg-canvas px-2 py-1.5 text-left text-caption font-semibold text-fg',
                isCollapsed ? 'justify-center' : 'justify-between'
              )}
              title={activeTourney.name}
            >
              <span className={cn('truncate', isCollapsed ? 'hidden' : 'block')}>{activeTourney.name}</span>
              {isCollapsed ? (
                <span className="text-xs font-extrabold text-gold-bright">
                  {activeTourney.name.substring(0, 2).toUpperCase()}
                </span>
              ) : (
                <ChevronDown size={13} color="var(--color-text-muted)" className="ml-1 shrink-0" />
              )}
            </button>

            {/* Upgraded Workspace & Context Dropdown Menu */}
            {isTournamentMenuOpen && (
              <div
                data-testid="tournament-dropdown-menu"
                className={cn(
                  'absolute top-full z-200 mt-1.5 w-65 overflow-hidden rounded-md border border-line bg-elevated shadow-[0_12px_30px_rgba(0,0,0,0.65)]',
                  isCollapsed ? 'left-15' : 'left-3'
                )}
              >
                {/* 1. Circuit / Org Header */}
                {currentOrg && (
                  <div className="flex items-center justify-between gap-2 border-b border-line-subtle bg-white/3 px-3.5 py-2.5">
                    <div className="flex min-w-0 items-center gap-2">
                      <Building2 size={13} color="var(--color-gold-bright, #ffc905)" className="shrink-0" />
                      <span className="truncate text-xs font-bold text-white">{currentOrg.name}</span>
                    </div>
                    <Link
                      to={`/org/${currentOrg.slug}`}
                      onClick={e => {
                        setIsTournamentMenuOpen(false);
                        handleLinkClick(e, `/org/${currentOrg.slug}`);
                      }}
                      className="shrink-0 text-2xs font-semibold text-gold-bright no-underline"
                      title="Open Organization Dashboard"
                    >
                      Org Hub →
                    </Link>
                  </div>
                )}

                {/* 2. Switch Tournament List & Search */}
                <div className="flex items-center justify-between px-3.5 pt-2 pb-1 text-3xs font-extrabold tracking-wider text-fg-muted uppercase">
                  <span>Tournaments ({manageableTournaments.length})</span>
                  {tournamentSearchQuery && (
                    <span className="text-3xs text-gold-bright">Filtered ({filteredTournaments.length})</span>
                  )}
                </div>

                {/* Search input field */}
                <div className="px-2.5 pt-1 pb-2">
                  <div className="flex items-center gap-1.5 rounded-sm border border-line bg-black/35 px-2 py-1">
                    <Search size={12} color="var(--color-text-muted, #94a3b8)" className="shrink-0" />
                    <input
                      type="text"
                      value={tournamentSearchQuery}
                      onChange={e => setTournamentSearchQuery(e.target.value)}
                      placeholder="Search tournaments..."
                      className="w-full border-0 bg-transparent text-xs text-white outline-none"
                    />
                    {tournamentSearchQuery && (
                      <IconButton
                        aria-label="Clear search"
                        onClick={() => setTournamentSearchQuery('')}
                        className="px-1 py-0 text-xs"
                      >
                        ✕
                      </IconButton>
                    )}
                  </div>
                </div>

                <div className="max-h-45 overflow-y-auto">
                  {filteredTournaments.length === 0 ? (
                    <div className="p-3 text-center text-xs text-fg-muted">No tournaments found</div>
                  ) : (
                    filteredTournaments.map(t => {
                      const isSelected = Boolean(activeTourney?.id && t.id === activeTourney.id);
                      const nameCount = filteredTournaments.filter(other => other.name.toLowerCase() === t.name.toLowerCase()).length;
                      const displayName = nameCount > 1 ? `${t.name} (${t.slug})` : t.name;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => {
                            const targetUrl = getTournamentTargetUrl(t, activeView);
                            handleDropdownNavigate(targetUrl);
                          }}
                          className={cn(
                            'flex w-full cursor-pointer items-center justify-between border-0 px-3.5 py-2 text-left text-caption transition-colors duration-100',
                            isSelected ? 'bg-tier-gold/10 font-bold text-gold-bright' : 'bg-transparent font-medium text-fg'
                          )}
                        >
                          <span className="truncate">{displayName}</span>
                          {isSelected && <Check size={13} color="var(--color-gold-bright, #ffc905)" className="shrink-0" />}
                        </button>
                      );
                    })
                  )}
                </div>

                {/* 3. Global Views Quick-Hop */}
                <div className="flex flex-col gap-0.5 border-t border-line-subtle bg-black/15 p-1.5">
                  <div className="px-2 py-1 text-3xs font-extrabold tracking-wider text-fg-muted uppercase">
                    Global Navigation
                  </div>
                  <Link
                    to="/"
                    onClick={e => {
                      setIsTournamentMenuOpen(false);
                      handleLinkClick(e, '/');
                    }}
                    className={quickHopLinkClass}
                  >
                    <Trophy size={13} />
                    <span>All Tournaments</span>
                  </Link>
                  {isSystemAdmin && (
                    <Link
                      to="/organizations"
                      onClick={e => {
                        setIsTournamentMenuOpen(false);
                        handleLinkClick(e, '/organizations');
                      }}
                      className={quickHopLinkClass}
                    >
                      <Building2 size={13} />
                      <span>Organizations Directory</span>
                    </Link>
                  )}
                  {(isSystemAdmin || isAuthorized) && (
                    <Link
                      to="/players"
                      onClick={e => {
                        setIsTournamentMenuOpen(false);
                        handleLinkClick(e, '/players');
                      }}
                      className={quickHopLinkClass}
                    >
                      <Users size={13} />
                      <span>Global Player Directory</span>
                    </Link>
                  )}
                </div>
              </div>
            )}

            {/* Tournament Mode Status Pill */}
            <div className="mt-2">
              {!activeTourney.isLocked ? (
                <button
                  type="button"
                  onClick={() => setIsVerifyModalOpen(true)}
                  className={cn(
                    statusPillClass,
                    'cursor-pointer border-gold/35 bg-gold/15 text-gold-bright',
                    isCollapsed ? 'justify-center' : 'justify-start'
                  )}
                  title="Qualifiers running (Draft preview). Click to lock brackets and start match play."
                >
                  <AlertTriangle size={11} color="var(--color-gold-bright)" className="shrink-0" />
                  {!isCollapsed && (
                    <span className="truncate">
                      {activeTourney.seedingMethod === 'MANUAL' ? 'Seeding (Lock)' : 'Quals Mode (Lock)'}
                    </span>
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleUnlockClick}
                  disabled={isUnlocking}
                  className={cn(
                    statusPillClass,
                    'border-sky-400/35 bg-sky-400/15 text-sky-400',
                    isCollapsed ? 'justify-center' : 'justify-start',
                    isUnlocking ? 'cursor-not-allowed opacity-70' : 'cursor-pointer opacity-100'
                  )}
                  title="Match play in progress (Locked). Click to unlock back to Qualifiers."
                >
                  {isUnlocking ? (
                    <div className="size-2.5 shrink-0 animate-spin rounded-full border-[1.5px] border-sky-400/30 border-t-sky-400" />
                  ) : (
                    <ShieldCheck size={11} color="#38bdf8" className="shrink-0" />
                  )}
                  {!isCollapsed && (
                    <span className="truncate">{isUnlocking ? 'Unlocking...' : 'Match Play (Unlock)'}</span>
                  )}
                </button>
              )}
            </div>

            {/* Public Spectator View Shortcut for Directors */}
            <div className="mt-1.5">
              <Link
                to={slug ? (currentTierSlug ? `/${slug}/${currentTierSlug}` : `/${slug}/brackets`) : '/'}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  statusPillClass,
                  'border-line-subtle bg-white/4 font-semibold text-fg-secondary no-underline',
                  isCollapsed ? 'justify-center' : 'justify-between'
                )}
                title="Open live public spectator view in new tab"
              >
                <div className="flex items-center gap-1.5">
                  <ExternalLink size={11} color="var(--color-gold-bright)" className="shrink-0" />
                  {!isCollapsed && <span>Public View</span>}
                </div>
                {!isCollapsed && <span className="text-3xs text-fg-muted">↗</span>}
              </Link>
            </div>

            {/* Consolidated Admin Qual Timer HUD */}
            <div className="mt-2">
              <TournamentQualTimerHud
                tournament={activeTourney}
                sidebar={true}
                isCollapsed={isCollapsed}
              />
            </div>
          </div>
        )}

        {/* Section Label: Tournament Views */}
        {!isCollapsed && <div className={cn(sectionLabelClass, 'px-4 pt-2.5')}>Tournament</div>}

        {/* Navigation Items */}
        <nav className="flex flex-1 flex-col gap-1 p-1.5">
          {navItems.map(item => {
            const isActive = activeView === item.key;
            const Icon = item.icon;

            return (
              <Link
                key={item.key}
                to={item.to}
                onClick={e => handleLinkClick(e, item.to)}
                className={cn(sideLinkClass(isActive), 'relative')}
                title={item.label}
              >
                <Icon size={16} className="shrink-0" />
                {!isCollapsed && <span className="flex-1 truncate">{item.label}</span>}
                {!isCollapsed && item.badge && (
                  <span className="rounded-full bg-white/8 px-1.5 py-0.5 text-3xs font-bold text-fg-muted">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Global / System Divider & Navigation */}
        <div className="border-t border-line-subtle p-1.5">
          {!isCollapsed && <div className={cn(sectionLabelClass, 'px-2 pt-2')}>System</div>}

          {/* All Tournaments */}
          <Link
            to="/"
            onClick={e => handleLinkClick(e, '/')}
            className={sideLinkClass(activeView === 'tournaments')}
            title="All Tournaments"
          >
            <Trophy size={16} className="shrink-0" />
            {!isCollapsed && <span className="flex-1 truncate">Tournaments</span>}
          </Link>

          {/* Organizations Directory (System Admin Only) */}
          {isSystemAdmin && (
            <Link
              to="/organizations"
              onClick={e => handleLinkClick(e, '/organizations')}
              className={sideLinkClass(activeView === 'organizations')}
              title="Organizations Directory"
            >
              <Building2 size={16} className="shrink-0" />
              {!isCollapsed && <span className="flex-1 truncate">Organizations</span>}
            </Link>
          )}

          {/* Global Player Pool (System Admin or Authorized Tournament Admin) */}
          {(isSystemAdmin || isAuthorized) && (
            <Link
              to="/players"
              onClick={e => handleLinkClick(e, '/players')}
              className={sideLinkClass(activeView === 'globalPlayers')}
              title="Global Player Pool"
            >
              <Globe2 size={16} className="shrink-0" />
              {!isCollapsed && <span className="flex-1 truncate">Global Players</span>}
            </Link>
          )}

          {/* Admin Role Status / Log Out / Admin Login Shortcut */}
          <div className="mt-1.5 border-t border-line-subtle pt-1.5">
            {isAuthorized ? (
              <button
                type="button"
                onClick={() => {
                  logout();
                  if (window.location.pathname.includes('/manage')) {
                    navigate(slug ? `/${slug}/brackets` : '/');
                  }
                }}
                className={cn(sideButtonClass, isSystemAdmin ? 'text-sky-400' : 'text-gold-bright')}
                title={`Logged in as ${isSystemAdmin ? 'System Admin' : 'Tournament Admin'}. Click to Log Out.`}
              >
                <LogOut size={16} className="shrink-0" />
                {!isCollapsed && (
                  <span className="flex-1 truncate">Log Out ({isSystemAdmin ? 'System' : 'Admin'})</span>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsAdminModalOpen(true)}
                className={cn(sideButtonClass, 'text-fg-secondary')}
                title="Unlock administration with PIN"
              >
                <KeyRound size={16} color="var(--color-gold-bright)" className="shrink-0" />
                {!isCollapsed && <span className="flex-1 truncate">Admin Access</span>}
              </button>
            )}
          </div>

          {/* Collapse / Expand Toggle Button */}
          <button
            type="button"
            onClick={handleToggle}
            className={cn(
              'mt-1.5 flex w-full cursor-pointer items-center gap-2 rounded-sm border-0 bg-transparent py-2 text-xs font-semibold text-fg-muted transition-colors duration-100',
              isCollapsed ? 'justify-center px-0' : 'justify-start px-3'
            )}
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            {!isCollapsed && <span>Collapse Sidebar</span>}
          </button>
        </div>
      </aside>

      {/* Admin Login Modal */}
      <AdminLoginModal
        isOpen={isAdminModalOpen}
        onClose={() => setIsAdminModalOpen(false)}
        tournamentSlugOrId={slug}
        tournamentName={activeTourney?.name}
        onSuccess={() => {
          if (slug) navigate(`/${slug}/manage/qualifiers`);
        }}
      />

      {/* Verification / Lock Modal */}
      {activeTourney && (
        <VerifyBracketModal
          isOpen={isVerifyModalOpen}
          onClose={() => setIsVerifyModalOpen(false)}
          tournament={activeTourney}
        />
      )}

      {/* Unlock Error Notification */}
      {unlockError && (
        <div className="fixed bottom-6 left-6 z-9999 flex items-center gap-3 rounded-md bg-red px-5 py-3 text-sm font-semibold text-white shadow-xl">
          <span>{unlockError}</span>
          <IconButton
            aria-label="Dismiss error"
            onClick={() => setUnlockError(null)}
            className="p-0 text-base font-extrabold text-white"
          >
            ×
          </IconButton>
        </div>
      )}
    </>
  );
};
