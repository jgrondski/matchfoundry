import React from 'react';
import { cn } from '../../../components/ui';
import { Playstyle } from '../../tournament/types';

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
      color: '#ffffff',
      background: '#a855f7',
      borderColor: '#c084fc',
    };
  }

  if (norm === 'das') {
    return {
      label: 'DAS',
      color: '#fde047',
      background: '#dc2626',
      borderColor: '#ef4444',
    };
  }

  if (norm === 'hybrid') {
    return {
      label: 'Hybrid',
      color: '#e9d5ff',
      background: '#4c1d95',
      borderColor: '#6b21a8',
    };
  }

  if (norm === 'tap' || norm === 'hypertap') {
    return {
      label: 'Tap',
      color: '#bae6fd',
      background: '#0c4a6e',
      borderColor: '#0284c7',
    };
  }

  // Fallback
  return {
    label: style || 'Unknown',
    color: '#e2e8f0',
    background: 'rgba(255, 255, 255, 0.1)',
    borderColor: 'rgba(255, 255, 255, 0.2)',
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
