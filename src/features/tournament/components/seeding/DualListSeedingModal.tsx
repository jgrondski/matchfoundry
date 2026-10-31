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
          <div
            style={{
              padding: '1rem 1.5rem',
              borderBottom: '1px solid var(--color-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'var(--color-bg-surface-elevated)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'rgba(99, 102, 241, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--color-brand)',
                }}
              >
                <Users size={20} />
              </div>
              <div>
                <h2 id={titleId} style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                  Multi-Select Seeding Shuttle
                </h2>
                <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                  Select competitors on the left in the desired seed order and transfer them to the seeded roster on the right.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={requestClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--color-text-muted)',
                cursor: 'pointer',
                padding: '0.35rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 'var(--radius-sm)',
              }}
              title="Close without saving"
            >
              <X size={20} />
            </button>
          </div>

          {/* Dual List Body */}
          <div
            style={{
              flex: 1,
              display: 'grid',
              gridTemplateColumns: '1fr 140px 1fr',
              minHeight: 0,
              overflow: 'hidden',
            }}
          >
            {/* Left Panel: Available Players */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                borderRight: '1px solid var(--color-border)',
                minHeight: 0,
                background: 'var(--color-bg-surface)',
              }}
            >
              {/* Source Tabs & Search */}
              <div
                style={{
                  padding: '0.85rem 1rem',
                  borderBottom: '1px solid var(--color-border-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.65rem',
                  background: 'var(--color-bg-surface-elevated)',
                }}
              >
                {/* Tabs */}
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setAvailableSourceTab('roster');
                      setLastClickedAvailableIdx(null);
                    }}
                    style={{
                      flex: 1,
                      padding: '0.4rem 0.6rem',
                      fontSize: '0.78rem',
                      fontWeight: availableSourceTab === 'roster' ? 700 : 500,
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid',
                      borderColor: availableSourceTab === 'roster' ? 'var(--color-brand)' : 'var(--color-border)',
                      background: availableSourceTab === 'roster' ? 'rgba(99, 102, 241, 0.15)' : 'var(--color-bg-surface)',
                      color: availableSourceTab === 'roster' ? 'var(--color-brand)' : 'var(--color-text-secondary)',
                      cursor: 'pointer',
                    }}
                  >
                    Tournament Roster ({availableCandidates.roster.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAvailableSourceTab('global');
                      setLastClickedAvailableIdx(null);
                    }}
                    style={{
                      flex: 1,
                      padding: '0.4rem 0.6rem',
                      fontSize: '0.78rem',
                      fontWeight: availableSourceTab === 'global' ? 700 : 500,
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid',
                      borderColor: availableSourceTab === 'global' ? 'var(--color-gold-bright)' : 'var(--color-border)',
                      background: availableSourceTab === 'global' ? 'rgba(245, 158, 11, 0.15)' : 'var(--color-bg-surface)',
                      color: availableSourceTab === 'global' ? 'var(--color-gold-bright)' : 'var(--color-text-secondary)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.3rem',
                    }}
                  >
                    <Globe size={13} />
                    Global Pool ({availableCandidates.global.length})
                  </button>
                </div>

                {/* Search Bar */}
                <div style={{ position: 'relative' }}>
                  <Search
                    size={14}
                    style={{
                      position: 'absolute',
                      left: '0.65rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--color-text-muted)',
                    }}
                  />
                  <input
                    type="text"
                    placeholder="Filter available competitors..."
                    value={availableSearch}
                    onChange={e => setAvailableSearch(e.target.value)}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '0.35rem 0.65rem 0.35rem 2rem',
                      backgroundColor: 'var(--color-bg-surface)',
                      color: 'var(--color-text-primary)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.8rem',
                    }}
                  />
                </div>

                {/* Selection Summary & Quick Actions */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>
                    Selected: <strong style={{ color: 'var(--color-brand)' }}>{selectedAvailableIds.length}</strong> of {filteredAvailable.length}
                  </span>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={handleSelectAllAvailable}
                      style={{ background: 'transparent', border: 'none', color: 'var(--color-brand)', cursor: 'pointer', fontSize: '0.75rem', padding: 0 }}
                    >
                      Select All
                    </button>
                    <span style={{ color: 'var(--color-border)' }}>•</span>
                    <button
                      type="button"
                      onClick={handleClearAvailableSelection}
                      style={{ background: 'transparent', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: '0.75rem', padding: 0 }}
                    >
                      Clear
                    </button>
                  </div>
                </div>
              </div>

              {/* Available Player List */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
                {filteredAvailable.length === 0 ? (
                  <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '2rem 1rem', fontSize: '0.82rem' }}>
                    No available competitors found.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    {filteredAvailable.map((player, idx) => {
                      const isSelected = selectedAvailableIds.includes(player.id);
                      const orderNumber = availableSelectionOrder.get(player.id);

                      return (
                        <div
                          key={player.id}
                          onClick={e => handleToggleAvailable(player.id, idx, e.shiftKey)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0.45rem 0.65rem',
                            borderRadius: 'var(--radius-sm)',
                            backgroundColor: isSelected ? 'rgba(99, 102, 241, 0.12)' : 'var(--color-bg-surface-elevated)',
                            border: `1px solid ${isSelected ? 'var(--color-brand)' : 'var(--color-border-subtle)'}`,
                            cursor: 'pointer',
                            userSelect: 'none',
                            transition: 'background-color 0.1s ease',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                            {/* Order Badge or Checkbox */}
                            {isSelected ? (
                              <div
                                style={{
                                  width: 22,
                                  height: 22,
                                  borderRadius: 'var(--radius-full)',
                                  backgroundColor: 'var(--color-brand)',
                                  color: '#ffffff',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '0.75rem',
                                  fontWeight: 800,
                                  flexShrink: 0,
                                }}
                                title={`Transfer Order: ${orderNumber}`}
                              >
                                {orderNumber}
                              </div>
                            ) : (
                              <Square size={16} color="var(--color-text-muted)" style={{ flexShrink: 0 }} />
                            )}

                            <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {getEffectivePlayerName(player)}
                            </span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }}>
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
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.75rem',
                padding: '1rem 0.5rem',
                background: 'var(--color-bg-surface-elevated)',
                borderRight: '1px solid var(--color-border)',
              }}
            >
              {/* Add to Bottom */}
              <button
                type="button"
                disabled={selectedAvailableIds.length === 0}
                onClick={handleTransferToBottom}
                className="btn btn-primary"
                style={{
                  width: '100%',
                  fontSize: '0.75rem',
                  padding: '0.5rem 0.4rem',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.25rem',
                  opacity: selectedAvailableIds.length === 0 ? 0.4 : 1,
                  cursor: selectedAvailableIds.length === 0 ? 'not-allowed' : 'pointer',
                }}
                title="Add selected competitors to the bottom of the seed list in the order selected"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <span>Add Bottom</span>
                  <ArrowRight size={13} />
                </div>
                {selectedAvailableIds.length > 0 && (
                  <span style={{ fontSize: '0.68rem', opacity: 0.85 }}>
                    ({selectedAvailableIds.length} players)
                  </span>
                )}
              </button>

              {/* Add to Top */}
              <button
                type="button"
                disabled={selectedAvailableIds.length === 0}
                onClick={handleTransferToTop}
                className="btn btn-secondary"
                style={{
                  width: '100%',
                  fontSize: '0.75rem',
                  padding: '0.5rem 0.4rem',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.25rem',
                  opacity: selectedAvailableIds.length === 0 ? 0.4 : 1,
                  cursor: selectedAvailableIds.length === 0 ? 'not-allowed' : 'pointer',
                }}
                title="Insert selected competitors at the top (Seed #1..N) in the order selected"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <ArrowUp size={13} />
                  <span>Add Top</span>
                </div>
                {selectedAvailableIds.length > 0 && (
                  <span style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)' }}>
                    ({selectedAvailableIds.length} players)
                  </span>
                )}
              </button>

              <div style={{ width: '80%', height: '1px', background: 'var(--color-border)', margin: '0.25rem 0' }} />

              {/* Remove Selected from Seeded */}
              <button
                type="button"
                disabled={selectedSeededIds.size === 0}
                onClick={handleRemoveSelectedSeeded}
                className="btn btn-secondary"
                style={{
                  width: '100%',
                  fontSize: '0.75rem',
                  padding: '0.5rem 0.4rem',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.25rem',
                  borderColor: selectedSeededIds.size > 0 ? 'var(--color-red)' : 'var(--color-border)',
                  color: selectedSeededIds.size > 0 ? 'var(--color-red)' : 'var(--color-text-muted)',
                  opacity: selectedSeededIds.size === 0 ? 0.4 : 1,
                  cursor: selectedSeededIds.size === 0 ? 'not-allowed' : 'pointer',
                }}
                title="Remove selected competitors from seeded list back to available pool"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <ArrowLeft size={13} />
                  <span>Remove</span>
                </div>
                {selectedSeededIds.size > 0 && (
                  <span style={{ fontSize: '0.68rem', opacity: 0.85 }}>
                    ({selectedSeededIds.size} selected)
                  </span>
                )}
              </button>
            </div>

            {/* Right Panel: Staged Seeded List */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                minHeight: 0,
                background: 'var(--color-bg-surface)',
              }}
            >
              {/* Header & Search */}
              <div
                style={{
                  padding: '0.85rem 1rem',
                  borderBottom: '1px solid var(--color-border-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.65rem',
                  background: 'var(--color-bg-surface-elevated)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Layers size={16} color="var(--color-gold-bright)" />
                    <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                      Seeded Roster ({stagedSeeds.length} competitors)
                    </span>
                  </div>
                  {stagedSeeds.length >= totalCapacity && totalCapacity > 0 ? (
                    <span className="badge badge-green" style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem' }}>
                      <ShieldCheck size={11} /> All Tiers Filled
                    </span>
                  ) : (
                    <span className="badge badge-gold" style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem' }}>
                      {totalCapacity - stagedSeeds.length} slots remain
                    </span>
                  )}
                </div>

                {/* Search Bar */}
                <div style={{ position: 'relative' }}>
                  <Search
                    size={14}
                    style={{
                      position: 'absolute',
                      left: '0.65rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--color-text-muted)',
                    }}
                  />
                  <input
                    type="text"
                    placeholder="Filter seeded competitors..."
                    value={seededSearch}
                    onChange={e => setSeededSearch(e.target.value)}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '0.35rem 0.65rem 0.35rem 2rem',
                      backgroundColor: 'var(--color-bg-surface)',
                      color: 'var(--color-text-primary)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.8rem',
                    }}
                  />
                </div>

                {/* Selection Summary & Quick Actions */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>
                    Selected for removal: <strong style={{ color: 'var(--color-red)' }}>{selectedSeededIds.size}</strong>
                  </span>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={handleSelectAllSeeded}
                      style={{ background: 'transparent', border: 'none', color: 'var(--color-brand)', cursor: 'pointer', fontSize: '0.75rem', padding: 0 }}
                    >
                      Select All
                    </button>
                    <span style={{ color: 'var(--color-border)' }}>•</span>
                    <button
                      type="button"
                      onClick={handleClearSeededSelection}
                      style={{ background: 'transparent', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: '0.75rem', padding: 0 }}
                    >
                      Clear
                    </button>
                  </div>
                </div>
              </div>

              {/* Seeded Player List with Tier Cutoff Banners */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
                {filteredSeeded.length === 0 ? (
                  <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '2rem 1rem', fontSize: '0.82rem' }}>
                    {stagedSeeds.length === 0
                      ? 'No competitors seeded yet. Select players from the left and click Add.'
                      : 'No seeds match your search query.'}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    {filteredSeeded.map((item, idx) => {
                      const isSelected = selectedSeededIds.has(item.id);
                      const cutoff = tierCutoffs.find(c => c.start === item.seedNumber);
                      const isReserves = item.seedNumber === totalCapacity + 1;

                      return (
                        <React.Fragment key={item.id}>
                          {/* Tier Divider Banner */}
                          {cutoff && (
                            <div
                              style={{
                                padding: '0.35rem 0.65rem',
                                backgroundColor: cutoff.tier.cardColor || 'rgba(245, 158, 11, 0.08)',
                                borderLeft: `4px solid ${cutoff.tier.primaryColor || 'var(--color-gold-bright)'}`,
                                borderRadius: 'var(--radius-sm)',
                                margin: '0.3rem 0 0.15rem 0',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                              }}
                            >
                              <span style={{ fontSize: '0.74rem', fontWeight: 800, color: cutoff.tier.primaryColor || 'var(--color-gold-bright)', textTransform: 'uppercase' }}>
                                {cutoff.tier.name} (Seeds {cutoff.start}–{cutoff.end})
                              </span>
                              <span style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)' }}>
                                Tier {cutoff.tier.priority}
                              </span>
                            </div>
                          )}

                          {/* Reserves Divider */}
                          {isReserves && (
                            <div
                              style={{
                                padding: '0.35rem 0.65rem',
                                backgroundColor: 'rgba(100, 116, 139, 0.08)',
                                borderLeft: '4px solid var(--color-text-muted)',
                                borderRadius: 'var(--radius-sm)',
                                margin: '0.3rem 0 0.15rem 0',
                              }}
                            >
                              <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                                Alternates / DNQ Pool (Seeds {totalCapacity + 1}+)
                              </span>
                            </div>
                          )}

                          {/* Seeded Row */}
                          <div
                            onClick={e => handleToggleSeeded(item.id, idx, e.shiftKey)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '0.45rem 0.65rem',
                              borderRadius: 'var(--radius-sm)',
                              backgroundColor: isSelected ? 'rgba(239, 68, 68, 0.12)' : 'var(--color-bg-surface-elevated)',
                              border: `1px solid ${isSelected ? 'var(--color-red)' : 'var(--color-border-subtle)'}`,
                              cursor: 'pointer',
                              userSelect: 'none',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                              {isSelected ? (
                                <CheckSquare size={16} color="var(--color-red)" style={{ flexShrink: 0 }} />
                              ) : (
                                <Square size={16} color="var(--color-text-muted)" style={{ flexShrink: 0 }} />
                              )}

                              <span
                                style={{
                                  fontWeight: 800,
                                  fontSize: '0.78rem',
                                  color: 'var(--color-gold-bright)',
                                  minWidth: '32px',
                                }}
                              >
                                #{item.seedNumber}
                              </span>

                              <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {item.name}
                              </span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }}>
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
          <div
            style={{
              padding: '1rem 1.5rem',
              borderTop: '1px solid var(--color-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'var(--color-bg-surface-elevated)',
            }}
          >
            <div style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>
              <strong>{stagedSeeds.length}</strong> total seeded competitors staging
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={requestClose}
                className="btn btn-secondary"
                style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApply}
                className="btn btn-primary"
                style={{
                  padding: '0.5rem 1.25rem',
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                }}
              >
                <ShieldCheck size={16} />
                Apply & Save Seeds ({stagedSeeds.length})
              </button>
            </div>
          </div>
        </>
      )}
    </Overlay>
  );
};
