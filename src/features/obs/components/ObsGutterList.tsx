import React, { useEffect } from 'react';
import type { GutterRow } from '../gutterRows';
import { resolveChromaColor } from '../chroma';
import { THEME_FALLBACK } from '../../../theme/palette';

interface ObsGutterListProps {
  title: string;
  rows: GutterRow[];
  /** Shown when there are no rows yet. */
  emptyText: string;
  chroma?: string | null;
}

/**
 * A narrow OBS column (the gutter beside match play): one row per competitor with rank,
 * name and one large number. Every surface is a solid color, so it keys cleanly on any
 * chroma background and also works with a transparent background.
 */
export const ObsGutterList: React.FC<ObsGutterListProps> = ({ title, rows, emptyText, chroma = null }) => {
  useEffect(() => {
    document.body.classList.add('obs-overlay-mode');
    return () => document.body.classList.remove('obs-overlay-mode');
  }, []);

  const background = resolveChromaColor(chroma) ?? 'transparent';
  const cardBg = THEME_FALLBACK.obsCardColor;

  return (
    <div
      data-testid="obs-gutter"
      className="fixed inset-0 flex h-screen w-screen flex-col gap-1.5 overflow-hidden p-2"
      style={{ background }}
    >
      <div
        className="rounded-sm px-3 py-1.5 text-lg font-black uppercase tracking-wider text-gold-bright"
        style={{ background: cardBg }}
      >
        {title}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-sm px-3 py-2 text-lg font-bold text-fg-secondary" style={{ background: cardBg }}>
          {emptyText}
        </div>
      ) : (
        rows.map(row => (
          <div
            key={row.key}
            data-testid="obs-gutter-row"
            className="flex min-w-0 items-center gap-2.5 rounded-sm border-l-4 px-2.5 py-1.5"
            style={{ background: cardBg, borderLeftColor: row.accentColor || cardBg }}
          >
            <span className="w-8 shrink-0 text-right font-mono text-xl font-black tabular-nums text-fg-secondary">
              {row.rank}
            </span>
            <span className="min-w-0 flex-1 truncate text-2xl font-extrabold leading-tight text-white">
              {row.name}
            </span>
            {row.badge && (
              <span className="shrink-0 rounded-sm bg-gold px-1.5 py-0.5 font-mono text-base font-black text-canvas">
                {row.badge}
              </span>
            )}
            {row.value && (
              <span className="shrink-0 font-mono text-2xl font-black tabular-nums text-gold-bright">
                {row.value}
              </span>
            )}
          </div>
        ))
      )}
    </div>
  );
};
