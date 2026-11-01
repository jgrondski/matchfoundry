import React, { useState } from 'react';
import { useTournament } from '../features/tournament/store';
import { TopNavSwitcher } from '../components/TopNavSwitcher';
import { Layers, Plus, Trophy, AlertTriangle, Sparkles, ShieldCheck, Eye, LayoutDashboard, Globe } from 'lucide-react';
import { Tournament } from '../features/tournament/types';
import { TournamentCard } from '../features/tournament/components/TournamentCard';
import { CreateTournamentModal } from '../features/tournament/components/CreateTournamentModal';
import { usePinAuth } from '../features/auth/AuthContext';
import { OpenQualsCard } from '../features/online-quals/components/OpenQualsCard';
import { ConfirmDialog } from '../components/overlay';
import { Button, Chip } from '../components/ui';

export const TournamentSwitcherPage: React.FC = () => {
  const { isSystemAdmin, session, canManage } = usePinAuth();
  const isTournamentAdmin = session?.role === 'TOURNAMENT_ADMIN';
  const [systemViewTab, setSystemViewTab] = useState<'admin' | 'public'>('admin');
  const {
    tournaments,
    deleteTournament,
    isLoading,
    simulateSampleTournament,
    isDbConnected,
    dbError,
    retryConnection,
  } = useTournament();

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [tournamentToDelete, setTournamentToDelete] = useState<Tournament | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  const confirmDeleteTournament = () => {
    if (tournamentToDelete) {
      deleteTournament(tournamentToDelete.id);
      setTournamentToDelete(null);
    }
  };

  const handleSimulateSample = async () => {
    setIsSimulating(true);
    try {
      await simulateSampleTournament();
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <div className="min-h-screen bg-canvas px-0 pt-0 pb-16">
      <TopNavSwitcher />

      <div className="mx-auto flex w-full max-w-295 flex-col gap-8 px-6 py-8">
        {/* Hero Section */}
        <header className="px-4 py-6 text-center">
          <div className="mb-4 inline-flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-md bg-linear-135 from-gold-bright to-gold shadow-gold">
              <Layers size={24} className="text-canvas" />
            </div>
            <span className="text-2xl font-extrabold text-fg">
              MATCH<span className="text-gold-bright">FOUNDRY</span>
              <sup className="ml-0.5 text-[0.6em] text-gold-bright">™</sup>
            </span>
          </div>
          <h1 className="mb-3 text-hero font-extrabold tracking-tight text-white">
            Tournaments
          </h1>
          <p className="mx-auto mt-0 mb-6 max-w-162.5 text-lg text-fg-secondary">
            Manage and view tournaments.
          </p>

          {isSystemAdmin && (
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button
                variant="primary"
                onClick={() => setIsCreateModalOpen(true)}
                className="px-6 py-2.5 text-base shadow-gold enabled:hover:shadow-gold"
              >
                <Plus size={18} />
                Create New Tournament
              </Button>
              <Button
                variant="secondary"
                onClick={handleSimulateSample}
                disabled={isSimulating}
                className="px-6 py-2.5 text-base"
              >
                <Sparkles size={18} />
                {isSimulating ? 'Simulating...' : 'Simulate Sample Tournament'}
              </Button>
            </div>
          )}
        </header>

        {/* Tournament Grid / Empty State */}
        {isLoading ? (
          <div className="px-8 py-20 text-center">
            <div className="mx-auto mt-0 mb-5 size-11 animate-spin rounded-full border-3 border-white/10 border-t-gold-bright" />
            <h3 className="mb-2 text-lg font-semibold text-fg">Loading Tournaments</h3>
            <p className="text-base text-fg-secondary">Hydrating tournaments from PostgreSQL...</p>
          </div>
        ) : !isDbConnected ? (
          <div className="mx-auto mt-4 mb-12 flex max-w-155 flex-col items-center gap-4 rounded-lg border border-red/35 bg-linear-180 from-red/8 to-red-700/4 px-8 py-14 text-center">
            <div className="mb-2 flex size-15 items-center justify-center rounded-full bg-red/15 text-red">
              <AlertTriangle size={32} />
            </div>
            <h2 className="text-2xl font-bold text-fg">
              PostgreSQL Database Offline
            </h2>
            <p className="max-w-115 text-base leading-normal text-fg-secondary">
              {typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
                ? `Unable to connect to the database on port 5433 (${dbError || 'Connection refused'}). Tournaments cannot be loaded or modified while PostgreSQL is disconnected.`
                : `Unable to connect to the database (${dbError || 'Connection refused'}). Tournaments cannot be loaded or modified while PostgreSQL is disconnected.`}
            </p>
            {typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && (
              <div className="mt-1 rounded-sm bg-black/40 px-4 py-2 font-mono text-sm text-red-300">
                npm run db:up
              </div>
            )}
            <div className="mt-3 flex flex-wrap justify-center gap-3">
              <Button
                variant="primary"
                onClick={() => retryConnection()}
                className="px-7 py-3 text-base"
              >
                Retry Connection
              </Button>
            </div>
          </div>
        ) : tournaments.length === 0 ? (
          <div className="mx-auto mt-4 mb-12 flex max-w-155 flex-col items-center gap-4 rounded-lg border border-dashed border-line bg-surface px-8 py-16 text-center">
            <div className="mb-2 flex size-15 items-center justify-center rounded-full bg-gold-soft text-gold-bright">
              <Trophy size={30} />
            </div>
            <h2 className="text-2xl font-bold text-fg">
              No Tournaments Created Yet
            </h2>
            <p className="max-w-110 text-base leading-normal text-fg-secondary">
              Get started by creating your first competitive tournament, or launch an instant end-to-end simulation with authentic competitive Tetris players.
            </p>
            <div className="mt-3 flex flex-wrap justify-center gap-3">
              <Button
                variant="primary"
                onClick={() => setIsCreateModalOpen(true)}
                className="px-7 py-3 text-base shadow-gold enabled:hover:shadow-gold"
              >
                <Plus size={18} />
                Create New Tournament
              </Button>
              <Button
                variant="secondary"
                onClick={handleSimulateSample}
                disabled={isSimulating}
                className="px-7 py-3 text-base"
              >
                <Sparkles size={18} />
                {isSimulating ? 'Simulating...' : 'Simulate Sample Tournament'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-10">
            {/* 0. Open online quals callout (same for every viewer; hidden when none are open) */}
            <OpenQualsCard tournaments={tournaments} />

            {/* 1. Scoped Workspace for Tournament Admin */}
            {isTournamentAdmin && (
              (() => {
                const managedTourneys = tournaments.filter(
                  t => canManage(t.slug) || canManage(t.id)
                );
                if (managedTourneys.length === 0) return null;
                return (
                  <section className="flex flex-col gap-4 rounded-lg border border-tier-gold/28 bg-tier-gold/4 p-6">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <ShieldCheck size={20} color="var(--color-gold-bright)" />
                        <h2 className="m-0 text-xl font-extrabold text-white">
                          {managedTourneys.length > 1
                            ? `Your Managed Tournaments (${managedTourneys.length})`
                            : 'Your Managed Tournament'}
                        </h2>
                      </div>
                      <span className="text-caption font-semibold text-gold-bright">
                        🏆 Tournament Director Access Active
                      </span>
                    </div>
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(480px,1fr))] gap-6">
                      {managedTourneys.map(tournament => (
                        <TournamentCard
                          key={`managed-${tournament.id}`}
                          tournament={tournament}
                          variant="admin"
                          showOrgBadge={true}
                        />
                      ))}
                    </div>
                  </section>
                );
              })()
            )}

            {/* 2. System Admin Workspace View Mode Switcher */}
            {isSystemAdmin && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
                <div className="flex items-center gap-2">
                  <LayoutDashboard size={18} className="text-sky-400" />
                  <span className="text-base font-bold text-white">
                    System Admin Workspace:
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Chip active={systemViewTab === 'admin'} onClick={() => setSystemViewTab('admin')}>
                    <ShieldCheck size={13} />
                    <span>Organizer Tools</span>
                  </Chip>
                  <Chip active={systemViewTab === 'public'} onClick={() => setSystemViewTab('public')}>
                    <Eye size={13} />
                    <span>Public Preview</span>
                  </Chip>
                </div>
              </div>
            )}

            {/* 3. Public Directory (Or System Admin Full List) */}
            <section className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Globe size={18} color="var(--color-gold-bright)" />
                  <h2 className="m-0 text-xl font-extrabold text-white">
                    {isSystemAdmin && systemViewTab === 'admin' ? 'All Managed Tournaments' : 'Active Tournaments'}
                  </h2>
                </div>
              </div>

              <div className="grid grid-cols-[repeat(auto-fill,minmax(480px,1fr))] gap-6">
                {tournaments.map(tournament => (
                  <TournamentCard
                    key={tournament.id}
                    tournament={tournament}
                    variant={isSystemAdmin && systemViewTab === 'admin' ? 'admin' : 'public'}
                    onDeleteClick={isSystemAdmin ? setTournamentToDelete : undefined}
                    showOrgBadge={true}
                  />
                ))}
              </div>
            </section>
          </div>
        )}
      </div>

      {/* Shared Create Tournament Modal */}
      <CreateTournamentModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmDialog
        open={tournamentToDelete !== null}
        tone="danger"
        title="Delete Tournament"
        body={
          <>
            <p className="text-base leading-normal text-fg-secondary">
              Are you sure you want to delete <strong className="text-white">{tournamentToDelete?.name}</strong>?
            </p>
            <p className="text-caption leading-snug text-fg-muted">
              This tournament has no recorded matches or qualifiers and will be permanently removed. This action cannot be undone.
            </p>
          </>
        }
        cancelLabel="Cancel"
        confirmLabel="Yes, Delete Tournament"
        onCancel={() => setTournamentToDelete(null)}
        onConfirm={confirmDeleteTournament}
      />

      {/* Footer / Common-Law Trademark Notice */}
      <footer className="mt-auto border-t border-line-subtle px-4 pt-10 pb-6 text-center text-caption text-fg-muted">
        <p className="m-0">© 2026 MatchFoundry™. All rights reserved.</p>
      </footer>
    </div>
  );
};
