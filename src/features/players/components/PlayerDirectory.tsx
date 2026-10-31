import React, { useState, useMemo, useCallback } from 'react';
import { useTournament } from '../../tournament/store';
import { useOrganization } from '../../organizations/store';
import { usePinAuth } from '../../auth/AuthContext';
import { PlayerProfile } from '../../tournament/types';
import { GenerateFakePlayersModal } from './GenerateFakePlayersModal';
import { PlayerEditModal } from './PlayerEditModal';
import {
  PlayerDirectoryStats,
  PlayerDirectoryFilterBar,
  PlayerDirectoryTable,
} from './PlayerDirectorySections';
import {
  Users,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { ConfirmDialog } from '../../../components/overlay';

export const PlayerDirectory: React.FC = () => {
  const {
    globalPlayers,
    tournaments,
    addGlobalPlayer,
    updateGlobalPlayer,
    deleteGlobalPlayer,
    clearAllGlobalPlayers,
    generateFakeGlobalPlayers,
  } = useTournament();
  const { organizations } = useOrganization();
  const { isSystemAdmin } = usePinAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [playstyleFilter, setPlaystyleFilter] = useState<string>('ALL');
  const [orgFilter, setOrgFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'NAME_ASC' | 'PB_DESC' | 'PB_ASC' | 'COUNTRY'>('PB_DESC');

  // Modals state
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<PlayerProfile | null>(null);
  const [playerToDelete, setPlayerToDelete] = useState<PlayerProfile | null>(null);
  const [isClearAllConfirmOpen, setIsClearAllConfirmOpen] = useState(false);

  // Set of players that competed in tournaments belonging to selected org
  const orgPlayerIds = useMemo(() => {
    if (orgFilter === 'ALL') return null;
    const ids = new Set<string>();
    tournaments
      .filter(t => t.organizationId === orgFilter)
      .forEach(t => {
        (t.playersPool || []).forEach(p => ids.add(p.id));
        (t.qualifiers || []).forEach(q => ids.add(q.id));
        (t.qualifierSubmissions || []).forEach(s => ids.add(s.playerId));
        (t.tiers || []).forEach(tier => {
          Object.values(tier.bracket?.matchesById || {}).forEach(m => {
            if (m.player1.player?.id) ids.add(m.player1.player.id);
            if (m.player2.player?.id) ids.add(m.player2.player.id);
          });
        });
      });
    return ids;
  }, [orgFilter, tournaments]);

  // Filtered & Sorted Players (includes orgPlayerIds in dependencies)
  const filteredPlayers = useMemo(() => {
    return globalPlayers
      .filter(p => {
        // Text search
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchName = p.name.toLowerCase().includes(q);
          const matchDisplayName = p.displayName?.toLowerCase().includes(q);
          const matchNickname = p.nickname?.toLowerCase().includes(q);
          const matchTwitch = p.twitchUsername?.toLowerCase().includes(q);
          const matchCountry = p.country?.toLowerCase().includes(q);
          const matchPlaystyle = p.playstyle?.toLowerCase().includes(q);
          const matchNotes = p.notes?.toLowerCase().includes(q);
          if (!matchName && !matchDisplayName && !matchNickname && !matchTwitch && !matchCountry && !matchPlaystyle && !matchNotes) {
            return false;
          }
        }

        // Playstyle filter
        if (playstyleFilter !== 'ALL') {
          return p.playstyle === playstyleFilter;
        }

        // Organization circuit filter
        if (orgPlayerIds && !orgPlayerIds.has(p.id)) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'NAME_ASC') {
          return a.name.localeCompare(b.name);
        }
        if (sortBy === 'PB_DESC') {
          return (b.personalBest || 0) - (a.personalBest || 0);
        }
        if (sortBy === 'PB_ASC') {
          return (a.personalBest || 0) - (b.personalBest || 0);
        }
        if (sortBy === 'COUNTRY') {
          return (a.country || '').localeCompare(b.country || '');
        }
        return 0;
      });
  }, [globalPlayers, searchQuery, playstyleFilter, orgPlayerIds, sortBy]);

  const existingNames = useMemo(() => globalPlayers.map(p => p.name), [globalPlayers]);

  // Stable callbacks for child memoization
  const handleOpenAddModal = useCallback(() => {
    setEditingPlayer(null);
    setIsEditModalOpen(true);
  }, []);

  const handleOpenEditModal = useCallback((player: PlayerProfile) => {
    setEditingPlayer(player);
    setIsEditModalOpen(true);
  }, []);

  const handleCloseEditModal = useCallback(() => {
    setIsEditModalOpen(false);
    setEditingPlayer(null);
  }, []);

  const handleRequestDelete = useCallback((player: PlayerProfile) => {
    setPlayerToDelete(player);
  }, []);

  const handleOpenGenerateModal = useCallback(() => {
    setIsGenerateModalOpen(true);
  }, []);

  const handleCloseGenerateModal = useCallback(() => {
    setIsGenerateModalOpen(false);
  }, []);

  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  const handlePlaystyleChange = useCallback((style: string) => {
    setPlaystyleFilter(style);
  }, []);

  const handleOrgFilterChange = useCallback((orgId: string) => {
    setOrgFilter(orgId);
  }, []);

  const handleSortChange = useCallback((sort: 'NAME_ASC' | 'PB_DESC' | 'PB_ASC' | 'COUNTRY') => {
    setSortBy(sort);
  }, []);

  const handleSavePlayer = (playerData: Omit<PlayerProfile, 'id'>) => {
    if (editingPlayer) {
      updateGlobalPlayer(editingPlayer.id, playerData);
    } else {
      addGlobalPlayer(playerData);
    }
  };

  const enrolledTournamentsForDelete = useMemo(() => {
    if (!playerToDelete) return [];
    return tournaments.filter(t =>
      (t.playersPool || []).some(p => p.id === playerToDelete.id) ||
      (t.qualifierSubmissions || []).some(s => s.playerId === playerToDelete.id) ||
      Boolean(t.tournamentPlayers?.[playerToDelete.id])
    );
  }, [playerToDelete, tournaments]);

  const handleDeleteConfirm = async () => {
    if (playerToDelete && enrolledTournamentsForDelete.length === 0) {
      const res = await deleteGlobalPlayer(playerToDelete.id);
      if (res && res.success) {
        setPlayerToDelete(null);
      }
    }
  };

  const enrolledPlayerIds = useMemo(() => {
    const ids = new Set<string>();
    tournaments.forEach(t => {
      (t.playersPool || []).forEach(p => ids.add(p.id));
      (t.qualifierSubmissions || []).forEach(s => ids.add(s.playerId));
      if (t.tournamentPlayers) {
        Object.keys(t.tournamentPlayers).forEach(id => ids.add(id));
      }
    });
    return ids;
  }, [tournaments]);

  const { unattachedCount, enrolledCount } = useMemo(() => {
    const unattached = globalPlayers.filter(p => !enrolledPlayerIds.has(p.id)).length;
    const enrolled = globalPlayers.length - unattached;
    return { unattachedCount: unattached, enrolledCount: enrolled };
  }, [globalPlayers, enrolledPlayerIds]);

  const handleClearAllConfirm = async () => {
    if (unattachedCount === 0) return;
    await clearAllGlobalPlayers();
    setIsClearAllConfirmOpen(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem', width: '100%' }}>
      {/* Header & Main Actions */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '1.25rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: 'var(--color-gold-bg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-gold-bright)',
              }}
            >
              <Users size={20} />
            </div>
            <h1 style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
              Global Player Pool
            </h1>
          </div>
          <p style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)', marginTop: '0.35rem' }}>
            List of Global Players and their relevant data.
          </p>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {isSystemAdmin && (
            <button
              type="button"
              onClick={handleOpenGenerateModal}
              className="btn btn-secondary"
              style={{ padding: '0.6rem 1.15rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <Sparkles size={16} color="var(--color-gold-bright)" />
              Generate Fake Players
            </button>
          )}

          <button
            type="button"
            onClick={handleOpenAddModal}
            className="btn btn-primary"
            style={{ padding: '0.6rem 1.25rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: 'var(--shadow-gold)' }}
          >
            <Plus size={16} />
            Add Competitor
          </button>

          {isSystemAdmin && globalPlayers.length > 0 && (
            <button
              type="button"
              onClick={() => setIsClearAllConfirmOpen(true)}
              className="btn btn-secondary"
              style={{
                padding: '0.6rem 0.9rem',
                fontSize: '0.85rem',
                color: 'var(--color-red)',
                borderColor: 'rgba(239, 68, 68, 0.3)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
              title="Clear all global players from catalog"
            >
              <Trash2 size={15} />
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* Stats Overview Cards */}
      <PlayerDirectoryStats globalPlayers={globalPlayers} />

      {/* Filter & Search Bar */}
      <PlayerDirectoryFilterBar
        onSearchChange={handleSearchChange}
        playstyleFilter={playstyleFilter}
        onPlaystyleChange={handlePlaystyleChange}
        orgFilter={orgFilter}
        onOrgFilterChange={handleOrgFilterChange}
        sortBy={sortBy}
        onSortChange={handleSortChange}
        organizations={organizations}
      />

      {/* Players Table */}
      <PlayerDirectoryTable
        filteredPlayers={filteredPlayers}
        totalPlayersCount={globalPlayers.length}
        onEditPlayer={handleOpenEditModal}
        onDeletePlayer={handleRequestDelete}
        onOpenGenerateModal={handleOpenGenerateModal}
        onOpenAddModal={handleOpenAddModal}
      />

      {/* Generate Fake Players Modal (conditionally mounted) */}
      {isGenerateModalOpen && (
        <GenerateFakePlayersModal
          isOpen={isGenerateModalOpen}
          onClose={handleCloseGenerateModal}
          onGenerate={count => generateFakeGlobalPlayers(count)}
          existingCount={globalPlayers.length}
        />
      )}

      {/* Add / Edit Player Modal (conditionally mounted) */}
      {isEditModalOpen && (
        <PlayerEditModal
          key={editingPlayer?.id ?? 'new'}
          isOpen={isEditModalOpen}
          onClose={handleCloseEditModal}
          onSave={handleSavePlayer}
          initialPlayer={editingPlayer}
          existingNames={existingNames}
        />
      )}

      {/* Delete Single Player Speedbump Modal */}
      <ConfirmDialog
        open={playerToDelete !== null}
        tone={enrolledTournamentsForDelete.length > 0 ? 'warning' : 'danger'}
        title={enrolledTournamentsForDelete.length > 0 ? 'Cannot Delete Competitor' : 'Delete Competitor?'}
        body={
          <>
            <p className="text-caption text-fg-muted">
              {enrolledTournamentsForDelete.length > 0 ? 'Competitor is active in tournaments' : 'Remove from master player directory'}
            </p>
            {enrolledTournamentsForDelete.length > 0 ? (
              <p className="text-sm leading-normal text-fg-secondary">
                <strong className="text-fg">{playerToDelete?.name}</strong> cannot be deleted from the global pool because they are currently enrolled in: <strong>{enrolledTournamentsForDelete.map(t => t.name).join(', ')}</strong>. To delete this competitor, remove them from tournament rosters first.
              </p>
            ) : (
              <p className="text-sm leading-normal text-fg-secondary">
                Are you sure you want to permanently delete <strong>{playerToDelete?.name}</strong> from the global player pool?
              </p>
            )}
          </>
        }
        cancelLabel={enrolledTournamentsForDelete.length > 0 ? 'Close' : 'Cancel'}
        confirmLabel="Delete Competitor"
        confirmDisabled={enrolledTournamentsForDelete.length > 0}
        onCancel={() => setPlayerToDelete(null)}
        onConfirm={handleDeleteConfirm}
      />

      {/* Clear All Players Speedbump Modal */}
      <ConfirmDialog
        open={isClearAllConfirmOpen}
        tone="danger"
        title="Clear All Global Players?"
        body={
          <>
            <p className="text-caption text-fg-muted">Destructive catalog purge action</p>
            <p className="text-sm leading-normal text-fg-secondary">
              This will permanently delete <strong>{unattachedCount}</strong> unattached competitor{unattachedCount === 1 ? '' : 's'} from the global player pool.{' '}
              {enrolledCount > 0 && (
                <span>
                  <strong>{enrolledCount}</strong> competitor{enrolledCount === 1 ? '' : 's'} enrolled in tournaments will be preserved.{' '}
                </span>
              )}
              This action cannot be undone.
            </p>
          </>
        }
        cancelLabel="Cancel"
        confirmLabel="Clear Unattached Competitors"
        confirmDisabled={unattachedCount === 0}
        onCancel={() => setIsClearAllConfirmOpen(false)}
        onConfirm={handleClearAllConfirm}
      />
    </div>
  );
};
