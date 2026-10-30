import React from 'react';
import { cn } from './cn';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
export type ButtonSize = 'sm' | 'md';

const BASE =
  'inline-flex items-center justify-center font-sans font-semibold rounded-sm border border-transparent ' +
  'cursor-pointer no-underline whitespace-nowrap transition-all duration-150 ease-in-out ' +
  'disabled:cursor-not-allowed disabled:opacity-60';

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-linear-135 from-gold-bright to-gold text-canvas font-bold shadow-gold-sm ' +
    'enabled:hover:brightness-110 enabled:hover:shadow-gold-hover enabled:hover:-translate-y-px',
  secondary: 'bg-elevated border-line text-fg enabled:hover:bg-highlight enabled:hover:border-fg-secondary',
  danger: 'bg-red-soft border-red text-red-300 enabled:hover:bg-red enabled:hover:text-white',
  ghost: 'bg-transparent text-fg-secondary enabled:hover:bg-white/5 enabled:hover:text-fg',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'gap-1.5 px-3 py-1.5 text-xs',
  md: 'gap-2 px-4 py-2 text-sm',
};

/** Class string for elements that must look like a button but aren't <button> (e.g. router <Link>). */
export function buttonClasses(opts: { variant?: ButtonVariant; size?: ButtonSize; className?: string } = {}): string {
  const { variant = 'secondary', size = 'md', className } = opts;
  return cn(BASE, VARIANTS[variant], SIZES[size], className);
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'secondary', size = 'md', className, type = 'button', ...props }, ref) => (
    <button ref={ref} type={type} className={buttonClasses({ variant, size, className })} {...props} />
  )
);
Button.displayName = 'Button';
