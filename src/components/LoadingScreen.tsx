import React from 'react';
import { cn } from './ui';

interface LoadingScreenProps {
  message?: string;
  subMessage?: string;
  fullScreen?: boolean;
  inline?: boolean;
  minHeight?: string;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({
  message = 'Loading tournament data...',
  subMessage,
  fullScreen = true,
  inline = false,
  minHeight,
}) => {
  const containerClass = inline
    ? 'flex min-h-60 flex-col items-center justify-center gap-3 px-6 py-12 text-fg-secondary'
    : cn(
        'flex w-full flex-col items-center justify-center bg-canvas p-8 text-fg-secondary select-none',
        fullScreen ? 'h-screen min-h-screen' : 'min-h-100'
      );

  return (
    <div
      className={containerClass}
      style={{ minHeight }}
      data-testid="loading-screen"
      role="status"
      aria-live="polite"
    >
      <div className="flex max-w-95 flex-col items-center gap-4 text-center">
        <div className="size-9 shrink-0 animate-spin rounded-full border-3 border-gold/18 border-t-gold-bright" />
        <div className="flex flex-col gap-1.5">
          <span className="text-base font-semibold tracking-tight text-fg">{message}</span>
          {subMessage && <span className="text-caption leading-snug text-fg-muted">{subMessage}</span>}
        </div>
      </div>
    </div>
  );
};
