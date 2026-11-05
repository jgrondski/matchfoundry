import React from 'react';
import { Check } from 'lucide-react';
import { Tournament } from '../../tournament/types';
import { LeaderboardRankRow } from '../scoring';
import { PlayerAvatar } from '../../players/components/PlayerAvatar';
import { getEffectivePlayerName } from '../../players/playerNameUtils';
import { Card, cn } from '../../../components/ui';
import {
  CutoffInfo,
  formatCutoffLabel,
  formatPrimaryMetric,
  getKickerDisplay,
  getRowTierAccent,
  renderSeedBadge,
  renderVerifiedStatus,
} from './LeaderboardTable';

interface LeaderboardCardListProps {
  rows: LeaderboardRankRow[];
  format: Tournament['qualFormat'];
  hasBrackets: boolean;
  cutoffRanks: Map<number, CutoffInfo>;
  isObsMode: boolean;
  onSelectRow: (row: LeaderboardRankRow) => void;
}

const statusBoxClass = 'inline-flex size-6 shrink-0 items-center justify-center rounded-sm border text-2xs';

/** Icon-only status box: green check when verified, yellow hourglass when not verified yet. */
function renderStatusBox(row: LeaderboardRankRow, hasBrackets: boolean): React.ReactNode {
  if (row.status === 'verified') {
    return (
      <span
        role="img"
        aria-label="Verified"
        title="Verified"
        className={cn(statusBoxClass, 'border-green-500/30 bg-green-500/15 text-green-400')}
      >
        <Check size={13} strokeWidth={3} />
      </span>
    );
  }
  if (row.status === 'awaiting verification' || row.status === 'in progress') {
    const label = row.status === 'in progress' ? 'In Progress' : 'Unverified';
    return (
      <span
        role="img"
        aria-label={label}
        title={label}
        className={cn(statusBoxClass, 'border-gold/30 bg-gold/15 text-gold-bright')}
      >
        ⏳
      </span>
    );
  }
  // With brackets, the seed badge already says DQ or DNQ.
  if ((row.status === 'dq' || row.status === 'dnq') && !hasBrackets) return renderVerifiedStatus(row);
  return null;
}

/** Headline number: maxes for # of Maxes, otherwise the average or the total points. */
function formatCardMetric(row: LeaderboardRankRow, format: Tournament['qualFormat']): string {
  if (format !== 'HIGH_SCORE') return formatPrimaryMetric(row, format);
  if (row.finalScore <= 0) return '—';
  const maxes = row.maxoutCount ?? 0;
  return `${maxes} ${maxes === 1 ? 'Max' : 'Maxes'}`;
}

/** Phone layout of the qualifiers leaderboard: one card per row, tier cutoffs between cards. */
export const LeaderboardCardList: React.FC<LeaderboardCardListProps> = ({
  rows,
  format,
  hasBrackets,
  cutoffRanks,
  isObsMode,
  onSelectRow,
}) => (
  <ul className="flex flex-col gap-2">
    {rows.map(row => {
      const cutoffInfo = typeof row.rank === 'number' ? cutoffRanks.get(row.rank) : undefined;
      const { isTierQualified, tierColor } = getRowTierAccent(row, hasBrackets);
      const kicker = getKickerDisplay(row);
      const statusBox = renderStatusBox(row, hasBrackets);
      const showKicker = format === 'HIGH_SCORE' && kicker.kind !== 'empty';

      const content = (
        <>
          <div className="flex items-center gap-2">
            <span className="w-8 shrink-0 font-mono text-sm font-bold">{row.rank ?? '—'}</span>
            <span className="min-w-0 flex-1 truncate font-semibold">
              <PlayerAvatar player={row.player} className="mr-1.5 align-middle" />
              {getEffectivePlayerName(row.player)}
            </span>
            <span
              className={cn('shrink-0 font-mono font-bold tabular-nums', !isTierQualified && 'text-gold-bright')}
              style={{ color: isTierQualified ? tierColor : undefined }}
            >
              {formatCardMetric(row, format)}
            </span>
          </div>

          {(statusBox || hasBrackets || showKicker) && (
            <div className="mt-1.5 flex items-center gap-1.5">
              {statusBox}
              {hasBrackets && renderSeedBadge(row, hasBrackets)}
              {showKicker && (
                <span className="ml-auto shrink-0 font-mono text-xs text-fg-secondary tabular-nums">
                  {kicker.kind === 'noKicker' ? kicker.text : `Kicker ${kicker.text}`}
                </span>
              )}
            </div>
          )}
        </>
      );

      return (
        <React.Fragment key={row.player.id}>
          <li>
            <Card
              padding="sm"
              className={cn(isTierQualified && 'border-l-4')}
              style={{ borderLeftColor: isTierQualified ? tierColor : undefined }}
            >
              {isObsMode ? (
                <div className="w-full text-left">{content}</div>
              ) : (
                <button type="button" className="w-full cursor-pointer text-left" onClick={() => onSelectRow(row)}>
                  {content}
                </button>
              )}
            </Card>
          </li>

          {hasBrackets && cutoffInfo && (
            <li
              role="separator"
              className="w-full rounded-sm border-y-2 py-2 px-3 text-center text-xs font-bold tracking-widest uppercase"
              style={{
                background: `${cutoffInfo.color}1a`,
                borderTopColor: cutoffInfo.color,
                borderBottomColor: cutoffInfo.color,
                color: cutoffInfo.color,
              }}
            >
              {formatCutoffLabel(cutoffInfo)}
            </li>
          )}
        </React.Fragment>
      );
    })}
  </ul>
);
