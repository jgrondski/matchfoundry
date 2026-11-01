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
  Layers,
  Edit2,
} from 'lucide-react';
import { LoadingScreen } from '../components/LoadingScreen';
import { isPlaceholderSubmissionStatus } from '../features/online-quals/onlineQualsStatus';
import { ConfirmDialog } from '../components/overlay';
import { Button, cn } from '../components/ui';

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
    return tournament.qualifierSubmissions.filter(
      s => s.playerId === playerToRemove.id && !isPlaceholderSubmissionStatus(s.status)
    ).length;
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
      <div className="p-12 text-center text-fg-secondary">
        <h2 className="text-2xl font-bold">Tournament Not Found</h2>
        <Button variant="primary" onClick={() => navigate('/')} className="mt-4">
          Back to Tournaments
        </Button>
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
      <main className="mx-auto flex w-full max-w-275 flex-1 flex-col gap-6 px-6 py-8">
        {/* Header Section */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <span className="text-caption font-bold tracking-widest text-gold-bright uppercase">
                Competitor Roster
              </span>
            </div>
            <h1 className="m-0 flex items-center gap-2.5 text-3xl font-extrabold tracking-tight text-white">
              <Users color="var(--color-gold-bright)" size={28} />
              {tournament.name}
            </h1>
            <p className="mt-1.5 text-sm text-fg-muted">
              Manage registered competitors and seeding for this tournament.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              variant="secondary"
              onClick={() => setIsImportModalOpen(true)}
              className="gap-2 px-4 py-2 text-sm"
            >
              <Download size={15} color="var(--color-gold-bright)" />
              Import from Global Pool
            </Button>
            {availableGlobalPlayers.length > 0 && (
              <Button
                variant="secondary"
                onClick={handleImportAllGlobal}
                className="gap-2 px-4 py-2 text-sm"
                title={`Import all ${availableGlobalPlayers.length} available players from global catalog`}
              >
                <DownloadCloud size={15} className="text-sky-400" />
                Import All Available ({availableGlobalPlayers.length})
              </Button>
            )}
            {tournament.seedingMethod === 'MANUAL' && (
              <Button
                variant="secondary"
                onClick={() => navigate(`/${tournament.slug}/manage/seeding`)}
                className="gap-2 px-4 py-2 text-sm"
                title="Open Seeding Manager to arrange seeds and tier cutoffs"
              >
                <Layers size={15} color="var(--color-brand)" />
                Arrange Seeds & Brackets
              </Button>
            )}
            <Button
              variant="primary"
              onClick={() => setIsRegisterModalOpen(true)}
              className="gap-2 px-4.5 py-2 text-sm"
            >
              <UserPlus size={15} />
              Register Competitor
            </Button>
          </div>
        </div>

        {/* Capacity & Roster Metrics */}
        <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
          <div className="rounded-md border border-line bg-surface px-5 py-4">
            <div className="text-xs font-semibold tracking-wide text-fg-muted uppercase">
              Registered Competitors
            </div>
            <div className={cn('mt-1 text-3xl font-extrabold', currentPlayers.length > 0 ? 'text-gold-bright' : 'text-fg-secondary')}>
              {currentPlayers.length}
            </div>
          </div>

          <div className="rounded-md border border-line bg-surface px-5 py-4">
            <div className="text-xs font-semibold tracking-wide text-fg-muted uppercase">
              Total Bracket Capacity
            </div>
            <div className="mt-1 text-3xl font-extrabold text-fg">
              {totalCapacity > 0 ? totalCapacity : '—'}
            </div>
          </div>

          <div className="rounded-md border border-line bg-surface px-5 py-4">
            <div className="text-xs font-semibold tracking-wide text-fg-muted uppercase">
              Roster Status
            </div>
            <div className="mt-2 text-base font-bold">
              {totalCapacity === 0 ? (
                <span className="text-fg-muted">
                  No tiers configured ({currentPlayers.length} in qualifiers)
                </span>
              ) : currentPlayers.length < totalCapacity ? (
                <span className="text-gold-bright">
                  Underfilled ({currentPlayers.length}/{totalCapacity})
                </span>
              ) : currentPlayers.length === totalCapacity ? (
                <span className="text-green-400">
                  Full Capacity ({totalCapacity}/{totalCapacity})
                </span>
              ) : (
                <span className="text-blue-400">
                  Ready ({totalCapacity} in brackets + {currentPlayers.length - totalCapacity} DNQ)
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Competitor Table Container */}
        <div className="flex flex-col gap-4 overflow-hidden rounded-lg border border-line bg-surface p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative w-70">
              <input
                type="text"
                placeholder="Search competitors by name, country, or playstyle..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full rounded-sm border border-line bg-canvas py-2 pr-3 pl-8.5 text-sm text-fg"
              />
              <Search
                size={15}
                color="var(--color-fg-muted)"
                className="absolute top-1/2 left-2.5 -translate-y-1/2"
              />
            </div>

            <span className="text-caption text-fg-muted">
              Showing {filteredPlayers.length} of {currentPlayers.length} registered {currentPlayers.length === 1 ? 'competitor' : 'competitors'}
            </span>
          </div>

          {currentPlayers.length === 0 ? (
            <div className="flex flex-col items-center gap-3.5 rounded-md border border-dashed border-line bg-canvas px-6 py-12 text-center">
              <Users size={36} color="var(--color-fg-muted)" />
              <p className="m-0 text-base text-fg-secondary">
                No competitors registered in this tournament yet.
              </p>
              <p className="m-0 max-w-105 text-caption text-fg-muted">
                Register competitors directly or import them from the global player pool to begin recording qualifier scores.
              </p>
              <div className="mt-2 flex flex-wrap justify-center gap-3">
                <Button
                  variant="secondary"
                  onClick={() => setIsImportModalOpen(true)}
                  className="flex items-center gap-1.5 text-sm"
                >
                  <Download size={14} color="var(--color-gold-bright)" />
                  Import from Global Pool
                </Button>
                {availableGlobalPlayers.length > 0 && (
                  <Button
                    variant="secondary"
                    onClick={handleImportAllGlobal}
                    className="flex items-center gap-1.5 text-sm"
                  >
                    <DownloadCloud size={14} className="text-sky-400" />
                    Import All Available ({availableGlobalPlayers.length})
                  </Button>
                )}
                <Button
                  variant="primary"
                  onClick={() => setIsRegisterModalOpen(true)}
                  className="flex items-center gap-1.5 text-sm"
                >
                  <UserPlus size={14} />
                  Register Competitor
                </Button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-md border border-line">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-line bg-elevated text-fg-muted">
                    <th className="w-11.25 px-4 py-3 text-center">#</th>
                    <th className="min-w-45 px-4 py-3">Competitor</th>
                    <th className="w-25 px-4 py-3">Country</th>
                    <th className="w-30 px-4 py-3">Playstyle</th>
                    <th className="w-35 px-4 py-3">Personal Best</th>
                    <th className="w-27.5 px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPlayers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-fg-muted">
                        No competitors matching "{searchTerm}".
                      </td>
                    </tr>
                  ) : (
                    filteredPlayers.map((player, pIdx) => (
                      <tr
                        key={player.id}
                        className={cn('border-b border-line-subtle', pIdx % 2 === 0 ? 'bg-transparent' : 'bg-white/2')}
                      >
                        <td className="px-4 py-3 text-center text-fg-muted">
                          {pIdx + 1}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <PlayerAvatar player={player} />
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedPlayerForDrawer(player);
                                setIsPlayerDrawerOpen(true);
                              }}
                              className="cursor-pointer border-0 bg-transparent p-0 text-left text-[length:inherit] font-semibold text-fg transition-colors duration-150 hover:text-gold-bright hover:underline"
                              title="Click to view detailed competitor profile, audit log, and match stats"
                            >
                              {getEffectivePlayerName(player)}
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {player.country ? (
                            <span className="inline-flex items-center gap-1.5 rounded-sm bg-highlight px-2 py-0.5 text-xs font-bold">
                              <PlayerAvatar player={player} country={player.country} />
                              <span>{player.country}</span>
                            </span>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <PlaystyleChip style={player.playstyle} />
                        </td>
                        <td className="px-4 py-3 font-mono font-semibold tabular-nums tracking-tight">
                          {player.personalBest ? player.personalBest.toLocaleString() : '—'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              variant="secondary"
                              onClick={() => {
                                setEditingPlayer(player);
                                setIsEditModalOpen(true);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs"
                              title="Edit competitor profile"
                            >
                              <Edit2 size={13} /> Edit
                            </Button>
                            <Button
                              variant="secondary"
                              onClick={() => setPlayerToRemove(player)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-red"
                              title="Remove competitor from tournament roster"
                            >
                              <UserX size={14} /> Remove
                            </Button>
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
      <ConfirmDialog
        open={playerToRemove !== null}
        tone={isRemovalBlocked ? 'warning' : 'danger'}
        title={isRemovalBlocked ? 'Cannot Remove Competitor' : 'Remove Competitor?'}
        body={
          isRemovalBlocked ? (
            <p className="leading-normal text-fg-secondary">{removalBlockReason}</p>
          ) : (
            <p className="leading-normal text-fg-secondary">
              Are you sure you want to remove <strong className="text-fg">{playerToRemove?.name}</strong> from this tournament's roster? The competitor remains in the global player catalog.
            </p>
          )
        }
        cancelLabel={isRemovalBlocked ? 'Close' : 'Cancel'}
        confirmLabel="Remove Competitor"
        confirmDisabled={isRemovalBlocked}
        onCancel={() => setPlayerToRemove(null)}
        onConfirm={handleConfirmRemove}
      />
    </TournamentLayout>
  );
};
