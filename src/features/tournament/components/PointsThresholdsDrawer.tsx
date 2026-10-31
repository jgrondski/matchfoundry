import React, { useId } from 'react';
import { PointsThreshold } from '../types';
import { ClearableNumberInput } from '../../../components/ClearableNumberInput';
import { X, Plus, Trash2, Sliders, Check } from 'lucide-react';
import { Overlay } from '../../../components/overlay';

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
          <div style={headerStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <div
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '8px',
                  background: 'rgba(245, 158, 11, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--color-gold-bright)',
                }}
              >
                <Sliders size={18} />
              </div>
              <div>
                <h2 id={titleId} style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                  Points Qualification Thresholds
                </h2>
                <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: '0.1rem' }}>
                  Highest cutoff reached per qualifier attempt awards fixed points.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={requestClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--color-text-muted)',
                cursor: 'pointer',
                padding: '0.25rem',
              }}
            >
              <X size={18} />
            </button>
          </div>

          {/* Content */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                Configured Cutoffs ({pointsConfig.length})
              </span>
              <button
                type="button"
                onClick={onAddThreshold}
                className="btn btn-secondary"
                style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', gap: '0.35rem' }}
              >
                <Plus size={14} /> Add Threshold
              </button>
            </div>

            {pointsConfig.length === 0 ? (
              <div
                style={{
                  padding: '2.5rem 1rem',
                  textAlign: 'center',
                  background: 'var(--color-bg-base)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px dashed var(--color-border)',
                  color: 'var(--color-text-muted)',
                  fontSize: '0.85rem',
                }}
              >
                No point thresholds configured yet. Click "Add Threshold" to start.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {pointsConfig.map((th, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.75rem',
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--color-bg-surface-elevated)',
                      border: '1px solid var(--color-border-subtle)',
                    }}
                  >
                    <div
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        background: 'var(--color-bg-base)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        color: 'var(--color-text-muted)',
                        flexShrink: 0,
                      }}
                    >
                      {idx + 1}
                    </div>

                    <div style={{ flex: 1 }}>
                      <label style={labelStyle}>Min Score</label>
                      <ClearableNumberInput
                        min={0}
                        value={th.minScore}
                        onChange={(val: number | undefined) => onUpdateThreshold(idx, 'minScore', val ?? 0)}
                        style={inputStyle}
                      />
                    </div>

                    <div style={{ width: '130px' }}>
                      <label style={labelStyle}>Points Awarded</label>
                      <ClearableNumberInput
                        min={0}
                        value={th.points}
                        onChange={(val: number | undefined) => onUpdateThreshold(idx, 'points', val ?? 0)}
                        style={inputStyle}
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => onRemoveThreshold(idx)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--color-red)',
                        cursor: 'pointer',
                        padding: '0.35rem',
                        marginTop: '1.15rem',
                        flexShrink: 0,
                      }}
                      title="Remove threshold"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div
              style={{
                padding: '0.85rem',
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(245, 158, 11, 0.08)',
                border: '1px solid rgba(245, 158, 11, 0.25)',
                fontSize: '0.78rem',
                color: 'var(--color-text-muted)',
                lineHeight: 1.45,
              }}
            >
              💡 <strong style={{ color: 'var(--color-gold-bright)' }}>Non-Cumulative Evaluation:</strong> Each submitted qualifier score is checked against these thresholds. The player receives the points corresponding to the highest minimum score they achieved for that attempt.
            </div>
          </div>

          {/* Footer */}
          <div style={footerStyle}>
            <button
              type="button"
              onClick={requestClose}
              className="btn btn-primary"
              style={{ width: '100%', padding: '0.55rem', fontSize: '0.85rem', gap: '0.4rem' }}
            >
              <Check size={16} /> Done
            </button>
          </div>
        </>
      )}
    </Overlay>
  );
};

const headerStyle: React.CSSProperties = {
  padding: '1.25rem',
  borderBottom: '1px solid var(--color-border)',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  background: 'var(--color-bg-surface-elevated)',
};

const footerStyle: React.CSSProperties = {
  padding: '1rem 1.25rem',
  borderTop: '1px solid var(--color-border)',
  background: 'var(--color-bg-surface-elevated)',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.72rem',
  color: 'var(--color-text-muted)',
  marginBottom: '0.25rem',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.03em',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.45rem 0.65rem',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--color-border)',
  background: 'var(--color-bg-base)',
  color: 'var(--color-text-primary)',
  fontSize: '0.85rem',
};
