import React from 'react';
import * as Flags from 'country-flag-icons/react/3x2';
import { hasFlag } from 'country-flag-icons';

/**
 * Standard list of countries with 2-letter ISO codes and names.
 */
export interface CountryItem {
  code: string;
  name: string;
}

export const COUNTRIES: CountryItem[] = [
  { code: 'US', name: 'United States' },
  { code: 'JP', name: 'Japan' },
  { code: 'CA', name: 'Canada' },
  { code: 'IS', name: 'Iceland' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'AU', name: 'Australia' },
  { code: 'BR', name: 'Brazil' },
  { code: 'MX', name: 'Mexico' },
  { code: 'KR', name: 'South Korea' },
  { code: 'ES', name: 'Spain' },
  { code: 'IT', name: 'Italy' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'SE', name: 'Sweden' },
  { code: 'NO', name: 'Norway' },
  { code: 'FI', name: 'Finland' },
  { code: 'DK', name: 'Denmark' },
  { code: 'PL', name: 'Poland' },
  { code: 'AT', name: 'Austria' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'BE', name: 'Belgium' },
  { code: 'IE', name: 'Ireland' },
  { code: 'NZ', name: 'New Zealand' },
  { code: 'AR', name: 'Argentina' },
  { code: 'CL', name: 'Chile' },
  { code: 'CO', name: 'Colombia' },
  { code: 'PH', name: 'Philippines' },
  { code: 'SG', name: 'Singapore' },
  { code: 'ID', name: 'Indonesia' },
  { code: 'MY', name: 'Malaysia' },
  { code: 'TH', name: 'Thailand' },
  { code: 'VN', name: 'Vietnam' },
  { code: 'IN', name: 'India' },
  { code: 'ZA', name: 'South Africa' },
  { code: 'PT', name: 'Portugal' },
  { code: 'CZ', name: 'Czech Republic' },
  { code: 'HU', name: 'Hungary' },
  { code: 'GR', name: 'Greece' },
  { code: 'TR', name: 'Turkey' },
  { code: 'IL', name: 'Israel' },
  { code: 'TW', name: 'Taiwan' },
  { code: 'HK', name: 'Hong Kong' },
];

const countryMap = new Map<string, string>();
const countryNameMap = new Map<string, string>();
COUNTRIES.forEach((c) => {
  countryMap.set(c.code.toUpperCase(), c.code);
  countryMap.set(c.name.toUpperCase(), c.code);
  countryNameMap.set(c.code.toUpperCase(), c.name);
  countryNameMap.set(c.name.toUpperCase(), c.name);
});

let cachedDisplayNames: Intl.DisplayNames | null = null;
try {
  if (typeof Intl !== 'undefined' && Intl.DisplayNames) {
    cachedDisplayNames = new Intl.DisplayNames(['en'], { type: 'region' });
  }
} catch {
  // Ignore fallback
}

/**
 * Resolves a 2-letter ISO country code from a code or name.
 */
export function getCountryCode(country?: string): string {
  if (!country) return '';
  const trimmed = country.trim().toUpperCase();
  if (!trimmed) return '';

  if (trimmed.length === 2 && hasFlag(trimmed)) {
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

  const FlagComponent = code && hasFlag(code) ? flagComponentMap[code] : null;

  const flagNode = FlagComponent ? (
    React.createElement(FlagComponent, {
      title: name,
      style: {
        width: '1.2em',
        height: '0.8em',
        borderRadius: '2px',
        boxShadow: '0 0 0 1px rgba(255, 255, 255, 0.15)',
        display: 'inline-block',
        flexShrink: 0,
        verticalAlign: 'middle',
      },
    })
  ) : (
    // Fallback to unicode emoji if specific SVG flag not found
    React.createElement('span', { style: { fontSize: '1.05em' } }, getCountryFlag(country))
  );

  return React.createElement(
    'span',
    {
      className,
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.35rem',
        fontSize: '1em',
        lineHeight: 1,
        verticalAlign: 'middle',
        userSelect: 'none',
        ...style,
      },
      title: name,
    },
    flagNode,
    showName ? React.createElement('span', null, name) : null
  );
});
