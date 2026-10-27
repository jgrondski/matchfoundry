import React from 'react';
import { Link } from 'react-router-dom';
import { Gamepad2, ChevronRight } from 'lucide-react';
import type { Tournament } from '../../tournament/types';
import { useOrganization } from '../../organizations/store';
import { isOnlineQualsOpen } from '../onlineQualsStatus';
import { qualFormatLabel } from '../../qualifiers/qualFormatLabel';
import { PointsInfoTip } from '../../qualifiers/components/PointsInfoTip';

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
      style={{
        width: '100%',
        maxWidth: '760px',
        margin: '0 auto',
        background: 'linear-gradient(180deg, rgba(245, 158, 11, 0.08) 0%, var(--color-bg-surface) 100%)',
        border: '1px solid rgba(245, 158, 11, 0.45)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-gold)',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.6rem',
          padding: '1rem 1.25rem',
          borderBottom: '1px solid rgba(245, 158, 11, 0.25)',
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            background: 'var(--color-green)',
            boxShadow: '0 0 8px var(--color-green)',
            flexShrink: 0,
          }}
        />
        <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 900, color: '#ffffff', letterSpacing: '-0.01em' }}>
          Quals Open!
        </h2>
      </div>

      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {openTournaments.map((tournament, idx) => {
          const org = tournament.organizationId ? getOrganizationById(tournament.organizationId) : undefined;
          return (
            <li
              key={tournament.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '0.75rem',
                padding: '0.9rem 1.25rem',
                borderTop: idx === 0 ? 'none' : '1px solid var(--color-border)',
              }}
            >
              <div style={{ minWidth: 0, flex: '1 1 220px' }}>
                <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-text-primary)', overflowWrap: 'anywhere' }}>
                  {tournament.name}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '0.15rem' }}>
                  {[org?.shortName || org?.name, qualFormatLabel(tournament.qualFormat, tournament.qualAverageCount)]
                    .filter(Boolean)
                    .join(' · ')}
                  {tournament.qualFormat === 'POINTS' && <PointsInfoTip pointsConfig={tournament.pointsConfig} size={13} />}
                </div>
              </div>
              <Link
                to={`/${tournament.slug}/qualify`}
                className="btn btn-primary"
                style={{ padding: '0.55rem 1.1rem', fontSize: '0.9rem', textDecoration: 'none', flexShrink: 0 }}
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
