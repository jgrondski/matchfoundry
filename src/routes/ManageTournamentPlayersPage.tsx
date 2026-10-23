import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTournament } from '../features/tournament/store';
import { PlayerProfile } from '../features/tournament/types';
import { TournamentLayout } from '../components/TournamentLayout';
import { ImportFromGlobalModal } from '../features/players/components/ImportFromGlobalModal';
import { PlayerEditModal } from '../features/players/components/PlayerEditModal';
import { PlayerDetailDrawer } from '../features/qualifiers/components/PlayerDetailDrawer';
import { PlayerAvatar } from '../features/players/components/PlayerAvatar';
import { PlaystyleChip } from '../features/players/components/PlaystyleChip';
import { getEffectivePlayerName } from '../features/players/playerNameUtils';
import {
  Users,
  UserPlus,
  Download,
  DownloadCloud,
  Search,
  UserX,
  AlertTriangle,
  X,
  Layers,
  Edit2,
} from 'lucide-react';
import { LoadingScreen } from '../components/LoadingScreen';

export const ManageTournamentPlayersPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const {
    getTournamentBySlug,
    removePlayerFromTournament,
    addPlayerToPool,
    updatePlayerInPool,
    importPlayersToTournament,
    globalPlayers,
    isLoading,
    isHydrated,
  } = useTournament();

  const [searchTerm, setSearchTerm] = useState('');
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<PlayerProfile | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedPlayerForDrawer, setSelectedPlayerForDrawer] = useState<PlayerProfile | null>(null);
  const [isPlayerDrawerOpen, setIsPlayerDrawerOpen] = useState(false);
  const [playerToRemove, setPlayerToRemove] = useState<PlayerProfile | null>(null);

  const tournament = slug ? getTournamentBySlug(slug) : undefined;
  const playersPool = tournament?.playersPool;
  const matchScores = tournament?.matchScores;

  const filteredPlayers = useMemo(() => {
    if (!playersPool) return [];
    const term = searchTerm.toLowerCase();
    return playersPool.filter(p =>
      getEffectivePlayerName(p).toLowerCase().includes(term) ||
      p.name.toLowerCase().includes(term) ||
      (p.country && p.country.toLowerCase().includes(term)) ||
      (p.playstyle && p.playstyle.toLowerCase().includes(term))
    );
  }, [playersPool, searchTerm]);

  const existingRosterNames = useMemo(
    () => (playersPool || []).map(p => p.name),
    [playersPool]
  );

  const availableGlobalPlayers = useMemo(() => {
    if (!playersPool) return globalPlayers;
    const existingIds = new Set(playersPool.map(p => p.id));
    const existingNames = new Set(playersPool.map(p => p.name.toLowerCase()));
    return globalPlayers.filter(
      p => !existingIds.has(p.id) && !existingNames.has(p.name.toLowerCase())
    );
  }, [playersPool, globalPlayers]);

  const playerQualCount = useMemo(() => {
    if (!playerToRemove || !tournament?.qualifierSubmissions) return 0;
    return tournament.qualifierSubmissions.filter(s => s.playerId === playerToRemove.id).length;
  }, [playerToRemove, tournament?.qualifierSubmissions]);

  const isRemovalBlocked = useMemo(() => {
    if (!playerToRemove) return false;
    if (tournament?.isLocked) return true;
    if (playerQualCount > 0) return true;
    if (!matchScores) return false;
    return Object.values(matchScores).some(
      m =>
        m.winnerPlayerId === playerToRemove.id ||
        m.loserPlayerId === playerToRemove.id ||
        (m.isComplete && (m.games || []).length > 0)
    );
  }, [playerToRemove, matchScores, tournament?.isLocked, playerQualCount]);

  const removalBlockReason = useMemo(() => {
    if (!playerToRemove) return null;
    const hasMatches = matchScores && Object.values(matchScores).some(
      m =>
        m.winnerPlayerId === playerToRemove.id ||
        m.loserPlayerId === playerToRemove.id ||
        (m.isComplete && (m.games || []).length > 0)
    );
    if (hasMatches) {
      return `${playerToRemove.name} cannot be removed from this tournament because they have recorded bracket matches. To remove this competitor, reset their match scores first in Settings.`;
    }
    if (tournament?.isLocked) {
      return `${playerToRemove.name} cannot be removed while tournament brackets are locked. Unlock brackets in Settings or Bracket view first.`;
    }
    if (playerQualCount > 0) {
      return `${playerToRemove.name} cannot be removed from this tournament's roster because they have ${playerQualCount} recorded qualifier score(s). Delete their qualifier scores first in Qualifiers.`;
    }
    return null;
  }, [playerToRemove, matchScores, tournament?.isLocked, playerQualCount]);

  if (isLoading || !isHydrated) {
    return <LoadingScreen message="Loading tournament players..." />;
  }

  if (!tournament) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
        <h2>Tournament Not Found</h2>
        <button onClick={() => navigate('/')} className="btn btn-primary" style={{ marginTop: '1rem' }}>
          Back to Tournaments
        </button>
      </div>
    );
  }

  const currentPlayers = tournament.playersPool || [];
  const totalCapacity = (tournament.tiers || []).reduce((sum, t) => sum + (t.playerCount || 0), 0);

  const handleRegisterNewCompetitor = async (playerData: Omit<PlayerProfile, 'id'>) => {
    await addPlayerToPool(tournament.id, playerData);
  };

  const handleImportGlobalPlayers = async (playersToImport: PlayerProfile[]) => {
    await importPlayersToTournament(tournament.id, playersToImport);
  };

  const handleImportAllGlobal = async () => {
    if (availableGlobalPlayers.length > 0) {
      await importPlayersToTournament(tournament.id, availableGlobalPlayers);
    }
  };

  const handleConfirmRemove = async () => {
    if (!playerToRemove || isRemovalBlocked) return;
    await removePlayerFromTournament(tournament.id, playerToRemove.id);
    setPlayerToRemove(null);
  };

  return (
    <TournamentLayout tournament={tournament} activeView="players">
      <main style={{ flex: 1, padding: '2rem 1.5rem', maxWidth: '1100px', width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Header Section */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.2rem' }}>
              <span
                style={{
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  color: 'var(--color-gold-bright)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                }}
              >
                Competitor Roster
              </span>
            </div>
            <h1 style={{ fontSize: '1.85rem', fontWeight: 800, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '0.65rem', letterSpacing: '-0.02em', margin: 0 }}>
              <Users color="var(--color-gold-bright)" size={28} />
              {tournament.name}
            </h1>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginTop: '0.35rem' }}>
              Manage registered competitors and seeding for this tournament. Players registered here can submit qualifier scores and seed into tournament brackets.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setIsImportModalOpen(true)}
              className="btn btn-secondary"
              style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', gap: '0.45rem' }}
            >
              <Download size={15} color="var(--color-gold-bright)" />
              Import from Global Pool
            </button>
            {availableGlobalPlayers.length > 0 && (
              <button
                type="button"
                onClick={handleImportAllGlobal}
                className="btn btn-secondary"
                style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', gap: '0.45rem' }}
                title={`Import all ${availableGlobalPlayers.length} available players from global catalog`}
              >
                <DownloadCloud size={15} color="#38bdf8" />
                Import All Available ({availableGlobalPlayers.length})
              </button>
            )}
            {tournament.seedingMethod === 'MANUAL' && (
              <button
                type="button"
                onClick={() => navigate(`/${tournament.slug}/manage/seeding`)}
                className="btn btn-secondary"
                style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', gap: '0.45rem' }}
                title="Open Seeding Manager to arrange seeds and tier cutoffs"
              >
                <Layers size={15} color="var(--color-brand)" />
                Arrange Seeds & Brackets
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsRegisterModalOpen(true)}
              className="btn btn-primary"
              style={{ padding: '0.5rem 1.15rem', fontSize: '0.85rem', gap: '0.45rem' }}
            >
              <UserPlus size={15} />
              Register Competitor
            </button>
          </div>
        </div>

        {/* Capacity & Roster Metrics */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
          <div style={{ padding: '1rem 1.25rem', background: 'var(--color-bg-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.04em' }}>
              Registered Competitors
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: currentPlayers.length > 0 ? 'var(--color-gold-bright)' : 'var(--color-text-secondary)', marginTop: '0.2rem' }}>
              {currentPlayers.length}
            </div>
          </div>

          <div style={{ padding: '1rem 1.25rem', background: 'var(--color-bg-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.04em' }}>
              Total Bracket Capacity
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-text-primary)', marginTop: '0.2rem' }}>
              {totalCapacity > 0 ? totalCapacity : '—'}
            </div>
          </div>

          <div style={{ padding: '1rem 1.25rem', background: 'var(--color-bg-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.04em' }}>
              Roster Status
            </div>
            <div style={{ fontSize: '1.05rem', fontWeight: 700, marginTop: '0.45rem' }}>
              {totalCapacity === 0 ? (
                <span style={{ color: 'var(--color-text-muted)' }}>
                  No tiers configured ({currentPlayers.length} in qualifiers)
                </span>
              ) : currentPlayers.length < totalCapacity ? (
                <span style={{ color: 'var(--color-gold-bright)' }}>
                  Underfilled ({currentPlayers.length}/{totalCapacity})
                </span>
              ) : currentPlayers.length === totalCapacity ? (
                <span style={{ color: '#4ade80' }}>
                  Full Capacity ({totalCapacity}/{totalCapacity})
                </span>
              ) : (
                <span style={{ color: '#60a5fa' }}>
                  Ready ({totalCapacity} in brackets + {currentPlayers.length - totalCapacity} DNQ)
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Competitor Table Container */}
        <div style={{ background: 'var(--color-bg-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ position: 'relative', width: '280px' }}>
              <input
                type="text"
                placeholder="Search competitors by name, country, or playstyle..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.45rem 0.75rem 0.45rem 2.1rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-bg-base)',
                  color: 'var(--color-text-primary)',
                  fontSize: '0.85rem',
                }}
              />
              <Search
                size={15}
                color="var(--color-text-muted)"
                style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)' }}
              />
            </div>

            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
              Showing {filteredPlayers.length} of {currentPlayers.length} registered {currentPlayers.length === 1 ? 'competitor' : 'competitors'}
            </span>
          </div>

          {currentPlayers.length === 0 ? (
            <div
              style={{
                padding: '3rem 1.5rem',
                background: 'var(--color-bg-base)',
                borderRadius: 'var(--radius-md)',
                border: '1px dashed var(--color-border)',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.85rem',
              }}
            >
              <Users size={36} color="var(--color-text-muted)" />
              <p style={{ fontSize: '1rem', color: 'var(--color-text-secondary)', margin: 0 }}>
                No competitors registered in this tournament yet.
              </p>
              <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', margin: 0, maxWidth: '420px' }}>
                Register competitors directly or import them from the global player pool to begin recording qualifier scores.
              </p>
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(true)}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  <Download size={14} color="var(--color-gold-bright)" />
                  Import from Global Pool
                </button>
                {availableGlobalPlayers.length > 0 && (
                  <button
                    type="button"
                    onClick={handleImportAllGlobal}
                    className="btn btn-secondary"
                    style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                  >
                    <DownloadCloud size={14} color="#38bdf8" />
                    Import All Available ({availableGlobalPlayers.length})
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsRegisterModalOpen(true)}
                  className="btn btn-primary"
                  style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  <UserPlus size={14} />
                  Register Competitor
                </button>
              </div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'var(--color-bg-surface-elevated)', borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}>
                    <th style={{ padding: '0.75rem 1rem', width: '45px', textAlign: 'center' }}>#</th>
                    <th style={{ padding: '0.75rem 1rem', minWidth: '180px' }}>Competitor</th>
                    <th style={{ padding: '0.75rem 1rem', width: '100px' }}>Country</th>
                    <th style={{ padding: '0.75rem 1rem', width: '120px' }}>Playstyle</th>
                    <th style={{ padding: '0.75rem 1rem', width: '140px' }}>Personal Best</th>
                    <th style={{ padding: '0.75rem 1rem', width: '110px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPlayers.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                        No competitors matching "{searchTerm}".
                      </td>
                    </tr>
                  ) : (
                    filteredPlayers.map((player, pIdx) => (
                      <tr
                        key={player.id}
                        style={{
                          borderBottom: '1px solid var(--color-border-subtle)',
                          background: pIdx % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.015)',
                        }}
                      >
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                          {pIdx + 1}
                        </td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                            <PlayerAvatar player={player} />
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedPlayerForDrawer(player);
                                setIsPlayerDrawerOpen(true);
                              }}
                              style={{
                                background: 'none',
                                border: 'none',
                                padding: 0,
                                cursor: 'pointer',
                                textAlign: 'left',
                                fontWeight: 600,
                                color: 'var(--color-text-primary)',
                                fontSize: 'inherit',
                                transition: 'color 0.15s ease',
                              }}
                              onMouseEnter={e => {
                                e.currentTarget.style.color = 'var(--color-gold-bright)';
                                e.currentTarget.style.textDecoration = 'underline';
                              }}
                              onMouseLeave={e => {
                                e.currentTarget.style.color = 'var(--color-text-primary)';
                                e.currentTarget.style.textDecoration = 'none';
                              }}
                              title="Click to view detailed competitor profile, audit log, and match stats"
                            >
                              {getEffectivePlayerName(player)}
                            </button>
                          </div>
                        </td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          {player.country ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.15rem 0.45rem', borderRadius: 'var(--radius-sm)', background: 'var(--color-bg-surface-highlight)', fontSize: '0.75rem', fontWeight: 700 }}>
                              <PlayerAvatar player={player} country={player.country} />
                              <span>{player.country}</span>
                            </span>
                          ) : '—'}
                        </td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <PlaystyleChip style={player.playstyle} />
                        </td>
                        <td className="tabular-nums" style={{ padding: '0.75rem 1rem', fontFamily: 'monospace', fontWeight: 600 }}>
                          {player.personalBest ? player.personalBest.toLocaleString() : '—'}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.4rem' }}>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingPlayer(player);
                                setIsEditModalOpen(true);
                              }}
                              className="btn btn-secondary"
                              style={{ padding: '0.3rem 0.65rem', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                              title="Edit competitor profile"
                            >
                              <Edit2 size={13} /> Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => setPlayerToRemove(player)}
                              className="btn btn-secondary"
                              style={{ padding: '0.3rem 0.65rem', fontSize: '0.75rem', color: 'var(--color-red)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                              title="Remove competitor from tournament roster"
                            >
                              <UserX size={14} /> Remove
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Modals & Drawers */}
      <PlayerEditModal
        isOpen={isRegisterModalOpen}
        onClose={() => setIsRegisterModalOpen(false)}
        onSave={handleRegisterNewCompetitor}
        existingNames={existingRosterNames}
        allowDisqualify={true}
      />

      <PlayerEditModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingPlayer(null);
        }}
        initialPlayer={editingPlayer || undefined}
        onSave={async (playerData) => {
          if (editingPlayer) {
            await updatePlayerInPool(tournament.id, editingPlayer.id, playerData);
          }
          setIsEditModalOpen(false);
          setEditingPlayer(null);
        }}
        existingNames={existingRosterNames.filter(
          n => n.toLowerCase() !== editingPlayer?.name.toLowerCase()
        )}
        allowDisqualify={true}
      />

      <ImportFromGlobalModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        globalPlayers={globalPlayers}
        currentTournamentPlayers={tournament.playersPool || []}
        onImport={handleImportGlobalPlayers}
      />

      <PlayerDetailDrawer
        isOpen={isPlayerDrawerOpen}
        onClose={() => {
          setIsPlayerDrawerOpen(false);
          setSelectedPlayerForDrawer(null);
        }}
        player={selectedPlayerForDrawer}
        tournament={tournament}
      />

      {/* Delete Confirmation Modal */}
      {playerToRemove && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem',
          }}
        >
          <div
            style={{
              background: 'var(--color-bg-surface)',
              borderRadius: 'var(--radius-lg)',
              border: isRemovalBlocked ? '1px solid var(--color-border)' : '1px solid var(--color-border)',
              maxWidth: '440px',
              width: '100%',
              padding: '1.5rem',
              boxShadow: 'var(--shadow-lg)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: isRemovalBlocked ? 'var(--color-gold-bright)' : 'var(--color-red)' }}>
                <AlertTriangle size={20} />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: 'var(--color-text-primary)' }}>
                  {isRemovalBlocked ? 'Cannot Remove Competitor' : 'Remove Competitor?'}
                </h3>
              </div>
              <button
                onClick={() => setPlayerToRemove(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            {isRemovalBlocked ? (
              <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', lineHeight: 1.5, margin: 0 }}>
                {removalBlockReason}
              </p>
            ) : (
              <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', lineHeight: 1.5, margin: 0 }}>
                Are you sure you want to remove <strong style={{ color: 'var(--color-text-primary)' }}>{playerToRemove.name}</strong> from this tournament's roster? The competitor remains in the global player catalog.
              </p>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setPlayerToRemove(null)}
                className="btn btn-secondary"
                style={{ padding: '0.45rem 0.95rem', fontSize: '0.85rem' }}
              >
                {isRemovalBlocked ? 'Close' : 'Cancel'}
              </button>
              {!isRemovalBlocked && (
                <button
                  type="button"
                  onClick={handleConfirmRemove}
                  className="btn btn-primary"
                  style={{
                    padding: '0.45rem 1rem',
                    fontSize: '0.85rem',
                    background: 'var(--color-red)',
                    borderColor: 'var(--color-red)',
                  }}
                >
                  Remove Competitor
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </TournamentLayout>
  );
};
