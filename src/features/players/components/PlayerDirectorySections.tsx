import React, { useState, useRef, useMemo } from 'react';
import { PlayerProfile, Organization } from '../../tournament/types';
import { PlayerAvatar } from './PlayerAvatar';
import { PlaystyleChip } from './PlaystyleChip';
import { CountryFlag } from '../flagUtils';
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
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
      <div
        style={{
          padding: '1.1rem 1.25rem',
          background: 'var(--color-bg-surface)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--color-border)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.35rem',
        }}
      >
        <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600, color: 'var(--color-text-muted)' }}>
          Total Global Competitors
        </div>
        <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-text-primary)' }}>
          {stats.total}
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
          Ready for tournament roster import
        </div>
      </div>

      <div
        style={{
          padding: '1.1rem 1.25rem',
          background: 'var(--color-bg-surface)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--color-border)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.35rem',
        }}
      >
        <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600, color: 'var(--color-text-muted)' }}>
          Playstyle Breakdown
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.2rem' }}>
          <span style={{ fontSize: '0.8rem', padding: '0.2rem 0.5rem', borderRadius: 'var(--radius-sm)', background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc', fontWeight: 700 }}>
            Rolling: {stats.rollingCount}
          </span>
          <span style={{ fontSize: '0.8rem', padding: '0.2rem 0.5rem', borderRadius: 'var(--radius-sm)', background: 'rgba(245, 158, 11, 0.15)', color: 'var(--color-gold-bright)', fontWeight: 700 }}>
            DAS: {stats.dasCount}
          </span>
          <span style={{ fontSize: '0.8rem', padding: '0.2rem 0.5rem', borderRadius: 'var(--radius-sm)', background: 'rgba(20, 184, 166, 0.15)', color: '#2dd4bf', fontWeight: 700 }}>
            Hypertap: {stats.hypertapCount}
          </span>
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.15rem' }}>
          Diverse competitive mechanical styles
        </div>
      </div>

      <div
        style={{
          padding: '1.1rem 1.25rem',
          background: 'var(--color-bg-surface)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--color-border)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.35rem',
        }}
      >
        <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600, color: 'var(--color-text-muted)' }}>
          Highest Personal Best
        </div>
        <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-gold-bright)', fontFamily: 'monospace' }}>
          {stats.maxPb > 0 ? stats.maxPb.toLocaleString() : '—'}
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
          {stats.maxPbPlayer ? `Held by ${stats.maxPbPlayer}` : 'No personal bests recorded'}
        </div>
      </div>

      <div
        style={{
          padding: '1.1rem 1.25rem',
          background: 'var(--color-bg-surface)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--color-border)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.35rem',
        }}
      >
        <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600, color: 'var(--color-text-muted)' }}>
          Average Personal Best
        </div>
        <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-text-primary)', fontFamily: 'monospace' }}>
          {stats.avgPb > 0 ? stats.avgPb.toLocaleString() : '—'}
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
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
    <div
      style={{
        background: 'var(--color-bg-surface)',
        padding: '1rem 1.25rem',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--color-border)',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '1rem',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      {/* Search Input */}
      <div style={{ position: 'relative', flex: '1 1 280px', maxWidth: '400px' }}>
        <input
          type="text"
          value={searchInput}
          onChange={handleInputChange}
          placeholder="Search competitor name, country, notes..."
          style={{
            width: '100%',
            padding: '0.55rem 0.85rem 0.55rem 2.25rem',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--color-border)',
            background: 'var(--color-bg-base)',
            color: 'var(--color-text-primary)',
            fontSize: '0.85rem',
          }}
        />
        <Search
          size={16}
          color="var(--color-text-muted)"
          style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }}
        />
        {searchInput && (
          <button
            type="button"
            onClick={handleClear}
            style={{
              position: 'absolute',
              right: '8px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'transparent',
              border: 'none',
              color: 'var(--color-text-muted)',
              cursor: 'pointer',
              padding: '2px',
            }}
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Playstyle Filter Pills */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600, marginRight: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
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
            style={{
              padding: '0.35rem 0.75rem',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.8rem',
              fontWeight: playstyleFilter === f.key ? 700 : 500,
              background: playstyleFilter === f.key ? 'var(--color-gold-bg)' : 'transparent',
              border: playstyleFilter === f.key ? '1px solid var(--color-gold)' : '1px solid var(--color-border-subtle)',
              color: playstyleFilter === f.key ? 'var(--color-gold-bright)' : 'var(--color-text-secondary)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Filters Group: Org & Sort */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        {/* Organization Circuit Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Building2 size={14} color="var(--color-text-muted)" />
          <select
            value={orgFilter}
            onChange={e => onOrgFilterChange(e.target.value)}
            style={{
              padding: '0.45rem 0.75rem',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-border)',
              background: 'var(--color-bg-base)',
              color: 'var(--color-text-primary)',
              fontSize: '0.8rem',
            }}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <ArrowUpDown size={14} color="var(--color-text-muted)" />
          <select
            value={sortBy}
            onChange={e => onSortChange(e.target.value as 'NAME_ASC' | 'PB_DESC' | 'PB_ASC' | 'COUNTRY')}
            style={{
              padding: '0.45rem 0.75rem',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-border)',
              background: 'var(--color-bg-base)',
              color: 'var(--color-text-primary)',
              fontSize: '0.8rem',
            }}
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
    <tr
      style={{
        borderBottom: '1px solid var(--color-border-subtle)',
        background: 'transparent',
        transition: 'background 0.15s ease',
      }}
    >
      {/* Index */}
      <td style={{ padding: '0.75rem 1rem', textAlign: 'center', color: 'var(--color-text-muted)', fontWeight: 600 }}>
        {index + 1}
      </td>

      {/* Name */}
      <td style={{ padding: '0.75rem 1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <div
            style={{
              width: '30px',
              height: '30px',
              borderRadius: '50%',
              background: 'var(--color-bg-surface-elevated)',
              border: '1px solid var(--color-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: '0.75rem',
              color: 'var(--color-gold-bright)',
              flexShrink: 0,
            }}
          >
            {player.name.substring(0, 2).toUpperCase()}
          </div>
          <div>
            <div style={{ fontWeight: 700, color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
              <PlayerAvatar player={player} />
              <span>{player.name}</span>
              {player.nickname && (
                <span style={{ fontSize: '0.8rem', color: 'var(--color-gold-bright)', fontStyle: 'italic', fontWeight: 600 }}>
                  &quot;{player.nickname}&quot;
                </span>
              )}
              {player.displayName && player.displayName !== player.name && (
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                  ({player.displayName})
                </span>
              )}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '0.6rem', marginTop: '0.15rem' }}>
              {player.twitchUsername && (
                <a
                  href={`https://twitch.tv/${player.twitchUsername}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                  style={{ color: '#c084fc', textDecoration: 'none', fontWeight: 600 }}
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
      <td style={{ padding: '0.75rem 1rem' }}>
        {player.country ? (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.15rem 0.45rem',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--color-bg-surface-highlight)',
              fontWeight: 700,
              fontSize: '0.75rem',
              color: 'var(--color-text-primary)',
              border: '1px solid var(--color-border-subtle)',
            }}
          >
            <CountryFlag country={player.country} />
            <span>{player.country}</span>
          </span>
        ) : (
          <span style={{ color: 'var(--color-text-muted)' }}>—</span>
        )}
      </td>

      {/* Playstyle */}
      <td style={{ padding: '0.75rem 1rem' }}>
        <PlaystyleChip style={player.playstyle} />
      </td>

      {/* Personal Best */}
      <td style={{ padding: '0.75rem 1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
          <span
            style={{
              fontWeight: 700,
              fontFamily: 'monospace',
              fontSize: '0.9rem',
              color: isMaxout ? 'var(--color-gold-bright)' : 'var(--color-text-primary)',
            }}
          >
            {player.personalBest ? player.personalBest.toLocaleString() : '—'}
          </span>
          {isMaxout && (
            <span
              style={{
                fontSize: '0.65rem',
                padding: '0.1rem 0.35rem',
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(245, 158, 11, 0.2)',
                color: 'var(--color-gold-bright)',
                fontWeight: 800,
                border: '1px solid var(--color-gold)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.2rem',
              }}
            >
              <Trophy size={10} /> MAXOUT
            </span>
          )}
        </div>
      </td>

      {/* Status */}
      <td style={{ padding: '0.75rem 1rem' }}>
        <span
          style={{
            display: 'inline-block',
            padding: '0.2rem 0.5rem',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.7rem',
            fontWeight: 600,
            background: 'rgba(34, 197, 94, 0.1)',
            color: '#4ade80',
          }}
        >
          Active
        </span>
      </td>

      {/* Notes */}
      <td style={{ padding: '0.75rem 1rem', maxWidth: '240px' }}>
        <div
          style={{
            color: 'var(--color-text-secondary)',
            fontSize: '0.8rem',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={player.notes}
        >
          {player.notes || <span style={{ color: 'var(--color-text-muted)' }}>—</span>}
        </div>
      </td>

      {/* Actions */}
      <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
          <button
            type="button"
            onClick={() => onEdit(player)}
            className="btn btn-secondary"
            style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem' }}
            title="Edit competitor profile"
          >
            <Edit2 size={13} />
          </button>
          <button
            type="button"
            onClick={() => onDelete(player)}
            className="btn btn-secondary"
            style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem', color: 'var(--color-red)' }}
            title="Delete competitor from catalog"
          >
            <Trash2 size={13} />
          </button>
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
    <div
      style={{
        background: 'var(--color-bg-surface)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--color-border)',
        overflow: 'hidden',
      }}
    >
      {filteredPlayers.length === 0 ? (
        <div
          style={{
            padding: '4rem 1.5rem',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1rem',
          }}
        >
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: 'var(--color-gold-bg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-gold-bright)',
            }}
          >
            <Users size={28} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 0.35rem 0' }}>
              {totalPlayersCount === 0 ? 'Global Player Directory is Empty' : 'No Competitors Match Your Filter'}
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', maxWidth: '420px', margin: 0 }}>
              {totalPlayersCount === 0
                ? 'Add competitors manually or click "Generate Fake Players" to simulate authentic competitors for tournaments.'
                : 'Try adjusting your search query or playstyle filter.'}
            </p>
          </div>
          {totalPlayersCount === 0 && (
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button
                type="button"
                onClick={onOpenGenerateModal}
                className="btn btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                <Sparkles size={16} color="var(--color-gold-bright)" />
                Generate Fake Players
              </button>
              <button
                type="button"
                onClick={onOpenAddModal}
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                <Plus size={16} />
                Add Competitor
              </button>
            </div>
          )}
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: 'var(--color-bg-base)', borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}>
                <th style={{ padding: '0.75rem 1rem', width: '50px', textAlign: 'center' }}>#</th>
                <th style={{ padding: '0.75rem 1rem' }}>Competitor</th>
                <th style={{ padding: '0.75rem 1rem' }}>Country</th>
                <th style={{ padding: '0.75rem 1rem' }}>Playstyle</th>
                <th style={{ padding: '0.75rem 1rem' }}>Personal Best</th>
                <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                <th style={{ padding: '0.75rem 1rem' }}>Notes</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Actions</th>
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
