import React, { useState } from 'react';
import { applyScoreKeystroke, formatScoreDigits } from '../../utils/scores';
import { cn } from './cn';

export interface ScoreInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'inputMode'> {
  /** The score as plain digits ("" when empty). */
  value: string;
  /** Receives plain digits ("" when cleared). Only called for accepted input. */
  onValueChange: (digits: string) => void;
  wrapperClassName?: string;
}

/**
 * Text input for a game score. Shows commas, accepts commas, and rejects
 * anything else that is not a whole number from 0 to 99,999,999 with a short
 * hint rather than silently changing what was typed.
 */
export const ScoreInput = React.forwardRef<HTMLInputElement, ScoreInputProps>(function ScoreInput(
  { value, onValueChange, wrapperClassName, className, ...rest },
  ref
) {
  const [rejection, setRejection] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = applyScoreKeystroke(value, e.target.value);
    setRejection(next.rejection);
    if (!next.rejection) onValueChange(next.digits);
  };

  return (
    <div className={cn('min-w-0', wrapperClassName)}>
      <input
        {...rest}
        ref={ref}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={formatScoreDigits(value)}
        onChange={handleChange}
        onBlur={e => {
          setRejection(null);
          rest.onBlur?.(e);
        }}
        aria-invalid={rejection ? true : undefined}
        className={className}
      />
      {rejection && (
        <p role="alert" data-testid="score-input-hint" className="mt-1 text-2xs font-semibold text-red-300">
          {rejection}
        </p>
      )}
    </div>
  );
});
