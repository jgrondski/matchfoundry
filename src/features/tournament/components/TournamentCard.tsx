import React from 'react';
import { Link } from 'react-router-dom';
import { Tournament } from '../types';
import { useOrganization } from '../../organizations/store';
import { colorWithAlpha } from '../../bracket/colorUtils';
import {
  Calendar,
  MapPin,
  Users,
  Building2,
  AlertTriangle,
  ShieldCheck,
  Trash2,
  GitBranch,
  Sheet,
  BarChart3,
  Trophy,
  Settings,
  ExternalLink,
} from 'lucide-react';
import { usePinAuth } from '../../auth/AuthContext';

interface TournamentCardProps {
  tournament: Tournament;
  onDeleteClick?: (tournament: Tournament) => void;
  showOrgBadge?: boolean;
  variant?: 'public' | 'admin';
}

export const TournamentCard: React.FC<TournamentCardProps> = ({
  tournament,
  onDeleteClick,
  showOrgBadge = true,
  variant = 'public',
}) => {
  const { getOrganizationById } = useOrganization();
  const { isSystemAdmin, canManage } = usePinAuth();
  const hasManageAccess = isSystemAdmin || canManage(tournament.slug);
  const org = tournament.organizationId ? getOrganizationById(tournament.organizationId) : undefined;

  const hasTiers = tournament.tiers && tournament.tiers.length > 0;
  const defaultTier = hasTiers ? tournament.tiers[0] : undefined;
  const totalPlayers = (tournament.tiers || []).reduce((acc, t) => acc + t.playerCount, 0);

  const hasRecordedScoresOrQuals = (t: Tournament): boolean => {
    const hasQuals = (t.qualifierSubmissions && t.qualifierSubmissions.length > 0) ||
      (t.qualifiers && t.qualifiers.length > 0);
    const hasMatchScores = Object.values(t.matchScores || {}).some(
      m => m.isComplete || m.player1Wins > 0 || m.player2Wins > 0 ||
        m.games?.some(g => g.player1Points !== null || g.player2Points !== null)
    );
    return Boolean(hasQuals || hasMatchScores);
  };

  const isDeleteDisabled = hasRecordedScoresOrQuals(tournament);

  return (
    <div
      data-testid={`tournament-card-${tournament.slug}`}
      style={{
        background: 'var(--color-bg-surface, #131722)',
        borderRadius: 'var(--radius-lg, 12px)',
        border: '1px solid var(--color-border, rgba(255, 255, 255, 0.12))',
        padding: '1.75rem',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        gap: '1.5rem',
        boxShadow: 'var(--shadow-md, 0 4px 12px rgba(0,0,0,0.4))',
        transition: 'transform 0.15s ease, border-color 0.15s ease',
      }}
    >
      <div>
        {/* Top Badges & Delete */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            {showOrgBadge && org && (
              <Link
                to={`/org/${org.slug}`}
                onClick={e => e.stopPropagation()}
                className="badge"
                style={{
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  background: 'rgba(255, 255, 255, 0.07)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  color: org.branding?.themeColors?.primaryColor || 'var(--color-gold-bright, #ffc905)',
                  cursor: 'pointer',
                }}
                title={`Hosted by ${org.name}`}
              >
                <Building2 size={12} />
                {org.shortName || org.name}
              </Link>
            )}

            {!tournament.isLocked ? (
              <span className="badge badge-gold">
                <AlertTriangle size={12} /> Qualifiers Mode
              </span>
            ) : (
              <span className="badge badge-green">
                <ShieldCheck size={12} /> Match Play Mode
              </span>
            )}

            <span className="badge badge-muted">
              {tournament.qualFormat === 'HIGH_SCORE'
                ? '# of Maxes'
                : tournament.qualFormat === 'AVERAGE_OF_X'
                ? (tournament.qualAverageCount ? `Avg of ${tournament.qualAverageCount}` : 'Average of X')
                : tournament.qualFormat === 'POINTS'
                ? 'Points'
                : 'Average'}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            {onDeleteClick && (
              <button
                type="button"
                onClick={() => onDeleteClick(tournament)}
                disabled={isDeleteDisabled}
                className="btn btn-secondary"
                style={{
                  padding: '0.25rem 0.5rem',
                  fontSize: '0.75rem',
                  color: isDeleteDisabled ? 'var(--color-text-muted, #64748b)' : 'var(--color-red, #ef4444)',
                  borderColor: isDeleteDisabled ? 'var(--color-border, rgba(255,255,255,0.1))' : 'rgba(239, 68, 68, 0.4)',
                  opacity: isDeleteDisabled ? 0.35 : 1,
                  cursor: isDeleteDisabled ? 'not-allowed' : 'pointer',
                }}
                title={
                  isDeleteDisabled
                    ? 'Cannot delete tournament with active match or qualifier scores. Clear data in Settings first.'
                    : `Delete "${tournament.name}"`
                }
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Tournament Name */}
        <h2 style={{ fontSize: '1.6rem', fontWeight: 700, color: '#ffffff', marginBottom: '0.5rem' }}>
          {tournament.name}
        </h2>

        {/* Metadata Details */}
        <div style={{ display: 'flex', gap: '1.25rem', color: 'var(--color-text-secondary, #94a3b8)', fontSize: '0.85rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Calendar size={15} color="var(--color-gold-bright, #ffc905)" />
            {tournament.date}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <MapPin size={15} color="var(--color-gold-bright, #ffc905)" />
            {tournament.location}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Users size={15} color="var(--color-gold-bright, #ffc905)" />
            {hasTiers
              ? `${totalPlayers} Players`
              : `${(tournament.playersPool || []).length} Competitors Registered`}
          </span>
        </div>

        {/* Tier Pills List */}
        {hasTiers ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted, #64748b)', letterSpacing: '0.05em' }}>
              Brackets ({tournament.tiers.length})
            </span>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {tournament.tiers.map(tier => {
                const tierColor = tier.primaryColor || '#ffc905';
                const tierLink = variant === 'admin'
                  ? `/${tournament.slug}/manage/bracket/${tier.slug}`
                  : `/${tournament.slug}/${tier.slug}`;
                return (
                  <Link
                    key={tier.id}
                    to={tierLink}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                      padding: '0.35rem 0.65rem',
                      borderRadius: 'var(--radius-sm, 6px)',
                      background: colorWithAlpha(tierColor, 0.12),
                      border: `1px solid ${colorWithAlpha(tierColor, 0.35)}`,
                      color: tierColor,
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      textDecoration: 'none',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: tierColor,
                        display: 'inline-block',
                      }}
                    />
                    <span>{tier.name}</span>
                    <span style={{ fontSize: '0.7rem', opacity: 0.85, fontWeight: 400 }}>
                      ({tier.playerCount}p • Bo{tier.bestOf})
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        ) : (
          <div style={{ padding: '0.85rem', background: 'var(--color-bg-base, #0c0d12)', borderRadius: 'var(--radius-md, 8px)', border: '1px dashed var(--color-border, rgba(255,255,255,0.1))', color: 'var(--color-text-muted, #64748b)', fontSize: '0.85rem' }}>
            No bracket tiers configured.{variant === 'admin' && ' Visit Settings to set up tournament tiers.'}
          </div>
        )}
      </div>

      {/* Action Buttons Row */}
      {variant === 'public' ? (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', borderTop: '1px solid var(--color-border-subtle, rgba(255,255,255,0.06))', paddingTop: '1rem', alignItems: 'center' }}>
          <Link
            to={hasTiers && defaultTier ? `/${tournament.slug}/${defaultTier.slug}` : `/${tournament.slug}/brackets`}
            className="btn btn-primary"
            style={{ padding: '0.55rem 0.85rem', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <GitBranch size={14} /> Live Brackets
          </Link>

          <Link
            to={`/${tournament.slug}/leaderboard`}
            className="btn btn-secondary"
            style={{ padding: '0.55rem 0.85rem', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <BarChart3 size={14} /> {tournament.seedingMethod === 'MANUAL' ? 'Seeding' : 'Qualifiers'}
          </Link>

          <Link
            to={`/${tournament.slug}/standings`}
            className="btn btn-secondary"
            style={{ padding: '0.55rem 0.85rem', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Trophy size={14} color="var(--color-gold-bright, #ffc905)" /> Standings
          </Link>

          {hasManageAccess && (
            <Link
              to={`/${tournament.slug}/manage/qualifiers`}
              className="btn btn-secondary"
              style={{
                padding: '0.55rem 0.85rem',
                fontSize: '0.8rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                marginLeft: 'auto',
                borderColor: 'rgba(255, 201, 5, 0.4)',
                color: 'var(--color-gold-bright, #ffc905)',
                background: 'rgba(255, 201, 5, 0.08)',
              }}
              title="Open Tournament Director Management Portal"
            >
              <Settings size={14} /> Manage
            </Link>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', borderTop: '1px solid var(--color-border-subtle, rgba(255,255,255,0.06))', paddingTop: '1rem', alignItems: 'center' }}>
          {hasTiers && defaultTier && (
            <Link
              to={`/${tournament.slug}/manage/bracket/${defaultTier.slug}`}
              className="btn btn-primary"
              style={{ padding: '0.55rem 0.75rem', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <GitBranch size={14} /> Brackets
            </Link>
          )}

          <Link
            to={hasTiers && defaultTier ? `/${tournament.slug}/manage/sheet?tier=${defaultTier.slug}` : `/${tournament.slug}/manage/sheet`}
            className="btn btn-secondary"
            style={{ padding: '0.55rem 0.75rem', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Sheet size={14} /> Sheet
          </Link>

          <Link
            to={`/${tournament.slug}/manage/qualifiers`}
            className={!hasTiers ? 'btn btn-primary' : 'btn btn-secondary'}
            style={{ padding: '0.55rem 0.75rem', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <BarChart3 size={14} /> Qualifiers
          </Link>

          <Link
            to={`/${tournament.slug}/manage/standings`}
            className="btn btn-secondary"
            style={{ padding: '0.55rem 0.75rem', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Trophy size={14} color="var(--color-gold-bright, #ffc905)" /> Standings
          </Link>

          <Link
            to={`/${tournament.slug}/manage/settings`}
            className="btn btn-secondary"
            style={{ padding: '0.55rem 0.75rem', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Settings size={14} /> Settings
          </Link>

          <Link
            to={hasTiers && defaultTier ? `/${tournament.slug}/${defaultTier.slug}` : `/${tournament.slug}/brackets`}
            className="btn btn-secondary"
            style={{
              padding: '0.55rem 0.75rem',
              fontSize: '0.8rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              marginLeft: 'auto',
              color: 'var(--color-text-muted, #94a3b8)',
            }}
            title="Open public spectator view"
          >
            <ExternalLink size={13} /> Public View
          </Link>
        </div>
      )}
    </div>
  );
};
