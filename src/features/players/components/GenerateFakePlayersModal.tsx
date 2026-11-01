import React, { useState, useId } from 'react';
import { Users, X, Sparkles } from 'lucide-react';
import { ClearableNumberInput } from '../../../components/ClearableNumberInput';
import { Overlay } from '../../../components/overlay';
import { Button, IconButton, cn } from '../../../components/ui';

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
          <div className="flex items-center justify-between border-b border-line bg-surface px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-full bg-gold/15 text-gold-bright">
                <Sparkles size={18} />
              </div>
              <div>
                <h3 id={titleId} className="m-0 text-lg font-bold text-fg">
                  Generate Fake Players
                </h3>
                <p className="m-0 text-xs text-fg-muted">
                  Append realistic competitors to the global player directory
                </p>
              </div>
            </div>
            <IconButton aria-label="Close" onClick={requestClose}>
              <X size={18} />
            </IconButton>
          </div>

          {/* Body */}
          <div className="flex flex-col gap-5 p-6">
            <div className="rounded-sm border border-line-subtle bg-canvas px-4 py-3.5 text-sm leading-normal text-fg-secondary">
              Generates players with randomized authentic competitor names, playstyles (<strong>Rolling</strong>, <strong>DAS</strong>, <strong>Hypertap</strong>), personal bests (700,000–1,350,000), and country codes.
              <div className="mt-1.5 text-xs text-fg-muted">
                Current global pool size: <strong>{existingCount}</strong> players.
              </div>
            </div>

            <div>
              <label
                htmlFor="fake-player-count-input"
                className="mb-2 block text-sm font-semibold text-fg"
              >
                Number of Players to Generate
              </label>
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <ClearableNumberInput
                    id="fake-player-count-input"
                    min={1}
                    max={200}
                    value={count}
                    onChange={setCount}
                    className="rounded-sm border border-line bg-canvas px-3.5 py-2.5 text-lg font-bold text-fg"
                  />
                </div>
                <div className="mt-2.5 flex items-center gap-1.5">
                  <Users size={16} color="var(--color-fg-muted)" />
                  <span className="text-sm font-medium text-fg-muted">
                    competitors
                  </span>
                </div>
              </div>
              <div className="mt-1.5 text-xs text-fg-muted">
                Enter a number between 1 and 200
              </div>
            </div>

            {/* Presets */}
            <div>
              <div className="mb-2 text-xs font-semibold uppercase text-fg-muted">
                Quick Presets
              </div>
              <div className="flex flex-wrap gap-2">
                {[8, 16, 32, 64].map(preset => (
                  <Button
                    key={preset}
                    variant="secondary"
                    onClick={() => handlePreset(preset)}
                    className={cn(
                      'px-3.5 py-1.5 text-caption',
                      count === preset
                        ? 'border-gold bg-gold-soft font-bold text-gold-bright'
                        : 'font-medium'
                    )}
                  >
                    +{preset} Players
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 border-t border-line bg-surface px-6 py-4">
            <Button
              variant="secondary"
              onClick={requestClose}
              className="px-5 py-2 text-sm"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleConfirm}
              disabled={!count || count < 1 || count > 200}
              className="px-6 py-2 text-sm shadow-gold"
            >
              <Sparkles size={15} />
              OK
            </Button>
          </div>
        </>
      )}
    </Overlay>
  );
};
