import React, { useState, useRef, useEffect, useId } from 'react';
import { CheckCircle2, AlertTriangle, ExternalLink, ShieldAlert, StickyNote, X, Edit3, Film, UserCheck, MapPin } from 'lucide-react';
import type { ReviewQueueSessionSummary } from '../../../api/qualifiers';
import { PlayerAvatar } from '../../players/components/PlayerAvatar';
import { Overlay } from '../../../components/overlay';
import { Button, IconButton, buttonClasses, cn } from '../../../components/ui';

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
  const titleId = useId();

  if (!isOpen || !session) return null;

  const scoresChanged =
    scores.length !== session.scores.length ||
    scores.some((s, idx) => s !== session.scores[idx]);

  const initialScores = session?.scores && session.scores.length > 0 ? [...session.scores] : [0];
  const isDirty =
    scores.length !== initialScores.length ||
    scores.some((s, idx) => s !== initialScores[idx]) ||
    judgeNotes !== (session?.judgeNotes || '') ||
    confirmDQ;

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
    <Overlay
      open
      onClose={onClose}
      dirty={isDirty}
      busy={isSubmitting}
      aria-labelledby={titleId}
      panelClassName="flex max-h-[92vh] max-w-185 flex-col overflow-hidden rounded-lg border border-line bg-surface shadow-[0_24px_48px_rgba(0,0,0,0.6)]"
    >
      {({ requestClose }) => (
        <>
          {/* Header */}
          <div className="flex items-center justify-between border-b border-line bg-elevated px-6 py-5">
            <div className="flex items-center gap-3">
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
                <h2 id={titleId} className="m-0 text-lg font-extrabold text-white">
                  Adjudicate Run: {session.playerName}
                </h2>
                <div className="mt-1 flex items-center gap-2">
                  {session.submittedTwitchUsername && (
                    <span className="text-caption text-violet-400">
                      Twitch: @{session.submittedTwitchUsername}
                    </span>
                  )}
                  {session.status !== 'SUBMITTED' && (
                    <span
                      className={cn(
                        'rounded-sm px-2 py-0.5 text-xs font-bold',
                        session.status === 'VERIFIED' ? 'bg-green-500/20 text-green-400' : 'bg-red/20 text-red-bright'
                      )}
                    >
                      Status: {session.status}
                    </span>
                  )}
                  {onOpenIdentity && (
                    <Button
                      type="button"
                      onClick={() => onOpenIdentity(session)}
                      variant="secondary"
                      className="ml-1.5 inline-flex items-center gap-1 border-gold/40 px-2 py-0.5 text-xs text-gold-bright enabled:hover:border-gold/40"
                    >
                      <UserCheck size={13} />
                      Reconcile / Change Player
                    </Button>
                  )}
                </div>
              </div>
            </div>
            <IconButton
              onClick={requestClose}
              aria-label="Close Adjudication Dialog"
              disabled={isSubmitting}
              className="p-1.5"
            >
              <X size={20} />
            </IconButton>
          </div>

          {/* Scrollable Content */}
          <div className="flex flex-col gap-5 overflow-y-auto p-6">
            {/* Overtime Alert */}
            {isOvertime && (
              <div className="flex items-center gap-3 rounded-md border border-red/40 bg-red/12 px-4 py-3.5 text-sm text-red-300">
                <AlertTriangle size={20} color="#ef4444" className="shrink-0" />
                <div>
                  <strong>Overtime Recorded:</strong> Submission was submitted after the official tournament window.
                  Review elapsed telemetry before approving.
                </div>
              </div>
            )}

            {/* Competitor's notes from submission (also posted publicly to Discord) */}
            {session.playerNotes && (
              <div className="flex flex-col gap-1.5 rounded-md border border-purple-500/40 bg-purple-500/12 px-4 py-3.5 text-sm text-[#d8b4fe]">
                <div className="flex items-center gap-2 font-bold">
                  <StickyNote size={16} color="#a855f7" />
                  Competitor Notes
                </div>
                <div className="whitespace-pre-wrap rounded-sm bg-black/30 px-3 py-2 text-white wrap-anywhere">
                  {session.playerNotes}
                </div>
              </div>
            )}

            {/* Authword & Twitch VOD Checklist */}
            <div className="grid grid-cols-2 gap-4">
              {/* Authword HUD Box */}
              <div className="flex flex-col gap-2 rounded-md border border-line bg-elevated p-4">
                <span className="text-xs font-bold uppercase text-fg-muted">
                  Assigned NES Authword
                </span>
                <div className="font-mono text-2xl font-black tracking-widest text-gold-bright">
                  {session.authWord || '-'}
                </div>
                <span className="text-xs text-fg-secondary">
                  {session.submissionSource === 'IN_PERSON'
                    ? 'In-person qualification at venue.'
                    : 'Verify this word appears on the NES 10,000 pts topout high-score screen in the VOD.'}
                </span>
              </div>

              {/* Timer Telemetry */}
              <div className="flex flex-col gap-2 rounded-md border border-line bg-elevated p-4">
                <span className="text-xs font-bold uppercase text-fg-muted">
                  {session.submissionSource === 'IN_PERSON' ? 'Qual Window Time' : 'Run Elapsed Timer'}
                </span>
                <div className={cn('font-mono text-2xl font-extrabold', isOvertime ? 'text-red' : 'text-green-400')}>
                  {elapsedMinutes}m {elapsedRemSec}s
                </div>
                <span className="text-xs text-fg-secondary">
                  {session.submissionSource === 'IN_PERSON'
                    ? 'In-person tournament window duration.'
                    : `Started: ${new Date(session.timerLog?.startedAt || Date.now()).toLocaleTimeString()}`}
                </span>
              </div>
            </div>

            {/* Twitch VOD Link or In-Person Marker */}
            <div
              className={cn(
                'flex items-center justify-between rounded-md border px-4 py-3.5',
                session.submissionSource === 'IN_PERSON'
                  ? 'border-blue-500/30 bg-blue-500/8'
                  : 'border-violet-400/30 bg-violet-400/8'
              )}
            >
              {session.submissionSource === 'IN_PERSON' ? (
                <>
                  <div className="flex items-center gap-2.5">
                    <MapPin size={20} color="#60a5fa" />
                    <div>
                      <div className="text-sm font-bold text-white">
                        In-Person Qualification Event
                      </div>
                      <div className="text-xs text-fg-muted">
                        Scores recorded in person at venue
                      </div>
                    </div>
                  </div>
                  <span className="rounded-sm border border-blue-500/30 bg-blue-500/15 px-2.5 py-1 text-caption font-bold text-blue-400">
                    In Person
                  </span>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2.5">
                    <Film size={20} color="#a78bfa" />
                    <div>
                      <div className="text-sm font-bold text-white">
                        Twitch Broadcast VOD
                      </div>
                      <div className="text-xs text-fg-muted">
                        {session.twitchVodUrl || 'No VOD URL provided'}
                      </div>
                    </div>
                  </div>
                  {session.twitchVodUrl && (
                    <a
                      href={session.twitchVodUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={buttonClasses({
                        variant: 'secondary',
                        size: 'sm',
                        className: 'border-violet-400/40 text-caption text-violet-400 hover:border-violet-400/40 hover:bg-highlight',
                      })}
                    >
                      Open VOD <ExternalLink size={14} />
                    </a>
                  )}
                </>
              )}
            </div>

            {/* Scores Review & Adjustment */}
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold text-fg">
                  Submitted Game Scores:
                </label>
                <button
                  type="button"
                  onClick={handleAddGame}
                  disabled={isSubmitting}
                  className="cursor-pointer rounded-sm border border-line bg-transparent px-2 py-1 text-xs text-gold-bright"
                >
                  + Add Game
                </button>
              </div>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3">
                {scores.map((score, idx) => (
                  <div
                    key={idx}
                    className="flex flex-col gap-1 rounded-md border border-line bg-elevated px-3 py-2"
                  >
                    <div className="flex justify-between text-xs text-fg-muted">
                      <span>Game {idx + 1}</span>
                      {scores.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveGame(idx)}
                          disabled={isSubmitting}
                          className="cursor-pointer border-0 bg-transparent text-2xs text-red-bright"
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
                      className="rounded-sm border border-line bg-black/40 px-2.5 py-1.5 font-mono text-base font-bold text-white"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Judge Notes */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="judge-notes-input" className="text-sm font-bold text-fg">
                Judge Audit Notes (Appended to submission log):
              </label>
              <textarea
                id="judge-notes-input"
                rows={2}
                value={judgeNotes}
                onChange={e => setJudgeNotes(e.target.value)}
                placeholder="e.g. Verified 10k topout Authword at 12:45 VOD mark. Score edited for Game 2."
                disabled={isSubmitting}
                className="resize-y rounded-sm border border-line bg-elevated px-3 py-2.5 text-sm text-white"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-elevated px-6 py-4">
            {/* Destructive actions (DNQ, DQ) */}
            <div className="flex items-center gap-2">
              <Button
                type="button"
                onClick={() => onAdjudicate('DNQ', { judgeNotes })}
                disabled={isSubmitting}
                variant="secondary"
                className="border-gold/40 text-caption text-gold-bright enabled:hover:border-gold/40"
              >
                Mark DNQ
              </Button>
              {!confirmDQ ? (
                <Button
                  type="button"
                  onClick={() => setConfirmDQ(true)}
                  disabled={isSubmitting}
                  variant="secondary"
                  className="inline-flex items-center gap-1.5 border-red/40 text-caption text-red-bright enabled:hover:border-red/40"
                >
                  <ShieldAlert size={14} /> Disqualify (DQ)
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={() => onAdjudicate('DQ', { judgeNotes })}
                  disabled={isSubmitting}
                  variant="danger"
                  className="border-transparent bg-red text-caption font-bold text-white"
                >
                  Confirm Disqualify
                </Button>
              )}
            </div>

            {/* Approval Actions */}
            <div className="flex items-center gap-3">
              <Button
                type="button"
                onClick={requestClose}
                disabled={isSubmitting}
                variant="secondary"
                className="text-sm"
              >
                Cancel
              </Button>
              {scoresChanged ? (
                <Button
                  type="button"
                  onClick={() => onAdjudicate('EDIT_AND_VERIFY', { scores, judgeNotes })}
                  disabled={isSubmitting}
                  variant="primary"
                  className="inline-flex items-center gap-1.5 text-sm border-blue-600 bg-blue-500 bg-none"
                >
                  <Edit3 size={15} /> Edit Score &amp; Verify
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={() => onAdjudicate('VERIFY', { judgeNotes })}
                  disabled={isSubmitting}
                  variant="primary"
                  className="inline-flex items-center gap-1.5 text-sm border-[#15803d] bg-[#16a34a] bg-none"
                >
                  <CheckCircle2 size={15} /> Verify Qual
                </Button>
              )}
            </div>
          </div>
        </>
      )}
    </Overlay>
  );
};
