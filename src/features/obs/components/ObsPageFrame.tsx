import React, { useEffect } from 'react';
import { resolveChromaColor } from '../chroma';
import { cn } from '../../../components/ui';

interface ObsPageFrameProps {
  /** The `?chroma=` value: a preset name or hex color, or null for a transparent background. */
  chroma?: string | null;
  children: React.ReactNode;
}

/**
 * Full-screen frame for the page-style OBS overlays (leaderboard, standings, seeding).
 *
 * With a chroma key, the key color fills the screen and the content sits on one solid panel.
 * The tables inside use translucent fills, shadows and borders; on the panel those blend into
 * solid colors, so nothing over the key is see-through and nothing gets keyed out with it.
 * Without a chroma key the background stays transparent and OBS composites real alpha.
 */
export const ObsPageFrame: React.FC<ObsPageFrameProps> = ({ chroma = null, children }) => {
  useEffect(() => {
    document.body.classList.add('obs-overlay-mode');
    return () => document.body.classList.remove('obs-overlay-mode');
  }, []);

  const chromaColor = resolveChromaColor(chroma);

  return (
    <div
      data-testid="obs-page-frame"
      className="min-h-screen w-full px-6 py-8"
      style={{ background: chromaColor ?? 'transparent' }}
    >
      <div
        data-testid={chromaColor ? 'obs-solid-panel' : undefined}
        className={cn('mx-auto w-full max-w-300', chromaColor && 'rounded-lg bg-canvas p-2')}
      >
        {children}
      </div>
    </div>
  );
};
