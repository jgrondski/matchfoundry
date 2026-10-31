import React from 'react';
import { TournamentTier, SeedingMethod } from '../../types';
import { ConfirmDialog } from '../../../../components/overlay';

interface AdminFormModalsProps {
  seedingMethod?: SeedingMethod;
  tierToDelete: { index: number; tier: TournamentTier } | null;
  tiersCount: number;
  onConfirmDeleteTier: (index: number) => void;
  onCancelDeleteTier: () => void;
  dataActionToConfirm: 'MATCHES' | 'QUALS' | 'ALL' | null;
  qualifierCount: number;
  recordedMatchCount: number;
  isExecutingAction?: boolean;
  onConfirmDataAction: () => void;
  onCancelDataAction: () => void;
}

export const AdminFormModals: React.FC<AdminFormModalsProps> = ({
  seedingMethod = 'QUALIFIERS',
  tierToDelete,
  tiersCount,
  onConfirmDeleteTier,
  onCancelDeleteTier,
  dataActionToConfirm,
  qualifierCount,
  recordedMatchCount,
  isExecutingAction,
  onConfirmDataAction,
  onCancelDataAction,
}) => {
  const isManual = seedingMethod === 'MANUAL';
  const dataActionTitle =
    dataActionToConfirm === 'MATCHES'
      ? 'Clear Match Scores'
      : dataActionToConfirm === 'QUALS'
        ? isManual
          ? 'Clear Registered Seeds'
          : 'Clear Qualifier Scores'
        : 'Clear All Tournament Data';
  return (
    <>
      {/* Speedbump Modal for Deleting Bracket Tier */}
      <ConfirmDialog
        open={tierToDelete !== null}
        tone="danger"
        title="Delete Bracket Tier"
        body={
          <>
            <p className="text-sm leading-normal text-fg">
              Are you sure you want to delete bracket <strong>{tierToDelete?.tier.name}</strong>?
            </p>
            {tiersCount === 1 && (
              <div className="rounded-sm border border-red/30 bg-red/10 p-3 text-caption leading-snug text-red-bright">
                ⚠️ This is the final bracket. Deleting it will leave the tournament with 0 brackets until you add a new tier.
              </div>
            )}
          </>
        }
        cancelLabel="Cancel"
        confirmLabel="Yes, Delete Bracket"
        onCancel={onCancelDeleteTier}
        onConfirm={() => tierToDelete && onConfirmDeleteTier(tierToDelete.index)}
      />

      {/* Speedbump Modal for Clearing Tournament Data */}
      <ConfirmDialog
        open={dataActionToConfirm !== null}
        tone="danger"
        title={dataActionTitle}
        body={
          <>
            <p className="text-sm leading-normal text-fg">
              {dataActionToConfirm === 'MATCHES' && (
                <>Are you sure you want to delete all <strong>{recordedMatchCount} recorded match score(s)</strong> across all tiers? Tournament will revert to {isManual ? 'Seeding Mode' : 'Qualifiers Mode'}.</>
              )}
              {dataActionToConfirm === 'QUALS' && (
                isManual ? (
                  <>Are you sure you want to delete all <strong>{qualifierCount} registered seed(s)</strong>? The tournament bracket seeding will be cleared.</>
                ) : (
                  <>Are you sure you want to delete all <strong>{qualifierCount} qualifier score(s)</strong>? The qualifiers leaderboard will be emptied.</>
                )
              )}
              {dataActionToConfirm === 'ALL' && (
                <>Are you sure you want to clear <strong>all {isManual ? 'seed' : 'qualifier'} and match score data</strong> for this tournament? This will reset the tournament data to a clean slate, allowing you to delete it or re-seed.</>
              )}
            </p>
            <p className="text-caption leading-snug text-fg-secondary">This action cannot be undone.</p>
          </>
        }
        cancelLabel="Cancel"
        confirmLabel={isExecutingAction ? 'Clearing Data...' : 'Yes, Clear Data'}
        busy={isExecutingAction}
        onCancel={onCancelDataAction}
        onConfirm={onConfirmDataAction}
      />
    </>
  );
};
