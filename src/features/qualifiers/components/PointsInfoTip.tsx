import React, { useEffect, useRef, useState } from 'react';
import { Info } from 'lucide-react';
import type { PointsThreshold } from '../../tournament/types';
import { DEFAULT_POINTS_THRESHOLDS } from '../../tournament/types';

interface PointsInfoTipProps {
  pointsConfig?: PointsThreshold[] | null;
  size?: number;
}

/**
 * "i" icon that reveals the points threshold breakdown.
 * Opens on hover (desktop) and toggles on click/tap (mobile); an outside click closes it.
 */
export const PointsInfoTip: React.FC<PointsInfoTipProps> = ({ pointsConfig, size = 14 }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!isPinned) return;
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsPinned(false);
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [isPinned]);

  const thresholds = [...(pointsConfig && pointsConfig.length > 0 ? pointsConfig : DEFAULT_POINTS_THRESHOLDS)]
    .sort((a, b) => b.minScore - a.minScore);

  return (
    <span
      ref={containerRef}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="relative inline-flex items-center align-middle"
    >
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsPinned(prev => !prev);
        }}
        aria-label="View points breakdown"
        aria-expanded={isPinned || isHovered}
        className="bg-transparent border-0 p-0 cursor-pointer inline-flex items-center text-gold-bright"
        data-testid="points-info-icon"
      >
        <Info size={size} />
      </button>

      {(isPinned || isHovered) && (
        <div
          className="absolute top-full left-0 mt-1.5 bg-elevated border border-gold/40 rounded-md py-3 px-4 shadow-[0_10px_25px_rgba(0,0,0,0.6)] z-100 min-w-55 normal-case tracking-normal"
          data-testid="points-breakdown-tooltip"
        >
          <div className="text-xs font-extrabold text-gold-bright mb-1.5 uppercase">
            Points Breakdown
          </div>
          <div className="flex flex-col gap-1">
            {thresholds.map((pt, idx) => (
              <div key={idx} className="flex justify-between text-caption text-slate-200 font-mono">
                <span>&ge; {pt.minScore.toLocaleString()}</span>
                <span className="font-bold text-gold-bright">{pt.points} pts</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </span>
  );
};
