import React, { useState, useEffect, useId, useMemo, useRef } from 'react';
import { BracketMatch } from '../types';
import { MatchScoreRecord } from '../../tournament/types';
import { useTournament } from '../../tournament/store';
import { ApiError } from '../../tournament/apiError';
import { MATCH_COMPLETE_CODE, MATCH_CONFLICT_CODE } from '../matchConflict';
import { shouldResyncDrawer } from '../drawerSync';
import { X, Trophy, Check, ShieldAlert, ChevronDown, Hourglass, RotateCcw } from 'lucide-react';
import {
  getDefaultTierColors,
  colorWithAlpha,
  getAlternateShade,
  getContrastingTextColor,
} from '../colorUtils';
import { MatchupBanner } from './drawer/MatchupBanner';
import { ManualSlotOverrideSection } from './drawer/ManualSlotOverrideSection';
import { GameScoreCard } from './drawer/GameScoreCard';
import {
  type GameDraft,
  draftToInput,
  draftsFromRecord,
  draftsToPayload,
  finishSummary,
  gamesEqual,
  hasStartedGames,
  normalizeDrafts,
  reopenSummary,
  waitingOn,
} from './drawer/drawerModel';
import {
  FORFEIT_REASON_MAX_LENGTH,
  TIE,
  bestOfChoices,
  canChangeBestOf,
  gameOutcome,
  isGameStarted,
  matchPhase,
  reopenBlockers,
  summarizeSeries,
  validateMatchGames,
  winsNeeded,
} from '../matchRules';
import { ConfirmDialog, Overlay } from '../../../components/overlay';
import { Button, Spinner, cn, useAction, useGlobalBusy } from '../../../components/ui';
import { DEFAULT_TIER_THEME, THEME_FALLBACK } from '../../../theme/palette';

export { gamesEqual };

interface MatchScoreDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  tournamentId: string;
  tierId: string;
  match: BracketMatch | null;
  matchScoreRecord?: MatchScoreRecord;
  roundName?: string;
}

/**
 * Score drawer for one bracket match. What it offers follows the match's phase:
 * waiting on a competitor (read-only), ready or in progress (enter games), or complete
 * (read-only result with an explicit Reopen). Finishing a match, reopening one, changing
 * best-of and recording a forfeit each ask for confirmation first.
 */
export const MatchScoreDrawer: React.FC<MatchScoreDrawerProps> = ({
  isOpen,
  onClose,
  tournamentId,
  tierId,
  match,
  matchScoreRecord,
  roundName = 'Round',
}) => {
  const { tournaments, saveMatchScores, updateMatchBestOf, forfeitMatch, reopenMatch } = useTournament();

  const currentTournament = tournaments.find(t => t.id === tournamentId);
  const currentTier = currentTournament?.tiers.find(t => t.id === tierId) || currentTournament?.tiers[0];
  const bracket = currentTier?.bracket;
  // The parent hands over a snapshot; read the live match so results and reopens show at once.
  const liveMatch = match ? bracket?.matchesById?.[match.id] ?? match : null;
  const liveRecord = (match && currentTournament?.matchScores[match.id]) || matchScoreRecord;
  const p1Id = liveMatch?.player1.player?.id;
  const p2Id = liveMatch?.player2.player?.id;
  const recordBestOf = liveRecord?.bestOf || liveMatch?.bestOf || 5;

  const [bestOf, setBestOf] = useState<number>(recordBestOf);
  const [games, setGames] = useState<GameDraft[]>([]);
  const gamesRef = useRef(games);
  gamesRef.current = games;
  const [baseRevision, setBaseRevision] = useState(0);
  const [conflictNotice, setConflictNotice] = useState<string | null>(null);
  const { busy: globalBusy } = useGlobalBusy();
  const [resyncToken, setResyncToken] = useState(0);
  const lastSyncRef = useRef<{ matchId: string; gamesJson: string } | null>(null);

  const [finishOpen, setFinishOpen] = useState(false);
  const [reopenOpen, setReopenOpen] = useState(false);
  const [pendingBestOf, setPendingBestOf] = useState<number | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [forfeitOpen, setForfeitOpen] = useState(false);
  const [forfeitWinner, setForfeitWinner] = useState<string | null>(null);
  const [forfeitReason, setForfeitReason] = useState('');

  useEffect(() => {
    if (!match) return;
    const last = lastSyncRef.current;
    if (!shouldResyncDrawer({
      lastSyncedMatchId: last?.matchId ?? null,
      lastSyncedGamesJson: last?.gamesJson ?? null,
      currentGamesJson: JSON.stringify(gamesRef.current),
      matchId: match.id,
    })) return;
    const nextGames = draftsFromRecord(liveRecord, recordBestOf, p1Id, p2Id);
    setBestOf(recordBestOf);
    setGames(nextGames);
    setBaseRevision(Number(liveRecord?.revision ?? 0));
    lastSyncRef.current = { matchId: match.id, gamesJson: JSON.stringify(nextGames) };
  }, [match, liveRecord, recordBestOf, p1Id, p2Id, resyncToken]);

  useEffect(() => {
    if (isOpen) return;
    lastSyncRef.current = null;
    setConflictNotice(null);
  }, [isOpen]);

  const baselineGames = useMemo(
    () => draftsFromRecord(liveRecord, recordBestOf, p1Id, p2Id),
    [liveRecord, recordBestOf, p1Id, p2Id]
  );
  const titleId = useId();

  const handleWriteError = (err: unknown) => {
    if (err instanceof ApiError && (err.code === MATCH_CONFLICT_CODE || err.code === MATCH_COMPLETE_CODE)) {
      setConflictNotice(err.message);
      lastSyncRef.current = null; // the next resync loads the latest stored games
      setResyncToken(n => n + 1);
      return;
    }
    throw err;
  };

  const performSave = async () => {
    if (!match) return;
    setConflictNotice(null);
    const payload = draftsToPayload(games, p1Id, p2Id);
    const hasTiebreaker = payload.some(g => g.winnerPlayerId === TIE) || payload.length > bestOf;
    try {
      const saved = await saveMatchScores(tournamentId, tierId, match.id, payload, hasTiebreaker, {
        expectedRevision: baseRevision,
      });
      if (saved) onClose(); // null means the store already reported an error; keep the judge's scores on screen
    } catch (err) {
      handleWriteError(err);
    }
  };

  const performBestOf = async (newBestOf: number) => {
    if (!match) return;
    const saved = await updateMatchBestOf(tournamentId, tierId, match.id, newBestOf);
    if (saved) {
      setBestOf(newBestOf);
      setGames(prev => normalizeDrafts(prev, newBestOf, p1Id, p2Id));
    }
    setPendingBestOf(null);
  };

  const performForfeit = async () => {
    if (!match || !forfeitWinner || !forfeitReason.trim()) return;
    const saved = await forfeitMatch(tournamentId, tierId, match.id, forfeitWinner, forfeitReason.trim());
    if (saved) {
      setForfeitOpen(false);
      onClose();
    }
  };

  const performReopen = async () => {
    if (!match) return;
    await reopenMatch(tournamentId, tierId, match.id, baseRevision);
    setReopenOpen(false);
  };

  // Actions are declared before the early return so hook order stays stable.
  const save = useAction(performSave);

  if (!isOpen || !match || !liveMatch) return null;

  const defaults = getDefaultTierColors(currentTier || {});
  const primaryColor = currentTier?.primaryColor || defaults.primaryColor || THEME_FALLBACK.primaryColor;
  const secondaryColor = currentTier?.secondaryColor || defaults.secondaryColor || DEFAULT_TIER_THEME.secondaryColor;
  const cardColor = currentTier?.cardColor || defaults.cardColor || THEME_FALLBACK.cardColor;
  const textColor = currentTier?.textColor || defaults.textColor || DEFAULT_TIER_THEME.textColor;
  const backgroundColor = currentTier?.backgroundColor || defaults.backgroundColor || THEME_FALLBACK.backgroundColor;

  const p1 = liveMatch.player1.player;
  const p2 = liveMatch.player2.player;
  const p1Name = p1?.name || (liveMatch.player1.sourceMatchId ? 'Feeder Winner' : 'TBD');
  const p2Name = p2?.name || (liveMatch.player2.sourceMatchId ? 'Feeder Winner' : 'TBD');

  const phase = matchPhase(liveMatch, liveRecord);
  const editable = phase === 'READY' || phase === 'IN_PROGRESS';
  const isComplete = phase === 'COMPLETE';
  const inputs = games.map(draftToInput);
  const series = summarizeSeries(inputs, bestOf, p1Id, p2Id);
  const draftError = editable ? validateMatchGames(inputs, bestOf, p1Id, p2Id) : null;
  const dirty = editable && !gamesEqual(games, baselineGames);
  const bestOfOptions =
    editable && canChangeBestOf(liveRecord) && !hasStartedGames(games)
      ? bestOfChoices(liveMatch.bestOf || currentTier?.bestOf)
      : null;
  const blockers = isComplete && bracket ? reopenBlockers(bracket, currentTournament?.matchScores || {}, liveMatch.id) : [];
  const forfeitNote = isComplete && liveRecord?.notes?.toLowerCase().startsWith('forfeit') ? liveRecord.notes : null;
  const winnerName = liveMatch.winnerId === p1Id ? p1Name : liveMatch.winnerId === p2Id ? p2Name : null;
  const shownGames = isComplete ? games.filter(g => isGameStarted(draftToInput(g))) : games;
  const hasTiedGame = inputs.some(g => gameOutcome(g, p1Id, p2Id) === TIE);

  const currentRound = bracket?.rounds.find(r => r.matches.some(m => m.id === liveMatch.id));
  const roundMatches = currentRound?.matches.filter(m => m.id !== liveMatch.id && !m.isBye) || [];
  const hasRecordedScores = Boolean(
    liveRecord?.isComplete || (liveRecord?.games || []).some(isGameStarted) || hasStartedGames(games)
  );

  const handleScoreChange = (gameIndex: number, playerSlot: 1 | 2, digits: string) => {
    const updated = games.map(g => ({ ...g }));
    if (playerSlot === 1) updated[gameIndex].p1 = digits;
    else updated[gameIndex].p2 = digits;
    // With both scores in, the scores decide the winner; drop any hand-picked one.
    if (updated[gameIndex].p1 !== '' && updated[gameIndex].p2 !== '') updated[gameIndex].winner = null;
    setGames(normalizeDrafts(updated, bestOf, p1Id, p2Id));
  };

  const handleManualWinnerToggle = (gameIndex: number, winnerId: string) => {
    const updated = games.map(g => ({ ...g }));
    updated[gameIndex].winner = updated[gameIndex].winner === winnerId ? null : winnerId;
    setGames(normalizeDrafts(updated, bestOf, p1Id, p2Id));
  };

  const handleSaveClick = () => {
    if (draftError) return;
    if (series.winnerId) setFinishOpen(true);
    else void save.run();
  };

  const openForfeit = () => {
    setForfeitWinner(null);
    setForfeitReason('');
    setForfeitOpen(true);
  };

  const gameCardBg = getAlternateShade(cardColor, 3);

  return (
    <Overlay
      open
      onClose={onClose}
      variant="drawer"
      dirty={dirty}
      busy={save.busy}
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
              <div className="flex items-center gap-2 flex-wrap max-md:hidden">
                <div className="flex items-center gap-1.5">
                  <Trophy size={13} color={primaryColor} />
                  <span className="text-xs font-extrabold uppercase tracking-wider" style={{ color: primaryColor }}>
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
                      style={{ background: primaryColor, boxShadow: `0 0 6px ${primaryColor}` }}
                    />
                    {currentTier.name} Tier
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2.5 flex-wrap max-md:flex-nowrap max-md:min-w-0">
                <h2 id={titleId} className="m-0 text-2xl font-extrabold text-white tracking-tight leading-tight max-md:text-lg">
                  Match #{liveMatch.matchNumber}
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

          <MatchupBanner
            p1={p1}
            p2={p2}
            p1Seed={p1?.seed}
            p2Seed={p2?.seed}
            p1Name={p1Name}
            p2Name={p2Name}
            p1Wins={series.p1Wins}
            p2Wins={series.p2Wins}
            winThreshold={winsNeeded(bestOf)}
            bestOf={bestOf}
            isP1Override={liveMatch.player1.isManualOverride}
            isP2Override={liveMatch.player2.isManualOverride}
            primaryColor={primaryColor}
            bestOfOptions={bestOfOptions}
            onBestOfChange={n => n !== bestOf && setPendingBestOf(n)}
            bestOfDisabled={globalBusy}
          />

          {/* Manual Placement Override Bar (available until a score is recorded in this match) */}
          {!isComplete && !hasRecordedScores && roundMatches.length > 0 && (
            <ManualSlotOverrideSection
              roundMatches={roundMatches}
              match={liveMatch}
              roundName={roundName}
              p1Name={p1Name}
              p2Name={p2Name}
              tournamentId={tournamentId}
              tierId={tierId}
              onClose={onClose}
            />
          )}

          <div className="flex-1 overflow-y-auto py-4 px-6 max-md:px-4">
            {phase === 'WAITING' && (
              <div
                data-testid="match-waiting"
                className="flex items-center gap-2.5 rounded-md border border-line bg-white/3 px-4 py-3.5 text-sm text-fg-secondary"
              >
                <Hourglass size={16} className="shrink-0 text-fg-muted" />
                <span>{waitingOn(bracket, liveMatch)}</span>
              </div>
            )}

            {isComplete && (
              <div
                data-testid="match-result"
                className="mb-3 rounded-md px-4 py-3"
                style={{
                  background: colorWithAlpha(primaryColor, 0.12),
                  border: `1px solid ${colorWithAlpha(primaryColor, 0.45)}`,
                }}
              >
                <div className="text-sm font-bold text-white">
                  {winnerName ? `${winnerName} wins` : 'Match complete'}
                  {!forfeitNote && winnerName ? ` ${Math.max(series.p1Wins, series.p2Wins)}–${Math.min(series.p1Wins, series.p2Wins)}` : ''}
                </div>
                {forfeitNote && <div className="mt-0.5 text-xs text-fg-secondary">{forfeitNote}</div>}
              </div>
            )}

            {phase !== 'WAITING' && shownGames.length > 0 && (
              <>
                <div className="mb-3 text-caption font-bold text-fg-secondary uppercase tracking-wider">
                  Games (Bo{bestOf})
                </div>
                <div className="flex flex-col gap-3">
                  {shownGames.map((game, idx) => (
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
                      readOnly={!editable}
                      onScoreChange={handleScoreChange}
                      onManualWinnerToggle={handleManualWinnerToggle}
                    />
                  ))}
                </div>
              </>
            )}

            {editable && hasTiedGame && !draftError && (
              <p className="mt-3 text-center text-xs text-fg-muted">Tied game: play a tiebreaker game to settle it.</p>
            )}

            {draftError && dirty && (
              <div role="alert" data-testid="match-draft-error" className="mt-3 rounded-sm border border-red/40 bg-red/8 px-3 py-2 text-sm text-red-300">
                {draftError}
              </div>
            )}

            {editable && (
              <div className="mt-6">
                <button
                  type="button"
                  aria-expanded={moreOpen}
                  onClick={() => setMoreOpen(o => !o)}
                  className="flex w-full cursor-pointer items-center gap-2 text-left text-caption font-semibold text-fg-muted"
                >
                  <span>More Options</span>
                  <ChevronDown size={14} className={cn('ml-auto transition-transform', moreOpen && 'rotate-180')} />
                </button>
                {moreOpen && (
                  <div className="mt-2.5 rounded-md border border-red/20 bg-red/5 px-4 py-3">
                    <Button variant="danger" size="sm" onClick={openForfeit} disabled={globalBusy} className="gap-1.5 max-md:min-h-11 max-md:w-full">
                      <ShieldAlert size={14} />
                      Record Forfeit
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>

          {conflictNotice && (
            <div role="alert" data-testid="match-conflict-notice" className="mx-6 mb-3 rounded-sm border border-gold/40 bg-gold-soft px-3 py-2 text-sm text-gold-bright max-md:mx-4">
              {conflictNotice}
            </div>
          )}

          {isComplete && blockers.length > 0 && (
            <p data-testid="reopen-blocked" className="mx-6 mb-3 text-xs text-fg-muted max-md:mx-4">
              To reopen, first reopen {blockers.map(b => `Match ${b.matchNumber}`).join(' and ')}. {blockers.length === 1 ? 'It already has' : 'They already have'} scores.
            </p>
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
              {editable ? 'Cancel' : 'Close'}
            </Button>

            {isComplete && (
              <Button
                variant="danger"
                onClick={() => setReopenOpen(true)}
                disabled={blockers.length > 0 || globalBusy}
                className="flex-1 gap-1.5 py-2.5 px-4 rounded-sm max-md:w-full max-md:flex-none"
              >
                <RotateCcw size={15} />
                Reopen Match
              </Button>
            )}

            {editable && (
              <button
                type="button"
                onClick={handleSaveClick}
                disabled={save.busy || globalBusy || !dirty || Boolean(draftError)}
                aria-busy={save.busy || undefined}
                data-testid="match-save"
                className={cn(
                  'flex-2 inline-flex items-center justify-center gap-2 py-2.5 px-5 rounded-sm border-0 font-bold text-sm transition-all duration-150 max-md:w-full max-md:flex-none',
                  'cursor-pointer disabled:cursor-not-allowed disabled:opacity-50'
                )}
                style={{
                  background: primaryColor,
                  color: getContrastingTextColor(primaryColor),
                  boxShadow: `0 2px 14px ${colorWithAlpha(primaryColor, 0.4)}`,
                }}
              >
                {save.busy ? <Spinner size={16} /> : <Check size={18} />}
                <span>{save.busy ? 'Saving…' : series.winnerId ? 'Finish Match' : 'Save Progress'}</span>
              </button>
            )}
          </div>

          <ConfirmDialog
            open={finishOpen}
            tone="info"
            title={`Finish Match #${liveMatch.matchNumber}?`}
            body={finishSummary(bracket, liveMatch, games, bestOf).map(line => <p key={line}>{line}</p>)}
            confirmLabel="Finish Match"
            confirmVariant="primary"
            confirmLoadingText="Saving…"
            onConfirm={async () => {
              await performSave();
              setFinishOpen(false);
            }}
            onCancel={() => setFinishOpen(false)}
          />

          <ConfirmDialog
            open={reopenOpen}
            tone="warning"
            title={`Reopen Match #${liveMatch.matchNumber}?`}
            body={reopenSummary(bracket, liveMatch).map(line => <p key={line}>{line}</p>)}
            confirmLabel="Reopen Match"
            confirmLoadingText="Reopening…"
            onConfirm={performReopen}
            onCancel={() => setReopenOpen(false)}
          />

          <ConfirmDialog
            open={pendingBestOf !== null}
            tone="info"
            title={`Change to Bo${pendingBestOf ?? ''}?`}
            body={
              <p>
                First to {winsNeeded(pendingBestOf ?? bestOf)} wins. Best-of locks once a game is scored.
              </p>
            }
            confirmLabel="Change Best-of"
            confirmVariant="primary"
            confirmLoadingText="Saving…"
            onConfirm={() => performBestOf(pendingBestOf!)}
            onCancel={() => setPendingBestOf(null)}
          />

          <ConfirmDialog
            open={forfeitOpen}
            title="Record Forfeit"
            body={
              <>
                <div>
                  <div className="mb-2 text-caption font-semibold text-fg-secondary">Who wins?</div>
                  <div className="flex gap-2 max-md:flex-col" role="radiogroup" aria-label="Forfeit winner">
                    {[p1, p2].map(player =>
                      player ? (
                        <button
                          key={player.id}
                          type="button"
                          role="radio"
                          aria-checked={forfeitWinner === player.id}
                          onClick={() => setForfeitWinner(player.id)}
                          className={cn(
                            'flex-1 cursor-pointer truncate rounded-sm border px-3 py-2 text-sm font-semibold max-md:min-h-11',
                            forfeitWinner === player.id ? 'border-gold bg-gold-soft text-gold-bright' : 'border-line bg-canvas text-fg'
                          )}
                        >
                          {player.name}
                        </button>
                      ) : null
                    )}
                  </div>
                </div>
                <label className="flex flex-col gap-1.5">
                  <span className="text-caption font-semibold text-fg-secondary">Reason</span>
                  <input
                    type="text"
                    value={forfeitReason}
                    onChange={e => setForfeitReason(e.target.value)}
                    maxLength={FORFEIT_REASON_MAX_LENGTH}
                    placeholder="e.g. No-show"
                    data-testid="forfeit-reason"
                    className="rounded-sm border border-line bg-canvas px-3 py-2 text-sm text-fg outline-none focus:border-gold"
                  />
                </label>
                <p className="text-xs text-fg-muted">The winner advances. You can undo this with Reopen Match.</p>
              </>
            }
            confirmLabel="Record Forfeit"
            confirmLoadingText="Saving…"
            confirmDisabled={!forfeitWinner || !forfeitReason.trim()}
            onConfirm={performForfeit}
            onCancel={() => setForfeitOpen(false)}
          />
        </>
      )}
    </Overlay>
  );
};
