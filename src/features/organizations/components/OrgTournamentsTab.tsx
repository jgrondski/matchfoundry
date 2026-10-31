import React from 'react';
import { Search, Plus, Trophy } from 'lucide-react';
import { Button } from '../../../components/ui';
import { Tournament } from '../../../features/tournament/types';
import { TournamentCard } from '../../tournament/components/TournamentCard';
import { DEFAULT_TIER_THEME } from '../../../theme/palette';

interface OrgTournamentsTabProps {
  orgName: string;
  tournaments: Tournament[];
  tourneySearch: string;
  onSearchChange: (val: string) => void;
  onCreateTourneyOpen: () => void;
  onDeleteTournament: (t: Tournament) => void;
  primaryColor?: string;
}

export const OrgTournamentsTab: React.FC<OrgTournamentsTabProps> = ({
  orgName,
  tournaments,
  tourneySearch,
  onSearchChange,
  onCreateTourneyOpen,
  onDeleteTournament,
  primaryColor = DEFAULT_TIER_THEME.primaryColor,
}) => {
  const filteredTournaments = tournaments.filter(t =>
    t.name.toLowerCase().includes(tourneySearch.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="relative w-full max-w-95">
          <Search size={16} color="var(--color-fg-muted)" className="absolute top-1/2 left-3.5 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Filter hosted tournaments..."
            value={tourneySearch}
            onChange={e => onSearchChange(e.target.value)}
            className="w-full rounded-md border border-line bg-surface py-2 pr-3.5 pl-9.5 text-sm text-white"
          />
        </div>

        <Button
          type="button"
          variant="primary"
          onClick={onCreateTourneyOpen}
          className="px-5 py-2.5 text-sm"
          style={{ boxShadow: `0 2px 10px ${primaryColor}44` }}
        >
          <Plus size={16} />
          <span>Create Tournament</span>
        </Button>
      </div>

      {filteredTournaments.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-line bg-surface px-8 py-14 text-center">
          <Trophy size={32} color="var(--color-gold-bright)" />
          <h3 className="m-0 text-lg font-bold text-white">
            {tourneySearch ? 'No matching tournaments' : 'No tournaments hosted yet'}
          </h3>
          <p className="max-w-100 text-sm text-fg-secondary">
            {tourneySearch
              ? 'Try adjusting your search filter.'
              : `Create your first tournament under ${orgName} to start organizing brackets.`}
          </p>
          {!tourneySearch && (
            <Button
              type="button"
              variant="primary"
              onClick={onCreateTourneyOpen}
              className="mt-2 px-5 py-2"
            >
              <Plus size={16} />
              <span>Create Tournament</span>
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(480px,1fr))] gap-6">
          {filteredTournaments.map(t => (
            <TournamentCard
              key={t.id}
              tournament={t}
              showOrgBadge={false}
              onDeleteClick={onDeleteTournament}
            />
          ))}
        </div>
      )}
    </div>
  );
};
