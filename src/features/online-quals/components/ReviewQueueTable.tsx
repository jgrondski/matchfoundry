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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%' }}>
      {/* Controls Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
        }}
      >
        {/* Filter Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setFilter('PENDING')}
            style={{
              padding: '0.4rem 0.75rem',
              borderRadius: 'var(--radius-full)',
              border: filter === 'PENDING' ? '1px solid var(--color-gold-bright)' : '1px solid var(--color-border)',
              background: filter === 'PENDING' ? 'rgba(245, 158, 11, 0.2)' : 'var(--color-bg-surface)',
              color: filter === 'PENDING' ? 'var(--color-gold-bright)' : 'var(--color-text-secondary)',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
            }}
          >
            Pending Review
            <span
              style={{
                fontSize: '0.7rem',
                padding: '0.05rem 0.4rem',
                borderRadius: 'var(--radius-full)',
                background: pendingCount > 0 ? 'var(--color-gold-bright)' : 'rgba(255,255,255,0.1)',
                color: pendingCount > 0 ? '#000000' : 'var(--color-text-muted)',
                fontWeight: 800,
              }}
            >
              {pendingCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFilter('UNFINISHED')}
            data-testid="unfinished-filter"
            style={{
              padding: '0.4rem 0.75rem',
              borderRadius: 'var(--radius-full)',
              border: filter === 'UNFINISHED' ? '1px solid #f87171' : '1px solid var(--color-border)',
              background: filter === 'UNFINISHED' ? 'rgba(239, 68, 68, 0.15)' : 'var(--color-bg-surface)',
              color: filter === 'UNFINISHED' ? '#fca5a5' : 'var(--color-text-secondary)',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
            }}
          >
            Unfinished ({unfinishedCount})
            {abandonedCount > 0 && (
              <span
                style={{
                  fontSize: '0.7rem',
                  padding: '0.05rem 0.4rem',
                  borderRadius: 'var(--radius-full)',
                  background: '#ef4444',
                  color: '#ffffff',
                  fontWeight: 800,
                }}
                title={`${abandonedCount} abandoned: still unfinished more than an hour past the window`}
              >
                {abandonedCount} abandoned
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setFilter('ONLINE')}
            style={{
              padding: '0.4rem 0.75rem',
              borderRadius: 'var(--radius-full)',
              border: filter === 'ONLINE' ? '1px solid #a855f7' : '1px solid var(--color-border)',
              background: filter === 'ONLINE' ? 'rgba(168, 85, 247, 0.2)' : 'var(--color-bg-surface)',
              color: filter === 'ONLINE' ? '#c084fc' : 'var(--color-text-secondary)',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
            }}
          >
            Online ({onlineCount})
          </button>

          <button
            type="button"
            onClick={() => setFilter('IN_PERSON')}
            style={{
              padding: '0.4rem 0.75rem',
              borderRadius: 'var(--radius-full)',
              border: filter === 'IN_PERSON' ? '1px solid #3b82f6' : '1px solid var(--color-border)',
              background: filter === 'IN_PERSON' ? 'rgba(59, 130, 246, 0.2)' : 'var(--color-bg-surface)',
              color: filter === 'IN_PERSON' ? '#60a5fa' : 'var(--color-text-secondary)',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
            }}
          >
            In-Person ({inPersonCount})
          </button>

          <button
            type="button"
            onClick={() => setFilter('ALL')}
            style={{
              padding: '0.4rem 0.75rem',
              borderRadius: 'var(--radius-full)',
              border: filter === 'ALL' ? '1px solid #ffffff' : '1px solid var(--color-border)',
              background: filter === 'ALL' ? 'rgba(255, 255, 255, 0.1)' : 'var(--color-bg-surface)',
              color: filter === 'ALL' ? '#ffffff' : 'var(--color-text-secondary)',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            All Runs ({sessions.length})
          </button>
        </div>

        {/* Search Input */}
        <div style={{ position: 'relative', minWidth: '220px' }}>
          <Search
            size={14}
            style={{
              position: 'absolute',
              left: '0.65rem',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--color-text-muted)',
            }}
          />
          <input
            type="text"
            placeholder="Search competitor, Twitch, authword..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              padding: '0.4rem 0.65rem 0.4rem 2rem',
              background: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              color: '#ffffff',
              fontSize: '0.8rem',
              width: '100%',
              boxSizing: 'border-box',
            }}
          />
        </div>
      </div>

      {/* Table Canvas */}
      <div
        style={{
          background: 'var(--color-bg-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)',
          overflow: 'hidden',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ background: 'var(--color-bg-surface-elevated)', borderBottom: '1px solid var(--color-border)' }}>
              <th style={{ padding: '0.85rem 1rem', fontWeight: 700, color: 'var(--color-text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                Competitor &amp; Identity
              </th>
              <th style={{ padding: '0.85rem 1rem', fontWeight: 700, color: 'var(--color-text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', textAlign: 'center' }}>
                NES Authword
              </th>
              <th style={{ padding: '0.85rem 1rem', fontWeight: 700, color: 'var(--color-text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', textAlign: 'center' }}>
                Qual Total Time
              </th>
              <th style={{ padding: '0.85rem 1rem', fontWeight: 700, color: 'var(--color-text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', textAlign: 'right' }}>
                Submitted Scores
              </th>
              <th style={{ padding: '0.85rem 1rem', fontWeight: 700, color: 'var(--color-text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', textAlign: 'center' }}>
                VOD Link
              </th>
              <th style={{ padding: '0.85rem 1rem', fontWeight: 700, color: 'var(--color-text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', textAlign: 'center' }}>
                Status
              </th>
              <th style={{ padding: '0.85rem 1rem', fontWeight: 700, color: 'var(--color-text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', textAlign: 'right' }}>
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredSessions.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: '3rem 1.5rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
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
                    style={{
                      borderBottom: '1px solid var(--color-border-subtle)',
                      background: idx % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.015)',
                    }}
                  >
                    {/* Competitor & Identity */}
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
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
                          <div style={{ fontWeight: 700, color: '#ffffff' }}>
                            {session.playerName}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.15rem' }}>
                            {session.submittedTwitchUsername && (
                              <span style={{ fontSize: '0.75rem', color: '#a78bfa' }}>
                                @{session.submittedTwitchUsername}
                              </span>
                            )}
                            {session.identityStatus === 'VERIFIED_MATCH' && (
                              <span
                                style={{
                                  fontSize: '0.68rem',
                                  padding: '0.05rem 0.35rem',
                                  borderRadius: 'var(--radius-sm)',
                                  background: 'rgba(34, 197, 94, 0.15)',
                                  color: '#4ade80',
                                  fontWeight: 700,
                                }}
                              >
                                Verified Match
                              </span>
                            )}
                            {session.identityStatus === 'CLAIMED_PENDING_REVIEW' && (
                              <span
                                style={{
                                  fontSize: '0.68rem',
                                  padding: '0.05rem 0.35rem',
                                  borderRadius: 'var(--radius-sm)',
                                  background: 'rgba(245, 158, 11, 0.15)',
                                  color: 'var(--color-gold-bright)',
                                  fontWeight: 700,
                                }}
                              >
                                Claimed
                              </span>
                            )}
                            {session.identityStatus === 'PROVISIONAL_NEW' && (
                              <span
                                style={{
                                  fontSize: '0.68rem',
                                  padding: '0.05rem 0.35rem',
                                  borderRadius: 'var(--radius-sm)',
                                  background: 'rgba(56, 189, 248, 0.15)',
                                  color: '#38bdf8',
                                  fontWeight: 700,
                                }}
                              >
                                Walk-In
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* NES Authword */}
                    <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                      {session.authWord ? (
                        <span
                          style={{
                            fontFamily: 'monospace',
                            fontSize: '0.95rem',
                            fontWeight: 800,
                            letterSpacing: '0.1em',
                            color: 'var(--color-gold-bright)',
                            background: 'rgba(245, 158, 11, 0.12)',
                            border: '1px solid rgba(245, 158, 11, 0.3)',
                            borderRadius: 'var(--radius-sm)',
                            padding: '0.2rem 0.5rem',
                          }}
                        >
                          {session.authWord}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--color-text-muted)', fontSize: '0.95rem', fontWeight: 600 }}>
                          -
                        </span>
                      )}
                    </td>

                    {/* Qual Total Time */}
                    <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                      {session.submissionSource === 'IN_PERSON' ? (
                        <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#ffffff' }}>
                          {qualWindowMinutes}m
                        </span>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem' }}>
                          <span style={{ fontFamily: 'monospace', fontWeight: 700, color: isOvertime ? '#ef4444' : '#ffffff' }}>
                            {elapsedMin}m {elapsedSec}s
                          </span>
                          {isOvertime && (
                            <span
                              style={{
                                fontSize: '0.68rem',
                                fontWeight: 700,
                                color: '#ef4444',
                                background: 'rgba(239, 68, 68, 0.15)',
                                padding: '0.05rem 0.35rem',
                                borderRadius: 'var(--radius-sm)',
                              }}
                            >
                              ⚠️ Overtime
                            </span>
                          )}
                          {session.playerNotes && (
                            <span
                              title={session.playerNotes}
                              style={{
                                fontSize: '0.68rem',
                                fontWeight: 700,
                                color: '#c084fc',
                                background: 'rgba(168, 85, 247, 0.15)',
                                padding: '0.05rem 0.35rem',
                                borderRadius: 'var(--radius-sm)',
                              }}
                            >
                              📝 Notes
                            </span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Scores */}
                    <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                      {session.scores && session.scores.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.15rem' }}>
                          <span style={{ fontFamily: 'monospace', fontWeight: 800, color: '#ffffff', fontSize: '0.95rem' }}>
                            {Math.max(...session.scores).toLocaleString()}
                          </span>
                          <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                            {session.scores.length} {session.scores.length === 1 ? 'game' : 'games'}: (
                            {session.scores.map(s => s.toLocaleString()).join(', ')})
                          </span>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
                          In Progress
                        </span>
                      )}
                    </td>

                    {/* VOD Link */}
                    <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                      {session.submissionSource === 'IN_PERSON' ? (
                        <span style={{ color: '#60a5fa', fontSize: '0.78rem', fontWeight: 600 }}>
                          In Person
                        </span>
                      ) : session.twitchVodUrl ? (
                        <a
                          href={session.twitchVodUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            color: '#a78bfa',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            fontSize: '0.78rem',
                            textDecoration: 'none',
                          }}
                        >
                          VOD <ExternalLink size={12} />
                        </a>
                      ) : (
                        <span style={{ color: 'var(--color-text-muted)', fontSize: '0.78rem' }}>—</span>
                      )}
                    </td>

                    {/* Status */}
                    <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          padding: '0.15rem 0.5rem',
                          borderRadius: 'var(--radius-sm)',
                          background:
                            session.status === 'VERIFIED'
                              ? 'rgba(34, 197, 94, 0.15)'
                              : session.status === 'DNQ' || session.status === 'DQ'
                              ? 'rgba(239, 68, 68, 0.15)'
                              : 'rgba(245, 158, 11, 0.15)',
                          color:
                            session.status === 'VERIFIED'
                              ? '#4ade80'
                              : session.status === 'DNQ' || session.status === 'DQ'
                              ? '#f87171'
                              : 'var(--color-gold-bright)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                        }}
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
                          style={{
                            marginTop: '0.3rem',
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            color: '#ef4444',
                            background: 'rgba(239, 68, 68, 0.15)',
                            padding: '0.05rem 0.35rem',
                            borderRadius: 'var(--radius-sm)',
                            display: 'inline-block',
                          }}
                          title="Still unfinished more than an hour past the qual window"
                          data-testid="abandoned-run-flag"
                        >
                          ⚠️ Abandoned
                        </div>
                      )}
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.4rem' }}>
                        {session.status === 'IN_PROGRESS' && onDiscardRun && (
                          <button
                            type="button"
                            onClick={() => onDiscardRun(session)}
                            className="btn btn-secondary"
                            data-testid="discard-run-button"
                            style={{
                              fontSize: '0.75rem',
                              padding: '0.25rem 0.5rem',
                              color: '#f87171',
                              borderColor: 'rgba(239, 68, 68, 0.35)',
                            }}
                          >
                            Discard
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onOpenIdentityModal(session)}
                          className="btn btn-secondary"
                          style={{
                            fontSize: '0.75rem',
                            padding: '0.25rem 0.5rem',
                            color: 'var(--color-gold-bright)',
                            borderColor: 'rgba(245, 158, 11, 0.3)',
                          }}
                        >
                          Identity
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenAdjudicate(session)}
                          className="btn btn-primary"
                          style={{
                            fontSize: '0.75rem',
                            padding: '0.25rem 0.65rem',
                          }}
                        >
                          Review
                        </button>
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
