import React, { useMemo, useState, useEffect } from 'react';
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

  // Keyboard escape listener to close drawer smoothly
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Derive leaderboard row so we have rank data even if caller didn't pass rankRow
  const leaderboard = useMemo(() => deriveLeaderboard(tournament), [tournament]);
  const effectiveRankRow = useMemo(() => {
    if (!player) return undefined;
    return rankRow || leaderboard.find(r => r.player.id === player.id);
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
    if (isDQ) return '#ef4444';
    if (isDNQ) return '#64748b';
    return resolvedTier?.primaryColor || defaults.primaryColor || '#f59e0b';
  }, [isDQ, isDNQ, resolvedTier, defaults]);

  const secondaryColor = useMemo(() => {
    if (isDQ) return '#7f1d1d';
    if (isDNQ) return '#334155';
    return resolvedTier?.secondaryColor || defaults.secondaryColor || '#705b33';
  }, [isDQ, isDNQ, resolvedTier, defaults]);

  const cardColor = useMemo(() => {
    return resolvedTier?.cardColor || defaults.cardColor || '#161922';
  }, [resolvedTier, defaults]);

  const textColor = useMemo(() => {
    return resolvedTier?.textColor || defaults.textColor || '#94A3B8';
  }, [resolvedTier, defaults]);

  const backgroundColor = useMemo(() => {
    return resolvedTier?.backgroundColor || defaults.backgroundColor || '#0c0d12';
  }, [resolvedTier, defaults]);

  const primaryContrast = useMemo(() => {
    return getContrastingTextColor(primaryColor);
  }, [primaryColor]);

  // Dedicated permanent metrics
  const overallQualSeed = useMemo(() => {
    if (!effectiveRankRow) return '—';
    if (effectiveRankRow.isDisqualified) return 'DQ';
    if (effectiveRankRow.attempts.length === 0 && effectiveRankRow.finalScore === 0) {
      const hasSubs = (tournament.qualifierSubmissions || []).some(s => s.playerId === player?.id);
      if (!hasSubs) return '—';
    }
    return typeof effectiveRankRow.rank === 'number' ? `#${effectiveRankRow.rank}` : String(effectiveRankRow.rank);
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
    const tColor = t.primaryColor || '#f59e0b';
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
      style={{
        background: getAlternateShade(cardColor, 2),
        border: `1px solid ${colorWithAlpha(secondaryColor, 0.35, 'var(--color-border)')}`,
        borderRadius: 'var(--radius-md)',
        padding: '1.1rem',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.25)',
      }}
      data-testid="qual-submissions-card"
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Trophy size={16} color={primaryColor} />
          <h3 style={sectionTitleStyle}>Qual Submissions</h3>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span
            className="tabular-nums"
            style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              padding: '0.15rem 0.55rem',
              borderRadius: 'var(--radius-full)',
              background: colorWithAlpha(primaryColor, 0.12),
              color: primaryColor,
              border: `1px solid ${colorWithAlpha(primaryColor, 0.25)}`,
            }}
          >
            {playerSubmissions.length} {playerSubmissions.length === 1 ? 'submission' : 'submissions'}
          </span>
          {isVerified && (
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 800,
                padding: '0.12rem 0.55rem',
                borderRadius: 'var(--radius-full)',
                background: 'rgba(34, 197, 94, 0.2)',
                color: '#4ade80',
                border: '1px solid rgba(34, 197, 94, 0.4)',
                boxShadow: '0 0 8px rgba(34, 197, 94, 0.25)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
              }}
            >
              <Check size={11} strokeWidth={3} /> Verified
            </span>
          )}
        </div>
      </div>

      {playerSubmissions.length === 0 ? (
        <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
          No qual submissions logged yet.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
          {playerSubmissions.map((sub, idx) => {
            const isMaxout = sub.score >= MAXOUT_THRESHOLD;
            const isKicker = tournament.qualFormat === 'HIGH_SCORE' && sub.score === effectiveRankRow?.kickerScore && sub.score < MAXOUT_THRESHOLD;
            const isBest = tournament.qualFormat === 'HIGH_SCORE' && sub.score === effectiveRankRow?.finalScore;

            return (
              <div
                key={sub.id}
                style={{
                  padding: '0.75rem 0.95rem',
                  borderRadius: 'var(--radius-sm)',
                  background: isMaxout
                    ? `linear-gradient(90deg, ${colorWithAlpha(primaryColor, 0.16)} 0%, ${getAlternateShade(cardColor, 4)} 100%)`
                    : isKicker
                    ? `linear-gradient(90deg, rgba(56, 189, 248, 0.12) 0%, ${getAlternateShade(cardColor, 4)} 100%)`
                    : isBest
                    ? `linear-gradient(90deg, rgba(16, 185, 129, 0.1) 0%, ${getAlternateShade(cardColor, 4)} 100%)`
                    : getAlternateShade(cardColor, 4),
                  border: isMaxout
                    ? `1px solid ${colorWithAlpha(primaryColor, 0.45)}`
                    : isKicker
                    ? '1px solid rgba(56, 189, 248, 0.35)'
                    : isBest
                    ? '1px solid rgba(16, 185, 129, 0.35)'
                    : `1px solid ${colorWithAlpha(primaryColor, 0.15, 'var(--color-border-subtle)')}`,
                  boxShadow: isMaxout ? `0 2px 10px ${colorWithAlpha(primaryColor, 0.12)}` : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div
                    className="tabular-nums"
                    style={{
                      width: '26px',
                      height: '26px',
                      borderRadius: '50%',
                      background: isMaxout ? colorWithAlpha(primaryColor, 0.25) : colorWithAlpha(primaryColor, 0.1),
                      border: `1px solid ${isMaxout ? colorWithAlpha(primaryColor, 0.5) : colorWithAlpha(primaryColor, 0.2)}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.75rem',
                      fontWeight: 800,
                      color: isMaxout ? primaryColor : textColor,
                    }}
                  >
                    {idx + 1}
                  </div>

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                      <span
                        className="tabular-nums"
                        style={{
                          fontWeight: 800,
                          fontSize: '1rem',
                          color: isMaxout ? primaryColor : '#ffffff',
                          letterSpacing: '-0.01em',
                        }}
                      >
                        {sub.score.toLocaleString()}
                      </span>

                      {isMaxout && (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            padding: '0.12rem 0.45rem',
                            borderRadius: 'var(--radius-sm)',
                            background: colorWithAlpha(primaryColor, 0.25),
                            color: primaryColor,
                            border: `1px solid ${colorWithAlpha(primaryColor, 0.5)}`,
                            boxShadow: `0 0 8px ${colorWithAlpha(primaryColor, 0.25)}`,
                            fontSize: '0.7rem',
                            fontWeight: 800,
                            letterSpacing: '0.03em',
                          }}
                        >
                          <Sparkles size={11} /> MAXOUT
                        </span>
                      )}

                      {isKicker && (
                        <span
                          style={{
                            padding: '0.12rem 0.45rem',
                            borderRadius: 'var(--radius-sm)',
                            background: 'rgba(56, 189, 248, 0.2)',
                            color: '#38bdf8',
                            border: '1px solid rgba(56, 189, 248, 0.4)',
                            fontSize: '0.7rem',
                            fontWeight: 800,
                            letterSpacing: '0.03em',
                          }}
                        >
                          KICKER
                        </span>
                      )}

                      {isBest && !isMaxout && (
                        <span
                          style={{
                            padding: '0.12rem 0.45rem',
                            borderRadius: 'var(--radius-sm)',
                            background: 'rgba(16, 185, 129, 0.18)',
                            color: '#34d399',
                            border: '1px solid rgba(16, 185, 129, 0.35)',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                          }}
                        >
                          Best
                        </span>
                      )}
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        fontSize: '0.72rem',
                        color: 'var(--color-text-muted)',
                        marginTop: '0.15rem',
                      }}
                    >
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  {tournament.qualFormat === 'POINTS' ? (
                    <span
                      className="tabular-nums"
                      style={{
                        fontWeight: 800,
                        color: primaryColor,
                        fontSize: '0.88rem',
                      }}
                    >
                      {(() => {
                        const sorted = [...(tournament.pointsConfig || [])].sort((a, b) => b.minScore - a.minScore);
                        const match = sorted.find(t => sub.score >= t.minScore);
                        return match ? `+${match.points} pts` : '+0 pts';
                      })()}
                    </span>
                  ) : tournament.qualFormat === 'HIGH_SCORE' ? (
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: isMaxout ? primaryColor : 'var(--color-text-muted)',
                      }}
                    >
                      {isMaxout ? 'Maxout' : isKicker ? 'Kicker' : 'Attempt'}
                    </span>
                  ) : (
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                      Logged
                    </span>
                  )}

                  {!tournament.isLocked && canManageTournament && (
                    <button
                      type="button"
                      onClick={() => deleteQualifierScore(tournament.id, sub.id)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--color-red)',
                        cursor: 'pointer',
                        padding: '0.3rem',
                        borderRadius: 'var(--radius-xs)',
                        display: 'flex',
                        alignItems: 'center',
                        opacity: 0.7,
                        transition: 'opacity 0.15s ease',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                      onMouseLeave={e => (e.currentTarget.style.opacity = '0.7')}
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
      <div style={overlayStyle} onClick={onClose}>
      <div
        style={{
          ...drawerStyle,
          background: `linear-gradient(180deg, ${getAlternateShade(cardColor, 2)} 0%, ${backgroundColor} 100%)`,
          borderLeft: `1px solid ${colorWithAlpha(primaryColor, 0.45, 'var(--color-border)')}`,
          boxShadow: `-12px 0 36px rgba(0, 0, 0, 0.7), -1px 0 16px ${colorWithAlpha(primaryColor, 0.2)}, inset 1px 0 0 ${colorWithAlpha(primaryColor, 0.25)}`,
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Top Glowing Ambient Theme Stripe */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '3px',
            background: `linear-gradient(90deg, transparent 0%, ${primaryColor} 25%, ${secondaryColor} 75%, transparent 100%)`,
            boxShadow: `0 0 12px ${colorWithAlpha(primaryColor, 0.65)}`,
            zIndex: 10,
          }}
        />

        {/* Glow-up Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: `1px solid ${colorWithAlpha(primaryColor, 0.35, 'var(--color-border)')}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            background: `linear-gradient(180deg, ${colorWithAlpha(primaryColor, 0.14)} 0%, ${getAlternateShade(cardColor, 4)} 100%)`,
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.35)',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
            {/* Tournament Title & Active Tier Badge Row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Trophy size={13} color={primaryColor} />
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    color: primaryColor,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  {tournament.name}
                </span>
              </div>

              {resolvedTier?.name && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    padding: '0.12rem 0.6rem',
                    borderRadius: 'var(--radius-full)',
                    background: colorWithAlpha(primaryColor, 0.2),
                    color: primaryColor,
                    border: `1px solid ${colorWithAlpha(primaryColor, 0.45)}`,
                    boxShadow: `0 0 8px ${colorWithAlpha(primaryColor, 0.2)}`,
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                  }}
                >
                  <span
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: primaryColor,
                      boxShadow: `0 0 6px ${primaryColor}`,
                    }}
                  />
                  {resolvedTier.name} Tier
                </span>
              )}

              {isDQ && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    padding: '0.12rem 0.55rem',
                    borderRadius: 'var(--radius-full)',
                    background: 'rgba(239, 68, 68, 0.25)',
                    color: '#fca5a5',
                    border: '1px solid rgba(239, 68, 68, 0.5)',
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                  }}
                >
                  <AlertTriangle size={11} /> Disqualified
                </span>
              )}
            </div>

            {/* Competitor Hero Row: Glowing Avatar Ring + Player Name */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
              <div
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '50%',
                  background: `linear-gradient(135deg, ${colorWithAlpha(primaryColor, 0.25)} 0%, ${getAlternateShade(cardColor, 8)} 100%)`,
                  border: `2px solid ${primaryColor}`,
                  boxShadow: `0 0 14px ${colorWithAlpha(primaryColor, 0.35)}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  fontSize: '1.25rem',
                }}
              >
                {player.country || player.avatarUrl ? (
                  <PlayerAvatar player={player} country={player.country} />
                ) : (
                  <span style={{ fontSize: '1rem', fontWeight: 800, color: primaryColor }}>
                    {player.name.slice(0, 1).toUpperCase()}
                  </span>
                )}
              </div>

              <div style={{ minWidth: 0 }}>
                <h2
                  style={{
                    fontSize: '1.45rem',
                    fontWeight: 800,
                    color: '#ffffff',
                    letterSpacing: '-0.02em',
                    margin: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    lineHeight: 1.2,
                    flexWrap: 'wrap',
                  }}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {player.name}
                  </span>
                  {player.nickname && (
                    <span
                      style={{
                        fontSize: '1.1rem',
                        fontWeight: 700,
                        fontStyle: 'italic',
                        color: 'var(--color-gold-bright)',
                      }}
                    >
                      &quot;{player.nickname}&quot;
                    </span>
                  )}
                  {isVerified && (
                    <span
                      title="Verified Qualifier Competitor"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '18px',
                        height: '18px',
                        borderRadius: '50%',
                        background: 'rgba(34, 197, 94, 0.25)',
                        border: '1px solid rgba(34, 197, 94, 0.5)',
                        color: '#4ade80',
                        flexShrink: 0,
                      }}
                    >
                      <Check size={11} strokeWidth={3} />
                    </span>
                  )}
                </h2>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginTop: '0.25rem', flexWrap: 'wrap' }}>
                  {player.displayName && player.displayName !== player.name && (
                    <span style={{ fontSize: '0.78rem', color: 'var(--color-gold-bright)', fontWeight: 600 }}>
                      Alias: {player.displayName}
                    </span>
                  )}
                  {player.twitchUsername && (
                    <a
                      href={`https://twitch.tv/${player.twitchUsername}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        fontSize: '0.75rem',
                        color: '#c084fc',
                        fontWeight: 600,
                        textDecoration: 'none',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        background: 'rgba(168, 85, 247, 0.15)',
                        border: '1px solid rgba(168, 85, 247, 0.35)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '0.1rem 0.45rem',
                        transition: 'all 0.15s ease',
                      }}
                      title={`Visit ${player.name}'s Twitch Channel`}
                    >
                      <span>twitch.tv/{player.twitchUsername}</span>
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Badges Row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginTop: '0.65rem', flexWrap: 'wrap' }}>
              {/* Final Place Badge */}
              {finalPlace !== '—' && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    padding: '0.2rem 0.65rem',
                    borderRadius: 'var(--radius-full)',
                    background: effectiveStanding?.finalRank === 1
                      ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.3) 0%, rgba(251, 191, 36, 0.2) 100%)'
                      : 'rgba(255, 255, 255, 0.08)',
                    color: effectiveStanding?.finalRank === 1 ? 'var(--color-gold-bright)' : '#ffffff',
                    border: effectiveStanding?.finalRank === 1
                      ? '1px solid rgba(245, 158, 11, 0.55)'
                      : '1px solid var(--color-border)',
                    boxShadow: effectiveStanding?.finalRank === 1 ? '0 0 10px rgba(245, 158, 11, 0.3)' : 'none',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                  }}
                >
                  <Trophy size={12} color={effectiveStanding?.finalRank === 1 ? 'var(--color-gold-bright)' : undefined} />
                  Final: {finalPlace}
                </span>
              )}

              {/* Bracket Seed Badge */}
              {bracketSeed !== '—' && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    padding: '0.2rem 0.65rem',
                    borderRadius: 'var(--radius-full)',
                    background: colorWithAlpha(primaryColor, 0.18),
                    color: primaryColor,
                    border: `1px solid ${colorWithAlpha(primaryColor, 0.45)}`,
                    boxShadow: `0 0 8px ${colorWithAlpha(primaryColor, 0.2)}`,
                    fontSize: '0.78rem',
                    fontWeight: 700,
                  }}
                >
                  <Flame size={12} />
                  Bracket: {bracketSeed}
                </span>
              )}

              {/* Overall Qual Seed Badge */}
              {overallQualSeed !== '—' && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    padding: '0.2rem 0.65rem',
                    borderRadius: 'var(--radius-full)',
                    background: 'rgba(255, 255, 255, 0.06)',
                    color: 'var(--color-text-secondary)',
                    border: '1px solid var(--color-border)',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                  }}
                >
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
            {canManageTournament && (
              <button
                type="button"
                onClick={() => setIsEditModalOpen(true)}
                aria-label="Edit competitor profile"
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: `1px solid ${colorWithAlpha(primaryColor, 0.35, 'var(--color-border)')}`,
                  color: primaryColor,
                  cursor: 'pointer',
                  padding: '0.45rem 0.75rem',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = colorWithAlpha(primaryColor, 0.18);
                  e.currentTarget.style.borderColor = primaryColor;
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                  e.currentTarget.style.borderColor = colorWithAlpha(primaryColor, 0.35, 'var(--color-border)');
                }}
              >
                <Edit2 size={13} />
                <span>Edit Profile</span>
              </button>
            )}

            {/* Close Action Button with Themed Hover */}
            <button
              onClick={onClose}
              aria-label="Close drawer"
              style={{
                background: 'rgba(255, 255, 255, 0.04)',
                border: `1px solid ${colorWithAlpha(primaryColor, 0.35, 'var(--color-border)')}`,
                color: 'var(--color-text-muted)',
                cursor: 'pointer',
                padding: '0.45rem',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease',
                flexShrink: 0,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#ffffff';
                e.currentTarget.style.borderColor = primaryColor;
                e.currentTarget.style.background = colorWithAlpha(primaryColor, 0.18);
                e.currentTarget.style.boxShadow = `0 0 10px ${colorWithAlpha(primaryColor, 0.3)}`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--color-text-muted)';
                e.currentTarget.style.borderColor = colorWithAlpha(primaryColor, 0.35, 'var(--color-border)');
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Scrollable Body Content */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '1.25rem 1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.5rem',
            scrollbarWidth: 'thin',
            scrollbarColor: `${colorWithAlpha(primaryColor, 0.35)} transparent`,
          }}
        >
          {/* Section 0: Quick Qual Submission & Judge Verification (Either/Or) */}
          {!tournament.isLocked && (
            <>
              {canManageTournament && (
                <div
                  style={{
                    background: `linear-gradient(180deg, ${colorWithAlpha(primaryColor, 0.12)} 0%, ${getAlternateShade(cardColor, 3)} 100%)`,
                    border: `1px solid ${colorWithAlpha(primaryColor, 0.4)}`,
                    borderRadius: 'var(--radius-md)',
                    padding: '1.1rem',
                    boxShadow: `0 4px 18px ${colorWithAlpha(primaryColor, 0.1)}`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.85rem',
                  }}
                >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Trophy size={16} color={primaryColor} />
                  <h3 style={{ ...sectionTitleStyle, color: '#ffffff' }}>Qualifier Stage Actions</h3>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {/* Status Badge */}
                  {qualStatus === 'verified' && (
                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        padding: '0.2rem 0.6rem',
                        borderRadius: 'var(--radius-sm)',
                        background: 'rgba(34, 197, 94, 0.2)',
                        color: '#4ade80',
                        border: '1px solid rgba(34, 197, 94, 0.4)',
                        boxShadow: '0 0 8px rgba(34, 197, 94, 0.25)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                      }}
                    >
                      <Check size={12} strokeWidth={3} /> Verified
                    </span>
                  )}
                  {qualStatus === 'in progress' && (
                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        padding: '0.2rem 0.6rem',
                        borderRadius: 'var(--radius-sm)',
                        background: colorWithAlpha(primaryColor, 0.2),
                        color: primaryColor,
                        border: `1px solid ${colorWithAlpha(primaryColor, 0.45)}`,
                      }}
                    >
                      In Progress
                    </span>
                  )}
                  {qualStatus === 'not started' && (
                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 500,
                        padding: '0.2rem 0.6rem',
                        borderRadius: 'var(--radius-sm)',
                        background: 'rgba(255, 255, 255, 0.08)',
                        color: 'var(--color-text-muted)',
                        border: '1px solid var(--color-border)',
                      }}
                    >
                      Not Started
                    </span>
                  )}
                </div>
              </div>

              {/* Action: Score Entry */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
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
                  style={{
                    display: 'flex',
                    gap: '0.5rem',
                    padding: '0.45rem',
                    borderRadius: 'var(--radius-sm)',
                    background: getAlternateShade(cardColor, 6),
                    border: `1px solid ${colorWithAlpha(primaryColor, 0.25, 'var(--color-border-subtle)')}`,
                  }}
                >
                  <input
                    type="text"
                    value={scoreInput ? parseInt(scoreInput.replace(/\D/g, ''), 10).toLocaleString() : ''}
                    onChange={(e) => setScoreInput(e.target.value.replace(/\D/g, ''))}
                    placeholder="Enter score (e.g. 1,050,000)..."
                    style={{
                      flex: 1,
                      padding: '0.45rem 0.7rem',
                      borderRadius: 'var(--radius-sm)',
                      border: `1px solid ${colorWithAlpha(primaryColor, 0.35, 'var(--color-border)')}`,
                      background: backgroundColor,
                      color: '#ffffff',
                      fontSize: '0.88rem',
                      fontWeight: 700,
                    }}
                  />
                  <button
                    type="submit"
                    disabled={!scoreInput || parseInt(scoreInput.replace(/\D/g, ''), 10) <= 0}
                    style={{
                      padding: '0.45rem 0.9rem',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      gap: '0.35rem',
                      whiteSpace: 'nowrap',
                      borderRadius: 'var(--radius-sm)',
                      background: primaryColor,
                      color: primaryContrast,
                      border: 'none',
                      cursor: (!scoreInput || parseInt(scoreInput.replace(/\D/g, ''), 10) <= 0) ? 'not-allowed' : 'pointer',
                      opacity: (!scoreInput || parseInt(scoreInput.replace(/\D/g, ''), 10) <= 0) ? 0.6 : 1,
                      boxShadow: `0 2px 10px ${colorWithAlpha(primaryColor, 0.35)}`,
                      display: 'inline-flex',
                      alignItems: 'center',
                      transition: 'all 0.15s ease',
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
            style={{
              background: getAlternateShade(cardColor, 2),
              border: `1px solid ${colorWithAlpha(secondaryColor, 0.35, 'var(--color-border)')}`,
              borderRadius: 'var(--radius-md)',
              padding: '1.1rem',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.25)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.85rem' }}>
              <User size={16} color={primaryColor} />
              <h3 style={sectionTitleStyle}>Competitor Profile</h3>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem' }}>
              <div
                style={{
                  ...statBoxStyle,
                  background: getAlternateShade(cardColor, 5),
                  border: `1px solid ${colorWithAlpha(primaryColor, 0.18, 'var(--color-border-subtle)')}`,
                }}
              >
                <span style={{ ...statLabelStyle, color: textColor }}>Personal Best</span>
                <span className="tabular-nums" style={{ fontSize: '1.15rem', fontWeight: 800, color: primaryColor }}>
                  {player.personalBest ? player.personalBest.toLocaleString() : '—'}
                </span>
              </div>

              <div
                style={{
                  ...statBoxStyle,
                  background: getAlternateShade(cardColor, 5),
                  border: `1px solid ${colorWithAlpha(primaryColor, 0.18, 'var(--color-border-subtle)')}`,
                }}
              >
                <span style={{ ...statLabelStyle, color: textColor }}>Playstyle</span>
                <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#ffffff' }}>
                  {player.playstyle || 'Standard'}
                </span>
              </div>

              <div
                style={{
                  ...statBoxStyle,
                  background: getAlternateShade(cardColor, 5),
                  border: `1px solid ${colorWithAlpha(primaryColor, 0.18, 'var(--color-border-subtle)')}`,
                }}
              >
                <span style={{ ...statLabelStyle, color: textColor }}>Assigned Tier</span>
                <span style={{ fontSize: '0.95rem', fontWeight: 700, color: primaryColor }}>
                  {assignedTierDisplay}
                </span>
              </div>

              <div
                style={{
                  ...statBoxStyle,
                  background: getAlternateShade(cardColor, 5),
                  border: `1px solid ${colorWithAlpha(primaryColor, 0.18, 'var(--color-border-subtle)')}`,
                }}
              >
                <span style={{ ...statLabelStyle, color: textColor }}>Overall Qual Seed</span>
                <span className="tabular-nums" style={{ fontSize: '1.15rem', fontWeight: 800, color: overallQualSeed !== '—' ? '#ffffff' : 'var(--color-text-muted)' }}>
                  {overallQualSeed}
                </span>
              </div>

              <div
                style={{
                  ...statBoxStyle,
                  background: getAlternateShade(cardColor, 5),
                  border: `1px solid ${colorWithAlpha(primaryColor, 0.18, 'var(--color-border-subtle)')}`,
                }}
              >
                <span style={{ ...statLabelStyle, color: textColor }}>Bracket Seed</span>
                <span style={{ fontSize: '0.95rem', fontWeight: 700, color: bracketSeed !== '—' ? primaryColor : 'var(--color-text-muted)' }}>
                  {bracketSeed}
                </span>
              </div>

              <div
                style={{
                  ...statBoxStyle,
                  background: getAlternateShade(cardColor, 5),
                  border: `1px solid ${colorWithAlpha(primaryColor, 0.18, 'var(--color-border-subtle)')}`,
                }}
              >
                <span style={{ ...statLabelStyle, color: textColor }}>Final Place</span>
                <span style={{ fontSize: '0.95rem', fontWeight: 800, color: finalPlace !== '—' ? (effectiveStanding?.finalRank === 1 ? 'var(--color-gold-bright)' : '#ffffff') : 'var(--color-text-muted)' }}>
                  {finalPlace}
                </span>
              </div>
            </div>

            {player.notes && (
              <div
                style={{
                  marginTop: '0.85rem',
                  padding: '0.7rem 0.85rem',
                  borderRadius: 'var(--radius-sm)',
                  background: 'rgba(255, 255, 255, 0.03)',
                  borderLeft: `3px solid ${primaryColor}`,
                  fontSize: '0.82rem',
                  color: 'var(--color-text-secondary)',
                  lineHeight: 1.45,
                }}
              >
                <strong style={{ color: '#ffffff' }}>Notes:</strong> {player.notes}
              </div>
            )}
          </div>

          {/* Section 2: Tournament Match Play History */}
          <div
            style={{
              background: getAlternateShade(cardColor, 2),
              border: `1px solid ${colorWithAlpha(secondaryColor, 0.35, 'var(--color-border)')}`,
              borderRadius: 'var(--radius-md)',
              padding: '1.1rem',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.25)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Swords size={16} color={primaryColor} />
                <h3 style={sectionTitleStyle}>Bracket Match Play Record</h3>
              </div>

              {playerMatches.length > 0 && (
                <div style={{ display: 'flex', gap: '0.45rem', fontSize: '0.75rem', flexWrap: 'wrap' }} className="tabular-nums">
                  <span
                    style={{
                      padding: '0.2rem 0.55rem',
                      borderRadius: 'var(--radius-full)',
                      background: colorWithAlpha(primaryColor, 0.12),
                      border: `1px solid ${colorWithAlpha(primaryColor, 0.25)}`,
                      color: 'var(--color-text-secondary)',
                    }}
                  >
                    Matches: <strong style={{ color: '#ffffff' }}>{totalMatchesWon}–{totalMatchesLost}</strong>
                  </span>
                  <span
                    style={{
                      padding: '0.2rem 0.55rem',
                      borderRadius: 'var(--radius-full)',
                      background: colorWithAlpha(primaryColor, 0.12),
                      border: `1px solid ${colorWithAlpha(primaryColor, 0.25)}`,
                      color: 'var(--color-text-secondary)',
                    }}
                  >
                    Games: <strong style={{ color: '#ffffff' }}>{totalGamesWon}–{totalGamesLost}</strong>
                  </span>
                  {overallAvgScore > 0 && (
                    <span
                      style={{
                        padding: '0.2rem 0.55rem',
                        borderRadius: 'var(--radius-full)',
                        background: colorWithAlpha(primaryColor, 0.18),
                        border: `1px solid ${colorWithAlpha(primaryColor, 0.35)}`,
                        color: primaryColor,
                        fontWeight: 700,
                      }}
                    >
                      Avg: <strong style={{ color: primaryColor }}>{overallAvgScore.toLocaleString()}</strong>
                    </span>
                  )}
                </div>
              )}
            </div>

            {!tournament.isLocked && playerMatches.length === 0 ? (
              <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.85rem', lineHeight: 1.5 }}>
                Tournament is currently in <strong>Qualifiers Mode</strong>. Bracket matches and game logs will appear here once brackets are locked into Match Play Mode.
              </div>
            ) : playerMatches.length === 0 ? (
              <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                {tournament.tiers.length === 0
                  ? 'No bracket tiers configured for this tournament yet.'
                  : 'No bracket matches scheduled or recorded for this competitor yet.'}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {playerMatches.map((m, idx) => {
                  const matchBorderColor = m.isWinner ? '#10b981' : m.isComplete ? '#f43f5e' : (m.tierColor || primaryColor);

                  return (
                    <div
                      key={m.matchId || idx}
                      style={{
                        borderRadius: 'var(--radius-sm)',
                        background: getAlternateShade(cardColor, 4),
                        border: `1px solid ${colorWithAlpha(m.tierColor || primaryColor, 0.25, 'var(--color-border-subtle)')}`,
                        borderLeft: `4px solid ${matchBorderColor}`,
                        overflow: 'hidden',
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {/* Match Header Bar */}
                      <div
                        style={{
                          padding: '0.5rem 0.85rem',
                          background: getAlternateShade(cardColor, 6),
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          borderBottom: `1px solid ${colorWithAlpha(m.tierColor || primaryColor, 0.15, 'var(--color-border-subtle)')}`,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                          <span
                            style={{
                              fontSize: '0.72rem',
                              fontWeight: 800,
                              padding: '0.1rem 0.5rem',
                              borderRadius: 'var(--radius-full)',
                              background: colorWithAlpha(m.tierColor, 0.2),
                              color: m.tierColor,
                              border: `1px solid ${colorWithAlpha(m.tierColor, 0.4)}`,
                              textTransform: 'uppercase',
                              letterSpacing: '0.04em',
                            }}
                          >
                            {m.tierName}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>•</span>
                          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                            {m.roundName}
                          </span>
                        </div>

                        {m.isComplete ? (
                          <span
                            style={{
                              fontSize: '0.7rem',
                              fontWeight: 800,
                              letterSpacing: '0.04em',
                              padding: '0.12rem 0.55rem',
                              borderRadius: 'var(--radius-full)',
                              background: m.isWinner ? 'rgba(16, 185, 129, 0.2)' : 'rgba(244, 63, 94, 0.2)',
                              color: m.isWinner ? '#34d399' : '#fb7185',
                              border: m.isWinner ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(244, 63, 94, 0.4)',
                              boxShadow: m.isWinner ? '0 0 8px rgba(16, 185, 129, 0.25)' : 'none',
                            }}
                          >
                            {m.isWinner ? 'VICTORY' : 'DEFEAT'}
                          </span>
                        ) : (
                          <span
                            style={{
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              padding: '0.12rem 0.55rem',
                              borderRadius: 'var(--radius-full)',
                              background: 'rgba(56, 189, 248, 0.15)',
                              color: '#38bdf8',
                              border: '1px solid rgba(56, 189, 248, 0.3)',
                            }}
                          >
                            In Progress
                          </span>
                        )}
                      </div>

                      {/* Match Score & Opponent */}
                      <div style={{ padding: '0.75rem 0.85rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.45rem' }}>
                          <div style={{ fontSize: '0.88rem', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', fontWeight: 600 }}>vs</span>
                            <PlayerAvatar country={m.opponentCountry} />
                            <strong style={{ color: '#ffffff', fontSize: '0.95rem' }}>{m.opponentName}</strong>
                            {m.opponentSeed && (
                              <span
                                style={{
                                  fontSize: '0.7rem',
                                  fontWeight: 700,
                                  padding: '0.08rem 0.4rem',
                                  borderRadius: 'var(--radius-sm)',
                                  background: 'rgba(255, 255, 255, 0.08)',
                                  color: 'var(--color-text-muted)',
                                  marginLeft: '0.2rem',
                                }}
                              >
                                #{m.opponentSeed}
                              </span>
                            )}
                          </div>

                          <div className="tabular-nums" style={{ fontSize: '1.15rem', fontWeight: 800 }}>
                            <span style={{ color: m.isWinner ? '#34d399' : '#ffffff' }}>{m.playerWins}</span>
                            <span style={{ color: 'var(--color-text-muted)', margin: '0 0.3rem' }}>–</span>
                            <span style={{ color: !m.isWinner && m.isComplete ? '#fb7185' : 'var(--color-text-secondary)' }}>{m.opponentWins}</span>
                          </div>
                        </div>

                        {/* Game-by-game scores */}
                        {m.games.length > 0 && (
                          <div
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '0.3rem',
                              marginTop: '0.5rem',
                              borderTop: `1px solid ${colorWithAlpha(m.tierColor || primaryColor, 0.12, 'rgba(255,255,255,0.05)')}`,
                              paddingTop: '0.5rem',
                            }}
                          >
                            {m.games.map(g => {
                              const pScoreVal = g.playerScore ?? 0;
                              const isPMaxout = pScoreVal >= MAXOUT_THRESHOLD;

                              return (
                                <div
                                  key={g.gameNumber}
                                  className="tabular-nums"
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    fontSize: '0.75rem',
                                    padding: '0.2rem 0.4rem',
                                    borderRadius: 'var(--radius-xs)',
                                    background: g.won ? 'rgba(16, 185, 129, 0.06)' : 'transparent',
                                  }}
                                >
                                  <span style={{ color: 'var(--color-text-muted)', fontWeight: 600 }}>
                                    Game {g.gameNumber}{g.isTie ? ' (TIE)' : ''}:
                                  </span>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                    {isPMaxout && (
                                      <span title="Maxout" style={{ color: 'var(--color-gold-bright)', display: 'inline-flex', alignItems: 'center' }}>
                                        <Sparkles size={11} />
                                      </span>
                                    )}
                                    <span
                                      style={{
                                        fontWeight: 700,
                                        color: g.isTie ? '#38bdf8' : g.won ? '#34d399' : 'var(--color-text-secondary)',
                                      }}
                                    >
                                      {g.playerScore !== null ? g.playerScore.toLocaleString() : '—'}
                                    </span>
                                    <span style={{ color: 'var(--color-text-muted)', fontSize: '0.7rem' }}>vs</span>
                                    <span
                                      style={{
                                        color: g.isTie ? '#38bdf8' : !g.won && g.playerScore !== null ? '#fb7185' : 'var(--color-text-muted)',
                                      }}
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
          style={{
            padding: '1rem 1.5rem',
            borderTop: `1px solid ${colorWithAlpha(primaryColor, 0.25, 'var(--color-border)')}`,
            background: getAlternateShade(cardColor, 3),
            display: 'flex',
            gap: '0.75rem',
          }}
        >
          <button
            onClick={onClose}
            style={{
              width: '100%',
              padding: '0.65rem',
              fontSize: '0.88rem',
              fontWeight: 700,
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(255, 255, 255, 0.05)',
              border: `1px solid ${colorWithAlpha(primaryColor, 0.35, 'var(--color-border)')}`,
              color: '#ffffff',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = colorWithAlpha(primaryColor, 0.15);
              e.currentTarget.style.borderColor = primaryColor;
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
              e.currentTarget.style.borderColor = colorWithAlpha(primaryColor, 0.35, 'var(--color-border)');
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
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
        allowDisqualify={true}
      />
    )}
    </>
  );
};

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0, 0, 0, 0.75)',
  backdropFilter: 'blur(6px)',
  display: 'flex',
  justifyContent: 'flex-end',
  zIndex: 1000,
  animation: 'fadeIn 0.2s ease-out',
};

const drawerStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: '540px',
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  animation: 'slideInRight 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
  position: 'relative',
  overflow: 'hidden',
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: '0.9rem',
  fontWeight: 800,
  color: '#ffffff',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  margin: 0,
};

const statBoxStyle: React.CSSProperties = {
  padding: '0.65rem 0.75rem',
  borderRadius: 'var(--radius-sm)',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.2rem',
};

const statLabelStyle: React.CSSProperties = {
  fontSize: '0.7rem',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  fontWeight: 600,
};
