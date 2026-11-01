import React, { useState, useEffect, useMemo, useId } from 'react';
import { Tournament, PlayerProfile } from '../../tournament/types';
import { useTournament } from '../../tournament/store';
import { CreatablePlayerSelect } from './CreatablePlayerSelect';
import { Trophy, Plus, Trash2, X, Check, User } from 'lucide-react';
import { getPlayerQualifierStatus } from '../scoring';
import { Overlay } from '../../../components/overlay';
import { Button, IconButton } from '../../../components/ui';

const labelClass = 'block text-caption font-semibold text-fg-secondary mb-1.5 uppercase tracking-wide';

interface QualifierEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  tournament: Tournament;
}

export const QualifierEntryModal: React.FC<QualifierEntryModalProps> = ({
  isOpen,
  onClose,
  tournament,
}) => {
  const {
    addPlayerToPool,
    submitQualifierScore,
    deleteQualifierScore,
    globalPlayers,
    importPlayersToTournament,
  } = useTournament();

  const [selectedPlayer, setSelectedPlayer] = useState<PlayerProfile | null>(null);
  const [scoreInput, setScoreInput] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const titleId = useId();

  useEffect(() => {
    if (isOpen) {
      setSelectedPlayer(null);
      setScoreInput('');
    }
  }, [isOpen]);

  const qualStatus = useMemo(() => {
    if (!selectedPlayer) return 'not started';
    return getPlayerQualifierStatus(tournament, selectedPlayer.id);
  }, [tournament, selectedPlayer]);

  const run = (tournament.qualRuns || []).find(r => r.playerId === selectedPlayer?.id);
  const isQualLocked = run?.status === 'VERIFIED';

  if (!isOpen) return null;

  // Existing submissions for selected player
  const playerSubmissions = (tournament.qualifierSubmissions || []).filter(
    s => s.playerId === selectedPlayer?.id
  );

  const numericScore = parseInt(scoreInput, 10);
  const isScoreValid = Boolean(selectedPlayer) && !isNaN(numericScore) && numericScore > 0;

  const handlePlayerSelected = (player: PlayerProfile | null) => {
    setSelectedPlayer(player);
  };

  const handleSelectGlobalPlayer = (player: PlayerProfile) => {
    importPlayersToTournament(tournament.id, [player]);
    setSelectedPlayer(player);
  };

  const handleCreatePlayer = (name: string): PlayerProfile => {
    return addPlayerToPool(tournament.id, {
      name,
      personalBest: 0,
      playstyle: 'Rolling',
    });
  };

  const handleScoreChange = (val: string) => {
    // Only digits
    const cleaned = val.replace(/\D/g, '');
    setScoreInput(cleaned);
  };

  const handleSubmitScore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlayer || !isScoreValid || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await submitQualifierScore(tournament.id, selectedPlayer.id, numericScore, selectedPlayer.name);
      setScoreInput('');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Overlay
      open
      onClose={onClose}
      dirty={scoreInput.trim() !== ''}
      busy={isSubmitting}
      aria-labelledby={titleId}
      panelTestId="qualifier-entry-modal"
      panelClassName="flex max-h-[85vh] min-h-130 max-w-140 flex-col overflow-hidden rounded-lg border border-line bg-surface shadow-xl"
    >
      {({ requestClose }) => (
        <>
          {/* Header */}
          <div className="py-5 px-6 bg-elevated border-b border-line flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="size-8 rounded-md bg-gold-soft flex items-center justify-center text-gold-bright">
                <Trophy size={18} />
              </div>
              <div>
                <h3 id={titleId} className="text-lg font-bold text-fg">
                  Submit Qualifier Score
                </h3>
                <p className="text-xs text-fg-muted">
                  {tournament.name} • {tournament.qualFormat === 'HIGH_SCORE' ? '# of Maxes' : tournament.qualFormat.replace(/_/g, ' ')}
                </p>
              </div>
            </div>
            <IconButton aria-label="Close" onClick={requestClose}>
              <X size={18} />
            </IconButton>
          </div>

          {/* Content */}
          <div className="p-6 flex flex-col gap-5 flex-1 overflow-y-auto">
            {/* 1. Player Selection */}
            <div>
              <label className={labelClass}>Competitor</label>
              <CreatablePlayerSelect
                playersPool={tournament.playersPool}
                globalPlayers={globalPlayers}
                selectedPlayer={selectedPlayer}
                onSelectPlayer={handlePlayerSelected}
                onSelectGlobalPlayer={handleSelectGlobalPlayer}
                onCreatePlayer={handleCreatePlayer}
              />
              {tournament.playersPool.length === 0 && (
                <p className="text-caption text-fg-muted mt-1.5 italic">
                  💡 Roster is currently empty. Type a player name above to register a competitor and record their score, or select from global pool.
                </p>
              )}
            </div>

            {!selectedPlayer && tournament.playersPool.length > 0 && (
              <div className="mt-2 py-8 px-6 rounded-md bg-canvas border border-dashed border-line text-center flex flex-col items-center gap-2.5">
                <User size={28} color="var(--color-fg-muted)" />
                <div className="text-sm font-semibold text-fg-secondary">
                  Select a Competitor
                </div>
                <p className="text-caption text-fg-muted m-0 max-w-85">
                  Start typing a player's name above to search the roster or global catalog and record their qualifier score.
                </p>
              </div>
            )}

            {selectedPlayer && (
              <>
                {/* Qualifier Verification Status Bar */}
                <div className="flex items-center justify-between py-2.5 px-3.5 bg-elevated rounded-sm border border-line">
                  <div className="flex items-center gap-2">
                    <span className="text-caption text-fg-muted">Status:</span>
                    {qualStatus === 'verified' && (
                      <span className="text-xs font-bold text-green-400 flex items-center gap-1">
                        <Check size={12} /> Verified
                      </span>
                    )}
                    {qualStatus === 'in progress' && (
                      <span className="text-xs font-semibold text-gold-bright">
                        In Progress
                      </span>
                    )}
                    {qualStatus === 'not started' && (
                      <span className="text-xs font-medium text-fg-muted">
                        Not Started
                      </span>
                    )}
                  </div>
                </div>

                {/* 2. Score Submission Form */}
                {isQualLocked ? (
                  <p className="text-caption text-fg-muted">
                    This qual is verified and locked. Unverify it on the Review page to change scores.
                  </p>
                ) : (
                  <form onSubmit={handleSubmitScore} className="flex flex-col gap-3">
                    <label className={labelClass}>New Attempt Score</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={scoreInput ? parseInt(scoreInput, 10).toLocaleString() : ''}
                        onChange={e => handleScoreChange(e.target.value)}
                        placeholder="Enter score (e.g. 1,120,500)..."
                        autoFocus
                        data-autofocus
                        className="w-full py-2 px-3.5 rounded-sm border border-line bg-canvas text-fg text-lg font-bold"
                      />
                      <Button
                        type="submit"
                        variant="primary"
                        disabled={!isScoreValid || isSubmitting}
                        className="py-2 px-5 gap-1.5"
                        title={
                          !selectedPlayer
                            ? 'Select a competitor first'
                            : !isScoreValid
                            ? 'Enter a valid score greater than 0'
                            : 'Submit qualifier score'
                        }
                      >
                        {isSubmitting ? (
                          <div className="size-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                        ) : (
                          <Plus size={16} />
                        )}
                        <span>{isSubmitting ? 'Saving...' : 'Submit'}</span>
                      </Button>
                    </div>
                  </form>
                )}

                {/* 3. Existing Attempts History */}
                <div>
                  <label className={labelClass}>
                    Submitted Attempts ({playerSubmissions.length})
                  </label>
                  {playerSubmissions.length === 0 ? (
                    <div className="p-3 bg-canvas rounded-sm text-fg-muted text-sm">
                      No qualifier attempts recorded yet for this competitor.
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      {playerSubmissions.map((sub, idx) => (
                        <div
                          key={sub.id}
                          className="flex justify-between items-center py-2 px-3 bg-elevated rounded-sm border border-line-subtle"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-fg-muted font-semibold">
                              #{idx + 1}
                            </span>
                            <span className="font-mono tabular-nums tracking-tight font-bold text-base text-gold-bright">
                              {sub.score.toLocaleString()}
                            </span>
                            <span className="text-xs text-fg-muted">
                              {new Date(sub.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          {!tournament.isLocked && !isQualLocked && (
                            <button
                              type="button"
                              onClick={async () => {
                                await deleteQualifierScore(tournament.id, sub.id);
                              }}
                              className="bg-transparent border-0 text-red cursor-pointer p-1"
                              title="Delete attempt"
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="py-4 px-6 bg-elevated border-t border-line flex justify-end">
            <Button variant="secondary" onClick={requestClose} className="py-2 px-4">
              Done
            </Button>
          </div>
        </>
      )}
    </Overlay>
  );
};
