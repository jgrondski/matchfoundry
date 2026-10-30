import React from 'react';
import { cn } from './cn';

const PADDING = { none: 'p-0', sm: 'p-3', md: 'p-4', lg: 'p-6' } as const;
const TONE = { surface: 'bg-surface', elevated: 'bg-elevated' } as const;

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  padding?: keyof typeof PADDING;
  tone?: keyof typeof TONE;
}

export const Card: React.FC<CardProps> = ({ padding = 'md', tone = 'surface', className, ...props }) => (
  <div className={cn('rounded-md border border-line', TONE[tone], PADDING[padding], className)} {...props} />
);
