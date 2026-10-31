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
import { cn } from '../../../components/ui';

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
    <div className="w-full max-w-120 mx-auto flex flex-col gap-3">
      {/* Stage Filter Tabs (Winners / Losers / Grand Finals) for Double Elimination */}
      {isDoubleElim && (
        <div className="flex gap-1.5 pb-1 overflow-x-auto [-webkit-overflow-scrolling:touch] [scrollbar-width:none]">
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
                className={cn(
                  'text-xs py-1 px-2.5 rounded-full cursor-pointer whitespace-nowrap transition-all duration-100 shrink-0',
                  isSelected ? 'font-extrabold' : 'font-semibold'
                )}
                style={{
                  border: isSelected ? `1px solid ${stageAccent}` : `1px solid ${colorWithAlpha(secondaryColor, 0.4, 'var(--color-border)')}`,
                  background: isSelected ? stageAccent : getAlternateShade(cardColor, 6),
                  color: isSelected ? contrast : 'var(--color-text-secondary)',
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}

      {/* Round Selector Bar */}
      <div className="overflow-x-auto flex gap-1.5 pb-1 [-webkit-overflow-scrolling:touch] [scrollbar-width:none]">
        <button
          key="ALL_ROUNDS"
          onClick={() => setSelectedRoundKey('ALL')}
          className={cn(
            'py-1.5 px-3 text-xs rounded-full cursor-pointer whitespace-nowrap transition-all duration-100 shrink-0',
            activeRoundKey === 'ALL' ? 'font-extrabold' : 'font-semibold'
          )}
          style={{
            border: activeRoundKey === 'ALL' ? `1px solid ${primaryColor}` : `1px solid ${colorWithAlpha(secondaryColor, 0.4, 'var(--color-border)')}`,
            background: activeRoundKey === 'ALL' ? primaryColor : getAlternateShade(cardColor, 6),
            color: activeRoundKey === 'ALL' ? getContrastingTextColor(primaryColor) : 'var(--color-text-secondary)',
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
              className={cn(
                'py-1.5 px-3 text-xs rounded-full cursor-pointer whitespace-nowrap transition-all duration-100 shrink-0',
                isSelected ? 'font-extrabold' : 'font-semibold'
              )}
              style={{
                border: isSelected ? `1px solid ${rColor}` : `1px solid ${colorWithAlpha(secondaryColor, 0.4, 'var(--color-border)')}`,
                background: isSelected ? rColor : getAlternateShade(cardColor, 6),
                color: isSelected ? contrast : 'var(--color-text-secondary)',
                boxShadow: isSelected ? `0 0 8px ${colorWithAlpha(rColor, 0.35)}` : 'none',
              }}
            >
              {round.name}
            </button>
          );
        })}
      </div>

      {/* Search & Round Context Bar */}
      <div className="flex flex-col gap-2">
        {/* Compact Quick Search */}
        <div className="relative w-full">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-muted" />
          <input
            type="text"
            placeholder="Search match # or player..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full py-1.5 pr-2.5 pl-7.5 text-caption rounded-sm text-fg"
            style={{
              border: `1px solid ${colorWithAlpha(secondaryColor, 0.45, 'var(--color-border)')}`,
              background: getAlternateShade(cardColor, 4),
            }}
          />
        </div>
      </div>

      {/* Matches Feed */}
      <div className="flex flex-col gap-5">
        {totalFilteredMatchesCount === 0 ? (
          <div
            className="py-8 px-4 text-center text-fg-muted rounded-md text-caption"
            style={{
              background: cardColor,
              border: `1px solid ${colorWithAlpha(secondaryColor, 0.35, 'var(--color-border)')}`,
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
                className="flex flex-col gap-2.5"
              >
                {/* Round Summary Heading Banner with Left Accent Border */}
                <div
                  className="py-2 px-3 rounded-md flex items-center justify-between gap-2"
                  style={{
                    background: getAlternateShade(cardColor, 3),
                    border: `1px solid ${colorWithAlpha(secondaryColor, 0.45, 'var(--color-border)')}`,
                    borderLeft: `4px solid ${roundAccentColor}`,
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-caption text-fg tracking-wide uppercase">
                      {round.name}
                    </span>
                    <span className="text-2xs py-0.5 px-1.5 rounded-sm bg-white/6 border border-line text-fg-secondary font-semibold font-mono">
                      Best of {inheritedBestOf}
                    </span>
                  </div>
                  <span className="font-mono tabular-nums tracking-tight text-2xs font-semibold py-0.5 px-2 rounded-full bg-white/6 text-fg-secondary border border-line">
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
                data-testid="feed-match-card"
                onClick={() => {
                  if (tournament.isLocked && isPlayable) {
                    setActiveMatch(match);
                  }
                }}
                onMouseEnter={() => setHoveredMatchId(match.id)}
                onMouseLeave={() => setHoveredMatchId(null)}
                className={cn(
                  'rounded-md p-3 flex flex-col gap-2 transition-all duration-100',
                  tournament.isLocked && isPlayable ? 'cursor-pointer' : 'cursor-default',
                  isPlayable ? 'opacity-100' : 'opacity-65'
                )}
                style={{
                  background: isMatchCardHovered
                    ? getAlternateShade(cardColor, 8)
                    : cardColor,
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
                }}
              >
                {/* Card Top: Match # badge on left, status on right (Round name removed per user request) */}
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span
                      className="text-xs font-extrabold font-mono py-0.5 px-2 rounded-sm"
                      style={{
                        background: colorWithAlpha(matchAccentColor, 0.15, 'rgba(255, 255, 255, 0.08)'),
                        color: matchAccentColor,
                        border: `1px solid ${colorWithAlpha(matchAccentColor, 0.35, 'transparent')}`,
                      }}
                    >
                      Match #{match.matchNumber}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {!tournament.isLocked ? (
                      <span
                        className="text-2xs font-semibold py-0.5 px-2 rounded-sm bg-white/6 text-fg-muted border border-line inline-flex items-center gap-1"
                        title="Scores locked during Qualifiers Mode"
                      >
                        <Lock size={11} /> Qualifiers
                      </span>
                    ) : isComplete ? (
                      <span className="text-2xs font-bold py-0.5 px-2 rounded-sm bg-green-500/15 text-green-400 border border-green-500/35 inline-flex items-center gap-1">
                        <CheckCircle2 size={11} /> Complete
                      </span>
                    ) : inProgress ? (
                      <span
                        className="animate-pulse-border text-2xs font-bold py-0.5 px-2 rounded-sm inline-flex items-center gap-1"
                        style={{
                          background: colorWithAlpha(primaryColor, 0.15, 'rgba(245, 158, 11, 0.1)'),
                          color: primaryColor,
                          border: `1px solid ${colorWithAlpha(primaryColor, 0.4, 'rgba(245, 158, 11, 0.3)')}`,
                        }}
                      >
                        <Clock size={11} /> Live (Bo{matchBestOf})
                      </span>
                    ) : (
                      <span className="text-2xs font-semibold py-0.5 px-2 rounded-sm bg-white/5 text-fg-muted border border-line">
                        Ready
                      </span>
                    )}
                    {tournament.isLocked && isPlayable && (
                      <ChevronRight size={15} color="var(--color-text-muted)" className="opacity-60" />
                    )}
                  </div>
                </div>

                {/* Matchup Rows */}
                <div className="flex flex-col gap-1.5">
                  {/* Player 1 Row */}
                  <div
                    className="flex justify-between items-center py-2 px-2.5 rounded-sm transition-all duration-100"
                    style={{
                      background: p1Won
                        ? colorWithAlpha(primaryColor, 0.18, 'rgba(255, 255, 255, 0.08)')
                        : getAlternateShade(cardColor, 6),
                      border: p1Won
                        ? `1px solid ${colorWithAlpha(primaryColor, 0.45, 'transparent')}`
                        : `1px solid ${colorWithAlpha(secondaryColor, 0.18, 'rgba(255, 255, 255, 0.04)')}`,
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
                      className={cn(
                        'inline-flex items-center gap-1.5 py-0.5 px-1.5 rounded-sm transition-all duration-100 max-w-[calc(100%-50px)] min-w-0',
                        p1?.id ? 'cursor-pointer' : '[cursor:inherit]'
                      )}
                      style={{
                        background: hoveredPlayerKey === `p1-${match.id}` ? colorWithAlpha(primaryColor, 0.15) : 'transparent',
                        boxShadow: hoveredPlayerKey === `p1-${match.id}` ? `0 0 0 1px ${primaryColor}` : 'none',
                      }}
                      title={p1?.id ? "View competitor tournament profile" : undefined}
                    >
                      {(p1?.country || (p1 as any)?.avatarUrl) && (
                        <PlayerAvatar player={p1 as any} country={p1?.country} className={isComplete && p2Won ? 'opacity-45' : 'opacity-100'} />
                      )}
                      {p1?.seed && (
                        <span
                          className={cn(
                            'text-3xs py-0 px-1 rounded-sm font-mono font-bold leading-tight shrink-0',
                            isComplete && p2Won ? 'opacity-45' : 'opacity-100'
                          )}
                          style={{
                            background: p1Won
                              ? colorWithAlpha(primaryColor, 0.15, 'rgba(255, 255, 255, 0.08)')
                              : colorWithAlpha(matchAccentColor, 0.12, 'rgba(255, 255, 255, 0.08)'),
                            color: p1Won ? primaryColor : matchAccentColor,
                            border: p1Won
                              ? `1px solid ${colorWithAlpha(primaryColor, 0.4, 'rgba(255, 255, 255, 0.15)')}`
                              : `1px solid ${colorWithAlpha(matchAccentColor, 0.25, 'rgba(255, 255, 255, 0.1)')}`,
                          }}
                        >
                          #{p1.seed}
                        </span>
                      )}
                      {match.player1.isManualOverride && (
                        <span
                          className="text-3xs font-bold tracking-wide py-0 px-1 rounded-sm bg-gold/18 text-gold-bright border border-gold/40 uppercase leading-tight shrink-0"
                          title="Position manually placed by tournament organizer"
                        >
                          OVERRIDE
                        </span>
                      )}
                      <span
                        className={cn(
                          'text-sm truncate',
                          isComplete ? (p1Won ? 'font-extrabold' : 'font-normal') : (p1Wins > p2Wins ? 'font-bold' : 'font-medium'),
                          hoveredPlayerKey === `p1-${match.id}` ? 'opacity-100' : isComplete && p2Won ? 'opacity-45' : 'opacity-100'
                        )}
                        style={{
                          color: hoveredPlayerKey === `p1-${match.id}`
                            ? primaryColor
                            : p1Won
                            ? primaryColor
                            : 'var(--color-text-primary)',
                        }}
                      >
                        {p1Name}
                      </span>
                    </div>

                    <span
                      className={cn(
                        'font-mono tabular-nums tracking-tight text-lg py-0.5 px-2 rounded-sm leading-tight shrink-0',
                        p1Won ? 'font-extrabold' : 'font-semibold',
                        isComplete && p2Won ? 'opacity-45' : 'opacity-100'
                      )}
                      style={{
                        background: p1Won
                          ? colorWithAlpha(primaryColor, 0.22, 'rgba(255, 255, 255, 0.08)')
                          : 'transparent',
                        color: p1Won ? primaryColor : 'var(--color-text-primary)',
                        border: p1Won
                          ? `1px solid ${colorWithAlpha(primaryColor, 0.55, 'transparent')}`
                          : '1px solid transparent',
                      }}
                    >
                      {p1ScoreDisplay}
                    </span>
                  </div>

                  {/* Player 2 Row */}
                  <div
                    className="flex justify-between items-center py-2 px-2.5 rounded-sm transition-all duration-100"
                    style={{
                      background: p2Won
                        ? colorWithAlpha(primaryColor, 0.18, 'rgba(255, 255, 255, 0.08)')
                        : getAlternateShade(cardColor, 6),
                      border: p2Won
                        ? `1px solid ${colorWithAlpha(primaryColor, 0.45, 'transparent')}`
                        : `1px solid ${colorWithAlpha(secondaryColor, 0.18, 'rgba(255, 255, 255, 0.04)')}`,
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
                      className={cn(
                        'inline-flex items-center gap-1.5 py-0.5 px-1.5 rounded-sm transition-all duration-100 max-w-[calc(100%-50px)] min-w-0',
                        p2?.id ? 'cursor-pointer' : '[cursor:inherit]'
                      )}
                      style={{
                        background: hoveredPlayerKey === `p2-${match.id}` ? colorWithAlpha(primaryColor, 0.15) : 'transparent',
                        boxShadow: hoveredPlayerKey === `p2-${match.id}` ? `0 0 0 1px ${primaryColor}` : 'none',
                      }}
                      title={p2?.id ? "View competitor tournament profile" : undefined}
                    >
                      {(p2?.country || (p2 as any)?.avatarUrl) && (
                        <PlayerAvatar player={p2 as any} country={p2?.country} className={isComplete && p1Won ? 'opacity-45' : 'opacity-100'} />
                      )}
                      {p2?.seed && (
                        <span
                          className={cn(
                            'text-3xs py-0 px-1 rounded-sm font-mono font-bold leading-tight shrink-0',
                            isComplete && p1Won ? 'opacity-45' : 'opacity-100'
                          )}
                          style={{
                            background: p2Won
                              ? colorWithAlpha(primaryColor, 0.15, 'rgba(255, 255, 255, 0.08)')
                              : colorWithAlpha(matchAccentColor, 0.12, 'rgba(255, 255, 255, 0.08)'),
                            color: p2Won ? primaryColor : matchAccentColor,
                            border: p2Won
                              ? `1px solid ${colorWithAlpha(primaryColor, 0.4, 'rgba(255, 255, 255, 0.15)')}`
                              : `1px solid ${colorWithAlpha(matchAccentColor, 0.25, 'rgba(255, 255, 255, 0.1)')}`,
                          }}
                        >
                          #{p2.seed}
                        </span>
                      )}
                      {match.player2.isManualOverride && (
                        <span
                          className="text-3xs font-bold tracking-wide py-0 px-1 rounded-sm bg-gold/18 text-gold-bright border border-gold/40 uppercase leading-tight shrink-0"
                          title="Position manually placed by tournament organizer"
                        >
                          OVERRIDE
                        </span>
                      )}
                      <span
                        className={cn(
                          'text-sm truncate',
                          isComplete ? (p2Won ? 'font-extrabold' : 'font-normal') : (p2Wins > p1Wins ? 'font-bold' : 'font-medium'),
                          hoveredPlayerKey === `p2-${match.id}` ? 'opacity-100' : isComplete && p1Won ? 'opacity-45' : 'opacity-100'
                        )}
                        style={{
                          color: hoveredPlayerKey === `p2-${match.id}`
                            ? primaryColor
                            : p2Won
                            ? primaryColor
                            : 'var(--color-text-primary)',
                        }}
                      >
                        {p2Name}
                      </span>
                    </div>

                    <span
                      className={cn(
                        'font-mono tabular-nums tracking-tight text-lg py-0.5 px-2 rounded-sm leading-tight shrink-0',
                        p2Won ? 'font-extrabold' : 'font-semibold',
                        isComplete && p1Won ? 'opacity-45' : 'opacity-100'
                      )}
                      style={{
                        background: p2Won
                          ? colorWithAlpha(primaryColor, 0.22, 'rgba(255, 255, 255, 0.08)')
                          : 'transparent',
                        color: p2Won ? primaryColor : 'var(--color-text-primary)',
                        border: p2Won
                          ? `1px solid ${colorWithAlpha(primaryColor, 0.55, 'transparent')}`
                          : '1px solid transparent',
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
