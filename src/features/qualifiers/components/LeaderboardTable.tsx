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
      color: tier.primaryColor || '#f59e0b',
      count: tier.playerCount,
    });
  });

  const hasBrackets = tournament.tiers.length > 0;
  const format = tournament.qualFormat;
  const targetX = tournament.qualAverageCount || 2;
  const tableColSpan = hasBrackets ? 6 : 5;

  return (
    <div
      style={{
        width: '100%',
        maxWidth: isObsMode ? '100%' : '1200px',
        margin: '0 auto',
        padding: isObsMode ? '1rem' : 0,
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
        boxSizing: 'border-box',
      }}
    >
      {/* OBS: TournamentPageHeader hides its action slot, so the read-only timer renders on its own */}
      {isObsMode && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <TournamentQualTimerHud tournament={tournament} isObsMode={true} readOnly={true} />
        </div>
      )}

      {/* Header with Search, OBS Overlay, and Record Qual Score */}
      <TournamentPageHeader
        eyebrow="Qualifying Leaderboard"
        title={tournament.name}
        subtitle={
          <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', margin: 0 }}>
            Format:{' '}
            <strong style={{ color: 'var(--color-gold-bright)' }}>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            {!canManage && !isObsMode && (
              <TournamentQualTimerHud tournament={tournament} compact={true} readOnly={true} />
            )}
            {canManage && (
              <button
                data-testid="open-qualifier-entry"
                onClick={() => setIsEntryModalOpen(true)}
                className="btn btn-primary"
                style={{
                  fontSize: '0.85rem',
                  padding: '0.52rem 0.95rem',
                  gap: '0.45rem',
                  whiteSpace: 'nowrap',
                  fontWeight: 600,
                }}
              >
                <Plus size={16} />
                <span>Record Qual Score</span>
              </button>
            )}
          </div>
        }
        isObsMode={isObsMode}
      />

      {/* Multi-Source Filtering Pills */}
      {!isObsMode && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setSourceFilter('ALL')}
            style={{
              padding: '0.35rem 0.75rem',
              borderRadius: 'var(--radius-full)',
              border: sourceFilter === 'ALL' ? '1px solid #ffffff' : '1px solid var(--color-border)',
              background: sourceFilter === 'ALL' ? 'rgba(255, 255, 255, 0.15)' : 'var(--color-bg-surface)',
              color: sourceFilter === 'ALL' ? '#ffffff' : 'var(--color-text-secondary)',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            All ({allRows.length})
          </button>
          <button
            type="button"
            onClick={() => setSourceFilter('IN_PERSON')}
            style={{
              padding: '0.35rem 0.75rem',
              borderRadius: 'var(--radius-full)',
              border: sourceFilter === 'IN_PERSON' ? '1px solid #3b82f6' : '1px solid var(--color-border)',
              background: sourceFilter === 'IN_PERSON' ? 'rgba(59, 130, 246, 0.2)' : 'var(--color-bg-surface)',
              color: sourceFilter === 'IN_PERSON' ? '#60a5fa' : 'var(--color-text-secondary)',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            🏢 In-Person ({allRows.filter(r => r.submissionSource === 'IN_PERSON').length})
          </button>
          <button
            type="button"
            onClick={() => setSourceFilter('ONLINE')}
            style={{
              padding: '0.35rem 0.75rem',
              borderRadius: 'var(--radius-full)',
              border: sourceFilter === 'ONLINE' ? '1px solid #a855f7' : '1px solid var(--color-border)',
              background: sourceFilter === 'ONLINE' ? 'rgba(168, 85, 247, 0.2)' : 'var(--color-bg-surface)',
              color: sourceFilter === 'ONLINE' ? '#c084fc' : 'var(--color-text-secondary)',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            🌐 Online ({allRows.filter(r => r.submissionSource === 'ONLINE').length})
          </button>
          <button
            type="button"
            onClick={() => setSourceFilter('AWAITING')}
            style={{
              padding: '0.35rem 0.75rem',
              borderRadius: 'var(--radius-full)',
              border: sourceFilter === 'AWAITING' ? '1px solid var(--color-gold-bright)' : '1px solid var(--color-border)',
              background: sourceFilter === 'AWAITING' ? 'rgba(245, 158, 11, 0.2)' : 'var(--color-bg-surface)',
              color: sourceFilter === 'AWAITING' ? 'var(--color-gold-bright)' : 'var(--color-text-secondary)',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            ⏳ Pending Review ({allRows.filter(r => r.status === 'awaiting verification').length})
          </button>
        </div>
      )}

      {/* Main Leaderboard Table */}
      <div style={{ background: 'var(--color-bg-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: 'var(--color-bg-surface-elevated)', borderBottom: '1px solid var(--color-border)' }}>
              <th style={{ ...thStyle, width: '60px', textAlign: 'center' }}>Rank</th>
              <th style={{ ...thStyle, minWidth: '200px' }}>Competitor</th>
              <th style={{ ...thStyle, width: '130px', textAlign: 'center' }}>Verified</th>

              {/* Format-Dense Columns */}
              {format === 'HIGH_SCORE' && (
                <>
                  <th style={{ ...thStyle, width: '140px', textAlign: 'center' }}># of Maxes</th>
                  <th style={{ ...thStyle, width: '140px', textAlign: 'center' }}>Kicker</th>
                </>
              )}

              {format === 'AVERAGE_OF_X' && (
                <>
                  <th style={{ ...thStyle, minWidth: '180px', textAlign: 'center' }}>Top Scores (Ao{targetX})</th>
                  <th style={{ ...thStyle, width: '140px', textAlign: 'center' }}>Average Score</th>
                </>
              )}

              {format === 'POINTS' && (
                <>
                  <th style={{ ...thStyle, minWidth: '180px', textAlign: 'center' }}>Points Breakdown</th>
                  <th style={{ ...thStyle, width: '140px', textAlign: 'center' }}>Total Points</th>
                </>
              )}

              {hasBrackets && (
                <th style={{ ...thStyle, width: '140px', textAlign: 'center' }}>Bracket Seed</th>
              )}
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={tableColSpan} style={{ padding: '2.5rem 1.5rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
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
                const tierColor = assignedTier?.primaryColor || '#f59e0b';
                const tierContrastColor = getContrastingTextColor(tierColor);

                // Row background and accenting based on tier bracket palette
                let rowBg = idx % 2 === 0 ? 'var(--color-bg-surface)' : 'var(--color-bg-surface-elevated)';
                if (isTierQualified) {
                  const baseCard = assignedTier?.cardColor || '#0E1420';
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
                      style={{
                        background: rowBg,
                        borderBottom: isTierQualified
                          ? `1px solid ${assignedTier?.secondaryColor || `${tierColor}33`}`
                          : '1px solid rgba(0, 0, 0, 0.65)',
                        borderLeft: isTierQualified ? `4px solid ${tierColor}` : '4px solid transparent',
                        transition: 'all 0.15s ease',
                        cursor: isObsMode ? 'default' : 'pointer',
                      }}
                    >
                      {/* Rank */}
                      <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 700 }}>
                        <span
                          className="tabular-nums"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '26px',
                            height: '26px',
                            borderRadius: '50%',
                            background: isTierQualified
                              ? tierColor
                              : typeof row.rank === 'number' && row.rank <= 3
                              ? 'var(--color-gold-bg)'
                              : 'rgba(255,255,255,0.05)',
                            color: isTierQualified
                              ? tierContrastColor
                              : typeof row.rank === 'number' && row.rank <= 3
                              ? 'var(--color-gold-bright)'
                              : 'var(--color-text-secondary)',
                            fontSize: '0.8rem',
                            fontWeight: 700,
                          }}
                        >
                          {row.rank ?? '—'}
                        </span>
                      </td>

                      {/* Player Info */}
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <PlayerAvatar player={row.player} />
                          <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
                            {getEffectivePlayerName(row.player)}
                          </span>
                          {row.player.playstyle && (
                            <PlaystyleChip style={row.player.playstyle} />
                          )}
                        </div>
                      </td>

                      {/* Verified Column */}
                      <td style={{ ...tdStyle, width: '130px', textAlign: 'center' }}>
                        {row.status === 'verified' && (
                          <span
                            style={{
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              padding: '0.15rem 0.5rem',
                              borderRadius: 'var(--radius-sm)',
                              background: 'rgba(34, 197, 94, 0.15)',
                              color: '#4ade80',
                              border: '1px solid rgba(34, 197, 94, 0.3)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                            }}
                            title="Qualifier verified"
                          >
                            <Check size={11} /> Verified
                          </span>
                        )}
                        {row.status === 'awaiting verification' && (
                          <span
                            style={{
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              padding: '0.15rem 0.5rem',
                              borderRadius: 'var(--radius-sm)',
                              background: 'rgba(245, 158, 11, 0.15)',
                              color: 'var(--color-gold-bright)',
                              border: '1px solid rgba(245, 158, 11, 0.3)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                            }}
                            title="Awaiting verification by judge"
                          >
                            ⏳ Awaiting Verification
                          </span>
                        )}
                        {row.status === 'dnq' && (
                          <span
                            style={{
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              padding: '0.15rem 0.45rem',
                              borderRadius: 'var(--radius-sm)',
                              background: 'rgba(239, 68, 68, 0.15)',
                              color: '#f87171',
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                            }}
                            title="Did not qualify"
                          >
                            DNQ
                          </span>
                        )}
                        {row.status === 'dq' && (
                          <span
                            style={{
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              padding: '0.15rem 0.45rem',
                              borderRadius: 'var(--radius-sm)',
                              background: 'rgba(239, 68, 68, 0.25)',
                              color: '#ef4444',
                              border: '1px solid rgba(239, 68, 68, 0.5)',
                            }}
                            title="Disqualified"
                          >
                            DQ
                          </span>
                        )}
                        {row.status === 'in progress' && (
                          <span
                            style={{
                              fontSize: '0.68rem',
                              fontWeight: 600,
                              padding: '0.15rem 0.45rem',
                              borderRadius: 'var(--radius-sm)',
                              background: 'rgba(245, 158, 11, 0.15)',
                              color: 'var(--color-gold-bright)',
                              border: '1px solid rgba(245, 158, 11, 0.3)',
                            }}
                            title="Qualifier in progress"
                          >
                            In Progress
                          </span>
                        )}
                        {row.status === 'not started' && (
                          <span
                            style={{
                              fontSize: '0.75rem',
                              color: 'var(--color-text-muted)',
                            }}
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
                          <td style={{ ...tdStyle, width: '140px', textAlign: 'center' }}>
                            {row.maxoutCount && row.maxoutCount > 0 ? (
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.25rem',
                                  padding: '0.15rem 0.5rem',
                                  borderRadius: 'var(--radius-full)',
                                  background: 'rgba(245, 158, 11, 0.22)',
                                  color: 'var(--color-gold-bright)',
                                  fontSize: '0.75rem',
                                  fontWeight: 800,
                                  border: '1px solid rgba(245, 158, 11, 0.4)',
                                  boxShadow: '0 0 8px rgba(245, 158, 11, 0.15)',
                                }}
                              >
                                <Sparkles size={11} /> {row.maxoutCount}x Max
                              </span>
                            ) : (
                              <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                                —
                              </span>
                            )}
                          </td>

                          {/* Kicker Column */}
                          <td className="tabular-nums" style={{ ...tdStyle, width: '140px', textAlign: 'center', fontWeight: 700, fontSize: '0.95rem' }}>
                            {row.kickerScore && row.kickerScore > 0 ? (
                              <span style={{ color: isTierQualified ? tierColor : '#ffffff' }}>
                                {row.kickerScore.toLocaleString()}
                              </span>
                            ) : row.maxoutCount && row.maxoutCount > 0 ? (
                              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                                No kicker
                              </span>
                            ) : row.finalScore > 0 ? (
                              <span style={{ color: isTierQualified ? tierColor : 'var(--color-text-secondary)' }}>
                                {row.finalScore.toLocaleString()}
                              </span>
                            ) : (
                              <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                                —
                              </span>
                            )}
                          </td>
                        </>
                      )}

                      {format === 'AVERAGE_OF_X' && (
                        <>
                          {/* Attempts Breakdown Chips */}
                          <td style={{ ...tdStyle, minWidth: '180px', textAlign: 'center' }}>
                            <div style={{ display: 'inline-flex', gap: '0.35rem', alignItems: 'center' }}>
                              {Array.from({ length: targetX }).map((_, slotIdx) => {
                                const score = row.attempts[slotIdx];
                                const hasScore = typeof score === 'number';
                                return (
                                   <span
                                    key={slotIdx}
                                    className="tabular-nums"
                                    style={{
                                      padding: '0.15rem 0.45rem',
                                      borderRadius: 'var(--radius-sm)',
                                      fontSize: '0.75rem',
                                      fontWeight: 600,
                                      background: hasScore ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                                      color: hasScore ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                                      border: hasScore ? '1px solid var(--color-border-subtle)' : '1px dashed var(--color-border-subtle)',
                                    }}
                                  >
                                    {hasScore ? score.toLocaleString() : '—'}
                                  </span>
                                );
                              })}
                            </div>
                          </td>

                          {/* Average Score Column */}
                          <td style={{ ...tdStyle, width: '140px', textAlign: 'center' }}>
                            <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
                              <span className="tabular-nums" style={{ fontWeight: 700, fontSize: '0.95rem', color: isTierQualified ? tierColor : 'var(--color-gold-bright)' }}>
                                {row.finalScore > 0 ? row.finalScore.toLocaleString() : '—'}
                              </span>
                              <span style={{ fontSize: '0.68rem', color: row.attempts.length >= targetX ? '#34d399' : 'var(--color-text-muted)' }}>
                                {row.attempts.length >= targetX ? 'Completed' : `Running (${row.attempts.length}/${targetX})`}
                              </span>
                            </div>
                          </td>
                        </>
                      )}

                      {format === 'POINTS' && (
                        <>
                          {/* Points Breakdown Column */}
                          <td style={{ ...tdStyle, minWidth: '180px', textAlign: 'center' }}>
                            {(() => {
                              const submissionsForPlayer = (tournament.qualifierSubmissions || [])
                                .filter(s => s.playerId === row.player.id)
                                .sort((a, b) => a.submittedAt - b.submittedAt);
                              const ptsResult = calculatePoints(submissionsForPlayer, tournament.pointsConfig || []);

                              if (submissionsForPlayer.length === 0) {
                                return <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>No submissions</span>;
                              }

                              if (ptsResult.totalPoints === 0) {
                                const topScore = Math.max(...submissionsForPlayer.map(s => s.score));
                                return (
                                  <span className="tabular-nums" style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                                    Top Score: <strong style={{ color: 'var(--color-text-primary)' }}>{topScore.toLocaleString()}</strong>
                                  </span>
                                );
                              }

                              const earnedPoints = ptsResult.pointsPerAttempt.filter(pts => pts > 0);

                              return (
                                <div style={{ display: 'inline-flex', gap: '0.35rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
                                  {earnedPoints.map((pts, pIdx) => (
                                    <span
                                      key={pIdx}
                                      className="tabular-nums"
                                      style={{
                                        padding: '0.15rem 0.45rem',
                                        borderRadius: 'var(--radius-sm)',
                                        fontSize: '0.75rem',
                                        fontWeight: 700,
                                        background: 'rgba(245, 158, 11, 0.15)',
                                        color: 'var(--color-gold-bright)',
                                        border: '1px solid rgba(245, 158, 11, 0.3)',
                                      }}
                                    >
                                      +{pts}
                                    </span>
                                  ))}
                                </div>
                              );
                            })()}
                          </td>

                          {/* Total Points Column */}
                          <td className="tabular-nums" style={{ ...tdStyle, width: '140px', textAlign: 'center', fontWeight: 800, fontSize: '0.98rem', color: isTierQualified ? tierColor : 'var(--color-gold-bright)' }}>
                            {row.finalScore} pts
                          </td>
                        </>
                      )}

                      {/* Tier Cutoff & Seed Column (Only when brackets exist) */}
                      {hasBrackets && (
                        <td style={{ ...tdStyle, width: '140px', textAlign: 'center' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
                            {isTierQualified && row.tierSeed !== undefined ? (
                              <span
                                style={{
                                  display: 'inline-block',
                                  padding: '0.2rem 0.6rem',
                                  borderRadius: 'var(--radius-full)',
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                  background: tierColor,
                                  color: tierContrastColor,
                                }}
                              >
                                {assignedTier!.name} #{row.tierSeed}
                              </span>
                            ) : row.isDisqualified ? (
                              <span className="badge badge-muted" title="Disqualified from this tournament">
                                DQ
                              </span>
                            ) : row.isDNQ ? (
                              <span className="badge badge-muted" title="Did Not Qualify for active brackets">
                                DNQ
                              </span>
                            ) : (
                              <span className="badge badge-muted">Pending</span>
                            )}

                            <ChevronRight size={14} color="var(--color-text-muted)" />
                          </div>
                        </td>
                      )}
                    </tr>

                    {/* Dynamic Tier Cutoff Line Divider (Only when brackets exist) */}
                    {hasBrackets && cutoffInfo && (
                      <tr
                        style={{
                          background: `${cutoffInfo.color}1a`,
                          borderTop: `2px solid ${cutoffInfo.color}`,
                          borderBottom: `2px solid ${cutoffInfo.color}`,
                        }}
                      >
                        <td
                          colSpan={tableColSpan}
                          style={{
                            padding: '0.45rem 1rem',
                            textAlign: 'center',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            color: cutoffInfo.color,
                            letterSpacing: '0.08em',
                            textTransform: 'uppercase',
                          }}
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
      </div>

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

const thStyle: React.CSSProperties = {
  padding: '0.75rem 0.85rem',
  color: 'var(--color-text-secondary)',
  fontWeight: 600,
  fontSize: '0.8rem',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};

const tdStyle: React.CSSProperties = {
  padding: '0.65rem 0.85rem',
};
