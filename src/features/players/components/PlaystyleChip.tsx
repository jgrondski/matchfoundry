import React from 'react';
import { cn } from '../../../components/ui';
import { Playstyle } from '../../tournament/types';
import { PLAYSTYLE_COLORS } from '../../../theme/palette';

interface PlaystyleChipProps {
  style?: string | Playstyle;
  size?: 'sm' | 'md';
  className?: string;
}

export function getPlaystyleTheme(style?: string | Playstyle) {
  const norm = (style || '').trim().toLowerCase();

  if (norm === 'roll' || norm === 'rolling') {
    return {
      label: 'Roll',
      ...PLAYSTYLE_COLORS.roll,
    };
  }

  if (norm === 'das') {
    return {
      label: 'DAS',
      ...PLAYSTYLE_COLORS.das,
    };
  }

  if (norm === 'hybrid') {
    return {
      label: 'Hybrid',
      ...PLAYSTYLE_COLORS.hybrid,
    };
  }

  if (norm === 'tap' || norm === 'hypertap') {
    return {
      label: 'Tap',
      ...PLAYSTYLE_COLORS.tap,
    };
  }

  // Fallback
  return {
    label: style || 'Unknown',
    ...PLAYSTYLE_COLORS.unknown,
  };
}

export const PlaystyleChip: React.FC<PlaystyleChipProps> = ({
  style,
  size = 'sm',
  className,
}) => {
  if (!style) return null;
  const theme = getPlaystyleTheme(style);

  const isSmall = size === 'sm';

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-sm border border-(--chip-border) bg-(--chip-bg) font-bold leading-tight tracking-wide whitespace-nowrap text-(--chip-fg) shadow-[0_1px_3px_rgba(0,0,0,0.2)] select-none',
        isSmall ? 'px-2 py-0.5 text-2xs' : 'px-2.5 py-1 text-caption',
        className
      )}
      style={
        {
          '--chip-fg': theme.color,
          '--chip-bg': theme.background,
          '--chip-border': theme.borderColor,
        } as React.CSSProperties
      }
      title={`Playstyle: ${theme.label}`}
    >
      {theme.label}
    </span>
  );
};
