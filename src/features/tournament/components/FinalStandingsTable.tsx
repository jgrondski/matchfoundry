import React, { useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Tournament, TournamentTier, PlayerProfile, Playstyle } from '../types';
import { calculateGlobalStandings, GlobalStandingRow } from '../standings';
import { colorWithAlpha, getContrastingTextColor, getAlternateShade } from '../../bracket/colorUtils';
import { PlayerDetailDrawer } from '../../qualifiers/components/PlayerDetailDrawer';
import { PlayerAvatar } from '../../players/components/PlayerAvatar';
import { PlaystyleChip } from '../../players/components/PlaystyleChip';
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
        const nameMatch = row.player.name.toLowerCase().includes(query);
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
          color: '#64748b',
          isDNQ: true,
          rows: filteredRows,
        }];
      }
      if (selectedFilter === 'DQ') {
        return [{
          id: 'dq',
          title: 'Disqualified (DQ)',
          subtitle: 'Disqualified competitors removed from official placement',
          color: '#ef4444',
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
        color: tier?.primaryColor || '#f59e0b',
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
          color: tier.primaryColor || '#f59e0b',
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
        color: '#64748b',
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
        color: '#ef4444',
        isDQ: true,
        rows: dqRows,
      });
    }

    return grouped;
  }, [selectedFilter, filteredRows, tournament.tiers]);

  // Until brackets are configured and finalized into match play, render informative empty state
  if (tournament.tiers.length === 0) {
    return (
      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', width: '100%' }}>
        <h2 style={{ color: 'var(--color-text-primary)', fontSize: '1.4rem' }}>No Bracket Tiers Configured</h2>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem', lineHeight: 1.5 }}>
          This tournament does not have any bracket tiers yet. Qualifiers can be entered and ranked on the leaderboard, or you can create bracket tiers in Settings.
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button onClick={() => navigate(`/${tournament.slug}/leaderboard`)} className="btn btn-secondary">
            🏆 View Qualifiers
          </button>
          <button onClick={() => navigate(`/${tournament.slug}/manage/settings`)} className="btn btn-primary">
            ⚙️ Configure Tiers in Settings
          </button>
        </div>
      </div>
    );
  }

  const location = useLocation();
  const isManage = location.pathname.includes('/manage');
  const defaultTierSlug = tournament.tiers[0]?.slug;

  if (!tournament.isLocked) {
    return (
      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', width: '100%' }}>
        <TournamentQualTimerHud tournament={tournament} isObsMode={isObsMode} />
        <h2 style={{ color: 'var(--color-text-primary)', fontSize: '1.4rem' }}>Brackets Not Finalized</h2>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem', lineHeight: 1.5 }}>
          Qualifiers are currently running and tournament brackets have not been locked into match play. Final standings will become available once qualifiers conclude and brackets are finalized.
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button
            onClick={() => navigate(isManage ? `/${tournament.slug}/manage/qualifiers` : `/${tournament.slug}/leaderboard`)}
            className="btn btn-secondary"
          >
            🏆 View Qualifiers
          </button>
          {defaultTierSlug && (
            <button
              onClick={() => navigate(isManage ? `/${tournament.slug}/manage/bracket/${defaultTierSlug}` : `/${tournament.slug}/${defaultTierSlug}`)}
              className="btn btn-secondary"
            >
              🌲 Visual Bracket
            </button>
          )}
          <button onClick={() => navigate(`/${tournament.slug}/manage/settings`)} className="btn btn-primary">
            ⚙️ Finalize in Settings
          </button>
        </div>
      </div>
    );
  }

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
      {/* Header & Title */}
      <TournamentPageHeader
        eyebrow="Tournament Standings"
        title={tournament.name}
        subtitle={
          <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', margin: 0 }}>
            Final tournament standings and performance metrics across all tiers.
          </p>
        }
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search competitor, country, style..."
        isObsMode={isObsMode}
      />

      {/* Section Filter Pills */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button
          onClick={() => setSelectedFilter('ALL')}
          style={{
            padding: '0.4rem 0.9rem',
            borderRadius: 'var(--radius-full)',
            border: selectedFilter === 'ALL' ? '1px solid var(--color-gold-bright)' : '1px solid var(--color-border)',
            background: selectedFilter === 'ALL' ? 'rgba(245, 158, 11, 0.15)' : 'var(--color-bg-surface)',
            color: selectedFilter === 'ALL' ? 'var(--color-gold-bright)' : 'var(--color-text-secondary)',
            fontWeight: selectedFilter === 'ALL' ? 700 : 500,
            fontSize: '0.82rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            transition: 'all 0.15s ease',
          }}
        >
          <span>All Standings</span>
          <span style={{ fontSize: '0.75rem', opacity: 0.8 }} className="tabular-nums">({tierCounts.ALL})</span>
        </button>

        {tournament.tiers.map(t => {
          const isSelected = selectedFilter === t.id;
          const tColor = t.primaryColor || '#f59e0b';
          const count = tierCounts[t.id] || 0;
          return (
            <button
              key={t.id}
              onClick={() => setSelectedFilter(t.id)}
              style={{
                padding: '0.4rem 0.9rem',
                borderRadius: 'var(--radius-full)',
                border: isSelected ? `1px solid ${colorWithAlpha(tColor, 0.6, 'var(--color-gold)')}` : '1px solid var(--color-border)',
                background: isSelected ? colorWithAlpha(tColor, 0.18, 'var(--color-gold-bg)') : 'var(--color-bg-surface)',
                color: isSelected ? tColor : 'var(--color-text-secondary)',
                fontWeight: isSelected ? 700 : 500,
                fontSize: '0.82rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                transition: 'all 0.15s ease',
              }}
            >
              <span
                style={{
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  background: tColor,
                  boxShadow: isSelected ? `0 0 6px ${tColor}` : 'none',
                }}
              />
              <span>{t.name}</span>
              <span style={{ fontSize: '0.75rem', opacity: 0.8 }} className="tabular-nums">({count})</span>
            </button>
          );
        })}

        {(tierCounts.DNQ || 0) > 0 && (
          <button
            onClick={() => setSelectedFilter('DNQ')}
            style={{
              padding: '0.4rem 0.9rem',
              borderRadius: 'var(--radius-full)',
              border: selectedFilter === 'DNQ' ? '1px solid #94a3b8' : '1px solid var(--color-border)',
              background: selectedFilter === 'DNQ' ? 'rgba(148, 163, 184, 0.18)' : 'var(--color-bg-surface)',
              color: selectedFilter === 'DNQ' ? '#f1f5f9' : 'var(--color-text-secondary)',
              fontWeight: selectedFilter === 'DNQ' ? 700 : 500,
              fontSize: '0.82rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              transition: 'all 0.15s ease',
            }}
          >
            <span>DNQ</span>
            <span style={{ fontSize: '0.75rem', opacity: 0.8 }} className="tabular-nums">({tierCounts.DNQ})</span>
          </button>
        )}

        {(tierCounts.DQ || 0) > 0 && (
          <button
            onClick={() => setSelectedFilter('DQ')}
            style={{
              padding: '0.4rem 0.9rem',
              borderRadius: 'var(--radius-full)',
              border: selectedFilter === 'DQ' ? '1px solid #ef4444' : '1px solid var(--color-border)',
              background: selectedFilter === 'DQ' ? 'rgba(239, 68, 68, 0.18)' : 'var(--color-bg-surface)',
              color: selectedFilter === 'DQ' ? '#fca5a5' : 'var(--color-text-secondary)',
              fontWeight: selectedFilter === 'DQ' ? 700 : 500,
              fontSize: '0.82rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              transition: 'all 0.15s ease',
            }}
          >
            <span>Disqualified</span>
            <span style={{ fontSize: '0.75rem', opacity: 0.8 }} className="tabular-nums">({tierCounts.DQ})</span>
          </button>
        )}
      </div>

      {/* Standings Table or Empty State */}
      {filteredRows.length === 0 ? (
        <div
          style={{
            background: 'var(--color-bg-surface)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--color-border)',
            padding: '3.5rem 2rem',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1rem',
          }}
        >
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: 'var(--color-bg-surface-elevated)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-text-muted)',
            }}
          >
            <Layers size={28} />
          </div>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
            {searchTerm ? 'No Competitors Matched Search' : 'Standings Awaiting Tournament Results'}
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', maxWidth: '440px', lineHeight: 1.5 }}>
            {searchTerm
              ? `No tournament participants match "${searchTerm}". Clear search or adjust filter.`
              : 'Standings will automatically calculate and update here as bracket matches are played and concluded.'}
          </p>
        </div>
      ) : (
        <div
          style={{
            background: 'var(--color-bg-surface)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--color-border)',
            overflowX: 'auto',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', minWidth: '950px' }}>
            <thead>
              <tr style={{ background: 'var(--color-bg-surface-highlight)', borderBottom: '2px solid var(--color-border)' }}>
                <th style={{ ...thStyle, width: '85px', textAlign: 'center' }}>Rank</th>
                <th style={{ ...thStyle, minWidth: '200px' }}>Competitor</th>
                <th style={{ ...thStyle, width: '130px', textAlign: 'center' }}>Qual & Delta</th>
                <th style={{ ...thStyle, width: '140px', textAlign: 'center' }}>Stage Reached</th>
                <th style={{ ...thStyle, minWidth: '180px' }}>Exit Match / Loss Avg</th>
                <th style={{ ...thStyle, width: '90px', textAlign: 'center' }}>Match Rec</th>
                <th style={{ ...thStyle, width: '90px', textAlign: 'center' }}>Game Rec</th>
                <th style={{ ...thStyle, width: '120px', textAlign: 'right', paddingRight: '1.25rem' }}>Game Score Avg</th>
              </tr>
            </thead>
            <tbody>
              {sections.map(section => (
                <React.Fragment key={section.id}>
                  {/* Tier / Section Header Divider Row */}
                  <tr
                    style={{
                      background: section.isDQ
                        ? 'rgba(239, 68, 68, 0.12)'
                        : section.isDNQ
                        ? 'rgba(100, 116, 139, 0.12)'
                        : colorWithAlpha(section.color, 0.1, 'rgba(245, 158, 11, 0.08)'),
                      borderTop: '2px solid rgba(0, 0, 0, 0.75)',
                      borderBottom: '1px solid rgba(0, 0, 0, 0.65)',
                    }}
                  >
                    <td
                      colSpan={8}
                      style={{
                        padding: '0.65rem 1rem',
                        borderLeft: `4px solid ${section.color}`,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          {section.isDQ ? (
                            <AlertTriangle size={17} color="#ef4444" />
                          ) : section.isDNQ ? (
                            <Minus size={17} color="#94a3b8" />
                          ) : (
                            <Flame size={17} color={section.color} />
                          )}
                          <span style={{ fontWeight: 800, fontSize: '0.92rem', color: section.isDQ ? '#fca5a5' : section.color }}>
                            {section.title}
                          </span>
                          {section.subtitle && (
                            <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                              • {section.subtitle}
                            </span>
                          )}
                        </div>

                        <span
                          className="tabular-nums"
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            padding: '0.15rem 0.5rem',
                            borderRadius: 'var(--radius-full)',
                            background: 'rgba(255, 255, 255, 0.08)',
                            color: 'var(--color-text-secondary)',
                          }}
                        >
                          {section.rows.length} {section.rows.length === 1 ? 'Competitor' : 'Competitors'}
                        </span>
                      </div>
                    </td>
                  </tr>

                  {/* Competitor Rows */}
                  {section.rows.map((row, idx) => {
                    const isOverallChamp = row.finalRank === 1;
                    const isTierChamp = !isOverallChamp && row.eliminationRound === 'Champion';
                    const tierColor = row.tier?.primaryColor || section.color || '#f59e0b';

                    // Rank Delta formatting
                    const delta = row.rankDelta;
                    const isPositiveDelta = typeof delta === 'number' && delta > 0;
                    const isNegativeDelta = typeof delta === 'number' && delta < 0;

                    // Row background with tier cardColor and zebra striping
                    const baseCard = row.tier?.cardColor || 'var(--color-bg-surface)';
                    let rowBg = idx % 2 === 0 ? baseCard : getAlternateShade(baseCard, 6);
                    if (row.isDisqualified) {
                      rowBg = 'rgba(239, 68, 68, 0.06)';
                    } else if (row.isDNQ) {
                      rowBg = idx % 2 === 0 ? 'var(--color-bg-surface)' : 'var(--color-bg-surface-elevated)';
                    }

                    return (
                      <tr
                        key={row.player.id}
                        style={{
                          background: rowBg,
                          borderBottom: row.tier
                            ? `1px solid ${row.tier.secondaryColor || 'rgba(255, 255, 255, 0.08)'}`
                            : '1px solid rgba(0, 0, 0, 0.65)',
                          borderLeft: row.tier ? `4px solid ${tierColor}` : '4px solid transparent',
                          transition: 'background 0.15s ease',
                        }}
                      >
                        {/* 1. Final Placement / Rank */}
                        <td style={{ ...tdStyle, textAlign: 'center' }}>
                          {row.isDisqualified ? (
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '0.15rem 0.5rem',
                                borderRadius: 'var(--radius-sm)',
                                background: 'rgba(239, 68, 68, 0.2)',
                                color: '#f87171',
                                fontWeight: 800,
                                fontSize: '0.75rem',
                              }}
                            >
                              DQ
                            </span>
                          ) : (
                            <span
                              className="tabular-nums"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '26px',
                                height: '26px',
                                borderRadius: '50%',
                                background: row.tier
                                  ? tierColor
                                  : typeof row.finalRank === 'number' && row.finalRank <= 3
                                  ? 'var(--color-gold-bg)'
                                  : 'rgba(255,255,255,0.05)',
                                color: row.tier
                                  ? getContrastingTextColor(tierColor)
                                  : typeof row.finalRank === 'number' && row.finalRank <= 3
                                  ? 'var(--color-gold-bright)'
                                  : 'var(--color-text-secondary)',
                                fontSize: '0.8rem',
                                fontWeight: 700,
                              }}
                            >
                              {row.finalRank}
                            </span>
                          )}
                        </td>

                        {/* 2. Competitor Info */}
                        <td style={tdStyle}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flexWrap: 'wrap' }}>
                            <PlayerAvatar player={row.player} style={{ fontSize: '1.25rem', lineHeight: 1 }} />
                            <button
                              type="button"
                              onClick={() => handlePlayerClick(row.player.id, row.player.name, row.player.country, row.player.playstyle)}
                              style={{
                                background: 'none',
                                border: 'none',
                                padding: 0,
                                cursor: 'pointer',
                                textAlign: 'left',
                                fontWeight: 700,
                                color: '#ffffff',
                                fontSize: '1rem',
                                textDecoration: 'none',
                                display: 'inline-flex',
                                alignItems: 'center',
                                transition: 'color 0.15s ease',
                              }}
                              onMouseEnter={e => {
                                e.currentTarget.style.color = tierColor;
                                e.currentTarget.style.textDecoration = 'underline';
                              }}
                              onMouseLeave={e => {
                                e.currentTarget.style.color = '#ffffff';
                                e.currentTarget.style.textDecoration = 'none';
                              }}
                              title="View player tournament profile"
                            >
                              {row.player.name}
                            </button>

                            {row.player.playstyle && (
                              <PlaystyleChip style={row.player.playstyle} size="md" />
                            )}

                            {isOverallChamp && (
                              <span
                                style={{
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                  padding: '0.12rem 0.45rem',
                                  borderRadius: 'var(--radius-sm)',
                                  background: colorWithAlpha(tierColor, 0.18, 'rgba(255, 255, 255, 0.08)'),
                                  color: tierColor,
                                  border: `1px solid ${colorWithAlpha(tierColor, 0.4, 'rgba(255, 255, 255, 0.2)')}`,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.25rem',
                                }}
                              >
                                <Trophy size={12} /> Champion
                              </span>
                            )}

                            {isTierChamp && (
                              <span
                                style={{
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                  padding: '0.12rem 0.45rem',
                                  borderRadius: 'var(--radius-sm)',
                                  background: colorWithAlpha(tierColor, 0.18, 'rgba(255, 255, 255, 0.08)'),
                                  color: tierColor,
                                  border: `1px solid ${colorWithAlpha(tierColor, 0.4, 'rgba(255, 255, 255, 0.2)')}`,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.25rem',
                                }}
                              >
                                <Trophy size={12} /> {row.tier?.name} Winner
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 3. Qual Seed & Rank Delta */}
                        <td style={{ ...tdStyle, textAlign: 'center' }}>
                          <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                              <span className="tabular-nums" style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                                {row.qualRank ? `Seed #${row.qualRank}` : '—'}
                              </span>

                              {/* Delta Badge */}
                              {typeof delta === 'number' && !row.isDNQ && !row.isDisqualified && (
                                <span
                                  title={`Qual Rank #${row.qualRank} → Final #${row.finalRank}`}
                                  className="tabular-nums"
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.15rem',
                                    padding: '0.1rem 0.35rem',
                                    borderRadius: 'var(--radius-sm)',
                                    fontSize: '0.72rem',
                                    fontWeight: 700,
                                    background: isPositiveDelta
                                      ? 'rgba(16, 185, 129, 0.18)'
                                      : isNegativeDelta
                                      ? 'rgba(244, 63, 94, 0.18)'
                                      : 'rgba(255, 255, 255, 0.08)',
                                    color: isPositiveDelta
                                      ? '#34d399'
                                      : isNegativeDelta
                                      ? '#fb7185'
                                      : 'var(--color-text-muted)',
                                  }}
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
                              <span className="tabular-nums" style={{ fontSize: '0.72rem', color: row.tier ? tierColor : 'var(--color-text-muted)' }}>
                                {row.qualScore.toLocaleString()} pts
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 4. Stage Reached */}
                        <td style={{ ...tdStyle, textAlign: 'center' }}>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '0.2rem 0.55rem',
                              borderRadius: 'var(--radius-sm)',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              background: row.tier
                                ? colorWithAlpha(tierColor, 0.16, 'rgba(255, 255, 255, 0.06)')
                                : row.isDisqualified
                                ? 'rgba(239, 68, 68, 0.15)'
                                : 'rgba(255, 255, 255, 0.06)',
                              color: row.tier
                                ? tierColor
                                : row.isDisqualified
                                ? '#fca5a5'
                                : 'var(--color-text-secondary)',
                              border: row.tier
                                ? `1px solid ${colorWithAlpha(tierColor, 0.32, 'rgba(255, 255, 255, 0.1)')}`
                                : '1px solid transparent',
                            }}
                          >
                            {row.eliminationRound || 'Participant'}
                          </span>
                        </td>

                        {/* 5. Exit Match Details / Tiebreaker Loss Avg */}
                        <td style={tdStyle}>
                          {row.exitDetails ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                {isOverallChamp || isTierChamp ? (
                                  <span style={{ fontSize: '0.82rem', color: tierColor, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                    <Trophy size={12} />
                                    {row.exitDetails.scoreDisplay}
                                  </span>
                                ) : (
                                  <span className="tabular-nums" style={{ fontWeight: 700, color: row.tier ? tierColor : 'var(--color-text-primary)' }}>
                                    {row.exitDetails.scoreDisplay}
                                  </span>
                                )}
                                <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                                  vs {row.exitDetails.opponentName || 'Opponent'}
                                </span>
                                {row.exitDetails.isForfeit && (
                                  <span
                                    style={{
                                      fontSize: '0.68rem',
                                      padding: '0.05rem 0.35rem',
                                      borderRadius: 'var(--radius-sm)',
                                      background: 'rgba(239, 68, 68, 0.2)',
                                      color: '#f87171',
                                      fontWeight: 600,
                                    }}
                                  >
                                    Forfeit
                                  </span>
                                )}
                              </div>
                              <div className="tabular-nums" style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                                Loss Avg: <strong style={{ color: row.tier ? tierColor : 'var(--color-text-secondary)' }}>
                                  {row.exitDetails.avgLossScore > 0 ? row.exitDetails.avgLossScore.toLocaleString() : '—'}
                                </strong>
                              </div>
                            </div>
                          ) : isOverallChamp ? (
                            <div style={{ fontSize: '0.82rem', color: tierColor, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                              <Trophy size={13} /> Undefeated Champion
                            </div>
                          ) : isTierChamp ? (
                            <div style={{ fontSize: '0.82rem', color: tierColor, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                              <Trophy size={13} /> Bracket Champion
                            </div>
                          ) : row.isDNQ ? (
                            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                              Did Not Qualify
                            </span>
                          ) : row.isDisqualified ? (
                            <span style={{ fontSize: '0.8rem', color: '#f87171' }}>
                              Disqualified
                            </span>
                          ) : (
                            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                              —
                            </span>
                          )}
                        </td>

                        {/* 6. Match Record */}
                        <td style={{ ...tdStyle, textAlign: 'center' }}>
                          <span
                            className="tabular-nums"
                            style={{
                              fontWeight: 600,
                              color: row.stats.matchesPlayed > 0 ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                            }}
                          >
                            {row.stats.matchRecordDisplay}
                          </span>
                        </td>

                        {/* 7. Game Record */}
                        <td style={{ ...tdStyle, textAlign: 'center' }}>
                          <span
                            className="tabular-nums"
                            style={{
                              fontWeight: 600,
                              color: row.stats.gamesWon + row.stats.gamesLost > 0 ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                            }}
                          >
                            {row.stats.gameRecordDisplay}
                          </span>
                        </td>

                        {/* 8. Overall Game Average */}
                        <td style={{ ...tdStyle, textAlign: 'right', paddingRight: '1.25rem' }}>
                          {row.stats.overallGameAvg > 0 ? (
                            <span className="tabular-nums" style={{ fontWeight: 700, color: row.tier ? tierColor : 'var(--color-gold-bright)', fontSize: '0.95rem' }}>
                              {row.stats.overallGameAvg.toLocaleString()}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--color-text-muted)' }}>—</span>
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

const thStyle: React.CSSProperties = {
  padding: '0.55rem 0.75rem',
  color: 'var(--color-text-secondary)',
  fontWeight: 600,
  fontSize: '0.78rem',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};

const tdStyle: React.CSSProperties = {
  padding: '0.45rem 0.75rem',
};
