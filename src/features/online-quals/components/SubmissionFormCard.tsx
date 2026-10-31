import React from 'react';
import { Send, Plus, Trash2, Video, AlertCircle } from 'lucide-react';
import type { PointsThreshold, QualFormat } from '../../tournament/types';
import { PLAYER_NOTES_MAX_LENGTH } from '../discordMessages';
import { summarizeQualScores, type QualScoreSummary } from '../../qualifiers/qualSummary';
import { cn } from '../../../components/ui';

const SUMMARY_DEBOUNCE_MS = 400;

export interface SubmissionFormCardProps {
  qualFormat: QualFormat;
  qualAverageCount?: number;
  pointsConfig?: PointsThreshold[];
  scores: number[];
  onScoresChange: (scores: number[]) => void;
  twitchVodUrl: string;
  onTwitchVodUrlChange: (url: string) => void;
  playerNotes: string;
  onPlayerNotesChange: (notes: string) => void;
  onSubmit: () => void;
  isSubmitting?: boolean;
  errorMessage?: string | null;
  disabled?: boolean;
}

export const SubmissionFormCard: React.FC<SubmissionFormCardProps> = ({
  qualFormat,
  qualAverageCount = 2,
  pointsConfig,
  scores,
  onScoresChange,
  twitchVodUrl,
  onTwitchVodUrlChange,
  playerNotes,
  onPlayerNotesChange,
  onSubmit,
  isSubmitting = false,
  errorMessage,
  disabled = false,
}) => {
  const isAverage = qualFormat === 'AVERAGE_OF_X' || (qualFormat as any) === 'AVERAGE';
  const expectedCount = isAverage ? Math.max(1, qualAverageCount) : Math.max(1, scores.length);

  const newlyAddedIndexRef = React.useRef<number | null>(null);
  const inputRefs = React.useRef<(HTMLInputElement | null)[]>([]);

  // For average format, ensure exactly expectedCount score slots
  let currentScores: number[];
  if (isAverage) {
    currentScores = new Array(expectedCount)
      .fill(0)
      .map((_, i) => (scores[i] !== undefined ? scores[i] : 0));
  } else {
    currentScores = scores.length === 0 ? [0] : scores;
  }

  // The summary trails typing slightly (or catches up when a score field loses focus) so totals
  // don't flicker through partial values like 8 -> 84 -> 845 while a score is being typed.
  const [summaryScores, setSummaryScores] = React.useState<number[]>(currentScores);
  const scoresKey = currentScores.join(',');
  React.useEffect(() => {
    const timer = setTimeout(() => setSummaryScores(scoresKey.split(',').map(Number)), SUMMARY_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [scoresKey]);
  const summary = summarizeQualScores({ qualFormat, qualAverageCount, pointsConfig }, summaryScores);

  React.useEffect(() => {
    if (newlyAddedIndexRef.current !== null) {
      const idx = newlyAddedIndexRef.current;
      newlyAddedIndexRef.current = null;
      inputRefs.current[idx]?.focus();
    }
  }, [currentScores.length]);

  const handleScoreChange = (index: number, valStr: string) => {
    const rawNumber = parseInt(valStr.replace(/[^0-9]/g, ''), 10);
    const parsed = Number.isNaN(rawNumber) ? 0 : rawNumber;
    const next = [...currentScores];
    next[index] = parsed;
    onScoresChange(next);
  };

  const handleAddAttempt = () => {
    newlyAddedIndexRef.current = currentScores.length;
    onScoresChange([...currentScores, 0]);
  };

  const handleRemoveAttempt = (index: number) => {
    if (currentScores.length <= 1) return;
    const next = currentScores.filter((_, idx) => idx !== index);
    onScoresChange(next);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (disabled || isSubmitting) return;
    onSubmit();
  };

  const hasValidScores = currentScores.length > 0 && currentScores.some(s => s > 0);
  const hasValidVod = Boolean(twitchVodUrl.trim() && twitchVodUrl.includes('twitch.tv'));
  const canSubmit = hasValidScores && hasValidVod && !isSubmitting && !disabled;

  return (
    <div
      className="flex flex-col gap-5 rounded-md border border-line bg-surface p-6"
      data-testid="submission-form-card"
    >
      <div>
        <h3 className="m-0 text-lg font-extrabold text-white">
          Official Score Submission
        </h3>
      </div>

      {errorMessage && (
        <div
          className="flex items-center gap-2 rounded-md border border-red/30 bg-red/10 px-4 py-3 text-sm text-red-bright"
          data-testid="submission-error-banner"
        >
          <AlertCircle size={16} />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {/* Game Scores Block */}
        <div>
          <label className="mb-2 block text-sm font-bold text-slate-200">
            {isAverage ? `Top ${expectedCount} Game Scores (Average of ${expectedCount})` : 'Game Score Attempts'}
          </label>

          <div className="flex flex-col gap-2.5">
            {currentScores.map((scoreVal, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <span className="w-18.75 text-sm font-bold text-fg-secondary">
                  Game {idx + 1}:
                </span>
                <input
                  ref={el => {
                    inputRefs.current[idx] = el;
                    if (newlyAddedIndexRef.current === idx && el) {
                      el.focus();
                      newlyAddedIndexRef.current = null;
                    }
                  }}
                  type="text"
                  value={scoreVal === 0 ? '' : scoreVal.toLocaleString()}
                  onChange={e => handleScoreChange(idx, e.target.value)}
                  onBlur={() => setSummaryScores(currentScores)}
                  placeholder="0"
                  disabled={disabled}
                  className="flex-1 rounded-md border border-line bg-canvas px-3.5 py-2.5 font-mono text-base font-bold text-white"
                  data-testid={`score-input-${idx}`}
                />
                {!isAverage && currentScores.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveAttempt(idx)}
                    disabled={disabled}
                    className="cursor-pointer border-0 bg-transparent p-1.5 text-red-bright"
                    title="Remove attempt"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>

          {!isAverage && (
            <button
              type="button"
              onClick={handleAddAttempt}
              disabled={disabled}
              className="mt-2.5 inline-flex cursor-pointer items-center gap-1.5 rounded-sm border border-line bg-white/5 px-3.5 py-1.5 text-caption font-semibold text-fg-secondary"
            >
              <Plus size={14} /> Add Another Attempt
            </button>
          )}
        </div>

        {summary && <QualScoreSummaryPanel summary={summary} />}

        {/* Twitch VOD URL Input */}
        <div>
          <label className="mb-1.5 block text-sm font-bold text-slate-200">
            Twitch Broadcast VOD URL *
          </label>
          <div className="relative">
            <div className="absolute top-1/2 left-3.5 -translate-y-1/2 text-fg-muted">
              <Video size={16} />
            </div>
            <input
              type="url"
              value={twitchVodUrl}
              onChange={e => onTwitchVodUrlChange(e.target.value)}
              placeholder="https://twitch.tv/videos/2481093821?t=00h14m20s"
              disabled={disabled}
              required
              className="w-full rounded-md border border-line bg-canvas py-3 pr-3.5 pl-10 text-base text-white"
              data-testid="twitch-vod-input"
            />
          </div>
          <div className="mt-1 text-caption text-fg-secondary">
            Include timestamp if possible (e.g. <code>?t=00h14m20s</code>)
          </div>
        </div>

        {/* Optional public notes (posted with the submission to Discord) */}
        <div>
          <label className="mb-1.5 block text-sm font-bold text-slate-200">
            Notes (optional)
          </label>
          <textarea
            value={playerNotes}
            onChange={e => onPlayerNotesChange(e.target.value)}
            placeholder="e.g. Stream dropped during game 2, restarted at 0:42:10."
            maxLength={PLAYER_NOTES_MAX_LENGTH}
            rows={3}
            disabled={disabled}
            className="block w-full resize-y rounded-md border border-line bg-canvas px-3.5 py-3 font-[inherit] text-base text-white"
            data-testid="player-notes-input"
          />
          <div className="mt-1 text-caption text-fg-secondary">
            Notes are public.
          </div>
        </div>

        {/* Submit Button */}
        <div className="mt-2 flex justify-end">
          <button
            type="submit"
            disabled={!canSubmit}
            className={cn(
              'flex items-center gap-2 rounded-md border-0 px-7 py-3 text-base font-extrabold',
              canSubmit
                ? 'cursor-pointer bg-gold-bright text-black shadow-[0_4px_14px_rgba(245,158,11,0.35)]'
                : 'cursor-not-allowed bg-slate-700 text-fg-secondary shadow-none'
            )}
            data-testid="submit-qual-button"
          >
            <Send size={18} />
            {isSubmitting ? 'Submitting Qual...' : 'Submit Qual'}
          </button>
        </div>
      </form>
    </div>
  );
};

const summaryRowClass = 'flex justify-between gap-4 text-sm text-fg-secondary';

const summaryValueClass = 'font-mono font-bold text-white';

const summaryTotalClass = 'flex justify-between gap-4 text-sm border-t border-line pt-1.5 mt-0.5 font-extrabold text-slate-200';

/** Live result of the scores entered so far, in the tournament's qual format. */
const QualScoreSummaryPanel: React.FC<{ summary: QualScoreSummary }> = ({ summary }) => (
  <div
    className="flex flex-col gap-1 rounded-md border border-gold/30 bg-gold/6 px-4 py-3"
    data-testid="qual-score-summary"
  >
    {summary.kind === 'MAXES' && (
      <>
        <div className={summaryRowClass}>
          <span>Maxes</span>
          <span className={summaryValueClass}>{summary.maxoutCount}</span>
        </div>
        {summary.kickerScore > 0 && (
          <div className={summaryRowClass}>
            <span>Kicker</span>
            <span className={summaryValueClass}>{summary.kickerScore.toLocaleString()}</span>
          </div>
        )}
      </>
    )}

    {summary.kind === 'AVERAGE' && (
      <>
        <div className={summaryTotalClass}>
          <span>Average of {summary.targetCount}</span>
          <span className={summaryValueClass}>{summary.average.toLocaleString()}</span>
        </div>
        {summary.scores.length < summary.targetCount && (
          <div className="text-caption text-fg-muted">
            {summary.scores.length} of {summary.targetCount} games entered; missing games count as 0.
          </div>
        )}
      </>
    )}

    {summary.kind === 'POINTS' && (
      <>
        {summary.breakdown.map(({ score, points }, idx) => (
          <div key={idx} className={summaryRowClass}>
            <span>{score.toLocaleString()}</span>
            <span className={summaryValueClass}>{points} pts</span>
          </div>
        ))}
        <div className={summaryTotalClass}>
          <span>Total</span>
          <span className={summaryValueClass}>{summary.totalPoints} pts</span>
        </div>
      </>
    )}
  </div>
);
