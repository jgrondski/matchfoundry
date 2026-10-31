import React, { useState } from 'react';
import { QualFormat, PointsThreshold, DEFAULT_POINTS_THRESHOLDS } from '../types';
import { ClearableNumberInput } from '../../../components/ClearableNumberInput';
import { PointsThresholdsDrawer } from './PointsThresholdsDrawer';
import { Sliders } from 'lucide-react';
import { Button } from '../../../components/ui';

const labelClass = 'mb-1.5 block text-caption font-semibold text-fg-secondary';
const inputClass = 'w-full rounded-sm border border-line bg-canvas py-2.5 px-3 text-sm text-fg outline-none';

interface QualFormatEditorProps {
  qualFormat: QualFormat;
  qualAverageCount?: number;
  pointsConfig?: PointsThreshold[];
  onFormatChange: (format: QualFormat) => void;
  onAverageCountChange: (count: number | undefined) => void;
  onPointsConfigChange: (points: PointsThreshold[]) => void;
  avgCountError?: string | null;
  onAvgCountErrorChange?: (err: string | null) => void;
}

export const QualFormatEditor: React.FC<QualFormatEditorProps> = ({
  qualFormat,
  qualAverageCount = 2,
  pointsConfig = DEFAULT_POINTS_THRESHOLDS,
  onFormatChange,
  onAverageCountChange,
  onPointsConfigChange,
  avgCountError,
  onAvgCountErrorChange,
}) => {
  const [isPointsDrawerOpen, setIsPointsDrawerOpen] = useState(false);

  const handleFormatSelect = (newFmt: QualFormat) => {
    onFormatChange(newFmt);
    if (newFmt === 'POINTS' && (!pointsConfig || pointsConfig.length === 0)) {
      onPointsConfigChange(DEFAULT_POINTS_THRESHOLDS);
    }
  };

  const handleAddThreshold = () => {
    const current = pointsConfig || [];
    onPointsConfigChange([...current, { minScore: 500000, points: 10 }]);
  };

  const handleUpdateThreshold = (index: number, field: keyof PointsThreshold, value: number) => {
    const current = [...(pointsConfig || [])];
    current[index] = { ...current[index], [field]: value };
    onPointsConfigChange(current);
  };

  const handleRemoveThreshold = (index: number) => {
    const current = pointsConfig || [];
    onPointsConfigChange(current.filter((_, i) => i !== index));
  };

  const activePoints = pointsConfig || DEFAULT_POINTS_THRESHOLDS;

  return (
    <div className="flex flex-col gap-3.5">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] items-start gap-3.5">
        <div>
          <label className={labelClass}>Qualifying Format</label>
          <select
            value={qualFormat}
            onChange={e => handleFormatSelect(e.target.value as QualFormat)}
            className={inputClass}
          >
            <option value="HIGH_SCORE"># of Maxes</option>
            <option value="AVERAGE_OF_X">Average of X Attempts</option>
            <option value="POINTS">Points Threshold System</option>
          </select>
        </div>

        {qualFormat === 'AVERAGE_OF_X' && (
          <div>
            <label className={labelClass}>Target Attempt Count (X)</label>
            <ClearableNumberInput
              min={1}
              max={10}
              value={qualAverageCount}
              onChange={val => {
                onAverageCountChange(val);
                if (avgCountError && onAvgCountErrorChange) onAvgCountErrorChange(null);
              }}
              error={avgCountError}
              onErrorChange={onAvgCountErrorChange}
              className={inputClass}
            />
            <span className="mt-1 block text-xs text-fg-muted">
              e.g. 2 for Average of 2, 3 for Average of 3
            </span>
          </div>
        )}
      </div>

      {qualFormat === 'POINTS' && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-md border border-line-subtle bg-elevated py-4 px-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-fg">
                Points Threshold System
              </span>
              <span className="rounded-full bg-gold/15 py-0.5 px-2 text-xs font-bold text-gold-bright">
                {activePoints.length} {activePoints.length === 1 ? 'cutoff' : 'cutoffs'} configured
              </span>
            </div>
            <p className="mx-0 mb-0 mt-1 text-caption text-fg-muted">
              Attempts award points non-cumulatively based on highest cutoff reached.
              {activePoints.length > 0 && (
                <span className="ml-1.5 text-fg-secondary">
                  ({[...activePoints].sort((a, b) => b.minScore - a.minScore).slice(0, 4).map(p => `${(p.minScore / 1000).toFixed(0)}k → +${p.points}`).join(', ')}{activePoints.length > 4 ? ', ...' : ''})
                </span>
              )}
            </p>
          </div>

          <Button
            onClick={() => setIsPointsDrawerOpen(true)}
            className="gap-1.5 whitespace-nowrap py-2 px-3.5 text-caption"
          >
            <Sliders size={14} color="var(--color-gold-bright, #ffc905)" />
            Configure Points Cutoffs
          </Button>
        </div>
      )}

      <PointsThresholdsDrawer
        isOpen={isPointsDrawerOpen}
        onClose={() => setIsPointsDrawerOpen(false)}
        pointsConfig={activePoints}
        onAddThreshold={handleAddThreshold}
        onUpdateThreshold={handleUpdateThreshold}
        onRemoveThreshold={handleRemoveThreshold}
      />
    </div>
  );
};
