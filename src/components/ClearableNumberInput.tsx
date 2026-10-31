import React, { useState, useEffect, useRef } from 'react';

export interface ClearableNumberInputProps {
  id?: string;
  value?: number;
  onChange: (val: number | undefined) => void;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  style?: React.CSSProperties;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  autoFocus?: boolean;
  error?: string | null;
  onErrorChange?: (error: string | null) => void;
}

export const ClearableNumberInput: React.FC<ClearableNumberInputProps> = ({
  id,
  value,
  onChange,
  min,
  max,
  step = 1,
  placeholder,
  style,
  className,
  disabled,
  required,
  autoFocus,
  error: externalError,
  onErrorChange,
}) => {
  const [internalText, setInternalText] = useState<string>(
    value !== undefined && !isNaN(value) ? String(value) : ''
  );
  const [internalError, setInternalError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isFocusedRef = useRef(false);

  // Sync external value when not focused
  useEffect(() => {
    if (!isFocusedRef.current) {
      setInternalText(value !== undefined && !isNaN(value) ? String(value) : '');
    }
  }, [value]);

  const activeError = externalError !== undefined ? externalError : internalError;

  const updateError = (err: string | null) => {
    setInternalError(err);
    if (onErrorChange) {
      onErrorChange(err);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setInternalText(raw);

    // If there was an error, clear it as the user types
    if (activeError) {
      updateError(null);
    }

    // If completely empty, notify parent of undefined
    if (raw.trim() === '') {
      onChange(undefined);
      return;
    }

    const num = Number(raw);
    if (!isNaN(num)) {
      onChange(num);
    }
  };

  const handleFocus = () => {
    isFocusedRef.current = true;
  };

  const handleBlur = () => {
    isFocusedRef.current = false;
    const trimmed = internalText.trim();

    // Allow empty: per requirements, still allow the input to be empty
    if (trimmed === '') {
      updateError(null);
      onChange(undefined);
      return;
    }

    const num = Number(trimmed);

    // Validate if invalid number entered
    if (isNaN(num)) {
      updateError('Please enter a valid number');
      setTimeout(() => inputRef.current?.focus(), 10);
      return;
    }

    if (min !== undefined && num < min) {
      updateError(max !== undefined ? `Must be between ${min} and ${max}` : `Must be at least ${min}`);
      setTimeout(() => inputRef.current?.focus(), 10);
      return;
    }

    if (max !== undefined && num > max) {
      updateError(min !== undefined ? `Must be between ${min} and ${max}` : `Must be at most ${max}`);
      setTimeout(() => inputRef.current?.focus(), 10);
      return;
    }

    // Valid number
    updateError(null);
    onChange(num);
  };

  return (
    <div className="flex w-full flex-col" style={{ width: style?.width || undefined }}>
      <input
        ref={inputRef}
        id={id}
        type="number"
        min={min}
        max={max}
        step={step}
        placeholder={placeholder}
        value={internalText}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        disabled={disabled}
        required={required}
        autoFocus={autoFocus}
        className={className}
        style={{
          ...style,
          borderColor: activeError ? 'var(--color-red)' : style?.borderColor,
        }}
      />
      {activeError && (
        <div role="alert" className="mt-1.5 text-xs font-medium text-red">
          {activeError}
        </div>
      )}
    </div>
  );
};
