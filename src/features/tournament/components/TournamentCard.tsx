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
import { Badge, Button, buttonClasses, cn } from '../../../components/ui';

const PRIMARY_LINK_HOVER = 'hover:brightness-110 hover:shadow-gold-hover hover:-translate-y-px';
const SECONDARY_LINK_HOVER = 'hover:bg-highlight hover:border-fg-secondary';
const publicLinkClass = 'gap-1.5 py-2 px-3.5 text-caption';
const adminLinkClass = 'gap-1.5 py-2 px-3 text-caption';

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
      className="flex flex-col justify-between gap-6 rounded-lg border border-line bg-surface p-7 shadow-md transition-[transform,border-color] duration-150"
    >
      <div>
        {/* Top Badges & Delete */}
        <div className="mb-3 flex items-center justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {showOrgBadge && org && (
              <Link
                to={`/org/${org.slug}`}
                onClick={e => e.stopPropagation()}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-white/12 bg-white/7 py-1 px-2.5 text-xs font-semibold uppercase tracking-wide no-underline"
                style={{ color: org.branding?.themeColors?.primaryColor || 'var(--color-gold-bright, #ffc905)' }}
                title={`Hosted by ${org.name}`}
              >
                <Building2 size={12} />
                {org.shortName || org.name}
              </Link>
            )}

            {!tournament.isLocked ? (
              <Badge variant="gold">
                <AlertTriangle size={12} /> Qualifiers Mode
              </Badge>
            ) : (
              <Badge variant="green">
                <ShieldCheck size={12} /> Match Play Mode
              </Badge>
            )}

            <Badge variant="muted">
              {tournament.qualFormat === 'HIGH_SCORE'
                ? '# of Maxes'
                : tournament.qualFormat === 'AVERAGE_OF_X'
                ? (tournament.qualAverageCount ? `Avg of ${tournament.qualAverageCount}` : 'Average of X')
                : tournament.qualFormat === 'POINTS'
                ? 'Points'
                : 'Average'}
            </Badge>
          </div>

          <div className="flex items-center gap-2.5">
            {onDeleteClick && (
              <Button
                onClick={() => onDeleteClick(tournament)}
                disabled={isDeleteDisabled}
                className={cn(
                  'py-1 px-2 text-xs',
                  isDeleteDisabled ? 'border-line text-fg-muted' : 'border-red/40 text-red enabled:hover:border-red/40'
                )}
                title={
                  isDeleteDisabled
                    ? 'Cannot delete tournament with active match or qualifier scores. Clear data in Settings first.'
                    : `Delete "${tournament.name}"`
                }
              >
                <Trash2 size={13} />
              </Button>
            )}
          </div>
        </div>

        {/* Tournament Name */}
        <h2 className="mb-2 text-2xl font-bold text-white">
          {tournament.name}
        </h2>

        {/* Metadata Details */}
        <div className="mb-5 flex flex-wrap gap-5 text-sm text-fg-secondary">
          <span className="flex items-center gap-1.5">
            <Calendar size={15} color="var(--color-gold-bright, #ffc905)" />
            {tournament.date}
          </span>
          <span className="flex items-center gap-1.5">
            <MapPin size={15} color="var(--color-gold-bright, #ffc905)" />
            {tournament.location}
          </span>
          <span className="flex items-center gap-1.5">
            <Users size={15} color="var(--color-gold-bright, #ffc905)" />
            {hasTiers
              ? `${totalPlayers} Players`
              : `${(tournament.playersPool || []).length} Competitors Registered`}
          </span>
        </div>

        {/* Tier Pills List */}
        {hasTiers ? (
          <div className="flex flex-col gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-fg-muted">
              Brackets ({tournament.tiers.length})
            </span>
            <div className="flex flex-wrap gap-2">
              {tournament.tiers.map(tier => {
                const tierColor = tier.primaryColor || '#ffc905';
                const tierLink = variant === 'admin'
                  ? `/${tournament.slug}/manage/bracket/${tier.slug}`
                  : `/${tournament.slug}/${tier.slug}`;
                return (
                  <Link
                    key={tier.id}
                    to={tierLink}
                    className="inline-flex items-center gap-2 rounded-sm py-1.5 px-2.5 text-caption font-semibold no-underline transition-all duration-150"
                    style={{
                      background: colorWithAlpha(tierColor, 0.12),
                      border: `1px solid ${colorWithAlpha(tierColor, 0.35)}`,
                      color: tierColor,
                    }}
                  >
                    <span className="inline-block size-2 rounded-full" style={{ background: tierColor }} />
                    <span>{tier.name}</span>
                    <span className="text-2xs font-normal opacity-85">
                      ({tier.playerCount}p • Bo{tier.bestOf})
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="rounded-md border border-dashed border-line bg-canvas p-3.5 text-sm text-fg-muted">
            No bracket tiers configured.{variant === 'admin' && ' Visit Settings to set up tournament tiers.'}
          </div>
        )}
      </div>

      {/* Action Buttons Row */}
      {variant === 'public' ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-line-subtle pt-4">
          <Link
            to={hasTiers && defaultTier ? `/${tournament.slug}/${defaultTier.slug}` : `/${tournament.slug}/brackets`}
            className={buttonClasses({ variant: 'primary', className: cn(publicLinkClass, PRIMARY_LINK_HOVER) })}
          >
            <GitBranch size={14} /> Live Brackets
          </Link>

          <Link
            to={`/${tournament.slug}/leaderboard`}
            className={buttonClasses({ variant: 'secondary', className: cn(publicLinkClass, SECONDARY_LINK_HOVER) })}
          >
            <BarChart3 size={14} /> {tournament.seedingMethod === 'MANUAL' ? 'Seeding' : 'Qualifiers'}
          </Link>

          <Link
            to={`/${tournament.slug}/standings`}
            className={buttonClasses({ variant: 'secondary', className: cn(publicLinkClass, SECONDARY_LINK_HOVER) })}
          >
            <Trophy size={14} color="var(--color-gold-bright, #ffc905)" /> Standings
          </Link>

          {hasManageAccess && (
            <Link
              to={`/${tournament.slug}/manage/qualifiers`}
              className={buttonClasses({
                variant: 'secondary',
                className: cn(publicLinkClass, 'ml-auto border-tier-gold/40 bg-tier-gold/8 text-gold-bright'),
              })}
              title="Open Tournament Director Management Portal"
            >
              <Settings size={14} /> Manage
            </Link>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2 border-t border-line-subtle pt-4">
          {hasTiers && defaultTier && (
            <Link
              to={`/${tournament.slug}/manage/bracket/${defaultTier.slug}`}
              className={buttonClasses({ variant: 'primary', className: cn(adminLinkClass, PRIMARY_LINK_HOVER) })}
            >
              <GitBranch size={14} /> Brackets
            </Link>
          )}

          <Link
            to={hasTiers && defaultTier ? `/${tournament.slug}/manage/sheet?tier=${defaultTier.slug}` : `/${tournament.slug}/manage/sheet`}
            className={buttonClasses({ variant: 'secondary', className: cn(adminLinkClass, SECONDARY_LINK_HOVER) })}
          >
            <Sheet size={14} /> Sheet
          </Link>

          <Link
            to={`/${tournament.slug}/manage/qualifiers`}
            className={buttonClasses({
              variant: !hasTiers ? 'primary' : 'secondary',
              className: cn(adminLinkClass, !hasTiers ? PRIMARY_LINK_HOVER : SECONDARY_LINK_HOVER),
            })}
          >
            <BarChart3 size={14} /> Qualifiers
          </Link>

          <Link
            to={`/${tournament.slug}/manage/standings`}
            className={buttonClasses({ variant: 'secondary', className: cn(adminLinkClass, SECONDARY_LINK_HOVER) })}
          >
            <Trophy size={14} color="var(--color-gold-bright, #ffc905)" /> Standings
          </Link>

          <Link
            to={`/${tournament.slug}/manage/settings`}
            className={buttonClasses({ variant: 'secondary', className: cn(adminLinkClass, SECONDARY_LINK_HOVER) })}
          >
            <Settings size={14} /> Settings
          </Link>

          <Link
            to={hasTiers && defaultTier ? `/${tournament.slug}/${defaultTier.slug}` : `/${tournament.slug}/brackets`}
            className={buttonClasses({ variant: 'secondary', className: cn(adminLinkClass, 'ml-auto text-fg-muted', SECONDARY_LINK_HOVER) })}
            title="Open public spectator view"
          >
            <ExternalLink size={13} /> Public View
          </Link>
        </div>
      )}
    </div>
  );
};
