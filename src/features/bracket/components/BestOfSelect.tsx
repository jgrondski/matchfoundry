import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Check, Search } from 'lucide-react';
import { cn } from '../../../components/ui';

export interface BestOfSelectProps {
  value: number;
  onChange: (value: number) => void;
  id?: string;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  compact?: boolean;
  className?: string;
}

// All odd integers from 1 to 99
const ALL_ODD_BEST_OF: number[] = Array.from({ length: 50 }, (_, i) => i * 2 + 1);

// Quick presets for frequent tournament formats
const QUICK_PRESETS = [1, 3, 5, 7, 9, 11, 15, 21, 99];

export const BestOfSelect: React.FC<BestOfSelectProps> = ({
  value,
  onChange,
  id,
  label,
  disabled = false,
  compact = false,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setQuery('');
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Filter options based on search query
  const filteredOptions = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase().replace(/^bo\s*/, '');
    if (!cleanQuery) return ALL_ODD_BEST_OF;

    const queryNum = parseInt(cleanQuery, 10);
    return ALL_ODD_BEST_OF.filter(bo => {
      if (String(bo).includes(cleanQuery)) return true;
      if (!isNaN(queryNum) && bo === queryNum) return true;
      return false;
    });
  }, [query]);

  const handleSelect = (bo: number) => {
    onChange(bo);
    setIsOpen(false);
    setQuery('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      setQuery('');
      e.stopPropagation();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const cleanQuery = query.trim().toLowerCase().replace(/^bo\s*/, '');
      const parsed = parseInt(cleanQuery, 10);

      if (!isNaN(parsed) && parsed >= 1 && parsed <= 99) {
        // Enforce odd number
        const oddVal = parsed % 2 === 0 ? Math.min(99, parsed + 1) : parsed;
        handleSelect(oddVal);
      } else if (filteredOptions.length > 0) {
        handleSelect(filteredOptions[0]);
      }
    }
  };

  const winThreshold = Math.ceil(value / 2);

  return (
    <div
      ref={containerRef}
      className={cn(className, 'relative inline-block min-w-0 max-w-full', compact ? 'w-35' : 'w-full')}
    >
      {label && (
        <label
          htmlFor={id}
          className="mb-1.5 block text-caption font-semibold text-fg-secondary"
        >
          {label}
        </label>
      )}

      {/* Trigger button */}
      <button
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            setIsOpen(prev => !prev);
            setTimeout(() => inputRef.current?.focus(), 50);
          }
        }}
        className={cn(
          'flex w-full items-center justify-between gap-2 rounded-sm border bg-elevated font-semibold text-fg transition-all duration-150',
          compact ? 'py-1.5 px-2.5 text-caption' : 'py-2 px-3 text-sm',
          isOpen ? 'border-gold shadow-[0_0_0_1px_var(--color-gold)]' : 'border-line shadow-none',
          disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
        )}
      >
        <div className="flex items-center gap-1.5 overflow-hidden">
          <span className="font-bold text-gold-bright">Bo{value}</span>
          {!compact && (
            <span className="whitespace-nowrap text-xs text-fg-muted">
              (First to {winThreshold})
            </span>
          )}
        </div>
        <ChevronDown
          size={16}
          className={cn('shrink-0 text-fg-muted transition-transform duration-200', isOpen && 'rotate-180')}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className={cn(
            'absolute top-[calc(100%+4px)] left-0 z-9999 min-w-55 max-w-80 animate-fade-in rounded-md border border-line bg-elevated p-2 shadow-lg',
            compact ? 'w-55' : 'w-full'
          )}
        >
          {/* Search / Type Input */}
          <div className="mb-2 flex items-center gap-1.5 rounded-sm border border-line bg-canvas py-1.5 px-2">
            <Search size={14} color="var(--color-fg-muted)" className="shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search or type 1-99..."
              className="w-full border-0 bg-transparent text-caption text-fg outline-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="cursor-pointer border-0 bg-transparent py-0 px-0.5 text-xs text-fg-muted"
              >
                ×
              </button>
            )}
          </div>

          {/* Quick Presets */}
          <div className="mb-2">
            <div className="mb-1 text-3xs font-bold uppercase tracking-wide text-fg-muted">
              Presets
            </div>
            <div className="flex flex-wrap gap-1">
              {QUICK_PRESETS.map(preset => {
                const isSelected = value === preset;
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => handleSelect(preset)}
                    className={cn(
                      'cursor-pointer rounded-sm border py-0.5 px-2 text-2xs font-semibold',
                      isSelected
                        ? 'border-gold bg-gold-soft text-gold-bright'
                        : 'border-line-subtle bg-surface text-fg-secondary'
                    )}
                  >
                    Bo{preset}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Odd number reminder if user entered an even number */}
          {(() => {
            const cleanQuery = query.trim().toLowerCase().replace(/^bo\s*/, '');
            const parsed = parseInt(cleanQuery, 10);
            if (!isNaN(parsed) && parsed % 2 === 0 && parsed >= 2 && parsed <= 98) {
              return (
                <div className="mb-1.5 rounded-sm bg-cyan-soft py-1.5 px-2 text-2xs leading-snug text-cyan">
                  Best-of formats must be odd. Use Bo{parsed + 1} or Bo{parsed - 1}.
                </div>
              );
            }
            return null;
          })()}

          {/* Scrollable list of options */}
          <div className="flex max-h-40 flex-col gap-0.5 overflow-y-auto">
            {filteredOptions.length === 0 ? (
              <div className="p-3 text-center text-xs text-fg-muted">
                No matching odd format (1–99)
              </div>
            ) : (
              filteredOptions.map(bo => {
                const isSelected = value === bo;
                const winsNeeded = Math.ceil(bo / 2);
                return (
                  <button
                    key={bo}
                    type="button"
                    onClick={() => handleSelect(bo)}
                    className={cn(
                      'flex cursor-pointer items-center justify-between rounded-sm border-0 py-1.5 px-2 text-left text-caption transition-colors duration-100',
                      isSelected ? 'bg-gold-soft text-gold-bright' : 'bg-transparent text-fg hover:bg-highlight'
                    )}
                  >
                    <span className={isSelected ? 'font-bold' : 'font-medium'}>Bo{bo}</span>
                    <div className="flex items-center gap-2">
                      <span className={cn('text-2xs', isSelected ? 'text-gold' : 'text-fg-muted')}>
                        First to {winsNeeded}
                      </span>
                      {isSelected && <Check size={14} color="var(--color-gold-bright)" />}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
