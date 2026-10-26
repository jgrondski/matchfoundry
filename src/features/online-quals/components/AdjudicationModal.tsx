import React, { useState, useRef, useEffect } from 'react';
import { CheckCircle2, AlertTriangle, ExternalLink, ShieldAlert, StickyNote, X, Edit3, Film, UserCheck, MapPin } from 'lucide-react';
import type { ReviewQueueSessionSummary } from '../../../api/qualifiers';
import { PlayerAvatar } from '../../players/components/PlayerAvatar';

export interface AdjudicationModalProps {
  isOpen: boolean;
  session: ReviewQueueSessionSummary | null;
  onClose: () => void;
  onAdjudicate: (
    action: 'VERIFY' | 'EDIT_AND_VERIFY' | 'DNQ' | 'DQ',
    options?: { scores?: number[]; judgeNotes?: string }
  ) => Promise<void>;
  onOpenIdentity?: (session: ReviewQueueSessionSummary) => void;
  isSubmitting?: boolean;
}

export const AdjudicationModal: React.FC<AdjudicationModalProps> = ({
  isOpen,
  session,
  onClose,
  onAdjudicate,
  onOpenIdentity,
  isSubmitting = false,
}) => {
  const [scores, setScores] = useState<number[]>(
    session?.scores && session.scores.length > 0 ? [...session.scores] : [0]
  );
  const [judgeNotes, setJudgeNotes] = useState<string>(session?.judgeNotes || '');
  const [confirmDQ, setConfirmDQ] = useState(false);

  if (!isOpen || !session) return null;

  const scoresChanged =
    scores.length !== session.scores.length ||
    scores.some((s, idx) => s !== session.scores[idx]);

  const newlyAddedIndexRef = useRef<number | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (newlyAddedIndexRef.current !== null) {
      const idx = newlyAddedIndexRef.current;
      newlyAddedIndexRef.current = null;
      inputRefs.current[idx]?.focus();
    }
  }, [scores.length]);

  const handleScoreChange = (idx: number, val: string) => {
    const num = parseInt(val.replace(/[^0-9]/g, ''), 10) || 0;
    const next = [...scores];
    next[idx] = num;
    setScores(next);
  };

  const handleAddGame = () => {
    newlyAddedIndexRef.current = scores.length;
    setScores(prev => [...prev, 0]);
  };

  const handleRemoveGame = (idx: number) => {
    if (scores.length <= 1) return;
    setScores(prev => prev.filter((_, i) => i !== idx));
  };

  const elapsedSeconds = session.timerLog?.elapsedSeconds || 0;
  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  const elapsedRemSec = elapsedSeconds % 60;
  const isOvertime = Boolean(session.timerLog?.overTime);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="adjudication-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
      }}
    >
      <div
        style={{
          background: 'var(--color-bg-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          width: '100%',
          maxWidth: '740px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 24px 48px rgba(0, 0, 0, 0.6)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--color-bg-surface-elevated)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <PlayerAvatar
              player={{
                name: session.playerName,
                country: session.country,
                avatarUrl: session.avatarUrl,
                avatarType: (session.avatarType as any) || 'flag',
              }}
              size={36}
            />
            <div>
              <h2
                id="adjudication-modal-title"
                style={{
                  fontSize: '1.2rem',
                  fontWeight: 800,
                  color: '#ffffff',
                  margin: 0,
                }}
              >
                Adjudicate Run: {session.playerName}
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.2rem' }}>
                {session.submittedTwitchUsername && (
                  <span style={{ fontSize: '0.8rem', color: '#a78bfa' }}>
                    Twitch: @{session.submittedTwitchUsername}
                  </span>
                )}
                {session.status !== 'SUBMITTED' && (
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      padding: '0.1rem 0.45rem',
                      borderRadius: 'var(--radius-sm)',
                      background:
                        session.status === 'VERIFIED'
                          ? 'rgba(34, 197, 94, 0.2)'
                          : 'rgba(239, 68, 68, 0.2)',
                      color:
                        session.status === 'VERIFIED'
                          ? '#4ade80'
                          : '#f87171',
                    }}
                  >
                    Status: {session.status}
                  </span>
                )}
                {onOpenIdentity && (
                  <button
                    type="button"
                    onClick={() => onOpenIdentity(session)}
                    className="btn btn-secondary"
                    style={{
                      fontSize: '0.72rem',
                      padding: '0.15rem 0.5rem',
                      color: 'var(--color-gold-bright)',
                      borderColor: 'rgba(245, 158, 11, 0.4)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      marginLeft: '0.35rem',
                    }}
                  >
                    <UserCheck size={13} />
                    Reconcile / Change Player
                  </button>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close Adjudication Dialog"
            disabled={isSubmitting}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--color-text-muted)',
              cursor: 'pointer',
              padding: '0.4rem',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div style={{ padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Overtime Alert */}
          {isOvertime && (
            <div
              style={{
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                borderRadius: 'var(--radius-md)',
                padding: '0.85rem 1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                color: '#fca5a5',
                fontSize: '0.85rem',
              }}
            >
              <AlertTriangle size={20} color="#ef4444" style={{ flexShrink: 0 }} />
              <div>
                <strong>Overtime Recorded:</strong> Submission was submitted after the official tournament window.
                Review elapsed telemetry before approving.
              </div>
            </div>
          )}

          {/* Competitor's notes from submission (also posted publicly to Discord) */}
          {session.playerNotes && (
            <div
              style={{
                background: 'rgba(168, 85, 247, 0.12)',
                border: '1px solid rgba(168, 85, 247, 0.4)',
                borderRadius: 'var(--radius-md)',
                padding: '0.85rem 1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.4rem',
                color: '#d8b4fe',
                fontSize: '0.85rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}>
                <StickyNote size={16} color="#a855f7" />
                Competitor Notes
              </div>
              <div style={{ color: '#ffffff', background: 'rgba(0,0,0,0.3)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                {session.playerNotes}
              </div>
            </div>
          )}

          {/* Authword & Twitch VOD Checklist */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '1rem',
            }}
          >
            {/* Authword HUD Box */}
            <div
              style={{
                background: 'var(--color-bg-surface-elevated)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                padding: '1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
              }}
            >
              <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--color-text-muted)', fontWeight: 700 }}>
                Assigned NES Authword
              </span>
              <div
                style={{
                  fontFamily: 'monospace',
                  fontSize: '1.4rem',
                  fontWeight: 900,
                  letterSpacing: '0.15em',
                  color: 'var(--color-gold-bright)',
                }}
              >
                {session.authWord || '-'}
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                {session.submissionSource === 'IN_PERSON'
                  ? 'In-person qualification at venue.'
                  : 'Verify this word appears on the NES 10,000 pts topout high-score screen in the VOD.'}
              </span>
            </div>

            {/* Timer Telemetry */}
            <div
              style={{
                background: 'var(--color-bg-surface-elevated)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                padding: '1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
              }}
            >
              <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--color-text-muted)', fontWeight: 700 }}>
                {session.submissionSource === 'IN_PERSON' ? 'Qual Window Time' : 'Run Elapsed Timer'}
              </span>
              <div
                style={{
                  fontFamily: 'monospace',
                  fontSize: '1.4rem',
                  fontWeight: 800,
                  color: isOvertime ? '#ef4444' : '#4ade80',
                }}
              >
                {elapsedMinutes}m {elapsedRemSec}s
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                {session.submissionSource === 'IN_PERSON'
                  ? 'In-person tournament window duration.'
                  : `Started: ${new Date(session.timerLog?.startedAt || Date.now()).toLocaleTimeString()}`}
              </span>
            </div>
          </div>

          {/* Twitch VOD Link or In-Person Marker */}
          <div
            style={{
              background: session.submissionSource === 'IN_PERSON' ? 'rgba(59, 130, 246, 0.08)' : 'rgba(167, 139, 250, 0.08)',
              border: session.submissionSource === 'IN_PERSON' ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid rgba(167, 139, 250, 0.3)',
              borderRadius: 'var(--radius-md)',
              padding: '0.85rem 1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            {session.submissionSource === 'IN_PERSON' ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <MapPin size={20} color="#60a5fa" />
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#ffffff' }}>
                      In-Person Qualification Event
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                      Scores recorded in person at venue
                    </div>
                  </div>
                </div>
                <span
                  style={{
                    fontSize: '0.78rem',
                    padding: '0.25rem 0.65rem',
                    borderRadius: 'var(--radius-sm)',
                    background: 'rgba(59, 130, 246, 0.15)',
                    color: '#60a5fa',
                    fontWeight: 700,
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                  }}
                >
                  In Person
                </span>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <Film size={20} color="#a78bfa" />
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#ffffff' }}>
                      Twitch Broadcast VOD
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                      {session.twitchVodUrl || 'No VOD URL provided'}
                    </div>
                  </div>
                </div>
                {session.twitchVodUrl && (
                  <a
                    href={session.twitchVodUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-secondary"
                    style={{
                      fontSize: '0.8rem',
                      padding: '0.35rem 0.75rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      color: '#a78bfa',
                      borderColor: 'rgba(167, 139, 250, 0.4)',
                    }}
                  >
                    Open VOD <ExternalLink size={14} />
                  </a>
                )}
              </>
            )}
          </div>

          {/* Scores Review & Adjustment */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                Submitted Game Scores:
              </label>
              <button
                type="button"
                onClick={handleAddGame}
                disabled={isSubmitting}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-gold-bright)',
                  fontSize: '0.75rem',
                  padding: '0.2rem 0.5rem',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                }}
              >
                + Add Game
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.75rem' }}>
              {scores.map((score, idx) => (
                <div
                  key={idx}
                  style={{
                    background: 'var(--color-bg-surface-elevated)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    padding: '0.5rem 0.75rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.25rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                    <span>Game {idx + 1}</span>
                    {scores.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveGame(idx)}
                        disabled={isSubmitting}
                        style={{ background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '0.7rem' }}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <input
                    ref={el => {
                      inputRefs.current[idx] = el;
                      if (newlyAddedIndexRef.current === idx && el) {
                        el.focus();
                        newlyAddedIndexRef.current = null;
                      }
                    }}
                    type="text"
                    value={score > 0 ? score.toLocaleString() : ''}
                    placeholder="e.g. 1,024,500"
                    onChange={e => handleScoreChange(idx, e.target.value)}
                    disabled={isSubmitting}
                    style={{
                      background: 'rgba(0, 0, 0, 0.4)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '0.4rem 0.6rem',
                      color: '#ffffff',
                      fontFamily: 'monospace',
                      fontWeight: 700,
                      fontSize: '0.95rem',
                    }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Judge Notes */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label htmlFor="judge-notes-input" style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
              Judge Audit Notes (Appended to submission log):
            </label>
            <textarea
              id="judge-notes-input"
              rows={2}
              value={judgeNotes}
              onChange={e => setJudgeNotes(e.target.value)}
              placeholder="e.g. Verified 10k topout Authword at 12:45 VOD mark. Score edited for Game 2."
              disabled={isSubmitting}
              style={{
                background: 'var(--color-bg-surface-elevated)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                padding: '0.6rem 0.75rem',
                color: '#ffffff',
                fontSize: '0.85rem',
                resize: 'vertical',
              }}
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid var(--color-border)',
            background: 'var(--color-bg-surface-elevated)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
            flexWrap: 'wrap',
          }}
        >
          {/* Destructive actions (DNQ, DQ) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={() => onAdjudicate('DNQ', { judgeNotes })}
              disabled={isSubmitting}
              className="btn btn-secondary"
              style={{
                color: '#fbbf24',
                borderColor: 'rgba(245, 158, 11, 0.4)',
                fontSize: '0.8rem',
              }}
            >
              Mark DNQ
            </button>
            {!confirmDQ ? (
              <button
                type="button"
                onClick={() => setConfirmDQ(true)}
                disabled={isSubmitting}
                className="btn btn-secondary"
                style={{
                  color: '#f87171',
                  borderColor: 'rgba(239, 68, 68, 0.4)',
                  fontSize: '0.8rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                }}
              >
                <ShieldAlert size={14} /> Disqualify (DQ)
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onAdjudicate('DQ', { judgeNotes })}
                disabled={isSubmitting}
                className="btn"
                style={{
                  background: '#ef4444',
                  color: '#ffffff',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                }}
              >
                Confirm Disqualify
              </button>
            )}
          </div>

          {/* Approval Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="btn btn-secondary"
              style={{ fontSize: '0.85rem' }}
            >
              Cancel
            </button>
            {scoresChanged ? (
              <button
                type="button"
                onClick={() => onAdjudicate('EDIT_AND_VERIFY', { scores, judgeNotes })}
                disabled={isSubmitting}
                className="btn btn-primary"
                style={{
                  fontSize: '0.85rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  background: '#3b82f6',
                  borderColor: '#2563eb',
                }}
              >
                <Edit3 size={15} /> Edit Score &amp; Verify
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onAdjudicate('VERIFY', { judgeNotes })}
                disabled={isSubmitting}
                className="btn btn-primary"
                style={{
                  fontSize: '0.85rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  background: '#16a34a',
                  borderColor: '#15803d',
                }}
              >
                <CheckCircle2 size={15} /> Verify Qual
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
