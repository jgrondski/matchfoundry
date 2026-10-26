import React, { useState, useEffect, useMemo } from 'react';
import { Tournament, PlayerProfile } from '../../tournament/types';
import { useTournament } from '../../tournament/store';
import { CreatablePlayerSelect } from './CreatablePlayerSelect';
import { Trophy, Plus, Trash2, X, Check, User } from 'lucide-react';
import { getPlayerQualifierStatus } from '../scoring';

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
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '1rem',
      }}
    >
      <div
        style={{
          background: 'var(--color-bg-surface)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border)',
          maxWidth: '560px',
          width: '100%',
          minHeight: '520px',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--shadow-xl)',
          overflow: 'hidden',
          animation: 'fadeIn 0.2s ease-out',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            background: 'var(--color-bg-surface-elevated)',
            borderBottom: '1px solid var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'var(--color-gold-bg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-gold-bright)',
              }}
            >
              <Trophy size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                Submit Qualifier Score
              </h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                {tournament.name} • {tournament.qualFormat === 'HIGH_SCORE' ? '# of Maxes' : tournament.qualFormat.replace(/_/g, ' ')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--color-text-muted)',
              cursor: 'pointer',
              padding: '0.25rem',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', flex: 1, overflowY: 'auto' }}>
          {/* 1. Player Selection */}
          <div>
            <label style={labelStyle}>Competitor</label>
            <CreatablePlayerSelect
              playersPool={tournament.playersPool}
              globalPlayers={globalPlayers}
              selectedPlayer={selectedPlayer}
              onSelectPlayer={handlePlayerSelected}
              onSelectGlobalPlayer={handleSelectGlobalPlayer}
              onCreatePlayer={handleCreatePlayer}
            />
            {tournament.playersPool.length === 0 && (
              <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: '0.4rem', fontStyle: 'italic' }}>
                💡 Roster is currently empty. Type a player name above to register a competitor and record their score, or select from global pool.
              </p>
            )}
          </div>

          {!selectedPlayer && tournament.playersPool.length > 0 && (
            <div
              style={{
                marginTop: '0.5rem',
                padding: '2rem 1.5rem',
                borderRadius: 'var(--radius-md)',
                background: 'var(--color-bg-base)',
                border: '1px dashed var(--color-border)',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.6rem',
              }}
            >
              <User size={28} color="var(--color-text-muted)" />
              <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                Select a Competitor
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', margin: 0, maxWidth: '340px' }}>
                Start typing a player's name above to search the roster or global catalog and record their qualifier score.
              </p>
            </div>
          )}

          {selectedPlayer && (
            <>
              {/* Qualifier Verification Status Bar */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.65rem 0.85rem',
                  background: 'var(--color-bg-surface-elevated)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-border)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Status:</span>
                  {qualStatus === 'verified' && (
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#4ade80', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Check size={12} /> Verified
                    </span>
                  )}
                  {qualStatus === 'in progress' && (
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-gold-bright)' }}>
                      In Progress
                    </span>
                  )}
                  {qualStatus === 'not started' && (
                    <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--color-text-muted)' }}>
                      Not Started
                    </span>
                  )}
                </div>
              </div>

              {/* 2. Score Submission Form */}
              <form onSubmit={handleSubmitScore} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <label style={labelStyle}>New Attempt Score</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="text"
                    value={scoreInput ? parseInt(scoreInput, 10).toLocaleString() : ''}
                    onChange={e => handleScoreChange(e.target.value)}
                    placeholder="Enter score (e.g. 1,120,500)..."
                    autoFocus
                    style={{ ...inputStyle, fontSize: '1.1rem', fontWeight: 700 }}
                  />
                  <button
                    type="submit"
                    disabled={!isScoreValid || isSubmitting}
                    className="btn btn-primary"
                    style={{
                      padding: '0.5rem 1.25rem',
                      opacity: !isScoreValid || isSubmitting ? 0.45 : 1,
                      cursor: !isScoreValid || isSubmitting ? 'not-allowed' : 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                    }}
                    title={
                      !selectedPlayer
                        ? 'Select a competitor first'
                        : !isScoreValid
                        ? 'Enter a valid score greater than 0'
                        : 'Submit qualifier score'
                    }
                  >
                    {isSubmitting ? (
                      <div
                        style={{
                          width: '14px',
                          height: '14px',
                          borderRadius: '50%',
                          border: '2px solid rgba(255,255,255,0.3)',
                          borderTopColor: '#ffffff',
                          animation: 'spin 0.8s linear infinite',
                        }}
                      />
                    ) : (
                      <Plus size={16} />
                    )}
                    <span>{isSubmitting ? 'Saving...' : 'Submit'}</span>
                  </button>
                </div>
              </form>

              {/* 3. Existing Attempts History */}
              <div>
                <label style={labelStyle}>
                  Submitted Attempts ({playerSubmissions.length})
                </label>
                {playerSubmissions.length === 0 ? (
                  <div style={{ padding: '0.75rem', background: 'var(--color-bg-base)', borderRadius: 'var(--radius-sm)', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                    No qualifier attempts recorded yet for this competitor.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    {playerSubmissions.map((sub, idx) => (
                      <div
                        key={sub.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '0.5rem 0.75rem',
                          background: 'var(--color-bg-surface-elevated)',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--color-border-subtle)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                            #{idx + 1}
                          </span>
                          <span className="tabular-nums" style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--color-gold-bright)' }}>
                            {sub.score.toLocaleString()}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                            {new Date(sub.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        {!tournament.isLocked && (
                          <button
                            type="button"
                            onClick={async () => {
                              await deleteQualifierScore(tournament.id, sub.id);
                            }}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: 'var(--color-red)',
                              cursor: 'pointer',
                              padding: '0.25rem',
                            }}
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
        <div
          style={{
            padding: '1rem 1.5rem',
            background: 'var(--color-bg-surface-elevated)',
            borderTop: '1px solid var(--color-border)',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <button onClick={onClose} className="btn btn-secondary" style={{ padding: '0.45rem 1rem' }}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.8rem',
  fontWeight: 600,
  color: 'var(--color-text-secondary)',
  marginBottom: '0.35rem',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.55rem 0.85rem',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--color-border)',
  background: 'var(--color-bg-base)',
  color: 'var(--color-text-primary)',
  fontSize: '0.875rem',
};
