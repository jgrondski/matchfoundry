import React, { useState } from 'react';
import { ArrowLeftRight } from 'lucide-react';
import { BracketMatch } from '../../types';
import { useTournament } from '../../../tournament/store';
import { cn } from '../../../../components/ui';

interface ManualSlotOverrideSectionProps {
  roundMatches: BracketMatch[];
  match: BracketMatch;
  roundName: string;
  p1Name: string;
  p2Name: string;
  tournamentId: string;
  tierId: string;
  onClose: () => void;
}

export const ManualSlotOverrideSection: React.FC<ManualSlotOverrideSectionProps> = ({
  roundMatches,
  match,
  roundName,
  p1Name,
  p2Name,
  tournamentId,
  tierId,
  onClose,
}) => {
  const { swapMatchSlots } = useTournament();

  const [showOverridePanel, setShowOverridePanel] = useState(false);
  const [sourceSlot, setSourceSlot] = useState<1 | 2>(1);
  const [targetMatchId, setTargetMatchId] = useState<string>('');
  const [targetSlot, setTargetSlot] = useState<1 | 2>(1);
  const [overrideError, setOverrideError] = useState<string | null>(null);
  const [overrideSuccess, setOverrideSuccess] = useState<string | null>(null);

  const handleApplyOverride = async () => {
    setOverrideError(null);
    setOverrideSuccess(null);
    const chosenTargetId = targetMatchId || roundMatches[0]?.id;
    if (!chosenTargetId) {
      setOverrideError('Please select a target match in this round.');
      return;
    }
    const res = await swapMatchSlots(tournamentId, tierId, {
      sourceMatchId: match.id,
      sourceSlot,
      targetMatchId: chosenTargetId,
      targetSlot,
    });
    if (res.success) {
      setOverrideSuccess('Match placement overridden successfully!');
      setTimeout(() => {
        onClose();
      }, 1000);
    } else {
      setOverrideError(res.error || 'Failed to override slot placement.');
    }
  };

  return (
    <div className="border-b border-line bg-white/2">
      <button
        type="button"
        onClick={() => {
          setShowOverridePanel(!showOverridePanel);
          if (!targetMatchId && roundMatches.length > 0) {
            setTargetMatchId(roundMatches[0].id);
          }
        }}
        className={cn(
          'w-full py-2 px-6 flex items-center justify-between border-0 text-caption font-semibold cursor-pointer transition-all duration-150',
          showOverridePanel ? 'bg-orange-600/8 text-orange-600' : 'bg-transparent text-fg-secondary'
        )}
      >
        <div className="flex items-center gap-2">
          <ArrowLeftRight size={14} className={showOverridePanel ? 'text-orange-600' : undefined} />
          <span>Override / Swap Round Placement</span>
        </div>
        <span className="text-2xs text-fg-muted">
          {showOverridePanel ? 'Hide Controls' : 'Adjust Slot'}
        </span>
      </button>

      {showOverridePanel && (
        <div className="pt-3.5 px-6 pb-5 border-t border-dashed border-line-subtle bg-black/25">
          <p className="mt-0 mx-0 mb-2.5 text-xs text-fg-muted">
            Manually move or swap an advancing player with another slot in <strong>{roundName}</strong>.
          </p>

          {overrideError && (
            <div className="py-1.5 px-2.5 mb-2.5 rounded-sm bg-red/15 text-red-300 border border-red/30 text-xs">
              {overrideError}
            </div>
          )}
          {overrideSuccess && (
            <div className="py-1.5 px-2.5 mb-2.5 rounded-sm bg-green-500/15 text-green-300 border border-green-500/30 text-xs">
              {overrideSuccess}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 mb-2.5">
            <div>
              <label className="block text-2xs font-semibold text-fg-muted mb-1">
                From (Match #{match.matchNumber})
              </label>
              <select
                value={sourceSlot}
                onChange={(e) => setSourceSlot(Number(e.target.value) as 1 | 2)}
                className="w-full py-1.5 px-2 text-caption bg-canvas border border-line text-white rounded-sm"
              >
                <option value={1}>Slot 1: {p1Name}</option>
                <option value={2}>Slot 2: {p2Name}</option>
              </select>
            </div>

            <div>
              <label className="block text-2xs font-semibold text-fg-muted mb-1">
                To Slot
              </label>
              <select
                value={targetSlot}
                onChange={(e) => setTargetSlot(Number(e.target.value) as 1 | 2)}
                className="w-full py-1.5 px-2 text-caption bg-canvas border border-line text-white rounded-sm"
              >
                <option value={1}>Target Slot 1</option>
                <option value={2}>Target Slot 2</option>
              </select>
            </div>
          </div>

          <div className="mb-3">
            <label className="block text-2xs font-semibold text-fg-muted mb-1">
              Target Match in {roundName}
            </label>
            <select
              value={targetMatchId || (roundMatches[0]?.id ?? '')}
              onChange={(e) => setTargetMatchId(e.target.value)}
              className="w-full py-1.5 px-2 text-caption bg-canvas border border-line text-white rounded-sm"
            >
              {roundMatches.map((m) => {
                const mP1 = m.player1.player?.name || (m.player1.sourceMatchId ? 'Feeder' : 'Empty');
                const mP2 = m.player2.player?.name || (m.player2.sourceMatchId ? 'Feeder' : 'Empty');
                return (
                  <option key={m.id} value={m.id}>
                    Match #{m.matchNumber}: {mP1} vs {mP2}
                  </option>
                );
              })}
            </select>
          </div>

          <button
            type="button"
            onClick={handleApplyOverride}
            className="w-full p-2 rounded-sm bg-orange-600 text-white border-0 font-bold text-caption cursor-pointer flex items-center justify-center gap-1.5"
          >
            <ArrowLeftRight size={14} />
            <span>Apply Placement Override</span>
          </button>
        </div>
      )}
    </div>
  );
};
