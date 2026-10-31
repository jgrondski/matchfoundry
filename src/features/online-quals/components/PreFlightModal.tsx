import React, { useState, useId } from 'react';
import { CheckSquare, Square, X, ShieldCheck } from 'lucide-react';
import type { PointsThreshold } from '../../tournament/types';
import { qualFormatLabel } from '../../qualifiers/qualFormatLabel';
import { PointsInfoTip } from '../../qualifiers/components/PointsInfoTip';
import { Overlay } from '../../../components/overlay';
import { IconButton, cn } from '../../../components/ui';

const checkItemClass = (checked: boolean) =>
  cn(
    'flex cursor-pointer items-start gap-3 rounded-md border p-3.5',
    checked ? 'border-green-500/40 bg-green-500/8' : 'border-line bg-white/3'
  );

export interface PreFlightModalProps {
  isOpen: boolean;
  tournamentName: string;
  qualWindowMinutes: number;
  qualFormat: string;
  qualAverageCount?: number;
  pointsConfig?: PointsThreshold[];
  twitchUsername: string;
  onConfirm: () => void;
  onCancel: () => void;
  isStarting?: boolean;
}

export const PreFlightModal: React.FC<PreFlightModalProps> = ({
  isOpen,
  tournamentName,
  qualWindowMinutes,
  qualFormat,
  qualAverageCount = 2,
  pointsConfig,
  twitchUsername,
  onConfirm,
  onCancel,
  isStarting = false,
}) => {
  const [checkLive, setCheckLive] = useState(false);
  const [checkVodStorage, setCheckVodStorage] = useState(false);
  const [checkAuthwordRule, setCheckAuthwordRule] = useState(false);
  const [checkTimeLimit, setCheckTimeLimit] = useState(false);
  const [checkStreamTimer, setCheckStreamTimer] = useState(false);
  const titleId = useId();

  if (!isOpen) return null;

  const allChecked = checkLive && checkVodStorage && checkStreamTimer && checkAuthwordRule && checkTimeLimit;

  return (
    <Overlay
      open
      onClose={onCancel}
      dirty={checkLive || checkVodStorage || checkAuthwordRule || checkTimeLimit || checkStreamTimer}
      busy={isStarting}
      aria-labelledby={titleId}
      panelTestId="pre-flight-modal"
      panelClassName="flex max-w-145 flex-col overflow-hidden rounded-lg border border-line bg-surface shadow-[0_20px_40px_rgba(0,0,0,0.6)]"
    >
      {({ requestClose }) => (
        <>
          {/* Header */}
          <div className="flex items-center justify-between border-b border-line bg-elevated px-6 py-5">
            <div className="flex items-center gap-2.5">
              <ShieldCheck size={22} color="var(--color-gold-bright, #fbbf24)" />
              <h3 id={titleId} className="m-0 text-lg font-extrabold text-white">
                Qualifier Checklist
              </h3>
            </div>
            <IconButton
              onClick={requestClose}
              disabled={isStarting}
              aria-label="Close"
              className="text-fg-secondary"
              title="Close"
            >
              <X size={20} />
            </IconButton>
          </div>

          {/* Body */}
          <div className="max-h-[70vh] overflow-y-auto p-6">
            {/* Rules Summary Box */}
            <div className="mb-6 rounded-md border border-gold/30 bg-gold/8 p-4">
              <div className="mb-1 font-bold text-gold-bright">
                {tournamentName}
              </div>
              <div className="text-sm leading-normal text-fg-secondary">
                <strong>Window:</strong> {qualWindowMinutes} minutes &bull; <strong>Format:</strong> {qualFormatLabel(qualFormat, qualAverageCount)}
                {qualFormat === 'POINTS' && (
                  <>
                    {' '}
                    <PointsInfoTip pointsConfig={pointsConfig} />
                  </>
                )}
              </div>
            </div>

            <p className="mb-4 text-sm font-semibold text-slate-200">
              Before launching your official run, please verify every requirement:
            </p>

            {/* Checklist Items */}
            <div className="flex flex-col gap-3.5">
              {/* Item 1: Stream Live */}
              <label
                onClick={() => setCheckLive(!checkLive)}
                className={checkItemClass(checkLive)}
              >
                <div className={cn('cursor-pointer', checkLive ? 'text-green-500' : 'text-fg-muted')}>
                  {checkLive ? <CheckSquare size={20} /> : <Square size={20} />}
                </div>
                <div className="text-sm text-fg">
                  <div>
                    My Twitch stream is currently <strong>LIVE</strong> at{' '}
                    <span className="text-purple-500">twitch.tv/{twitchUsername}</span>.
                  </div>
                </div>
              </label>

              {/* Item 2: Store past broadcasts */}
              <label
                onClick={() => setCheckVodStorage(!checkVodStorage)}
                className={checkItemClass(checkVodStorage)}
              >
                <div className={cn('cursor-pointer', checkVodStorage ? 'text-green-500' : 'text-fg-muted')}>
                  {checkVodStorage ? <CheckSquare size={20} /> : <Square size={20} />}
                </div>
                <div className="text-sm text-fg">
                  <div>
                    <strong>Store past broadcasts</strong> is toggled <strong>ON</strong> in Creator Dashboard.
                  </div>
                </div>
              </label>

              {/* Item 3: On-stream countdown timer (the portal does not display one) */}
              <label
                onClick={() => setCheckStreamTimer(!checkStreamTimer)}
                className={checkItemClass(checkStreamTimer)}
              >
                <div className={cn('cursor-pointer', checkStreamTimer ? 'text-green-500' : 'text-fg-muted')}>
                  {checkStreamTimer ? <CheckSquare size={20} /> : <Square size={20} />}
                </div>
                <div className="text-sm text-fg">
                  <div>
                    A visible <strong>{qualWindowMinutes}-minute countdown timer</strong> is on my Twitch scene.
                  </div>
                </div>
              </label>

              {/* Item 4: Authword rule */}
              <label
                onClick={() => setCheckAuthwordRule(!checkAuthwordRule)}
                className={checkItemClass(checkAuthwordRule)}
              >
                <div className={cn('cursor-pointer', checkAuthwordRule ? 'text-green-500' : 'text-fg-muted')}>
                  {checkAuthwordRule ? <CheckSquare size={20} /> : <Square size={20} />}
                </div>
                <div className="text-sm text-fg">
                  <div>
                    I understand the <strong>NES Authword proof rule</strong>.
                  </div>
                  <div className="mt-1 text-caption text-fg-secondary">
                    Before starting the timer, play a game to 10k, top out, and enter authword in the high score post-game.
                  </div>
                </div>
              </label>

              {/* Item 5: Time window */}
              <label
                onClick={() => setCheckTimeLimit(!checkTimeLimit)}
                className={checkItemClass(checkTimeLimit)}
              >
                <div className={cn('cursor-pointer', checkTimeLimit ? 'text-green-500' : 'text-fg-muted')}>
                  {checkTimeLimit ? <CheckSquare size={20} /> : <Square size={20} />}
                </div>
                <div className="text-sm text-fg">
                  <div>
                    I understand the <strong>{qualWindowMinutes}-minute window</strong>.
                  </div>
                  <div className="mt-1 text-caption text-fg-secondary">
                    After authword, start the timer and begin playing. Any game in progress at the end of the timer will count.
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 border-t border-line bg-elevated px-6 py-5">
            <button
              onClick={requestClose}
              disabled={isStarting}
              className={cn(
                'rounded-md border border-line bg-transparent px-5 py-2.5 font-semibold text-fg-secondary',
                isStarting ? 'cursor-not-allowed' : 'cursor-pointer'
              )}
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={!allChecked || isStarting}
              className={cn(
                'flex items-center gap-2 rounded-md border-0 px-6 py-2.5 font-extrabold',
                allChecked ? 'bg-gold-bright text-black' : 'bg-slate-700 text-fg-secondary',
                allChecked && !isStarting ? 'cursor-pointer' : 'cursor-not-allowed'
              )}
              data-testid="confirm-begin-button"
            >
              {isStarting ? 'Launching Run...' : 'Confirm & Begin Qual'}
            </button>
          </div>
        </>
      )}
    </Overlay>
  );
};
