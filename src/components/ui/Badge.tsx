import React from 'react';
import { cn } from './cn';

export type BadgeVariant = 'gold' | 'green' | 'blue' | 'muted';

const VARIANTS: Record<BadgeVariant, string> = {
  gold: 'bg-gold-soft text-gold-bright border-gold/30',
  green: 'bg-green-soft text-emerald-400 border-green/30',
  blue: 'bg-cyan-soft text-sky-400 border-cyan/30',
  muted: 'bg-slate-400/10 text-fg-secondary border-slate-400/20',
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export const Badge: React.FC<BadgeProps> = ({ variant = 'muted', className, ...props }) => (
  <span
    className={cn(
      'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-wide',
      VARIANTS[variant],
      className
    )}
    {...props}
  />
);
