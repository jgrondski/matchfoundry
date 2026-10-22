import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Clock,
  X,
  CheckCheck,
  AlertTriangle,
} from 'lucide-react';
import type { Tournament, PlayerProfile } from '../../tournament/types';
import type { ReviewQueueSessionSummary } from '../../../api/qualifiers';
import { deriveSessionsFromTournament } from '../sessionDerivation';
import { useTournament } from '../../tournament/store';
import { getAuthHeaders } from '../../auth/AuthContext';
import { ReviewQueueTable } from './ReviewQueueTable';
import { AdjudicationModal } from './AdjudicationModal';
import { IdentityResolutionModal } from './IdentityResolutionModal';

export interface ReviewQueueViewProps {
  tournament: Tournament;
}


export const ReviewQueueView: React.FC<ReviewQueueViewProps> = ({ tournament }) => {
  const { refreshTournament, globalPlayers } = useTournament();
  const [deletedProvisionalIds, setDeletedProvisionalIds] = useState<Set<string>>(() => new Set());

  const reconcilePlayersPool = useMemo(() => {
    const map = new Map<string, PlayerProfile>();
    if (Array.isArray(globalPlayers)) {
      for (const p of globalPlayers) {
        if (!deletedProvisionalIds.has(p.id)) {
          map.set(p.id, p);
        }
      }
    }
    if (Array.isArray(tournament.playersPool)) {
      for (const p of tournament.playersPool) {
        if (!deletedProvisionalIds.has(p.id)) {
          map.set(p.id, p);
        }
      }
    }
    return Array.from(map.values());
  }, [globalPlayers, tournament.playersPool, deletedProvisionalIds]);

  const [sessions, setSessions] = useState<ReviewQueueSessionSummary[]>(() =>
    deriveSessionsFromTournament(tournament)
  );
  const [selectedAdjudication, setSelectedAdjudication] =
    useState<ReviewQueueSessionSummary | null>(null);
  const [selectedIdentity, setSelectedIdentity] =
    useState<ReviewQueueSessionSummary | null>(null);
  const [isVerifyAllModalOpen, setIsVerifyAllModalOpen] = useState(false);
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
      await refreshTournament?.(tournament.id);
    } catch (e: any) {
      setStatusMessage(`Error: ${e.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyAll = async () => {
    setIsSubmitting(true);
    setStatusMessage(null);
    try {
      const res = await fetch(`/api/tournaments/${tournament.id}/qualify/verify-all`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ verifiedBy: 'Judge' }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to verify all qualifier submissions');
      }

      const data = await res.json().catch(() => ({ verifiedCount: pendingUnverifiedCount }));
      setStatusMessage(`Successfully verified all ${data.verifiedCount || pendingUnverifiedCount} pending qualifier runs.`);
      setIsVerifyAllModalOpen(false);
      await fetchSessions();
      await refreshTournament?.(tournament.id);
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
      await refreshTournament?.(tournament.id);
    } catch (e: any) {
      setStatusMessage(`Error: ${e.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResolveIdentity = async (
    action: 'CONFIRM_IDENTITY' | 'REASSIGN_PLAYER' | 'PROMOTE_PROVISIONAL' | 'CREATE_NEW_PLAYER',
    options?: {
      targetPlayerId?: string;
      newPlayer?: { name: string; country?: string; playstyle?: string };
    }
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
          newPlayer: options?.newPlayer,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to resolve identity');
      }

      if (
        selectedIdentity.identityStatus === 'PROVISIONAL_NEW' &&
        (action === 'REASSIGN_PLAYER' || action === 'CREATE_NEW_PLAYER')
      ) {
        const oldId = selectedIdentity.playerId;
        setDeletedProvisionalIds(prev => {
          const next = new Set(prev);
          next.add(oldId);
          return next;
        });
      }

      setStatusMessage(`Identity resolved for ${selectedIdentity.playerName}`);
      setSelectedIdentity(null);
      await fetchSessions();
      await refreshTournament?.(tournament.id);
    } catch (e: any) {
      setStatusMessage(`Error: ${e.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isQualsClosed = Boolean(tournament.isLocked);

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

        {/* Qualifiers Status Metric */}
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
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: isQualsClosed ? '#ef4444' : '#4ade80', marginTop: '0.2rem' }}>
              {isQualsClosed ? 'Closed (Brackets Locked)' : 'Open / Receiving'}
            </div>
          </div>
        </div>

        {/* Batch Actions: Verify All */}
        <div
          style={{
            background: 'var(--color-bg-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            padding: '1.15rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
          }}
        >
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
              Batch Adjudication
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginTop: '0.3rem' }}>
              {pendingUnverifiedCount > 0
                ? `${pendingUnverifiedCount} run${pendingUnverifiedCount === 1 ? '' : 's'} awaiting review`
                : 'All runs verified'}
            </div>
          </div>
          <button
            type="button"
            data-testid="verify-all-button"
            disabled={pendingUnverifiedCount === 0 || isSubmitting}
            onClick={() => setIsVerifyAllModalOpen(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.55rem 0.95rem',
              fontSize: '0.82rem',
              fontWeight: 700,
              borderRadius: 'var(--radius-md)',
              background: pendingUnverifiedCount > 0 ? 'rgba(234, 179, 8, 0.15)' : 'rgba(255, 255, 255, 0.05)',
              border: `1px solid ${pendingUnverifiedCount > 0 ? 'rgba(234, 179, 8, 0.45)' : 'var(--color-border)'}`,
              color: pendingUnverifiedCount > 0 ? 'var(--color-gold-bright)' : 'var(--color-text-muted)',
              cursor: pendingUnverifiedCount > 0 && !isSubmitting ? 'pointer' : 'not-allowed',
              transition: 'all 0.15s ease',
              whiteSpace: 'nowrap',
            }}
          >
            <CheckCheck size={16} />
            Verify All
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
        qualWindowMinutes={tournament.qualWindowMinutes || 90}
      />

      {/* Adjudication Modal */}
      {selectedAdjudication && (
        <AdjudicationModal
          key={selectedAdjudication.playerId}
          isOpen={true}
          session={selectedAdjudication}
          onClose={() => setSelectedAdjudication(null)}
          onAdjudicate={handleAdjudicate}
          onVoidReset={handleVoidReset}
          onOpenIdentity={(s) => {
            setSelectedAdjudication(null);
            setSelectedIdentity(s);
          }}
          isSubmitting={isSubmitting}
        />
      )}

      {/* Identity Resolution Modal */}
      {selectedIdentity && (
        <IdentityResolutionModal
          key={selectedIdentity.playerId}
          isOpen={true}
          session={selectedIdentity}
          playersPool={reconcilePlayersPool}
          onClose={() => setSelectedIdentity(null)}
          onResolve={handleResolveIdentity}
          isSubmitting={isSubmitting}
        />
      )}

      {/* Verify All Speedbump Modal */}
      {isVerifyAllModalOpen && (
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
            data-testid="verify-all-modal"
            style={{
              background: 'var(--color-bg-surface, #181b20)',
              borderRadius: 'var(--radius-lg, 12px)',
              border: '1px solid rgba(234, 179, 8, 0.5)',
              maxWidth: '480px',
              width: '100%',
              boxShadow: '0 10px 30px rgba(0, 0, 0, 0.6)',
              overflow: 'hidden',
              animation: 'fadeIn 0.2s ease-out',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '1.25rem 1.5rem',
                borderBottom: '1px solid var(--color-border, #2d3139)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <AlertTriangle size={22} color="var(--color-gold-bright, #f59e0b)" />
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#ffffff' }}>
                  Verify All Qualifiers?
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsVerifyAllModalOpen(false)}
                disabled={isSubmitting}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--color-text-muted, #94a3b8)',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  padding: '0.25rem',
                  display: 'flex',
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div
                style={{
                  padding: '0.85rem 1rem',
                  borderRadius: 'var(--radius-md, 8px)',
                  background: 'rgba(234, 179, 8, 0.12)',
                  border: '1px solid rgba(234, 179, 8, 0.35)',
                  color: 'var(--color-gold-bright, #f59e0b)',
                  fontSize: '0.85rem',
                  lineHeight: 1.45,
                  fontWeight: 600,
                }}
              >
                ⚠️ Are you sure you want to verify all {pendingUnverifiedCount} pending qualifier run{pendingUnverifiedCount === 1 ? '' : 's'}?
              </div>
              <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--color-text-secondary, #cbd5e1)', lineHeight: 1.5 }}>
                This will immediately mark all currently pending qualifier submissions as <strong>VERIFIED</strong>, lock in official scores on the public leaderboard, and update tournament seeding drafts.
              </p>
              <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--color-text-muted, #94a3b8)', lineHeight: 1.4 }}>
                This action is intended for organizers verifying all outstanding runs in bulk.
              </p>
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: '1rem 1.5rem',
                borderTop: '1px solid var(--color-border, #2d3139)',
                background: 'var(--color-bg-base, #111317)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: '0.75rem',
              }}
            >
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setIsVerifyAllModalOpen(false)}
                className="btn btn-secondary"
                style={{
                  padding: '0.55rem 1.15rem',
                  fontSize: '0.85rem',
                  background: 'transparent',
                  border: '1px solid var(--color-border, #3f3f46)',
                  color: 'var(--color-text-main, #ffffff)',
                  borderRadius: 'var(--radius-md, 6px)',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                data-testid="confirm-verify-all-button"
                disabled={isSubmitting || pendingUnverifiedCount === 0}
                onClick={handleVerifyAll}
                className="btn btn-primary"
                style={{
                  padding: '0.55rem 1.15rem',
                  fontSize: '0.85rem',
                  background: 'var(--color-gold-bright, #f59e0b)',
                  color: '#000000',
                  fontWeight: 800,
                  border: 'none',
                  borderRadius: 'var(--radius-md, 6px)',
                  cursor: isSubmitting || pendingUnverifiedCount === 0 ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                }}
              >
                {isSubmitting ? 'Verifying...' : `Yes, Verify All (${pendingUnverifiedCount})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
