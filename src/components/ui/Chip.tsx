import React from 'react';
import { cn } from './cn';

export interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  /** Runtime accent (e.g. a tier color). textColor must contrast with color. */
  accent?: { color: string; textColor: string };
  size?: 'sm' | 'md';
}

/** Pill-shaped toggle: tier selectors, view toggles, filter pills, nav pills. */
export const Chip = React.forwardRef<HTMLButtonElement, ChipProps>(
  ({ active = false, accent, size = 'md', className, style, type = 'button', ...props }, ref) => {
    const accentStyle = accent
      ? ({ '--chip-accent': accent.color, '--chip-accent-fg': accent.textColor } as React.CSSProperties)
      : undefined;
    return (
      <button
        ref={ref}
        type={type}
        aria-pressed={active}
        style={accentStyle ? { ...accentStyle, ...style } : style}
        className={cn(
          'inline-flex items-center gap-2 rounded-full border font-semibold transition-all duration-150',
          size === 'md' ? 'px-3.5 py-1.5 text-caption' : 'px-2.5 py-1 text-xs',
          active ? 'cursor-default font-extrabold' : 'cursor-pointer bg-canvas text-fg-secondary border-line',
          active && !accent && 'bg-gold-soft text-gold-bright border-gold shadow-gold-glow',
          active &&
            accent &&
            'bg-(--chip-accent) text-(--chip-accent-fg) border-(--chip-accent) shadow-[0_0_10px_color-mix(in_srgb,var(--chip-accent)_25%,transparent)]',
          className
        )}
        {...props}
      />
    );
  }
);
Chip.displayName = 'Chip';
