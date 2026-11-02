import React, { useState, useId } from 'react';
import { Tournament } from '../types';
import { useTournament } from '../store';
import { Lock, ShieldAlert, CheckCircle2, X } from 'lucide-react';
import { Overlay } from '../../../components/overlay';
import { Button, IconButton } from '../../../components/ui';

interface VerifyBracketModalProps {
  isOpen: boolean;
  onClose: () => void;
  tournament: Tournament;
}

export const VerifyBracketModal: React.FC<VerifyBracketModalProps> = ({
  isOpen,
  onClose,
  tournament,
}) => {
  const { lockTournament } = useTournament();
  const [step, setStep] = useState<1 | 2>(1);

  const [isLocking, setIsLocking] = useState(false);
  const titleId = useId();

  if (!isOpen) return null;

  const totalPlayers = tournament.tiers.reduce((acc, t) => acc + t.playerCount, 0);
  const pending = (tournament.qualRuns || []).filter(r => r.status === 'SUBMITTED').length;
  const unfinished = (tournament.qualRuns || []).filter(r => r.status === 'IN_PROGRESS').length;

  const handleConfirm = async () => {
    setIsLocking(true);
    try {
      await lockTournament(tournament.id);
      onClose();
    } finally {
      setIsLocking(false);
    }
  };

  return (
    <Overlay
      open
      onClose={onClose}
      busy={isLocking}
      aria-labelledby={titleId}
      panelClassName="max-w-130 overflow-hidden rounded-lg border border-gold bg-surface shadow-lg"
    >
      {({ requestClose }) => (
        <>
          {/* Header */}
          <div className="flex items-center justify-between border-b border-line bg-elevated py-5 px-6">
            <div className="flex items-center gap-2.5">
              <div className="flex size-8 items-center justify-center rounded-md bg-gold-soft text-gold-bright">
                <Lock size={18} />
              </div>
              <div>
                <h3 id={titleId} className="text-lg font-bold text-fg">
                  Lock Brackets &amp; Begin Match Play
                </h3>
                <p className="text-xs text-fg-muted">
                  Double-confirmation seed freeze
                </p>
              </div>
            </div>
            <IconButton aria-label="Close" onClick={requestClose}>
              <X size={18} />
            </IconButton>
          </div>

          {/* Content */}
          <div className="flex flex-col gap-5 p-6">
            {step === 1 ? (
              <>
                <div className="flex flex-col gap-2 rounded-md border border-gold/30 bg-gold/10 p-4">
                  <div className="flex items-center gap-1.5 text-sm font-bold text-gold-bright">
                    <ShieldAlert size={16} />
                    Freeze Seeding &amp; Initialize Match Play Mode
                  </div>
                  <p className="text-sm leading-snug text-fg">
                    Locking brackets will freeze current qualifier standings into static match entities across all <strong>{tournament.tiers.length} tiers</strong> ({totalPlayers} competitors).
                  </p>
                  <p className="text-caption leading-snug text-fg-secondary">
                    Subsequent qualifier score edits will be recorded in the qualifiers table, but will <strong>not</strong> re-seed or mutate the locked match pairings.
                  </p>
                </div>

                {(pending > 0 || unfinished > 0) && (
                  <div className="flex flex-col gap-1.5 rounded-md border border-red/40 bg-red/12 p-4 text-sm text-red-300" data-testid="lock-pending-warning">
                    <div className="flex items-center gap-1.5 font-bold"><ShieldAlert size={16} /> Quals still open</div>
                    {pending > 0 && <p>{pending} qual{pending === 1 ? ' is' : 's are'} still pending review and will be seeded as they stand.</p>}
                    {unfinished > 0 && <p>{unfinished} online run{unfinished === 1 ? ' is' : 's are'} still in progress and will not be seeded.</p>}
                  </div>
                )}

                {/* Tiers Summary */}
                <div className="flex flex-col gap-2">
                  <span className="text-caption font-semibold uppercase text-fg-secondary">
                    Tiers to lock:
                  </span>
                  {tournament.tiers.map(t => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between rounded-sm bg-highlight py-2 px-3 text-sm"
                    >
                      <span className="font-semibold text-fg">{t.name}</span>
                      <span className="text-fg-muted">
                        {t.playerCount} players • {t.bracketType} (Bo{t.bestOf})
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center gap-3 rounded-md border border-gold bg-elevated p-5 text-center">
                <div className="flex size-12 items-center justify-center rounded-full bg-gold-soft text-gold-bright">
                  <Lock size={24} />
                </div>
                <h4 className="text-lg font-bold text-white">
                  Final Match Play Confirmation
                </h4>
                <p className="max-w-95 text-sm text-fg-secondary">
                  Are you ready to officially begin match play? Floor judges and score submission drawers will become active immediately.
                </p>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex justify-end gap-3 border-t border-line bg-elevated py-4 px-6">
            <Button onClick={requestClose} className="py-2 px-4">
              Cancel
            </Button>
            {step === 1 ? (
              <Button variant="primary" onClick={() => setStep(2)} className="py-2 px-5">
                Proceed to Lock
              </Button>
            ) : (
              <Button
                variant="primary"
                onClick={handleConfirm}
                disabled={isLocking}
                className="gap-2 py-2 px-5"
              >
                {isLocking ? (
                  <div className="size-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                ) : (
                  <CheckCircle2 size={16} />
                )}
                <span>{isLocking ? 'Locking Seeds...' : 'Yes, Lock Seeds & Begin Matches'}</span>
              </Button>
            )}
          </div>
        </>
      )}
    </Overlay>
  );
};
