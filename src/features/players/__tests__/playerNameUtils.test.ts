import { describe, it, expect } from 'vitest';
import { getEffectivePlayerName } from '../playerNameUtils';

describe('playerNameUtils - getEffectivePlayerName', () => {
  it('returns empty string for null or undefined input', () => {
    expect(getEffectivePlayerName(null)).toBe('');
    expect(getEffectivePlayerName(undefined)).toBe('');
    expect(getEffectivePlayerName({})).toBe('');
  });

  it('prefers displayName (Preferred Name) when present', () => {
    expect(
      getEffectivePlayerName({
        name: 'Blue Scuti',
        displayName: 'Scuti',
        nickname: 'The Beast',
      })
    ).toBe('Scuti');
  });

  it('falls back to nickname when displayName is missing or empty', () => {
    expect(
      getEffectivePlayerName({
        name: 'Blue Scuti',
        displayName: '   ',
        nickname: 'Scuti',
      })
    ).toBe('Scuti');

    expect(
      getEffectivePlayerName({
        name: 'Blue Scuti',
        nickname: 'Scuti',
      })
    ).toBe('Scuti');
  });

  it('falls back to name when both displayName and nickname are missing', () => {
    expect(
      getEffectivePlayerName({
        name: 'Blue Scuti',
      })
    ).toBe('Blue Scuti');

    expect(
      getEffectivePlayerName({
        name: 'Blue Scuti',
        displayName: '',
        nickname: '',
      })
    ).toBe('Blue Scuti');
  });

  it('trims whitespace on preferred name', () => {
    expect(
      getEffectivePlayerName({
        name: 'Blue Scuti',
        displayName: '  Scuti  ',
      })
    ).toBe('Scuti');
  });
});
