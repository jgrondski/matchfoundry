import React, { useId } from 'react';
import { Overlay } from '../../../components/overlay';
import { Button, cn } from '../../../components/ui';
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
import { DEFAULT_TIER_THEME, THEME_FALLBACK } from '../../../theme/palette';

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
  const primaryColor = tier.primaryColor || defaults.primaryColor || THEME_FALLBACK.primaryColor;
  const secondaryColor = tier.secondaryColor || defaults.secondaryColor || DEFAULT_TIER_THEME.secondaryColor;
  const cardColor = tier.cardColor || defaults.cardColor || THEME_FALLBACK.cardColor;

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
        border: `1px solid ${colorWithAlpha(secondaryColor, 0.45, 'var(--color-line)')}`,
        boxShadow: `0 20px 50px rgba(0, 0, 0, 0.85), 0 0 30px ${colorWithAlpha(primaryColor, 0.15)}`,
      }}
    >
      {({ requestClose }) => (
        <>
          {/* Ambient Top Glow Stripe */}
          <div
            className="h-1 w-full"
            style={{
              background: `linear-gradient(90deg, ${primaryColor}, ${secondaryColor})`,
            }}
          />

          {/* Modal Header */}
          <div className="py-5 px-6 border-b border-line flex justify-between items-start bg-white/2 gap-4">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className="text-2xs font-extrabold uppercase tracking-widest flex items-center gap-1"
                  style={{ color: primaryColor }}
                >
                  <Layers size={13} />
                  {tier.name} Tier
                </span>
                <span className="text-line-subtle text-xs">•</span>
                <span className="text-xs font-semibold text-fg-secondary">
                  {stageLabel}
                </span>
                <span className="text-line-subtle text-xs">•</span>
                <span className="text-xs font-bold py-0.5 px-2 rounded-sm bg-white/5 text-fg-muted">
                  Best of {bestOf}
                </span>
              </div>
              <h2
                id={titleId}
                className="text-xl font-extrabold text-white m-0 tracking-tight flex items-center gap-2"
              >
                <span>{roundName}</span>
                <span className="text-sm font-semibold text-fg-muted">
                  (Match #{match.id.slice(-4)})
                </span>
              </h2>
            </div>

            <div className="flex items-center gap-3">
              {/* Status Pill */}
              {isComplete ? (
                <span className="inline-flex items-center gap-1.5 py-1 px-2.5 rounded-full text-xs font-extrabold bg-green-500/15 border border-green-500/35 text-green-400 uppercase tracking-wide">
                  <CheckCircle2 size={13} />
                  Final
                </span>
              ) : inProgress ? (
                <span
                  className="inline-flex items-center gap-1.5 py-1 px-2.5 rounded-full text-xs font-extrabold uppercase tracking-wide"
                  style={{
                    background: colorWithAlpha(primaryColor, 0.15),
                    border: `1px solid ${colorWithAlpha(primaryColor, 0.35)}`,
                    color: primaryColor,
                  }}
                >
                  <span className="size-1.5 rounded-full inline-block" style={{ background: primaryColor }} />
                  In Progress
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 py-1 px-2.5 rounded-full text-xs font-bold bg-white/5 border border-line text-fg-muted">
                  Upcoming
                </span>
              )}

              <button
                type="button"
                onClick={requestClose}
                className="bg-white/5 border border-line text-fg-muted cursor-pointer p-1.5 rounded-md flex items-center justify-center transition-all duration-150 shrink-0"
                title="Close (Esc)"
                aria-label="Close match telemetry modal"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Modal Scrollable Body */}
          <div className="py-5 px-6 overflow-y-auto flex flex-col gap-5">
            {/* Competitor Matchup Duel Banner */}
            <div
              className="flex items-center py-5 px-6 gap-4 rounded-md"
              style={{
                background: `linear-gradient(180deg, ${colorWithAlpha(primaryColor, 0.08)} 0%, rgba(0, 0, 0, 0.35) 100%)`,
                border: `1px solid ${colorWithAlpha(primaryColor, 0.25, 'var(--color-line)')}`,
              }}
            >
              {/* Player 1 Card */}
              <div
                className="flex-1 text-center min-w-0 py-3.5 px-2 rounded-md transition-all duration-150"
                style={{
                  background: p1Won
                    ? colorWithAlpha(primaryColor, 0.12)
                    : 'rgba(255, 255, 255, 0.02)',
                  border: p1Won
                    ? `2px solid ${primaryColor}`
                    : `1px solid ${colorWithAlpha(primaryColor, 0.2, 'rgba(255, 255, 255, 0.06)')}`,
                  boxShadow: p1Won
                    ? `0 0 16px ${colorWithAlpha(primaryColor, 0.35)}`
                    : 'none',
                }}
              >
                {/* Competitor Glowing Avatar Ring */}
                <div
                  className="size-11.5 rounded-full flex items-center justify-center mt-0 mx-auto mb-2 text-lg transition-all duration-200"
                  style={{
                    background: `linear-gradient(135deg, ${colorWithAlpha(primaryColor, 0.25)} 0%, rgba(0, 0, 0, 0.5) 100%)`,
                    border: `2px solid ${p1Won ? primaryColor : colorWithAlpha(primaryColor, 0.4)}`,
                    boxShadow: p1Won ? `0 0 14px ${colorWithAlpha(primaryColor, 0.45)}` : 'none',
                  }}
                >
                  {p1?.country || (p1 as any)?.avatarUrl ? (
                    <PlayerAvatar player={p1 as any} country={p1?.country} />
                  ) : (
                    <span className="text-sm font-extrabold" style={{ color: primaryColor }}>
                      {(p1?.name || 'TBD').slice(0, 2).toUpperCase()}
                    </span>
                  )}
                </div>

                {/* Seed tag */}
                <div className="flex items-center justify-center gap-1.5 mb-1.5">
                  {p1?.seed !== undefined && (
                    <span className="text-2xs font-mono font-bold py-0.5 px-1.5 rounded-sm bg-white/6 text-fg-muted border border-line">
                      #{p1.seed}
                    </span>
                  )}
                </div>

                {/* Player Name */}
                <div
                  className="text-lg font-bold text-white truncate flex items-center justify-center gap-1.5"
                  style={{ color: p1Won ? primaryColor : undefined }}
                  title={p1?.name || 'TBD'}
                >
                  <span>{p1?.name || (match.player1.sourceMatchId ? `Winner of #${match.player1.sourceMatchId.slice(-4)}` : 'TBD')}</span>
                </div>

                {/* Giant Games Won Score */}
                <div
                  className={cn(
                    'font-mono tabular-nums tracking-tight text-hero font-black leading-tight mt-1.5',
                    p1Wins > 0 ? 'text-white' : 'text-fg-muted'
                  )}
                  style={{
                    color: p1Won ? primaryColor : undefined,
                    textShadow: p1Won ? `0 0 16px ${colorWithAlpha(primaryColor, 0.4)}` : 'none',
                  }}
                >
                  {p1Wins}
                </div>

                {p1 && onSelectPlayer && (
                  <button
                    type="button"
                    onClick={() => onSelectPlayer(p1.id, p1.name, p1.country)}
                    className={cn(linkBtnClass, 'mt-2')}
                    title={`View ${p1.name} profile`}
                  >
                    <Eye size={12} />
                    <span>View Profile</span>
                  </button>
                )}
              </div>

              {/* Center VS & Format Column */}
              <div className="flex flex-col items-center px-2 shrink-0">
                <span className="text-sm font-extrabold tracking-widest text-fg-muted mb-1.5">
                  VS
                </span>
                <span className="text-xs font-bold py-1 px-2.5 rounded-full bg-white/8 text-fg border border-line">
                  Best of {bestOf}
                </span>
                {isComplete && (
                  <div
                    className="flex items-center gap-1.5 mt-2 py-1 px-2 rounded-full text-2xs font-extrabold uppercase tracking-wide"
                    style={{
                      background: colorWithAlpha(primaryColor, 0.15),
                      color: primaryColor,
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
                className="flex-1 text-center min-w-0 py-3.5 px-2 rounded-md transition-all duration-150"
                style={{
                  background: p2Won
                    ? colorWithAlpha(primaryColor, 0.12)
                    : 'rgba(255, 255, 255, 0.02)',
                  border: p2Won
                    ? `2px solid ${primaryColor}`
                    : `1px solid ${colorWithAlpha(primaryColor, 0.2, 'rgba(255, 255, 255, 0.06)')}`,
                  boxShadow: p2Won
                    ? `0 0 16px ${colorWithAlpha(primaryColor, 0.35)}`
                    : 'none',
                }}
              >
                {/* Competitor Glowing Avatar Ring */}
                <div
                  className="size-11.5 rounded-full flex items-center justify-center mt-0 mx-auto mb-2 text-lg transition-all duration-200"
                  style={{
                    background: `linear-gradient(135deg, ${colorWithAlpha(primaryColor, 0.25)} 0%, rgba(0, 0, 0, 0.5) 100%)`,
                    border: `2px solid ${p2Won ? primaryColor : colorWithAlpha(primaryColor, 0.4)}`,
                    boxShadow: p2Won ? `0 0 14px ${colorWithAlpha(primaryColor, 0.45)}` : 'none',
                  }}
                >
                  {p2?.country || (p2 as any)?.avatarUrl ? (
                    <PlayerAvatar player={p2 as any} country={p2?.country} />
                  ) : (
                    <span className="text-sm font-extrabold" style={{ color: primaryColor }}>
                      {(p2?.name || 'TBD').slice(0, 2).toUpperCase()}
                    </span>
                  )}
                </div>

                {/* Seed tag */}
                <div className="flex items-center justify-center gap-1.5 mb-1.5">
                  {p2?.seed !== undefined && (
                    <span className="text-2xs font-mono font-bold py-0.5 px-1.5 rounded-sm bg-white/6 text-fg-muted border border-line">
                      #{p2.seed}
                    </span>
                  )}
                </div>

                {/* Player Name */}
                <div
                  className="text-lg font-bold text-white truncate flex items-center justify-center gap-1.5"
                  style={{ color: p2Won ? primaryColor : undefined }}
                  title={p2?.name || 'TBD'}
                >
                  <span>{p2?.name || (match.player2.sourceMatchId ? `Winner of #${match.player2.sourceMatchId.slice(-4)}` : 'TBD')}</span>
                </div>

                {/* Giant Games Won Score */}
                <div
                  className={cn(
                    'font-mono tabular-nums tracking-tight text-hero font-black leading-tight mt-1.5',
                    p2Wins > 0 ? 'text-white' : 'text-fg-muted'
                  )}
                  style={{
                    color: p2Won ? primaryColor : undefined,
                    textShadow: p2Won ? `0 0 16px ${colorWithAlpha(primaryColor, 0.4)}` : 'none',
                  }}
                >
                  {p2Wins}
                </div>

                {p2 && onSelectPlayer && (
                  <button
                    type="button"
                    onClick={() => onSelectPlayer(p2.id, p2.name, p2.country)}
                    className={cn(linkBtnClass, 'mt-2')}
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
              <div className="flex items-center gap-2.5 py-3 px-4 rounded-md bg-red/10 border border-red/30 text-red-bright text-sm">
                <ShieldAlert size={18} />
                <span>
                  <strong>Match Forfeited:</strong> Uncontested victory awarded to{' '}
                  <strong>{p1Won ? p1?.name : p2?.name}</strong>.
                </span>
              </div>
            )}

            {/* Section: Game-by-Game Score Telemetry */}
            <div className="flex flex-col gap-3">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-bold uppercase tracking-wider text-fg-muted m-0 flex items-center gap-1.5">
                  <Swords size={14} color={primaryColor} />
                  Game-by-Game Telemetry
                </h3>

                {record?.games && record.games.length > 0 && (
                  <span className="text-xs text-fg-muted">
                    {record.games.length} {record.games.length === 1 ? 'Game' : 'Games'} Logged
                  </span>
                )}
              </div>

              {record?.games && record.games.length > 0 ? (
                <div className="flex flex-col gap-2.5">
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
                        className="py-3.5 px-4 rounded-md shadow-[0_2px_6px_rgba(0,0,0,0.25)]"
                        style={{
                          background: getAlternateShade(cardColor, 3),
                          border: isTiebreakerGame
                            ? `1px solid ${colorWithAlpha(primaryColor, 0.45)}`
                            : `1px solid ${colorWithAlpha(primaryColor, 0.22, 'var(--color-line)')}`,
                        }}
                      >
                        {/* Game card top bar */}
                        <div className="flex justify-between items-center mb-2.5">
                          <div className="flex items-center gap-2">
                            <span
                              className="text-caption font-bold font-mono text-white"
                              style={{ color: isTiebreakerGame ? primaryColor : undefined }}
                            >
                              Game {gameNum}
                            </span>
                            {isTiebreakerGame && (
                              <span
                                className="text-3xs font-bold py-0.5 px-1.5 rounded-full"
                                style={{
                                  background: colorWithAlpha(primaryColor, 0.15),
                                  color: primaryColor,
                                  border: `1px solid ${colorWithAlpha(primaryColor, 0.3)}`,
                                }}
                              >
                                Tiebreaker
                              </span>
                            )}
                            {game.winnerPlayerId === 'TIE' && (
                              <span className="text-3xs py-0.5 px-2 rounded-sm bg-cyan-soft text-cyan font-bold border border-cyan/30">
                                TIE
                              </span>
                            )}
                          </div>

                          {margin !== null && (
                            <span className="text-xs text-cyan font-mono font-semibold bg-cyan/10 py-0.5 px-2 rounded-sm border border-cyan/25">
                              Δ {margin.toLocaleString()} pts
                            </span>
                          )}
                        </div>

                        {/* Competitor Score Boxes */}
                        <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-center">
                          {/* Player 1 Side */}
                          <div>
                            <div className="flex items-center gap-1.5 mb-1">
                              {p1WonGame && (
                                <span
                                  className="size-4.5 rounded-full inline-flex items-center justify-center shrink-0"
                                  style={{
                                    background: primaryColor,
                                    color: getContrastingTextColor(primaryColor),
                                  }}
                                >
                                  <Check size={11} strokeWidth={3.5} />
                                </span>
                              )}
                              <span
                                className={cn('text-caption truncate', p1WonGame ? 'font-bold' : 'font-medium')}
                                style={{ color: p1WonGame ? primaryColor : 'var(--color-fg-secondary)' }}
                              >
                                {p1?.name || 'Player 1'}
                              </span>
                            </div>
                            <div
                              className={cn(
                                'font-mono tabular-nums tracking-tight w-full py-2 px-2.5 rounded-sm text-base text-center',
                                !p1WonGame && p2WonGame ? 'opacity-45' : 'opacity-100',
                                p1WonGame ? 'font-extrabold' : 'font-medium'
                              )}
                              style={{
                                background: p1WonGame
                                  ? colorWithAlpha(primaryColor, 0.18)
                                  : 'rgba(0, 0, 0, 0.45)',
                                border: p1WonGame
                                  ? `1px solid ${colorWithAlpha(primaryColor, 0.55)}`
                                  : '1px solid var(--color-line)',
                                color: p1WonGame
                                  ? primaryColor
                                  : 'var(--color-fg)',
                              }}
                            >
                              {num1 !== null ? num1.toLocaleString() : '—'}
                            </div>
                          </div>

                          {/* Middle VS */}
                          <div className="text-line-subtle text-xs font-semibold">
                            vs
                          </div>

                          {/* Player 2 Side */}
                          <div>
                            <div className="flex items-center justify-end gap-1.5 mb-1">
                              <span
                                className={cn('text-caption truncate', p2WonGame ? 'font-bold' : 'font-medium')}
                                style={{ color: p2WonGame ? primaryColor : 'var(--color-fg-secondary)' }}
                              >
                                {p2?.name || 'Player 2'}
                              </span>
                              {p2WonGame && (
                                <span
                                  className="size-4.5 rounded-full inline-flex items-center justify-center shrink-0"
                                  style={{
                                    background: primaryColor,
                                    color: getContrastingTextColor(primaryColor),
                                  }}
                                >
                                  <Check size={11} strokeWidth={3.5} />
                                </span>
                              )}
                            </div>
                            <div
                              className={cn(
                                'font-mono tabular-nums tracking-tight w-full py-2 px-2.5 rounded-sm text-base text-center',
                                !p2WonGame && p1WonGame ? 'opacity-45' : 'opacity-100',
                                p2WonGame ? 'font-extrabold' : 'font-medium'
                              )}
                              style={{
                                background: p2WonGame
                                  ? colorWithAlpha(primaryColor, 0.18)
                                  : 'rgba(0, 0, 0, 0.45)',
                                border: p2WonGame
                                  ? `1px solid ${colorWithAlpha(primaryColor, 0.55)}`
                                  : '1px solid var(--color-line)',
                                color: p2WonGame
                                  ? primaryColor
                                  : 'var(--color-fg)',
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
                <div className="py-7 px-4 rounded-md bg-white/2 border border-dashed border-line text-center flex flex-col items-center gap-2">
                  <Clock size={24} color="var(--color-fg-muted)" />
                  <span className="text-sm font-semibold text-fg-secondary">
                    No Game Scores Logged Yet
                  </span>
                  <span className="text-caption text-fg-muted max-w-85">
                    {p1 && p2
                      ? 'Match is ready for match play. Results will populate in real time as the floor judge records scores.'
                      : 'Awaiting earlier round match conclusions to determine competitors.'}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Modal Footer */}
          <div className="py-3.5 px-6 border-t border-line bg-white/2 flex justify-between items-center">
            <div className="flex items-center gap-1.5 text-fg-muted text-xs">
              <span>Public Spectator View • Live Telemetry</span>
            </div>

            <Button variant="secondary" onClick={requestClose} className="text-caption py-2 px-4.5">
              Close
            </Button>
          </div>
        </>
      )}
    </Overlay>
  );
};

const linkBtnClass =
  'bg-transparent border-0 text-gold-bright text-xs font-semibold cursor-pointer inline-flex items-center gap-1 py-1 px-1.5 rounded-xs transition-all duration-150';
