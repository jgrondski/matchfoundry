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
import { Badge, Button, IconButton, buttonClasses, cn } from '../../../../components/ui';

const headerRowClass =
  'flex items-center gap-3 border-b border-line bg-elevated px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-fg-muted';
const batchButtonClass = 'gap-1 px-2.5 py-1.5 text-caption';
const rowControlClass =
  'flex p-1 text-fg-secondary disabled:cursor-default disabled:text-fg-muted disabled:opacity-30';
const seedInputClass =
  'w-full rounded-sm border border-line bg-elevated px-3 py-2 text-base font-bold text-gold-bright';

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
    <div className="flex flex-col gap-5">
      {/* Top Header Card */}
      {isObsMode ? (
        <div className="flex items-center justify-between py-2">
          <h1 className="m-0 text-2xl font-extrabold text-fg">
            {tournament.name} — Seeding Placements
          </h1>
          <span className="text-sm font-bold text-gold-bright">
            {manualSeeds.length} Competitors Seeded
          </span>
        </div>
      ) : (
        <div className="flex flex-col gap-4 rounded-lg border border-line bg-surface px-6 py-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex size-8 items-center justify-center rounded-md bg-gold/15 text-gold-bright">
                <Layers size={18} />
              </div>
              <div>
                <h1 className="m-0 text-2xl font-extrabold text-fg">
                  {canManage ? 'Tournament Seeding Manager' : 'Tournament Seeding'}
                </h1>
                <p className="mx-0 mb-0 mt-1.5 text-sm text-fg-muted">
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
                className={buttonClasses({
                  variant: 'secondary',
                  className: 'gap-1.5 px-3.5 py-2 text-caption hover:bg-highlight hover:border-fg-secondary',
                })}
                title="Open seeding in new page view"
              >
                <span>New Page View</span>
                <ExternalLink size={13} />
              </a>
            )}
          </div>

          {/* Action Bar (Manage mode only) */}
          {canManage && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Left Actions: Shuffle, Reverse */}
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="secondary"
                  disabled={isLocked || manualSeeds.length < 2}
                  onClick={() => setIsShuffleConfirmOpen(true)}
                  className="min-w-20 text-center"
                  title={isLocked ? 'Seeding is locked' : 'Randomize the seed sequence (Fisher-Yates shuffle)'}
                >
                  Shuffle
                </Button>

                <Button
                  variant="secondary"
                  disabled={isLocked || manualSeeds.length < 2}
                  onClick={() => setIsReverseConfirmOpen(true)}
                  className="min-w-20 text-center"
                  title={isLocked ? 'Seeding is locked' : 'Invert order of all seeds'}
                >
                  Reverse
                </Button>
              </div>

              {/* Right Actions: Bulk Import, Add Seeds */}
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="secondary"
                  disabled={isLocked}
                  onClick={() => setIsBulkImportOpen(true)}
                  className="min-w-25 text-center"
                  title={isLocked ? 'Seeding is locked during match play' : 'Paste an ordered list of names from Sheets or text'}
                >
                  Bulk Import
                </Button>

                <Button
                  variant="primary"
                  disabled={isLocked}
                  onClick={() => setIsDualListOpen(true)}
                  className="min-w-25 px-4.5 text-center"
                  title={isLocked ? 'Seeding is locked' : 'Multi-select shuttle: select available players and stage seeds'}
                >
                  Add Seeds
                </Button>
              </div>
            </div>
          )}

          {/* Capacity Telemetry & Quick Search */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line-subtle pt-3.5">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm text-fg-secondary">
                Total Seeds: <strong>{manualSeeds.length}</strong>
              </span>
              <span className="text-line">•</span>
              <span className="text-sm text-fg-secondary">
                Bracket Capacity: <strong>{totalBracketCapacity}</strong>
              </span>
              {manualSeeds.length < totalBracketCapacity && (
                <Badge variant="gold" className="px-2">
                  <AlertTriangle size={12} /> Needs {totalBracketCapacity - manualSeeds.length} more to fill all brackets
                </Badge>
              )}
              {manualSeeds.length >= totalBracketCapacity && (
                <Badge variant="green" className="px-2">
                  <ShieldCheck size={12} /> All bracket tiers filled
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-2">
              {canManage && !isLocked && filteredList.length > 0 && (
                <Button
                  variant="secondary"
                  onClick={selectedPlayerIds.size === filteredList.length ? handleClearSelection : handleSelectAll}
                  className="gap-1.5 px-2.5 py-1.5 text-caption"
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
                </Button>
              )}

              <div className="relative w-55">
                <Search
                  size={14}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-muted"
                />
                <input
                  type="text"
                  placeholder="Filter seeds..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full rounded-sm border border-line bg-elevated py-1.5 pl-8 pr-2.5 text-caption text-fg"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Batch Action Toolbar (Sticky) */}
      {canManage && selectedPlayerIds.size > 0 && !isLocked && (
        <div className="sticky top-4 z-40 flex flex-wrap items-center justify-between gap-3 rounded-md border border-brand bg-surface/96 px-4 py-2.5 shadow-[0_8px_24px_rgba(0,0,0,0.5)] backdrop-blur-md">
          <div className="flex items-center gap-2.5">
            <CheckSquare size={18} color="var(--color-brand)" />
            <span className="text-sm font-bold text-fg">
              {selectedPlayerIds.size} Competitor{selectedPlayerIds.size > 1 ? 's' : ''} Selected
            </span>
            <span className="text-xs text-fg-muted">
              (Hold Shift to range select)
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Up 1 */}
            <Button
              variant="secondary"
              onClick={handleBatchMoveUp}
              className={batchButtonClass}
              title="Shift each selected competitor up 1 position independently"
            >
              <ChevronUp size={14} />
              Up 1
            </Button>

            {/* Down 1 */}
            <Button
              variant="secondary"
              onClick={handleBatchMoveDown}
              className={batchButtonClass}
              title="Shift each selected competitor down 1 position independently"
            >
              <ChevronDown size={14} />
              Down 1
            </Button>

            {/* Jump to Seed */}
            <Button
              variant="secondary"
              onClick={() => {
                setBatchJumpInput('1');
                setIsBatchJumpOpen(true);
              }}
              className={batchButtonClass}
              title="Bunch selected competitors contiguously starting at target seed"
            >
              Jump to Seed...
            </Button>

            {/* Move to Top */}
            <Button
              variant="secondary"
              onClick={handleBatchMoveToTop}
              className={batchButtonClass}
              title="Bunch selected competitors at Seed #1"
            >
              <ChevronsUp size={14} />
              Top
            </Button>

            {/* Move to Bottom */}
            <Button
              variant="secondary"
              onClick={handleBatchMoveToBottom}
              className={batchButtonClass}
              title="Bunch selected competitors at the bottom"
            >
              <ChevronsDown size={14} />
              Bottom
            </Button>

            <div className="mx-1 h-4.5 w-px bg-line" />

            {/* Batch Remove */}
            <Button
              variant="secondary"
              onClick={() => setIsBatchDeleteConfirmOpen(true)}
              className={cn(batchButtonClass, 'border-red/40 text-red enabled:hover:border-red/40')}
              title="Remove selected competitors from seeding list"
            >
              <X size={14} />
              Remove ({selectedPlayerIds.size})
            </Button>

            {/* Clear Selection */}
            <button
              type="button"
              onClick={handleClearSelection}
              className="cursor-pointer border-0 bg-transparent px-2 py-1.5 text-caption text-fg-muted"
              title="Clear selection"
            >
              Deselect All
            </button>
          </div>
        </div>
      )}

      {/* Main Seed Table with Tier Boundaries */}
      <div
        className={cn(
          'overflow-x-auto overflow-y-hidden rounded-lg',
          isObsMode ? 'border-0 bg-transparent' : 'border border-line bg-surface'
        )}
      >
        {filteredList.length === 0 ? (
          <div className="px-6 py-12 text-center text-fg-muted">
            <p className="mx-0 mb-4 mt-0 text-base font-semibold">
              {manualSeeds.length === 0 ? 'No participants seeded yet.' : 'No seeds match your search query.'}
            </p>
            {manualSeeds.length === 0 && canManage && (
              <div className="mt-4 flex justify-center gap-3">
                <Button
                  variant="primary"
                  onClick={() => setIsDualListOpen(true)}
                  className="px-5 text-center"
                >
                  Add Seeds
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setIsBulkImportOpen(true)}
                  className="px-5 text-center"
                >
                  Bulk Import
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className={cn('flex flex-col', canManage ? 'min-w-162.5' : 'min-w-145')}>
            {/* Table Header Row */}
            {canManage ? (
              <div className={headerRowClass}>
                <div className="w-4 shrink-0" />
                <div className="w-5 shrink-0" />
                <div className="w-10.5 shrink-0 text-center">Seed</div>
                <div className="min-w-0 flex-1">Competitor</div>
                <div className="w-27.5 shrink-0 pr-2 text-right">Personal Best</div>
                <div className="w-27.5 shrink-0 text-center">Bracket Seed</div>
                <div className="w-37.5 shrink-0 text-right">Actions</div>
              </div>
            ) : (
              <div className={headerRowClass}>
                <div className="w-10 shrink-0 text-center">Seed</div>
                <div className="w-6 shrink-0 text-center">Flag</div>
                <div className="min-w-0 flex-1">Competitor</div>
                <div className="w-22.5 shrink-0">Style</div>
                <div className="w-27.5 shrink-0 pr-2 text-right">Personal Best</div>
                <div className="w-27.5 shrink-0 text-right">Bracket Seed</div>
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
                      className={cn(
                        'flex items-center justify-between border-b border-l-5 border-line px-5 py-2.5',
                        idx > 0 && 'border-t-2'
                      )}
                      style={{
                        backgroundColor: cutoffStartingHere.tier.cardColor || 'rgba(245, 158, 11, 0.08)',
                        borderLeftColor: cutoffStartingHere.tier.primaryColor || 'var(--color-gold-bright)',
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="text-sm font-extrabold uppercase tracking-wide"
                          style={{ color: cutoffStartingHere.tier.primaryColor || 'var(--color-gold-bright)' }}
                        >
                          {cutoffStartingHere.tier.name}
                        </span>
                        <span className="text-caption text-fg-muted">
                          • Seeds {cutoffStartingHere.start}–{cutoffStartingHere.end} ({cutoffStartingHere.capacity} slots)
                        </span>
                      </div>
                      <Badge
                        className="text-xs"
                        style={{
                          backgroundColor: cutoffStartingHere.tier.primaryColor ? `${cutoffStartingHere.tier.primaryColor}22` : 'rgba(245, 158, 11, 0.15)',
                          color: cutoffStartingHere.tier.primaryColor || 'var(--color-gold-bright)',
                          borderColor: `${cutoffStartingHere.tier.primaryColor || 'var(--color-gold-bright)'}44`,
                        }}
                      >
                        Tier {cutoffStartingHere.tier.priority}
                      </Badge>
                    </div>
                  )}

                  {/* Reserves Divider Banner */}
                  {isReservesStart && (
                    <div className="flex items-center justify-between border-b border-l-5 border-t-2 border-line border-l-fg-muted bg-fg-muted/8 px-5 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-extrabold uppercase text-fg-secondary">
                          Alternates / Reserves Pool (Did Not Qualify)
                        </span>
                        <span className="text-caption text-fg-muted">
                          • Seeds {totalBracketCapacity + 1}+
                        </span>
                      </div>
                      <Badge className="border-0 bg-elevated text-xs text-fg-muted">
                        Unassigned to Brackets
                      </Badge>
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
                      className={cn(
                        'flex items-center gap-3 border-b border-line-subtle px-5 py-2.5 transition-colors duration-150',
                        selectedPlayerIds.has(item.id)
                          ? 'bg-[rgba(99,102,241,0.12)]'
                          : draggedIndex === item.seedNumber - 1
                          ? 'bg-[rgba(99,102,241,0.15)]'
                          : 'bg-transparent'
                      )}
                    >
                      {/* Drag Handle */}
                      {!isLocked ? (
                        <div
                          className="flex w-4 shrink-0 cursor-grab items-center p-1 text-fg-muted"
                          title="Drag to reorder seed"
                        >
                          <GripVertical size={16} />
                        </div>
                      ) : (
                        <div className="w-4 shrink-0" />
                      )}

                      {/* Selection Checkbox */}
                      {!isLocked && (
                        <div
                          onClick={e => {
                            e.stopPropagation();
                            handleToggleSelect(item.id, idx, e.shiftKey);
                          }}
                          className="flex w-5 shrink-0 cursor-pointer items-center p-1"
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
                        className={cn(
                          'w-10.5 shrink-0 rounded-sm border px-2 py-1 text-center text-caption font-extrabold',
                          isLocked ? 'cursor-default' : 'cursor-pointer'
                        )}
                        style={{
                          background: item.tier ? (item.tier.primaryColor ? `${item.tier.primaryColor}22` : 'rgba(245, 158, 11, 0.15)') : 'var(--color-bg-surface-elevated)',
                          borderColor: item.tier?.primaryColor ? `${item.tier.primaryColor}55` : 'var(--color-border)',
                          color: item.tier?.primaryColor || 'var(--color-text-secondary)',
                        }}
                        title={isLocked ? `Seed #${item.seedNumber}` : 'Click to jump to a specific seed number'}
                      >
                        {`#${item.seedNumber}`}
                      </button>

                      {/* Competitor Name (flex: 1) */}
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-fg">
                        {item.name}
                      </span>

                      {/* Personal Best (2nd from right column) */}
                      <div className="w-27.5 shrink-0 pr-2 text-right">
                        <span
                          className={cn('font-mono text-sm font-semibold', item.personalBest ? 'text-gold-bright' : 'text-fg-muted')}
                          title={item.personalBest ? `Personal Best: ${item.personalBest.toLocaleString()}` : 'No PB recorded'}
                        >
                          {item.personalBest ? item.personalBest.toLocaleString() : '—'}
                        </span>
                      </div>

                      {/* Bracket Seed Chip */}
                      <div className="flex w-27.5 shrink-0 justify-center">
                        {item.tier && item.tierSeed ? (
                          <span
                            className="inline-flex items-center whitespace-nowrap rounded-sm border px-2 py-1 text-xs font-bold tracking-wide"
                            style={{
                              backgroundColor: item.tier.primaryColor ? `${item.tier.primaryColor}22` : 'rgba(245, 158, 11, 0.15)',
                              color: item.tier.primaryColor || 'var(--color-gold-bright)',
                              borderColor: item.tier.primaryColor ? `${item.tier.primaryColor}55` : 'rgba(245, 158, 11, 0.3)',
                            }}
                            title={`Assigned to ${item.tier.name} bracket as Seed #${item.tierSeed}`}
                          >
                            {`${item.tier.name} ${item.tierSeed}`}
                          </span>
                        ) : item.isReserve ? (
                          <span className="inline-flex items-center whitespace-nowrap rounded-sm border border-line bg-fg-muted/15 px-2 py-1 text-xs font-semibold text-fg-muted">
                            Reserve
                          </span>
                        ) : (
                          <span className="text-xs text-fg-muted">—</span>
                        )}
                      </div>

                      {/* Row Controls */}
                      {!isLocked && (
                        <div className="flex w-37.5 shrink-0 items-center justify-end gap-1">
                          <IconButton
                            aria-label="Move to top"
                            disabled={item.seedNumber === 1}
                            onClick={() => reorderManualSeed(tournament.id, item.seedNumber - 1, 0)}
                            className={rowControlClass}
                            title="Move to top (#1 Seed)"
                          >
                            <ChevronsUp size={15} />
                          </IconButton>

                          <IconButton
                            aria-label="Move up"
                            disabled={item.seedNumber === 1}
                            onClick={() => reorderManualSeed(tournament.id, item.seedNumber - 1, item.seedNumber - 2)}
                            className={rowControlClass}
                            title="Move Up (↑)"
                          >
                            <ChevronUp size={15} />
                          </IconButton>

                          <IconButton
                            aria-label="Move down"
                            disabled={item.seedNumber === manualSeeds.length}
                            onClick={() => reorderManualSeed(tournament.id, item.seedNumber - 1, item.seedNumber)}
                            className={rowControlClass}
                            title="Move Down (↓)"
                          >
                            <ChevronDown size={15} />
                          </IconButton>

                          <IconButton
                            aria-label="Move to bottom"
                            disabled={item.seedNumber === manualSeeds.length}
                            onClick={() => reorderManualSeed(tournament.id, item.seedNumber - 1, manualSeeds.length - 1)}
                            className={rowControlClass}
                            title="Move to bottom"
                          >
                            <ChevronsDown size={15} />
                          </IconButton>

                          <div className="mx-1 h-3.5 w-px bg-line" />

                          <IconButton
                            aria-label="Remove from seeds"
                            onClick={() => removeManualSeed(tournament.id, item.id)}
                            className="flex p-1 text-red-bright opacity-75"
                            title="Remove from seeds"
                          >
                            <X size={15} />
                          </IconButton>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Public Spectator Row: Overall seed > Flag > Player name > Playstyle > PB > bracket seed chip */
                    <div className="flex items-center gap-3 border-b border-line-subtle px-5 py-2.5 transition-colors duration-150">
                      {/* Overall Seed */}
                      <div className="w-10 shrink-0 text-center">
                        <span
                          className="text-sm font-extrabold"
                          style={{ color: item.tier?.primaryColor || 'var(--color-gold-bright)' }}
                        >
                          {`#${item.seedNumber}`}
                        </span>
                      </div>

                      {/* Flag / Avatar (to the left of player name) */}
                      <div className="flex w-6 shrink-0 items-center justify-center">
                        <PlayerAvatar player={item} />
                      </div>

                      {/* Competitor Name */}
                      <span className="min-w-0 flex-1 truncate text-base font-semibold text-fg">
                        {item.name}
                      </span>

                      {/* Playstyle (in its own column just to the right of player name) */}
                      <div className="flex w-22.5 shrink-0 items-center justify-start">
                        {item.playstyle ? (
                          <PlaystyleChip style={item.playstyle} />
                        ) : (
                          <span className="text-xs text-fg-muted">—</span>
                        )}
                      </div>

                      {/* Personal Best (2nd from right column) */}
                      <div className="w-27.5 shrink-0 pr-2 text-right">
                        <span
                          className={cn('font-mono text-sm font-semibold', item.personalBest ? 'text-gold-bright' : 'text-fg-muted')}
                          title={item.personalBest ? `Personal Best: ${item.personalBest.toLocaleString()}` : 'No PB recorded'}
                        >
                          {item.personalBest ? item.personalBest.toLocaleString() : '—'}
                        </span>
                      </div>

                      {/* Bracket Seed Chip (far right) */}
                      <div className="flex w-27.5 shrink-0 justify-end">
                        {item.tier && item.tierSeed ? (
                          <span
                            className="inline-flex items-center whitespace-nowrap rounded-sm border px-2 py-1 text-xs font-bold tracking-wide"
                            style={{
                              backgroundColor: item.tier.primaryColor ? `${item.tier.primaryColor}22` : 'rgba(245, 158, 11, 0.15)',
                              color: item.tier.primaryColor || 'var(--color-gold-bright)',
                              borderColor: item.tier.primaryColor ? `${item.tier.primaryColor}55` : 'rgba(245, 158, 11, 0.3)',
                            }}
                            title={`Assigned to ${item.tier.name} bracket as Seed #${item.tierSeed}`}
                          >
                            {`${item.tier.name} ${item.tierSeed}`}
                          </span>
                        ) : item.isReserve ? (
                          <span className="inline-flex items-center whitespace-nowrap rounded-sm border border-line bg-fg-muted/15 px-2 py-1 text-xs font-semibold text-fg-muted">
                            Reserve
                          </span>
                        ) : (
                          <span className="text-xs text-fg-muted">—</span>
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
            <h3 id={jumpTitleId} className="m-0 text-lg font-bold text-fg">
              Set Seed for {jumpSeedTarget?.name}
            </h3>
            <p className="m-0 text-caption text-fg-muted">
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
              className={seedInputClass}
            />
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={requestClose} className="px-3.5 py-1.5 text-caption">
                Cancel
              </Button>
              <Button variant="primary" onClick={handleExecuteJump} className="px-4 py-1.5 text-caption">
                Jump to Seed
              </Button>
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
            <h3 id={batchJumpTitleId} className="m-0 text-lg font-bold text-fg">
              Jump {selectedPlayerIds.size} Selected Competitors
            </h3>
            <p className="m-0 text-caption leading-snug text-fg-muted">
              Selected competitors will bunch contiguously starting at the target seed position, preserving their existing relative order.
            </p>
            <div>
              <label className="mb-1.5 block text-caption text-fg-secondary">
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
                className={seedInputClass}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={requestClose} className="px-3.5 py-1.5 text-caption">
                Cancel
              </Button>
              <Button variant="primary" onClick={handleExecuteBatchJump} className="px-4 py-1.5 text-caption">
                Jump to Seed #{batchJumpInput || '1'}
              </Button>
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
