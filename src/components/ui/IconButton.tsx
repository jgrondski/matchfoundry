import React from 'react';
import { cn } from './cn';
import { Spinner } from './Spinner';
import { useGlobalBusy } from './busy';

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required: icon-only buttons need an accessible name. */
  'aria-label': string;
  /** Shows a spinner instead of the icon and disables the button. */
  loading?: boolean;
  /** Stay clickable while another action holds the global busy lock. */
  ignoreBusy?: boolean;
}

/** Icon-only button (close X, row actions). */
export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, type = 'button', loading = false, ignoreBusy = false, disabled, children, ...props }, ref) => {
    const { busy } = useGlobalBusy();
    const isDisabled = Boolean(disabled) || loading || (busy && !ignoreBusy);
    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        className={cn(
          'inline-flex items-center justify-center rounded-sm border-0 bg-transparent p-1 text-fg-muted cursor-pointer',
          'transition-colors duration-150 enabled:hover:bg-white/5 enabled:hover:text-fg disabled:cursor-not-allowed disabled:opacity-60',
          'max-md:min-h-11 max-md:min-w-11',
          className
        )}
        {...props}
      >
        {loading ? <Spinner size={16} /> : children}
      </button>
    );
  }
);
IconButton.displayName = 'IconButton';
