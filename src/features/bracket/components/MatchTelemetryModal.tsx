import React, { useId } from 'react';
import { Overlay } from '../../../components/overlay';
import { Tournament, TournamentTier, MatchScoreRecord } from '../../tournament/types';
import { BracketMatch } from '../types';
import {
  getDefaultTierColors,
  colorWithAlpha,
  getContrastingTextColor,
  getAlternateShade,
} from '../colorUtils';
import { PlayerAvatar } from '../../players/components/PlayerAvatar';
import {
  X,
  Trophy,
  Clock,
  CheckCircle2,
  Check,
  ShieldAlert,
  Eye,
  Swords,
  Layers,
} from 'lucide-react';

interface MatchTelemetryModalProps {
  isOpen: boolean;
  onClose: () => void;
  tournament: Tournament;
  tier: TournamentTier;
  match: BracketMatch | null;
  matchScoreRecord?: MatchScoreRecord;
  roundName?: string;
  onSelectPlayer?: (pId: string, pName: string, country?: string) => void;
}

export const MatchTelemetryModal: React.FC<MatchTelemetryModalProps> = ({
  isOpen,
  onClose,
  tournament,
  tier,
  match,
  matchScoreRecord,
  roundName = 'Match',
  onSelectPlayer,
}) => {
  const titleId = useId();

  if (!isOpen || !match) return null;

  const defaults = getDefaultTierColors(tier);
  const primaryColor = tier.primaryColor || defaults.primaryColor || '#f59e0b';
  const secondaryColor = tier.secondaryColor || defaults.secondaryColor || '#705b33';
  const cardColor = tier.cardColor || defaults.cardColor || '#161922';

  const p1 = match.player1.player;
  const p2 = match.player2.player;
  const bestOf = match.bestOf || tier.bestOf || 5;

  // Retrieve game win scores and record
  const record = matchScoreRecord || tournament.matchScores[match.id];
  const p1Wins = record?.player1Wins ?? (match.winnerId && match.winnerId === p1?.id ? Math.ceil(bestOf / 2) : 0);
  const p2Wins = record?.player2Wins ?? (match.winnerId && match.winnerId === p2?.id ? Math.ceil(bestOf / 2) : 0);
  const isForfeit = Boolean(record?.forfeitWinnerId);
  const isComplete = Boolean(
    (p1?.id && match.winnerId === p1.id) ||
    (p2?.id && match.winnerId === p2.id) ||
    record?.isComplete ||
    isForfeit
  );
  const p1Won = Boolean(p1?.id && (match.winnerId === p1.id || record?.winnerPlayerId === p1.id || record?.forfeitWinnerId === p1.id));
  const p2Won = Boolean(p2?.id && (match.winnerId === p2.id || record?.winnerPlayerId === p2.id || record?.forfeitWinnerId === p2.id));
  const inProgress = !isComplete && (p1Wins > 0 || p2Wins > 0);

  const stageLabel =
    match.stage === 'GRAND_FINALS'
      ? 'Grand Finals'
      : match.stage === 'GRAND_FINALS_RESET'
      ? 'Grand Finals (Reset)'
      : match.stage === 'LOSERS'
      ? 'Losers Bracket'
      : 'Winners Bracket';

  return (
    <Overlay
      open
      onClose={onClose}
      aria-labelledby={titleId}
      panelClassName="flex max-w-140 max-h-[90vh] flex-col overflow-hidden rounded-lg"
      panelStyle={{
        background: cardColor,
        border: `1px solid ${colorWithAlpha(secondaryColor, 0.45, 'var(--color-border)')}`,
        boxShadow: `0 20px 50px rgba(0, 0, 0, 0.85), 0 0 30px ${colorWithAlpha(primaryColor, 0.15)}`,
      }}
    >
      {({ requestClose }) => (
        <>
          {/* Ambient Top Glow Stripe */}
          <div
            style={{
              height: '4px',
              width: '100%',
              background: `linear-gradient(90deg, ${primaryColor}, ${secondaryColor})`,
            }}
          />

          {/* Modal Header */}
          <div style={headerStyle}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: primaryColor,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                  }}
                >
                  <Layers size={13} />
                  {tier.name} Tier
                </span>
                <span style={{ color: 'var(--color-border-subtle)', fontSize: '0.75rem' }}>•</span>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                  {stageLabel}
                </span>
                <span style={{ color: 'var(--color-border-subtle)', fontSize: '0.75rem' }}>•</span>
                <span
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    padding: '0.15rem 0.5rem',
                    borderRadius: 'var(--radius-sm)',
                    background: 'rgba(255, 255, 255, 0.05)',
                    color: 'var(--color-text-muted)',
                  }}
                >
                  Best of {bestOf}
                </span>
              </div>
              <h2
                id={titleId}
                style={{
                  fontSize: '1.25rem',
                  fontWeight: 800,
                  color: '#ffffff',
                  margin: 0,
                  letterSpacing: '-0.02em',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <span>{roundName}</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>
                  (Match #{match.id.slice(-4)})
                </span>
              </h2>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              {/* Status Pill */}
              {isComplete ? (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    padding: '0.25rem 0.65rem',
                    borderRadius: 'var(--radius-full)',
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    background: 'rgba(34, 197, 94, 0.15)',
                    border: '1px solid rgba(34, 197, 94, 0.35)',
                    color: '#4ade80',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  <CheckCircle2 size={13} />
                  Final
                </span>
              ) : inProgress ? (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    padding: '0.25rem 0.65rem',
                    borderRadius: 'var(--radius-full)',
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    background: colorWithAlpha(primaryColor, 0.15),
                    border: `1px solid ${colorWithAlpha(primaryColor, 0.35)}`,
                    color: primaryColor,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  <span
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: primaryColor,
                      display: 'inline-block',
                    }}
                  />
                  In Progress
                </span>
              ) : (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    padding: '0.25rem 0.65rem',
                    borderRadius: 'var(--radius-full)',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text-muted)',
                  }}
                >
                  Upcoming
                </span>
              )}

              <button
                type="button"
                onClick={requestClose}
                style={closeBtnStyle}
                title="Close (Esc)"
                aria-label="Close match telemetry modal"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Modal Scrollable Body */}
          <div style={bodyStyle}>
            {/* Competitor Matchup Duel Banner */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '1.25rem 1.5rem',
                gap: '1rem',
                borderRadius: 'var(--radius-md)',
                background: `linear-gradient(180deg, ${colorWithAlpha(primaryColor, 0.08)} 0%, rgba(0, 0, 0, 0.35) 100%)`,
                border: `1px solid ${colorWithAlpha(primaryColor, 0.25, 'var(--color-border)')}`,
              }}
            >
              {/* Player 1 Card */}
              <div
                style={{
                  flex: 1,
                  textAlign: 'center',
                  minWidth: 0,
                  padding: '0.85rem 0.5rem',
                  borderRadius: 'var(--radius-md)',
                  background: p1Won
                    ? colorWithAlpha(primaryColor, 0.12)
                    : 'rgba(255, 255, 255, 0.02)',
                  border: p1Won
                    ? `2px solid ${primaryColor}`
                    : `1px solid ${colorWithAlpha(primaryColor, 0.2, 'rgba(255, 255, 255, 0.06)')}`,
                  boxShadow: p1Won
                    ? `0 0 16px ${colorWithAlpha(primaryColor, 0.35)}`
                    : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                {/* Competitor Glowing Avatar Ring */}
                <div
                  style={{
                    width: '46px',
                    height: '46px',
                    borderRadius: '50%',
                    background: `linear-gradient(135deg, ${colorWithAlpha(primaryColor, 0.25)} 0%, rgba(0, 0, 0, 0.5) 100%)`,
                    border: `2px solid ${p1Won ? primaryColor : colorWithAlpha(primaryColor, 0.4)}`,
                    boxShadow: p1Won ? `0 0 14px ${colorWithAlpha(primaryColor, 0.45)}` : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 0.45rem auto',
                    fontSize: '1.15rem',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {p1?.country || (p1 as any)?.avatarUrl ? (
                    <PlayerAvatar player={p1 as any} country={p1?.country} />
                  ) : (
                    <span style={{ fontSize: '0.9rem', fontWeight: 800, color: primaryColor }}>
                      {(p1?.name || 'TBD').slice(0, 2).toUpperCase()}
                    </span>
                  )}
                </div>

                {/* Seed tag */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', marginBottom: '0.35rem' }}>
                  {p1?.seed !== undefined && (
                    <span
                      style={{
                        fontSize: '0.68rem',
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 700,
                        padding: '0.1rem 0.4rem',
                        borderRadius: 'var(--radius-sm)',
                        background: 'rgba(255, 255, 255, 0.06)',
                        color: 'var(--color-text-muted)',
                        border: '1px solid var(--color-border)',
                      }}
                    >
                      #{p1.seed}
                    </span>
                  )}
                </div>

                {/* Player Name */}
                <div
                  style={{
                    fontSize: '1.15rem',
                    fontWeight: 700,
                    color: p1Won ? primaryColor : '#ffffff',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.35rem',
                  }}
                  title={p1?.name || 'TBD'}
                >
                  <span>{p1?.name || (match.player1.sourceMatchId ? `Winner of #${match.player1.sourceMatchId.slice(-4)}` : 'TBD')}</span>
                </div>

                {/* Giant Games Won Score */}
                <div
                  className="tabular-nums"
                  style={{
                    fontSize: '2.5rem',
                    fontWeight: 900,
                    lineHeight: 1.1,
                    marginTop: '0.35rem',
                    color: p1Won ? primaryColor : p1Wins > 0 ? '#ffffff' : 'var(--color-text-muted)',
                    textShadow: p1Won ? `0 0 16px ${colorWithAlpha(primaryColor, 0.4)}` : 'none',
                  }}
                >
                  {p1Wins}
                </div>

                {p1 && onSelectPlayer && (
                  <button
                    type="button"
                    onClick={() => onSelectPlayer(p1.id, p1.name, p1.country)}
                    style={{ ...linkBtnStyle, marginTop: '0.45rem' }}
                    title={`View ${p1.name} profile`}
                  >
                    <Eye size={12} />
                    <span>View Profile</span>
                  </button>
                )}
              </div>

              {/* Center VS & Format Column */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: '0 0.5rem',
                  flexShrink: 0,
                }}
              >
                <span
                  style={{
                    fontSize: '0.85rem',
                    fontWeight: 800,
                    letterSpacing: '0.1em',
                    color: 'var(--color-text-muted)',
                    marginBottom: '0.4rem',
                  }}
                >
                  VS
                </span>
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    padding: '0.2rem 0.6rem',
                    borderRadius: 'var(--radius-full)',
                    background: 'rgba(255, 255, 255, 0.08)',
                    color: 'var(--color-text-primary)',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  Best of {bestOf}
                </span>
                {isComplete && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      marginTop: '0.5rem',
                      padding: '0.2rem 0.55rem',
                      borderRadius: 'var(--radius-full)',
                      background: colorWithAlpha(primaryColor, 0.15),
                      color: primaryColor,
                      fontSize: '0.68rem',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      border: `1px solid ${colorWithAlpha(primaryColor, 0.35)}`,
                    }}
                  >
                    <Trophy size={11} />
                    <span>Final</span>
                  </div>
                )}
              </div>

              {/* Player 2 Card */}
              <div
                style={{
                  flex: 1,
                  textAlign: 'center',
                  minWidth: 0,
                  padding: '0.85rem 0.5rem',
                  borderRadius: 'var(--radius-md)',
                  background: p2Won
                    ? colorWithAlpha(primaryColor, 0.12)
                    : 'rgba(255, 255, 255, 0.02)',
                  border: p2Won
                    ? `2px solid ${primaryColor}`
                    : `1px solid ${colorWithAlpha(primaryColor, 0.2, 'rgba(255, 255, 255, 0.06)')}`,
                  boxShadow: p2Won
                    ? `0 0 16px ${colorWithAlpha(primaryColor, 0.35)}`
                    : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                {/* Competitor Glowing Avatar Ring */}
                <div
                  style={{
                    width: '46px',
                    height: '46px',
                    borderRadius: '50%',
                    background: `linear-gradient(135deg, ${colorWithAlpha(primaryColor, 0.25)} 0%, rgba(0, 0, 0, 0.5) 100%)`,
                    border: `2px solid ${p2Won ? primaryColor : colorWithAlpha(primaryColor, 0.4)}`,
                    boxShadow: p2Won ? `0 0 14px ${colorWithAlpha(primaryColor, 0.45)}` : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 0.45rem auto',
                    fontSize: '1.15rem',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {p2?.country || (p2 as any)?.avatarUrl ? (
                    <PlayerAvatar player={p2 as any} country={p2?.country} />
                  ) : (
                    <span style={{ fontSize: '0.9rem', fontWeight: 800, color: primaryColor }}>
                      {(p2?.name || 'TBD').slice(0, 2).toUpperCase()}
                    </span>
                  )}
                </div>

                {/* Seed tag */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', marginBottom: '0.35rem' }}>
                  {p2?.seed !== undefined && (
                    <span
                      style={{
                        fontSize: '0.68rem',
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 700,
                        padding: '0.1rem 0.4rem',
                        borderRadius: 'var(--radius-sm)',
                        background: 'rgba(255, 255, 255, 0.06)',
                        color: 'var(--color-text-muted)',
                        border: '1px solid var(--color-border)',
                      }}
                    >
                      #{p2.seed}
                    </span>
                  )}
                </div>

                {/* Player Name */}
                <div
                  style={{
                    fontSize: '1.15rem',
                    fontWeight: 700,
                    color: p2Won ? primaryColor : '#ffffff',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.35rem',
                  }}
                  title={p2?.name || 'TBD'}
                >
                  <span>{p2?.name || (match.player2.sourceMatchId ? `Winner of #${match.player2.sourceMatchId.slice(-4)}` : 'TBD')}</span>
                </div>

                {/* Giant Games Won Score */}
                <div
                  className="tabular-nums"
                  style={{
                    fontSize: '2.5rem',
                    fontWeight: 900,
                    lineHeight: 1.1,
                    marginTop: '0.35rem',
                    color: p2Won ? primaryColor : p2Wins > 0 ? '#ffffff' : 'var(--color-text-muted)',
                    textShadow: p2Won ? `0 0 16px ${colorWithAlpha(primaryColor, 0.4)}` : 'none',
                  }}
                >
                  {p2Wins}
                </div>

                {p2 && onSelectPlayer && (
                  <button
                    type="button"
                    onClick={() => onSelectPlayer(p2.id, p2.name, p2.country)}
                    style={{ ...linkBtnStyle, marginTop: '0.45rem' }}
                    title={`View ${p2.name} profile`}
                  >
                    <Eye size={12} />
                    <span>View Profile</span>
                  </button>
                )}
              </div>
            </div>

            {/* Forfeit Notice (if applicable) */}
            {isForfeit && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.65rem',
                  padding: '0.75rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#f87171',
                  fontSize: '0.85rem',
                }}
              >
                <ShieldAlert size={18} />
                <span>
                  <strong>Match Forfeited:</strong> Uncontested victory awarded to{' '}
                  <strong>{p1Won ? p1?.name : p2?.name}</strong>.
                </span>
              </div>
            )}

            {/* Section: Game-by-Game Score Telemetry */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3
                  style={{
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: 'var(--color-text-muted)',
                    margin: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                  }}
                >
                  <Swords size={14} color={primaryColor} />
                  Game-by-Game Telemetry
                </h3>

                {record?.games && record.games.length > 0 && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                    {record.games.length} {record.games.length === 1 ? 'Game' : 'Games'} Logged
                  </span>
                )}
              </div>

              {record?.games && record.games.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  {record.games.map((game, idx) => {
                    const gameNum = game.gameNumber || idx + 1;
                    const isTiebreakerGame = gameNum > bestOf;
                    const p1WonGame = game.winnerPlayerId === p1?.id;
                    const p2WonGame = game.winnerPlayerId === p2?.id;
                    const num1 = game.player1Points !== null && game.player1Points !== undefined ? Number(game.player1Points) : null;
                    const num2 = game.player2Points !== null && game.player2Points !== undefined ? Number(game.player2Points) : null;
                    const margin = num1 !== null && num2 !== null ? Math.abs(num1 - num2) : null;

                    return (
                      <div
                        key={idx}
                        style={{
                          padding: '0.85rem 1rem',
                          background: getAlternateShade(cardColor, 3),
                          borderRadius: 'var(--radius-md)',
                          border: isTiebreakerGame
                            ? `1px solid ${colorWithAlpha(primaryColor, 0.45)}`
                            : `1px solid ${colorWithAlpha(primaryColor, 0.22, 'var(--color-border)')}`,
                          boxShadow: '0 2px 6px rgba(0, 0, 0, 0.25)',
                        }}
                      >
                        {/* Game card top bar */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span
                              style={{
                                fontSize: '0.8rem',
                                fontWeight: 700,
                                color: isTiebreakerGame ? primaryColor : '#ffffff',
                                fontFamily: 'var(--font-mono)',
                              }}
                            >
                              Game {gameNum}
                            </span>
                            {isTiebreakerGame && (
                              <span
                                style={{
                                  fontSize: '0.65rem',
                                  fontWeight: 700,
                                  padding: '0.08rem 0.4rem',
                                  borderRadius: 'var(--radius-full)',
                                  background: colorWithAlpha(primaryColor, 0.15),
                                  color: primaryColor,
                                  border: `1px solid ${colorWithAlpha(primaryColor, 0.3)}`,
                                }}
                              >
                                Tiebreaker
                              </span>
                            )}
                            {game.winnerPlayerId === 'TIE' && (
                              <span
                                style={{
                                  fontSize: '0.65rem',
                                  padding: '0.08rem 0.45rem',
                                  borderRadius: 'var(--radius-sm)',
                                  background: 'var(--color-cyan-bg)',
                                  color: 'var(--color-cyan)',
                                  fontWeight: 700,
                                  border: '1px solid rgba(6, 182, 212, 0.3)',
                                }}
                              >
                                TIE
                              </span>
                            )}
                          </div>

                          {margin !== null && (
                            <span
                              style={{
                                fontSize: '0.72rem',
                                color: 'var(--color-cyan)',
                                fontFamily: 'var(--font-mono)',
                                fontWeight: 600,
                                background: 'rgba(6, 182, 212, 0.1)',
                                padding: '0.1rem 0.45rem',
                                borderRadius: 'var(--radius-sm)',
                                border: '1px solid rgba(6, 182, 212, 0.25)',
                              }}
                            >
                              Δ {margin.toLocaleString()} pts
                            </span>
                          )}
                        </div>

                        {/* Competitor Score Boxes */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '0.75rem', alignItems: 'center' }}>
                          {/* Player 1 Side */}
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.3rem' }}>
                              {p1WonGame && (
                                <span
                                  style={{
                                    width: '18px',
                                    height: '18px',
                                    borderRadius: '50%',
                                    background: primaryColor,
                                    color: getContrastingTextColor(primaryColor),
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                  }}
                                >
                                  <Check size={11} strokeWidth={3.5} />
                                </span>
                              )}
                              <span
                                style={{
                                  fontSize: '0.78rem',
                                  color: p1WonGame ? primaryColor : 'var(--color-text-secondary)',
                                  fontWeight: p1WonGame ? 700 : 500,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {p1?.name || 'Player 1'}
                              </span>
                            </div>
                            <div
                              className="tabular-nums"
                              style={{
                                width: '100%',
                                padding: '0.5rem 0.65rem',
                                background: p1WonGame
                                  ? colorWithAlpha(primaryColor, 0.18)
                                  : 'rgba(0, 0, 0, 0.45)',
                                border: p1WonGame
                                  ? `1px solid ${colorWithAlpha(primaryColor, 0.55)}`
                                  : '1px solid var(--color-border)',
                                borderRadius: 'var(--radius-sm)',
                                color: p1WonGame
                                  ? primaryColor
                                  : 'var(--color-text-primary)',
                                opacity: !p1WonGame && p2WonGame ? 0.45 : 1,
                                fontSize: '1.05rem',
                                fontWeight: p1WonGame ? 800 : 500,
                                fontFamily: 'var(--font-mono)',
                                textAlign: 'center',
                                boxSizing: 'border-box',
                              }}
                            >
                              {num1 !== null ? num1.toLocaleString() : '—'}
                            </div>
                          </div>

                          {/* Middle VS */}
                          <div style={{ color: 'var(--color-border-subtle)', fontSize: '0.75rem', fontWeight: 600 }}>
                            vs
                          </div>

                          {/* Player 2 Side */}
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.4rem', marginBottom: '0.3rem' }}>
                              <span
                                style={{
                                  fontSize: '0.78rem',
                                  color: p2WonGame ? primaryColor : 'var(--color-text-secondary)',
                                  fontWeight: p2WonGame ? 700 : 500,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {p2?.name || 'Player 2'}
                              </span>
                              {p2WonGame && (
                                <span
                                  style={{
                                    width: '18px',
                                    height: '18px',
                                    borderRadius: '50%',
                                    background: primaryColor,
                                    color: getContrastingTextColor(primaryColor),
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                  }}
                                >
                                  <Check size={11} strokeWidth={3.5} />
                                </span>
                              )}
                            </div>
                            <div
                              className="tabular-nums"
                              style={{
                                width: '100%',
                                padding: '0.5rem 0.65rem',
                                background: p2WonGame
                                  ? colorWithAlpha(primaryColor, 0.18)
                                  : 'rgba(0, 0, 0, 0.45)',
                                border: p2WonGame
                                  ? `1px solid ${colorWithAlpha(primaryColor, 0.55)}`
                                  : '1px solid var(--color-border)',
                                borderRadius: 'var(--radius-sm)',
                                color: p2WonGame
                                  ? primaryColor
                                  : 'var(--color-text-primary)',
                                opacity: !p2WonGame && p1WonGame ? 0.45 : 1,
                                fontSize: '1.05rem',
                                fontWeight: p2WonGame ? 800 : 500,
                                fontFamily: 'var(--font-mono)',
                                textAlign: 'center',
                                boxSizing: 'border-box',
                              }}
                            >
                              {num2 !== null ? num2.toLocaleString() : '—'}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div
                  style={{
                    padding: '1.75rem 1rem',
                    borderRadius: 'var(--radius-md)',
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px dashed var(--color-border)',
                    textAlign: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.45rem',
                  }}
                >
                  <Clock size={24} color="var(--color-text-muted)" />
                  <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                    No Game Scores Logged Yet
                  </span>
                  <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', maxWidth: '340px' }}>
                    {p1 && p2
                      ? 'Match is ready for match play. Results will populate in real time as the floor judge records scores.'
                      : 'Awaiting earlier round match conclusions to determine competitors.'}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Modal Footer */}
          <div style={footerStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>
              <span>Public Spectator View • Live Telemetry</span>
            </div>

            <button
              type="button"
              onClick={requestClose}
              className="btn btn-secondary"
              style={{ fontSize: '0.82rem', padding: '0.45rem 1.1rem' }}
            >
              Close
            </button>
          </div>
        </>
      )}
    </Overlay>
  );
};

const headerStyle: React.CSSProperties = {
  padding: '1.25rem 1.5rem',
  borderBottom: '1px solid var(--color-border)',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  background: 'rgba(255, 255, 255, 0.02)',
  gap: '1rem',
};

const closeBtnStyle: React.CSSProperties = {
  background: 'rgba(255, 255, 255, 0.05)',
  border: '1px solid var(--color-border)',
  color: 'var(--color-text-muted)',
  cursor: 'pointer',
  padding: '0.4rem',
  borderRadius: 'var(--radius-md)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'all 0.15s ease',
  flexShrink: 0,
};

const bodyStyle: React.CSSProperties = {
  padding: '1.25rem 1.5rem',
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: '1.25rem',
};

const footerStyle: React.CSSProperties = {
  padding: '0.9rem 1.5rem',
  borderTop: '1px solid var(--color-border)',
  background: 'rgba(255, 255, 255, 0.02)',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
};

const linkBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--color-gold-bright)',
  fontSize: '0.72rem',
  fontWeight: 600,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.3rem',
  padding: '0.2rem 0.4rem',
  borderRadius: 'var(--radius-xs)',
  transition: 'all 0.15s ease',
};
