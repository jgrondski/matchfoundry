import React from 'react';
import { ExternalLink } from 'lucide-react';
import type { ReviewQueueSessionSummary } from '../../../api/qualifiers';
import { Badge, Button, Card, buttonClasses } from '../../../components/ui';
import {
  AbandonedRunFlag,
  IdentityStatusBadge,
  QualStatusBadge,
  QualSubmittedTime,
  QualTotalTime,
  REVIEW_QUEUE_EMPTY_TEXT,
  formatQualScore,
  noScoresLabel,
  reviewVodUrl,
} from './ReviewQueueTable';

export interface ReviewQueueCardListProps {
  sessions: ReviewQueueSessionSummary[]; // already filtered
  onOpenAdjudicate: (session: ReviewQueueSessionSummary) => void;
  onOpenIdentityModal: (session: ReviewQueueSessionSummary) => void;
  onDiscardRun?: (session: ReviewQueueSessionSummary) => void;
  qualWindowMinutes: number;
}

/** Phone layout of the review queue: one card per qual, same data as the table rows. */
export const ReviewQueueCardList: React.FC<ReviewQueueCardListProps> = ({
  sessions,
  onOpenAdjudicate,
  onOpenIdentityModal,
  onDiscardRun,
  qualWindowMinutes,
}) => {
  if (sessions.length === 0) {
    return (
      <Card padding="sm" className="px-6 py-12 text-center text-sm text-fg-muted">
        {REVIEW_QUEUE_EMPTY_TEXT}
      </Card>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {sessions.map(session => {
        const vodUrl = reviewVodUrl(session);
        return (
          <li key={session.playerId}>
            <Card padding="sm" className="flex flex-col gap-2.5">
              {/* Header */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="min-w-0 truncate font-semibold text-white">{session.playerName}</span>
                  <IdentityStatusBadge session={session} />
                </div>
                <div className="flex shrink-0 flex-col items-end">
                  <QualStatusBadge session={session} />
                  <AbandonedRunFlag session={session} qualWindowMinutes={qualWindowMinutes} />
                </div>
              </div>

              {/* Meta row */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-secondary">
                <Badge variant={session.submissionSource === 'IN_PERSON' ? 'blue' : 'muted'}>
                  {session.submissionSource === 'IN_PERSON' ? 'In-person' : 'Online'}
                </Badge>
                <QualSubmittedTime session={session} />
                <QualTotalTime
                  session={session}
                  qualWindowMinutes={qualWindowMinutes}
                  stackClassName="flex flex-wrap items-center gap-1.5"
                />
              </div>

              {/* Scores */}
              {session.scores && session.scores.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {session.scores.map((score, idx) => (
                    <span
                      key={idx}
                      className="rounded-full border border-line bg-elevated px-2.5 py-0.5 font-mono text-xs font-bold text-white"
                    >
                      {formatQualScore(score)}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-caption text-fg-muted">{noScoresLabel(session)}</span>
              )}

              {/* Actions */}
              <Button type="button" variant="primary" className="w-full" onClick={() => onOpenAdjudicate(session)}>
                Review
              </Button>
              <div className="flex flex-wrap gap-2">
                {vodUrl && (
                  <a
                    href={vodUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={buttonClasses({ variant: 'secondary', size: 'sm' })}
                  >
                    VOD <ExternalLink size={12} />
                  </a>
                )}
                <Button type="button" variant="secondary" size="sm" onClick={() => onOpenIdentityModal(session)}>
                  Identity
                </Button>
                {session.status === 'IN_PROGRESS' && onDiscardRun && (
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    data-testid="discard-run-button"
                    onClick={() => onDiscardRun(session)}
                  >
                    Discard
                  </Button>
                )}
              </div>
            </Card>
          </li>
        );
      })}
    </ul>
  );
};
