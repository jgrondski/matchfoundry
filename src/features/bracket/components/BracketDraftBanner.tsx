import React, { useState } from 'react';
import { Tournament } from '../../tournament/types';
import { useTournament } from '../../tournament/store';
import { AlertTriangle, Lock, Unlock, ShieldCheck } from 'lucide-react';
import { VerifyBracketModal } from '../../tournament/components/VerifyBracketModal';
import { Button } from '../../../components/ui';

interface BracketDraftBannerProps {
  tournament: Tournament;
  canManage?: boolean;
}

export const BracketDraftBanner: React.FC<BracketDraftBannerProps> = ({
  tournament,
  canManage = true,
}) => {
  const { unlockBrackets } = useTournament();
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);

  const isDraft = !tournament.isLocked;

  const handleUnlockClick = async () => {
    const res = await unlockBrackets(tournament.id);
    if (!res.success && res.error) {
      setUnlockError(res.error);
    } else {
      setUnlockError(null);
    }
  };

  return (
    <>
      {isDraft ? (
        <div className="flex flex-wrap items-center justify-between gap-4 border-b-2 border-gold bg-linear-90 from-gold/18 to-[rgba(217,119,6,0.28)] py-3 px-6 shadow-[0_2px_10px_rgba(245,158,11,0.2)]">
          <div className="flex min-w-70 items-center gap-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gold/25 text-gold-bright">
              <AlertTriangle size={18} />
            </div>
            <div>
              <div className="text-sm font-bold tracking-wide text-gold-bright">
                QUALIFIERS MODE — Seeding preview active
              </div>
              <div className="text-caption text-fg">
                Bracket seeds update dynamically with incoming qualifier scores. Match scoring is disabled. Click &quot;Lock Brackets &amp; Begin Match Play&quot; to start matches.
              </div>
            </div>
          </div>

          {canManage && (
            <Button variant="primary" onClick={() => setIsVerifyModalOpen(true)}>
              <Lock size={15} />
              Lock Brackets &amp; Begin Match Play
            </Button>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-between gap-4 border-b border-green/30 bg-green/10 py-1.5 px-6 text-caption">
          <div className="flex items-center gap-2 text-green-bright">
            <ShieldCheck size={16} />
            <span className="font-semibold">MATCH PLAY MODE</span>
            <span className="text-fg-muted">• Match play and score entry active</span>
          </div>

          {canManage && (
            <div className="flex items-center gap-3">
              {unlockError && (
                <span className="text-xs font-semibold text-red">
                  {unlockError}
                </span>
              )}
              <Button
                variant="secondary"
                onClick={handleUnlockClick}
                className="py-1 px-2.5 text-xs"
                title="Revert tournament to Qualifiers Mode"
              >
                <Unlock size={13} />
                Unlock Brackets
              </Button>
            </div>
          )}
        </div>
      )}

      {isVerifyModalOpen && (
        <VerifyBracketModal
          isOpen={isVerifyModalOpen}
          onClose={() => setIsVerifyModalOpen(false)}
          tournament={tournament}
        />
      )}
    </>
  );
};
