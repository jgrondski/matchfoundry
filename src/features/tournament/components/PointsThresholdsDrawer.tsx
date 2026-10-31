import React, { useId } from 'react';
import { PointsThreshold } from '../types';
import { ClearableNumberInput } from '../../../components/ClearableNumberInput';
import { X, Plus, Trash2, Sliders, Check } from 'lucide-react';
import { Overlay } from '../../../components/overlay';
import { Button, IconButton } from '../../../components/ui';

const labelClass = 'mb-1 block text-xs font-semibold uppercase tracking-wide text-fg-muted';
const inputClass = 'w-full rounded-sm border border-line bg-canvas py-2 px-2.5 text-sm text-fg';

interface PointsThresholdsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  pointsConfig: PointsThreshold[];
  onAddThreshold: () => void;
  onUpdateThreshold: (index: number, field: keyof PointsThreshold, value: number) => void;
  onRemoveThreshold: (index: number) => void;
}

export const PointsThresholdsDrawer: React.FC<PointsThresholdsDrawerProps> = ({
  isOpen,
  onClose,
  pointsConfig,
  onAddThreshold,
  onUpdateThreshold,
  onRemoveThreshold,
}) => {
  const titleId = useId();

  if (!isOpen) return null;

  return (
    <Overlay
      open
      onClose={onClose}
      variant="drawer"
      aria-labelledby={titleId}
      panelClassName="max-w-120 overflow-visible border-l border-line bg-surface shadow-lg"
    >
      {({ requestClose }) => (
        <>
          {/* Header */}
          <div className="flex items-start justify-between border-b border-line bg-elevated p-5">
            <div className="flex items-center gap-2.5">
              <div className="flex size-8.5 items-center justify-center rounded-md bg-gold/15 text-gold-bright">
                <Sliders size={18} />
              </div>
              <div>
                <h2 id={titleId} className="text-lg font-bold text-fg">
                  Points Qualification Thresholds
                </h2>
                <p className="mt-0.5 text-caption text-fg-muted">
                  Highest cutoff reached per qualifier attempt awards fixed points.
                </p>
              </div>
            </div>
            <IconButton aria-label="Close" onClick={requestClose}>
              <X size={18} />
            </IconButton>
          </div>

          {/* Content */}
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-fg-secondary">
                Configured Cutoffs ({pointsConfig.length})
              </span>
              <Button onClick={onAddThreshold} className="gap-1.5 py-1.5 px-3 text-caption">
                <Plus size={14} /> Add Threshold
              </Button>
            </div>

            {pointsConfig.length === 0 ? (
              <div className="rounded-md border border-dashed border-line bg-canvas py-10 px-4 text-center text-sm text-fg-muted">
                No point thresholds configured yet. Click "Add Threshold" to start.
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {pointsConfig.map((th, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-3 rounded-md border border-line-subtle bg-elevated p-3"
                  >
                    <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-canvas text-xs font-bold text-fg-muted">
                      {idx + 1}
                    </div>

                    <div className="flex-1">
                      <label className={labelClass}>Min Score</label>
                      <ClearableNumberInput
                        min={0}
                        value={th.minScore}
                        onChange={(val: number | undefined) => onUpdateThreshold(idx, 'minScore', val ?? 0)}
                        className={inputClass}
                      />
                    </div>

                    <div className="w-32.5">
                      <label className={labelClass}>Points Awarded</label>
                      <ClearableNumberInput
                        min={0}
                        value={th.points}
                        onChange={(val: number | undefined) => onUpdateThreshold(idx, 'points', val ?? 0)}
                        className={inputClass}
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => onRemoveThreshold(idx)}
                      className="mt-4.5 shrink-0 cursor-pointer border-0 bg-transparent p-1.5 text-red"
                      title="Remove threshold"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="rounded-sm border border-gold/25 bg-gold/8 p-3.5 text-caption leading-normal text-fg-muted">
              💡 <strong className="text-gold-bright">Non-Cumulative Evaluation:</strong> Each submitted qualifier score is checked against these thresholds. The player receives the points corresponding to the highest minimum score they achieved for that attempt.
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-line bg-elevated py-4 px-5">
            <Button variant="primary" onClick={requestClose} className="w-full gap-1.5 p-2 text-sm">
              <Check size={16} /> Done
            </Button>
          </div>
        </>
      )}
    </Overlay>
  );
};

