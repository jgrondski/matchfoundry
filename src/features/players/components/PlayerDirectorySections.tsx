import React, { useState, useRef, useMemo } from 'react';
import { Button, cn } from '../../../components/ui';
import { PlayerProfile, Organization } from '../../tournament/types';
import { PlayerAvatar } from './PlayerAvatar';
import { PlaystyleChip } from './PlaystyleChip';
import { CountryFlag } from '../flagUtils';
import { SIMULATION_ENABLED } from '../../../utils/simulationEnv';
import {
  Users,
  Plus,
  Sparkles,
  Search,
  Trash2,
  Edit2,
  Trophy,
  X,
  ArrowUpDown,
  Filter,
  Building2,
} from 'lucide-react';

const statCardClass = 'flex flex-col gap-1.5 rounded-md border border-line bg-surface px-5 py-4.5';
const statLabelClass = 'text-xs font-semibold uppercase text-fg-muted';
const statSubtextClass = 'text-xs text-fg-muted';
const filterSelectClass = 'rounded-sm border border-line bg-canvas px-3 py-2 text-caption text-fg';
const thClass = 'px-4 py-3';
const tdClass = 'px-4 py-3';

/* -------------------------------------------------------------------------- */
/*                            1. Stats Summary Cards                          */
/* -------------------------------------------------------------------------- */

interface PlayerDirectoryStatsProps {
  globalPlayers: PlayerProfile[];
}

export const PlayerDirectoryStats: React.FC<PlayerDirectoryStatsProps> = React.memo(({ globalPlayers }) => {
  const stats = useMemo(() => {
    const total = globalPlayers.length;
    let rollingCount = 0;
    let dasCount = 0;
    let hypertapCount = 0;
    let maxPb = 0;
    let maxPbPlayer = '';
    let pbSum = 0;

    globalPlayers.forEach(p => {
      if (p.playstyle === 'Rolling') rollingCount++;
      else if (p.playstyle === 'DAS') dasCount++;
      else if (p.playstyle === 'Hypertap') hypertapCount++;

      const pb = p.personalBest || 0;
      pbSum += pb;
      if (pb > maxPb) {
        maxPb = pb;
        maxPbPlayer = p.name;
      }
    });

    const avgPb = total > 0 ? Math.round(pbSum / total) : 0;

    return {
      total,
      rollingCount,
      dasCount,
      hypertapCount,
      maxPb,
      maxPbPlayer,
      avgPb,
    };
  }, [globalPlayers]);

  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
      <div className={statCardClass}>
        <div className={statLabelClass}>
          Total Global Competitors
        </div>
        <div className="text-3xl font-extrabold text-fg">
          {stats.total}
        </div>
        <div className={statSubtextClass}>
          Ready for tournament roster import
        </div>
      </div>

      <div className={statCardClass}>
        <div className={statLabelClass}>
          Playstyle Breakdown
        </div>
        <div className="mt-1 flex items-center gap-2">
          <span className="rounded-sm bg-purple-500/15 px-2 py-1 text-caption font-bold text-purple-400">
            Rolling: {stats.rollingCount}
          </span>
          <span className="rounded-sm bg-gold/15 px-2 py-1 text-caption font-bold text-gold-bright">
            DAS: {stats.dasCount}
          </span>
          <span className="rounded-sm bg-teal-500/15 px-2 py-1 text-caption font-bold text-teal-400">
            Hypertap: {stats.hypertapCount}
          </span>
        </div>
        <div className="mt-0.5 text-xs text-fg-muted">
          Diverse competitive mechanical styles
        </div>
      </div>

      <div className={statCardClass}>
        <div className={statLabelClass}>
          Highest Personal Best
        </div>
        <div className="font-mono text-3xl font-extrabold text-gold-bright">
          {stats.maxPb > 0 ? stats.maxPb.toLocaleString() : '—'}
        </div>
        <div className={statSubtextClass}>
          {stats.maxPbPlayer ? `Held by ${stats.maxPbPlayer}` : 'No personal bests recorded'}
        </div>
      </div>

      <div className={statCardClass}>
        <div className={statLabelClass}>
          Average Personal Best
        </div>
        <div className="font-mono text-3xl font-extrabold text-fg">
          {stats.avgPb > 0 ? stats.avgPb.toLocaleString() : '—'}
        </div>
        <div className={statSubtextClass}>
          Across {stats.total} registered competitors
        </div>
      </div>
    </div>
  );
});

/* -------------------------------------------------------------------------- */
/*                            2. Filter Bar (Debounced)                       */
/* -------------------------------------------------------------------------- */

interface PlayerDirectoryFilterBarProps {
  onSearchChange: (query: string) => void;
  playstyleFilter: string;
  onPlaystyleChange: (style: string) => void;
  orgFilter: string;
  onOrgFilterChange: (orgId: string) => void;
  sortBy: 'NAME_ASC' | 'PB_DESC' | 'PB_ASC' | 'COUNTRY';
  onSortChange: (sort: 'NAME_ASC' | 'PB_DESC' | 'PB_ASC' | 'COUNTRY') => void;
  organizations: Organization[];
}

export const PlayerDirectoryFilterBar: React.FC<PlayerDirectoryFilterBarProps> = React.memo(({
  onSearchChange,
  playstyleFilter,
  onPlaystyleChange,
  orgFilter,
  onOrgFilterChange,
  sortBy,
  onSortChange,
  organizations,
}) => {
  const [searchInput, setSearchInput] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchInput(val);
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      onSearchChange(val);
    }, 500);
  };

  const handleClear = () => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    setSearchInput('');
    onSearchChange('');
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-md border border-line bg-surface px-5 py-4">
      {/* Search Input */}
      <div className="relative max-w-100 flex-[1_1_280px]">
        <input
          type="text"
          value={searchInput}
          onChange={handleInputChange}
          placeholder="Search competitor name, country, notes..."
          className="w-full rounded-sm border border-line bg-canvas py-2 pr-3.5 pl-9 text-sm text-fg"
        />
        <Search
          size={16}
          color="var(--color-fg-muted)"
          className="absolute top-1/2 left-2.5 -translate-y-1/2"
        />
        {searchInput && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute top-1/2 right-2 -translate-y-1/2 cursor-pointer border-0 bg-transparent p-0.5 text-fg-muted"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Playstyle Filter Pills */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 flex items-center gap-1 text-xs font-semibold text-fg-muted">
          <Filter size={13} /> Style:
        </span>
        {[
          { key: 'ALL', label: 'All Styles' },
          { key: 'Rolling', label: 'Rolling' },
          { key: 'DAS', label: 'DAS' },
          { key: 'Hypertap', label: 'Hypertap' },
        ].map(f => (
          <button
            key={f.key}
            type="button"
            onClick={() => onPlaystyleChange(f.key)}
            className={cn(
              'cursor-pointer rounded-sm border px-3 py-1.5 text-caption transition-all duration-150',
              playstyleFilter === f.key
                ? 'border-gold bg-gold-soft font-bold text-gold-bright'
                : 'border-line-subtle bg-transparent font-medium text-fg-secondary'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Filters Group: Org & Sort */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Organization Circuit Selector */}
        <div className="flex items-center gap-1.5">
          <Building2 size={14} color="var(--color-fg-muted)" />
          <select
            value={orgFilter}
            onChange={e => onOrgFilterChange(e.target.value)}
            className={filterSelectClass}
          >
            <option value="ALL">All Organizations</option>
            {organizations.map(org => (
              <option key={org.id} value={org.id}>
                {org.name} ({org.shortName || org.slug.toUpperCase()})
              </option>
            ))}
          </select>
        </div>

        {/* Sort Selector */}
        <div className="flex items-center gap-2">
          <ArrowUpDown size={14} color="var(--color-fg-muted)" />
          <select
            value={sortBy}
            onChange={e => onSortChange(e.target.value as 'NAME_ASC' | 'PB_DESC' | 'PB_ASC' | 'COUNTRY')}
            className={filterSelectClass}
          >
            <option value="PB_DESC">Sort: PB High to Low</option>
            <option value="PB_ASC">Sort: PB Low to High</option>
            <option value="NAME_ASC">Sort: Name (A–Z)</option>
            <option value="COUNTRY">Sort: Country</option>
          </select>
        </div>
      </div>
    </div>
  );
});

/* -------------------------------------------------------------------------- */
/*                            3. Table Row (Memoized)                         */
/* -------------------------------------------------------------------------- */

interface PlayerDirectoryRowProps {
  player: PlayerProfile;
  index: number;
  onEdit: (player: PlayerProfile) => void;
  onDelete: (player: PlayerProfile) => void;
}

export const PlayerDirectoryRow: React.FC<PlayerDirectoryRowProps> = React.memo(({
  player,
  index,
  onEdit,
  onDelete,
}) => {
  const isMaxout = (player.personalBest || 0) >= 999999;

  return (
    <tr className="border-b border-line-subtle bg-transparent transition-colors duration-150">
      {/* Index */}
      <td className="px-4 py-3 text-center font-semibold text-fg-muted">
        {index + 1}
      </td>

      {/* Name */}
      <td className={tdClass}>
        <div className="flex items-center gap-2.5">
          <div className="flex size-7.5 shrink-0 items-center justify-center rounded-full border border-line bg-elevated text-xs font-bold text-gold-bright">
            {player.name.substring(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-1.5 font-bold text-fg">
              <PlayerAvatar player={player} />
              <span>{player.name}</span>
              {player.nickname && (
                <span className="text-caption font-semibold text-gold-bright italic">
                  &quot;{player.nickname}&quot;
                </span>
              )}
              {player.displayName && player.displayName !== player.name && (
                <span className="text-xs text-fg-muted">
                  ({player.displayName})
                </span>
              )}
            </div>
            <div className="mt-0.5 flex items-center gap-2.5 text-2xs text-fg-muted">
              {player.twitchUsername && (
                <a
                  href={`https://twitch.tv/${player.twitchUsername}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                  className="font-semibold text-purple-400 no-underline"
                  title={`Twitch: ${player.twitchUsername}`}
                >
                  twitch.tv/{player.twitchUsername}
                </a>
              )}
              <span>ID: {player.id}</span>
            </div>
          </div>
        </div>
      </td>

      {/* Country (Uses CountryFlag directly to avoid duplicate PlayerAvatar) */}
      <td className={tdClass}>
        {player.country ? (
          <span className="inline-flex items-center gap-1.5 rounded-sm border border-line-subtle bg-highlight px-2 py-0.5 text-xs font-bold text-fg">
            <CountryFlag country={player.country} />
            <span>{player.country}</span>
          </span>
        ) : (
          <span className="text-fg-muted">—</span>
        )}
      </td>

      {/* Playstyle */}
      <td className={tdClass}>
        <PlaystyleChip style={player.playstyle} />
      </td>

      {/* Personal Best */}
      <td className={tdClass}>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'font-mono text-sm font-bold',
              isMaxout ? 'text-gold-bright' : 'text-fg'
            )}
          >
            {player.personalBest ? player.personalBest.toLocaleString() : '—'}
          </span>
          {isMaxout && (
            <span className="inline-flex items-center gap-1 rounded-sm border border-gold bg-gold/20 px-1.5 py-0.5 text-3xs font-extrabold text-gold-bright">
              <Trophy size={10} /> MAXOUT
            </span>
          )}
        </div>
      </td>

      {/* Status */}
      <td className={tdClass}>
        <span className="inline-block rounded-sm bg-green-500/10 px-2 py-1 text-2xs font-semibold text-green-400">
          Active
        </span>
      </td>

      {/* Notes */}
      <td className="max-w-60 px-4 py-3">
        <div className="truncate text-caption text-fg-secondary" title={player.notes}>
          {player.notes || <span className="text-fg-muted">—</span>}
        </div>
      </td>

      {/* Actions */}
      <td className="px-4 py-3 text-right">
        <div className="inline-flex items-center gap-1.5">
          <Button
            variant="secondary"
            onClick={() => onEdit(player)}
            className="px-2.5 py-1.5 text-xs"
            title="Edit competitor profile"
          >
            <Edit2 size={13} />
          </Button>
          <Button
            variant="secondary"
            onClick={() => onDelete(player)}
            className="px-2.5 py-1.5 text-xs text-red"
            title="Delete competitor from catalog"
          >
            <Trash2 size={13} />
          </Button>
        </div>
      </td>
    </tr>
  );
});

/* -------------------------------------------------------------------------- */
/*                            4. Table Container (Memoized)                   */
/* -------------------------------------------------------------------------- */

interface PlayerDirectoryTableProps {
  filteredPlayers: PlayerProfile[];
  totalPlayersCount: number;
  onEditPlayer: (player: PlayerProfile) => void;
  onDeletePlayer: (player: PlayerProfile) => void;
  onOpenGenerateModal: () => void;
  onOpenAddModal: () => void;
}

export const PlayerDirectoryTable: React.FC<PlayerDirectoryTableProps> = React.memo(({
  filteredPlayers,
  totalPlayersCount,
  onEditPlayer,
  onDeletePlayer,
  onOpenGenerateModal,
  onOpenAddModal,
}) => {
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-surface">
      {filteredPlayers.length === 0 ? (
        <div className="flex flex-col items-center gap-4 px-6 py-16 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-gold-soft text-gold-bright">
            <Users size={28} />
          </div>
          <div>
            <h3 className="m-0 mb-1.5 text-lg font-bold text-fg">
              {totalPlayersCount === 0 ? 'Global Player Directory is Empty' : 'No Competitors Match Your Filter'}
            </h3>
            <p className="m-0 max-w-105 text-sm text-fg-muted">
              {totalPlayersCount === 0
                ? SIMULATION_ENABLED
                  ? 'Add competitors manually or click "Generate Fake Players" to simulate authentic competitors for tournaments.'
                  : 'Add competitors manually to build your player directory.'
                : 'Try adjusting your search query or playstyle filter.'}
            </p>
          </div>
          {totalPlayersCount === 0 && (
            <div className="mt-2 flex gap-3">
              {SIMULATION_ENABLED && (
                <Button variant="secondary" onClick={onOpenGenerateModal}>
                  <Sparkles size={16} color="var(--color-gold-bright)" />
                  Generate Fake Players
                </Button>
              )}
              <Button variant="primary" onClick={onOpenAddModal}>
                <Plus size={16} />
                Add Competitor
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-line bg-canvas text-fg-muted">
                <th className="w-12.5 px-4 py-3 text-center">#</th>
                <th className={thClass}>Competitor</th>
                <th className={thClass}>Country</th>
                <th className={thClass}>Playstyle</th>
                <th className={thClass}>Personal Best</th>
                <th className={thClass}>Status</th>
                <th className={thClass}>Notes</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPlayers.map((player, idx) => (
                <PlayerDirectoryRow
                  key={player.id}
                  player={player}
                  index={idx}
                  onEdit={onEditPlayer}
                  onDelete={onDeletePlayer}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
});
