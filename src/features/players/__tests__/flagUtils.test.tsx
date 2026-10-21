import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  CountryFlag,
  getCountryCode,
  getCountryFlag,
  getCountryName,
  COUNTRIES,
} from '../flagUtils';

describe('flagUtils and CountryFlag vector SVG rendering (Windows compatibility)', () => {
  describe('getCountryCode', () => {
    it('resolves 2-letter uppercase codes', () => {
      expect(getCountryCode('US')).toBe('US');
      expect(getCountryCode('JP')).toBe('JP');
      expect(getCountryCode('CA')).toBe('CA');
    });

    it('resolves lowercase codes case-insensitively', () => {
      expect(getCountryCode('us')).toBe('US');
      expect(getCountryCode('jp')).toBe('JP');
      expect(getCountryCode('is')).toBe('IS');
    });

    it('resolves full country names', () => {
      expect(getCountryCode('United States')).toBe('US');
      expect(getCountryCode('Japan')).toBe('JP');
      expect(getCountryCode('germany')).toBe('DE');
      expect(getCountryCode('South Korea')).toBe('KR');
    });

    it('handles invalid or empty inputs gracefully', () => {
      expect(getCountryCode('')).toBe('');
      expect(getCountryCode(undefined)).toBe('');
      expect(getCountryCode('   ')).toBe('');
      expect(getCountryCode('NonExistentCountry')).toBe('');
    });
  });

  describe('getCountryName', () => {
    it('resolves standard country names from 2-letter codes', () => {
      expect(getCountryName('US')).toBe('United States');
      expect(getCountryName('jp')).toBe('Japan');
      expect(getCountryName('IS')).toBe('Iceland');
    });

    it('resolves standard country names from names', () => {
      expect(getCountryName('United States')).toBe('United States');
      expect(getCountryName('south korea')).toBe('South Korea');
    });

    it('resolves and caches 2-letter ISO country codes via DisplayNames', () => {
      // Unlisted in initial COUNTRIES or standard ISO codes
      const name1 = getCountryName('EG'); // Egypt
      expect(name1).toBe('Egypt');
      // Second call must resolve consistently from cache
      const name2 = getCountryName('eg');
      expect(name2).toBe('Egypt');
    });

    it('returns empty string for empty input', () => {
      expect(getCountryName('')).toBe('');
      expect(getCountryName(undefined)).toBe('');
    });
  });

  describe('getCountryFlag (Unicode fallback)', () => {
    it('produces Unicode regional indicator characters', () => {
      const usFlag = getCountryFlag('US');
      expect(usFlag).toBe('🇺🇸');
      const jpFlag = getCountryFlag('JP');
      expect(jpFlag).toBe('🇯🇵');
    });
  });

  describe('CountryFlag component', () => {
    it('renders vector SVG rather than text-only emoji so Windows renders flags', () => {
      const html = renderToStaticMarkup(<CountryFlag country="US" />);
      // Must contain an inline SVG
      expect(html).toContain('<svg');
      expect(html).toContain('</svg>');
      expect(html).toContain('title="United States"');
      // Should not contain raw emoji characters as sole content
      expect(html).not.toBe('<span><span>🇺🇸</span></span>');
    });

    it('renders SVG for country by full name as well as code', () => {
      const htmlCode = renderToStaticMarkup(<CountryFlag country="JP" />);
      const htmlName = renderToStaticMarkup(<CountryFlag country="Japan" />);

      expect(htmlCode).toContain('<svg');
      expect(htmlName).toContain('<svg');
      expect(htmlCode).toContain('title="Japan"');
      expect(htmlName).toContain('title="Japan"');
    });

    it('renders showName label when requested', () => {
      const html = renderToStaticMarkup(<CountryFlag country="CA" showName={true} />);
      expect(html).toContain('<svg');
      expect(html).toContain('<span>Canada</span>');
    });

    it('applies custom style and className properly', () => {
      const html = renderToStaticMarkup(
        <CountryFlag
          country="IS"
          className="custom-flag-class"
          style={{ fontSize: '1.5rem', opacity: 0.8 }}
        />
      );
      expect(html).toContain('class="custom-flag-class"');
      expect(html).toContain('font-size:1.5rem');
      expect(html).toContain('opacity:0.8');
    });

    it('returns null when country is undefined or empty', () => {
      const htmlEmpty = renderToStaticMarkup(<CountryFlag country="" />);
      const htmlUndefined = renderToStaticMarkup(<CountryFlag country={undefined} />);
      expect(htmlEmpty).toBe('');
      expect(htmlUndefined).toBe('');
    });

    it('renders SVGs successfully for all COUNTRIES in the catalog', () => {
      COUNTRIES.forEach((c) => {
        const html = renderToStaticMarkup(<CountryFlag country={c.code} />);
        expect(html).toContain('<svg');
        const escapedName = c.name.replace(/&/g, '&amp;');
        expect(html).toContain(`title="${escapedName}"`);
      });
    });
  });
});
