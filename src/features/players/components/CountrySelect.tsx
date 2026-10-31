import React, { useState, useRef, useEffect, useMemo } from 'react';
import { cn } from '../../../components/ui';
import { ALL_COUNTRIES, CountryFlag, getCountryName } from '../flagUtils';
import { Search, ChevronDown, Check, X } from 'lucide-react';

export interface CountrySelectProps {
  value?: string;
  onChange: (countryCode: string) => void;
  disabled?: boolean;
}

export const CountrySelect: React.FC<CountrySelectProps> = ({
  value = '',
  onChange,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearch('');
    }
  }, [isOpen]);

  const selectedName = useMemo(() => {
    if (!value) return '';
    return getCountryName(value) || value;
  }, [value]);

  const filteredCountries = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return ALL_COUNTRIES;
    return ALL_COUNTRIES.filter(
      (c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)
    );
  }, [search]);

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={cn(
          'flex w-full items-center justify-between gap-2 rounded-sm border border-line bg-canvas px-3 py-2 text-sm outline-none',
          value ? 'text-fg' : 'text-fg-muted',
          disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer opacity-100'
        )}
        data-testid="country-select-trigger"
      >
        <div className="flex min-w-0 items-center gap-2 overflow-hidden">
          {value ? (
            <>
              <CountryFlag country={value} />
              <span className="truncate font-semibold">{selectedName}</span>
              <span className="shrink-0 rounded-xs bg-gold/12 px-1.5 py-0.5 font-mono text-xs font-bold text-gold-bright">
                {value.toUpperCase()}
              </span>
            </>
          ) : (
            <span>Select country...</span>
          )}
        </div>

        <div className="flex items-center gap-1.5 text-fg-muted">
          {value && !disabled && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
              }}
              className="flex cursor-pointer items-center p-0.5"
              title="Clear country"
            >
              <X size={14} />
            </span>
          )}
          <ChevronDown size={16} />
        </div>
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <div
          className="absolute top-[calc(100%+4px)] right-0 left-0 z-10000 flex max-h-80 flex-col overflow-hidden rounded-md border border-line bg-elevated shadow-[0_12px_32px_rgba(0,0,0,0.65)]"
          data-testid="country-select-dropdown"
        >
          {/* Search Bar */}
          <div className="relative flex items-center border-b border-line p-2.5">
            <Search size={15} className="absolute left-4 text-fg-muted" />
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search 260+ countries..."
              className="w-full rounded-sm border border-line bg-canvas py-2 pr-2.5 pl-8 text-sm text-white outline-none"
              data-testid="country-search-input"
            />
          </div>

          {/* Pure Alphabetical Country List */}
          <div className="flex-1 overflow-y-auto px-0 py-1.5" data-testid="country-options-list">
            {filteredCountries.length === 0 ? (
              <div className="p-4 text-center text-caption text-fg-muted">
                No countries matching &quot;{search}&quot;
              </div>
            ) : (
              filteredCountries.map((c) => {
                const isSelected = value.toUpperCase() === c.code.toUpperCase();
                return (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => {
                      onChange(c.code);
                      setIsOpen(false);
                    }}
                    className={cn(
                      'flex w-full cursor-pointer items-center justify-between border-0 px-3.5 py-2 text-left text-sm transition-colors duration-100',
                      isSelected ? 'bg-gold/12 text-gold-bright' : 'bg-transparent text-white hover:bg-white/5'
                    )}
                    data-testid={`country-option-${c.code}`}
                  >
                    <div className="flex items-center gap-2.5">
                      <CountryFlag country={c.code} />
                      <span className={isSelected ? 'font-bold' : 'font-medium'}>{c.name}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-fg-muted">{c.code}</span>
                      {isSelected && <Check size={14} color="var(--color-gold-bright, #fbbf24)" />}
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
