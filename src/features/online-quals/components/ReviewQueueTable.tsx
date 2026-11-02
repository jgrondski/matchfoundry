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
import { Button, cn } from '../../../components/ui';

const pillClass = 'cursor-pointer rounded-full border px-3 py-1.5 text-caption font-bold';
const pillIdleClass = 'border-line bg-surface text-fg-secondary';
const thClass = 'px-4 py-3.5 text-xs font-bold uppercase text-fg-muted';
const tdClass = 'px-4 py-3.5';

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
        <div className="flex flex-wrap items-center gap-1.5">
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
                title={`${abandonedCount} abandoned: still unfinished more than an hour past the window`}
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
        <div className="relative min-w-55">
          <Search
            size={14}
            className="absolute top-1/2 left-2.5 -translate-y-1/2 text-fg-muted"
          />
          <input
            type="text"
            placeholder="Search competitor, Twitch, authword..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full rounded-md border border-line bg-surface py-1.5 pr-2.5 pl-8 text-caption text-white"
          />
        </div>
      </div>

      {/* Table Canvas */}
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
                  No Qualifiers Found.
                </td>
              </tr>
            ) : (
              filteredSessions.map((session, idx) => {
                const elapsedSeconds = session.timerLog?.elapsedSeconds || 0;
                const elapsedMin = Math.floor(elapsedSeconds / 60);
                const elapsedSec = elapsedSeconds % 60;
                const isOvertime = Boolean(session.timerLog?.overTime);
                const isAbandoned = isAbandonedRun(session, qualWindowMinutes);

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
                            {session.identityStatus === 'PROVISIONAL_NEW' && (
                              <span
                                title="This run created a new player record; they weren't found in the player list."
                                className="rounded-sm px-1.5 text-2xs font-bold bg-sky-400/15 text-sky-400"
                              >
                                New Player
                              </span>
                            )}
                            {session.identityStatus === 'CLAIMED_PENDING_REVIEW' && (
                              <span className="rounded-sm px-1.5 text-2xs font-bold bg-gold/15 text-gold-bright">
                                Claimed
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Submitted */}
                    <td className={cn(tdClass, 'text-center')}>
                      {session.submittedAt ? (
                        <span className="text-caption font-semibold whitespace-nowrap text-white">
                          {formatQualTimestamp(session.submittedAt)}
                        </span>
                      ) : session.status === 'IN_PROGRESS' && session.timerLog?.startedAt ? (
                        <span className="text-caption whitespace-nowrap text-fg-muted">
                          Started {formatQualTimestamp(session.timerLog.startedAt)}
                        </span>
                      ) : (
                        <span className="text-caption text-fg-muted">—</span>
                      )}
                    </td>

                    {/* Qual Total Time */}
                    <td className={cn(tdClass, 'text-center')}>
                      {session.submissionSource === 'IN_PERSON' ? (
                        <span className="font-mono font-bold text-white">
                          {qualWindowMinutes}m
                        </span>
                      ) : (
                        <div className="flex flex-col items-center gap-1">
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
                      )}
                    </td>

                    {/* Scores */}
                    <td className={cn(tdClass, 'text-right')}>
                      {session.scores && session.scores.length > 0 ? (
                        <div className="flex flex-col items-end gap-0.5">
                          <span className="font-mono text-base font-extrabold text-white">
                            {Math.max(...session.scores).toLocaleString()}
                          </span>
                          <span className="text-xs text-fg-muted">
                            {session.scores.length} {session.scores.length === 1 ? 'game' : 'games'}: (
                            {session.scores.map(s => s.toLocaleString()).join(', ')})
                          </span>
                        </div>
                      ) : session.status === 'IN_PROGRESS' ? (
                        <span className="text-caption text-fg-muted">
                          In Progress
                        </span>
                      ) : (
                        <span className="text-caption text-fg-muted">No scores</span>
                      )}
                    </td>

                    {/* VOD Link */}
                    <td className={cn(tdClass, 'text-center')}>
                      {session.submissionSource === 'IN_PERSON' ? (
                        <span className="text-caption font-semibold text-blue-400">
                          In Person
                        </span>
                      ) : session.twitchVodUrl ? (
                        <a
                          href={session.twitchVodUrl}
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
                      {isAbandoned && (
                        <div
                          className="mt-1 inline-block rounded-sm bg-red/15 px-1.5 text-2xs font-bold text-red"
                          title="Still unfinished more than an hour past the qual window"
                          data-testid="abandoned-run-flag"
                        >
                          ⚠️ Abandoned
                        </div>
                      )}
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
    </div>
  );
};
