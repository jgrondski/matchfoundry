import React, { useState, useEffect } from 'react';
import { TournamentTier } from '../types';
import { Plus, Trash2, Check } from 'lucide-react';
import { getAvailableRoundsForTier } from '../roundOverrides';
import { BestOfSelect } from '../../bracket/components/BestOfSelect';
import { Button, cn } from '../../../components/ui';

interface DraftOverrideRow {
  id: string;
  roundKey: string | number;
  bestOf: number;
  originalRoundKey: string | number;
  originalBestOf: number;
  isDirty: boolean;
}

interface RoundOverridesEditorProps {
  tier: TournamentTier;
  onChange: (overrides: Record<string | number, number>) => void;
}

export const RoundOverridesEditor: React.FC<RoundOverridesEditorProps> = ({ tier, onChange }) => {
  const [draftRows, setDraftRows] = useState<DraftOverrideRow[]>(() => {
    const entries = Object.entries(tier.roundBestOfOverrides || {})
      .map(([rStr, boVal]) => {
        const num = parseInt(rStr, 10);
        const roundKey = !isNaN(num) && String(num) === rStr ? num : rStr;
        return { roundKey, bestOf: boVal };
      });

    return entries.map(e => ({
      id: `r_${e.roundKey}`,
      roundKey: e.roundKey,
      bestOf: e.bestOf,
      originalRoundKey: e.roundKey,
      originalBestOf: e.bestOf,
      isDirty: false,
    }));
  });

  // Sync with tier.roundBestOfOverrides changes if there are no dirty edits in progress
  useEffect(() => {
    const entries = Object.entries(tier.roundBestOfOverrides || {})
      .map(([rStr, boVal]) => {
        const num = parseInt(rStr, 10);
        const roundKey = !isNaN(num) && String(num) === rStr ? num : rStr;
        return { roundKey, bestOf: boVal };
      });

    setDraftRows(prev => {
      // If user has active dirty edits, do not disrupt unless overrides structurally changed
      const hasDirty = prev.some(r => r.isDirty);
      if (hasDirty) return prev;

      if (
        prev.length === entries.length &&
        prev.every((r, idx) => r.roundKey === entries[idx]?.roundKey && r.bestOf === entries[idx]?.bestOf)
      ) {
        return prev;
      }

      return entries.map(e => ({
        id: `r_${e.roundKey}`,
        roundKey: e.roundKey,
        bestOf: e.bestOf,
        originalRoundKey: e.roundKey,
        originalBestOf: e.bestOf,
        isDirty: false,
      }));
    });
  }, [tier.roundBestOfOverrides]);

  const availableRounds = getAvailableRoundsForTier(tier);

  const handleAdd = () => {
    const takenKeys = new Set(draftRows.map(r => String(r.roundKey)));
    const nextRound = availableRounds.find(r => !takenKeys.has(String(r.roundIdentifier || r.roundNumber)));
    if (!nextRound) return;

    const roundKey = nextRound.roundIdentifier || nextRound.roundNumber;
    const newRow: DraftOverrideRow = {
      id: `draft_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      roundKey,
      bestOf: tier.bestOf,
      originalRoundKey: -1,
      originalBestOf: -1,
      isDirty: true,
    };

    setDraftRows(prev => [...prev, newRow]);
  };

  const handleRoundChange = (rowId: string, newRoundKey: string | number) => {
    setDraftRows(prev =>
      prev.map(r => {
        if (r.id !== rowId) return r;
        const isDirty = newRoundKey !== r.originalRoundKey || r.bestOf !== r.originalBestOf;
        return {
          ...r,
          roundKey: newRoundKey,
          isDirty,
        };
      })
    );
  };

  const handleBestOfChange = (rowId: string, newBo: number) => {
    setDraftRows(prev =>
      prev.map(r => {
        if (r.id !== rowId) return r;
        const isDirty = r.roundKey !== r.originalRoundKey || newBo !== r.originalBestOf;
        return {
          ...r,
          bestOf: newBo,
          isDirty,
        };
      })
    );
  };

  const handleSaveRow = (rowId: string) => {
    const updatedRows = draftRows.map(r => {
      if (r.id !== rowId) return r;
      return {
        ...r,
        originalRoundKey: r.roundKey,
        originalBestOf: r.bestOf,
        isDirty: false,
      };
    });

    setDraftRows(updatedRows);

    const nextOverrides: Record<string | number, number> = {};
    for (const r of updatedRows) {
      if (r.originalRoundKey !== -1) {
        nextOverrides[r.roundKey] = r.bestOf;
      }
    }
    onChange(nextOverrides);
  };

  const handleDeleteRow = (rowId: string) => {
    const remaining = draftRows.filter(r => r.id !== rowId);
    setDraftRows(remaining);

    const nextOverrides: Record<string | number, number> = {};
    for (const r of remaining) {
      if (r.originalRoundKey !== -1) {
        nextOverrides[r.roundKey] = r.bestOf;
      }
    }
    onChange(nextOverrides);
  };

  const configuredCount = Object.keys(tier.roundBestOfOverrides || {}).length;
  const isAllConfigured = availableRounds.length > 0 && availableRounds.every(r =>
    draftRows.some(row => String(row.roundKey) === String(r.roundIdentifier || r.roundNumber))
  );

  return (
    <div className="mt-5 w-full border-t border-line-subtle pt-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-fg">
              Round-Specific Best-of Overrides
            </span>
            <span
              className={cn(
                'rounded-full border border-line-subtle py-0.5 px-2 text-2xs font-semibold',
                configuredCount > 0 ? 'bg-gold-soft text-gold-bright' : 'bg-canvas text-fg-muted'
              )}
            >
              {configuredCount} configured
            </span>
          </div>
          <p className="mx-0 mb-0 mt-0.5 text-xs text-fg-muted">
            Override series format for specific rounds (e.g., Finals Bo7). Unconfigured rounds inherit default <strong>Bo{tier.bestOf}</strong>.
          </p>
        </div>

        {/* Add button on the right side of header */}
        <Button
          variant="primary"
          size="sm"
          onClick={handleAdd}
          disabled={isAllConfigured}
          title={
            isAllConfigured
              ? 'All rounds in this bracket already have overrides configured'
              : 'Add a round-specific Best-of format override'
          }
          className="shrink-0"
        >
          <Plus size={14} /> Add Override
        </Button>
      </div>

      {draftRows.length > 0 && (
        <div className="grid grid-cols-2 gap-2.5 transition-all duration-300">
          {draftRows.map(row => {
            const otherDraftKeys = new Set(
              draftRows.filter(r => r.id !== row.id).map(r => String(r.roundKey))
            );
            const selectableRounds = availableRounds.filter(r => {
              const k = String(r.roundIdentifier || r.roundNumber);
              return k === String(row.roundKey) || !otherDraftKeys.has(k);
            });

            return (
              <div
                key={row.id}
                className={cn(
                  'flex flex-col gap-2 rounded-sm border bg-canvas py-2.5 px-3 transition-all duration-300',
                  row.isDirty
                    ? 'border-gold-bright ring-1 ring-warn/20'
                    : 'border-line-subtle shadow-none'
                )}
              >
                <div className="grid grid-cols-[1fr_1fr] items-start gap-2">
                  {/* Target Round dropdown */}
                  <div className="min-w-0">
                    <label className="mb-1 block text-2xs font-semibold text-fg-muted">
                      Target Round
                    </label>
                    <select
                      value={String(row.roundKey)}
                      onChange={e => {
                        const val = e.target.value;
                        const num = parseInt(val, 10);
                        const parsedKey = !isNaN(num) && String(num) === val ? num : val;
                        handleRoundChange(row.id, parsedKey);
                      }}
                      className="w-full rounded-sm border border-line bg-canvas py-1.5 px-2 text-caption text-fg"
                    >
                      {selectableRounds.map(r => {
                        const optVal = String(r.roundIdentifier || r.roundNumber);
                        return (
                          <option key={optVal} value={optVal}>
                            {r.name}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {/* BestOf Combobox */}
                  <div className="min-w-0">
                    <label className="mb-1 block text-2xs font-semibold text-fg-muted">
                      Format
                    </label>
                    <BestOfSelect
                      value={row.bestOf}
                      onChange={newBo => handleBestOfChange(row.id, newBo)}
                      compact={true}
                    />
                  </div>
                </div>

                {/* Actions: Save & Delete */}
                <div className="flex items-center justify-end gap-1.5 border-t border-line-subtle pt-1.5">
                  {row.isDirty && (
                    <span className="mr-auto text-2xs font-semibold text-gold-bright">
                      Unsaved
                    </span>
                  )}
                  <button
                    type="button"
                    disabled={!row.isDirty}
                    onClick={() => handleSaveRow(row.id)}
                    title={row.isDirty ? 'Save round override' : 'No unsaved changes'}
                    className={cn(
                      'inline-flex items-center gap-1 rounded-sm border py-1 px-2 text-xs font-semibold transition-all duration-200',
                      row.isDirty
                        ? 'cursor-pointer border-gold-bright bg-gold-soft text-gold-bright opacity-100'
                        : 'cursor-not-allowed border-line-subtle bg-transparent text-fg-muted opacity-40'
                    )}
                  >
                    <Check size={13} />
                    <span>Save</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteRow(row.id)}
                    title="Remove round override"
                    className="inline-flex cursor-pointer items-center gap-1 rounded-sm border border-line-subtle bg-transparent py-1 px-2 text-xs font-semibold text-fg-muted transition-all duration-200 hover:border-red hover:text-red"
                  >
                    <Trash2 size={13} />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
