import React from 'react';
import { Link } from 'react-router-dom';
import { Users } from 'lucide-react';
import { Tournament } from '../../types';
import { buttonClasses } from '../../../../components/ui';

interface TournamentRosterSectionProps {
  tournament: Tournament;
  totalCapacity: number;
}

export const TournamentRosterSection: React.FC<TournamentRosterSectionProps> = ({
  tournament,
  totalCapacity,
}) => {
  return (
    <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface py-3.5 px-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Users size={18} color="var(--color-gold-bright)" />
          <h2 className="m-0 text-base font-bold text-fg">
            Player Roster
          </h2>
        </div>
        <span className="rounded-full bg-gold/15 py-1 px-2.5 text-xs font-bold text-gold-bright">
          {(tournament.playersPool || []).length} / {totalCapacity} Capacity Registered
        </span>
        <span className="text-caption text-fg-muted">
          Manage registrations &amp; pool imports in Players.
        </span>
      </div>

      <Link
        to={`/${tournament.slug}/manage/players`}
        className={buttonClasses({
          variant: 'primary',
          className:
            'gap-1.5 py-1.5 px-3.5 text-caption no-underline hover:brightness-110 hover:shadow-gold-hover hover:-translate-y-px',
        })}
      >
        <Users size={14} /> Go to Players
      </Link>
    </section>
  );
};
