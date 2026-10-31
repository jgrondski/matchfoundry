import React, { useState, useId } from 'react';
import { Users, X, Sparkles } from 'lucide-react';
import { ClearableNumberInput } from '../../../components/ClearableNumberInput';
import { Overlay } from '../../../components/overlay';

interface GenerateFakePlayersModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (count: number) => void;
  existingCount: number;
}

export const GenerateFakePlayersModal: React.FC<GenerateFakePlayersModalProps> = ({
  isOpen,
  onClose,
  onGenerate,
  existingCount,
}) => {
  const [count, setCount] = useState<number | undefined>(16);
  const titleId = useId();

  if (!isOpen) return null;

  const handlePreset = (val: number) => {
    setCount(val);
  };

  const handleConfirm = () => {
    if (count !== undefined && count >= 1 && count <= 200) {
      onGenerate(count);
      onClose();
    }
  };

  return (
    <Overlay
      open
      onClose={onClose}
      dirty={count !== 16}
      aria-labelledby={titleId}
      panelClassName="max-w-115 overflow-hidden rounded-lg border border-line bg-elevated shadow-xl"
    >
      {({ requestClose }) => (
        <>
          {/* Header */}
          <div
            style={{
              padding: '1.25rem 1.5rem',
              borderBottom: '1px solid var(--color-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'var(--color-bg-surface)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  background: 'rgba(245, 158, 11, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--color-gold-bright)',
                }}
              >
                <Sparkles size={18} />
              </div>
              <div>
                <h3 id={titleId} style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
                  Generate Fake Players
                </h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: 0 }}>
                  Append realistic competitors to the global player directory
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
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div
              style={{
                padding: '0.85rem 1rem',
                background: 'var(--color-bg-base)',
                border: '1px solid var(--color-border-subtle)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.85rem',
                color: 'var(--color-text-secondary)',
                lineHeight: 1.5,
              }}
            >
              Generates players with randomized authentic competitor names, playstyles (<strong>Rolling</strong>, <strong>DAS</strong>, <strong>Hypertap</strong>), personal bests (700,000–1,350,000), and country codes.
              <div style={{ marginTop: '0.4rem', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                Current global pool size: <strong>{existingCount}</strong> players.
              </div>
            </div>

            <div>
              <label
                htmlFor="fake-player-count-input"
                style={{
                  display: 'block',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  color: 'var(--color-text-primary)',
                  marginBottom: '0.5rem',
                }}
              >
                Number of Players to Generate
              </label>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                <div style={{ flex: 1 }}>
                  <ClearableNumberInput
                    id="fake-player-count-input"
                    min={1}
                    max={200}
                    value={count}
                    onChange={setCount}
                    style={{
                      padding: '0.65rem 0.85rem',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--color-border)',
                      backgroundColor: 'var(--color-bg-base)',
                      color: 'var(--color-text-primary)',
                      fontSize: '1.1rem',
                      fontWeight: 700,
                    }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.65rem' }}>
                  <Users size={16} color="var(--color-text-muted)" />
                  <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
                    competitors
                  </span>
                </div>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.35rem' }}>
                Enter a number between 1 and 200
              </div>
            </div>

            {/* Presets */}
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                Quick Presets
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {[8, 16, 32, 64].map(preset => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => handlePreset(preset)}
                    className="btn btn-secondary"
                    style={{
                      padding: '0.35rem 0.85rem',
                      fontSize: '0.8rem',
                      background: count === preset ? 'var(--color-gold-bg)' : undefined,
                      borderColor: count === preset ? 'var(--color-gold)' : undefined,
                      color: count === preset ? 'var(--color-gold-bright)' : undefined,
                      fontWeight: count === preset ? 700 : 500,
                    }}
                  >
                    +{preset} Players
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div
            style={{
              padding: '1rem 1.5rem',
              borderTop: '1px solid var(--color-border)',
              background: 'var(--color-bg-surface)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '0.75rem',
            }}
          >
            <button
              type="button"
              onClick={requestClose}
              className="btn btn-secondary"
              style={{ padding: '0.55rem 1.25rem', fontSize: '0.85rem' }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!count || count < 1 || count > 200}
              className="btn btn-primary"
              style={{
                padding: '0.55rem 1.5rem',
                fontSize: '0.85rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                boxShadow: 'var(--shadow-gold)',
                opacity: (!count || count < 1 || count > 200) ? 0.5 : 1,
                cursor: (!count || count < 1 || count > 200) ? 'not-allowed' : 'pointer',
              }}
            >
              <Sparkles size={15} />
              OK
            </button>
          </div>
        </>
      )}
    </Overlay>
  );
};
