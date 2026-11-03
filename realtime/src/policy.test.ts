import { describe, expect, it } from 'vitest';
import { isAllowedOrigin, parseRoute, safeEqual, shouldKeepWarm } from './policy';

const ALLOWED = 'https://www.matchfoundry.gg,https://matchfoundry.gg,http://localhost:5173';

describe('isAllowedOrigin', () => {
  it('allows a listed origin', () => {
    expect(isAllowedOrigin('https://matchfoundry.gg', ALLOWED, false)).toBe(true);
  });

  it('rejects a null origin', () => {
    expect(isAllowedOrigin(null, ALLOWED, true)).toBe(false);
  });

  it('rejects an unlisted origin', () => {
    expect(isAllowedOrigin('https://evil.example', ALLOWED, true)).toBe(false);
  });

  it('allows https Vercel previews only when previews are on', () => {
    expect(isAllowedOrigin('https://matchfoundry-git-x.vercel.app', ALLOWED, true)).toBe(true);
    expect(isAllowedOrigin('https://matchfoundry-git-x.vercel.app', ALLOWED, false)).toBe(false);
  });

  it('rejects http Vercel previews', () => {
    expect(isAllowedOrigin('http://foo.vercel.app', ALLOWED, true)).toBe(false);
  });

  it('rejects a host that only contains vercel.app', () => {
    expect(isAllowedOrigin('https://vercel.app.evil.example', ALLOWED, true)).toBe(false);
  });
});

describe('shouldKeepWarm', () => {
  const from = '2026-11-10';
  const until = '2026-11-12';

  it('is true inside the range and on both boundary dates', () => {
    expect(shouldKeepWarm(new Date('2026-11-11T12:00:00Z'), from, until)).toBe(true);
    expect(shouldKeepWarm(new Date('2026-11-10T00:00:00Z'), from, until)).toBe(true);
    expect(shouldKeepWarm(new Date('2026-11-12T23:59:59Z'), from, until)).toBe(true);
  });

  it('is false the day before and the day after', () => {
    expect(shouldKeepWarm(new Date('2026-11-09T23:59:59Z'), from, until)).toBe(false);
    expect(shouldKeepWarm(new Date('2026-11-13T00:00:00Z'), from, until)).toBe(false);
  });

  it('is false for empty strings', () => {
    expect(shouldKeepWarm(new Date('2026-11-11T12:00:00Z'), '', '')).toBe(false);
  });

  it('is false for an invalid date string', () => {
    expect(shouldKeepWarm(new Date('2026-11-11T12:00:00Z'), '2026-13-40x', until)).toBe(false);
  });
});

describe('parseRoute', () => {
  it('parses /health', () => {
    expect(parseRoute('/health')).toEqual({ kind: 'health' });
  });

  it('parses the ws route', () => {
    expect(parseRoute('/t/abc-123/ws')).toEqual({ kind: 'ws', tournamentId: 'abc-123' });
  });

  it('parses the publish route', () => {
    expect(parseRoute('/t/abc-123/publish')).toEqual({ kind: 'publish', tournamentId: 'abc-123' });
  });

  it.each(['/t/abc/other', '/t/../ws', '/t/a%20b/ws', '/'])('returns notFound for %s', path => {
    expect(parseRoute(path)).toEqual({ kind: 'notFound' });
  });
});

describe('safeEqual', () => {
  it('is true for equal strings', () => {
    expect(safeEqual('secret-value', 'secret-value')).toBe(true);
  });

  it('is false for different strings of the same length', () => {
    expect(safeEqual('secret-aaaaa', 'secret-bbbbb')).toBe(false);
  });

  it('is false for strings of different length', () => {
    expect(safeEqual('short', 'much-longer')).toBe(false);
  });
});
