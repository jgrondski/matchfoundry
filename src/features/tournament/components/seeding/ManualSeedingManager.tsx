import React, { useState, useMemo, useId } from 'react';
import {
  GripVertical,
  ChevronUp,
  ChevronDown,
  ChevronsUp,
  ChevronsDown,
  X,
  Search,
  AlertTriangle,
  ShieldCheck,
  Layers,
  CheckSquare,
  Square,
  ExternalLink,
} from 'lucide-react';
import { Tournament } from '../../types';
import { useTournament } from '../../store';
import { BulkSeedImportModal } from './BulkSeedImportModal';
import { DualListSeedingModal } from './DualListSeedingModal';
import { PlayerAvatar } from '../../../players/components/PlayerAvatar';
import { PlaystyleChip } from '../../../players/components/PlaystyleChip';
import { Overlay, ConfirmDialog } from '../../../../components/overlay';

interface ManualSeedingManagerProps {
  tournament: Tournament;
  canManage?: boolean;
  isObsMode?: boolean;
}

export const ManualSeedingManager: React.FC<ManualSeedingManagerProps> = ({
  tournament,
  canManage = true,
  isObsMode = false,
}) => {
  const {
    reorderManualSeed,
    setManualSeeds,
    shuffleManualSeeds,
    removeManualSeed,
    batchMoveManualSeeds,
    batchJumpManualSeeds,
    batchRemoveManualSeeds,
  } = useTournament();

  const [searchTerm, setSearchTerm] = useState('');
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [isDualListOpen, setIsDualListOpen] = useState(false);
  const [isShuffleConfirmOpen, setIsShuffleConfirmOpen] = useState(false);
  const [isReverseConfirmOpen, setIsReverseConfirmOpen] = useState(false);
  const [jumpSeedTarget, setJumpSeedTarget] = useState<{ playerId: string; name: string; currentSeed: number } | null>(null);
  const [jumpTargetInput, setJumpTargetInput] = useState('');
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Multi-select state
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<Set<string>>(new Set());
  const [lastClickedIdx, setLastClickedIdx] = useState<number | null>(null);
  const [isBatchJumpOpen, setIsBatchJumpOpen] = useState(false);
  const [batchJumpInput, setBatchJumpInput] = useState('');
  const [isBatchDeleteConfirmOpen, setIsBatchDeleteConfirmOpen] = useState(false);
  const jumpTitleId = useId();
  const batchJumpTitleId = useId();

  const isLocked = tournament.isLocked || !canManage;
  const manualSeeds = tournament.manualSeeds || [];
  const playerMap = useMemo(
    () => new Map((tournament.playersPool || []).map(p => [p.id, p])),
    [tournament.playersPool]
  );

  // Sorted tiers
  const sortedTiers = useMemo(
    () => [...(tournament.tiers || [])].sort((a, b) => a.priority - b.priority),
    [tournament.tiers]
  );

  // Compute tier cutoffs
  const tierCutoffs = useMemo(() => {
    let running = 0;
    return sortedTiers.map(t => {
      const start = running + 1;
      const end = running + t.playerCount;
      running = end;
      return {
        tier: t,
        start,
        end,
        capacity: t.playerCount,
      };
    });
  }, [sortedTiers]);

  const totalBracketCapacity = useMemo(() => {
    return sortedTiers.reduce((acc, t) => acc + t.playerCount, 0);
  }, [sortedTiers]);

  // Seeded list with full player metadata
  const seededList = useMemo(() => {
    return manualSeeds.map((id, index) => {
      const player = playerMap.get(id);
      const seedNumber = index + 1;

      // Find assigned tier cutoff
      const cutoff = tierCutoffs.find(c => seedNumber >= c.start && seedNumber <= c.end);

      return {
        id,
        seedNumber,
        player,
        name: player?.name || 'Unknown Competitor',
        country: player?.country,
        playstyle: player?.playstyle,
        personalBest: player?.personalBest,
        tier: cutoff?.tier,
        tierSeed: cutoff ? seedNumber - cutoff.start + 1 : undefined,
        isReserve: seedNumber > totalBracketCapacity,
      };
    });
  }, [manualSeeds, playerMap, tierCutoffs, totalBracketCapacity]);

  // Filtered by search
  const filteredList = useMemo(() => {
    if (!searchTerm.trim()) return seededList;
    const term = searchTerm.toLowerCase();
    return seededList.filter(
      item =>
        item.name.toLowerCase().includes(term) ||
        (item.country && item.country.toLowerCase().includes(term)) ||
        (item.playstyle && item.playstyle.toLowerCase().includes(term)) ||
        `#${item.seedNumber}`.includes(term)
    );
  }, [seededList, searchTerm]);

  // Drag and drop handlers
  const handleDragStart = (index: number) => {
    if (isLocked) return;
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (targetIndex: number) => {
    if (isLocked || draggedIndex === null || draggedIndex === targetIndex) {
      setDraggedIndex(null);
      return;
    }
    reorderManualSeed(tournament.id, draggedIndex, targetIndex);
    setDraggedIndex(null);
  };

  // Direct seed jump
  const handleExecuteJump = () => {
    if (!jumpSeedTarget) return;
    const targetNum = parseInt(jumpTargetInput, 10);
    if (isNaN(targetNum) || targetNum < 1 || targetNum > manualSeeds.length) {
      return;
    }
    const fromIndex = jumpSeedTarget.currentSeed - 1;
    const toIndex = targetNum - 1;
    if (fromIndex !== toIndex) {
      reorderManualSeed(tournament.id, fromIndex, toIndex);
    }
    setJumpSeedTarget(null);
    setJumpTargetInput('');
  };

  // Reverse seed list
  const handleExecuteReverse = () => {
    if (isLocked || manualSeeds.length < 2) return;
    setManualSeeds(tournament.id, [...manualSeeds].reverse());
    setIsReverseConfirmOpen(false);
  };

  // Multiselect handlers
  const handleToggleSelect = (playerId: string, idx: number, shiftKey: boolean) => {
    if (isLocked) return;
    if (shiftKey && lastClickedIdx !== null) {
      const start = Math.min(lastClickedIdx, idx);
      const end = Math.max(lastClickedIdx, idx);
      const rangeSlice = filteredList.slice(start, end + 1).map(item => item.id);
      setSelectedPlayerIds(prev => {
        const next = new Set(prev);
        rangeSlice.forEach(id => next.add(id));
        return next;
      });
    } else {
      setSelectedPlayerIds(prev => {
        const next = new Set(prev);
        if (next.has(playerId)) {
          next.delete(playerId);
        } else {
          next.add(playerId);
        }
        return next;
      });
      setLastClickedIdx(idx);
    }
  };

  const handleSelectAll = () => {
    if (isLocked) return;
    setSelectedPlayerIds(new Set(filteredList.map(item => item.id)));
  };

  const handleClearSelection = () => {
    setSelectedPlayerIds(new Set());
    setLastClickedIdx(null);
  };

  // Batch actions
  const handleBatchMoveUp = () => {
    if (isLocked || selectedPlayerIds.size === 0) return;
    batchMoveManualSeeds(tournament.id, Array.from(selectedPlayerIds), 'UP');
  };

  const handleBatchMoveDown = () => {
    if (isLocked || selectedPlayerIds.size === 0) return;
    batchMoveManualSeeds(tournament.id, Array.from(selectedPlayerIds), 'DOWN');
  };

  const handleExecuteBatchJump = () => {
    if (isLocked || selectedPlayerIds.size === 0) return;
    const target = parseInt(batchJumpInput, 10);
    if (isNaN(target) || target < 1) return;
    batchJumpManualSeeds(tournament.id, Array.from(selectedPlayerIds), target);
    setIsBatchJumpOpen(false);
    setBatchJumpInput('');
  };

  const handleBatchMoveToTop = () => {
    if (isLocked || selectedPlayerIds.size === 0) return;
    batchJumpManualSeeds(tournament.id, Array.from(selectedPlayerIds), 1);
  };

  const handleBatchMoveToBottom = () => {
    if (isLocked || selectedPlayerIds.size === 0) return;
    batchJumpManualSeeds(tournament.id, Array.from(selectedPlayerIds), manualSeeds.length);
  };

  const handleExecuteBatchRemove = () => {
    if (isLocked || selectedPlayerIds.size === 0) return;
    batchRemoveManualSeeds(tournament.id, Array.from(selectedPlayerIds));
    setSelectedPlayerIds(new Set());
    setLastClickedIdx(null);
    setIsBatchDeleteConfirmOpen(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Top Header Card */}
      {isObsMode ? (
        <div style={{ padding: '0.5rem 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
            {tournament.name} — Seeding Placements
          </h1>
          <span style={{ fontSize: '0.85rem', color: 'var(--color-gold-bright)', fontWeight: 700 }}>
            {manualSeeds.length} Competitors Seeded
          </span>
        </div>
      ) : (
        <div
          style={{
            background: 'var(--color-bg-surface)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--color-border)',
            padding: '1.25rem 1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'rgba(245, 158, 11, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--color-gold-bright)',
                }}
              >
                <Layers size={18} />
              </div>
              <div>
                <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
                  {canManage ? 'Tournament Seeding Manager' : 'Tournament Seeding'}
                </h1>
                <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                  {canManage
                    ? 'Direct seeding active. Drag, jump, or paste names to arrange tournament seeds and bracket allocations without quals.'
                    : 'Official competitor seeding and bracket allocations.'}
                </p>
              </div>
            </div>

            {!canManage && (
              <a
                href={`/${tournament.slug}/leaderboard`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary"
                style={{
                  fontSize: '0.8rem',
                  padding: '0.45rem 0.85rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  textDecoration: 'none',
                }}
                title="Open seeding in new page view"
              >
                <span>New Page View</span>
                <ExternalLink size={13} />
              </a>
            )}
          </div>

          {/* Action Bar (Manage mode only) */}
          {canManage && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '0.75rem',
              }}
            >
              {/* Left Actions: Shuffle, Reverse */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  disabled={isLocked || manualSeeds.length < 2}
                  onClick={() => setIsShuffleConfirmOpen(true)}
                  className="btn btn-secondary"
                  style={{
                    fontSize: '0.85rem',
                    padding: '0.45rem 1rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                    minWidth: '80px',
                    opacity: isLocked || manualSeeds.length < 2 ? 0.6 : 1,
                    cursor: isLocked || manualSeeds.length < 2 ? 'not-allowed' : 'pointer',
                  }}
                  title={isLocked ? 'Seeding is locked' : 'Randomize the seed sequence (Fisher-Yates shuffle)'}
                >
                  Shuffle
                </button>

                <button
                  type="button"
                  disabled={isLocked || manualSeeds.length < 2}
                  onClick={() => setIsReverseConfirmOpen(true)}
                  className="btn btn-secondary"
                  style={{
                    fontSize: '0.85rem',
                    padding: '0.45rem 1rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                    minWidth: '80px',
                    opacity: isLocked || manualSeeds.length < 2 ? 0.6 : 1,
                    cursor: isLocked || manualSeeds.length < 2 ? 'not-allowed' : 'pointer',
                  }}
                  title={isLocked ? 'Seeding is locked' : 'Invert order of all seeds'}
                >
                  Reverse
                </button>
              </div>

              {/* Right Actions: Bulk Import, Add Seeds */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  disabled={isLocked}
                  onClick={() => setIsBulkImportOpen(true)}
                  className="btn btn-secondary"
                  style={{
                    fontSize: '0.85rem',
                    padding: '0.45rem 1rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                    minWidth: '100px',
                    opacity: isLocked ? 0.6 : 1,
                    cursor: isLocked ? 'not-allowed' : 'pointer',
                  }}
                  title={isLocked ? 'Seeding is locked during match play' : 'Paste an ordered list of names from Sheets or text'}
                >
                  Bulk Import
                </button>

                <button
                  type="button"
                  disabled={isLocked}
                  onClick={() => setIsDualListOpen(true)}
                  className="btn btn-primary"
                  style={{
                    fontSize: '0.85rem',
                    padding: '0.45rem 1.15rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                    minWidth: '100px',
                    opacity: isLocked ? 0.6 : 1,
                    cursor: isLocked ? 'not-allowed' : 'pointer',
                  }}
                  title={isLocked ? 'Seeding is locked' : 'Multi-select shuttle: select available players and stage seeds'}
                >
                  Add Seeds
                </button>
              </div>
            </div>
          )}

          {/* Capacity Telemetry & Quick Search */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--color-border-subtle)', paddingTop: '0.85rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                Total Seeds: <strong>{manualSeeds.length}</strong>
              </span>
              <span style={{ color: 'var(--color-border)' }}>•</span>
              <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                Bracket Capacity: <strong>{totalBracketCapacity}</strong>
              </span>
              {manualSeeds.length < totalBracketCapacity && (
                <span className="badge badge-gold" style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}>
                  <AlertTriangle size={12} /> Needs {totalBracketCapacity - manualSeeds.length} more to fill all brackets
                </span>
              )}
              {manualSeeds.length >= totalBracketCapacity && (
                <span className="badge badge-green" style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}>
                  <ShieldCheck size={12} /> All bracket tiers filled
                </span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {canManage && !isLocked && filteredList.length > 0 && (
                <button
                  type="button"
                  onClick={selectedPlayerIds.size === filteredList.length ? handleClearSelection : handleSelectAll}
                  className="btn btn-secondary"
                  style={{
                    fontSize: '0.78rem',
                    padding: '0.35rem 0.65rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                  }}
                  title={selectedPlayerIds.size === filteredList.length ? 'Deselect all competitors' : 'Select all competitors in view'}
                >
                  {selectedPlayerIds.size === filteredList.length ? (
                    <>
                      <CheckSquare size={13} color="var(--color-brand)" />
                      Deselect All
                    </>
                  ) : (
                    <>
                      <Square size={13} />
                      Select All
                    </>
                  )}
                </button>
              )}

              <div style={{ position: 'relative', width: '220px' }}>
                <Search
                  size={14}
                  style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }}
                />
                <input
                  type="text"
                  placeholder="Filter seeds..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '0.35rem 0.65rem 0.35rem 2rem',
                    backgroundColor: 'var(--color-bg-surface-elevated)',
                    color: 'var(--color-text-primary)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.8rem',
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Batch Action Toolbar (Sticky) */}
      {canManage && selectedPlayerIds.size > 0 && !isLocked && (
        <div
          style={{
            position: 'sticky',
            top: '1rem',
            zIndex: 40,
            backgroundColor: 'rgba(15, 23, 42, 0.96)',
            backdropFilter: 'blur(10px)',
            border: '1px solid var(--color-brand)',
            borderRadius: 'var(--radius-md)',
            padding: '0.65rem 1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.75rem',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <CheckSquare size={18} color="var(--color-brand)" />
            <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
              {selectedPlayerIds.size} Competitor{selectedPlayerIds.size > 1 ? 's' : ''} Selected
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
              (Hold Shift to range select)
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
            {/* Up 1 */}
            <button
              type="button"
              onClick={handleBatchMoveUp}
              className="btn btn-secondary"
              style={{ fontSize: '0.78rem', padding: '0.35rem 0.65rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
              title="Shift each selected competitor up 1 position independently"
            >
              <ChevronUp size={14} />
              Up 1
            </button>

            {/* Down 1 */}
            <button
              type="button"
              onClick={handleBatchMoveDown}
              className="btn btn-secondary"
              style={{ fontSize: '0.78rem', padding: '0.35rem 0.65rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
              title="Shift each selected competitor down 1 position independently"
            >
              <ChevronDown size={14} />
              Down 1
            </button>

            {/* Jump to Seed */}
            <button
              type="button"
              onClick={() => {
                setBatchJumpInput('1');
                setIsBatchJumpOpen(true);
              }}
              className="btn btn-secondary"
              style={{ fontSize: '0.78rem', padding: '0.35rem 0.65rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
              title="Bunch selected competitors contiguously starting at target seed"
            >
              Jump to Seed...
            </button>

            {/* Move to Top */}
            <button
              type="button"
              onClick={handleBatchMoveToTop}
              className="btn btn-secondary"
              style={{ fontSize: '0.78rem', padding: '0.35rem 0.65rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
              title="Bunch selected competitors at Seed #1"
            >
              <ChevronsUp size={14} />
              Top
            </button>

            {/* Move to Bottom */}
            <button
              type="button"
              onClick={handleBatchMoveToBottom}
              className="btn btn-secondary"
              style={{ fontSize: '0.78rem', padding: '0.35rem 0.65rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
              title="Bunch selected competitors at the bottom"
            >
              <ChevronsDown size={14} />
              Bottom
            </button>

            <div style={{ width: '1px', height: '18px', background: 'var(--color-border)', margin: '0 0.2rem' }} />

            {/* Batch Remove */}
            <button
              type="button"
              onClick={() => setIsBatchDeleteConfirmOpen(true)}
              className="btn btn-secondary"
              style={{
                fontSize: '0.78rem',
                padding: '0.35rem 0.65rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
                color: 'var(--color-red)',
                borderColor: 'rgba(239, 68, 68, 0.4)',
              }}
              title="Remove selected competitors from seeding list"
            >
              <X size={14} />
              Remove ({selectedPlayerIds.size})
            </button>

            {/* Clear Selection */}
            <button
              type="button"
              onClick={handleClearSelection}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--color-text-muted)',
                cursor: 'pointer',
                fontSize: '0.78rem',
                padding: '0.35rem 0.5rem',
              }}
              title="Clear selection"
            >
              Deselect All
            </button>
          </div>
        </div>
      )}

      {/* Main Seed Table with Tier Boundaries */}
      <div
        style={{
          background: isObsMode ? 'transparent' : 'var(--color-bg-surface)',
          borderRadius: 'var(--radius-lg)',
          border: isObsMode ? 'none' : '1px solid var(--color-border)',
          overflow: 'hidden',
          overflowX: 'auto',
        }}
      >
        {filteredList.length === 0 ? (
          <div style={{ padding: '3rem 1.5rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
            <p style={{ margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: 600 }}>
              {manualSeeds.length === 0 ? 'No participants seeded yet.' : 'No seeds match your search query.'}
            </p>
            {manualSeeds.length === 0 && canManage && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', marginTop: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setIsDualListOpen(true)}
                  className="btn btn-primary"
                  style={{
                    fontSize: '0.85rem',
                    padding: '0.5rem 1.25rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                  }}
                >
                  Add Seeds
                </button>
                <button
                  type="button"
                  onClick={() => setIsBulkImportOpen(true)}
                  className="btn btn-secondary"
                  style={{
                    fontSize: '0.85rem',
                    padding: '0.5rem 1.25rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                  }}
                >
                  Bulk Import
                </button>
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: canManage ? '650px' : '580px' }}>
            {/* Table Header Row */}
            {canManage ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0.65rem 1.25rem',
                  backgroundColor: 'var(--color-bg-surface-elevated)',
                  borderBottom: '1px solid var(--color-border)',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: 'var(--color-text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  gap: '0.75rem',
                }}
              >
                <div style={{ width: 16, flexShrink: 0 }} />
                <div style={{ width: 20, flexShrink: 0 }} />
                <div style={{ width: 42, textAlign: 'center', flexShrink: 0 }}>Seed</div>
                <div style={{ flex: 1, minWidth: 0 }}>Competitor</div>
                <div style={{ width: 110, textAlign: 'right', paddingRight: '0.5rem', flexShrink: 0 }}>Personal Best</div>
                <div style={{ width: 110, textAlign: 'center', flexShrink: 0 }}>Bracket Seed</div>
                <div style={{ width: 150, textAlign: 'right', flexShrink: 0 }}>Actions</div>
              </div>
            ) : (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0.65rem 1.25rem',
                  backgroundColor: 'var(--color-bg-surface-elevated)',
                  borderBottom: '1px solid var(--color-border)',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: 'var(--color-text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  gap: '0.75rem',
                }}
              >
                <div style={{ width: 40, textAlign: 'center', flexShrink: 0 }}>Seed</div>
                <div style={{ width: 24, textAlign: 'center', flexShrink: 0 }}>Flag</div>
                <div style={{ flex: 1, minWidth: 0 }}>Competitor</div>
                <div style={{ width: 90, flexShrink: 0 }}>Style</div>
                <div style={{ width: 110, textAlign: 'right', paddingRight: '0.5rem', flexShrink: 0 }}>Personal Best</div>
                <div style={{ width: 110, textAlign: 'right', flexShrink: 0 }}>Bracket Seed</div>
              </div>
            )}

            {filteredList.map((item, idx) => {
              // Determine if a tier boundary divider should be rendered right before this item
              const cutoffStartingHere = tierCutoffs.find(c => c.start === item.seedNumber);
              const isReservesStart = item.seedNumber === totalBracketCapacity + 1;

              return (
                <React.Fragment key={item.id}>
                  {/* Tier Divider Banner */}
                  {cutoffStartingHere && (
                    <div
                      style={{
                        padding: '0.65rem 1.25rem',
                        backgroundColor: cutoffStartingHere.tier.cardColor || 'rgba(245, 158, 11, 0.08)',
                        borderTop: idx > 0 ? '2px solid var(--color-border)' : 'none',
                        borderBottom: '1px solid var(--color-border)',
                        borderLeft: `5px solid ${cutoffStartingHere.tier.primaryColor || 'var(--color-gold-bright)'}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span
                          style={{
                            fontWeight: 800,
                            fontSize: '0.88rem',
                            color: cutoffStartingHere.tier.primaryColor || 'var(--color-gold-bright)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                          }}
                        >
                          {cutoffStartingHere.tier.name}
                        </span>
                        <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                          • Seeds {cutoffStartingHere.start}–{cutoffStartingHere.end} ({cutoffStartingHere.capacity} slots)
                        </span>
                      </div>
                      <span
                        className="badge"
                        style={{
                          fontSize: '0.72rem',
                          backgroundColor: cutoffStartingHere.tier.primaryColor ? `${cutoffStartingHere.tier.primaryColor}22` : 'rgba(245, 158, 11, 0.15)',
                          color: cutoffStartingHere.tier.primaryColor || 'var(--color-gold-bright)',
                          border: `1px solid ${cutoffStartingHere.tier.primaryColor || 'var(--color-gold-bright)'}44`,
                        }}
                      >
                        Tier {cutoffStartingHere.tier.priority}
                      </span>
                    </div>
                  )}

                  {/* Reserves Divider Banner */}
                  {isReservesStart && (
                    <div
                      style={{
                        padding: '0.65rem 1.25rem',
                        backgroundColor: 'rgba(100, 116, 139, 0.08)',
                        borderTop: '2px solid var(--color-border)',
                        borderBottom: '1px solid var(--color-border)',
                        borderLeft: '5px solid var(--color-text-muted)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                          Alternates / Reserves Pool (Did Not Qualify)
                        </span>
                        <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                          • Seeds {totalBracketCapacity + 1}+
                        </span>
                      </div>
                      <span className="badge" style={{ fontSize: '0.72rem', background: 'var(--color-bg-surface-elevated)', color: 'var(--color-text-muted)' }}>
                        Unassigned to Brackets
                      </span>
                    </div>
                  )}

                  {/* Row */}
                  {canManage ? (
                    /* Manage Mode Row: Seed, Name, PB, Bracket Seed, Controls */
                    <div
                      draggable={!isLocked}
                      onDragStart={() => handleDragStart(item.seedNumber - 1)}
                      onDragOver={handleDragOver}
                      onDrop={() => handleDrop(item.seedNumber - 1)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '0.6rem 1.25rem',
                        borderBottom: '1px solid var(--color-border-subtle)',
                        backgroundColor: selectedPlayerIds.has(item.id)
                          ? 'rgba(99, 102, 241, 0.12)'
                          : draggedIndex === item.seedNumber - 1
                          ? 'rgba(99, 102, 241, 0.15)'
                          : 'transparent',
                        transition: 'background-color 0.15s ease',
                        gap: '0.75rem',
                      }}
                    >
                      {/* Drag Handle */}
                      {!isLocked ? (
                        <div
                          style={{
                            color: 'var(--color-text-muted)',
                            cursor: 'grab',
                            display: 'flex',
                            alignItems: 'center',
                            padding: '0.2rem',
                            flexShrink: 0,
                            width: 16,
                          }}
                          title="Drag to reorder seed"
                        >
                          <GripVertical size={16} />
                        </div>
                      ) : (
                        <div style={{ width: 16, flexShrink: 0 }} />
                      )}

                      {/* Selection Checkbox */}
                      {!isLocked && (
                        <div
                          onClick={e => {
                            e.stopPropagation();
                            handleToggleSelect(item.id, idx, e.shiftKey);
                          }}
                          style={{
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            padding: '0.2rem',
                            flexShrink: 0,
                            width: 20,
                          }}
                          title="Select for batch actions (Hold Shift for range select)"
                        >
                          {selectedPlayerIds.has(item.id) ? (
                            <CheckSquare size={16} color="var(--color-brand)" />
                          ) : (
                            <Square size={16} color="var(--color-text-muted)" />
                          )}
                        </div>
                      )}

                      {/* Seed Badge (Clickable to jump) */}
                      <button
                        type="button"
                        disabled={isLocked}
                        onClick={() => {
                          setJumpSeedTarget({
                            playerId: item.id,
                            name: item.name,
                            currentSeed: item.seedNumber,
                          });
                          setJumpTargetInput(String(item.seedNumber));
                        }}
                        style={{
                          background: item.tier ? (item.tier.primaryColor ? `${item.tier.primaryColor}22` : 'rgba(245, 158, 11, 0.15)') : 'var(--color-bg-surface-elevated)',
                          border: `1px solid ${item.tier?.primaryColor ? `${item.tier.primaryColor}55` : 'var(--color-border)'}`,
                          color: item.tier?.primaryColor || 'var(--color-text-secondary)',
                          fontWeight: 800,
                          fontSize: '0.82rem',
                          borderRadius: 'var(--radius-sm)',
                          padding: '0.2rem 0.5rem',
                          width: '42px',
                          textAlign: 'center',
                          cursor: isLocked ? 'default' : 'pointer',
                          flexShrink: 0,
                        }}
                        title={isLocked ? `Seed #${item.seedNumber}` : 'Click to jump to a specific seed number'}
                      >
                        {`#${item.seedNumber}`}
                      </button>

                      {/* Competitor Name (flex: 1) */}
                      <span
                        style={{
                          fontWeight: 600,
                          fontSize: '0.9rem',
                          color: 'var(--color-text-primary)',
                          flex: 1,
                          minWidth: 0,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {item.name}
                      </span>

                      {/* Personal Best (2nd from right column) */}
                      <div style={{ width: '110px', textAlign: 'right', paddingRight: '0.5rem', flexShrink: 0 }}>
                        <span
                          style={{
                            fontFamily: 'monospace',
                            fontSize: '0.85rem',
                            fontWeight: 600,
                            color: item.personalBest ? 'var(--color-gold-bright)' : 'var(--color-text-muted)',
                          }}
                          title={item.personalBest ? `Personal Best: ${item.personalBest.toLocaleString()}` : 'No PB recorded'}
                        >
                          {item.personalBest ? item.personalBest.toLocaleString() : '—'}
                        </span>
                      </div>

                      {/* Bracket Seed Chip */}
                      <div style={{ width: '110px', display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
                        {item.tier && item.tierSeed ? (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              padding: '0.2rem 0.55rem',
                              borderRadius: 'var(--radius-sm)',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              backgroundColor: item.tier.primaryColor ? `${item.tier.primaryColor}22` : 'rgba(245, 158, 11, 0.15)',
                              color: item.tier.primaryColor || 'var(--color-gold-bright)',
                              border: `1px solid ${item.tier.primaryColor ? `${item.tier.primaryColor}55` : 'rgba(245, 158, 11, 0.3)'}`,
                              whiteSpace: 'nowrap',
                              letterSpacing: '0.02em',
                            }}
                            title={`Assigned to ${item.tier.name} bracket as Seed #${item.tierSeed}`}
                          >
                            {`${item.tier.name} ${item.tierSeed}`}
                          </span>
                        ) : item.isReserve ? (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              padding: '0.2rem 0.55rem',
                              borderRadius: 'var(--radius-sm)',
                              fontSize: '0.72rem',
                              fontWeight: 600,
                              backgroundColor: 'rgba(100, 116, 139, 0.15)',
                              color: 'var(--color-text-muted)',
                              border: '1px solid var(--color-border)',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            Reserve
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>—</span>
                        )}
                      </div>

                      {/* Row Controls */}
                      {!isLocked && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', width: '150px', justifyContent: 'flex-end', flexShrink: 0 }}>
                          <button
                            type="button"
                            disabled={item.seedNumber === 1}
                            onClick={() => reorderManualSeed(tournament.id, item.seedNumber - 1, 0)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: item.seedNumber === 1 ? 'var(--color-text-muted)' : 'var(--color-text-secondary)',
                              cursor: item.seedNumber === 1 ? 'default' : 'pointer',
                              padding: '0.25rem',
                              display: 'flex',
                              opacity: item.seedNumber === 1 ? 0.3 : 1,
                            }}
                            title="Move to top (#1 Seed)"
                          >
                            <ChevronsUp size={15} />
                          </button>

                          <button
                            type="button"
                            disabled={item.seedNumber === 1}
                            onClick={() => reorderManualSeed(tournament.id, item.seedNumber - 1, item.seedNumber - 2)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: item.seedNumber === 1 ? 'var(--color-text-muted)' : 'var(--color-text-secondary)',
                              cursor: item.seedNumber === 1 ? 'default' : 'pointer',
                              padding: '0.25rem',
                              display: 'flex',
                              opacity: item.seedNumber === 1 ? 0.3 : 1,
                            }}
                            title="Move Up (↑)"
                          >
                            <ChevronUp size={15} />
                          </button>

                          <button
                            type="button"
                            disabled={item.seedNumber === manualSeeds.length}
                            onClick={() => reorderManualSeed(tournament.id, item.seedNumber - 1, item.seedNumber)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: item.seedNumber === manualSeeds.length ? 'var(--color-text-muted)' : 'var(--color-text-secondary)',
                              cursor: item.seedNumber === manualSeeds.length ? 'default' : 'pointer',
                              padding: '0.25rem',
                              display: 'flex',
                              opacity: item.seedNumber === manualSeeds.length ? 0.3 : 1,
                            }}
                            title="Move Down (↓)"
                          >
                            <ChevronDown size={15} />
                          </button>

                          <button
                            type="button"
                            disabled={item.seedNumber === manualSeeds.length}
                            onClick={() => reorderManualSeed(tournament.id, item.seedNumber - 1, manualSeeds.length - 1)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: item.seedNumber === manualSeeds.length ? 'var(--color-text-muted)' : 'var(--color-text-secondary)',
                              cursor: item.seedNumber === manualSeeds.length ? 'default' : 'pointer',
                              padding: '0.25rem',
                              display: 'flex',
                              opacity: item.seedNumber === manualSeeds.length ? 0.3 : 1,
                            }}
                            title="Move to bottom"
                          >
                            <ChevronsDown size={15} />
                          </button>

                          <div style={{ width: '1px', height: '14px', background: 'var(--color-border)', margin: '0 0.25rem' }} />

                          <button
                            type="button"
                            onClick={() => removeManualSeed(tournament.id, item.id)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: 'var(--color-red-bright)',
                              cursor: 'pointer',
                              padding: '0.25rem',
                              display: 'flex',
                              opacity: 0.75,
                            }}
                            title="Remove from seeds"
                          >
                            <X size={15} />
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Public Spectator Row: Overall seed > Flag > Player name > Playstyle > PB > bracket seed chip */
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '0.65rem 1.25rem',
                        borderBottom: '1px solid var(--color-border-subtle)',
                        transition: 'background-color 0.15s ease',
                        gap: '0.75rem',
                      }}
                    >
                      {/* Overall Seed */}
                      <div style={{ width: '40px', textAlign: 'center', flexShrink: 0 }}>
                        <span
                          style={{
                            fontWeight: 800,
                            fontSize: '0.85rem',
                            color: item.tier?.primaryColor || 'var(--color-gold-bright)',
                          }}
                        >
                          {`#${item.seedNumber}`}
                        </span>
                      </div>

                      {/* Flag / Avatar (to the left of player name) */}
                      <div style={{ width: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <PlayerAvatar player={item} />
                      </div>

                      {/* Competitor Name */}
                      <span
                        style={{
                          fontWeight: 600,
                          fontSize: '0.92rem',
                          color: 'var(--color-text-primary)',
                          flex: 1,
                          minWidth: 0,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {item.name}
                      </span>

                      {/* Playstyle (in its own column just to the right of player name) */}
                      <div style={{ width: '90px', display: 'flex', alignItems: 'center', justifyContent: 'flex-start', flexShrink: 0 }}>
                        {item.playstyle ? (
                          <PlaystyleChip style={item.playstyle} />
                        ) : (
                          <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>—</span>
                        )}
                      </div>

                      {/* Personal Best (2nd from right column) */}
                      <div style={{ width: '110px', textAlign: 'right', paddingRight: '0.5rem', flexShrink: 0 }}>
                        <span
                          style={{
                            fontFamily: 'monospace',
                            fontSize: '0.85rem',
                            fontWeight: 600,
                            color: item.personalBest ? 'var(--color-gold-bright)' : 'var(--color-text-muted)',
                          }}
                          title={item.personalBest ? `Personal Best: ${item.personalBest.toLocaleString()}` : 'No PB recorded'}
                        >
                          {item.personalBest ? item.personalBest.toLocaleString() : '—'}
                        </span>
                      </div>

                      {/* Bracket Seed Chip (far right) */}
                      <div style={{ width: '110px', display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
                        {item.tier && item.tierSeed ? (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              padding: '0.2rem 0.55rem',
                              borderRadius: 'var(--radius-sm)',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              backgroundColor: item.tier.primaryColor ? `${item.tier.primaryColor}22` : 'rgba(245, 158, 11, 0.15)',
                              color: item.tier.primaryColor || 'var(--color-gold-bright)',
                              border: `1px solid ${item.tier.primaryColor ? `${item.tier.primaryColor}55` : 'rgba(245, 158, 11, 0.3)'}`,
                              whiteSpace: 'nowrap',
                              letterSpacing: '0.02em',
                            }}
                            title={`Assigned to ${item.tier.name} bracket as Seed #${item.tierSeed}`}
                          >
                            {`${item.tier.name} ${item.tierSeed}`}
                          </span>
                        ) : item.isReserve ? (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              padding: '0.2rem 0.55rem',
                              borderRadius: 'var(--radius-sm)',
                              fontSize: '0.72rem',
                              fontWeight: 600,
                              backgroundColor: 'rgba(100, 116, 139, 0.15)',
                              color: 'var(--color-text-muted)',
                              border: '1px solid var(--color-border)',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            Reserve
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>—</span>
                        )}
                      </div>
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        )}
      </div>

      {/* Jump to Seed Modal */}
      <Overlay
        open={jumpSeedTarget !== null}
        onClose={() => setJumpSeedTarget(null)}
        dirty={jumpSeedTarget !== null && jumpTargetInput !== String(jumpSeedTarget.currentSeed)}
        aria-labelledby={jumpTitleId}
        panelClassName="flex max-w-95 flex-col gap-4 rounded-lg border border-line bg-surface p-5"
      >
        {({ requestClose }) => (
          <>
            <h3 id={jumpTitleId} style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
              Set Seed for {jumpSeedTarget?.name}
            </h3>
            <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>
              Currently Seed #{jumpSeedTarget?.currentSeed}. Enter a new seed position (1 to {manualSeeds.length}):
            </p>
            <input
              type="number"
              min={1}
              max={manualSeeds.length}
              value={jumpTargetInput}
              onChange={e => setJumpTargetInput(e.target.value)}
              autoFocus
              data-autofocus
              onKeyDown={e => {
                if (e.key === 'Enter') handleExecuteJump();
              }}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '0.5rem 0.75rem',
                fontSize: '1rem',
                fontWeight: 700,
                backgroundColor: 'var(--color-bg-surface-elevated)',
                color: 'var(--color-gold-bright)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={requestClose}
                className="btn btn-secondary"
                style={{ fontSize: '0.82rem', padding: '0.4rem 0.85rem' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteJump}
                className="btn btn-primary"
                style={{ fontSize: '0.82rem', padding: '0.4rem 1rem' }}
              >
                Jump to Seed
              </button>
            </div>
          </>
        )}
      </Overlay>

      {/* Shuffle Confirmation Modal */}
      <ConfirmDialog
        open={isShuffleConfirmOpen}
        tone="warning"
        title="Shuffle Seeds?"
        body={
          <p className="leading-snug text-fg-secondary">
            This will randomly shuffle all {manualSeeds.length} seeds (ideal for blind draw tournaments). Bracket matchups will update immediately.
          </p>
        }
        cancelLabel="Cancel"
        confirmLabel="Yes, Shuffle Seeds"
        confirmVariant="primary"
        onCancel={() => setIsShuffleConfirmOpen(false)}
        onConfirm={() => {
          shuffleManualSeeds(tournament.id);
          setIsShuffleConfirmOpen(false);
        }}
      />

      {/* Reverse Confirmation Modal */}
      <ConfirmDialog
        open={isReverseConfirmOpen}
        tone="warning"
        title="Reverse Seeding Order?"
        body={
          <p className="leading-snug text-fg-secondary">
            This will invert the order of all {manualSeeds.length} seeds (Seed #1 will become the bottom seed and vice-versa). Bracket matchups will update immediately.
          </p>
        }
        cancelLabel="Cancel"
        confirmLabel="Yes, Reverse Seeds"
        confirmVariant="primary"
        onCancel={() => setIsReverseConfirmOpen(false)}
        onConfirm={handleExecuteReverse}
      />

      {/* Batch Jump to Seed Modal */}
      <Overlay
        open={isBatchJumpOpen}
        onClose={() => {
          setIsBatchJumpOpen(false);
          setBatchJumpInput('');
        }}
        dirty={batchJumpInput !== '1'}
        aria-labelledby={batchJumpTitleId}
        panelClassName="flex max-w-105 flex-col gap-4 rounded-lg border border-line bg-surface p-5"
      >
        {({ requestClose }) => (
          <>
            <h3 id={batchJumpTitleId} style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
              Jump {selectedPlayerIds.size} Selected Competitors
            </h3>
            <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
              Selected competitors will bunch contiguously starting at the target seed position, preserving their existing relative order.
            </p>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--color-text-secondary)', marginBottom: '0.35rem' }}>
                Target Seed Position (1 to {manualSeeds.length}):
              </label>
              <input
                type="number"
                min={1}
                max={manualSeeds.length}
                value={batchJumpInput}
                onChange={e => setBatchJumpInput(e.target.value)}
                autoFocus
                data-autofocus
                onKeyDown={e => {
                  if (e.key === 'Enter') handleExecuteBatchJump();
                }}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '0.5rem 0.75rem',
                  fontSize: '1rem',
                  fontWeight: 700,
                  backgroundColor: 'var(--color-bg-surface-elevated)',
                  color: 'var(--color-gold-bright)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)',
                }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={requestClose}
                className="btn btn-secondary"
                style={{ fontSize: '0.82rem', padding: '0.4rem 0.85rem' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteBatchJump}
                className="btn btn-primary"
                style={{ fontSize: '0.82rem', padding: '0.4rem 1rem' }}
              >
                Jump to Seed #{batchJumpInput || '1'}
              </button>
            </div>
          </>
        )}
      </Overlay>

      {/* Batch Removal Confirmation Modal */}
      <ConfirmDialog
        open={isBatchDeleteConfirmOpen}
        tone="danger"
        title={`Remove ${selectedPlayerIds.size} Competitor${selectedPlayerIds.size > 1 ? 's' : ''} from Seeds?`}
        body={
          <p className="leading-snug text-fg-secondary">
            This will remove {selectedPlayerIds.size} competitors from the tournament seeding list. Remaining competitors will automatically shift up to fill open seeds.
          </p>
        }
        cancelLabel="Cancel"
        confirmLabel="Yes, Remove Seeds"
        onCancel={() => setIsBatchDeleteConfirmOpen(false)}
        onConfirm={handleExecuteBatchRemove}
      />

      {/* Bulk Seed Import Modal */}
      <BulkSeedImportModal
        isOpen={isBulkImportOpen}
        onClose={() => setIsBulkImportOpen(false)}
        tournament={tournament}
      />

      {/* Dual-List Shuttle Seeding Modal */}
      <DualListSeedingModal
        isOpen={isDualListOpen}
        onClose={() => setIsDualListOpen(false)}
        tournament={tournament}
      />
    </div>
  );
};
