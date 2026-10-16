import React, { useState, useEffect, useCallback } from 'react';
import {
  Clock,
  AlertTriangle,
  Lock,
  Unlock,
  X,
} from 'lucide-react';
import type { Tournament } from '../../tournament/types';
import type { ReviewQueueSessionSummary } from '../../../api/qualifiers';
import { useTournament } from '../../tournament/store';
import { getAuthHeaders } from '../../auth/AuthContext';
import { ReviewQueueTable } from './ReviewQueueTable';
import { AdjudicationModal } from './AdjudicationModal';
import { IdentityResolutionModal } from './IdentityResolutionModal';

export interface ReviewQueueViewProps {
  tournament: Tournament;
}

/**
 * Derives initial session summaries from tournament.qualifierSubmissions if offline/testing.
 */
function deriveSessionsFromTournament(tournament: Tournament): ReviewQueueSessionSummary[] {
  const onlineSubs = (tournament.qualifierSubmissions || []).filter(
    s => s.submissionSource === 'ONLINE'
  );
  if (onlineSubs.length === 0) return [];

  const groups = new Map<string, typeof onlineSubs>();
  for (const s of onlineSubs) {
    const list = groups.get(s.playerId) || [];
    list.push(s);
    groups.set(s.playerId, list);
  }

  const playerMap = new Map((tournament.playersPool || []).map(p => [p.id, p]));
  const result: ReviewQueueSessionSummary[] = [];

  for (const [playerId, subs] of groups.entries()) {
    const first = subs[0];
    const scoredRows = subs.filter(
      s => s.status !== 'IN_PROGRESS' && s.status !== 'NOT_STARTED'
    );
    const p = playerMap.get(playerId);

    result.push({
      tournamentId: tournament.id,
      playerId,
      playerName: p?.name || first.submittedTwitchUsername || 'Unknown Player',
      country: p?.country || 'US',
      avatarUrl: p?.avatarUrl || undefined,
      avatarType: (p?.avatarType as any) || 'flag',
      status: first.status || 'SUBMITTED',
      authWord: first.authWord || 'ROCKET',
      twitchVodUrl: first.twitchVodUrl || null,
      submittedTwitchId: first.submittedTwitchId || null,
      submittedTwitchUsername: first.submittedTwitchUsername || null,
      identityStatus: first.identityStatus || null,
      timerLog:
        first.timerLog || {
          startedAt: first.submittedAt,
          elapsedSeconds: 0,
          pauses: [],
        },
      scores: scoredRows.map(s => s.score),
      judgeNotes: first.judgeNotes || null,
      submissionIds: subs.map(s => s.id),
    });
  }

  return result;
}

export const ReviewQueueView: React.FC<ReviewQueueViewProps> = ({ tournament }) => {
  const { updateTournament } = useTournament();

  const [sessions, setSessions] = useState<ReviewQueueSessionSummary[]>(() =>
    deriveSessionsFromTournament(tournament)
  );
  const [selectedAdjudication, setSelectedAdjudication] =
    useState<ReviewQueueSessionSummary | null>(null);
  const [selectedIdentity, setSelectedIdentity] =
    useState<ReviewQueueSessionSummary | null>(null);
  const [showCutoffWarning, setShowCutoffWarning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch(`/api/tournaments/${tournament.id}/qualify/sessions`, {
        headers: { ...getAuthHeaders() },
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setSessions(data);
          return;
        }
      }
    } catch {
      // Fallback to store
    }
    setSessions(deriveSessionsFromTournament(tournament));
  }, [tournament]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const pendingUnverifiedCount = sessions.filter(
    s => s.status === 'SUBMITTED' || Boolean(s.timerLog?.resetRequested)
  ).length;

  const handleOpenAdjudicate = (session: ReviewQueueSessionSummary) => {
    setSelectedAdjudication(session);
  };

  const handleOpenIdentity = (session: ReviewQueueSessionSummary) => {
    setSelectedIdentity(session);
  };

  const handleAdjudicate = async (
    action: 'VERIFY' | 'EDIT_AND_VERIFY' | 'DNQ' | 'DQ',
    options?: { scores?: number[]; judgeNotes?: string }
  ) => {
    if (!selectedAdjudication) return;
    setIsSubmitting(true);
    setStatusMessage(null);
    try {
      const res = await fetch(`/api/tournaments/${tournament.id}/qualify/adjudicate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          playerId: selectedAdjudication.playerId,
          action,
          scores: options?.scores,
          judgeNotes: options?.judgeNotes,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to adjudicate qualifier submission');
      }

      setStatusMessage(
        action === 'VERIFY'
          ? `Verified run for ${selectedAdjudication.playerName}`
          : action === 'EDIT_AND_VERIFY'
          ? `Updated scores and verified run for ${selectedAdjudication.playerName}`
          : action === 'DNQ'
          ? `Marked ${selectedAdjudication.playerName} as DNQ`
          : `Disqualified ${selectedAdjudication.playerName}`
      );
      setSelectedAdjudication(null);
      await fetchSessions();
    } catch (e: any) {
      setStatusMessage(`Error: ${e.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVoidReset = async (judgeNote?: string) => {
    if (!selectedAdjudication) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/tournaments/${tournament.id}/qualify/void-reset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          playerId: selectedAdjudication.playerId,
          judgeNote,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to void and reset session');
      }

      setStatusMessage(`Session voided and fresh Authword issued for ${selectedAdjudication.playerName}`);
      setSelectedAdjudication(null);
      await fetchSessions();
    } catch (e: any) {
      setStatusMessage(`Error: ${e.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResolveIdentity = async (
    action: 'CONFIRM_IDENTITY' | 'REASSIGN_PLAYER' | 'PROMOTE_PROVISIONAL',
    options?: { targetPlayerId?: string }
  ) => {
    if (!selectedIdentity) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/tournaments/${tournament.id}/qualify/adjudicate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          playerId: selectedIdentity.playerId,
          action,
          targetPlayerId: options?.targetPlayerId,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to resolve identity');
      }

      setStatusMessage(`Identity resolved for ${selectedIdentity.playerName}`);
      setSelectedIdentity(null);
      await fetchSessions();
    } catch (e: any) {
      setStatusMessage(`Error: ${e.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleQualsClosed = async () => {
    const isCurrentlyClosed = Boolean(tournament.qualsClosed);
    if (!isCurrentlyClosed && pendingUnverifiedCount > 0) {
      setShowCutoffWarning(true);
      return;
    }
    await executeToggleCutoff(!isCurrentlyClosed);
  };

  const executeToggleCutoff = async (nextState: boolean) => {
    setShowCutoffWarning(false);
    setIsSubmitting(true);
    try {
      await updateTournament(tournament.id, { qualsClosed: nextState });
      setStatusMessage(
        nextState
          ? 'Online qualifiers are now officially closed.'
          : 'Online qualifiers have been reopened.'
      );
    } catch (e: any) {
      setStatusMessage(`Error: ${e.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const qualsClosed = Boolean(tournament.qualsClosed);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
      {/* Top Banner / Metrics */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1rem',
        }}
      >
        {/* Pending Review Metric */}
        <div
          style={{
            background: 'var(--color-bg-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            padding: '1.15rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
              Pending Review
            </div>
            <div style={{ fontSize: '1.85rem', fontWeight: 900, color: pendingUnverifiedCount > 0 ? 'var(--color-gold-bright)' : '#ffffff', marginTop: '0.2rem' }}>
              {pendingUnverifiedCount}
            </div>
          </div>
          <Clock size={32} color={pendingUnverifiedCount > 0 ? 'var(--color-gold-bright)' : 'var(--color-text-muted)'} />
        </div>

        {/* Qualifiers Status Metric & Action */}
        <div
          style={{
            background: 'var(--color-bg-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            padding: '1.15rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
              Qualifiers Portal Status
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: qualsClosed ? '#ef4444' : '#4ade80', marginTop: '0.2rem' }}>
              {qualsClosed ? 'Closed' : 'Open / Receiving'}
            </div>
          </div>
          <button
            type="button"
            onClick={handleToggleQualsClosed}
            disabled={isSubmitting}
            className="btn btn-secondary"
            style={{
              fontSize: '0.8rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              color: qualsClosed ? '#4ade80' : '#f87171',
              borderColor: qualsClosed ? 'rgba(34, 197, 94, 0.4)' : 'rgba(239, 68, 68, 0.4)',
            }}
          >
            {qualsClosed ? (
              <>
                <Unlock size={14} /> Reopen Quals
              </>
            ) : (
              <>
                <Lock size={14} /> Close Online Quals
              </>
            )}
          </button>
        </div>
      </div>

      {/* Status Notice */}
      {statusMessage && (
        <div
          style={{
            padding: '0.75rem 1rem',
            borderRadius: 'var(--radius-md)',
            background: statusMessage.startsWith('Error')
              ? 'rgba(239, 68, 68, 0.15)'
              : 'rgba(34, 197, 94, 0.15)',
            border: statusMessage.startsWith('Error')
              ? '1px solid rgba(239, 68, 68, 0.4)'
              : '1px solid rgba(34, 197, 94, 0.4)',
            color: statusMessage.startsWith('Error') ? '#fca5a5' : '#86efac',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>{statusMessage}</span>
          <button
            onClick={() => setStatusMessage(null)}
            style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer' }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Review Queue Table */}
      <ReviewQueueTable
        sessions={sessions}
        onOpenAdjudicate={handleOpenAdjudicate}
        onOpenIdentityModal={handleOpenIdentity}
      />

      {/* Adjudication Modal */}
      <AdjudicationModal
        isOpen={Boolean(selectedAdjudication)}
        session={selectedAdjudication}
        onClose={() => setSelectedAdjudication(null)}
        onAdjudicate={handleAdjudicate}
        onVoidReset={handleVoidReset}
        isSubmitting={isSubmitting}
      />

      {/* Identity Resolution Modal */}
      <IdentityResolutionModal
        isOpen={Boolean(selectedIdentity)}
        session={selectedIdentity}
        playersPool={tournament.playersPool || []}
        onClose={() => setSelectedIdentity(null)}
        onResolve={handleResolveIdentity}
        isSubmitting={isSubmitting}
      />

      {/* Cutoff Confirmation Modal (Assertion 5.1) */}
      {showCutoffWarning && (
        <div
          role="alertdialog"
          aria-modal="true"
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
              border: '1px solid rgba(239, 68, 68, 0.5)',
              borderRadius: 'var(--radius-lg)',
              maxWidth: '520px',
              width: '100%',
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              boxShadow: '0 24px 48px rgba(0, 0, 0, 0.6)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', color: '#ef4444' }}>
              <AlertTriangle size={24} />
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>
                Unverified Submissions Pending!
              </h3>
            </div>
            <p style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)', lineHeight: 1.5, margin: 0 }}>
              There are still <strong>{pendingUnverifiedCount}</strong> online qualifier run(s) awaiting judge review or reset resolution.
              Closing qualifiers now will lock the portal and prevent unverified scores from being seeded into draft brackets.
            </p>
            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', margin: 0 }}>
              Are you sure you want to close qualifiers immediately?
            </p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setShowCutoffWarning(false)}
                className="btn btn-secondary"
                style={{ fontSize: '0.85rem' }}
              >
                Keep Open &amp; Review
              </button>
              <button
                type="button"
                onClick={() => executeToggleCutoff(true)}
                className="btn"
                style={{
                  background: '#ef4444',
                  color: '#ffffff',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                }}
              >
                Close Qualifiers
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
