import React, { useState } from 'react';
import {
  CheckCircle2,
  Clock,
  ExternalLink,
  Search,
} from 'lucide-react';
import type { ReviewQueueSessionSummary } from '../../../api/qualifiers';
import { PlayerAvatar } from '../../players/components/PlayerAvatar';
import { isAbandonedRun } from '../sessionDerivation';
import { formatQualTimestamp } from '../formatQualTimestamp';
import { Button, cn, useIsMobile } from '../../../components/ui';
import { ReviewQueueCardList } from './ReviewQueueCardList';

const pillClass = 'shrink-0 cursor-pointer rounded-full border px-3 py-1.5 text-caption font-bold max-md:min-h-11';
const pillIdleClass = 'border-line bg-surface text-fg-secondary';
const thClass = 'px-4 py-3.5 text-xs font-bold uppercase text-fg-muted';
const tdClass = 'px-4 py-3.5';

/** Shown by the table and the phone card list when no qual matches the filter. */
export const REVIEW_QUEUE_EMPTY_TEXT = 'No Qualifiers Found.';

/** One submitted score, formatted the way the review queue shows it. */
export const formatQualScore = (score: number): string => score.toLocaleString();

/** What to show in place of scores when a qual has none. */
export const noScoresLabel = (session: ReviewQueueSessionSummary): string =>
  session.status === 'IN_PROGRESS' ? 'In Progress' : 'No scores';

/** The VOD link the review queue shows, or null (in-person quals and quals without a VOD). */
export const reviewVodUrl = (session: ReviewQueueSessionSummary): string | null =>
  session.submissionSource !== 'IN_PERSON' && session.twitchVodUrl ? session.twitchVodUrl : null;

/** New Player / Claimed badge for quals whose identity still needs a judge. */
export const IdentityStatusBadge: React.FC<{ session: ReviewQueueSessionSummary }> = ({ session }) => {
  if (session.identityStatus === 'PROVISIONAL_NEW') {
    return (
      <span
        title="New Competitor"
        className="rounded-sm px-1.5 text-2xs font-bold bg-sky-400/15 text-sky-400"
      >
        New Player
      </span>
    );
  }
  if (session.identityStatus === 'CLAIMED_PENDING_REVIEW') {
    return (
      <span className="rounded-sm px-1.5 text-2xs font-bold bg-gold/15 text-gold-bright">
        Claimed
      </span>
    );
  }
  return null;
};

export const QualStatusBadge: React.FC<{ session: ReviewQueueSessionSummary }> = ({ session }) => (
  <span
    className={cn(
      'inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-xs font-bold',
      session.status === 'VERIFIED'
        ? 'bg-green-500/15 text-green-400'
        : session.status === 'DNQ' || session.status === 'DQ'
        ? 'bg-red/15 text-red-bright'
        : 'bg-gold/15 text-gold-bright'
    )}
  >
    {session.status === 'VERIFIED' && <CheckCircle2 size={12} />}
    {session.status === 'SUBMITTED' && <Clock size={12} />}
    {session.status === 'DNQ' && 'DNQ'}
    {session.status === 'DQ' && 'DQ'}
    {session.status === 'IN_PROGRESS' && 'Running'}
    {session.status === 'SUBMITTED' && 'Pending'}
    {session.status === 'VERIFIED' && 'Verified'}
  </span>
);

/** Flag for a run still unfinished more than an hour past the qual window. */
export const AbandonedRunFlag: React.FC<{ session: ReviewQueueSessionSummary; qualWindowMinutes: number }> = ({
  session,
  qualWindowMinutes,
}) =>
  isAbandonedRun(session, qualWindowMinutes) ? (
    <div
      className="mt-1 inline-block rounded-sm bg-red/15 px-1.5 text-2xs font-bold text-red"
      title="Abandoned Run"
      data-testid="abandoned-run-flag"
    >
      ⚠️ Abandoned
    </div>
  ) : null;

/** Submitted time, "Started …" for a run in progress, or a dash. */
export const QualSubmittedTime: React.FC<{ session: ReviewQueueSessionSummary }> = ({ session }) =>
  session.submittedAt ? (
    <span className="text-caption font-semibold whitespace-nowrap text-white">
      {formatQualTimestamp(session.submittedAt)}
    </span>
  ) : session.status === 'IN_PROGRESS' && session.timerLog?.startedAt ? (
    <span className="text-caption whitespace-nowrap text-fg-muted">
      Started {formatQualTimestamp(session.timerLog.startedAt)}
    </span>
  ) : (
    <span className="text-caption text-fg-muted">—</span>
  );

/**
 * Qual total time: the window length for in-person quals, otherwise the elapsed run time with
 * Overtime and Notes flags. `stackClassName` lays out the online variant (a centered column in the table).
 */
export const QualTotalTime: React.FC<{
  session: ReviewQueueSessionSummary;
  qualWindowMinutes: number;
  stackClassName?: string;
}> = ({ session, qualWindowMinutes, stackClassName = 'flex flex-col items-center gap-1' }) => {
  if (session.submissionSource === 'IN_PERSON') {
    return (
      <span className="font-mono font-bold text-white">
        {qualWindowMinutes}m
      </span>
    );
  }
  const elapsedSeconds = session.timerLog?.elapsedSeconds || 0;
  const elapsedMin = Math.floor(elapsedSeconds / 60);
  const elapsedSec = elapsedSeconds % 60;
  const isOvertime = Boolean(session.timerLog?.overTime);
  return (
    <div className={stackClassName}>
      <span className={cn('font-mono font-bold', isOvertime ? 'text-red' : 'text-white')}>
        {elapsedMin}m {elapsedSec}s
      </span>
      {isOvertime && (
        <span className="rounded-sm bg-red/15 px-1.5 text-2xs font-bold text-red">
          ⚠️ Overtime
        </span>
      )}
      {session.playerNotes && (
        <span
          title={session.playerNotes}
          className="rounded-sm bg-purple-500/15 px-1.5 text-2xs font-bold text-purple-400"
        >
          📝 Notes
        </span>
      )}
    </div>
  );
};

export interface ReviewQueueTableProps {
  sessions: ReviewQueueSessionSummary[];
  onOpenAdjudicate: (session: ReviewQueueSessionSummary) => void;
  onOpenIdentityModal: (session: ReviewQueueSessionSummary) => void;
  onDiscardRun?: (session: ReviewQueueSessionSummary) => void;
  qualWindowMinutes?: number;
}

export type ReviewFilter = 'ALL' | 'PENDING' | 'UNFINISHED' | 'ONLINE' | 'IN_PERSON';

export const ReviewQueueTable: React.FC<ReviewQueueTableProps> = ({
  sessions,
  onOpenAdjudicate,
  onOpenIdentityModal,
  onDiscardRun,
  qualWindowMinutes = 90,
}) => {
  const [filter, setFilter] = useState<ReviewFilter>('PENDING');
  const [search, setSearch] = useState('');
  const isMobile = useIsMobile();

  const pendingCount = sessions.filter(s => s.status === 'SUBMITTED').length;
  const unfinishedCount = sessions.filter(s => s.status === 'IN_PROGRESS').length;
  const abandonedCount = sessions.filter(s => isAbandonedRun(s, qualWindowMinutes)).length;
  const onlineCount = sessions.filter(s => s.submissionSource === 'ONLINE').length;
  const inPersonCount = sessions.filter(s => s.submissionSource === 'IN_PERSON').length;

  const filteredSessions = sessions.filter(s => {
    // Tab filter
    if (filter === 'PENDING') {
      if (s.status !== 'SUBMITTED') return false;
    } else if (filter === 'UNFINISHED') {
      if (s.status !== 'IN_PROGRESS') return false;
    } else if (filter === 'ONLINE') {
      if (s.submissionSource !== 'ONLINE') return false;
    } else if (filter === 'IN_PERSON') {
      if (s.submissionSource !== 'IN_PERSON') return false;
    }

    // Search query
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      const matchName = s.playerName.toLowerCase().includes(q);
      const matchTwitch = s.submittedTwitchUsername?.toLowerCase().includes(q);
      const matchAuth = s.authWord?.toLowerCase().includes(q);
      if (!matchName && !matchTwitch && !matchAuth) return false;
    }

    return true;
  });

  return (
    <div className="flex w-full flex-col gap-4">
      {/* Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 max-md:-mx-3 max-md:flex-nowrap max-md:overflow-x-auto max-md:px-3 max-md:[scrollbar-width:none]">
          <button
            type="button"
            onClick={() => setFilter('PENDING')}
            className={cn(pillClass, 'inline-flex items-center gap-1.5', filter === 'PENDING' ? 'border-gold-bright bg-gold/20 text-gold-bright' : pillIdleClass)}
          >
            Pending Review
            <span
              className={cn(
                'rounded-full px-1.5 text-2xs font-extrabold',
                pendingCount > 0 ? 'bg-gold-bright text-black' : 'bg-white/10 text-fg-muted'
              )}
            >
              {pendingCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFilter('UNFINISHED')}
            data-testid="unfinished-filter"
            className={cn(pillClass, 'inline-flex items-center gap-1.5', filter === 'UNFINISHED' ? 'border-red-bright bg-red/15 text-red-300' : pillIdleClass)}
          >
            Unfinished ({unfinishedCount})
            {abandonedCount > 0 && (
              <span
                className="rounded-full bg-red px-1.5 text-2xs font-extrabold text-white"
                title={`${abandonedCount} Abandoned`}
              >
                {abandonedCount} abandoned
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setFilter('ONLINE')}
            className={cn(pillClass, 'inline-flex items-center gap-1.5', filter === 'ONLINE' ? 'border-purple-500 bg-purple-500/20 text-purple-400' : pillIdleClass)}
          >
            Online ({onlineCount})
          </button>

          <button
            type="button"
            onClick={() => setFilter('IN_PERSON')}
            className={cn(pillClass, 'inline-flex items-center gap-1.5', filter === 'IN_PERSON' ? 'border-blue-500 bg-blue-500/20 text-blue-400' : pillIdleClass)}
          >
            In-Person ({inPersonCount})
          </button>

          <button
            type="button"
            onClick={() => setFilter('ALL')}
            className={cn(pillClass, filter === 'ALL' ? 'border-white bg-white/10 text-white' : pillIdleClass)}
          >
            All Runs ({sessions.length})
          </button>
        </div>

        {/* Search Input */}
        <div className="relative min-w-55 max-md:w-full">
          <Search
            size={14}
            className="absolute top-1/2 left-2.5 -translate-y-1/2 text-fg-muted"
          />
          <input
            type="text"
            placeholder="Search competitor, Twitch, authword..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full rounded-md border border-line bg-surface py-1.5 pr-2.5 pl-8 text-caption text-white max-md:text-base"
          />
        </div>
      </div>

      {isMobile ? (
        <ReviewQueueCardList
          sessions={filteredSessions}
          onOpenAdjudicate={onOpenAdjudicate}
          onOpenIdentityModal={onOpenIdentityModal}
          onDiscardRun={onDiscardRun}
          qualWindowMinutes={qualWindowMinutes}
        />
      ) : (
        /* Table Canvas */
        <div className="overflow-hidden rounded-md border border-line bg-surface">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-line bg-elevated">
                <th className={thClass}>
                  Competitor &amp; Identity
                </th>
                <th className={cn(thClass, 'text-center')}>
                  Submitted
                </th>
                <th className={cn(thClass, 'text-center')}>
                  Qual Total Time
                </th>
                <th className={cn(thClass, 'text-right')}>
                  Submitted Scores
                </th>
                <th className={cn(thClass, 'text-center')}>
                  VOD Link
                </th>
                <th className={cn(thClass, 'text-center')}>
                  Status
                </th>
                <th className={cn(thClass, 'text-right')}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredSessions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-fg-muted">
                    {REVIEW_QUEUE_EMPTY_TEXT}
                  </td>
                </tr>
              ) : (
                filteredSessions.map((session, idx) => {
                  return (
                    <tr
                      key={session.playerId}
                      className={cn('border-b border-line-subtle', idx % 2 === 0 ? 'bg-transparent' : 'bg-white/2')}
                    >
                      {/* Competitor & Identity */}
                      <td className={tdClass}>
                        <div className="flex items-center gap-2.5">
                          <PlayerAvatar
                            player={{
                              name: session.playerName,
                              country: session.country,
                              avatarUrl: session.avatarUrl,
                              avatarType: (session.avatarType as any) || 'flag',
                            }}
                            size={32}
                          />
                          <div>
                            <div className="font-bold text-white">
                              {session.playerName}
                            </div>
                            <div className="mt-0.5 flex items-center gap-1.5">
                              {session.submittedTwitchUsername && (
                                <span className="text-xs text-violet-400">
                                  @{session.submittedTwitchUsername}
                                </span>
                              )}
                              <IdentityStatusBadge session={session} />
                            </div>
                          </div>
                        </div>
                      </td>
  
                      {/* Submitted */}
                      <td className={cn(tdClass, 'text-center')}>
                        <QualSubmittedTime session={session} />
                      </td>
  
                      {/* Qual Total Time */}
                      <td className={cn(tdClass, 'text-center')}>
                        <QualTotalTime session={session} qualWindowMinutes={qualWindowMinutes} />
                      </td>
  
                      {/* Scores */}
                      <td className={cn(tdClass, 'text-right')}>
                        {session.scores && session.scores.length > 0 ? (
                          <div className="flex flex-col items-end gap-0.5">
                            <span className="font-mono text-base font-extrabold text-white">
                              {formatQualScore(Math.max(...session.scores))}
                            </span>
                            <span className="text-xs text-fg-muted">
                              {session.scores.length} {session.scores.length === 1 ? 'game' : 'games'}: (
                              {session.scores.map(formatQualScore).join(', ')})
                            </span>
                          </div>
                        ) : (
                          <span className="text-caption text-fg-muted">{noScoresLabel(session)}</span>
                        )}
                      </td>
  
                      {/* VOD Link */}
                      <td className={cn(tdClass, 'text-center')}>
                        {session.submissionSource === 'IN_PERSON' ? (
                          <span className="text-caption font-semibold text-blue-400">
                            In Person
                          </span>
                        ) : reviewVodUrl(session) ? (
                          <a
                            href={reviewVodUrl(session) ?? undefined}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-caption text-violet-400 no-underline"
                          >
                            VOD <ExternalLink size={12} />
                          </a>
                        ) : (
                          <span className="text-caption text-fg-muted">—</span>
                        )}
                      </td>
  
                      {/* Status */}
                      <td className={cn(tdClass, 'text-center')}>
                        <QualStatusBadge session={session} />
                        <AbandonedRunFlag session={session} qualWindowMinutes={qualWindowMinutes} />
                      </td>
  
                      {/* Actions */}
                      <td className={cn(tdClass, 'text-right')}>
                        <div className="flex items-center justify-end gap-1.5">
                          {session.status === 'IN_PROGRESS' && onDiscardRun && (
                            <Button
                              type="button"
                              onClick={() => onDiscardRun(session)}
                              variant="secondary"
                              data-testid="discard-run-button"
                              className="border-red/35 px-2 py-1 text-xs text-red-bright enabled:hover:border-red/35"
                            >
                              Discard
                            </Button>
                          )}
                          <Button
                            type="button"
                            onClick={() => onOpenIdentityModal(session)}
                            variant="secondary"
                            className="border-gold/30 px-2 py-1 text-xs text-gold-bright enabled:hover:border-gold/30"
                          >
                            Identity
                          </Button>
                          <Button
                            type="button"
                            onClick={() => onOpenAdjudicate(session)}
                            variant="primary"
                            className="px-2.5 py-1 text-xs"
                          >
                            Review
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
