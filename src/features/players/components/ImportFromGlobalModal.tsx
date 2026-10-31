import React, { useState, useMemo, useId } from 'react';
import { PlayerProfile } from '../../tournament/types';
import { Users, X, Search, CheckSquare, Square, Download, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Overlay } from '../../../components/overlay';
import { Badge, Button, IconButton, buttonClasses, cn } from '../../../components/ui';

interface ImportFromGlobalModalProps {
  isOpen: boolean;
  onClose: () => void;
  globalPlayers: PlayerProfile[];
  currentTournamentPlayers: PlayerProfile[];
  onImport: (players: PlayerProfile[]) => void;
}

export const ImportFromGlobalModal: React.FC<ImportFromGlobalModalProps> = ({
  isOpen,
  onClose,
  globalPlayers,
  currentTournamentPlayers,
  onImport,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const titleId = useId();

  // Existing player IDs & names in this tournament
  const existingIds = useMemo(
    () => new Set(currentTournamentPlayers.map(p => p.id)),
    [currentTournamentPlayers]
  );
  const existingNames = useMemo(
    () => new Set(currentTournamentPlayers.map(p => p.name.toLowerCase())),
    [currentTournamentPlayers]
  );

  // Available global players not yet in this tournament
  const availablePlayers = useMemo(() => {
    return globalPlayers.filter(
      p => !existingIds.has(p.id) && !existingNames.has(p.name.toLowerCase())
    );
  }, [globalPlayers, existingIds, existingNames]);

  // Filtered by search
  const filteredAvailable = useMemo(() => {
    if (!searchQuery.trim()) return availablePlayers;
    const q = searchQuery.toLowerCase().trim();
    return availablePlayers.filter(
      p =>
        p.name.toLowerCase().includes(q) ||
        p.country?.toLowerCase().includes(q) ||
        p.playstyle?.toLowerCase().includes(q) ||
        p.notes?.toLowerCase().includes(q)
    );
  }, [availablePlayers, searchQuery]);

  if (!isOpen) return null;

  const handleTogglePlayer = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filteredAvailable.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredAvailable.map(p => p.id)));
    }
  };

  const handleConfirmImport = () => {
    const playersToImport = availablePlayers.filter(p => selectedIds.has(p.id));
    if (playersToImport.length > 0) {
      onImport(playersToImport);
    }
    onClose();
  };

  const isAllSelected = filteredAvailable.length > 0 && selectedIds.size === filteredAvailable.length;

  return (
    <Overlay
      open
      onClose={onClose}
      dirty={selectedIds.size > 0}
      aria-labelledby={titleId}
      panelClassName="flex max-h-[85vh] max-w-140 flex-col overflow-hidden rounded-lg border border-line bg-elevated shadow-xl"
    >
      {({ requestClose }) => (
        <>
          {/* Header */}
          <div className="flex items-center justify-between border-b border-line bg-surface px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-full bg-gold/15 text-gold-bright">
                <Users size={18} />
              </div>
              <div>
                <h3 id={titleId} className="m-0 text-lg font-bold text-fg">
                  Import from Global Pool
                </h3>
                <p className="m-0 text-xs text-fg-muted">
                  Select competitors from master catalog to register into tournament roster
                </p>
              </div>
            </div>
            <IconButton aria-label="Close" onClick={requestClose}>
              <X size={18} />
            </IconButton>
          </div>

          {/* Search & Bulk Select Bar */}
          <div className="flex items-center justify-between gap-4 border-b border-line-subtle bg-surface px-6 py-3.5">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Search available global competitors..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full rounded-sm border border-line bg-canvas py-2 pr-3 pl-9 text-sm text-fg"
              />
              <Search
                size={15}
                color="var(--color-fg-muted)"
                className="absolute top-1/2 left-2.5 -translate-y-1/2"
              />
            </div>

            {filteredAvailable.length > 0 && (
              <Button
                variant="secondary"
                onClick={handleSelectAll}
                className="gap-1.5 px-3 py-2 text-caption"
              >
                {isAllSelected ? <CheckSquare size={14} color="var(--color-gold-bright)" /> : <Square size={14} />}
                {isAllSelected ? 'Deselect All' : `Select All (${filteredAvailable.length})`}
              </Button>
            )}
          </div>

          {/* Body: List of Players */}
          <div className="flex flex-1 flex-col overflow-y-auto px-6 py-2">
            {availablePlayers.length === 0 ? (
              <div className="flex flex-col items-center gap-3 px-4 py-12 text-center text-fg-secondary">
                <p className="m-0 text-sm">
                  {globalPlayers.length === 0
                    ? 'No competitors in global player directory.'
                    : 'All competitors in global catalog are already registered in this tournament!'}
                </p>
                <Link
                  to="/players"
                  onClick={onClose}
                  className={buttonClasses({
                    variant: 'secondary',
                    className: 'mt-2 gap-1.5 px-3.5 py-2 text-caption hover:border-fg-secondary hover:bg-highlight',
                  })}
                >
                  <Plus size={14} /> Open Global Player Pool
                </Link>
              </div>
            ) : filteredAvailable.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-fg-muted">
                No available competitors match &quot;{searchQuery}&quot;
              </div>
            ) : (
              filteredAvailable.map(player => {
                const isSelected = selectedIds.has(player.id);
                return (
                  <div
                    key={player.id}
                    onClick={() => handleTogglePlayer(player.id)}
                    className={cn(
                      'flex cursor-pointer items-center justify-between rounded-sm border-b border-line-subtle px-2 py-3 transition-colors duration-150',
                      isSelected ? 'bg-gold-soft' : 'bg-transparent'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={isSelected ? 'text-gold-bright' : 'text-fg-muted'}>
                        {isSelected ? <CheckSquare size={18} /> : <Square size={18} />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-fg">
                            {player.name}
                          </span>
                          {player.country && (
                            <span className="rounded-sm bg-highlight px-1.5 py-0.5 text-3xs font-semibold text-fg-secondary">
                              {player.country}
                            </span>
                          )}
                          {player.playstyle && (
                            <Badge variant="muted" className="text-3xs">
                              {player.playstyle}
                            </Badge>
                          )}
                        </div>
                        <div className="mt-0.5 text-xs text-fg-muted">
                          PB: {player.personalBest ? player.personalBest.toLocaleString() : '—'}
                          {player.notes && ` • ${player.notes}`}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-line bg-surface px-6 py-4">
            <div className="text-caption text-fg-muted">
              <strong>{selectedIds.size}</strong> competitor(s) selected
            </div>
            <div className="flex gap-3">
              <Button
                variant="secondary"
                onClick={requestClose}
                className="px-4.5 py-2 text-sm"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleConfirmImport}
                disabled={selectedIds.size === 0}
                className="gap-2 px-5.5 py-2 text-sm shadow-gold"
              >
                <Download size={15} />
                Import Selected ({selectedIds.size})
              </Button>
            </div>
          </div>
        </>
      )}
    </Overlay>
  );
};
