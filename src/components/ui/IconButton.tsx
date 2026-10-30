import React from 'react';
import { cn } from './cn';

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required: icon-only buttons need an accessible name. */
  'aria-label': string;
}

/** Icon-only button (close X, row actions). */
export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex items-center justify-center rounded-sm border-0 bg-transparent p-1 text-fg-muted cursor-pointer',
        'transition-colors duration-150 enabled:hover:bg-white/5 enabled:hover:text-fg disabled:cursor-not-allowed disabled:opacity-60',
        className
      )}
      {...props}
    />
  )
);
IconButton.displayName = 'IconButton';
