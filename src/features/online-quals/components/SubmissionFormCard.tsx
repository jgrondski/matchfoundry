import React from 'react';
import { Send, Plus, Trash2, Video, AlertCircle } from 'lucide-react';
import type { PointsThreshold, QualFormat } from '../../tournament/types';
import { PLAYER_NOTES_MAX_LENGTH } from '../discordMessages';
import { summarizeQualScores, type QualScoreSummary } from '../../qualifiers/qualSummary';

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
      style={{
        background: 'var(--color-bg-surface, #121820)',
        border: '1px solid var(--color-border, #263342)',
        borderRadius: '12px',
        padding: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem',
      }}
      data-testid="submission-form-card"
    >
      <div>
        <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#ffffff' }}>
          Official Score Submission
        </h3>
        <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: 'var(--color-text-secondary, #94a3b8)' }}>
          Enter the top game scores achieved during your live qualifying session and paste your Twitch VOD link.
        </p>
      </div>

      {errorMessage && (
        <div
          style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '8px',
            padding: '0.75rem 1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            color: '#f87171',
            fontSize: '0.88rem',
          }}
          data-testid="submission-error-banner"
        >
          <AlertCircle size={16} />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* Game Scores Block */}
        <div>
          <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 700, color: '#e2e8f0', marginBottom: '0.5rem' }}>
            {isAverage ? `Top ${expectedCount} Game Scores (Average of ${expectedCount})` : 'Game Score Attempts'}
          </label>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {currentScores.map((scoreVal, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span
                  style={{
                    width: '75px',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    color: 'var(--color-text-secondary, #94a3b8)',
                  }}
                >
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
                  style={{
                    flex: 1,
                    padding: '0.65rem 0.85rem',
                    borderRadius: '8px',
                    background: 'var(--color-bg-base, #0a0e14)',
                    border: '1px solid var(--color-border, #263342)',
                    color: '#ffffff',
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '1rem',
                    fontWeight: 700,
                    boxSizing: 'border-box',
                  }}
                  data-testid={`score-input-${idx}`}
                />
                {!isAverage && currentScores.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveAttempt(idx)}
                    disabled={disabled}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#f87171',
                      cursor: 'pointer',
                      padding: '0.4rem',
                    }}
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
              style={{
                marginTop: '0.65rem',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--color-border, #263342)',
                borderRadius: '6px',
                padding: '0.4rem 0.85rem',
                color: 'var(--color-text-secondary, #94a3b8)',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
            >
              <Plus size={14} /> Add Another Attempt
            </button>
          )}
        </div>

        {summary && <QualScoreSummaryPanel summary={summary} />}

        {/* Twitch VOD URL Input */}
        <div>
          <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 700, color: '#e2e8f0', marginBottom: '0.4rem' }}>
            Twitch Broadcast VOD URL *
          </label>
          <div style={{ position: 'relative' }}>
            <div
              style={{
                position: 'absolute',
                left: '0.85rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--color-text-muted, #64748b)',
              }}
            >
              <Video size={16} />
            </div>
            <input
              type="url"
              value={twitchVodUrl}
              onChange={e => onTwitchVodUrlChange(e.target.value)}
              placeholder="https://twitch.tv/videos/2481093821?t=00h14m20s"
              disabled={disabled}
              required
              style={{
                width: '100%',
                padding: '0.7rem 0.85rem 0.7rem 2.5rem',
                borderRadius: '8px',
                background: 'var(--color-bg-base, #0a0e14)',
                border: '1px solid var(--color-border, #263342)',
                color: '#ffffff',
                fontSize: '0.92rem',
                boxSizing: 'border-box',
              }}
              data-testid="twitch-vod-input"
            />
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary, #94a3b8)', marginTop: '0.3rem' }}>
            Include timestamp if possible (e.g. <code>?t=00h14m20s</code>) to assist judges in locating your topout Authword.
          </div>
        </div>

        {/* Optional public notes (posted with the submission to Discord) */}
        <div>
          <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 700, color: '#e2e8f0', marginBottom: '0.4rem' }}>
            Notes (optional)
          </label>
          <textarea
            value={playerNotes}
            onChange={e => onPlayerNotesChange(e.target.value)}
            placeholder="e.g. Stream dropped during game 2, restarted at 0:42:10."
            maxLength={PLAYER_NOTES_MAX_LENGTH}
            rows={3}
            disabled={disabled}
            style={{
              width: '100%',
              padding: '0.7rem 0.85rem',
              borderRadius: '8px',
              background: 'var(--color-bg-base, #0a0e14)',
              border: '1px solid var(--color-border, #263342)',
              color: '#ffffff',
              fontSize: '0.92rem',
              fontFamily: 'inherit',
              resize: 'vertical',
              boxSizing: 'border-box',
            }}
            data-testid="player-notes-input"
          />
          <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary, #94a3b8)', marginTop: '0.3rem' }}>
            Anything judges should know. Notes are public: they're posted with your submission.
          </div>
        </div>

        {/* Submit Button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
          <button
            type="submit"
            disabled={!canSubmit}
            style={{
              padding: '0.8rem 1.75rem',
              borderRadius: '8px',
              border: 'none',
              background: canSubmit ? 'var(--color-gold-bright, #f59e0b)' : '#334155',
              color: canSubmit ? '#000000' : '#94a3b8',
              fontSize: '0.95rem',
              fontWeight: 800,
              cursor: canSubmit ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              boxShadow: canSubmit ? '0 4px 14px rgba(245, 158, 11, 0.35)' : 'none',
            }}
            data-testid="submit-qual-button"
          >
            <Send size={18} />
            {isSubmitting ? 'Submitting Official Qual...' : 'Submit Official Qual'}
          </button>
        </div>
      </form>
    </div>
  );
};

const summaryRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '1rem',
  fontSize: '0.88rem',
  color: 'var(--color-text-secondary, #94a3b8)',
};

const summaryValueStyle: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', monospace",
  fontWeight: 700,
  color: '#ffffff',
};

const summaryTotalStyle: React.CSSProperties = {
  ...summaryRowStyle,
  borderTop: '1px solid var(--color-border, #263342)',
  paddingTop: '0.4rem',
  marginTop: '0.15rem',
  fontWeight: 800,
  color: '#e2e8f0',
};

/** Live result of the scores entered so far, in the tournament's qual format. */
const QualScoreSummaryPanel: React.FC<{ summary: QualScoreSummary }> = ({ summary }) => (
  <div
    style={{
      background: 'rgba(245, 158, 11, 0.06)',
      border: '1px solid rgba(245, 158, 11, 0.3)',
      borderRadius: '8px',
      padding: '0.75rem 1rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.3rem',
    }}
    data-testid="qual-score-summary"
  >
    {summary.kind === 'MAXES' && (
      <>
        <div style={summaryRowStyle}>
          <span>Maxes</span>
          <span style={summaryValueStyle}>{summary.maxoutCount}</span>
        </div>
        {summary.kickerScore > 0 && (
          <div style={summaryRowStyle}>
            <span>Kicker</span>
            <span style={summaryValueStyle}>{summary.kickerScore.toLocaleString()}</span>
          </div>
        )}
      </>
    )}

    {summary.kind === 'AVERAGE' && (
      <>
        <div style={summaryTotalStyle}>
          <span>Average of {summary.targetCount}</span>
          <span style={summaryValueStyle}>{summary.average.toLocaleString()}</span>
        </div>
        {summary.scores.length < summary.targetCount && (
          <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted, #64748b)' }}>
            {summary.scores.length} of {summary.targetCount} games entered; missing games count as 0.
          </div>
        )}
      </>
    )}

    {summary.kind === 'POINTS' && (
      <>
        {summary.breakdown.map(({ score, points }, idx) => (
          <div key={idx} style={summaryRowStyle}>
            <span>{score.toLocaleString()}</span>
            <span style={summaryValueStyle}>{points} pts</span>
          </div>
        ))}
        <div style={summaryTotalStyle}>
          <span>Total</span>
          <span style={summaryValueStyle}>{summary.totalPoints} pts</span>
        </div>
      </>
    )}
  </div>
);
