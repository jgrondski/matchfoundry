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
    <div style={{ minHeight: '100vh', background: 'var(--color-bg-base)', padding: '0 0 4rem' }}>
      <TopNavSwitcher />

      <div style={{ maxWidth: '1180px', width: '100%', margin: '0 auto', padding: '2rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '2rem', boxSizing: 'border-box' }}>
        {/* Hero Section */}
        <header style={{ textAlign: 'center', padding: '1.5rem 1rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <div style={logoIconLargeStyle}>
              <Layers size={24} color="#090d16" />
            </div>
            <span style={{ fontWeight: 800, fontSize: '1.5rem', color: 'var(--color-text-primary)' }}>
              MATCH<span style={{ color: 'var(--color-gold-bright)' }}>FOUNDRY</span>
              <sup style={{ fontSize: '0.6em', marginLeft: '2px', color: 'var(--color-gold-bright)' }}>™</sup>
            </span>
          </div>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.03em', marginBottom: '0.75rem' }}>
            Tournaments
          </h1>
          <p style={{ fontSize: '1.1rem', color: 'var(--color-text-secondary)', maxWidth: '650px', margin: '0 auto 1.5rem' }}>
            Manage and view tournaments.
          </p>

          {isSystemAdmin && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="btn btn-primary"
                style={{ padding: '0.65rem 1.5rem', fontSize: '0.95rem', boxShadow: 'var(--shadow-gold)' }}
              >
                <Plus size={18} />
                Create New Tournament
              </button>
              <button
                onClick={handleSimulateSample}
                disabled={isSimulating}
                className="btn"
                style={{
                  padding: '0.65rem 1.5rem',
                  fontSize: '0.95rem',
                  background: 'rgba(59, 130, 246, 0.15)',
                  color: '#60a5fa',
                  border: '1px solid rgba(59, 130, 246, 0.35)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  cursor: isSimulating ? 'not-allowed' : 'pointer',
                }}
              >
                <Sparkles size={18} />
                {isSimulating ? 'Simulating...' : 'Simulate Sample Tournament'}
              </button>
            </div>
          )}
        </header>

        {/* Tournament Grid / Empty State */}
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '5rem 2rem' }}>
            <div style={{ width: 44, height: 44, border: '3px solid rgba(255,255,255,0.1)', borderTopColor: 'var(--color-gold-bright)', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 1.25rem' }} />
            <h3 style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '0.5rem' }}>Loading Tournaments</h3>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.95rem' }}>Hydrating tournaments from PostgreSQL...</p>
          </div>
        ) : !isDbConnected ? (
          <div
            style={{
              background: 'linear-gradient(180deg, rgba(239, 68, 68, 0.08) 0%, rgba(185, 28, 28, 0.04) 100%)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              borderRadius: 'var(--radius-lg)',
              padding: '3.5rem 2rem',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '1rem',
              maxWidth: '620px',
              margin: '1rem auto 3rem',
            }}
          >
            <div
              style={{
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                background: 'rgba(239, 68, 68, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ef4444',
                marginBottom: '0.5rem',
              }}
            >
              <AlertTriangle size={32} />
            </div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
              PostgreSQL Database Offline
            </h2>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.95rem', maxWidth: '460px', lineHeight: 1.5 }}>
              {typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
                ? `Unable to connect to the database on port 5433 (${dbError || 'Connection refused'}). Tournaments cannot be loaded or modified while PostgreSQL is disconnected.`
                : `Unable to connect to the database (${dbError || 'Connection refused'}). Tournaments cannot be loaded or modified while PostgreSQL is disconnected.`}
            </p>
            {typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && (
              <div
                style={{
                  background: 'rgba(0, 0, 0, 0.4)',
                  padding: '0.5rem 1rem',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.85rem',
                  color: '#fca5a5',
                  fontFamily: 'monospace',
                  marginTop: '0.25rem',
                }}
              >
                npm run db:up
              </div>
            )}
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center', marginTop: '0.75rem' }}>
              <button
                onClick={() => retryConnection()}
                className="btn btn-primary"
                style={{ padding: '0.7rem 1.75rem', fontSize: '0.95rem' }}
              >
                Retry Connection
              </button>
            </div>
          </div>
        ) : tournaments.length === 0 ? (
          <div
            style={{
              background: 'var(--color-bg-surface)',
              border: '1px dashed var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              padding: '4rem 2rem',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '1rem',
              maxWidth: '620px',
              margin: '1rem auto 3rem',
            }}
          >
            <div
              style={{
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                background: 'var(--color-gold-bg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-gold-bright)',
                marginBottom: '0.5rem',
              }}
            >
              <Trophy size={30} />
            </div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
              No Tournaments Created Yet
            </h2>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.95rem', maxWidth: '440px', lineHeight: 1.5 }}>
              Get started by creating your first competitive tournament, or launch an instant end-to-end simulation with authentic competitive Tetris players.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center', marginTop: '0.75rem' }}>
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="btn btn-primary"
                style={{ padding: '0.7rem 1.75rem', fontSize: '0.95rem', boxShadow: 'var(--shadow-gold)' }}
              >
                <Plus size={18} />
                Create New Tournament
              </button>
              <button
                onClick={handleSimulateSample}
                disabled={isSimulating}
                className="btn"
                style={{
                  padding: '0.7rem 1.75rem',
                  fontSize: '0.95rem',
                  background: 'rgba(59, 130, 246, 0.15)',
                  color: '#60a5fa',
                  border: '1px solid rgba(59, 130, 246, 0.35)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  cursor: isSimulating ? 'not-allowed' : 'pointer',
                }}
              >
                <Sparkles size={18} />
                {isSimulating ? 'Simulating...' : 'Simulate Sample Tournament'}
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
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
                  <section
                    style={{
                      background: 'rgba(255, 201, 5, 0.04)',
                      border: '1px solid rgba(255, 201, 5, 0.28)',
                      borderRadius: 'var(--radius-lg, 12px)',
                      padding: '1.5rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '1rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <ShieldCheck size={20} color="var(--color-gold-bright)" />
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: '#ffffff' }}>
                          {managedTourneys.length > 1
                            ? `Your Managed Tournaments (${managedTourneys.length})`
                            : 'Your Managed Tournament'}
                        </h2>
                      </div>
                      <span style={{ fontSize: '0.78rem', color: 'var(--color-gold-bright)', fontWeight: 600 }}>
                        🏆 Tournament Director Access Active
                      </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(480px, 1fr))', gap: '1.5rem' }}>
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
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderBottom: '1px solid var(--color-border)',
                  paddingBottom: '0.75rem',
                  flexWrap: 'wrap',
                  gap: '0.75rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <LayoutDashboard size={18} color="#38bdf8" />
                  <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#ffffff' }}>
                    System Admin Workspace:
                  </span>
                </div>
                <div
                  style={{
                    display: 'inline-flex',
                    background: 'rgba(255, 255, 255, 0.05)',
                    borderRadius: 'var(--radius-full, 9999px)',
                    padding: '3px',
                    gap: '3px',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setSystemViewTab('admin')}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      padding: '0.35rem 0.85rem',
                      borderRadius: 'var(--radius-full, 9999px)',
                      border: 'none',
                      fontSize: '0.78rem',
                      fontWeight: systemViewTab === 'admin' ? 700 : 500,
                      background: systemViewTab === 'admin' ? 'var(--color-gold-bright, #ffc905)' : 'transparent',
                      color: systemViewTab === 'admin' ? '#090d16' : 'var(--color-text-secondary)',
                      cursor: 'pointer',
                    }}
                  >
                    <ShieldCheck size={13} />
                    <span>Organizer Tools</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSystemViewTab('public')}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      padding: '0.35rem 0.85rem',
                      borderRadius: 'var(--radius-full, 9999px)',
                      border: 'none',
                      fontSize: '0.78rem',
                      fontWeight: systemViewTab === 'public' ? 700 : 500,
                      background: systemViewTab === 'public' ? 'var(--color-gold-bright, #ffc905)' : 'transparent',
                      color: systemViewTab === 'public' ? '#090d16' : 'var(--color-text-secondary)',
                      cursor: 'pointer',
                    }}
                  >
                    <Eye size={13} />
                    <span>Public Preview</span>
                  </button>
                </div>
              </div>
            )}

            {/* 3. Public Directory (Or System Admin Full List) */}
            <section style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Globe size={18} color="var(--color-gold-bright)" />
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: '#ffffff' }}>
                    {isSystemAdmin && systemViewTab === 'admin' ? 'All Managed Tournaments' : 'Active Tournaments'}
                  </h2>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(480px, 1fr))', gap: '1.5rem' }}>
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
      <footer
        style={{
          marginTop: 'auto',
          padding: '2.5rem 1rem 1.5rem',
          textAlign: 'center',
          color: 'var(--color-text-muted, #64748b)',
          fontSize: '0.8rem',
          borderTop: '1px solid var(--color-border-subtle, rgba(255,255,255,0.06))',
        }}
      >
        <p style={{ margin: 0 }}>© 2026 MatchFoundry™. All rights reserved.</p>
      </footer>
    </div>
  );
};

const logoIconLargeStyle: React.CSSProperties = {
  width: '36px',
  height: '36px',
  borderRadius: '8px',
  background: 'linear-gradient(135deg, var(--color-gold-bright) 0%, var(--color-gold) 100%)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxShadow: 'var(--shadow-gold)',
};
