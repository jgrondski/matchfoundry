import React, { useState, useRef, useEffect, useMemo } from 'react';
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
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        style={{
          width: '100%',
          padding: '0.55rem 0.75rem',
          borderRadius: 'var(--radius-sm, 6px)',
          border: '1px solid var(--color-border, #263342)',
          background: 'var(--color-bg-base, #0a0e14)',
          color: value ? 'var(--color-text-primary, #ffffff)' : 'var(--color-text-muted, #64748b)',
          fontSize: '0.88rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.6 : 1,
          outline: 'none',
          boxSizing: 'border-box',
          gap: '0.5rem',
        }}
        data-testid="country-select-trigger"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0, overflow: 'hidden' }}>
          {value ? (
            <>
              <CountryFlag country={value} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>
                {selectedName}
              </span>
              <span
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  color: 'var(--color-gold-bright, #fbbf24)',
                  background: 'rgba(245, 158, 11, 0.12)',
                  padding: '0.1rem 0.35rem',
                  borderRadius: '4px',
                  flexShrink: 0,
                }}
              >
                {value.toUpperCase()}
              </span>
            </>
          ) : (
            <span>Select country...</span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--color-text-muted, #64748b)' }}>
          {value && !disabled && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
              }}
              style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '2px' }}
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
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            background: 'var(--color-bg-surface-elevated, #161e27)',
            border: '1px solid var(--color-border, #263342)',
            borderRadius: 'var(--radius-md, 8px)',
            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.65)',
            zIndex: 10000,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            maxHeight: '320px',
          }}
          data-testid="country-select-dropdown"
        >
          {/* Search Bar */}
          <div
            style={{
              padding: '0.65rem',
              borderBottom: '1px solid var(--color-border, #263342)',
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <Search
              size={15}
              style={{ position: 'absolute', left: '1rem', color: 'var(--color-text-muted, #64748b)' }}
            />
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search 260+ countries..."
              style={{
                width: '100%',
                padding: '0.45rem 0.65rem 0.45rem 2rem',
                borderRadius: '6px',
                border: '1px solid var(--color-border, #263342)',
                background: 'var(--color-bg-base, #0a0e14)',
                color: '#ffffff',
                fontSize: '0.85rem',
                outline: 'none',
                boxSizing: 'border-box',
              }}
              data-testid="country-search-input"
            />
          </div>

          {/* Pure Alphabetical Country List */}
          <div
            style={{
              overflowY: 'auto',
              flex: 1,
              padding: '0.35rem 0',
            }}
            data-testid="country-options-list"
          >
            {filteredCountries.length === 0 ? (
              <div
                style={{
                  padding: '1rem',
                  textAlign: 'center',
                  fontSize: '0.82rem',
                  color: 'var(--color-text-muted, #64748b)',
                }}
              >
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
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.85rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: isSelected ? 'rgba(245, 158, 11, 0.12)' : 'transparent',
                      border: 'none',
                      color: isSelected ? 'var(--color-gold-bright, #fbbf24)' : '#ffffff',
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'background 0.1s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.background = 'transparent';
                    }}
                    data-testid={`country-option-${c.code}`}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      <CountryFlag country={c.code} />
                      <span style={{ fontWeight: isSelected ? 700 : 500 }}>{c.name}</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span
                        style={{
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: '0.72rem',
                          color: 'var(--color-text-muted, #64748b)',
                        }}
                      >
                        {c.code}
                      </span>
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
