import React, { useState, useRef, useEffect } from 'react';
import { PlayerProfile } from '../../tournament/types';
import { getEffectivePlayerName } from '../../players/playerNameUtils';
import { User, Plus, Search, Check, X } from 'lucide-react';
import { Badge, IconButton, cn } from '../../../components/ui';

interface CreatablePlayerSelectProps {
  playersPool: PlayerProfile[];
  globalPlayers?: PlayerProfile[];
  selectedPlayer: PlayerProfile | null;
  onSelectPlayer: (player: PlayerProfile | null) => void;
  onCreatePlayer: (name: string) => PlayerProfile;
  onSelectGlobalPlayer?: (player: PlayerProfile) => void;
}

export const CreatablePlayerSelect: React.FC<CreatablePlayerSelectProps> = ({
  playersPool,
  globalPlayers = [],
  selectedPlayer,
  onSelectPlayer,
  onCreatePlayer,
  onSelectGlobalPlayer,
}) => {
  const [query, setQuery] = useState(selectedPlayer ? getEffectivePlayerName(selectedPlayer) : '');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedPlayer) {
      setQuery(getEffectivePlayerName(selectedPlayer));
    } else {
      setQuery('');
    }
  }, [selectedPlayer]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const queryTrimmed = query.trim().toLowerCase();

  const filteredInTournament = playersPool.filter(p =>
    p.name.toLowerCase().includes(queryTrimmed) ||
    getEffectivePlayerName(p).toLowerCase().includes(queryTrimmed)
  );

  const existingInTournamentNames = new Set(playersPool.map(p => p.name.toLowerCase()));
  const existingInTournamentIds = new Set(playersPool.map(p => p.id));

  const filteredGlobal = globalPlayers.filter(p =>
    !existingInTournamentIds.has(p.id) &&
    !existingInTournamentNames.has(p.name.toLowerCase()) &&
    (p.name.toLowerCase().includes(queryTrimmed) || getEffectivePlayerName(p).toLowerCase().includes(queryTrimmed))
  );

  const exactMatchInTournament = playersPool.find(
    p => p.name.toLowerCase() === queryTrimmed || getEffectivePlayerName(p).toLowerCase() === queryTrimmed
  );
  const exactMatchInGlobal = globalPlayers.find(
    p => p.name.toLowerCase() === queryTrimmed || getEffectivePlayerName(p).toLowerCase() === queryTrimmed
  );
  const exactMatch = exactMatchInTournament || exactMatchInGlobal;

  const handleSelect = (p: PlayerProfile) => {
    onSelectPlayer(p);
    setQuery(getEffectivePlayerName(p));
    setIsOpen(false);
  };

  const handleSelectGlobal = (p: PlayerProfile) => {
    if (onSelectGlobalPlayer) {
      onSelectGlobalPlayer(p);
    } else {
      onSelectPlayer(p);
    }
    setQuery(getEffectivePlayerName(p));
    setIsOpen(false);
  };

  const handleCreateNew = () => {
    const trimmed = query.trim();
    if (!trimmed) return;
    const newP = onCreatePlayer(trimmed);
    onSelectPlayer(newP);
    setQuery(newP.name);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setQuery('');
    onSelectPlayer(null);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={e => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder="Search or enter competitor name..."
          className="w-full py-2.5 px-9 rounded-sm border border-line bg-canvas text-fg text-sm"
        />
        <Search
          size={16}
          color="var(--color-fg-muted)"
          className="absolute left-2.5 top-1/2 -translate-y-1/2"
        />
        {query && (
          <IconButton
            aria-label="Clear player selection"
            onClick={handleClear}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5"
            title="Clear player selection"
          >
            <X size={15} />
          </IconButton>
        )}
      </div>

      {isOpen && (
        <div className="absolute top-[calc(100%+4px)] left-0 right-0 max-h-85 overflow-y-auto bg-elevated border border-line rounded-md shadow-[0_12px_28px_rgba(0,0,0,0.45),0_0_0_1px_var(--color-line)] z-1000">
          {/* In-Tournament Players */}
          {filteredInTournament.map(p => {
            const isSelected = selectedPlayer?.id === p.id;
            return (
              <div
                key={p.id}
                onClick={() => handleSelect(p)}
                className={cn(
                  'flex items-center justify-between py-2.5 px-3.5 cursor-pointer border-b border-line-subtle',
                  isSelected ? 'bg-gold-soft' : 'bg-transparent'
                )}
              >
                <div className="flex items-center gap-2">
                  <User size={15} color="var(--color-fg-muted)" />
                  <span className={cn('text-fg', isSelected ? 'font-bold' : 'font-medium')}>
                    {getEffectivePlayerName(p)}
                  </span>
                  {p.displayName && p.displayName !== p.name && (
                    <span className="text-xs text-fg-muted">
                      ({p.name})
                    </span>
                  )}
                  {p.country && (
                    <span className="text-3xs py-0.5 px-1.5 rounded-sm bg-highlight text-fg-secondary font-semibold">
                      {p.country}
                    </span>
                  )}
                  {p.playstyle && (
                    <Badge variant="muted" className="text-3xs">
                      {p.playstyle}
                    </Badge>
                  )}
                </div>
                {isSelected && <Check size={16} color="var(--color-gold-bright)" />}
              </div>
            );
          })}

          {/* Global Players Section */}
          {filteredGlobal.length > 0 && (
            <div>
              <div
                className={cn(
                  'py-1.5 px-3.5 bg-canvas text-2xs font-bold uppercase text-gold-bright tracking-wider border-b border-line-subtle',
                  filteredInTournament.length > 0 ? 'border-t border-line' : 'border-t-0'
                )}
              >
                From Global Player Pool (Auto-imports to tournament)
              </div>
              {filteredGlobal.map(p => (
                <div
                  key={p.id}
                  onClick={() => handleSelectGlobal(p)}
                  className="flex items-center justify-between py-2.5 px-3.5 cursor-pointer border-b border-line-subtle bg-transparent"
                >
                  <div className="flex items-center gap-2">
                    <User size={15} color="var(--color-gold-bright)" />
                    <span className="font-semibold text-fg">
                      {getEffectivePlayerName(p)}
                    </span>
                    {p.displayName && p.displayName !== p.name && (
                      <span className="text-xs text-fg-muted">
                        ({p.name})
                      </span>
                    )}
                    {p.country && (
                      <span className="text-3xs py-0.5 px-1.5 rounded-sm bg-highlight text-fg-secondary font-semibold">
                        {p.country}
                      </span>
                    )}
                    {p.playstyle && (
                      <Badge variant="muted" className="text-3xs">
                        {p.playstyle}
                      </Badge>
                    )}
                  </div>
                  <span className="text-3xs py-0.5 px-1.5 rounded-sm bg-gold/15 text-gold-bright font-semibold">
                    + Import
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Creatable option */}
          {query.trim().length > 0 && !exactMatch && (
            <div
              onClick={handleCreateNew}
              className="flex items-center gap-2 py-3 px-3.5 cursor-pointer bg-gold/10 border-t border-dashed border-gold text-gold-bright font-semibold text-sm"
            >
              <Plus size={16} />
              <span>Add &quot;{query.trim()}&quot; as new competitor</span>
            </div>
          )}

          {filteredInTournament.length === 0 && filteredGlobal.length === 0 && query.trim().length === 0 && (
            <div className="p-3 text-center text-fg-muted text-caption">
              Type a name to search or add a player
            </div>
          )}
        </div>
      )}
    </div>
  );
};
