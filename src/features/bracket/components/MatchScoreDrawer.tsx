import React, { useState, useEffect, useId, useMemo } from 'react';
import { BracketMatch } from '../types';
import { MatchScoreRecord } from '../../tournament/types';
import { useTournament } from '../../tournament/store';
import { X, Trophy, Check, ShieldAlert, Plus } from 'lucide-react';
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
import { Button, cn } from '../../../components/ui';

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
  const [hasTiebreaker, setHasTiebreaker] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!match) return;
    const currentBestOf = liveRecord?.bestOf || match.bestOf || 5;
    setBestOf(currentBestOf);

    const recordedCount = liveRecord?.games?.length || 0;
    setGames(deriveInitialGames(match, liveRecord));
    setHasTiebreaker(Boolean(liveRecord?.hasTiebreaker || recordedCount > currentBestOf));
  }, [match, liveRecord]);

  const baselineGames = useMemo(() => (match ? deriveInitialGames(match, liveRecord) : []), [match, liveRecord]);
  const titleId = useId();

  if (!isOpen || !match) return null;

  // Resolve tournament & tier theme colors matching PlayerDetailDrawer conventions
  const currentTournament = tournaments.find(t => t.id === tournamentId);
  const currentTier = currentTournament?.tiers.find(t => t.id === tierId) || currentTournament?.tiers[0];
  const defaults = getDefaultTierColors(currentTier || {});
  const primaryColor = currentTier?.primaryColor || defaults.primaryColor || '#f59e0b';
  const secondaryColor = currentTier?.secondaryColor || defaults.secondaryColor || '#705b33';
  const cardColor = currentTier?.cardColor || defaults.cardColor || '#161922';
  const textColor = currentTier?.textColor || defaults.textColor || '#94A3B8';
  const backgroundColor = currentTier?.backgroundColor || defaults.backgroundColor || '#0c0d12';

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

  const handleBestOfChange = async (newBestOf: number) => {
    setBestOf(newBestOf);
    await updateMatchBestOf(tournamentId, tierId, match.id, newBestOf);
    const updated = [...games];
    while (updated.length < newBestOf) {
      updated.push({ p1: '', p2: '', winner: null });
    }
    setGames(updated);
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

  const handleSaveAndAdvance = async () => {
    setIsSaving(true);
    try {
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

      await saveMatchScores(
        tournamentId,
        tierId,
        match.id,
        formattedGames,
        shouldRecordTiebreaker
      );
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const handleForfeit = async (winnerPlayerId: string) => {
    if (window.confirm(`Award forfeit win to ${winnerPlayerId === p1?.id ? p1Name : p2Name}?`)) {
      setIsSaving(true);
      try {
        await forfeitMatch(tournamentId, tierId, match.id, winnerPlayerId);
        onClose();
      } finally {
        setIsSaving(false);
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
      busy={isSaving}
      aria-labelledby={titleId}
      panelTestId="match-score-drawer"
      panelStyle={{
        background: `linear-gradient(180deg, ${getAlternateShade(cardColor, 2)} 0%, ${backgroundColor} 100%)`,
        borderLeft: `1px solid ${colorWithAlpha(primaryColor, 0.45, 'var(--color-border)')}`,
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
            className="py-5 px-6 flex justify-between items-start shadow-[0_4px_20px_rgba(0,0,0,0.35)] gap-4"
            style={{
              borderBottom: `1px solid ${colorWithAlpha(primaryColor, 0.35, 'var(--color-border)')}`,
              background: gameCardBg,
            }}
          >
            <div className="flex flex-col gap-2 min-w-0 flex-1">
              {/* Tournament Title & Active Tier Badge Row */}
              <div className="flex items-center gap-2 flex-wrap">
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
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2
                  id={titleId}
                  className="m-0 text-2xl font-extrabold text-white tracking-tight leading-tight"
                >
                  Match #{match.matchNumber}
                </h2>
                <span className="text-base font-semibold leading-tight" style={{ color: textColor }}>
                  • {roundName}
                </span>
              </div>
            </div>

            <button
              onClick={requestClose}
              aria-label="Close drawer"
              className={cn(
                'bg-white/4 border border-(color:--close-border) text-fg-muted cursor-pointer p-2 rounded-md flex items-center justify-center transition-all duration-150 shrink-0',
                'hover:text-white hover:border-(color:--close-accent) hover:bg-(--close-hover-bg) hover:shadow-[0_0_10px_var(--close-hover-glow)]'
              )}
              style={
                {
                  '--close-border': colorWithAlpha(primaryColor, 0.35, 'var(--color-border)'),
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

          {/* Match Clinched Alert Banner */}
          {matchDecided && (
            <div
              className="mt-3.5 mx-6 mb-0 py-2.5 px-4 rounded-md flex items-center gap-2.5 text-sm font-semibold"
              style={{
                background: colorWithAlpha(primaryColor, 0.12),
                border: `1px solid ${colorWithAlpha(primaryColor, 0.35)}`,
                color: primaryColor,
              }}
            >
              <Trophy size={18} color={primaryColor} />
              <span>
                <strong className="font-extrabold">Match Point Clinched!</strong> Winner:{' '}
                {p1Wins >= winThreshold ? p1Name : p2Name}
              </span>
            </div>
          )}

          {/* Game by Game Breakdown Section */}
          <div className="flex-1 overflow-y-auto py-4 px-6">
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
                <span>+ Add Tiebreaker Game</span>
              </button>
              {games.some(g => g.winner === 'TIE') && (
                <span className="text-xs text-fg-muted text-center">
                  Tied game detected. Use tiebreaker games or match Best-of override if needed to resolve series.
                </span>
              )}
            </div>

            {/* Quick Forfeit Option */}
            <div className="mt-6 py-3.5 px-4 rounded-md bg-red/5 border border-red/20">
              <div className="flex items-center gap-2 mb-2.5 text-red-300 text-caption font-bold">
                <ShieldAlert size={15} />
                <span>Forfeit / Disqualification Overrides</span>
              </div>
              <div className="flex gap-2">
                {p1 && (
                  <button
                    type="button"
                    onClick={() => handleForfeit(p1.id)}
                    className="py-1.5 px-2.5 text-xs rounded-sm border border-red/40 bg-red/8 text-red-300 cursor-pointer transition-all duration-150"
                  >
                    Award Win to {p1Name}
                  </button>
                )}
                {p2 && (
                  <button
                    type="button"
                    onClick={() => handleForfeit(p2.id)}
                    className="py-1.5 px-2.5 text-xs rounded-sm border border-red/40 bg-red/8 text-red-300 cursor-pointer transition-all duration-150"
                  >
                    Award Win to {p2Name}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div
            className="py-4 px-6 flex gap-3"
            style={{
              borderTop: `1px solid ${colorWithAlpha(primaryColor, 0.35, 'var(--color-border)')}`,
              background: gameCardBg,
            }}
          >
            <Button variant="secondary" onClick={requestClose} className="flex-1 py-2.5 px-4 rounded-sm">
              Cancel
            </Button>
            <button
              type="button"
              onClick={handleSaveAndAdvance}
              disabled={isSaving}
              className={cn(
                'flex-2 inline-flex items-center justify-center gap-2 py-2.5 px-5 rounded-sm border-0 font-bold text-sm transition-all duration-150',
                isSaving ? 'cursor-not-allowed opacity-70' : 'cursor-pointer opacity-100'
              )}
              style={{
                background: primaryColor,
                color: getContrastingTextColor(primaryColor),
                boxShadow: `0 2px 14px ${colorWithAlpha(primaryColor, 0.4)}`,
              }}
            >
              {isSaving ? (
                <div className="size-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              ) : (
                <Check size={18} />
              )}
              <span>{isSaving ? 'Saving...' : matchDecided ? 'Save & Advance Winner' : 'Save Match Progress'}</span>
            </button>
          </div>
        </>
      )}
    </Overlay>
  );
};
