import React, { useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Tournament, TournamentTier, PlayerProfile, Playstyle } from '../types';
import { calculateGlobalStandings, GlobalStandingRow } from '../standings';
import { colorWithAlpha, getContrastingTextColor, getAlternateShade } from '../../bracket/colorUtils';
import { PlayerDetailDrawer } from '../../qualifiers/components/PlayerDetailDrawer';
import { PlayerAvatar } from '../../players/components/PlayerAvatar';
import { PlaystyleChip } from '../../players/components/PlaystyleChip';
import { getEffectivePlayerName } from '../../players/playerNameUtils';
import { TournamentPageHeader } from '../../../components/TournamentPageHeader';
import {
  Trophy,
  Layers,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  Flame,
} from 'lucide-react';
import { TournamentQualTimerHud } from '../../qualifiers/components/TournamentQualTimerHud';
import { Button, cn } from '../../../components/ui';
import { STATUS_COLORS, THEME_FALLBACK } from '../../../theme/palette';

const TABULAR = 'font-mono tabular-nums tracking-tight';
const thClass = 'py-2 px-3 text-caption font-semibold uppercase tracking-wide text-fg-secondary';
const tdClass = 'py-2 px-3';
const pillClass = 'flex cursor-pointer items-center gap-1.5 rounded-full border py-1.5 px-3.5 text-caption transition-all duration-150';
const pillInactiveClass = 'border-line bg-surface font-medium text-fg-secondary';

interface FinalStandingsTableProps {
  tournament: Tournament;
  initialTierId?: string;
  isObsMode?: boolean;
}

export const FinalStandingsTable: React.FC<FinalStandingsTableProps> = ({
  tournament,
  initialTierId,
  isObsMode = false,
}) => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<string>(initialTierId || 'ALL');
  const [selectedPlayerForDrawer, setSelectedPlayerForDrawer] = useState<PlayerProfile | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const handlePlayerClick = (pId: string, pName: string, country?: string, playstyle?: Playstyle) => {
    const profile = (tournament.playersPool || []).find(p => p.id === pId) || {
      id: pId,
      name: pName,
      country,
      personalBest: 0,
      playstyle: playstyle || 'DAS',
    };
    setSelectedPlayerForDrawer(profile);
    setIsDrawerOpen(true);
  };

  const globalRows = useMemo(() => {
    return calculateGlobalStandings(tournament);
  }, [tournament]);

  // Derive summary metrics
  const totalCompetitors = globalRows.length;

  // Section / Tier counts for filter chips
  const tierCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: totalCompetitors, DNQ: 0, DQ: 0 };
    tournament.tiers.forEach(t => {
      counts[t.id] = 0;
    });

    globalRows.forEach(r => {
      if (r.isDisqualified) {
        counts.DQ = (counts.DQ || 0) + 1;
      } else if (r.isDNQ) {
        counts.DNQ = (counts.DNQ || 0) + 1;
      } else if (r.tier?.id) {
        counts[r.tier.id] = (counts[r.tier.id] || 0) + 1;
      }
    });
    return counts;
  }, [globalRows, tournament.tiers, totalCompetitors]);

  // Filter rows based on search and section filter
  const filteredRows = useMemo(() => {
    return globalRows.filter(row => {
      // Search match
      const query = searchTerm.trim().toLowerCase();
      if (query) {
        const effectiveName = getEffectivePlayerName(row.player).toLowerCase();
        const originalName = row.player.name.toLowerCase();
        const nameMatch = effectiveName.includes(query) || originalName.includes(query);
        const countryMatch = row.player.country?.toLowerCase().includes(query);
        const playstyleMatch = row.player.playstyle?.toLowerCase().includes(query);
        const tierMatch = row.tier?.name.toLowerCase().includes(query);
        if (!nameMatch && !countryMatch && !playstyleMatch && !tierMatch) {
          return false;
        }
      }

      // Filter chip match
      if (selectedFilter === 'ALL') return true;
      if (selectedFilter === 'DNQ') return row.isDNQ && !row.isDisqualified;
      if (selectedFilter === 'DQ') return row.isDisqualified;
      return row.tier?.id === selectedFilter;
    });
  }, [globalRows, searchTerm, selectedFilter]);

  // Group rows by Section (Tier 1, Tier 2..., DNQ, DQ) when viewing ALL
  interface StandingsSection {
    id: string;
    title: string;
    subtitle?: string;
    tier?: TournamentTier;
    color: string;
    isDNQ?: boolean;
    isDQ?: boolean;
    rows: GlobalStandingRow[];
  }

  const sections: StandingsSection[] = useMemo(() => {
    if (selectedFilter !== 'ALL') {
      // Single section matching filter
      if (selectedFilter === 'DNQ') {
        return [{
          id: 'dnq',
          title: 'Did Not Qualify (DNQ)',
          subtitle: 'Competitors below tournament bracket qualification cutoffs',
          color: STATUS_COLORS.dnq,
          isDNQ: true,
          rows: filteredRows,
        }];
      }
      if (selectedFilter === 'DQ') {
        return [{
          id: 'dq',
          title: 'Disqualified (DQ)',
          subtitle: 'Disqualified competitors removed from official placement',
          color: STATUS_COLORS.dq,
          isDQ: true,
          rows: filteredRows,
        }];
      }
      const tier = tournament.tiers.find(t => t.id === selectedFilter);
      return [{
        id: selectedFilter,
        title: tier?.name || 'Tier',
        subtitle: `${tier?.playerCount || 0} Bracket Competitors • Best of ${tier?.bestOf || 3}`,
        tier,
        color: tier?.primaryColor || THEME_FALLBACK.primaryColor,
        rows: filteredRows,
      }];
    }

    // When viewing ALL: group consecutively by tier / DNQ / DQ
    const grouped: StandingsSection[] = [];

    const sortedTiers = [...tournament.tiers].sort((a, b) => a.priority - b.priority);

    for (const tier of sortedTiers) {
      const tierRows = filteredRows.filter(r => r.tier?.id === tier.id);
      if (tierRows.length > 0) {
        grouped.push({
          id: tier.id,
          title: tier.name,
          subtitle: `${tier.playerCount} Bracket Competitors • Best of ${tier.bestOf}`,
          tier,
          color: tier.primaryColor || THEME_FALLBACK.primaryColor,
          rows: tierRows,
        });
      }
    }

    const dnqRows = filteredRows.filter(r => r.isDNQ && !r.isDisqualified);
    if (dnqRows.length > 0) {
      grouped.push({
        id: 'dnq',
        title: 'Did Not Qualify (DNQ)',
        subtitle: 'Competitors below tournament bracket qualification cutoffs',
        color: STATUS_COLORS.dnq,
        isDNQ: true,
        rows: dnqRows,
      });
    }

    const dqRows = filteredRows.filter(r => r.isDisqualified);
    if (dqRows.length > 0) {
      grouped.push({
        id: 'dq',
        title: 'Disqualified (DQ)',
        subtitle: 'Disqualified competitors removed from official placement',
        color: STATUS_COLORS.dq,
        isDQ: true,
        rows: dqRows,
      });
    }

    return grouped;
  }, [selectedFilter, filteredRows, tournament.tiers]);

  // Until brackets are configured and finalized into match play, render informative empty state
  if (tournament.tiers.length === 0) {
    return (
      <div className="flex w-full flex-col items-center justify-center gap-4 text-center">
        <h2 className="text-2xl font-bold text-fg">No Bracket Tiers Configured</h2>
        <p className="text-sm leading-normal text-fg-secondary">
          This tournament does not have any bracket tiers yet. Qualifiers can be entered and ranked on the leaderboard, or you can create bracket tiers in Settings.
        </p>
        <div className="mt-2 flex flex-wrap justify-center gap-3">
          <Button onClick={() => navigate(`/${tournament.slug}/leaderboard`)}>
            🏆 View Qualifiers
          </Button>
          <Button variant="primary" onClick={() => navigate(`/${tournament.slug}/manage/settings`)}>
            ⚙️ Configure Tiers in Settings
          </Button>
        </div>
      </div>
    );
  }

  const location = useLocation();
  const isManage = location.pathname.includes('/manage');
  const defaultTierSlug = tournament.tiers[0]?.slug;

  if (!tournament.isLocked) {
    return (
      <div className="flex w-full flex-col items-center justify-center gap-4 text-center">
        {(!isManage || isObsMode) && (
          <TournamentQualTimerHud tournament={tournament} isObsMode={isObsMode} readOnly={true} />
        )}
        <h2 className="text-2xl font-bold text-fg">Brackets Not Finalized</h2>
        <p className="text-sm leading-normal text-fg-secondary">
          Qualifiers are currently running and tournament brackets have not been locked into match play. Final standings will become available once qualifiers conclude and brackets are finalized.
        </p>
        <div className="mt-2 flex flex-wrap justify-center gap-3">
          <Button
            onClick={() => navigate(isManage ? `/${tournament.slug}/manage/qualifiers` : `/${tournament.slug}/leaderboard`)}
          >
            🏆 View Qualifiers
          </Button>
          {defaultTierSlug && (
            <Button
              onClick={() => navigate(isManage ? `/${tournament.slug}/manage/bracket/${defaultTierSlug}` : `/${tournament.slug}/${defaultTierSlug}`)}
            >
              🌲 Visual Bracket
            </Button>
          )}
          <Button variant="primary" onClick={() => navigate(`/${tournament.slug}/manage/settings`)}>
            ⚙️ Finalize in Settings
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('mx-auto flex w-full flex-col gap-6', isObsMode ? 'max-w-full p-4' : 'max-w-300 p-0')}>
      {/* Header & Title */}
      <TournamentPageHeader
        eyebrow="Tournament Standings"
        title={tournament.name}
        subtitle={
          <p className="m-0 text-sm text-fg-muted">
            Final tournament standings and performance metrics across all tiers.
          </p>
        }
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search competitor, country, style..."
        isObsMode={isObsMode}
      />

      {/* Section Filter Pills */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setSelectedFilter('ALL')}
          className={cn(
            pillClass,
            selectedFilter === 'ALL' ? 'border-gold-bright bg-gold/15 font-bold text-gold-bright' : pillInactiveClass
          )}
        >
          <span>All Standings</span>
          <span className={cn(TABULAR, 'text-xs opacity-80')}>({tierCounts.ALL})</span>
        </button>

        {tournament.tiers.map(t => {
          const isSelected = selectedFilter === t.id;
          const tColor = t.primaryColor || THEME_FALLBACK.primaryColor;
          const count = tierCounts[t.id] || 0;
          return (
            <button
              key={t.id}
              onClick={() => setSelectedFilter(t.id)}
              className={cn(pillClass, 'gap-2', isSelected ? 'font-bold' : pillInactiveClass)}
              style={
                isSelected
                  ? {
                      borderColor: colorWithAlpha(tColor, 0.6, 'var(--color-gold)'),
                      background: colorWithAlpha(tColor, 0.18, 'var(--color-gold-soft)'),
                      color: tColor,
                    }
                  : undefined
              }
            >
              <span
                className="size-1.75 rounded-full"
                style={{
                  background: tColor,
                  boxShadow: isSelected ? `0 0 6px ${tColor}` : undefined,
                }}
              />
              <span>{t.name}</span>
              <span className={cn(TABULAR, 'text-xs opacity-80')}>({count})</span>
            </button>
          );
        })}

        {(tierCounts.DNQ || 0) > 0 && (
          <button
            onClick={() => setSelectedFilter('DNQ')}
            className={cn(
              pillClass,
              selectedFilter === 'DNQ' ? 'border-fg-secondary bg-slate-400/18 font-bold text-slate-100' : pillInactiveClass
            )}
          >
            <span>DNQ</span>
            <span className={cn(TABULAR, 'text-xs opacity-80')}>({tierCounts.DNQ})</span>
          </button>
        )}

        {(tierCounts.DQ || 0) > 0 && (
          <button
            onClick={() => setSelectedFilter('DQ')}
            className={cn(
              pillClass,
              selectedFilter === 'DQ' ? 'border-red bg-red/18 font-bold text-red-300' : pillInactiveClass
            )}
          >
            <span>Disqualified</span>
            <span className={cn(TABULAR, 'text-xs opacity-80')}>({tierCounts.DQ})</span>
          </button>
        )}
      </div>

      {/* Standings Table or Empty State */}
      {filteredRows.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-lg border border-line bg-surface py-14 px-8 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-elevated text-fg-muted">
            <Layers size={28} />
          </div>
          <h3 className="text-lg font-bold text-fg">
            {searchTerm ? 'No Competitors Matched Search' : 'Standings Awaiting Tournament Results'}
          </h3>
          <p className="max-w-110 text-sm leading-normal text-fg-muted">
            {searchTerm
              ? `No tournament participants match "${searchTerm}". Clear search or adjust filter.`
              : 'Standings will automatically calculate and update here as bracket matches are played and concluded.'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line bg-surface shadow-md">
          <table className="w-full min-w-237.5 border-collapse text-sm">
            <thead>
              <tr className="border-b-2 border-line bg-highlight">
                <th className={cn(thClass, 'w-21.25 text-center')}>Rank</th>
                <th className={cn(thClass, 'min-w-50')}>Competitor</th>
                <th className={cn(thClass, 'w-32.5 text-center')}>Qual & Delta</th>
                <th className={cn(thClass, 'w-35 text-center')}>Stage Reached</th>
                <th className={cn(thClass, 'min-w-45')}>Exit Match / Loss Avg</th>
                <th className={cn(thClass, 'w-22.5 text-center')}>Match Rec</th>
                <th className={cn(thClass, 'w-22.5 text-center')}>Game Rec</th>
                <th className={cn(thClass, 'w-30 pr-5 text-right')}>Game Score Avg</th>
              </tr>
            </thead>
            <tbody>
              {sections.map(section => (
                <React.Fragment key={section.id}>
                  {/* Tier / Section Header Divider Row */}
                  <tr
                    className={cn(
                      'border-t-2 border-b border-t-black/75 border-b-black/65',
                      section.isDQ ? 'bg-red/12' : section.isDNQ && 'bg-slate-500/12'
                    )}
                    style={{
                      background:
                        section.isDQ || section.isDNQ
                          ? undefined
                          : colorWithAlpha(section.color, 0.1, 'rgba(245, 158, 11, 0.08)'),
                    }}
                  >
                    <td
                      colSpan={8}
                      className="py-2.5 px-4"
                      style={{ borderLeft: `4px solid ${section.color}` }}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          {section.isDQ ? (
                            <AlertTriangle size={17} className="text-red" />
                          ) : section.isDNQ ? (
                            <Minus size={17} className="text-fg-secondary" />
                          ) : (
                            <Flame size={17} color={section.color} />
                          )}
                          <span
                            className={cn('text-base font-extrabold', section.isDQ && 'text-red-300')}
                            style={{ color: section.isDQ ? undefined : section.color }}
                          >
                            {section.title}
                          </span>
                          {section.subtitle && (
                            <span className="text-caption text-fg-muted">
                              • {section.subtitle}
                            </span>
                          )}
                        </div>

                        <span className={cn(TABULAR, 'rounded-full bg-white/8 py-0.5 px-2 text-xs font-semibold text-fg-secondary')}>
                          {section.rows.length} {section.rows.length === 1 ? 'Competitor' : 'Competitors'}
                        </span>
                      </div>
                    </td>
                  </tr>

                  {/* Competitor Rows */}
                  {section.rows.map((row, idx) => {
                    const isOverallChamp = row.finalRank === 1;
                    const isTierChamp = !isOverallChamp && row.eliminationRound === 'Champion';
                    const tierColor = row.tier?.primaryColor || section.color || THEME_FALLBACK.primaryColor;

                    // Rank Delta formatting
                    const delta = row.rankDelta;
                    const isPositiveDelta = typeof delta === 'number' && delta > 0;
                    const isNegativeDelta = typeof delta === 'number' && delta < 0;

                    // Row background with tier cardColor and zebra striping
                    const baseCard = row.tier?.cardColor || 'var(--color-surface)';
                    let rowBg = idx % 2 === 0 ? baseCard : getAlternateShade(baseCard, 6);
                    if (row.isDisqualified) {
                      rowBg = 'rgba(239, 68, 68, 0.06)';
                    } else if (row.isDNQ) {
                      rowBg = idx % 2 === 0 ? 'var(--color-surface)' : 'var(--color-elevated)';
                    }

                    const champBadgeStyle = {
                      background: colorWithAlpha(tierColor, 0.18, 'rgba(255, 255, 255, 0.08)'),
                      color: tierColor,
                      border: `1px solid ${colorWithAlpha(tierColor, 0.4, 'rgba(255, 255, 255, 0.2)')}`,
                    };

                    return (
                      <tr
                        key={row.player.id}
                        className={cn(
                          'border-b border-l-4 transition-colors duration-150',
                          !row.tier && 'border-b-black/65 border-l-transparent'
                        )}
                        style={{
                          background: rowBg,
                          borderBottomColor: row.tier ? row.tier.secondaryColor || 'rgba(255, 255, 255, 0.08)' : undefined,
                          borderLeftColor: row.tier ? tierColor : undefined,
                        }}
                      >
                        {/* 1. Final Placement / Rank */}
                        <td className={cn(tdClass, 'text-center')}>
                          {row.isDisqualified ? (
                            <span className="inline-block rounded-sm bg-red/20 py-0.5 px-2 text-xs font-extrabold text-red-bright">
                              DQ
                            </span>
                          ) : (
                            <span
                              className={cn(
                                TABULAR,
                                'inline-flex size-6.5 items-center justify-center rounded-full text-caption font-bold',
                                !row.tier &&
                                  (typeof row.finalRank === 'number' && row.finalRank <= 3
                                    ? 'bg-gold-soft text-gold-bright'
                                    : 'bg-white/5 text-fg-secondary')
                              )}
                              style={
                                row.tier
                                  ? { background: tierColor, color: getContrastingTextColor(tierColor) }
                                  : undefined
                              }
                            >
                              {row.finalRank}
                            </span>
                          )}
                        </td>

                        {/* 2. Competitor Info */}
                        <td className={tdClass}>
                          <div className="flex flex-wrap items-center gap-2">
                            <PlayerAvatar
                              player={row.player}
                              // eslint-disable-next-line no-restricted-syntax -- runtime: PlayerAvatar applies style to its inner avatar element (className only reaches the wrapper), so a class cannot reproduce this size
                              style={{ fontSize: '1.25rem', lineHeight: 1 }}
                            />
                            <button
                              type="button"
                              onClick={() => handlePlayerClick(row.player.id, getEffectivePlayerName(row.player), row.player.country, row.player.playstyle)}
                              className="inline-flex cursor-pointer items-center border-0 bg-transparent p-0 text-left text-base font-bold text-white no-underline transition-colors duration-150 hover:text-(--name-hover) hover:underline"
                              style={{ '--name-hover': tierColor } as React.CSSProperties}
                              title="View player tournament profile"
                            >
                              {getEffectivePlayerName(row.player)}
                            </button>

                            {row.player.playstyle && (
                              <PlaystyleChip style={row.player.playstyle} size="md" />
                            )}

                            {isOverallChamp && (
                              <span className="inline-flex items-center gap-1 rounded-sm py-0.5 px-2 text-xs font-bold" style={{ ...champBadgeStyle }}>
                                <Trophy size={12} /> Champion
                              </span>
                            )}

                            {isTierChamp && (
                              <span className="inline-flex items-center gap-1 rounded-sm py-0.5 px-2 text-xs font-bold" style={{ ...champBadgeStyle }}>
                                <Trophy size={12} /> {row.tier?.name} Winner
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 3. Qual Seed & Rank Delta */}
                        <td className={cn(tdClass, 'text-center')}>
                          <div className="inline-flex flex-col items-center gap-1">
                            <div className="flex items-center gap-1.5">
                              <span className={cn(TABULAR, 'text-caption font-semibold text-fg-secondary')}>
                                {row.qualRank ? `Seed #${row.qualRank}` : '—'}
                              </span>

                              {/* Delta Badge */}
                              {typeof delta === 'number' && !row.isDNQ && !row.isDisqualified && (
                                <span
                                  title={`Qual Rank #${row.qualRank} → Final #${row.finalRank}`}
                                  className={cn(
                                    TABULAR,
                                    'inline-flex items-center gap-0.5 rounded-sm py-0.5 px-1.5 text-xs font-bold',
                                    isPositiveDelta
                                      ? 'bg-green/18 text-green-bright'
                                      : isNegativeDelta
                                      ? 'bg-rose-500/18 text-rose-400'
                                      : 'bg-white/8 text-fg-muted'
                                  )}
                                >
                                  {isPositiveDelta ? (
                                    <>
                                      <TrendingUp size={11} />
                                      <span>+{delta}</span>
                                    </>
                                  ) : isNegativeDelta ? (
                                    <>
                                      <TrendingDown size={11} />
                                      <span>{delta}</span>
                                    </>
                                  ) : (
                                    <>
                                      <Minus size={11} />
                                      <span>0</span>
                                    </>
                                  )}
                                </span>
                              )}
                            </div>

                            {row.qualScore !== undefined && (
                              <span
                                className={cn(TABULAR, 'text-xs', !row.tier && 'text-fg-muted')}
                                style={{ color: row.tier ? tierColor : undefined }}
                              >
                                {row.qualScore.toLocaleString()} pts
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 4. Stage Reached */}
                        <td className={cn(tdClass, 'text-center')}>
                          <span
                            className={cn(
                              'inline-block rounded-sm border py-1 px-2 text-xs font-bold',
                              !row.tier &&
                                (row.isDisqualified
                                  ? 'border-transparent bg-red/15 text-red-300'
                                  : 'border-transparent bg-white/6 text-fg-secondary')
                            )}
                            style={
                              row.tier
                                ? {
                                    background: colorWithAlpha(tierColor, 0.16, 'rgba(255, 255, 255, 0.06)'),
                                    color: tierColor,
                                    borderColor: colorWithAlpha(tierColor, 0.32, 'rgba(255, 255, 255, 0.1)'),
                                  }
                                : undefined
                            }
                          >
                            {row.eliminationRound || 'Participant'}
                          </span>
                        </td>

                        {/* 5. Exit Match Details / Tiebreaker Loss Avg */}
                        <td className={tdClass}>
                          {row.exitDetails ? (
                            <div className="flex flex-col gap-0.5">
                              <div className="flex items-center gap-1.5">
                                {isOverallChamp || isTierChamp ? (
                                  <span className="inline-flex items-center gap-1 text-caption font-bold" style={{ color: tierColor }}>
                                    <Trophy size={12} />
                                    {row.exitDetails.scoreDisplay}
                                  </span>
                                ) : (
                                  <span
                                    className={cn(TABULAR, 'font-bold', !row.tier && 'text-fg')}
                                    style={{ color: row.tier ? tierColor : undefined }}
                                  >
                                    {row.exitDetails.scoreDisplay}
                                  </span>
                                )}
                                <span className="text-caption text-fg-secondary">
                                  vs {row.exitDetails.opponentName || 'Opponent'}
                                </span>
                                {row.exitDetails.isForfeit && (
                                  <span className="rounded-sm bg-red/20 py-0 px-1.5 text-2xs font-semibold text-red-bright">
                                    Forfeit
                                  </span>
                                )}
                              </div>
                              <div className={cn(TABULAR, 'text-xs text-fg-muted')}>
                                Loss Avg:{' '}
                                <strong
                                  className={cn(!row.tier && 'text-fg-secondary')}
                                  style={{ color: row.tier ? tierColor : undefined }}
                                >
                                  {row.exitDetails.avgLossScore > 0 ? row.exitDetails.avgLossScore.toLocaleString() : '—'}
                                </strong>
                              </div>
                            </div>
                          ) : isOverallChamp ? (
                            <div className="inline-flex items-center gap-1 text-caption font-semibold" style={{ color: tierColor }}>
                              <Trophy size={13} /> Undefeated Champion
                            </div>
                          ) : isTierChamp ? (
                            <div className="inline-flex items-center gap-1 text-caption font-semibold" style={{ color: tierColor }}>
                              <Trophy size={13} /> Bracket Champion
                            </div>
                          ) : row.isDNQ ? (
                            <span className="text-caption text-fg-muted">
                              Did Not Qualify
                            </span>
                          ) : row.isDisqualified ? (
                            <span className="text-caption text-red-bright">
                              Disqualified
                            </span>
                          ) : (
                            <span className="text-caption text-fg-muted">
                              —
                            </span>
                          )}
                        </td>

                        {/* 6. Match Record */}
                        <td className={cn(tdClass, 'text-center')}>
                          <span
                            className={cn(
                              TABULAR,
                              'font-semibold',
                              row.stats.matchesPlayed > 0 ? 'text-fg' : 'text-fg-muted'
                            )}
                          >
                            {row.stats.matchRecordDisplay}
                          </span>
                        </td>

                        {/* 7. Game Record */}
                        <td className={cn(tdClass, 'text-center')}>
                          <span
                            className={cn(
                              TABULAR,
                              'font-semibold',
                              row.stats.gamesWon + row.stats.gamesLost > 0 ? 'text-fg' : 'text-fg-muted'
                            )}
                          >
                            {row.stats.gameRecordDisplay}
                          </span>
                        </td>

                        {/* 8. Overall Game Average */}
                        <td className={cn(tdClass, 'pr-5 text-right')}>
                          {row.stats.overallGameAvg > 0 ? (
                            <span
                              className={cn(TABULAR, 'text-base font-bold', !row.tier && 'text-gold-bright')}
                              style={{ color: row.tier ? tierColor : undefined }}
                            >
                              {row.stats.overallGameAvg.toLocaleString()}
                            </span>
                          ) : (
                            <span className="text-fg-muted">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedPlayerForDrawer && (
        <PlayerDetailDrawer
          isOpen={isDrawerOpen}
          onClose={() => {
            setIsDrawerOpen(false);
            setSelectedPlayerForDrawer(null);
          }}
          player={selectedPlayerForDrawer}
          tournament={tournament}
        />
      )}
    </div>
  );
};

