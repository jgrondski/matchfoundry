import React from 'react';
import { Link } from 'react-router-dom';
import { Gamepad2, ChevronRight } from 'lucide-react';
import type { Tournament } from '../../tournament/types';
import { useOrganization } from '../../organizations/store';
import { isOnlineQualsOpen } from '../onlineQualsStatus';
import { qualFormatLabel } from '../../qualifiers/qualFormatLabel';
import { PointsInfoTip } from '../../qualifiers/components/PointsInfoTip';
import { buttonClasses, cn } from '../../../components/ui';

interface OpenQualsCardProps {
  tournaments: Tournament[];
}

/**
 * Front-page callout listing every tournament with online qualifying open.
 * Identical for every viewer (public, judges, admins); renders nothing when no quals are open.
 */
export const OpenQualsCard: React.FC<OpenQualsCardProps> = ({ tournaments }) => {
  const { getOrganizationById } = useOrganization();
  const openTournaments = tournaments.filter(isOnlineQualsOpen);

  if (openTournaments.length === 0) return null;

  return (
    <section
      data-testid="open-quals-card"
      className="mx-auto w-full max-w-190 rounded-lg border border-gold/45 bg-linear-180 from-gold/8 from-0% to-surface to-100% shadow-gold"
    >
      <div className="flex items-center justify-center gap-2.5 border-b border-gold/25 px-5 py-4">
        <span
          aria-hidden="true"
          className="size-2.5 shrink-0 rounded-full bg-green shadow-[0_0_8px_var(--color-green)]"
        />
        <h2 className="m-0 text-2xl font-black tracking-tight text-white">
          Quals Open!
        </h2>
      </div>

      <ul className="m-0 list-none p-0">
        {openTournaments.map((tournament, idx) => {
          const org = tournament.organizationId ? getOrganizationById(tournament.organizationId) : undefined;
          return (
            <li
              key={tournament.id}
              className={cn(
                'flex flex-wrap items-center justify-between gap-3 px-5 py-3.5',
                idx !== 0 && 'border-t border-line'
              )}
            >
              <div className="min-w-0 flex-[1_1_220px]">
                <div className="text-base font-bold text-fg wrap-anywhere">
                  {tournament.name}
                </div>
                <div className="mt-0.5 flex items-center gap-1.5 text-caption text-fg-muted">
                  {[org?.shortName || org?.name, qualFormatLabel(tournament.qualFormat, tournament.qualAverageCount)]
                    .filter(Boolean)
                    .join(' · ')}
                  {tournament.qualFormat === 'POINTS' && <PointsInfoTip pointsConfig={tournament.pointsConfig} size={13} />}
                </div>
              </div>
              <Link
                to={`/${tournament.slug}/qualify`}
                className={buttonClasses({
                  variant: 'primary',
                  className: 'shrink-0 px-4.5 py-2 text-sm hover:-translate-y-px hover:shadow-gold-hover hover:brightness-110',
                })}
              >
                <Gamepad2 size={16} />
                Qualify
                <ChevronRight size={16} />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
};
