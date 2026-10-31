import React from 'react';
import * as Flags from 'country-flag-icons/react/3x2';
import { hasFlag, countries } from 'country-flag-icons';
import { cn } from '../../components/ui';

/**
 * Standard list of countries with 2-letter ISO codes and names.
 */
export interface CountryItem {
  code: string;
  name: string;
}

const customRegionNames: Record<string, string> = {
  'BQ-BO': 'Bonaire',
  'BQ-SA': 'Saba',
  'BQ-SE': 'Sint Eustatius',
  'ES-CT': 'Catalonia',
  'GB-ENG': 'England',
  'GB-NIR': 'Northern Ireland',
  'GB-SCT': 'Scotland',
  'GB-WLS': 'Wales',
  'XC': 'Ceuta',
  'XO': 'Melilla',
};

let cachedDisplayNames: Intl.DisplayNames | null = null;
try {
  if (typeof Intl !== 'undefined' && Intl.DisplayNames) {
    cachedDisplayNames = new Intl.DisplayNames(['en'], { type: 'region' });
  }
} catch {
  // Ignore fallback
}

export const ALL_COUNTRIES: CountryItem[] = (countries as string[])
  .map((code) => {
    let name = customRegionNames[code];
    if (!name && cachedDisplayNames) {
      try {
        name = cachedDisplayNames.of(code) || code;
      } catch {
        name = code;
      }
    }
    return { code, name: name || code };
  })
  .sort((a, b) => a.name.localeCompare(b.name));

export const COUNTRIES: CountryItem[] = ALL_COUNTRIES;

const countryMap = new Map<string, string>();
const countryNameMap = new Map<string, string>();
ALL_COUNTRIES.forEach((c) => {
  countryMap.set(c.code.toUpperCase(), c.code);
  countryMap.set(c.name.toUpperCase(), c.code);
  countryNameMap.set(c.code.toUpperCase(), c.name);
  countryNameMap.set(c.name.toUpperCase(), c.name);
});

/**
 * Resolves a 2-letter ISO country code from a code or name.
 */
export function getCountryCode(country?: string): string {
  if (!country) return '';
  const trimmed = country.trim().toUpperCase();
  if (!trimmed) return '';

  if (hasFlag(trimmed)) {
    return trimmed;
  }

  const matched = countryMap.get(trimmed);
  if (matched) return matched;

  if (trimmed.length === 2) return trimmed;
  return '';
}

/**
 * Converts a 2-letter ISO country code or country name to a Unicode flag emoji.
 * e.g., 'US' -> 🇺🇸, 'JP' -> 🇯🇵
 * Retained for backward-compatibility and text contexts.
 */
export function getCountryFlag(country?: string): string {
  const code = getCountryCode(country);
  if (!code || code.length !== 2) return '';

  // Unicode Regional Indicator Symbols (A = 0x1F1E6 = 127462)
  // 'A'.charCodeAt(0) is 65. 127462 - 65 = 127397
  const codePoints = code.split('').map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

/**
 * Resolve standard country name from code or name
 */
export function getCountryName(country?: string): string {
  if (!country) return '';
  const trimmed = country.trim().toUpperCase();
  if (!trimmed) return '';

  const cached = countryNameMap.get(trimmed);
  if (cached) return cached;

  if (trimmed.length === 2 && cachedDisplayNames) {
    try {
      const resolved = cachedDisplayNames.of(trimmed);
      if (resolved) {
        countryNameMap.set(trimmed, resolved);
        return resolved;
      }
    } catch {
      // Ignore and fallback
    }
  }

  return country;
}

/**
 * Reusable CountryFlag component rendering crisp vector SVGs across all operating systems.
 */
export interface CountryFlagProps {
  country?: string;
  showName?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

const flagComponentMap = Flags as unknown as Record<
  string,
  React.ComponentType<{
    title?: string;
    style?: React.CSSProperties;
    className?: string;
  }>
>;

export const CountryFlag: React.FC<CountryFlagProps> = React.memo(({
  country,
  showName = false,
  className,
  style,
}) => {
  const code = getCountryCode(country);
  const name = getCountryName(country);

  if (!code && !country) return null;

  const flagKey = code ? (flagComponentMap[code] ? code : code.replace(/-/g, '_')) : '';
  const FlagComponent = code && hasFlag(code) ? flagComponentMap[flagKey] : null;

  const flagNode = FlagComponent ? (
    React.createElement(FlagComponent, {
      title: name,
      className:
        'inline-block h-[0.8em] w-[1.2em] shrink-0 rounded-2xs align-middle shadow-[0_0_0_1px_rgba(255,255,255,0.15)]',
    })
  ) : (
    // Fallback to unicode emoji if specific SVG flag not found
    React.createElement('span', { className: 'text-[1.05em]' }, getCountryFlag(country))
  );

  return React.createElement(
    'span',
    {
      className: cn('inline-flex items-center gap-1.5 text-[1em] leading-none align-middle select-none', className),
      style: style ? { ...style } : undefined,
      title: name,
    },
    flagNode,
    showName ? React.createElement('span', null, name) : null
  );
});
