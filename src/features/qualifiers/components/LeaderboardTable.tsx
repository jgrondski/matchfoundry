import React, { useState } from 'react';
import { Tournament, PlayerProfile } from '../../tournament/types';
import { deriveLeaderboard, LeaderboardRankRow, calculatePoints } from '../scoring';
import { QualifierEntryModal } from './QualifierEntryModal';
import { PlayerDetailDrawer } from './PlayerDetailDrawer';
import { TournamentPageHeader } from '../../../components/TournamentPageHeader';
import { Plus, Sparkles, ChevronRight, Check } from 'lucide-react';
import { PlayerAvatar } from '../../players/components/PlayerAvatar';
import { PlaystyleChip } from '../../players/components/PlaystyleChip';
import { getEffectivePlayerName } from '../../players/playerNameUtils';
import { getContrastingTextColor, getAlternateShade } from '../../bracket/colorUtils';
import { TournamentQualTimerHud } from './TournamentQualTimerHud';
import { Badge, Button, Card, cn } from '../../../components/ui';
import { THEME_FALLBACK } from '../../../theme/palette';

const thClass = 'py-3 px-3.5 text-fg-secondary font-semibold text-caption uppercase tracking-wide';
const tdClass = 'py-2.5 px-3.5';
const filterPillClass = 'py-1.5 px-3 rounded-full border text-caption font-bold cursor-pointer';
const filterPillIdleClass = 'border-line bg-surface text-fg-secondary';

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
  const [sourceFilter, setSourceFilter] = useState<'ALL' | 'IN_PERSON' | 'ONLINE' | 'AWAITING'>('ALL');

  const allRows = deriveLeaderboard(tournament);
  const filteredRows = allRows.filter(r => {
    if (sourceFilter === 'IN_PERSON' && r.submissionSource !== 'IN_PERSON') return false;
    if (sourceFilter === 'ONLINE' && r.submissionSource !== 'ONLINE') return false;
    if (sourceFilter === 'AWAITING' && r.status !== 'awaiting verification') return false;

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
  const cutoffRanks = new Map<number, { tierName: string; color: string; count: number }>();
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

  return (
    <div className={cn('w-full mx-auto flex flex-col gap-6', isObsMode ? 'max-w-full p-4' : 'max-w-300 p-0')}>
      {/* OBS: TournamentPageHeader hides its action slot, so the read-only timer renders on its own */}
      {isObsMode && (
        <div className="flex justify-end">
          <TournamentQualTimerHud tournament={tournament} isObsMode={true} readOnly={true} />
        </div>
      )}

      {/* Header with Search, OBS Overlay, and Record Qual Score */}
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
                className="text-sm py-2 px-4 gap-2 whitespace-nowrap font-semibold"
              >
                <Plus size={16} />
                <span>Record Qual Score</span>
              </Button>
            )}
          </div>
        }
        isObsMode={isObsMode}
      />

      {/* Multi-Source Filtering Pills */}
      {!isObsMode && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => setSourceFilter('ALL')}
            className={cn(filterPillClass, sourceFilter === 'ALL' ? 'border-white bg-white/15 text-white' : filterPillIdleClass)}
          >
            All ({allRows.length})
          </button>
          <button
            type="button"
            onClick={() => setSourceFilter('IN_PERSON')}
            className={cn(filterPillClass, sourceFilter === 'IN_PERSON' ? 'border-blue-500 bg-blue-500/20 text-blue-400' : filterPillIdleClass)}
          >
            🏢 In-Person ({allRows.filter(r => r.submissionSource === 'IN_PERSON').length})
          </button>
          <button
            type="button"
            onClick={() => setSourceFilter('ONLINE')}
            className={cn(filterPillClass, sourceFilter === 'ONLINE' ? 'border-purple-500 bg-purple-500/20 text-purple-400' : filterPillIdleClass)}
          >
            🌐 Online ({allRows.filter(r => r.submissionSource === 'ONLINE').length})
          </button>
          <button
            type="button"
            onClick={() => setSourceFilter('AWAITING')}
            className={cn(filterPillClass, sourceFilter === 'AWAITING' ? 'border-gold-bright bg-gold/20 text-gold-bright' : filterPillIdleClass)}
          >
            ⏳ Pending Review ({allRows.filter(r => r.status === 'awaiting verification').length})
          </button>
        </div>
      )}

      {/* Main Leaderboard Table */}
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
                  {searchTerm
                    ? `No competitors found matching "${searchTerm}".`
                    : 'No competitors registered yet. Register competitors in Settings or click "Record Qual Score" to add a player.'}
                </td>
              </tr>
            ) : (
              filteredRows.map((row: LeaderboardRankRow, idx) => {
                const cutoffInfo = typeof row.rank === 'number' ? cutoffRanks.get(row.rank) : undefined;
                const assignedTier = row.assignedTier;
                const isTierQualified = Boolean(hasBrackets && assignedTier && !row.isDNQ);
                const tierColor = assignedTier?.primaryColor || THEME_FALLBACK.primaryColor;
                const tierContrastColor = getContrastingTextColor(tierColor);

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
                        setSelectedPlayer(row.player);
                        setSelectedRankRow(row);
                      }}
                      title={isObsMode ? undefined : "Click to view detailed competitor profile, audit log, and match stats"}
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
                            title="Awaiting verification by judge"
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
                            title="Qualifier in progress"
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
                      </td>

                      {/* Format-Dense Column Layout */}
                      {format === 'HIGH_SCORE' && (
                        <>
                          {/* # of Maxes Column */}
                          <td className={cn(tdClass, 'w-35 text-center')}>
                            {row.maxoutCount && row.maxoutCount > 0 ? (
                              <span
                                className="inline-flex items-center gap-1 py-0.5 px-2 rounded-full bg-gold/22 text-gold-bright text-xs font-extrabold border border-gold/40 shadow-[0_0_8px_rgba(245,158,11,0.15)]"
                              >
                                <Sparkles size={11} /> {row.maxoutCount}x Max
                              </span>
                            ) : (
                              <span className="text-caption text-fg-muted">
                                —
                              </span>
                            )}
                          </td>

                          {/* Kicker Column */}
                          <td className={cn(tdClass, 'font-mono tabular-nums tracking-tight w-35 text-center font-bold text-base')}>
                            {row.kickerScore && row.kickerScore > 0 ? (
                              <span className={cn(!isTierQualified && 'text-white')} style={{ color: isTierQualified ? tierColor : undefined }}>
                                {row.kickerScore.toLocaleString()}
                              </span>
                            ) : row.maxoutCount && row.maxoutCount > 0 ? (
                              <span className="text-xs text-fg-muted">
                                No kicker
                              </span>
                            ) : row.finalScore > 0 ? (
                              <span className={cn(!isTierQualified && 'text-fg-secondary')} style={{ color: isTierQualified ? tierColor : undefined }}>
                                {row.finalScore.toLocaleString()}
                              </span>
                            ) : (
                              <span className="text-caption text-fg-muted">
                                —
                              </span>
                            )}
                          </td>
                        </>
                      )}

                      {format === 'AVERAGE_OF_X' && (
                        <>
                          {/* Attempts Breakdown Chips */}
                          <td className={cn(tdClass, 'min-w-45 text-center')}>
                            <div className="inline-flex gap-1.5 items-center">
                              {Array.from({ length: targetX }).map((_, slotIdx) => {
                                const score = row.attempts[slotIdx];
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
                          </td>

                          {/* Average Score Column */}
                          <td className={cn(tdClass, 'w-35 text-center')}>
                            <div className="inline-flex flex-col items-center">
                              <span
                                className={cn('font-mono tabular-nums tracking-tight font-bold text-base', !isTierQualified && 'text-gold-bright')}
                                style={{ color: isTierQualified ? tierColor : undefined }}
                              >
                                {row.finalScore > 0 ? row.finalScore.toLocaleString() : '—'}
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
                            {(() => {
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

                              const earnedPoints = ptsResult.pointsPerAttempt.filter(pts => pts > 0);

                              return (
                                <div className="inline-flex gap-1.5 items-center flex-wrap justify-center">
                                  {earnedPoints.map((pts, pIdx) => (
                                    <span
                                      key={pIdx}
                                      className="font-mono tabular-nums tracking-tight py-0.5 px-2 rounded-sm text-xs font-bold bg-gold/15 text-gold-bright border border-gold/30"
                                    >
                                      +{pts}
                                    </span>
                                  ))}
                                </div>
                              );
                            })()}
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
                            {row.finalScore} pts
                          </td>
                        </>
                      )}

                      {/* Tier Cutoff & Seed Column (Only when brackets exist) */}
                      {hasBrackets && (
                        <td className={cn(tdClass, 'w-35 text-center')}>
                          <div className="inline-flex items-center justify-center gap-1.5">
                            {isTierQualified && row.tierSeed !== undefined ? (
                              <span
                                className="inline-block py-1 px-2.5 rounded-full text-xs font-bold"
                                style={{ background: tierColor, color: tierContrastColor }}
                              >
                                {assignedTier!.name} #{row.tierSeed}
                              </span>
                            ) : row.isDisqualified ? (
                              <Badge variant="muted" title="Disqualified from this tournament">
                                DQ
                              </Badge>
                            ) : row.isDNQ ? (
                              <Badge variant="muted" title="Did Not Qualify for active brackets">
                                DNQ
                              </Badge>
                            ) : (
                              <Badge variant="muted">Pending</Badge>
                            )}

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
                          ▲ {cutoffInfo.tierName} Cutoff ({cutoffInfo.count} competitors advance to {cutoffInfo.tierName}) ▲
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
