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
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', verticalAlign: 'middle' }}
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
        style={{
          background: 'transparent',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          color: 'var(--color-gold-bright, #fbbf24)',
        }}
        data-testid="points-info-icon"
      >
        <Info size={size} />
      </button>

      {(isPinned || isHovered) && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: '0.35rem',
            background: 'var(--color-bg-surface-elevated, #161e27)',
            border: '1px solid rgba(245, 158, 11, 0.4)',
            borderRadius: '8px',
            padding: '0.75rem 1rem',
            boxShadow: '0 10px 25px rgba(0,0,0,0.6)',
            zIndex: 100,
            minWidth: '220px',
            textTransform: 'none',
            letterSpacing: 'normal',
          }}
          data-testid="points-breakdown-tooltip"
        >
          <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--color-gold-bright, #fbbf24)', marginBottom: '0.4rem', textTransform: 'uppercase' }}>
            Points Breakdown
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            {thresholds.map((pt, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#e2e8f0', fontFamily: "'JetBrains Mono', monospace" }}>
                <span>&ge; {pt.minScore.toLocaleString()}</span>
                <span style={{ fontWeight: 700, color: 'var(--color-gold-bright, #fbbf24)' }}>{pt.points} pts</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </span>
  );
};
