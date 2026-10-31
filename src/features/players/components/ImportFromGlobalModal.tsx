import React, { useState, useMemo, useId } from 'react';
import { PlayerProfile } from '../../tournament/types';
import { Users, X, Search, CheckSquare, Square, Download, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Overlay } from '../../../components/overlay';

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
          <div
            style={{
              padding: '1.25rem 1.5rem',
              borderBottom: '1px solid var(--color-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'var(--color-bg-surface)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  background: 'rgba(245, 158, 11, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--color-gold-bright)',
                }}
              >
                <Users size={18} />
              </div>
              <div>
                <h3 id={titleId} style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
                  Import from Global Pool
                </h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: 0 }}>
                  Select competitors from master catalog to register into tournament roster
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
                padding: '0.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              <X size={18} />
            </button>
          </div>

          {/* Search & Bulk Select Bar */}
          <div
            style={{
              padding: '0.85rem 1.5rem',
              borderBottom: '1px solid var(--color-border-subtle)',
              background: 'var(--color-bg-surface)',
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ position: 'relative', flex: 1 }}>
              <input
                type="text"
                placeholder="Search available global competitors..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem 0.5rem 2.2rem',
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

            {filteredAvailable.length > 0 && (
              <button
                type="button"
                onClick={handleSelectAll}
                className="btn btn-secondary"
                style={{ padding: '0.45rem 0.75rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem', whiteSpace: 'nowrap' }}
              >
                {isAllSelected ? <CheckSquare size={14} color="var(--color-gold-bright)" /> : <Square size={14} />}
                {isAllSelected ? 'Deselect All' : `Select All (${filteredAvailable.length})`}
              </button>
            )}
          </div>

          {/* Body: List of Players */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem 1.5rem', display: 'flex', flexDirection: 'column' }}>
            {availablePlayers.length === 0 ? (
              <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--color-text-secondary)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                <p style={{ margin: 0, fontSize: '0.9rem' }}>
                  {globalPlayers.length === 0
                    ? 'No competitors in global player directory.'
                    : 'All competitors in global catalog are already registered in this tournament!'}
                </p>
                <Link
                  to="/players"
                  onClick={onClose}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.8rem', padding: '0.45rem 0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', textDecoration: 'none', marginTop: '0.5rem' }}
                >
                  <Plus size={14} /> Open Global Player Pool
                </Link>
              </div>
            ) : filteredAvailable.length === 0 ? (
              <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                No available competitors match &quot;{searchQuery}&quot;
              </div>
            ) : (
              filteredAvailable.map(player => {
                const isSelected = selectedIds.has(player.id);
                return (
                  <div
                    key={player.id}
                    onClick={() => handleTogglePlayer(player.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.75rem 0.5rem',
                      borderBottom: '1px solid var(--color-border-subtle)',
                      cursor: 'pointer',
                      background: isSelected ? 'var(--color-gold-bg)' : 'transparent',
                      borderRadius: 'var(--radius-sm)',
                      transition: 'background 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ color: isSelected ? 'var(--color-gold-bright)' : 'var(--color-text-muted)' }}>
                        {isSelected ? <CheckSquare size={18} /> : <Square size={18} />}
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontWeight: 700, color: 'var(--color-text-primary)', fontSize: '0.9rem' }}>
                            {player.name}
                          </span>
                          {player.country && (
                            <span style={{ fontSize: '0.65rem', padding: '0.1rem 0.35rem', borderRadius: 'var(--radius-sm)', background: 'var(--color-bg-surface-highlight)', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                              {player.country}
                            </span>
                          )}
                          {player.playstyle && (
                            <span className="badge badge-muted" style={{ fontSize: '0.65rem' }}>
                              {player.playstyle}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.15rem' }}>
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
          <div
            style={{
              padding: '1rem 1.5rem',
              borderTop: '1px solid var(--color-border)',
              background: 'var(--color-bg-surface)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
              <strong>{selectedIds.size}</strong> competitor(s) selected
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={requestClose}
                className="btn btn-secondary"
                style={{ padding: '0.5rem 1.15rem', fontSize: '0.85rem' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={selectedIds.size === 0}
                className="btn btn-primary"
                style={{
                  padding: '0.5rem 1.35rem',
                  fontSize: '0.85rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  boxShadow: 'var(--shadow-gold)',
                  opacity: selectedIds.size === 0 ? 0.5 : 1,
                  cursor: selectedIds.size === 0 ? 'not-allowed' : 'pointer',
                }}
              >
                <Download size={15} />
                Import Selected ({selectedIds.size})
              </button>
            </div>
          </div>
        </>
      )}
    </Overlay>
  );
};
