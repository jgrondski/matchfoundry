import React from 'react';
import { ShieldCheck } from 'lucide-react';

export interface AuthwordHudCardProps {
  // Elapsed time is recorded server-side for judges but intentionally not shown here: competitors run
  // their own on-stream timer, and two clocks confuse.
  authWord: string | null;
}

export const AuthwordHudCard: React.FC<AuthwordHudCardProps> = ({ authWord }) => {
  return (
    <div
      className="flex flex-col gap-4 rounded-md border border-gold/40 bg-surface p-6 shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
      data-testid="authword-hud-card"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck size={20} color="var(--color-gold-bright, #fbbf24)" />
          <span className="text-sm font-extrabold uppercase tracking-wider text-slate-200">
            Official Authword
          </span>
        </div>
      </div>

      {/* Authword Presentation Block */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-md border-2 border-gold-bright bg-canvas p-5">
        <div>
          <div className="mb-1 text-caption uppercase tracking-wider text-fg-secondary">
            NES Verification Code
          </div>
          <div
            className="font-mono text-4xl font-black tracking-widest text-gold-bright [text-shadow:0_0_16px_rgba(245,158,11,0.4)]"
            data-testid="assigned-authword"
          >
            {authWord}
          </div>
        </div>

      </div>

      {/* Rule Notice */}
      <div className="rounded-md border-l-3 border-gold-bright bg-white/2 px-4 py-3 text-sm leading-normal text-fg-secondary">
        <strong className="text-white">NES Authword Proof Rule:</strong> Play to &ge; 10,000 points, intentionally top out,
        and enter this exact word (<span className="font-bold text-gold-bright">{authWord}</span>)
        on the high-score name screen on stream.
      </div>
    </div>
  );
};
