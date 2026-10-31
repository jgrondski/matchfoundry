import React, { useState, useMemo, useEffect, useId, useRef } from 'react';
import {
  X,
  ArrowRight,
  ArrowLeft,
  ArrowUp,
  Search,
  Users,
  Layers,
  ShieldCheck,
  CheckSquare,
  Square,
  Globe,
} from 'lucide-react';
import { Tournament, PlayerProfile } from '../../types';
import { useTournament } from '../../store';
import { PlayerAvatar } from '../../../players/components/PlayerAvatar';
import { PlaystyleChip } from '../../../players/components/PlaystyleChip';
import { getEffectivePlayerName } from '../../../players/playerNameUtils';
import { Overlay } from '../../../../components/overlay';
import { Badge, Button, IconButton, cn } from '../../../../components/ui';

interface DualListSeedingModalProps {
  isOpen: boolean;
  onClose: () => void;
  tournament: Tournament;
}

export const DualListSeedingModal: React.FC<DualListSeedingModalProps> = ({
  isOpen,
  onClose,
  tournament,
}) => {
  const {
    globalPlayers,
    importPlayersToTournament,
    setManualSeeds,
    setSeedingMethod,
  } = useTournament();

  // Local staged seed order
  const [stagedSeeds, setStagedSeeds] = useState<string[]>([]);
  const initialSeedsRef = useRef<string[]>([]);
  const titleId = useId();
  // Available list selection tracking with ordered array to preserve exact click order
  const [selectedAvailableIds, setSelectedAvailableIds] = useState<string[]>([]);
  // Seeded list selection for removal
  const [selectedSeededIds, setSelectedSeededIds] = useState<Set<string>>(new Set());

  // Search filters
  const [availableSearch, setAvailableSearch] = useState('');
  const [seededSearch, setSeededSearch] = useState('');
  const [availableSourceTab, setAvailableSourceTab] = useState<'roster' | 'global'>('roster');

  // Track last clicked index for Shift-Click range selection
  const [lastClickedAvailableIdx, setLastClickedAvailableIdx] = useState<number | null>(null);
  const [lastClickedSeededIdx, setLastClickedSeededIdx] = useState<number | null>(null);

  // Initialize staged seeds from tournament on open
  useEffect(() => {
    if (isOpen) {
      setStagedSeeds(tournament.manualSeeds || []);
      initialSeedsRef.current = tournament.manualSeeds || [];
      setSelectedAvailableIds([]);
      setSelectedSeededIds(new Set());
      setAvailableSearch('');
      setSeededSearch('');
    }
  }, [isOpen, tournament.manualSeeds]);

  // Fast player lookup
  const playerMap = useMemo(() => {
    const map = new Map<string, PlayerProfile>();
    (tournament.playersPool || []).forEach(p => map.set(p.id, p));
    globalPlayers.forEach(p => {
      if (!map.has(p.id)) map.set(p.id, p);
    });
    return map;
  }, [tournament.playersPool, globalPlayers]);

  const stagedSet = useMemo(() => new Set(stagedSeeds), [stagedSeeds]);

  // Available players (roster + global, excluding staged)
  const availableCandidates = useMemo(() => {
    const rosterPlayers = (tournament.playersPool || []).filter(p => !stagedSet.has(p.id));
    const rosterIds = new Set((tournament.playersPool || []).map(p => p.id));
    const globalUnenrolled = globalPlayers.filter(
      p => !stagedSet.has(p.id) && !rosterIds.has(p.id)
    );

    return {
      roster: rosterPlayers,
      global: globalUnenrolled,
    };
  }, [tournament.playersPool, stagedSet, globalPlayers]);

  // Filtered available list based on active tab and search
  const filteredAvailable = useMemo(() => {
    const list = availableSourceTab === 'roster'
      ? availableCandidates.roster
      : availableCandidates.global;
    
    if (!availableSearch.trim()) return list;
    const term = availableSearch.toLowerCase();
    return list.filter(
      p =>
        getEffectivePlayerName(p).toLowerCase().includes(term) ||
        p.name.toLowerCase().includes(term) ||
        (p.country && p.country.toLowerCase().includes(term)) ||
        (p.playstyle && p.playstyle.toLowerCase().includes(term))
    );
  }, [availableSourceTab, availableCandidates, availableSearch]);

  // Filtered seeded list
  const filteredSeeded = useMemo(() => {
    const term = seededSearch.toLowerCase().trim();
    return stagedSeeds
      .map((id, index) => {
        const player = playerMap.get(id);
        return {
          id,
          seedNumber: index + 1,
          name: getEffectivePlayerName(player) || player?.name || 'Unknown Player',
          rawName: player?.name || '',
          country: player?.country,
          playstyle: player?.playstyle,
        };
      })
      .filter(item => {
        if (!term) return true;
        return (
          item.name.toLowerCase().includes(term) ||
          item.rawName.toLowerCase().includes(term) ||
          (item.country && item.country.toLowerCase().includes(term)) ||
          `#${item.seedNumber}`.includes(term)
        );
      });
  }, [stagedSeeds, playerMap, seededSearch]);

  // Compute tier cutoffs
  const sortedTiers = useMemo(
    () => [...(tournament.tiers || [])].sort((a, b) => a.priority - b.priority),
    [tournament.tiers]
  );

  const tierCutoffs = useMemo(() => {
    let running = 0;
    return sortedTiers.map(t => {
      const start = running + 1;
      const end = running + t.playerCount;
      running = end;
      return { tier: t, start, end, capacity: t.playerCount };
    });
  }, [sortedTiers]);

  const totalCapacity = useMemo(
    () => sortedTiers.reduce((acc, t) => acc + t.playerCount, 0),
    [sortedTiers]
  );

  if (!isOpen) return null;

  // Selection order map for available players
  const availableSelectionOrder = new Map<string, number>();
  selectedAvailableIds.forEach((id, idx) => availableSelectionOrder.set(id, idx + 1));

  // Toggle selection on available list with Shift-Click range support
  const handleToggleAvailable = (playerId: string, currentIndex: number, shiftKey: boolean) => {
    if (shiftKey && lastClickedAvailableIdx !== null) {
      const start = Math.min(lastClickedAvailableIdx, currentIndex);
      const end = Math.max(lastClickedAvailableIdx, currentIndex);
      const rangeSlice = filteredAvailable.slice(start, end + 1).map(p => p.id);

      setSelectedAvailableIds(prev => {
        const set = new Set(prev);
        const next = [...prev];
        rangeSlice.forEach(id => {
          if (!set.has(id)) {
            set.add(id);
            next.push(id);
          }
        });
        return next;
      });
    } else {
      setSelectedAvailableIds(prev => {
        if (prev.includes(playerId)) {
          return prev.filter(id => id !== playerId);
        } else {
          return [...prev, playerId];
        }
      });
      setLastClickedAvailableIdx(currentIndex);
    }
  };

  // Toggle selection on seeded list with Shift-Click range support
  const handleToggleSeeded = (playerId: string, currentIndex: number, shiftKey: boolean) => {
    if (shiftKey && lastClickedSeededIdx !== null) {
      const start = Math.min(lastClickedSeededIdx, currentIndex);
      const end = Math.max(lastClickedSeededIdx, currentIndex);
      const rangeSlice = filteredSeeded.slice(start, end + 1).map(item => item.id);

      setSelectedSeededIds(prev => {
        const next = new Set(prev);
        rangeSlice.forEach(id => next.add(id));
        return next;
      });
    } else {
      setSelectedSeededIds(prev => {
        const next = new Set(prev);
        if (next.has(playerId)) {
          next.delete(playerId);
        } else {
          next.add(playerId);
        }
        return next;
      });
      setLastClickedSeededIdx(currentIndex);
    }
  };

  // Select all filtered available
  const handleSelectAllAvailable = () => {
    const filteredIds = filteredAvailable.map(p => p.id);
    setSelectedAvailableIds(prev => {
      const set = new Set(prev);
      const next = [...prev];
      filteredIds.forEach(id => {
        if (!set.has(id)) {
          set.add(id);
          next.push(id);
        }
      });
      return next;
    });
  };

  const handleClearAvailableSelection = () => {
    setSelectedAvailableIds([]);
    setLastClickedAvailableIdx(null);
  };

  // Select all filtered seeded
  const handleSelectAllSeeded = () => {
    const filteredIds = filteredSeeded.map(item => item.id);
    setSelectedSeededIds(new Set(filteredIds));
  };

  const handleClearSeededSelection = () => {
    setSelectedSeededIds(new Set());
    setLastClickedSeededIdx(null);
  };

  // Transfer Actions
  const handleTransferToBottom = () => {
    if (selectedAvailableIds.length === 0) return;
    setStagedSeeds(prev => [...prev, ...selectedAvailableIds]);
    setSelectedAvailableIds([]);
    setLastClickedAvailableIdx(null);
  };

  const handleTransferToTop = () => {
    if (selectedAvailableIds.length === 0) return;
    setStagedSeeds(prev => [...selectedAvailableIds, ...prev]);
    setSelectedAvailableIds([]);
    setLastClickedAvailableIdx(null);
  };

  const handleRemoveSelectedSeeded = () => {
    if (selectedSeededIds.size === 0) return;
    setStagedSeeds(prev => prev.filter(id => !selectedSeededIds.has(id)));
    setSelectedSeededIds(new Set());
    setLastClickedSeededIdx(null);
  };

  // Commit and close
  const handleApply = () => {
    // Check if any staged seeds are from the global catalog and need to be added to tournament roster
    const tourneyRosterIds = new Set((tournament.playersPool || []).map(p => p.id));
    const toImportFromGlobal: PlayerProfile[] = [];
    stagedSeeds.forEach(id => {
      if (!tourneyRosterIds.has(id)) {
        const player = playerMap.get(id);
        if (player) toImportFromGlobal.push(player);
      }
    });

    if (toImportFromGlobal.length > 0) {
      importPlayersToTournament(tournament.id, toImportFromGlobal);
    }

    setManualSeeds(tournament.id, stagedSeeds);
    if (tournament.seedingMethod !== 'MANUAL') {
      setSeedingMethod(tournament.id, 'MANUAL');
    }

    onClose();
  };

  return (
    <Overlay
      open
      onClose={onClose}
      dirty={JSON.stringify(stagedSeeds) !== JSON.stringify(initialSeedsRef.current)}
      aria-labelledby={titleId}
      panelClassName="flex h-[85vh] max-h-212.5 w-[95vw] max-w-275 flex-col overflow-hidden rounded-lg border border-line bg-surface shadow-[0_25px_50px_-12px_rgba(0,0,0,0.6)]"
    >
      {({ requestClose }) => (
        <>
          {/* Header */}
          <div className="flex items-center justify-between border-b border-line bg-elevated px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-md bg-seed-indigo/15 text-brand">
                <Users size={20} />
              </div>
              <div>
                <h2 id={titleId} className="m-0 text-lg font-extrabold text-fg">
                  Multi-Select Seeding Shuttle
                </h2>
                <p className="m-0 text-caption text-fg-muted">
                  Select competitors on the left in the desired seed order and transfer them to the seeded roster on the right.
                </p>
              </div>
            </div>

            <IconButton
              aria-label="Close"
              onClick={requestClose}
              className="p-1.5"
              title="Close without saving"
            >
              <X size={20} />
            </IconButton>
          </div>

          {/* Dual List Body */}
          <div className="grid min-h-0 flex-1 grid-cols-[1fr_140px_1fr] overflow-hidden">
            {/* Left Panel: Available Players */}
            <div className="flex min-h-0 flex-col border-r border-line bg-surface">
              {/* Source Tabs & Search */}
              <div className="flex flex-col gap-2.5 border-b border-line-subtle bg-elevated px-4 py-3.5">
                {/* Tabs */}
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setAvailableSourceTab('roster');
                      setLastClickedAvailableIdx(null);
                    }}
                    className={cn(
                      'flex-1 cursor-pointer rounded-sm border px-2.5 py-1.5 text-caption',
                      availableSourceTab === 'roster'
                        ? 'border-brand bg-seed-indigo/15 font-bold text-brand'
                        : 'border-line bg-surface font-medium text-fg-secondary'
                    )}
                  >
                    Tournament Roster ({availableCandidates.roster.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAvailableSourceTab('global');
                      setLastClickedAvailableIdx(null);
                    }}
                    className={cn(
                      'flex flex-1 cursor-pointer items-center justify-center gap-1 rounded-sm border px-2.5 py-1.5 text-caption',
                      availableSourceTab === 'global'
                        ? 'border-gold-bright bg-gold/15 font-bold text-gold-bright'
                        : 'border-line bg-surface font-medium text-fg-secondary'
                    )}
                  >
                    <Globe size={13} />
                    Global Pool ({availableCandidates.global.length})
                  </button>
                </div>

                {/* Search Bar */}
                <div className="relative">
                  <Search
                    size={14}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-muted"
                  />
                  <input
                    type="text"
                    placeholder="Filter available competitors..."
                    value={availableSearch}
                    onChange={e => setAvailableSearch(e.target.value)}
                    className="w-full rounded-sm border border-line bg-surface py-1.5 pl-8 pr-2.5 text-caption text-fg"
                  />
                </div>

                {/* Selection Summary & Quick Actions */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-fg-muted">
                    Selected: <strong className="text-brand">{selectedAvailableIds.length}</strong> of {filteredAvailable.length}
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleSelectAllAvailable}
                      className="cursor-pointer border-0 bg-transparent p-0 text-xs text-brand"
                    >
                      Select All
                    </button>
                    <span className="text-line">•</span>
                    <button
                      type="button"
                      onClick={handleClearAvailableSelection}
                      className="cursor-pointer border-0 bg-transparent p-0 text-xs text-fg-muted"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              </div>

              {/* Available Player List */}
              <div className="flex-1 overflow-y-auto p-2">
                {filteredAvailable.length === 0 ? (
                  <div className="px-4 py-8 text-center text-caption text-fg-muted">
                    No available competitors found.
                  </div>
                ) : (
                  <div className="flex flex-col gap-1">
                    {filteredAvailable.map((player, idx) => {
                      const isSelected = selectedAvailableIds.includes(player.id);
                      const orderNumber = availableSelectionOrder.get(player.id);

                      return (
                        <div
                          key={player.id}
                          onClick={e => handleToggleAvailable(player.id, idx, e.shiftKey)}
                          className={cn(
                            'flex cursor-pointer select-none items-center justify-between rounded-sm border px-2.5 py-2 transition-colors duration-100',
                            isSelected ? 'border-brand bg-seed-indigo/12' : 'border-line-subtle bg-elevated'
                          )}
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            {/* Order Badge or Checkbox */}
                            {isSelected ? (
                              <div
                                className="flex size-5.5 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-extrabold text-white"
                                title={`Transfer Order: ${orderNumber}`}
                              >
                                {orderNumber}
                              </div>
                            ) : (
                              <Square size={16} color="var(--color-fg-muted)" className="shrink-0" />
                            )}

                            <span className="truncate text-sm font-semibold text-fg">
                              {getEffectivePlayerName(player)}
                            </span>
                          </div>

                          <div className="flex shrink-0 items-center gap-1.5">
                            <PlayerAvatar player={player} />
                            {player.playstyle && <PlaystyleChip style={player.playstyle} />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Center Shuttle Controls */}
            <div className="flex flex-col items-center justify-center gap-3 border-r border-line bg-elevated px-2 py-4">
              {/* Add to Bottom */}
              <Button
                variant="primary"
                disabled={selectedAvailableIds.length === 0}
                onClick={handleTransferToBottom}
                className="flex w-full flex-col items-center gap-1 px-1.5 py-2 text-xs"
                title="Add selected competitors to the bottom of the seed list in the order selected"
              >
                <div className="flex items-center gap-1">
                  <span>Add Bottom</span>
                  <ArrowRight size={13} />
                </div>
                {selectedAvailableIds.length > 0 && (
                  <span className="text-2xs opacity-85">
                    ({selectedAvailableIds.length} players)
                  </span>
                )}
              </Button>

              {/* Add to Top */}
              <Button
                variant="secondary"
                disabled={selectedAvailableIds.length === 0}
                onClick={handleTransferToTop}
                className="flex w-full flex-col items-center gap-1 px-1.5 py-2 text-xs"
                title="Insert selected competitors at the top (Seed #1..N) in the order selected"
              >
                <div className="flex items-center gap-1">
                  <ArrowUp size={13} />
                  <span>Add Top</span>
                </div>
                {selectedAvailableIds.length > 0 && (
                  <span className="text-2xs text-fg-muted">
                    ({selectedAvailableIds.length} players)
                  </span>
                )}
              </Button>

              <div className="my-1 h-px w-4/5 bg-line" />

              {/* Remove Selected from Seeded */}
              <Button
                variant="secondary"
                disabled={selectedSeededIds.size === 0}
                onClick={handleRemoveSelectedSeeded}
                className={cn(
                  'flex w-full flex-col items-center gap-1 px-1.5 py-2 text-xs',
                  selectedSeededIds.size > 0 ? 'border-red text-red enabled:hover:border-red' : 'border-line text-fg-muted'
                )}
                title="Remove selected competitors from seeded list back to available pool"
              >
                <div className="flex items-center gap-1">
                  <ArrowLeft size={13} />
                  <span>Remove</span>
                </div>
                {selectedSeededIds.size > 0 && (
                  <span className="text-2xs opacity-85">
                    ({selectedSeededIds.size} selected)
                  </span>
                )}
              </Button>
            </div>

            {/* Right Panel: Staged Seeded List */}
            <div className="flex min-h-0 flex-col bg-surface">
              {/* Header & Search */}
              <div className="flex flex-col gap-2.5 border-b border-line-subtle bg-elevated px-4 py-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Layers size={16} color="var(--color-gold-bright)" />
                    <span className="text-sm font-bold text-fg">
                      Seeded Roster ({stagedSeeds.length} competitors)
                    </span>
                  </div>
                  {stagedSeeds.length >= totalCapacity && totalCapacity > 0 ? (
                    <Badge variant="green" className="px-1.5 py-0.5 text-2xs">
                      <ShieldCheck size={11} /> All Tiers Filled
                    </Badge>
                  ) : (
                    <Badge variant="gold" className="px-1.5 py-0.5 text-2xs">
                      {totalCapacity - stagedSeeds.length} slots remain
                    </Badge>
                  )}
                </div>

                {/* Search Bar */}
                <div className="relative">
                  <Search
                    size={14}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-muted"
                  />
                  <input
                    type="text"
                    placeholder="Filter seeded competitors..."
                    value={seededSearch}
                    onChange={e => setSeededSearch(e.target.value)}
                    className="w-full rounded-sm border border-line bg-surface py-1.5 pl-8 pr-2.5 text-caption text-fg"
                  />
                </div>

                {/* Selection Summary & Quick Actions */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-fg-muted">
                    Selected for removal: <strong className="text-red">{selectedSeededIds.size}</strong>
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleSelectAllSeeded}
                      className="cursor-pointer border-0 bg-transparent p-0 text-xs text-brand"
                    >
                      Select All
                    </button>
                    <span className="text-line">•</span>
                    <button
                      type="button"
                      onClick={handleClearSeededSelection}
                      className="cursor-pointer border-0 bg-transparent p-0 text-xs text-fg-muted"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              </div>

              {/* Seeded Player List with Tier Cutoff Banners */}
              <div className="flex-1 overflow-y-auto p-2">
                {filteredSeeded.length === 0 ? (
                  <div className="px-4 py-8 text-center text-caption text-fg-muted">
                    {stagedSeeds.length === 0
                      ? 'No competitors seeded yet. Select players from the left and click Add.'
                      : 'No seeds match your search query.'}
                  </div>
                ) : (
                  <div className="flex flex-col gap-1">
                    {filteredSeeded.map((item, idx) => {
                      const isSelected = selectedSeededIds.has(item.id);
                      const cutoff = tierCutoffs.find(c => c.start === item.seedNumber);
                      const isReserves = item.seedNumber === totalCapacity + 1;

                      return (
                        <React.Fragment key={item.id}>
                          {/* Tier Divider Banner */}
                          {cutoff && (
                            <div
                              className="mb-0.5 mt-1 flex items-center justify-between rounded-sm border-l-4 px-2.5 py-1.5"
                              style={{
                                backgroundColor: cutoff.tier.cardColor || 'rgba(245, 158, 11, 0.08)',
                                borderLeftColor: cutoff.tier.primaryColor || 'var(--color-gold-bright)',
                              }}
                            >
                              <span
                                className="text-xs font-extrabold uppercase"
                                style={{ color: cutoff.tier.primaryColor || 'var(--color-gold-bright)' }}
                              >
                                {cutoff.tier.name} (Seeds {cutoff.start}–{cutoff.end})
                              </span>
                              <span className="text-2xs text-fg-muted">
                                Tier {cutoff.tier.priority}
                              </span>
                            </div>
                          )}

                          {/* Reserves Divider */}
                          {isReserves && (
                            <div className="mb-0.5 mt-1 rounded-sm border-l-4 border-fg-muted bg-fg-muted/8 px-2.5 py-1.5">
                              <span className="text-xs font-bold uppercase text-fg-secondary">
                                Alternates / DNQ Pool (Seeds {totalCapacity + 1}+)
                              </span>
                            </div>
                          )}

                          {/* Seeded Row */}
                          <div
                            onClick={e => handleToggleSeeded(item.id, idx, e.shiftKey)}
                            className={cn(
                              'flex cursor-pointer select-none items-center justify-between rounded-sm border px-2.5 py-2',
                              isSelected ? 'border-red bg-red/12' : 'border-line-subtle bg-elevated'
                            )}
                          >
                            <div className="flex min-w-0 items-center gap-2">
                              {isSelected ? (
                                <CheckSquare size={16} color="var(--color-red)" className="shrink-0" />
                              ) : (
                                <Square size={16} color="var(--color-fg-muted)" className="shrink-0" />
                              )}

                              <span className="min-w-8 text-caption font-extrabold text-gold-bright">
                                #{item.seedNumber}
                              </span>

                              <span className="truncate text-sm font-semibold text-fg">
                                {item.name}
                              </span>
                            </div>

                            <div className="flex shrink-0 items-center gap-1.5">
                              <PlayerAvatar player={item} />
                              {item.playstyle && <PlaystyleChip style={item.playstyle} />}
                            </div>
                          </div>
                        </React.Fragment>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-line bg-elevated px-6 py-4">
            <div className="text-caption text-fg-muted">
              <strong>{stagedSeeds.length}</strong> total seeded competitors staging
            </div>

            <div className="flex items-center gap-3">
              <Button variant="secondary" onClick={requestClose}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleApply} className="gap-1.5 px-5">
                <ShieldCheck size={16} />
                Apply & Save Seeds ({stagedSeeds.length})
              </Button>
            </div>
          </div>
        </>
      )}
    </Overlay>
  );
};
