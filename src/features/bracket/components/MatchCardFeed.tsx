import React, { useState, useMemo, useEffect } from 'react';
import { Tournament, TournamentTier, PlayerProfile } from '../../tournament/types';
import { BracketMatch, isMatchPlayable, canonicalizeBracketRounds } from '../types';
import { MatchScoreDrawer } from './MatchScoreDrawer';
import { MatchTelemetryModal } from './MatchTelemetryModal';
import {
  colorWithAlpha,
  getDefaultTierColors,
  getAlternateShade,
  getContrastingTextColor,
} from '../colorUtils';
import { Clock, CheckCircle2, ChevronRight, Lock, Search } from 'lucide-react';
import { PlayerDetailDrawer } from '../../qualifiers/components/PlayerDetailDrawer';
import { PlayerAvatar } from '../../players/components/PlayerAvatar';
import { getEffectivePlayerName } from '../../players/playerNameUtils';
import { getInheritedRoundBestOf } from './OrganizerSheetMatrix';

interface MatchCardFeedProps {
  tournament: Tournament;
  tier: TournamentTier;
  canManage?: boolean;
}

export const MatchCardFeed: React.FC<MatchCardFeedProps> = ({
  tournament,
  tier,
  canManage = true,
}) => {
  const [selectedRoundKey, setSelectedRoundKey] = useState<string | 'ALL'>('ALL');
  const [selectedStage, setSelectedStage] = useState<'ALL' | 'WINNERS' | 'LOSERS' | 'GRAND_FINALS'>('ALL');
  const [activeMatch, setActiveMatch] = useState<BracketMatch | null>(null);
  const [selectedPlayerForDrawer, setSelectedPlayerForDrawer] = useState<PlayerProfile | null>(null);
  const [isPlayerDrawerOpen, setIsPlayerDrawerOpen] = useState(false);
  const [hoveredPlayerKey, setHoveredPlayerKey] = useState<string | null>(null);
  const [hoveredMatchId, setHoveredMatchId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Automatically reset filter state when switching tiers
  useEffect(() => {
    setSelectedStage('ALL');
    setSelectedRoundKey('ALL');
    setSearchTerm('');
    setActiveMatch(null);
  }, [tier.id]);

  // Tier color theming matching Master Sheet, Quals, and Standings
  const defaults = getDefaultTierColors(tier);
  const primaryColor = tier.primaryColor || defaults.primaryColor || '#f59e0b';
  const secondaryColor = tier.secondaryColor || defaults.secondaryColor || '#705b33';
  const cardColor = tier.cardColor || defaults.cardColor || '#161922';
  const lowerBracketColor = tier.lowerBracketColor || defaults.lowerBracketColor || '#c2410c';

  const rounds = useMemo(() => {
    if (tier.bracket?.rounds) {
      canonicalizeBracketRounds(tier.bracket.rounds);
    }
    return tier.bracket?.rounds || [];
  }, [tier.bracket?.rounds]);
  const isDoubleElim = tier.eliminationType === 'DOUBLE';

  const visibleRounds = useMemo(() => {
    if (!isDoubleElim || selectedStage === 'ALL') {
      return rounds;
    }
    return rounds.filter((r) => {
      const isWinner =
        (r.stage === 'WINNERS' ||
          r.roundIdentifier?.startsWith('W') ||
          r.roundIdentifier === 'AR' ||
          r.roundIdentifier?.startsWith('PRE_W') ||
          r.name?.toLowerCase().includes('winner')) &&
        r.roundIdentifier !== 'PO' &&
        r.stage !== 'LOSERS' &&
        r.stage !== 'GRAND_FINALS';

      const isLoser =
        r.stage === 'LOSERS' ||
        r.roundIdentifier?.startsWith('L') ||
        r.roundIdentifier?.startsWith('PRE_L') ||
        r.roundIdentifier === '2C' ||
        r.roundIdentifier === 'PO' ||
        r.name?.toLowerCase().includes('loser');

      const isFinals =
        r.stage === 'GRAND_FINALS' ||
        r.roundIdentifier?.startsWith('GF') ||
        r.phase === 'CHAMPIONSHIP' ||
        r.roundIdentifier?.startsWith('CHAMP') ||
        r.name?.toLowerCase() === 'finals' ||
        r.name?.toLowerCase() === 'grand finals';

      if (selectedStage === 'WINNERS') return isWinner;
      if (selectedStage === 'LOSERS') return isLoser;
      if (selectedStage === 'GRAND_FINALS') return isFinals;
      return true;
    });
  }, [rounds, isDoubleElim, selectedStage]);

  const getRoundKey = (round: (typeof visibleRounds)[0], idx: number) => {
    return `${round.stage || 'R'}_${round.roundIdentifier || round.roundNumber}_${idx}`;
  };

  const activeRoundKey = useMemo(() => {
    if (selectedRoundKey === 'ALL') return 'ALL';
    const exists = visibleRounds.some((r, idx) => getRoundKey(r, idx) === selectedRoundKey);
    return exists ? selectedRoundKey : 'ALL';
  }, [selectedRoundKey, visibleRounds]);

  const roundsToDisplay = useMemo(() => {
    if (activeRoundKey === 'ALL') {
      return visibleRounds;
    }
    const target = visibleRounds.find((r, idx) => getRoundKey(r, idx) === activeRoundKey);
    return target ? [target] : visibleRounds;
  }, [activeRoundKey, visibleRounds]);

  const getFilteredRoundMatches = (round: (typeof visibleRounds)[0]) => {
    const matches = round?.matches || [];
    const query = searchTerm.trim().toLowerCase();
    if (!query) return matches;
    return matches.filter((m) => {
      const p1Effective = getEffectivePlayerName(m.player1.player).toLowerCase();
      const p1Original = (m.player1.player?.name || '').toLowerCase();
      const p2Effective = getEffectivePlayerName(m.player2.player).toLowerCase();
      const p2Original = (m.player2.player?.name || '').toLowerCase();
      const matchNum = `#${m.matchNumber}`.toLowerCase();
      const numOnly = m.matchNumber.toString();
      return p1Effective.includes(query) || p1Original.includes(query) || p2Effective.includes(query) || p2Original.includes(query) || matchNum.includes(query) || numOnly === query;
    });
  };

  const totalFilteredMatchesCount = useMemo(() => {
    return roundsToDisplay.reduce((acc, r) => acc + getFilteredRoundMatches(r).length, 0);
  }, [roundsToDisplay, searchTerm]);

  const activeMatchRound = activeMatch
    ? rounds.find(r => r.matches.some(m => m.id === activeMatch.id))
    : null;
  const activeMatchRoundName = activeMatchRound?.name || 'Round';

  const handlePlayerClick = (pId: string, pName: string, country?: string) => {
    const profile = (tournament.playersPool || []).find(p => p.id === pId) || {
      id: pId,
      name: pName,
      country,
      personalBest: 0,
      playstyle: 'DAS',
    };
    setSelectedPlayerForDrawer(profile);
    setIsPlayerDrawerOpen(true);
  };

  return (
    <div
      style={{
        width: '100%',
        maxWidth: '480px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        boxSizing: 'border-box',
      }}
    >
      {/* Stage Filter Tabs (Winners / Losers / Grand Finals) for Double Elimination */}
      {isDoubleElim && (
        <div
          style={{
            display: 'flex',
            gap: '0.35rem',
            paddingBottom: '0.2rem',
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none',
          }}
        >
          {(['ALL', 'WINNERS', 'LOSERS', 'GRAND_FINALS'] as const).map((stage) => {
            const label = stage === 'ALL' ? 'All' : stage === 'WINNERS' ? 'Winners' : stage === 'LOSERS' ? 'Losers' : 'Finals';
            const isSelected = selectedStage === stage;
            const stageAccent = stage === 'LOSERS' ? lowerBracketColor : primaryColor;
            const contrast = getContrastingTextColor(stageAccent);
            return (
              <button
                key={stage}
                onClick={() => {
                  setSelectedStage(stage);
                  setSelectedRoundKey('ALL');
                }}
                style={{
                  fontSize: '0.72rem',
                  fontWeight: isSelected ? 800 : 600,
                  padding: '0.3rem 0.65rem',
                  borderRadius: 'var(--radius-full)',
                  border: isSelected ? `1px solid ${stageAccent}` : `1px solid ${colorWithAlpha(secondaryColor, 0.4, 'var(--color-border)')}`,
                  background: isSelected ? stageAccent : getAlternateShade(cardColor, 6),
                  color: isSelected ? contrast : 'var(--color-text-secondary)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.12s ease',
                  flexShrink: 0,
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}

      {/* Round Selector Bar */}
      <div
        style={{
          overflowX: 'auto',
          display: 'flex',
          gap: '0.4rem',
          paddingBottom: '0.2rem',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
        }}
      >
        <button
          key="ALL_ROUNDS"
          onClick={() => setSelectedRoundKey('ALL')}
          style={{
            padding: '0.35rem 0.75rem',
            fontSize: '0.76rem',
            fontWeight: activeRoundKey === 'ALL' ? 800 : 600,
            borderRadius: 'var(--radius-full)',
            border: activeRoundKey === 'ALL' ? `1px solid ${primaryColor}` : `1px solid ${colorWithAlpha(secondaryColor, 0.4, 'var(--color-border)')}`,
            background: activeRoundKey === 'ALL' ? primaryColor : getAlternateShade(cardColor, 6),
            color: activeRoundKey === 'ALL' ? getContrastingTextColor(primaryColor) : 'var(--color-text-secondary)',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            transition: 'all 0.12s ease',
            flexShrink: 0,
            boxShadow: activeRoundKey === 'ALL' ? `0 0 8px ${colorWithAlpha(primaryColor, 0.35)}` : 'none',
          }}
        >
          All Rounds
        </button>
        {visibleRounds.map((round, idx) => {
          const rKey = getRoundKey(round, idx);
          const isSelected = activeRoundKey === rKey;
          const isRoundLoser = round.stage === 'LOSERS' || Boolean(round.name?.toLowerCase().includes('loser'));
          const rColor = isRoundLoser ? lowerBracketColor : primaryColor;
          const contrast = getContrastingTextColor(rColor);
          return (
            <button
              key={rKey}
              onClick={() => setSelectedRoundKey(isSelected ? 'ALL' : rKey)}
              style={{
                padding: '0.35rem 0.75rem',
                fontSize: '0.76rem',
                fontWeight: isSelected ? 800 : 600,
                borderRadius: 'var(--radius-full)',
                border: isSelected ? `1px solid ${rColor}` : `1px solid ${colorWithAlpha(secondaryColor, 0.4, 'var(--color-border)')}`,
                background: isSelected ? rColor : getAlternateShade(cardColor, 6),
                color: isSelected ? contrast : 'var(--color-text-secondary)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.12s ease',
                flexShrink: 0,
                boxShadow: isSelected ? `0 0 8px ${colorWithAlpha(rColor, 0.35)}` : 'none',
              }}
            >
              {round.name}
            </button>
          );
        })}
      </div>

      {/* Search & Round Context Bar */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {/* Compact Quick Search */}
        <div style={{ position: 'relative', width: '100%' }}>
          <Search
            size={13}
            style={{
              position: 'absolute',
              left: '0.65rem',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--color-text-muted)',
            }}
          />
          <input
            type="text"
            placeholder="Search match # or player..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '0.35rem 0.6rem 0.35rem 1.85rem',
              fontSize: '0.78rem',
              borderRadius: 'var(--radius-sm)',
              border: `1px solid ${colorWithAlpha(secondaryColor, 0.45, 'var(--color-border)')}`,
              background: getAlternateShade(cardColor, 4),
              color: 'var(--color-text-primary)',
              boxSizing: 'border-box',
            }}
          />
        </div>
      </div>

      {/* Matches Feed */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {totalFilteredMatchesCount === 0 ? (
          <div
            style={{
              padding: '2rem 1rem',
              textAlign: 'center',
              color: 'var(--color-text-muted)',
              background: cardColor,
              borderRadius: 'var(--radius-md)',
              border: `1px solid ${colorWithAlpha(secondaryColor, 0.35, 'var(--color-border)')}`,
              fontSize: '0.82rem',
            }}
          >
            {searchTerm ? `No matches found matching "${searchTerm}".` : 'No matches available.'}
          </div>
        ) : (
          roundsToDisplay.map((round, rIdx) => {
            const roundMatches = getFilteredRoundMatches(round);
            if (roundMatches.length === 0) return null;

            const isRoundLoser = round.stage === 'LOSERS' || Boolean(round.name?.toLowerCase().includes('loser'));
            const roundAccentColor = isRoundLoser ? lowerBracketColor : primaryColor;
            const inheritedBestOf = getInheritedRoundBestOf(round, tier);
            const roundCompletedCount = round.matches.filter((m) => {
              const rec = tournament.matchScores[m.id];
              return Boolean(m.winnerId || rec?.isComplete);
            }).length;

            return (
              <div
                key={getRoundKey(round, rIdx)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.65rem',
                }}
              >
                {/* Round Summary Heading Banner with Left Accent Border */}
                <div
                  style={{
                    padding: '0.45rem 0.75rem',
                    background: getAlternateShade(cardColor, 3),
                    borderRadius: 'var(--radius-md)',
                    border: `1px solid ${colorWithAlpha(secondaryColor, 0.45, 'var(--color-border)')}`,
                    borderLeft: `4px solid ${roundAccentColor}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.5rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span
                      style={{
                        fontWeight: 800,
                        fontSize: '0.82rem',
                        color: 'var(--color-text-primary)',
                        letterSpacing: '0.03em',
                        textTransform: 'uppercase',
                      }}
                    >
                      {round.name}
                    </span>
                    <span
                      style={{
                        fontSize: '0.68rem',
                        padding: '0.08rem 0.38rem',
                        borderRadius: 'var(--radius-sm)',
                        background: 'rgba(255, 255, 255, 0.06)',
                        border: '1px solid var(--color-border)',
                        color: 'var(--color-text-secondary)',
                        fontWeight: 600,
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      Best of {inheritedBestOf}
                    </span>
                  </div>
                  <span
                    className="tabular-nums"
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      padding: '0.1rem 0.45rem',
                      borderRadius: 'var(--radius-full)',
                      background: 'rgba(255, 255, 255, 0.06)',
                      color: 'var(--color-text-secondary)',
                      border: '1px solid var(--color-border)',
                    }}
                  >
                    {roundCompletedCount} / {round.matches.length} Done
                  </span>
                </div>

                {/* Matches in Round */}
                {roundMatches.map((match) => {
            const record = tournament.matchScores[match.id];
            const p1 = match.player1.player;
            const p2 = match.player2.player;

            const getSlotPlaceholder = (slot: typeof match.player1, fallbackNumber: number) => {
              if (!slot.sourceMatchId) return 'TBD';
              const src = tier.bracket.matchesById[slot.sourceMatchId];
              if (!src) return 'TBD';
              const isLoserDrop = match.stage === 'LOSERS' && src.stage === 'WINNERS';
              return `${isLoserDrop ? 'Loser' : 'Winner'} #${src.matchNumber || fallbackNumber}`;
            };

            const p1Name = getEffectivePlayerName(p1) || getSlotPlaceholder(match.player1, 1);
            const p2Name = getEffectivePlayerName(p2) || getSlotPlaceholder(match.player2, 2);

            const p1Wins = record?.player1Wins || 0;
            const p2Wins = record?.player2Wins || 0;
            const matchBestOf = record?.bestOf || match.bestOf || tier.bestOf || 5;
            const hasTieGame = Boolean(record?.games?.some(g => g.winnerPlayerId === 'TIE' || (g.player1Points !== null && g.player1Points === g.player2Points && g.player1Points > 0)));
            const hasTiebreaker = Boolean(record?.hasTiebreaker || hasTieGame || (record?.games && record.games.length > matchBestOf));
            const p1ScoreDisplay = hasTiebreaker ? `${p1Wins} (t)` : `${p1Wins}`;
            const p2ScoreDisplay = hasTiebreaker ? `${p2Wins} (t)` : `${p2Wins}`;

            const isPlayable = isMatchPlayable(match);
            const isComplete = Boolean((p1?.id && match.winnerId === p1.id) || (p2?.id && match.winnerId === p2.id) || record?.isComplete);
            const inProgress = !isComplete && (p1Wins > 0 || p2Wins > 0);
            const p1Won = Boolean(p1?.id && (match.winnerId === p1.id || record?.winnerPlayerId === p1.id));
            const p2Won = Boolean(p2?.id && (match.winnerId === p2.id || record?.winnerPlayerId === p2.id));
            const isMatchCardHovered = hoveredMatchId === match.id;

            const isLoserMatch =
              match.stage === 'LOSERS' ||
              isRoundLoser;
            const matchAccentColor = isLoserMatch ? lowerBracketColor : primaryColor;

            return (
              <div
                key={match.id}
                onClick={() => {
                  if (tournament.isLocked && isPlayable) {
                    setActiveMatch(match);
                  }
                }}
                onMouseEnter={() => setHoveredMatchId(match.id)}
                onMouseLeave={() => setHoveredMatchId(null)}
                style={{
                  background: isMatchCardHovered
                    ? getAlternateShade(cardColor, 8)
                    : cardColor,
                  borderRadius: 'var(--radius-md)',
                  border: inProgress
                    ? `2px solid ${primaryColor}`
                    : isMatchCardHovered
                    ? `1px solid ${colorWithAlpha(primaryColor, 0.6, 'var(--color-gold)')}`
                    : isComplete
                    ? `1px solid ${colorWithAlpha(secondaryColor, 0.4, 'var(--color-border)')}`
                    : `1px solid ${colorWithAlpha(secondaryColor, 0.25, 'var(--color-border-subtle)')}`,
                  boxShadow: inProgress
                    ? `0 0 12px ${colorWithAlpha(primaryColor, 0.3, 'rgba(245, 158, 11, 0.25)')}`
                    : isMatchCardHovered
                    ? 'var(--shadow-md)'
                    : 'var(--shadow-sm)',
                  padding: '0.75rem',
                  cursor: tournament.isLocked && isPlayable ? 'pointer' : 'default',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.55rem',
                  opacity: isPlayable ? 1 : 0.65,
                  transition: 'all 0.12s ease',
                  boxSizing: 'border-box',
                }}
              >
                {/* Card Top: Match # badge on left, status on right (Round name removed per user request) */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    <span
                      style={{
                        fontSize: '0.74rem',
                        fontWeight: 800,
                        fontFamily: 'var(--font-mono)',
                        padding: '0.15rem 0.5rem',
                        borderRadius: 'var(--radius-sm)',
                        background: colorWithAlpha(matchAccentColor, 0.15, 'rgba(255, 255, 255, 0.08)'),
                        color: matchAccentColor,
                        border: `1px solid ${colorWithAlpha(matchAccentColor, 0.35, 'transparent')}`,
                      }}
                    >
                      Match #{match.matchNumber}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    {!tournament.isLocked ? (
                      <span
                        style={{
                          fontSize: '0.68rem',
                          fontWeight: 600,
                          padding: '0.12rem 0.45rem',
                          borderRadius: 'var(--radius-sm)',
                          background: 'rgba(255, 255, 255, 0.06)',
                          color: 'var(--color-text-muted)',
                          border: '1px solid var(--color-border)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                        }}
                        title="Scores locked during Qualifiers Mode"
                      >
                        <Lock size={11} /> Qualifiers
                      </span>
                    ) : isComplete ? (
                      <span
                        style={{
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          padding: '0.12rem 0.45rem',
                          borderRadius: 'var(--radius-sm)',
                          background: 'rgba(34, 197, 94, 0.15)',
                          color: '#4ade80',
                          border: '1px solid rgba(34, 197, 94, 0.35)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                        }}
                      >
                        <CheckCircle2 size={11} /> Complete
                      </span>
                    ) : inProgress ? (
                      <span
                        style={{
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          padding: '0.12rem 0.45rem',
                          borderRadius: 'var(--radius-sm)',
                          background: colorWithAlpha(primaryColor, 0.15, 'rgba(245, 158, 11, 0.1)'),
                          color: primaryColor,
                          border: `1px solid ${colorWithAlpha(primaryColor, 0.4, 'rgba(245, 158, 11, 0.3)')}`,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                        }}
                        className="animate-pulse-border"
                      >
                        <Clock size={11} /> Live (Bo{matchBestOf})
                      </span>
                    ) : (
                      <span
                        style={{
                          fontSize: '0.68rem',
                          fontWeight: 600,
                          padding: '0.12rem 0.45rem',
                          borderRadius: 'var(--radius-sm)',
                          background: 'rgba(255, 255, 255, 0.05)',
                          color: 'var(--color-text-muted)',
                          border: '1px solid var(--color-border)',
                        }}
                      >
                        Ready
                      </span>
                    )}
                    {tournament.isLocked && isPlayable && (
                      <ChevronRight size={15} color="var(--color-text-muted)" style={{ opacity: 0.6 }} />
                    )}
                  </div>
                </div>

                {/* Matchup Rows */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  {/* Player 1 Row */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '0.5rem 0.65rem',
                      borderRadius: 'var(--radius-sm)',
                      background: p1Won
                        ? colorWithAlpha(primaryColor, 0.18, 'rgba(255, 255, 255, 0.08)')
                        : getAlternateShade(cardColor, 6),
                      border: p1Won
                        ? `1px solid ${colorWithAlpha(primaryColor, 0.45, 'transparent')}`
                        : `1px solid ${colorWithAlpha(secondaryColor, 0.18, 'rgba(255, 255, 255, 0.04)')}`,
                      transition: 'all 0.12s ease',
                    }}
                  >
                    <div
                      onClick={(e) => {
                        if (p1?.id) {
                          e.stopPropagation();
                          handlePlayerClick(p1.id, p1.name, p1.country);
                        }
                      }}
                      onMouseEnter={() => p1?.id && setHoveredPlayerKey(`p1-${match.id}`)}
                      onMouseLeave={() => setHoveredPlayerKey(null)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        padding: '0.1rem 0.35rem',
                        borderRadius: 'var(--radius-sm)',
                        background: hoveredPlayerKey === `p1-${match.id}` ? colorWithAlpha(primaryColor, 0.15) : 'transparent',
                        boxShadow: hoveredPlayerKey === `p1-${match.id}` ? `0 0 0 1px ${primaryColor}` : 'none',
                        cursor: p1?.id ? 'pointer' : 'inherit',
                        transition: 'all 0.12s ease',
                        maxWidth: 'calc(100% - 50px)',
                        minWidth: 0,
                      }}
                      title={p1?.id ? "View competitor tournament profile" : undefined}
                    >
                      {(p1?.country || (p1 as any)?.avatarUrl) && (
                        <PlayerAvatar player={p1 as any} country={p1?.country} style={{ opacity: isComplete && p2Won ? 0.45 : 1 }} />
                      )}
                      {p1?.seed && (
                        <span
                          style={{
                            fontSize: '0.65rem',
                            padding: '0.06rem 0.28rem',
                            borderRadius: 'var(--radius-sm)',
                            background: p1Won
                              ? colorWithAlpha(primaryColor, 0.15, 'rgba(255, 255, 255, 0.08)')
                              : colorWithAlpha(matchAccentColor, 0.12, 'rgba(255, 255, 255, 0.08)'),
                            color: p1Won ? primaryColor : matchAccentColor,
                            border: p1Won
                              ? `1px solid ${colorWithAlpha(primaryColor, 0.4, 'rgba(255, 255, 255, 0.15)')}`
                              : `1px solid ${colorWithAlpha(matchAccentColor, 0.25, 'rgba(255, 255, 255, 0.1)')}`,
                            fontFamily: 'var(--font-mono)',
                            fontWeight: 700,
                            lineHeight: 1.1,
                            flexShrink: 0,
                            opacity: isComplete && p2Won ? 0.45 : 1,
                          }}
                        >
                          #{p1.seed}
                        </span>
                      )}
                      {match.player1.isManualOverride && (
                        <span
                          style={{
                            fontSize: '0.58rem',
                            fontWeight: 700,
                            letterSpacing: '0.04em',
                            padding: '0.05rem 0.25rem',
                            borderRadius: 'var(--radius-sm)',
                            background: 'rgba(245, 158, 11, 0.18)',
                            color: '#fbbf24',
                            border: '1px solid rgba(245, 158, 11, 0.4)',
                            textTransform: 'uppercase',
                            lineHeight: 1.1,
                            flexShrink: 0,
                          }}
                          title="Position manually placed by tournament organizer"
                        >
                          OVERRIDE
                        </span>
                      )}
                      <span
                        style={{
                          fontWeight: isComplete ? (p1Won ? 800 : 400) : (p1Wins > p2Wins ? 700 : 500),
                          fontSize: '0.85rem',
                          color: hoveredPlayerKey === `p1-${match.id}`
                            ? primaryColor
                            : p1Won
                            ? primaryColor
                            : 'var(--color-text-primary)',
                          opacity: hoveredPlayerKey === `p1-${match.id}` ? 1 : isComplete && p2Won ? 0.45 : 1,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {p1Name}
                      </span>
                    </div>

                    <span
                      className="tabular-nums"
                      style={{
                        fontSize: '1.15rem',
                        fontWeight: p1Won ? 800 : 600,
                        padding: '0.1rem 0.5rem',
                        borderRadius: 'var(--radius-sm)',
                        background: p1Won
                          ? colorWithAlpha(primaryColor, 0.22, 'rgba(255, 255, 255, 0.08)')
                          : 'transparent',
                        color: p1Won ? primaryColor : 'var(--color-text-primary)',
                        opacity: isComplete && p2Won ? 0.45 : 1,
                        border: p1Won
                          ? `1px solid ${colorWithAlpha(primaryColor, 0.55, 'transparent')}`
                          : '1px solid transparent',
                        lineHeight: 1.2,
                        flexShrink: 0,
                      }}
                    >
                      {p1ScoreDisplay}
                    </span>
                  </div>

                  {/* Player 2 Row */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '0.5rem 0.65rem',
                      borderRadius: 'var(--radius-sm)',
                      background: p2Won
                        ? colorWithAlpha(primaryColor, 0.18, 'rgba(255, 255, 255, 0.08)')
                        : getAlternateShade(cardColor, 6),
                      border: p2Won
                        ? `1px solid ${colorWithAlpha(primaryColor, 0.45, 'transparent')}`
                        : `1px solid ${colorWithAlpha(secondaryColor, 0.18, 'rgba(255, 255, 255, 0.04)')}`,
                      transition: 'all 0.12s ease',
                    }}
                  >
                    <div
                      onClick={(e) => {
                        if (p2?.id) {
                          e.stopPropagation();
                          handlePlayerClick(p2.id, p2.name, p2.country);
                        }
                      }}
                      onMouseEnter={() => p2?.id && setHoveredPlayerKey(`p2-${match.id}`)}
                      onMouseLeave={() => setHoveredPlayerKey(null)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        padding: '0.1rem 0.35rem',
                        borderRadius: 'var(--radius-sm)',
                        background: hoveredPlayerKey === `p2-${match.id}` ? colorWithAlpha(primaryColor, 0.15) : 'transparent',
                        boxShadow: hoveredPlayerKey === `p2-${match.id}` ? `0 0 0 1px ${primaryColor}` : 'none',
                        cursor: p2?.id ? 'pointer' : 'inherit',
                        transition: 'all 0.12s ease',
                        maxWidth: 'calc(100% - 50px)',
                        minWidth: 0,
                      }}
                      title={p2?.id ? "View competitor tournament profile" : undefined}
                    >
                      {(p2?.country || (p2 as any)?.avatarUrl) && (
                        <PlayerAvatar player={p2 as any} country={p2?.country} style={{ opacity: isComplete && p1Won ? 0.45 : 1 }} />
                      )}
                      {p2?.seed && (
                        <span
                          style={{
                            fontSize: '0.65rem',
                            padding: '0.06rem 0.28rem',
                            borderRadius: 'var(--radius-sm)',
                            background: p2Won
                              ? colorWithAlpha(primaryColor, 0.15, 'rgba(255, 255, 255, 0.08)')
                              : colorWithAlpha(matchAccentColor, 0.12, 'rgba(255, 255, 255, 0.08)'),
                            color: p2Won ? primaryColor : matchAccentColor,
                            border: p2Won
                              ? `1px solid ${colorWithAlpha(primaryColor, 0.4, 'rgba(255, 255, 255, 0.15)')}`
                              : `1px solid ${colorWithAlpha(matchAccentColor, 0.25, 'rgba(255, 255, 255, 0.1)')}`,
                            fontFamily: 'var(--font-mono)',
                            fontWeight: 700,
                            lineHeight: 1.1,
                            flexShrink: 0,
                            opacity: isComplete && p1Won ? 0.45 : 1,
                          }}
                        >
                          #{p2.seed}
                        </span>
                      )}
                      {match.player2.isManualOverride && (
                        <span
                          style={{
                            fontSize: '0.58rem',
                            fontWeight: 700,
                            letterSpacing: '0.04em',
                            padding: '0.05rem 0.25rem',
                            borderRadius: 'var(--radius-sm)',
                            background: 'rgba(245, 158, 11, 0.18)',
                            color: '#fbbf24',
                            border: '1px solid rgba(245, 158, 11, 0.4)',
                            textTransform: 'uppercase',
                            lineHeight: 1.1,
                            flexShrink: 0,
                          }}
                          title="Position manually placed by tournament organizer"
                        >
                          OVERRIDE
                        </span>
                      )}
                      <span
                        style={{
                          fontWeight: isComplete ? (p2Won ? 800 : 400) : (p2Wins > p1Wins ? 700 : 500),
                          fontSize: '0.85rem',
                          color: hoveredPlayerKey === `p2-${match.id}`
                            ? primaryColor
                            : p2Won
                            ? primaryColor
                            : 'var(--color-text-primary)',
                          opacity: hoveredPlayerKey === `p2-${match.id}` ? 1 : isComplete && p1Won ? 0.45 : 1,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {p2Name}
                      </span>
                    </div>

                    <span
                      className="tabular-nums"
                      style={{
                        fontSize: '1.15rem',
                        fontWeight: p2Won ? 800 : 600,
                        padding: '0.1rem 0.5rem',
                        borderRadius: 'var(--radius-sm)',
                        background: p2Won
                          ? colorWithAlpha(primaryColor, 0.22, 'rgba(255, 255, 255, 0.08)')
                          : 'transparent',
                        color: p2Won ? primaryColor : 'var(--color-text-primary)',
                        opacity: isComplete && p1Won ? 0.45 : 1,
                        border: p2Won
                          ? `1px solid ${colorWithAlpha(primaryColor, 0.55, 'transparent')}`
                          : '1px solid transparent',
                        lineHeight: 1.2,
                        flexShrink: 0,
                      }}
                    >
                      {p2ScoreDisplay}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      );
    })
  )}
</div>

      {/* Slide-out Scorekeeper Drawer (when canManage === true) */}
      {activeMatch && canManage && (
        <MatchScoreDrawer
          isOpen={true}
          onClose={() => setActiveMatch(null)}
          tournamentId={tournament.id}
          tierId={tier.id}
          match={activeMatch}
          matchScoreRecord={tournament.matchScores[activeMatch.id]}
          roundName={activeMatchRoundName}
        />
      )}

      {/* Read-Only Match Telemetry Modal (when canManage === false) */}
      {activeMatch && !canManage && (
        <MatchTelemetryModal
          isOpen={true}
          onClose={() => setActiveMatch(null)}
          tournament={tournament}
          tier={tier}
          match={activeMatch}
          matchScoreRecord={tournament.matchScores[activeMatch.id]}
          roundName={activeMatchRoundName}
          onSelectPlayer={(pId, pName, country) => {
            setActiveMatch(null);
            handlePlayerClick(pId, pName, country);
          }}
        />
      )}

      {/* Slide-out Player Detail Profile Drawer */}
      {selectedPlayerForDrawer && (
        <PlayerDetailDrawer
          isOpen={isPlayerDrawerOpen}
          onClose={() => {
            setIsPlayerDrawerOpen(false);
            setSelectedPlayerForDrawer(null);
          }}
          player={selectedPlayerForDrawer}
          tournament={tournament}
          tier={tier}
        />
      )}
    </div>
  );
};
