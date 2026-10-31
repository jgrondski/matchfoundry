import React, { useMemo, useState, useId } from 'react';
import { Tournament, TournamentTier, PlayerProfile } from '../../tournament/types';
import { useTournament } from '../../tournament/store';
import { usePinAuth } from '../../auth/AuthContext';
import {
  X,
  User,
  Trophy,
  Swords,
  Sparkles,
  Flame,
  Clock,
  Plus,
  Trash2,
  Check,
  AlertTriangle,
  Edit2,
} from 'lucide-react';
import { LeaderboardRankRow, MAXOUT_THRESHOLD, deriveLeaderboard, getPlayerQualifierStatus } from '../scoring';
import { calculateGlobalStandings, getRankOrdinal } from '../../tournament/standings';
import {
  colorWithAlpha,
  getDefaultTierColors,
  getAlternateShade,
  getContrastingTextColor,
} from '../../bracket/colorUtils';
import { PlayerAvatar } from '../../players/components/PlayerAvatar';
import { PlaystyleChip } from '../../players/components/PlaystyleChip';
import { PlayerEditModal } from '../../players/components/PlayerEditModal';
import { Overlay } from '../../../components/overlay';
import { cn } from '../../../components/ui';
import { DEFAULT_TIER_THEME, STATUS_COLORS, THEME_FALLBACK } from '../../../theme/palette';

const sectionTitleClass = 'text-sm font-extrabold text-white uppercase tracking-wide m-0';
const statBoxClass = 'py-2.5 px-3 rounded-sm flex flex-col gap-1 border';
const statLabelClass = 'text-2xs uppercase tracking-wide font-semibold';
const quickBadgeClass = 'inline-flex items-center gap-1 py-1 px-2.5 rounded-full border text-caption font-bold';

export interface PlayerDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  player: PlayerProfile | null;
  tournament: Tournament;
  rankRow?: LeaderboardRankRow;
  tier?: TournamentTier;
  tierId?: string;
  canManage?: boolean;
}

export const PlayerDetailDrawer: React.FC<PlayerDetailDrawerProps> = ({
  isOpen,
  onClose,
  player,
  tournament,
  rankRow,
  tier,
  tierId,
  canManage: canManageProp,
}) => {
  const { canManage: authCanManage } = usePinAuth();
  const canManageTournament = typeof canManageProp === 'boolean'
    ? canManageProp
    : Boolean(authCanManage(tournament.id) || authCanManage(tournament.slug));

  const { submitQualifierScore, deleteQualifierScore, updatePlayerInPool } = useTournament();
  const [scoreInput, setScoreInput] = useState('');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const titleId = useId();

  // Derive leaderboard row so we have rank data even if caller didn't pass rankRow
  const leaderboard = useMemo(() => deriveLeaderboard(tournament), [tournament]);
  const effectiveRankRow = useMemo(() => {
    if (!player) return undefined;
    // Prefer the live row: a caller-provided rankRow is a click-time snapshot and goes stale
    // when a judge ruling changes while the drawer is open.
    return leaderboard.find(r => r.player.id === player.id) || rankRow;
  }, [rankRow, leaderboard, player]);

  // Derive global standings for the player
  const globalStandings = useMemo(() => calculateGlobalStandings(tournament), [tournament]);
  const effectiveStanding = useMemo(() => {
    if (!player) return null;
    return globalStandings.find(s => s.player.id === player.id) || null;
  }, [globalStandings, player]);

  // Resolve the assigned or contextual tournament tier
  const resolvedTier = useMemo(() => {
    if (tier) return tier;
    if (tierId) {
      const match = tournament.tiers.find(t => t.id === tierId);
      if (match) return match;
    }
    if (effectiveRankRow?.assignedTier) return effectiveRankRow.assignedTier;
    if (effectiveStanding?.tier) return effectiveStanding.tier;
    if (player) {
      const tp = tournament.tournamentPlayers?.[player.id];
      if (tp?.tierId) {
        const match = tournament.tiers.find(t => t.id === tp.tierId);
        if (match) return match;
      }
      for (const t of tournament.tiers) {
        const inBracket = t.bracket?.rounds?.some(r =>
          r.matches?.some(m => m.player1?.player?.id === player.id || m.player2?.player?.id === player.id)
        );
        if (inBracket) return t;
      }
    }
    return tournament.tiers[0] || null;
  }, [tier, tierId, tournament, effectiveRankRow, effectiveStanding, player]);

  const defaults = useMemo(() => {
    return getDefaultTierColors(resolvedTier || {});
  }, [resolvedTier]);

  const isDQ = Boolean(effectiveRankRow?.isDisqualified || player?.isDisqualified);
  const isDNQ = Boolean(effectiveRankRow?.isDNQ && !isDQ);

  // 5-color Bracket Palette Integration
  const primaryColor = useMemo(() => {
    if (isDQ) return STATUS_COLORS.dq;
    if (isDNQ) return STATUS_COLORS.dnq;
    return resolvedTier?.primaryColor || defaults.primaryColor || THEME_FALLBACK.primaryColor;
  }, [isDQ, isDNQ, resolvedTier, defaults]);

  const secondaryColor = useMemo(() => {
    if (isDQ) return STATUS_COLORS.dqSecondary;
    if (isDNQ) return STATUS_COLORS.dnqSecondary;
    return resolvedTier?.secondaryColor || defaults.secondaryColor || DEFAULT_TIER_THEME.secondaryColor;
  }, [isDQ, isDNQ, resolvedTier, defaults]);

  const cardColor = useMemo(() => {
    return resolvedTier?.cardColor || defaults.cardColor || THEME_FALLBACK.cardColor;
  }, [resolvedTier, defaults]);

  const textColor = useMemo(() => {
    return resolvedTier?.textColor || defaults.textColor || DEFAULT_TIER_THEME.textColor;
  }, [resolvedTier, defaults]);

  const backgroundColor = useMemo(() => {
    return resolvedTier?.backgroundColor || defaults.backgroundColor || THEME_FALLBACK.backgroundColor;
  }, [resolvedTier, defaults]);

  const primaryContrast = useMemo(() => {
    return getContrastingTextColor(primaryColor);
  }, [primaryColor]);

  // Dedicated permanent metrics
  const overallQualSeed = useMemo(() => {
    if (!effectiveRankRow) return '—';
    if (effectiveRankRow.isDisqualified) return 'DQ';
    if (effectiveRankRow.status === 'dnq') return 'DNQ';
    if (effectiveRankRow.attempts.length === 0 && effectiveRankRow.finalScore === 0) {
      const hasSubs = (tournament.qualifierSubmissions || []).some(s => s.playerId === player?.id);
      if (!hasSubs) return '—';
    }
    return typeof effectiveRankRow.rank === 'number' ? `#${effectiveRankRow.rank}` : '—';
  }, [effectiveRankRow, tournament.qualifierSubmissions, player?.id]);

  const bracketSeed = useMemo(() => {
    if (!tournament.isLocked || !effectiveRankRow) return '—';
    if (effectiveRankRow.assignedTier && effectiveRankRow.tierSeed !== undefined) {
      return `${effectiveRankRow.assignedTier.name} #${effectiveRankRow.tierSeed}`;
    }
    return '—';
  }, [tournament.isLocked, effectiveRankRow]);

  const finalPlace = useMemo(() => {
    if (!tournament.isLocked) return '—';
    if (effectiveRankRow?.isDisqualified || player?.isDisqualified) return 'DQ';

    if (effectiveRankRow?.isDNQ) {
      if (typeof effectiveRankRow.rank === 'number') {
        return `${getRankOrdinal(effectiveRankRow.rank)} (DNQ)`;
      }
      return 'DNQ';
    }

    if (effectiveStanding) {
      if (effectiveStanding.eliminationRound !== 'Bracket Participant') {
        if (typeof effectiveStanding.finalRank === 'number') {
          return getRankOrdinal(effectiveStanding.finalRank);
        }
        return String(effectiveStanding.finalRank);
      }
    }
    return '—';
  }, [tournament.isLocked, effectiveRankRow, player?.isDisqualified, effectiveStanding]);

  const assignedTierDisplay = useMemo(() => {
    if (effectiveRankRow?.assignedTier) {
      return tournament.isLocked
        ? effectiveRankRow.assignedTier.name
        : `${effectiveRankRow.assignedTier.name} (Projected)`;
    }
    if (resolvedTier && !isDNQ && !isDQ) {
      return tournament.isLocked ? resolvedTier.name : `${resolvedTier.name} (Projected)`;
    }
    if (isDNQ) return 'DNQ';
    if (isDQ) return 'Disqualified';
    return '—';
  }, [effectiveRankRow, resolvedTier, isDNQ, isDQ, tournament.isLocked]);

  // Chronological qualifier submissions (earliest at top, latest on bottom)
  const playerSubmissions = useMemo(() => {
    if (!player) return [];
    return (tournament.qualifierSubmissions || [])
      .filter(s => s.playerId === player.id)
      .sort((a, b) => a.submittedAt - b.submittedAt);
  }, [tournament.qualifierSubmissions, player]);

  const qualStatus = useMemo(() => {
    if (!player) return 'not started';
    return getPlayerQualifierStatus(tournament, player.id);
  }, [tournament, player]);

  const isVerified = qualStatus === 'verified';
  // Qual entry is only valid for competitors registered in this tournament (never draft placeholder seeds)
  const isRegisteredCompetitor = Boolean(
    player && (tournament.playersPool || []).some(p => p.id === player.id)
  );

  if (!isOpen || !player) return null;

  // Tournament match history
  const playerMatches: Array<{
    matchId: string;
    tierName: string;
    tierColor: string;
    roundName: string;
    opponentName: string;
    opponentSeed?: number;
    opponentCountry?: string;
    playerWins: number;
    opponentWins: number;
    isWinner: boolean;
    isComplete: boolean;
    isForfeit?: boolean;
    games: Array<{ gameNumber: number; playerScore: number | null; opponentScore: number | null; won: boolean; isTie: boolean }>;
  }> = [];

  let totalMatchesWon = 0;
  let totalMatchesLost = 0;
  let totalGamesWon = 0;
  let totalGamesLost = 0;
  let totalGamePoints = 0;
  let gamesWithPointsCount = 0;

  for (const t of tournament.tiers) {
    const tColor = t.primaryColor || THEME_FALLBACK.primaryColor;
    for (const round of t.bracket.rounds) {
      for (const match of round.matches) {
        if (match.isBye) continue;

        const isP1 = match.player1.player?.id === player.id;
        const isP2 = match.player2.player?.id === player.id;
        if (!isP1 && !isP2) continue;

        const opponent = isP1 ? match.player2.player : match.player1.player;
        const record = tournament.matchScores[match.id];

        const playerWins = record ? (isP1 ? record.player1Wins : record.player2Wins) : 0;
        const opponentWins = record ? (isP1 ? record.player2Wins : record.player1Wins) : 0;
        const isComplete = Boolean(record?.isComplete);
        const isWinner = record?.winnerPlayerId === player.id;
        const isForfeit = Boolean(record?.forfeitWinnerId) || record?.notes === 'Forfeit win';

        if (isComplete) {
          if (isWinner) totalMatchesWon++;
          else totalMatchesLost++;
        }
        totalGamesWon += playerWins;
        totalGamesLost += opponentWins;

        const matchGames = (record?.games || []).map(g => {
          const pScore = isP1 ? g.player1Points : g.player2Points;
          const oppScore = isP1 ? g.player2Points : g.player1Points;
          const won = g.winnerPlayerId === player.id;
          const isTie = g.winnerPlayerId === 'TIE' || (typeof pScore === 'number' && pScore === oppScore && pScore > 0);
          if (typeof pScore === 'number') {
            totalGamePoints += pScore;
            gamesWithPointsCount++;
          }
          return {
            gameNumber: g.gameNumber,
            playerScore: pScore,
            opponentScore: oppScore,
            won,
            isTie,
          };
        });

        playerMatches.push({
          matchId: match.id,
          tierName: t.name,
          tierColor: tColor,
          roundName: round.name,
          opponentName: opponent?.name || 'TBD',
          opponentSeed: opponent?.seed,
          opponentCountry: opponent?.country,
          playerWins,
          opponentWins,
          isWinner,
          isComplete,
          isForfeit,
          games: matchGames,
        });
      }
    }
  }

  const overallAvgScore = gamesWithPointsCount > 0
    ? Math.round(totalGamePoints / gamesWithPointsCount)
    : 0;

  const renderQualSubmissionsSection = () => (
    <div
      className="border rounded-md p-4.5 shadow-[0_4px_16px_rgba(0,0,0,0.25)]"
      style={{
        background: getAlternateShade(cardColor, 2),
        borderColor: colorWithAlpha(secondaryColor, 0.35, 'var(--color-line)'),
      }}
      data-testid="qual-submissions-card"
    >
      <div className="flex items-center justify-between mb-3.5 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Trophy size={16} color={primaryColor} />
          <h3 className={sectionTitleClass}>Qual Submissions</h3>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="font-mono tabular-nums tracking-tight text-xs font-bold py-0.5 px-2 rounded-full border"
            style={{
              background: colorWithAlpha(primaryColor, 0.12),
              color: primaryColor,
              borderColor: colorWithAlpha(primaryColor, 0.25),
            }}
          >
            {playerSubmissions.length} {playerSubmissions.length === 1 ? 'submission' : 'submissions'}
          </span>
          {isVerified && (
            <span className="text-xs font-extrabold py-0.5 px-2 rounded-full bg-green-500/20 text-green-400 border border-green-500/40 shadow-[0_0_8px_rgba(34,197,94,0.25)] inline-flex items-center gap-1">
              <Check size={11} strokeWidth={3} /> Verified
            </span>
          )}
        </div>
      </div>

      {playerSubmissions.length === 0 ? (
        <div className="p-6 text-center text-fg-muted text-sm">
          No qual submissions logged yet.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {playerSubmissions.map((sub, idx) => {
            const isMaxout = sub.score >= MAXOUT_THRESHOLD;
            const isKicker = tournament.qualFormat === 'HIGH_SCORE' && sub.score === effectiveRankRow?.kickerScore && sub.score < MAXOUT_THRESHOLD;
            const isBest = tournament.qualFormat === 'HIGH_SCORE' && sub.score === effectiveRankRow?.finalScore;

            return (
              <div
                key={sub.id}
                className="py-3 px-4 rounded-sm border flex items-center justify-between transition-all duration-150"
                style={{
                  background: isMaxout
                    ? `linear-gradient(90deg, ${colorWithAlpha(primaryColor, 0.16)} 0%, ${getAlternateShade(cardColor, 4)} 100%)`
                    : isKicker
                    ? `linear-gradient(90deg, rgba(56, 189, 248, 0.12) 0%, ${getAlternateShade(cardColor, 4)} 100%)`
                    : isBest
                    ? `linear-gradient(90deg, rgba(16, 185, 129, 0.1) 0%, ${getAlternateShade(cardColor, 4)} 100%)`
                    : getAlternateShade(cardColor, 4),
                  borderColor: isMaxout
                    ? colorWithAlpha(primaryColor, 0.45)
                    : isKicker
                    ? 'rgba(56, 189, 248, 0.35)'
                    : isBest
                    ? 'rgba(16, 185, 129, 0.35)'
                    : colorWithAlpha(primaryColor, 0.15, 'var(--color-line-subtle)'),
                  boxShadow: isMaxout ? `0 2px 10px ${colorWithAlpha(primaryColor, 0.12)}` : undefined,
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="font-mono tabular-nums tracking-tight size-6.5 rounded-full border flex items-center justify-center text-xs font-extrabold"
                    style={{
                      background: isMaxout ? colorWithAlpha(primaryColor, 0.25) : colorWithAlpha(primaryColor, 0.1),
                      borderColor: isMaxout ? colorWithAlpha(primaryColor, 0.5) : colorWithAlpha(primaryColor, 0.2),
                      color: isMaxout ? primaryColor : textColor,
                    }}
                  >
                    {idx + 1}
                  </div>

                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={cn('font-mono tabular-nums tracking-tight font-extrabold text-base', !isMaxout && 'text-white')}
                        style={{ color: isMaxout ? primaryColor : undefined }}
                      >
                        {sub.score.toLocaleString()}
                      </span>

                      {isMaxout && (
                        <span
                          className="inline-flex items-center gap-1 py-0.5 px-2 rounded-sm border text-2xs font-extrabold tracking-wide"
                          style={{
                            background: colorWithAlpha(primaryColor, 0.25),
                            color: primaryColor,
                            borderColor: colorWithAlpha(primaryColor, 0.5),
                            boxShadow: `0 0 8px ${colorWithAlpha(primaryColor, 0.25)}`,
                          }}
                        >
                          <Sparkles size={11} /> MAXOUT
                        </span>
                      )}

                      {isKicker && (
                        <span className="py-0.5 px-2 rounded-sm bg-sky-400/20 text-sky-400 border border-sky-400/40 text-2xs font-extrabold tracking-wide">
                          KICKER
                        </span>
                      )}

                      {isBest && !isMaxout && (
                        <span className="py-0.5 px-2 rounded-sm bg-green/18 text-green-bright border border-green/35 text-2xs font-bold">
                          Best
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-fg-muted mt-0.5">
                      <Clock size={11} />
                      <span>
                        {new Date(sub.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {' • '}
                        {new Date(sub.submittedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Format Result Contribution & Delete */}
                <div className="flex items-center gap-2.5">
                  {tournament.qualFormat === 'POINTS' ? (
                    <span
                      className="font-mono tabular-nums tracking-tight font-extrabold text-sm"
                      style={{ color: primaryColor }}
                    >
                      {(() => {
                        const sorted = [...(tournament.pointsConfig || [])].sort((a, b) => b.minScore - a.minScore);
                        const match = sorted.find(t => sub.score >= t.minScore);
                        return match ? `+${match.points} pts` : '+0 pts';
                      })()}
                    </span>
                  ) : tournament.qualFormat === 'HIGH_SCORE' ? (
                    <span
                      className={cn('text-xs font-semibold', !isMaxout && 'text-fg-muted')}
                      style={{ color: isMaxout ? primaryColor : undefined }}
                    >
                      {isMaxout ? 'Maxout' : isKicker ? 'Kicker' : 'Attempt'}
                    </span>
                  ) : (
                    <span className="text-xs text-fg-muted">
                      Logged
                    </span>
                  )}

                  {!tournament.isLocked && canManageTournament && (
                    <button
                      type="button"
                      onClick={() => deleteQualifierScore(tournament.id, sub.id)}
                      className="bg-transparent border-0 text-red cursor-pointer p-1 rounded-xs flex items-center opacity-70 transition-opacity duration-150 hover:opacity-100"
                      title="Delete attempt"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <>
      <Overlay
        open
        onClose={onClose}
        variant="drawer"
        dirty={scoreInput.trim() !== ''}
        aria-labelledby={titleId}
        panelClassName="max-w-135"
        panelStyle={{
          background: `linear-gradient(180deg, ${getAlternateShade(cardColor, 2)} 0%, ${backgroundColor} 100%)`,
          borderLeft: `1px solid ${colorWithAlpha(primaryColor, 0.45, 'var(--color-line)')}`,
          boxShadow: `-12px 0 36px rgba(0, 0, 0, 0.7), -1px 0 16px ${colorWithAlpha(primaryColor, 0.2)}, inset 1px 0 0 ${colorWithAlpha(primaryColor, 0.25)}`,
        }}
      >
        {({ requestClose }) => (
          <>
            {/* Top Glowing Ambient Theme Stripe */}
            <div
              className="absolute top-0 left-0 right-0 h-0.75 z-10"
              style={{
                background: `linear-gradient(90deg, transparent 0%, ${primaryColor} 25%, ${secondaryColor} 75%, transparent 100%)`,
                boxShadow: `0 0 12px ${colorWithAlpha(primaryColor, 0.65)}`,
              }}
            />

            {/* Glow-up Header */}
            <div
              className="py-5 px-6 border-b flex justify-between items-start shadow-[0_4px_20px_rgba(0,0,0,0.35)] gap-4"
              style={{
                borderBottomColor: colorWithAlpha(primaryColor, 0.35, 'var(--color-line)'),
                background: `linear-gradient(180deg, ${colorWithAlpha(primaryColor, 0.14)} 0%, ${getAlternateShade(cardColor, 4)} 100%)`,
              }}
            >
              <div className="flex flex-col min-w-0 flex-1">
                {/* Tournament Title & Active Tier Badge Row */}
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <Trophy size={13} color={primaryColor} />
                    <span
                      className="text-xs font-extrabold uppercase tracking-wider"
                      style={{ color: primaryColor }}
                    >
                      {tournament.name}
                    </span>
                  </div>

                  {resolvedTier?.name && (
                    <span
                      className="inline-flex items-center gap-1.5 py-0.5 px-2.5 rounded-full border text-xs font-extrabold tracking-wide uppercase"
                      style={{
                        background: colorWithAlpha(primaryColor, 0.2),
                        color: primaryColor,
                        borderColor: colorWithAlpha(primaryColor, 0.45),
                        boxShadow: `0 0 8px ${colorWithAlpha(primaryColor, 0.2)}`,
                      }}
                    >
                      <span
                        className="size-1.5 rounded-full"
                        style={{
                          background: primaryColor,
                          boxShadow: `0 0 6px ${primaryColor}`,
                        }}
                      />
                      {resolvedTier.name} Tier
                    </span>
                  )}

                  {isDQ && (
                    <span className="inline-flex items-center gap-1 py-0.5 px-2 rounded-full bg-red/25 text-red-300 border border-red/50 text-xs font-extrabold tracking-wide uppercase">
                      <AlertTriangle size={11} /> Disqualified
                    </span>
                  )}
                </div>

                {/* Competitor Hero Row: Glowing Avatar Ring + Player Name */}
                <div className="flex items-center gap-3.5">
                  <div
                    className="size-11.5 rounded-full border-2 flex items-center justify-center shrink-0 text-xl"
                    style={{
                      background: `linear-gradient(135deg, ${colorWithAlpha(primaryColor, 0.25)} 0%, ${getAlternateShade(cardColor, 8)} 100%)`,
                      borderColor: primaryColor,
                      boxShadow: `0 0 14px ${colorWithAlpha(primaryColor, 0.35)}`,
                    }}
                  >
                    {player.country || player.avatarUrl ? (
                      <PlayerAvatar player={player} country={player.country} />
                    ) : (
                      <span className="text-base font-extrabold" style={{ color: primaryColor }}>
                        {player.name.slice(0, 1).toUpperCase()}
                      </span>
                    )}
                  </div>

                  <div className="min-w-0">
                    <h2
                      id={titleId}
                      className="text-2xl font-extrabold text-white tracking-tight m-0 flex items-center gap-2 leading-tight flex-wrap"
                    >
                      <span className="truncate">
                        {player.name}
                      </span>
                      {player.nickname && (
                        <span className="text-lg font-bold italic text-gold-bright">
                          &quot;{player.nickname}&quot;
                        </span>
                      )}
                      {isVerified && (
                        <span
                          title="Verified Qualifier Competitor"
                          className="inline-flex items-center justify-center size-4.5 rounded-full bg-green-500/25 border border-green-500/50 text-green-400 shrink-0"
                        >
                          <Check size={11} strokeWidth={3} />
                        </span>
                      )}
                    </h2>

                    <div className="flex items-center gap-2.5 mt-1 flex-wrap">
                      {player.displayName && player.displayName !== player.name && (
                        <span className="text-caption text-gold-bright font-semibold">
                          Alias: {player.displayName}
                        </span>
                      )}
                      {player.twitchUsername && (
                        <a
                          href={`https://twitch.tv/${player.twitchUsername}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-purple-400 font-semibold no-underline inline-flex items-center gap-1 bg-purple-500/15 border border-purple-500/35 rounded-sm py-0.5 px-2 transition-all duration-150"
                          title={`Visit ${player.name}'s Twitch Channel`}
                        >
                          <span>twitch.tv/{player.twitchUsername}</span>
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                {/* Quick Badges Row */}
                <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                  {/* Final Place Badge */}
                  {finalPlace !== '—' && (
                    <span
                      className={cn(
                        quickBadgeClass,
                        effectiveStanding?.finalRank === 1
                          ? 'bg-linear-135 from-gold/30 to-gold-bright/20 text-gold-bright border-gold/55 shadow-[0_0_10px_rgba(245,158,11,0.3)]'
                          : 'bg-white/8 text-white border-line shadow-none'
                      )}
                    >
                      <Trophy size={12} color={effectiveStanding?.finalRank === 1 ? 'var(--color-gold-bright)' : undefined} />
                      Final: {finalPlace}
                    </span>
                  )}

                  {/* Bracket Seed Badge */}
                  {bracketSeed !== '—' && (
                    <span
                      className={quickBadgeClass}
                      style={{
                        background: colorWithAlpha(primaryColor, 0.18),
                        color: primaryColor,
                        borderColor: colorWithAlpha(primaryColor, 0.45),
                        boxShadow: `0 0 8px ${colorWithAlpha(primaryColor, 0.2)}`,
                      }}
                    >
                      <Flame size={12} />
                      Bracket: {bracketSeed}
                    </span>
                  )}

                  {/* Overall Qual Seed Badge */}
                  {overallQualSeed !== '—' && (
                    <span className={cn(quickBadgeClass, 'bg-white/6 text-fg-secondary border-line')}>
                      Qual: {overallQualSeed}
                    </span>
                  )}

                  {/* Playstyle */}
                  {player.playstyle && (
                    <PlaystyleChip style={player.playstyle} />
                  )}
                </div>
              </div>

              {/* Header Actions: Edit Profile (if admin) + Close */}
              <div className="flex items-center gap-2 shrink-0">
                {canManageTournament && (
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(true)}
                    aria-label="Edit competitor profile"
                    className="bg-white/5 border border-(--btn-border) cursor-pointer py-2 px-3 rounded-md flex items-center gap-1.5 text-caption font-bold transition-all duration-150 hover:bg-(--btn-hover-bg) hover:border-(--btn-hover-border)"
                    style={{
                      '--btn-border': colorWithAlpha(primaryColor, 0.35, 'var(--color-line)'),
                      '--btn-hover-bg': colorWithAlpha(primaryColor, 0.18),
                      '--btn-hover-border': primaryColor,
                      color: primaryColor,
                    } as React.CSSProperties}
                  >
                    <Edit2 size={13} />
                    <span>Edit Profile</span>
                  </button>
                )}

                {/* Close Action Button with Themed Hover */}
                <button
                  onClick={requestClose}
                  aria-label="Close drawer"
                  className="bg-white/4 border border-(--btn-border) text-fg-muted cursor-pointer p-2 rounded-md flex items-center justify-center transition-all duration-150 shrink-0 hover:text-white hover:border-(--btn-hover-border) hover:bg-(--btn-hover-bg) hover:shadow-(--btn-hover-shadow)"
                  style={{
                    '--btn-border': colorWithAlpha(primaryColor, 0.35, 'var(--color-line)'),
                    '--btn-hover-bg': colorWithAlpha(primaryColor, 0.18),
                    '--btn-hover-border': primaryColor,
                    '--btn-hover-shadow': `0 0 10px ${colorWithAlpha(primaryColor, 0.3)}`,
                  } as React.CSSProperties}
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Scrollable Body Content */}
            <div
              className="flex-1 overflow-y-auto py-5 px-6 flex flex-col gap-6 [scrollbar-width:thin]"
              style={{ scrollbarColor: `${colorWithAlpha(primaryColor, 0.35)} transparent` }}
            >
              {/* Section 0: Quick Qual Submission & Judge Verification (Either/Or) */}
              {!tournament.isLocked && (
                <>
                  {canManageTournament && isRegisteredCompetitor && (
                    <div
                      className="border rounded-md p-4.5 flex flex-col gap-3.5"
                      style={{
                        background: `linear-gradient(180deg, ${colorWithAlpha(primaryColor, 0.12)} 0%, ${getAlternateShade(cardColor, 3)} 100%)`,
                        borderColor: colorWithAlpha(primaryColor, 0.4),
                        boxShadow: `0 4px 18px ${colorWithAlpha(primaryColor, 0.1)}`,
                      }}
                    >
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <Trophy size={16} color={primaryColor} />
                      <h3 className={sectionTitleClass}>Qualifier Stage Actions</h3>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Status Badge */}
                      {qualStatus === 'verified' && (
                        <span className="text-xs font-bold py-1 px-2.5 rounded-sm bg-green-500/20 text-green-400 border border-green-500/40 shadow-[0_0_8px_rgba(34,197,94,0.25)] inline-flex items-center gap-1">
                          <Check size={12} strokeWidth={3} /> Verified
                        </span>
                      )}
                      {qualStatus === 'in progress' && (
                        <span
                          className="text-xs font-bold py-1 px-2.5 rounded-sm border"
                          style={{
                            background: colorWithAlpha(primaryColor, 0.2),
                            color: primaryColor,
                            borderColor: colorWithAlpha(primaryColor, 0.45),
                          }}
                        >
                          In Progress
                        </span>
                      )}
                      {qualStatus === 'not started' && (
                        <span className="text-xs font-medium py-1 px-2.5 rounded-sm bg-white/8 text-fg-muted border border-line">
                          Not Started
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Action: Score Entry */}
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-semibold text-fg-secondary uppercase tracking-wide">
                      Record Attempt Score
                    </span>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const num = parseInt(scoreInput.replace(/\D/g, ''), 10);
                        if (num > 0) {
                          submitQualifierScore(tournament.id, player.id, num);
                          setScoreInput('');
                        }
                      }}
                      className="flex gap-2 p-2 rounded-sm border"
                      style={{
                        background: getAlternateShade(cardColor, 6),
                        borderColor: colorWithAlpha(primaryColor, 0.25, 'var(--color-line-subtle)'),
                      }}
                    >
                      <input
                        type="text"
                        value={scoreInput ? parseInt(scoreInput.replace(/\D/g, ''), 10).toLocaleString() : ''}
                        onChange={(e) => setScoreInput(e.target.value.replace(/\D/g, ''))}
                        placeholder="Enter score (e.g. 1,050,000)..."
                        className="flex-1 py-2 px-3 rounded-sm border text-white text-sm font-bold"
                        style={{
                          borderColor: colorWithAlpha(primaryColor, 0.35, 'var(--color-line)'),
                          background: backgroundColor,
                        }}
                      />
                      <button
                        type="submit"
                        disabled={!scoreInput || parseInt(scoreInput.replace(/\D/g, ''), 10) <= 0}
                        className={cn(
                          'py-2 px-3.5 text-caption font-bold gap-1.5 whitespace-nowrap rounded-sm border-0 inline-flex items-center transition-all duration-150',
                          (!scoreInput || parseInt(scoreInput.replace(/\D/g, ''), 10) <= 0) ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
                        )}
                        style={{
                          background: primaryColor,
                          color: primaryContrast,
                          boxShadow: `0 2px 10px ${colorWithAlpha(primaryColor, 0.35)}`,
                        }}
                      >
                        <Plus size={15} /> Log Score
                      </button>
                    </form>
                  </div>
                </div>
              )}

                {/* During quals, Qual Submissions is directly below Qualifier Stage Actions */}
                {renderQualSubmissionsSection()}
              </>
            )}

              {/* Section 1: Player Profile Details */}
              <div
                className="border rounded-md p-4.5 shadow-[0_4px_16px_rgba(0,0,0,0.25)]"
                style={{
                  background: getAlternateShade(cardColor, 2),
                  borderColor: colorWithAlpha(secondaryColor, 0.35, 'var(--color-line)'),
                }}
              >
                <div className="flex items-center gap-2 mb-3.5">
                  <User size={16} color={primaryColor} />
                  <h3 className={sectionTitleClass}>Competitor Profile</h3>
                </div>

                <div className="grid grid-cols-[repeat(auto-fit,minmax(130px,1fr))] gap-3">
                  <div
                    className={statBoxClass}
                    style={{
                      background: getAlternateShade(cardColor, 5),
                      borderColor: colorWithAlpha(primaryColor, 0.18, 'var(--color-line-subtle)'),
                    }}
                  >
                    <span className={statLabelClass} style={{ color: textColor }}>Personal Best</span>
                    <span className="font-mono tabular-nums tracking-tight text-lg font-extrabold" style={{ color: primaryColor }}>
                      {player.personalBest ? player.personalBest.toLocaleString() : '—'}
                    </span>
                  </div>

                  <div
                    className={statBoxClass}
                    style={{
                      background: getAlternateShade(cardColor, 5),
                      borderColor: colorWithAlpha(primaryColor, 0.18, 'var(--color-line-subtle)'),
                    }}
                  >
                    <span className={statLabelClass} style={{ color: textColor }}>Playstyle</span>
                    <span className="text-base font-bold text-white">
                      {player.playstyle || 'Standard'}
                    </span>
                  </div>

                  <div
                    className={statBoxClass}
                    style={{
                      background: getAlternateShade(cardColor, 5),
                      borderColor: colorWithAlpha(primaryColor, 0.18, 'var(--color-line-subtle)'),
                    }}
                  >
                    <span className={statLabelClass} style={{ color: textColor }}>Assigned Tier</span>
                    <span className="text-base font-bold" style={{ color: primaryColor }}>
                      {assignedTierDisplay}
                    </span>
                  </div>

                  <div
                    className={statBoxClass}
                    style={{
                      background: getAlternateShade(cardColor, 5),
                      borderColor: colorWithAlpha(primaryColor, 0.18, 'var(--color-line-subtle)'),
                    }}
                  >
                    <span className={statLabelClass} style={{ color: textColor }}>Overall Qual Seed</span>
                    <span
                      className={cn(
                        'font-mono tabular-nums tracking-tight text-lg font-extrabold',
                        overallQualSeed !== '—' ? 'text-white' : 'text-fg-muted'
                      )}
                    >
                      {overallQualSeed}
                    </span>
                  </div>

                  <div
                    className={statBoxClass}
                    style={{
                      background: getAlternateShade(cardColor, 5),
                      borderColor: colorWithAlpha(primaryColor, 0.18, 'var(--color-line-subtle)'),
                    }}
                  >
                    <span className={statLabelClass} style={{ color: textColor }}>Bracket Seed</span>
                    <span
                      className={cn('text-base font-bold', bracketSeed === '—' && 'text-fg-muted')}
                      style={{ color: bracketSeed !== '—' ? primaryColor : undefined }}
                    >
                      {bracketSeed}
                    </span>
                  </div>

                  <div
                    className={statBoxClass}
                    style={{
                      background: getAlternateShade(cardColor, 5),
                      borderColor: colorWithAlpha(primaryColor, 0.18, 'var(--color-line-subtle)'),
                    }}
                  >
                    <span className={statLabelClass} style={{ color: textColor }}>Final Place</span>
                    <span
                      className={cn(
                        'text-base font-extrabold',
                        finalPlace !== '—'
                          ? effectiveStanding?.finalRank === 1
                            ? 'text-gold-bright'
                            : 'text-white'
                          : 'text-fg-muted'
                      )}
                    >
                      {finalPlace}
                    </span>
                  </div>
                </div>

                {player.notes && (
                  <div
                    className="mt-3.5 py-3 px-3.5 rounded-sm bg-white/3 border-l-3 text-caption text-fg-secondary leading-normal"
                    style={{ borderLeftColor: primaryColor }}
                  >
                    <strong className="text-white">Notes:</strong> {player.notes}
                  </div>
                )}
              </div>

              {/* Section 2: Tournament Match Play History */}
              <div
                className="border rounded-md p-4.5 shadow-[0_4px_16px_rgba(0,0,0,0.25)]"
                style={{
                  background: getAlternateShade(cardColor, 2),
                  borderColor: colorWithAlpha(secondaryColor, 0.35, 'var(--color-line)'),
                }}
              >
                <div className="flex items-center justify-between mb-3.5 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Swords size={16} color={primaryColor} />
                    <h3 className={sectionTitleClass}>Bracket Match Play Record</h3>
                  </div>

                  {playerMatches.length > 0 && (
                    <div className="font-mono tabular-nums tracking-tight flex gap-2 text-xs flex-wrap">
                      <span
                        className="py-1 px-2 rounded-full border text-fg-secondary"
                        style={{
                          background: colorWithAlpha(primaryColor, 0.12),
                          borderColor: colorWithAlpha(primaryColor, 0.25),
                        }}
                      >
                        Matches: <strong className="text-white">{totalMatchesWon}–{totalMatchesLost}</strong>
                      </span>
                      <span
                        className="py-1 px-2 rounded-full border text-fg-secondary"
                        style={{
                          background: colorWithAlpha(primaryColor, 0.12),
                          borderColor: colorWithAlpha(primaryColor, 0.25),
                        }}
                      >
                        Games: <strong className="text-white">{totalGamesWon}–{totalGamesLost}</strong>
                      </span>
                      {overallAvgScore > 0 && (
                        <span
                          className="py-1 px-2 rounded-full border font-bold"
                          style={{
                            background: colorWithAlpha(primaryColor, 0.18),
                            borderColor: colorWithAlpha(primaryColor, 0.35),
                            color: primaryColor,
                          }}
                        >
                          Avg: <strong style={{ color: primaryColor }}>{overallAvgScore.toLocaleString()}</strong>
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {!tournament.isLocked && playerMatches.length === 0 ? (
                  <div className="p-6 text-center text-fg-muted text-sm leading-normal">
                    Tournament is currently in <strong>Qualifiers Mode</strong>. Bracket matches and game logs will appear here once brackets are locked into Match Play Mode.
                  </div>
                ) : playerMatches.length === 0 ? (
                  <div className="p-6 text-center text-fg-muted text-sm">
                    {tournament.tiers.length === 0
                      ? 'No bracket tiers configured for this tournament yet.'
                      : 'No bracket matches scheduled or recorded for this competitor yet.'}
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {playerMatches.map((m, idx) => {
                      const matchBorderColor = m.isWinner ? STATUS_COLORS.matchWin : m.isComplete ? STATUS_COLORS.matchLoss : (m.tierColor || primaryColor);

                      return (
                        <div
                          key={m.matchId || idx}
                          className="rounded-sm border border-l-4 overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.2)] transition-all duration-150"
                          style={{
                            background: getAlternateShade(cardColor, 4),
                            borderColor: colorWithAlpha(m.tierColor || primaryColor, 0.25, 'var(--color-line-subtle)'),
                            borderLeftColor: matchBorderColor,
                          }}
                        >
                          {/* Match Header Bar */}
                          <div
                            className="py-2 px-3.5 flex items-center justify-between border-b"
                            style={{
                              background: getAlternateShade(cardColor, 6),
                              borderBottomColor: colorWithAlpha(m.tierColor || primaryColor, 0.15, 'var(--color-line-subtle)'),
                            }}
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className="text-xs font-extrabold py-0.5 px-2 rounded-full border uppercase tracking-wide"
                                style={{
                                  background: colorWithAlpha(m.tierColor, 0.2),
                                  color: m.tierColor,
                                  borderColor: colorWithAlpha(m.tierColor, 0.4),
                                }}
                              >
                                {m.tierName}
                              </span>
                              <span className="text-xs text-fg-muted">•</span>
                              <span className="text-caption font-semibold text-fg-secondary">
                                {m.roundName}
                              </span>
                            </div>

                            {m.isComplete ? (
                              <span
                                className={cn(
                                  'text-2xs font-extrabold tracking-wide py-0.5 px-2 rounded-full border',
                                  m.isWinner
                                    ? 'bg-green/20 text-green-bright border-green/40 shadow-[0_0_8px_rgba(16,185,129,0.25)]'
                                    : 'bg-rose-500/20 text-rose-400 border-rose-500/40 shadow-none'
                                )}
                              >
                                {m.isWinner ? 'VICTORY' : 'DEFEAT'}
                              </span>
                            ) : (
                              <span className="text-2xs font-bold py-0.5 px-2 rounded-full bg-sky-400/15 text-sky-400 border border-sky-400/30">
                                In Progress
                              </span>
                            )}
                          </div>

                          {/* Match Score & Opponent */}
                          <div className="py-3 px-3.5">
                            <div className="flex items-center justify-between mb-2">
                              <div className="text-sm text-fg-secondary flex items-center gap-1.5">
                                <span className="text-fg-muted text-caption font-semibold">vs</span>
                                <PlayerAvatar country={m.opponentCountry} />
                                <strong className="text-white text-base">{m.opponentName}</strong>
                                {m.opponentSeed && (
                                  <span className="text-2xs font-bold py-0.5 px-1.5 rounded-sm bg-white/8 text-fg-muted ml-1">
                                    #{m.opponentSeed}
                                  </span>
                                )}
                              </div>

                              <div className="font-mono tabular-nums tracking-tight text-lg font-extrabold">
                                <span className={m.isWinner ? 'text-green-bright' : 'text-white'}>{m.playerWins}</span>
                                <span className="text-fg-muted mx-1">–</span>
                                <span className={!m.isWinner && m.isComplete ? 'text-rose-400' : 'text-fg-secondary'}>{m.opponentWins}</span>
                              </div>
                            </div>

                            {/* Game-by-game scores */}
                            {m.games.length > 0 && (
                              <div
                                className="flex flex-col gap-1 mt-2 border-t pt-2"
                                style={{
                                  borderTopColor: colorWithAlpha(m.tierColor || primaryColor, 0.12, 'rgba(255,255,255,0.05)'),
                                }}
                              >
                                {m.games.map(g => {
                                  const pScoreVal = g.playerScore ?? 0;
                                  const isPMaxout = pScoreVal >= MAXOUT_THRESHOLD;

                                  return (
                                    <div
                                      key={g.gameNumber}
                                      className={cn(
                                        'font-mono tabular-nums tracking-tight flex items-center justify-between text-xs py-1 px-1.5 rounded-xs',
                                        g.won ? 'bg-green/6' : 'bg-transparent'
                                      )}
                                    >
                                      <span className="text-fg-muted font-semibold">
                                        Game {g.gameNumber}{g.isTie ? ' (TIE)' : ''}:
                                      </span>
                                      <div className="flex items-center gap-1.5">
                                        {isPMaxout && (
                                          <span title="Maxout" className="text-gold-bright inline-flex items-center">
                                            <Sparkles size={11} />
                                          </span>
                                        )}
                                        <span
                                          className={cn(
                                            'font-bold',
                                            g.isTie ? 'text-sky-400' : g.won ? 'text-green-bright' : 'text-fg-secondary'
                                          )}
                                        >
                                          {g.playerScore !== null ? g.playerScore.toLocaleString() : '—'}
                                        </span>
                                        <span className="text-fg-muted text-2xs">vs</span>
                                        <span
                                          className={
                                            g.isTie ? 'text-sky-400' : !g.won && g.playerScore !== null ? 'text-rose-400' : 'text-fg-muted'
                                          }
                                        >
                                          {g.opponentScore !== null ? g.opponentScore.toLocaleString() : '—'}
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Section 3: Qual Submissions Audit Log (In match phase, positioned below match history) */}
              {tournament.isLocked && renderQualSubmissionsSection()}
            </div>

            {/* Footer with Themed Border & Button */}
            <div
              className="py-4 px-6 border-t flex gap-3"
              style={{
                borderTopColor: colorWithAlpha(primaryColor, 0.25, 'var(--color-line)'),
                background: getAlternateShade(cardColor, 3),
              }}
            >
              <button
                onClick={requestClose}
                className="w-full p-2.5 text-sm font-bold rounded-sm bg-white/5 border border-(--btn-border) text-white cursor-pointer transition-all duration-150 hover:bg-(--btn-hover-bg) hover:border-(--btn-hover-border)"
                style={{
                  '--btn-border': colorWithAlpha(primaryColor, 0.35, 'var(--color-line)'),
                  '--btn-hover-bg': colorWithAlpha(primaryColor, 0.15),
                  '--btn-hover-border': primaryColor,
                } as React.CSSProperties}
              >
                Close
              </button>
            </div>
          </>
        )}
      </Overlay>
    {canManageTournament && isEditModalOpen && (
      <PlayerEditModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        initialPlayer={player}
        onSave={async (playerData) => {
          await updatePlayerInPool(tournament.id, player.id, playerData);
          setIsEditModalOpen(false);
        }}
        existingNames={[]}
      />
    )}
    </>
  );
};
