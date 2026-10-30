import React, { useState, useEffect } from 'react';
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
  const [games, setGames] = useState<Array<{ p1: string; p2: string; winner: string | null }>>([]);
  const [hasTiebreaker, setHasTiebreaker] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!match) return;
    const currentBestOf = liveRecord?.bestOf || match.bestOf || 5;
    setBestOf(currentBestOf);

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
    setGames(initialGames);
    setHasTiebreaker(Boolean(liveRecord?.hasTiebreaker || recordedCount > currentBestOf));
  }, [match, liveRecord]);

  // Keyboard escape listener to close drawer smoothly
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

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
    <div style={overlayStyle} onClick={onClose}>
      <div
        data-testid="match-score-drawer"
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

        {/* Glow-up Header matching PlayerDetailDrawer */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: `1px solid ${colorWithAlpha(primaryColor, 0.35, 'var(--color-border)')}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            background: gameCardBg,
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.35)',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', minWidth: 0, flex: 1 }}>
            {/* Tournament Title & Active Tier Badge Row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
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
                  {currentTournament?.name || 'Tournament'}
                </span>
              </div>

              {currentTier?.name && (
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
                  {currentTier.name} Tier
                </span>
              )}
            </div>

            {/* Match Hero Row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
              <h2
                style={{
                  margin: 0,
                  fontSize: '1.45rem',
                  fontWeight: 800,
                  color: '#ffffff',
                  letterSpacing: '-0.02em',
                  lineHeight: 1.2,
                }}
              >
                Match #{match.matchNumber}
              </h2>
              <span
                style={{
                  fontSize: '0.92rem',
                  fontWeight: 600,
                  color: textColor,
                  lineHeight: 1.2,
                }}
              >
                • {roundName}
              </span>
            </div>
          </div>

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
            style={{
              margin: '0.85rem 1.5rem 0',
              padding: '0.65rem 1rem',
              borderRadius: 'var(--radius-md)',
              background: colorWithAlpha(primaryColor, 0.12),
              border: `1px solid ${colorWithAlpha(primaryColor, 0.35)}`,
              color: primaryColor,
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
              fontSize: '0.85rem',
              fontWeight: 600,
            }}
          >
            <Trophy size={18} color={primaryColor} />
            <span>
              <strong style={{ fontWeight: 800 }}>Match Point Clinched!</strong> Winner:{' '}
              {p1Wins >= winThreshold ? p1Name : p2Name}
            </span>
          </div>
        )}

        {/* Game by Game Breakdown Section */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Games Breakdown (Bo{bestOf}{hasTiebreaker || games.length > bestOf ? ' • Tiebreaker Active' : ''})
            </div>
            {hasTiebreaker && (
              <span
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  padding: '0.1rem 0.45rem',
                  borderRadius: 'var(--radius-full)',
                  background: colorWithAlpha(primaryColor, 0.15),
                  color: primaryColor,
                  border: `1px solid ${colorWithAlpha(primaryColor, 0.35)}`,
                }}
              >
                Tiebreaker Game(s) Added
              </span>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
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
          <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={handleAddTiebreakerGame}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontSize: '0.82rem',
                fontWeight: 600,
                padding: '0.5rem 1rem',
                borderRadius: 'var(--radius-sm)',
                color: primaryColor,
                background: colorWithAlpha(primaryColor, 0.08),
                border: `1px solid ${colorWithAlpha(primaryColor, 0.35)}`,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <Plus size={15} />
              <span>+ Add Tiebreaker Game</span>
            </button>
            {games.some(g => g.winner === 'TIE') && (
              <span style={{ fontSize: '0.725rem', color: 'var(--color-text-muted)', textAlign: 'center' }}>
                Tied game detected. Use tiebreaker games or match Best-of override if needed to resolve series.
              </span>
            )}
          </div>

          {/* Quick Forfeit Option */}
          <div
            style={{
              marginTop: '1.5rem',
              padding: '0.85rem 1rem',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(239, 68, 68, 0.05)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.65rem', color: '#fca5a5', fontSize: '0.8rem', fontWeight: 700 }}>
              <ShieldAlert size={15} />
              <span>Forfeit / Disqualification Overrides</span>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {p1 && (
                <button
                  type="button"
                  onClick={() => handleForfeit(p1.id)}
                  style={{
                    ...btnSmallStyle,
                    color: '#fca5a5',
                    borderColor: 'rgba(239, 68, 68, 0.4)',
                    background: 'rgba(239, 68, 68, 0.08)',
                  }}
                >
                  Award Win to {p1Name}
                </button>
              )}
              {p2 && (
                <button
                  type="button"
                  onClick={() => handleForfeit(p2.id)}
                  style={{
                    ...btnSmallStyle,
                    color: '#fca5a5',
                    borderColor: 'rgba(239, 68, 68, 0.4)',
                    background: 'rgba(239, 68, 68, 0.08)',
                  }}
                >
                  Award Win to {p2Name}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderTop: `1px solid ${colorWithAlpha(primaryColor, 0.35, 'var(--color-border)')}`,
            background: gameCardBg,
            display: 'flex',
            gap: '0.75rem',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary"
            style={{
              flex: 1,
              padding: '0.65rem 1rem',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSaveAndAdvance}
            disabled={isSaving}
            style={{
              flex: 2,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              padding: '0.65rem 1.25rem',
              borderRadius: 'var(--radius-sm)',
              background: primaryColor,
              color: getContrastingTextColor(primaryColor),
              border: 'none',
              fontWeight: 700,
              fontSize: '0.9rem',
              cursor: isSaving ? 'not-allowed' : 'pointer',
              opacity: isSaving ? 0.7 : 1,
              boxShadow: `0 2px 14px ${colorWithAlpha(primaryColor, 0.4)}`,
              transition: 'all 0.15s ease',
            }}
          >
            {isSaving ? (
              <div
                style={{
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  border: '2px solid rgba(255,255,255,0.3)',
                  borderTopColor: '#ffffff',
                  animation: 'spin 0.8s linear infinite',
                }}
              />
            ) : (
              <Check size={18} />
            )}
            <span>{isSaving ? 'Saving...' : matchDecided ? 'Save & Advance Winner' : 'Save Match Progress'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0, 0, 0, 0.7)',
  backdropFilter: 'blur(5px)',
  display: 'flex',
  justifyContent: 'flex-end',
  zIndex: 1000,
  animation: 'fadeIn 0.2s ease-out',
};

const drawerStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: '520px',
  height: '100%',
  background: '#0d1117',
  borderLeft: '1px solid var(--color-border)',
  display: 'flex',
  flexDirection: 'column',
  boxShadow: '-8px 0 32px rgba(0, 0, 0, 0.6)',
  animation: 'slideInRight 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
  position: 'relative',
  overflow: 'hidden',
};


const btnSmallStyle: React.CSSProperties = {
  padding: '0.35rem 0.6rem',
  fontSize: '0.75rem',
  borderRadius: 'var(--radius-sm)',
  background: 'transparent',
  border: '1px solid',
  cursor: 'pointer',
  transition: 'all 0.15s ease',
};
