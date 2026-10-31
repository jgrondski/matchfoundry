import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Clock,
  X,
  CheckCheck,
} from 'lucide-react';
import type { Tournament, PlayerProfile } from '../../tournament/types';
import type { ReviewQueueSessionSummary } from '../../../api/qualifiers';
import { deriveSessionsFromTournament } from '../sessionDerivation';
import { useTournament } from '../../tournament/store';
import { getAuthHeaders } from '../../auth/AuthContext';
import { ReviewQueueTable } from './ReviewQueueTable';
import { AdjudicationModal } from './AdjudicationModal';
import { IdentityResolutionModal } from './IdentityResolutionModal';
import { ConfirmDialog } from '../../../components/overlay';
import { cn } from '../../../components/ui';

const metricCardClass = 'flex items-center justify-between rounded-md border border-line bg-surface p-4.5';
const metricLabelClass = 'text-xs font-bold uppercase text-fg-muted';

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
  const [discardTarget, setDiscardTarget] = useState<ReviewQueueSessionSummary | null>(null);
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

  const pendingUnverifiedCount = sessions.filter(s => s.status === 'SUBMITTED').length;

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

  const handleDiscardRun = async () => {
    if (!discardTarget) return;
    setIsSubmitting(true);
    setStatusMessage(null);
    try {
      const res = await fetch(`/api/tournaments/${tournament.id}/qualify/discard`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ playerId: discardTarget.playerId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Failed to discard run');
      }
      if (data.deletedPlayer) {
        setDeletedProvisionalIds(prev => new Set(prev).add(discardTarget.playerId));
      }
      setStatusMessage(
        data.deletedPlayer
          ? `Discarded ${discardTarget.playerName}'s unfinished run and removed the walk-in player`
          : `Discarded ${discardTarget.playerName}'s unfinished run`
      );
      setDiscardTarget(null);
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
    <div className="flex w-full flex-col gap-6">
      {/* Top Banner / Metrics */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
        {/* Pending Review Metric */}
        <div className={metricCardClass}>
          <div>
            <div className={metricLabelClass}>
              Pending Review
            </div>
            <div className={cn('mt-1 text-3xl font-black', pendingUnverifiedCount > 0 ? 'text-gold-bright' : 'text-white')}>
              {pendingUnverifiedCount}
            </div>
          </div>
          <Clock size={32} color={pendingUnverifiedCount > 0 ? 'var(--color-gold-bright)' : 'var(--color-fg-muted)'} />
        </div>

        {/* Qualifiers Status Metric */}
        <div className={metricCardClass}>
          <div>
            <div className={metricLabelClass}>
              Qualifiers State
            </div>
            <div className={cn('mt-1 text-xl font-extrabold', isQualsClosed ? 'text-red' : 'text-green-400')}>
              {isQualsClosed ? 'Closed (Brackets Locked)' : 'Open / Receiving'}
            </div>
          </div>
        </div>

        {/* Batch Actions: Verify All */}
        <div className={cn(metricCardClass, 'gap-4')}>
          <div>
            <div className={metricLabelClass}>
              Batch Verify
            </div>
            <div className="mt-1 text-sm text-fg-secondary">
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
            className={cn(
              'inline-flex items-center gap-2 whitespace-nowrap rounded-md border px-4 py-2 text-caption font-bold transition-all duration-150',
              pendingUnverifiedCount > 0
                ? 'border-warn/45 bg-warn/15 text-gold-bright'
                : 'border-line bg-white/5 text-fg-muted',
              pendingUnverifiedCount > 0 && !isSubmitting ? 'cursor-pointer' : 'cursor-not-allowed'
            )}
          >
            <CheckCheck size={16} />
            Verify All
          </button>
        </div>
      </div>

      {/* Status Notice */}
      {statusMessage && (
        <div
          className={cn(
            'flex items-center justify-between rounded-md border px-4 py-3 text-sm',
            statusMessage.startsWith('Error')
              ? 'border-red/40 bg-red/15 text-red-300'
              : 'border-green-500/40 bg-green-500/15 text-green-300'
          )}
        >
          <span>{statusMessage}</span>
          <button
            onClick={() => setStatusMessage(null)}
            className="cursor-pointer border-0 bg-transparent text-inherit"
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
        onDiscardRun={setDiscardTarget}
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

      {/* Discard Unfinished Run Speedbump Modal */}
      <ConfirmDialog
        open={discardTarget !== null}
        tone="danger"
        title="Discard Unfinished Run?"
        body={
          <>
            <p className="leading-normal text-fg-secondary">
              <strong className="text-white">{discardTarget?.playerName}</strong>'s run (Authword{' '}
              <strong className="text-gold-bright">{discardTarget?.authWord}</strong>) and anything typed
              into it so far will be deleted. They can start a new run afterwards.
            </p>
            {discardTarget?.identityStatus === 'PROVISIONAL_NEW' && (
              <p className="text-caption leading-snug text-fg-muted">
                This run created {discardTarget.playerName} as a walk-in player. If they have nothing else on record,
                they'll be removed from the player list too.
              </p>
            )}
          </>
        }
        cancelLabel="Cancel"
        confirmLabel={isSubmitting ? 'Discarding...' : 'Discard Run'}
        busy={isSubmitting}
        onCancel={() => setDiscardTarget(null)}
        onConfirm={handleDiscardRun}
      />

      {/* Verify All Speedbump Modal */}
      <ConfirmDialog
        open={isVerifyAllModalOpen}
        tone="warning"
        title="Verify All Qualifiers?"
        body={
          <>
            <div className="rounded-md border border-warn/35 bg-warn/12 px-4 py-3.5 text-sm leading-normal font-semibold text-gold-bright">
              ⚠️ Are you sure you want to verify all {pendingUnverifiedCount} pending qualifier run{pendingUnverifiedCount === 1 ? '' : 's'}?
            </div>
            <p className="leading-normal text-fg-secondary">
              This will immediately mark all currently pending qualifier submissions as <strong>VERIFIED</strong>, lock in official scores on the public leaderboard, and update tournament seeding drafts.
            </p>
            <p className="text-caption leading-snug text-fg-muted">
              This action is intended for organizers verifying all outstanding runs in bulk.
            </p>
          </>
        }
        cancelLabel="Cancel"
        confirmLabel={isSubmitting ? 'Verifying...' : `Yes, Verify All (${pendingUnverifiedCount})`}
        confirmVariant="primary"
        busy={isSubmitting}
        confirmDisabled={pendingUnverifiedCount === 0}
        onCancel={() => setIsVerifyAllModalOpen(false)}
        onConfirm={handleVerifyAll}
      />
    </div>
  );
};
