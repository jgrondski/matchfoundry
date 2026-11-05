import React, { useState } from 'react';
import { Tournament, PlayerProfile } from '../../tournament/types';
import { deriveLeaderboard, LeaderboardRankRow, calculatePoints } from '../scoring';
import { QualifierEntryModal } from './QualifierEntryModal';
import { PlayerDetailDrawer } from './PlayerDetailDrawer';
import { TournamentPageHeader } from '../../../components/TournamentPageHeader';
import { Plus, ChevronRight, Check } from 'lucide-react';
import { PlayerAvatar } from '../../players/components/PlayerAvatar';
import { PlaystyleChip } from '../../players/components/PlaystyleChip';
import { getEffectivePlayerName } from '../../players/playerNameUtils';
import { getContrastingTextColor, getAlternateShade } from '../../bracket/colorUtils';
import { TournamentQualTimerHud } from './TournamentQualTimerHud';
import { Badge, Button, Card, cn, useIsMobile } from '../../../components/ui';
import { THEME_FALLBACK } from '../../../theme/palette';
import { LeaderboardCardList } from './LeaderboardCardList';

const thClass = 'py-3 px-3.5 text-fg-secondary font-semibold text-caption uppercase tracking-wide';
const tdClass = 'py-2.5 px-3.5';
const filterPillClass = 'py-1.5 px-3 rounded-full border text-caption font-bold cursor-pointer';
const filterPillIdleClass = 'border-line bg-surface text-fg-secondary';

export interface CutoffInfo {
  tierName: string;
  color: string;
  count: number;
}

/** Tier accent for a leaderboard row: qualified rows take their tier's color. */
export function getRowTierAccent(row: LeaderboardRankRow, hasBrackets: boolean) {
  const assignedTier = row.assignedTier;
  const isTierQualified = Boolean(hasBrackets && assignedTier && !row.isDNQ);
  const tierColor = assignedTier?.primaryColor || THEME_FALLBACK.primaryColor;
  const tierContrastColor = getContrastingTextColor(tierColor);
  return { isTierQualified, tierColor, tierContrastColor };
}

/** Primary metric text: average (AVERAGE_OF_X), top score (HIGH_SCORE) or total points (POINTS). */
export function formatPrimaryMetric(row: LeaderboardRankRow, format: Tournament['qualFormat']): string {
  if (format === 'POINTS') return `${row.finalScore} pts`;
  return row.finalScore > 0 ? row.finalScore.toLocaleString() : '—';
}

/** # of Maxes value, or undefined when the player has none. */
export function formatMaxoutCount(row: LeaderboardRankRow): string | undefined {
  return row.maxoutCount && row.maxoutCount > 0 ? String(row.maxoutCount) : undefined;
}

export type KickerDisplayKind = 'kicker' | 'noKicker' | 'best' | 'empty';

/** Kicker column value: the kicker, "No kicker" after maxes, else the best score, else a dash. */
export function getKickerDisplay(row: LeaderboardRankRow): { kind: KickerDisplayKind; text: string } {
  if (row.kickerScore && row.kickerScore > 0) return { kind: 'kicker', text: row.kickerScore.toLocaleString() };
  if (row.maxoutCount && row.maxoutCount > 0) return { kind: 'noKicker', text: 'No kicker' };
  if (row.finalScore > 0) return { kind: 'best', text: row.finalScore.toLocaleString() };
  return { kind: 'empty', text: '—' };
}

export function formatCutoffLabel(info: CutoffInfo): string {
  return `▲ ${info.tierName} Cutoff (${info.count} competitors advance to ${info.tierName}) ▲`;
}

/** Verified column badge for a row's qualifier status. */
export function renderVerifiedStatus(row: LeaderboardRankRow): React.ReactNode {
  return (
    <>
      {row.status === 'verified' && (
        <span
          className="text-2xs font-bold py-0.5 px-2 rounded-sm bg-green-500/15 text-green-400 border border-green-500/30 inline-flex items-center gap-1"
          title="Qualifier verified"
        >
          <Check size={11} /> Verified
        </span>
      )}
      {row.status === 'awaiting verification' && (
        <span
          className="text-2xs font-bold py-0.5 px-2 rounded-sm bg-gold/15 text-gold-bright border border-gold/30 inline-flex items-center gap-1"
          title="Awaiting Verification"
        >
          ⏳ Awaiting Verification
        </span>
      )}
      {row.status === 'dnq' && (
        <span
          className="text-2xs font-bold py-0.5 px-2 rounded-sm bg-red/15 text-red-bright border border-red/30"
          title="Did not qualify"
        >
          DNQ
        </span>
      )}
      {row.status === 'dq' && (
        <span
          className="text-2xs font-bold py-0.5 px-2 rounded-sm bg-red/25 text-red border border-red/50"
          title="Disqualified"
        >
          DQ
        </span>
      )}
      {row.status === 'in progress' && (
        <span
          className="text-2xs font-semibold py-0.5 px-2 rounded-sm bg-gold/15 text-gold-bright border border-gold/30"
          title="In Progress"
        >
          In Progress
        </span>
      )}
      {row.status === 'not started' && (
        <span
          className="text-xs text-fg-muted"
          title="Not started"
        >
          —
        </span>
      )}
    </>
  );
}

/** AVERAGE_OF_X attempt chips, one slot per counted attempt: the highest X scores. */
export function renderAttemptChips(row: LeaderboardRankRow, targetX: number, className?: string): React.ReactNode {
  const topAttempts = [...row.attempts].sort((a, b) => b - a);
  return (
    <div className={cn('inline-flex gap-1.5 items-center', className)}>
      {Array.from({ length: targetX }).map((_, slotIdx) => {
        const score = topAttempts[slotIdx];
        const hasScore = typeof score === 'number';
        return (
           <span
            key={slotIdx}
            className={cn(
              'font-mono tabular-nums tracking-tight py-0.5 px-2 rounded-sm text-xs font-semibold border border-line-subtle',
              hasScore ? 'bg-white/8 text-fg' : 'bg-white/2 text-fg-muted border-dashed'
            )}
          >
            {hasScore ? score.toLocaleString() : '—'}
          </span>
        );
      })}
    </div>
  );
}

/** POINTS breakdown: earned points per attempt, or the top score when no points are earned yet. */
export function renderPointsBreakdown(row: LeaderboardRankRow, tournament: Tournament): React.ReactNode {
  const submissionsForPlayer = (tournament.qualifierSubmissions || [])
    .filter(s => s.playerId === row.player.id)
    .sort((a, b) => a.submittedAt - b.submittedAt);
  const ptsResult = calculatePoints(submissionsForPlayer, tournament.pointsConfig || []);

  if (submissionsForPlayer.length === 0) {
    return <span className="text-xs text-fg-muted">No submissions</span>;
  }

  if (ptsResult.totalPoints === 0) {
    const topScore = Math.max(...submissionsForPlayer.map(s => s.score));
    return (
      <span className="font-mono tabular-nums tracking-tight text-caption text-fg-secondary">
        Top Score: <strong className="text-fg">{topScore.toLocaleString()}</strong>
      </span>
    );
  }

  const earnedAttempts = submissionsForPlayer
    .map((submission, idx) => ({ id: submission.id, score: submission.score, pts: ptsResult.pointsPerAttempt[idx] }))
    .filter(attempt => attempt.pts > 0);

  return (
    <div className="inline-flex gap-1.5 items-center flex-wrap justify-center">
      {earnedAttempts.map(attempt => (
        <span
          key={attempt.id}
          title={attempt.score.toLocaleString()}
          className="font-mono tabular-nums tracking-tight py-0.5 px-2 rounded-sm text-xs font-bold bg-gold/15 text-gold-bright border border-gold/30"
        >
          +{attempt.pts}
        </span>
      ))}
    </div>
  );
}

/** Bracket Seed column badge: tier and seed when qualified, otherwise DQ / DNQ / Pending. */
export function renderSeedBadge(row: LeaderboardRankRow, hasBrackets: boolean): React.ReactNode {
  const { isTierQualified, tierColor, tierContrastColor } = getRowTierAccent(row, hasBrackets);
  if (isTierQualified && row.tierSeed !== undefined) {
    return (
      <span
        className="inline-block py-1 px-2.5 rounded-full text-xs font-bold"
        style={{ background: tierColor, color: tierContrastColor }}
      >
        {row.assignedTier!.name} #{row.tierSeed}
      </span>
    );
  }
  if (row.isDisqualified) {
    return (
      <Badge variant="muted" title="Disqualified">
        DQ
      </Badge>
    );
  }
  if (row.isDNQ) {
    return (
      <Badge variant="muted" title="Did Not Qualify">
        DNQ
      </Badge>
    );
  }
  return <Badge variant="muted">Pending</Badge>;
}

interface LeaderboardTableProps {
  tournament: Tournament;
  canManage?: boolean;
  isObsMode?: boolean;
}

export const LeaderboardTable: React.FC<LeaderboardTableProps> = ({
  tournament,
  canManage = true,
  isObsMode = false,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerProfile | null>(null);
  const [selectedRankRow, setSelectedRankRow] = useState<LeaderboardRankRow | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'AWAITING'>('ALL');
  const isMobile = useIsMobile();

  const allRows = deriveLeaderboard(tournament);
  const filteredRows = allRows.filter(r => {
    if (statusFilter === 'AWAITING' && r.status !== 'awaiting verification') return false;

    const q = searchTerm.trim().toLowerCase();
    if (!q) return true;
    return (
      getEffectivePlayerName(r.player).toLowerCase().includes(q) ||
      r.player.name.toLowerCase().includes(q) ||
      (r.player.country && r.player.country.toLowerCase().includes(q)) ||
      (r.player.playstyle && r.player.playstyle.toLowerCase().includes(q))
    );
  });

  // Calculate cutoff rank boundaries for dividers
  const sortedTiers = [...tournament.tiers].sort((a, b) => a.priority - b.priority);
  const cutoffRanks = new Map<number, CutoffInfo>();
  let runningCutoff = 0;
  sortedTiers.forEach(tier => {
    runningCutoff += tier.playerCount;
    cutoffRanks.set(runningCutoff, {
      tierName: tier.name,
      color: tier.primaryColor || THEME_FALLBACK.primaryColor,
      count: tier.playerCount,
    });
  });

  const hasBrackets = tournament.tiers.length > 0;
  const format = tournament.qualFormat;
  const targetX = tournament.qualAverageCount || 2;
  const tableColSpan = hasBrackets ? 6 : 5;
  const emptyStateText = searchTerm
    ? `No competitors found matching "${searchTerm}".`
    : 'No competitors registered yet. Register competitors in Settings or click "Record Score" to add a player.';

  const handleSelectRow = (row: LeaderboardRankRow) => {
    setSelectedPlayer(row.player);
    setSelectedRankRow(row);
  };

  return (
    <div className={cn('w-full mx-auto flex flex-col gap-6', isObsMode ? 'max-w-full p-4' : 'max-w-300 p-0', canManage && 'max-md:pb-20')}>
      {/* OBS: TournamentPageHeader hides its action slot, so the read-only timer renders on its own */}
      {isObsMode && (
        <div className="flex justify-end">
          <TournamentQualTimerHud tournament={tournament} isObsMode={true} readOnly={true} />
        </div>
      )}

      {/* Header with Search, OBS Overlay, and Record Score */}
      <TournamentPageHeader
        eyebrow="Qualifying Leaderboard"
        title={tournament.name}
        subtitle={
          <p className="text-sm text-fg-muted m-0">
            Format:{' '}
            <strong className="text-gold-bright">
              {tournament.qualFormat === 'HIGH_SCORE'
                ? '# of Maxes'
                : tournament.qualFormat === 'AVERAGE_OF_X'
                ? `Average of ${targetX} Attempts`
                : 'Points Threshold System'}
            </strong>
            {tournament.qualFormat === 'AVERAGE_OF_X' && ` (Ao${targetX})`}
            {' • '}
            {tournament.isLocked
              ? 'Qualifiers Closed (Match Play in Progress)'
              : 'Qualifiers Open (Live Running Standings)'}
          </p>
        }
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search competitor, country, style..."
        action={
          <div className="flex items-center gap-3 flex-wrap">
            {!canManage && !isObsMode && (
              <TournamentQualTimerHud tournament={tournament} compact={true} readOnly={true} />
            )}
            {canManage && (
              <Button
                data-testid="open-qualifier-entry"
                variant="primary"
                onClick={() => setIsEntryModalOpen(true)}
                className="text-sm py-2 px-4 gap-2 whitespace-nowrap font-semibold max-md:fixed max-md:inset-x-3 max-md:bottom-[calc(4.25rem+env(safe-area-inset-bottom))] max-md:z-40 max-md:py-3 max-md:shadow-lg"
              >
                <Plus size={16} />
                <span>Record Score</span>
              </Button>
            )}
          </div>
        }
        isObsMode={isObsMode}
      />

      {/* Filter Pills */}
      {!isObsMode && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => setStatusFilter('ALL')}
            className={cn(filterPillClass, statusFilter === 'ALL' ? 'border-white bg-white/15 text-white' : filterPillIdleClass)}
          >
            All ({allRows.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('AWAITING')}
            className={cn(filterPillClass, statusFilter === 'AWAITING' ? 'border-gold-bright bg-gold/20 text-gold-bright' : filterPillIdleClass)}
          >
            ⏳ Pending Review ({allRows.filter(r => r.status === 'awaiting verification').length})
          </button>
        </div>
      )}

      {/* Main Leaderboard: card list on phones, table otherwise */}
      {isMobile ? (
        filteredRows.length === 0 ? (
          <Card>
            <p className="py-6 text-center text-sm text-fg-muted m-0">{emptyStateText}</p>
          </Card>
        ) : (
          <LeaderboardCardList
            rows={filteredRows}
            format={format}
            hasBrackets={hasBrackets}
            cutoffRanks={cutoffRanks}
            isObsMode={isObsMode}
            onSelectRow={handleSelectRow}
          />
        )
      ) : (
      <Card padding="none" className="overflow-hidden">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="bg-elevated border-b border-line">
              <th className={cn(thClass, 'w-15 text-center')}>Rank</th>
              <th className={cn(thClass, 'min-w-50')}>Competitor</th>
              <th className={cn(thClass, 'w-32.5 text-center')}>Verified</th>

              {/* Format-Dense Columns */}
              {format === 'HIGH_SCORE' && (
                <>
                  <th className={cn(thClass, 'w-35 text-center')}># of Maxes</th>
                  <th className={cn(thClass, 'w-35 text-center')}>Kicker</th>
                </>
              )}

              {format === 'AVERAGE_OF_X' && (
                <>
                  <th className={cn(thClass, 'min-w-45 text-center')}>Top Scores (Ao{targetX})</th>
                  <th className={cn(thClass, 'w-35 text-center')}>Average Score</th>
                </>
              )}

              {format === 'POINTS' && (
                <>
                  <th className={cn(thClass, 'min-w-45 text-center')}>Points Breakdown</th>
                  <th className={cn(thClass, 'w-35 text-center')}>Total Points</th>
                </>
              )}

              {hasBrackets && (
                <th className={cn(thClass, 'w-35 text-center')}>Bracket Seed</th>
              )}
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={tableColSpan} className="py-10 px-6 text-center text-fg-muted">
                  {emptyStateText}
                </td>
              </tr>
            ) : (
              filteredRows.map((row: LeaderboardRankRow, idx) => {
                const cutoffInfo = typeof row.rank === 'number' ? cutoffRanks.get(row.rank) : undefined;
                const assignedTier = row.assignedTier;
                const { isTierQualified, tierColor, tierContrastColor } = getRowTierAccent(row, hasBrackets);
                const kicker = getKickerDisplay(row);
                const maxoutCount = formatMaxoutCount(row);

                // Row background and accenting based on tier bracket palette
                let rowBg = idx % 2 === 0 ? 'var(--color-surface)' : 'var(--color-elevated)';
                if (isTierQualified) {
                  const baseCard = assignedTier?.cardColor || THEME_FALLBACK.leaderboardCardColor;
                  rowBg = idx % 2 === 0 ? baseCard : getAlternateShade(baseCard, 6);
                }

                return (
                  <React.Fragment key={row.player.id}>
                    <tr
                      onClick={() => {
                        if (isObsMode) return;
                        handleSelectRow(row);
                      }}
                      title={isObsMode ? undefined : "View Competitor"}
                      className={cn(
                        'border-b border-l-4 transition-all duration-150',
                        !isTierQualified && 'border-b-black/65 border-l-transparent',
                        isObsMode ? 'cursor-default' : 'cursor-pointer'
                      )}
                      style={{
                        background: rowBg,
                        borderBottomColor: isTierQualified ? assignedTier?.secondaryColor || `${tierColor}33` : undefined,
                        borderLeftColor: isTierQualified ? tierColor : undefined,
                      }}
                    >
                      {/* Rank */}
                      <td className={cn(tdClass, 'text-center font-bold')}>
                        <span
                          className={cn(
                            'font-mono tabular-nums tracking-tight inline-flex items-center justify-center size-6.5 rounded-full text-caption font-bold',
                            !isTierQualified &&
                              (typeof row.rank === 'number' && row.rank <= 3
                                ? 'bg-gold-soft text-gold-bright'
                                : 'bg-white/5 text-fg-secondary')
                          )}
                          style={{
                            background: isTierQualified ? tierColor : undefined,
                            color: isTierQualified ? tierContrastColor : undefined,
                          }}
                        >
                          {row.rank ?? '—'}
                        </span>
                      </td>

                      {/* Player Info */}
                      <td className={tdClass}>
                        <div className="flex items-center gap-2 flex-wrap">
                          <PlayerAvatar player={row.player} />
                          <span className="font-semibold text-fg">
                            {getEffectivePlayerName(row.player)}
                          </span>
                          {row.player.playstyle && (
                            <PlaystyleChip style={row.player.playstyle} />
                          )}
                        </div>
                      </td>

                      {/* Verified Column */}
                      <td className={cn(tdClass, 'w-32.5 text-center')}>
                        {renderVerifiedStatus(row)}
                      </td>

                      {/* Format-Dense Column Layout */}
                      {format === 'HIGH_SCORE' && (
                        <>
                          {/* # of Maxes Column */}
                          <td className={cn(tdClass, 'w-35 text-center')}>
                            {maxoutCount !== undefined ? (
                              <span className="font-mono tabular-nums text-base font-bold text-fg">
                                {maxoutCount}
                              </span>
                            ) : (
                              <span className="text-caption text-fg-muted">
                                —
                              </span>
                            )}
                          </td>

                          {/* Kicker Column */}
                          <td className={cn(tdClass, 'font-mono tabular-nums tracking-tight w-35 text-center font-bold text-base')}>
                            {kicker.kind === 'kicker' ? (
                              <span className={cn(!isTierQualified && 'text-white')} style={{ color: isTierQualified ? tierColor : undefined }}>
                                {kicker.text}
                              </span>
                            ) : kicker.kind === 'noKicker' ? (
                              <span className="text-xs text-fg-muted">
                                {kicker.text}
                              </span>
                            ) : kicker.kind === 'best' ? (
                              <span className={cn(!isTierQualified && 'text-fg-secondary')} style={{ color: isTierQualified ? tierColor : undefined }}>
                                {kicker.text}
                              </span>
                            ) : (
                              <span className="text-caption text-fg-muted">
                                {kicker.text}
                              </span>
                            )}
                          </td>
                        </>
                      )}

                      {format === 'AVERAGE_OF_X' && (
                        <>
                          {/* Attempts Breakdown Chips */}
                          <td className={cn(tdClass, 'min-w-45 text-center')}>
                            {renderAttemptChips(row, targetX)}
                          </td>

                          {/* Average Score Column */}
                          <td className={cn(tdClass, 'w-35 text-center')}>
                            <div className="inline-flex flex-col items-center">
                              <span
                                className={cn('font-mono tabular-nums tracking-tight font-bold text-base', !isTierQualified && 'text-gold-bright')}
                                style={{ color: isTierQualified ? tierColor : undefined }}
                              >
                                {formatPrimaryMetric(row, format)}
                              </span>
                              <span className={cn('text-2xs', row.attempts.length >= targetX ? 'text-green-bright' : 'text-fg-muted')}>
                                {row.attempts.length >= targetX ? 'Completed' : `Running (${row.attempts.length}/${targetX})`}
                              </span>
                            </div>
                          </td>
                        </>
                      )}

                      {format === 'POINTS' && (
                        <>
                          {/* Points Breakdown Column */}
                          <td className={cn(tdClass, 'min-w-45 text-center')}>
                            {renderPointsBreakdown(row, tournament)}
                          </td>

                          {/* Total Points Column */}
                          <td
                            className={cn(
                              tdClass,
                              'font-mono tabular-nums tracking-tight w-35 text-center font-extrabold text-base',
                              !isTierQualified && 'text-gold-bright'
                            )}
                            style={{ color: isTierQualified ? tierColor : undefined }}
                          >
                            {formatPrimaryMetric(row, format)}
                          </td>
                        </>
                      )}

                      {/* Tier Cutoff & Seed Column (Only when brackets exist) */}
                      {hasBrackets && (
                        <td className={cn(tdClass, 'w-35 text-center')}>
                          <div className="inline-flex items-center justify-center gap-1.5">
                            {renderSeedBadge(row, hasBrackets)}

                            <ChevronRight size={14} color="var(--color-fg-muted)" />
                          </div>
                        </td>
                      )}
                    </tr>

                    {/* Dynamic Tier Cutoff Line Divider (Only when brackets exist) */}
                    {hasBrackets && cutoffInfo && (
                      <tr
                        className="border-y-2"
                        style={{
                          background: `${cutoffInfo.color}1a`,
                          borderTopColor: cutoffInfo.color,
                          borderBottomColor: cutoffInfo.color,
                        }}
                      >
                        <td
                          colSpan={tableColSpan}
                          className="py-2 px-4 text-center text-xs font-bold tracking-widest uppercase"
                          style={{ color: cutoffInfo.color }}
                        >
                          {formatCutoffLabel(cutoffInfo)}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </Card>
      )}

      {/* Qualifier Score Submission Modal */}
      {isEntryModalOpen && (
        <QualifierEntryModal
          isOpen={isEntryModalOpen}
          onClose={() => setIsEntryModalOpen(false)}
          tournament={tournament}
        />
      )}

      {/* Competitor Detail Drawer */}
      {selectedPlayer && (
        <PlayerDetailDrawer
          isOpen={Boolean(selectedPlayer)}
          onClose={() => {
            setSelectedPlayer(null);
            setSelectedRankRow(undefined);
          }}
          player={selectedPlayer}
          tournament={tournament}
          rankRow={selectedRankRow}
          tier={selectedRankRow?.assignedTier}
        />
      )}
    </div>
  );
};
