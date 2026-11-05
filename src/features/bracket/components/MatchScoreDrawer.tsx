import React, { useState, useEffect, useId, useMemo, useRef } from 'react';
import { BracketMatch } from '../types';
import { MatchScoreRecord } from '../../tournament/types';
import { useTournament } from '../../tournament/store';
import { ApiError } from '../../tournament/apiError';
import { MATCH_CONFLICT_CODE } from '../matchConflict';
import { shouldResyncDrawer } from '../drawerSync';
import { X, Trophy, Check, ShieldAlert, Plus, ChevronDown } from 'lucide-react';
import {
  getDefaultTierColors,
  colorWithAlpha,
  getAlternateShade,
  getContrastingTextColor,
} from '../colorUtils';
import { MatchupBanner } from './drawer/MatchupBanner';
import { ManualSlotOverrideSection } from './drawer/ManualSlotOverrideSection';
import { GameScoreCard } from './drawer/GameScoreCard';
import { Overlay } from '../../../components/overlay';
import { Button, Spinner, cn, useAction, useGlobalBusy } from '../../../components/ui';
import { useIsMobile } from '../../../components/ui/useMediaQuery';
import { DEFAULT_TIER_THEME, THEME_FALLBACK } from '../../../theme/palette';

type GameDraft = { p1: string; p2: string; winner: string | null };

function deriveInitialGames(match: BracketMatch, liveRecord: MatchScoreRecord | undefined): GameDraft[] {
  const currentBestOf = liveRecord?.bestOf || match.bestOf || 5;
  const recordedCount = liveRecord?.games?.length || 0;
  const totalCount = Math.max(currentBestOf, recordedCount);
  const initialGames = [];
  for (let i = 1; i <= totalCount; i++) {
    const recorded = liveRecord?.games?.find(g => g.gameNumber === i);
    initialGames.push({
      p1: recorded?.player1Points !== null && recorded?.player1Points !== undefined ? String(recorded.player1Points) : '',
      p2: recorded?.player2Points !== null && recorded?.player2Points !== undefined ? String(recorded.player2Points) : '',
      winner: recorded?.winnerPlayerId || null,
    });
  }
  return initialGames;
}

/** Equal if identical after dropping trailing empty games (Best-of changes pad with empties). */
export function gamesEqual(a: GameDraft[], b: GameDraft[]): boolean {
  const trim = (list: GameDraft[]) => {
    const out = [...list];
    while (out.length && !out[out.length - 1].p1 && !out[out.length - 1].p2 && !out[out.length - 1].winner) out.pop();
    return out;
  };
  return JSON.stringify(trim(a)) === JSON.stringify(trim(b));
}

interface MatchScoreDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  tournamentId: string;
  tierId: string;
  match: BracketMatch | null;
  matchScoreRecord?: MatchScoreRecord;
  roundName?: string;
}

export const MatchScoreDrawer: React.FC<MatchScoreDrawerProps> = ({
  isOpen,
  onClose,
  tournamentId,
  tierId,
  match,
  matchScoreRecord,
  roundName = 'Round',
}) => {
  const { tournaments, saveMatchScores, updateMatchBestOf, forfeitMatch } = useTournament();

  const liveRecord = matchScoreRecord || (tournamentId && match ? tournaments.find(t => t.id === tournamentId)?.matchScores[match.id] : undefined);

  const [bestOf, setBestOf] = useState<number>(match?.bestOf || 5);
  const [games, setGames] = useState<GameDraft[]>([]);
  const gamesRef = useRef(games);
  gamesRef.current = games;
  const [hasTiebreaker, setHasTiebreaker] = useState(false);
  const [baseRevision, setBaseRevision] = useState(0);
  const [conflictNotice, setConflictNotice] = useState<string | null>(null);
  const [forfeitingId, setForfeitingId] = useState<string | null>(null);
  const isMobile = useIsMobile();
  const [forfeitOpen, setForfeitOpen] = useState(false);
  const { busy: globalBusy } = useGlobalBusy();
  const [resyncToken, setResyncToken] = useState(0);
  const lastSyncRef = useRef<{ matchId: string; gamesJson: string } | null>(null);

  useEffect(() => {
    if (!match) return;
    const last = lastSyncRef.current;
    if (!shouldResyncDrawer({
      lastSyncedMatchId: last?.matchId ?? null,
      lastSyncedGamesJson: last?.gamesJson ?? null,
      currentGamesJson: JSON.stringify(gamesRef.current),
      matchId: match.id,
    })) return;
    const currentBestOf = liveRecord?.bestOf || match.bestOf || 5;
    const nextGames = deriveInitialGames(match, liveRecord);
    setBestOf(currentBestOf);
    setGames(nextGames);
    setHasTiebreaker(Boolean(liveRecord?.hasTiebreaker || (liveRecord?.games?.length || 0) > currentBestOf));
    setBaseRevision(Number(liveRecord?.revision ?? 0));
    lastSyncRef.current = { matchId: match.id, gamesJson: JSON.stringify(nextGames) };
  }, [match, liveRecord, resyncToken]);

  useEffect(() => {
    if (isOpen) return;
    lastSyncRef.current = null;
    setConflictNotice(null);
  }, [isOpen]);

  const baselineGames = useMemo(() => (match ? deriveInitialGames(match, liveRecord) : []), [match, liveRecord]);
  const titleId = useId();

  // Actions are declared before the early return so hook order stays stable.
  const bestOfAction = useAction(async (newBestOf: number) => {
    if (!match) return;
    setBestOf(newBestOf);
    await updateMatchBestOf(tournamentId, tierId, match.id, newBestOf);
    const updated = [...games];
    while (updated.length < newBestOf) {
      updated.push({ p1: '', p2: '', winner: null });
    }
    setGames(updated);
  });

  const save = useAction(async () => {
    if (!match) return;
    setConflictNotice(null);
    const formattedGames = games.map((g, idx) => ({
      gameNumber: idx + 1,
      player1Points: g.p1.trim() !== '' ? parseInt(g.p1, 10) : null,
      player2Points: g.p2.trim() !== '' ? parseInt(g.p2, 10) : null,
      winnerPlayerId: g.winner,
    }));

    const hasTiedGame = formattedGames.some(
      g => g.winnerPlayerId === 'TIE' || (g.player1Points !== null && g.player1Points === g.player2Points && g.player1Points > 0)
    );
    const hasRemainingTiebreaker = games.length > bestOf;
    const shouldRecordTiebreaker = Boolean((hasTiebreaker || hasRemainingTiebreaker || hasTiedGame) && (hasTiedGame || hasRemainingTiebreaker));

    try {
      const saved = await saveMatchScores(
        tournamentId,
        tierId,
        match.id,
        formattedGames,
        shouldRecordTiebreaker,
        { expectedRevision: baseRevision }
      );
      if (saved) onClose(); // null means the store already reported an error; keep the judge's scores on screen
    } catch (err) {
      if (err instanceof ApiError && err.code === MATCH_CONFLICT_CODE) {
        setConflictNotice(err.message);
        lastSyncRef.current = null; // the next resync loads the latest stored games
        setResyncToken(n => n + 1);
        return;
      }
      throw err;
    }
  });

  const forfeit = useAction(async (winnerPlayerId: string) => {
    if (!match) return;
    const result = await forfeitMatch(tournamentId, tierId, match.id, winnerPlayerId);
    if (result) onClose(); // null means the store already reported an error
  });

  if (!isOpen || !match) return null;

  // Resolve tournament & tier theme colors matching PlayerDetailDrawer conventions
  const currentTournament = tournaments.find(t => t.id === tournamentId);
  const currentTier = currentTournament?.tiers.find(t => t.id === tierId) || currentTournament?.tiers[0];
  const defaults = getDefaultTierColors(currentTier || {});
  const primaryColor = currentTier?.primaryColor || defaults.primaryColor || THEME_FALLBACK.primaryColor;
  const secondaryColor = currentTier?.secondaryColor || defaults.secondaryColor || DEFAULT_TIER_THEME.secondaryColor;
  const cardColor = currentTier?.cardColor || defaults.cardColor || THEME_FALLBACK.cardColor;
  const textColor = currentTier?.textColor || defaults.textColor || DEFAULT_TIER_THEME.textColor;
  const backgroundColor = currentTier?.backgroundColor || defaults.backgroundColor || THEME_FALLBACK.backgroundColor;

  const p1 = match.player1.player;
  const p2 = match.player2.player;
  const p1Name = p1?.name || (match.player1.sourceMatchId ? 'Feeder Winner' : 'TBD');
  const p2Name = p2?.name || (match.player2.sourceMatchId ? 'Feeder Winner' : 'TBD');

  const handleScoreChange = (gameIndex: number, playerSlot: 1 | 2, value: string) => {
    // Only allow digits
    const cleaned = value.replace(/\D/g, '');
    const updated = [...games];
    if (playerSlot === 1) {
      updated[gameIndex].p1 = cleaned;
    } else {
      updated[gameIndex].p2 = cleaned;
    }

    const val1 = updated[gameIndex].p1.trim();
    const val2 = updated[gameIndex].p2.trim();

    // If either score is cleared or empty, unselect winner automatically
    if (val1 === '' || val2 === '') {
      updated[gameIndex].winner = null;
    } else {
      const num1 = parseInt(val1, 10);
      const num2 = parseInt(val2, 10);

      if (isNaN(num1) || isNaN(num2)) {
        updated[gameIndex].winner = null;
      } else if (num1 === 0 && num2 === 0) {
        // Empty / 0-0 reset: unselect winner automatically
        updated[gameIndex].winner = null;
      } else if (num1 > num2 && p1) {
        updated[gameIndex].winner = p1.id;
      } else if (num2 > num1 && p2) {
        updated[gameIndex].winner = p2.id;
      } else if (num1 === num2) {
        updated[gameIndex].winner = 'TIE';
      }
    }

    setGames(updated);
  };

  const handleManualWinnerToggle = (gameIndex: number, winnerId: string | null) => {
    const updated = [...games];
    updated[gameIndex].winner = updated[gameIndex].winner === winnerId ? null : winnerId;
    setGames(updated);
  };

  const handleBestOfChange = (newBestOf: number) => {
    void bestOfAction.run(newBestOf);
  };

  const handleAddTiebreakerGame = () => {
    setGames(prev => [...prev, { p1: '', p2: '', winner: null }]);
    setHasTiebreaker(true);
  };

  const handleDeleteTiebreakerGame = (idx: number) => {
    setGames(prev => {
      const updated = prev.filter((_, i) => i !== idx);
      const hasRemainingTiebreaker = updated.length > bestOf;
      const hasAnyTiedGame = updated.some(g => g.winner === 'TIE' || (g.p1 !== '' && g.p1 === g.p2 && parseInt(g.p1, 10) > 0));
      if (!hasRemainingTiebreaker && !hasAnyTiedGame) {
        setHasTiebreaker(false);
      }
      return updated;
    });
  };


  const handleForfeit = async (winnerPlayerId: string) => {
    if (window.confirm(`Award forfeit win to ${winnerPlayerId === p1?.id ? p1Name : p2Name}?`)) {
      setForfeitingId(winnerPlayerId);
      try {
        await forfeit.run(winnerPlayerId);
      } finally {
        setForfeitingId(null);
      }
    }
  };

  // Calculate series score summary
  let p1Wins = 0;
  let p2Wins = 0;
  games.forEach(g => {
    if (p1 && g.winner === p1.id) p1Wins++;
    else if (p2 && g.winner === p2.id) p2Wins++;
  });
  const winThreshold = Math.ceil(bestOf / 2);
  const matchDecided = p1Wins >= winThreshold || p2Wins >= winThreshold;

  const currentRound = currentTier?.bracket?.rounds.find(r => r.matches.some(m => m.id === match.id));
  const roundMatches = currentRound?.matches.filter(m => m.id !== match.id && !m.isBye) || [];

  const hasRecordedScores = Boolean(
    liveRecord?.isComplete ||
    (liveRecord?.games && liveRecord.games.length > 0) ||
    games.some(g => (g.p1 && g.p1 !== '0') || (g.p2 && g.p2 !== '0') || g.winner !== null)
  );

  const gameCardBg = getAlternateShade(cardColor, 3);

  return (
    <Overlay
      open
      onClose={onClose}
      variant="drawer"
      dirty={!gamesEqual(games, baselineGames)}
      busy={save.busy || forfeit.busy || bestOfAction.busy}
      aria-labelledby={titleId}
      panelTestId="match-score-drawer"
      panelClassName="max-md:h-dvh max-md:max-h-dvh max-md:rounded-none max-md:pt-[env(safe-area-inset-top)]"
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

          {/* Glow-up Header matching PlayerDetailDrawer */}
          <div
            className="py-5 px-6 flex justify-between items-start shadow-[0_4px_20px_rgba(0,0,0,0.35)] gap-4 max-md:items-center max-md:px-4 max-md:py-2"
            style={{
              borderBottom: `1px solid ${colorWithAlpha(primaryColor, 0.35, 'var(--color-line)')}`,
              background: gameCardBg,
            }}
          >
            <div className="flex flex-col gap-2 min-w-0 flex-1">
              {/* Tournament Title & Active Tier Badge Row */}
              <div className="flex items-center gap-2 flex-wrap max-md:hidden">
                <div className="flex items-center gap-1.5">
                  <Trophy size={13} color={primaryColor} />
                  <span
                    className="text-xs font-extrabold uppercase tracking-wider"
                    style={{ color: primaryColor }}
                  >
                    {currentTournament?.name || 'Tournament'}
                  </span>
                </div>

                {currentTier?.name && (
                  <span
                    className="inline-flex items-center gap-1.5 py-0.5 px-2.5 rounded-full text-xs font-extrabold tracking-wide uppercase"
                    style={{
                      background: colorWithAlpha(primaryColor, 0.2),
                      color: primaryColor,
                      border: `1px solid ${colorWithAlpha(primaryColor, 0.45)}`,
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
                    {currentTier.name} Tier
                  </span>
                )}
              </div>

              {/* Match Hero Row */}
              <div className="flex items-center gap-2.5 flex-wrap max-md:flex-nowrap max-md:min-w-0">
                <h2
                  id={titleId}
                  className="m-0 text-2xl font-extrabold text-white tracking-tight leading-tight max-md:text-lg"
                >
                  Match #{match.matchNumber}
                </h2>
                <span className="text-base font-semibold leading-tight max-md:text-sm max-md:truncate" style={{ color: textColor }}>
                  • {roundName}
                </span>
              </div>
            </div>

            <button
              onClick={requestClose}
              aria-label="Close drawer"
              className={cn(
                'bg-white/4 border border-(color:--close-border) text-fg-muted cursor-pointer p-2 rounded-md flex items-center justify-center transition-all duration-150 shrink-0 max-md:min-h-11 max-md:min-w-11',
                'hover:text-white hover:border-(color:--close-accent) hover:bg-(--close-hover-bg) hover:shadow-[0_0_10px_var(--close-hover-glow)]'
              )}
              style={
                {
                  '--close-border': colorWithAlpha(primaryColor, 0.35, 'var(--color-line)'),
                  '--close-accent': primaryColor,
                  '--close-hover-bg': colorWithAlpha(primaryColor, 0.18),
                  '--close-hover-glow': colorWithAlpha(primaryColor, 0.3),
                } as React.CSSProperties
              }
            >
              <X size={18} />
            </button>
          </div>

          {/* Player Matchup Scoreboard Banner */}
          <MatchupBanner
            p1={p1}
            p2={p2}
            p1Seed={p1?.seed}
            p2Seed={p2?.seed}
            p1Name={p1Name}
            p2Name={p2Name}
            p1Wins={p1Wins}
            p2Wins={p2Wins}
            winThreshold={winThreshold}
            bestOf={bestOf}
            isP1Override={match.player1.isManualOverride}
            isP2Override={match.player2.isManualOverride}
            primaryColor={primaryColor}
            onBestOfChange={handleBestOfChange}
            bestOfDisabled={bestOfAction.busy || globalBusy}
            bestOfLoading={bestOfAction.busy}
          />

          {/* Manual Placement Override Bar (available if no scores recorded in this match yet) */}
          {!hasRecordedScores && roundMatches.length > 0 && (
            <ManualSlotOverrideSection
              roundMatches={roundMatches}
              match={match}
              roundName={roundName}
              p1Name={p1Name}
              p2Name={p2Name}
              tournamentId={tournamentId}
              tierId={tierId}
              onClose={onClose}
            />
          )}

          {/* Game by Game Breakdown Section */}
          <div className="flex-1 overflow-y-auto py-4 px-6 max-md:px-4">
            <div className="flex justify-between items-center mb-3">
              <div className="text-caption font-bold text-fg-secondary uppercase tracking-wider">
                Games Breakdown (Bo{bestOf}{hasTiebreaker || games.length > bestOf ? ' • Tiebreaker Active' : ''})
              </div>
              {hasTiebreaker && (
                <span
                  className="text-2xs font-bold py-0.5 px-2 rounded-full"
                  style={{
                    background: colorWithAlpha(primaryColor, 0.15),
                    color: primaryColor,
                    border: `1px solid ${colorWithAlpha(primaryColor, 0.35)}`,
                  }}
                >
                  Tiebreaker Game(s) Added
                </span>
              )}
            </div>

            <div className="flex flex-col gap-3">
              {games.map((game, idx) => (
                <GameScoreCard
                  key={idx}
                  game={game}
                  idx={idx}
                  bestOf={bestOf}
                  p1={p1}
                  p2={p2}
                  p1Name={p1Name}
                  p2Name={p2Name}
                  primaryColor={primaryColor}
                  gameCardBg={gameCardBg}
                  onScoreChange={handleScoreChange}
                  onManualWinnerToggle={handleManualWinnerToggle}
                  onDeleteTiebreakerGame={handleDeleteTiebreakerGame}
                />
              ))}
            </div>

            {/* Add Tiebreaker Game Button */}
            <div className="mt-4 flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={handleAddTiebreakerGame}
                className="inline-flex items-center gap-1.5 text-caption font-semibold py-2 px-4 rounded-sm cursor-pointer transition-all duration-150"
                style={{
                  color: primaryColor,
                  background: colorWithAlpha(primaryColor, 0.08),
                  border: `1px solid ${colorWithAlpha(primaryColor, 0.35)}`,
                }}
              >
                <Plus size={15} />
                <span>+ Add Tiebreaker</span>
              </button>
              {games.some(g => g.winner === 'TIE') && (
                <span className="text-xs text-fg-muted text-center">
                  Tied game detected. Use tiebreaker games or match Best-of override if needed to resolve series.
                </span>
              )}
            </div>

            {/* Quick Forfeit Option */}
            <div className="mt-6 py-3.5 px-4 rounded-md bg-red/5 border border-red/20">
              <button
                type="button"
                aria-expanded={!isMobile || forfeitOpen}
                onClick={() => setForfeitOpen(o => !o)}
                className="flex items-center gap-2 mb-2.5 text-red-300 text-caption font-bold w-full cursor-pointer text-left"
              >
                <ShieldAlert size={15} />
                <span>Forfeit Overrides</span>
                <ChevronDown size={14} className={cn('ml-auto md:hidden', forfeitOpen && 'rotate-180')} />
              </button>
              {(!isMobile || forfeitOpen) && (
                <div className="flex gap-2 max-md:flex-col">
                  {p1 && (
                    <button
                      type="button"
                      onClick={() => void handleForfeit(p1.id)}
                      disabled={forfeit.busy || globalBusy}
                      className="inline-flex items-center gap-1.5 py-1.5 px-2.5 text-xs rounded-sm border border-red/40 bg-red/8 text-red-300 cursor-pointer transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-60 max-md:min-h-11 max-md:flex-1"
                    >
                      {forfeitingId === p1.id ? (<><Spinner />Saving…</>) : <>{p1Name} Wins</>}
                    </button>
                  )}
                  {p2 && (
                    <button
                      type="button"
                      onClick={() => void handleForfeit(p2.id)}
                      disabled={forfeit.busy || globalBusy}
                      className="inline-flex items-center gap-1.5 py-1.5 px-2.5 text-xs rounded-sm border border-red/40 bg-red/8 text-red-300 cursor-pointer transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-60 max-md:min-h-11 max-md:flex-1"
                    >
                      {forfeitingId === p2.id ? (<><Spinner />Saving…</>) : <>{p2Name} Wins</>}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {conflictNotice && (
            <div role="alert" data-testid="match-conflict-notice" className="mx-6 mb-3 rounded-sm border border-gold/40 bg-gold-soft px-3 py-2 text-sm text-gold-bright max-md:mx-4">
              {conflictNotice}
            </div>
          )}

          {/* Footer Actions */}
          <div
            className="py-4 px-6 flex gap-3 max-md:sticky max-md:bottom-0 max-md:z-10 max-md:flex-col-reverse max-md:px-4"
            style={{
              borderTop: `1px solid ${colorWithAlpha(primaryColor, 0.35, 'var(--color-line)')}`,
              background: gameCardBg,
            }}
          >
            <Button variant="secondary" onClick={requestClose} className="flex-1 py-2.5 px-4 rounded-sm max-md:w-full max-md:flex-none">
              Cancel
            </Button>
            <button
              type="button"
              onClick={() => void save.run()}
              disabled={save.busy || globalBusy}
              aria-busy={save.busy || undefined}
              className={cn(
                'flex-2 inline-flex items-center justify-center gap-2 py-2.5 px-5 rounded-sm border-0 font-bold text-sm transition-all duration-150 max-md:w-full max-md:flex-none',
                save.busy || globalBusy ? 'cursor-not-allowed opacity-70' : 'cursor-pointer opacity-100'
              )}
              style={{
                background: primaryColor,
                color: getContrastingTextColor(primaryColor),
                boxShadow: `0 2px 14px ${colorWithAlpha(primaryColor, 0.4)}`,
              }}
            >
              {save.busy ? <Spinner size={16} /> : <Check size={18} />}
              <span>{save.busy ? 'Saving…' : matchDecided ? 'Advance Winner' : 'Save Progress'}</span>
            </button>
          </div>
        </>
      )}
    </Overlay>
  );
};
