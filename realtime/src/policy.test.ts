import { describe, expect, it } from 'vitest';
import {
  EMPTY_SCHEDULE,
  isAllowedOrigin,
  isInKeepWarmWindow,
  isScheduleDue,
  parseKeepWarmSchedule,
  parseRoute,
  safeEqual,
} from './policy';

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

describe('isInKeepWarmWindow', () => {
  const windows = [{ from: '2026-11-13', until: '2026-11-17' }];

  it('is true inside the window and on both boundary dates', () => {
    expect(isInKeepWarmWindow(new Date('2026-11-13T00:00:00Z'), windows)).toBe(true);
    expect(isInKeepWarmWindow(new Date('2026-11-15T12:00:00Z'), windows)).toBe(true);
    expect(isInKeepWarmWindow(new Date('2026-11-17T23:59:59Z'), windows)).toBe(true);
  });

  it('is false the day before and the day after', () => {
    expect(isInKeepWarmWindow(new Date('2026-11-12T23:59:59Z'), windows)).toBe(false);
    expect(isInKeepWarmWindow(new Date('2026-11-18T00:00:00Z'), windows)).toBe(false);
  });

  it('is false with no windows', () => {
    expect(isInKeepWarmWindow(new Date('2026-11-15T12:00:00Z'), [])).toBe(false);
  });

  it('is true when only the second of two windows matches', () => {
    const two = [
      { from: '2026-10-01', until: '2026-10-03' },
      { from: '2026-11-13', until: '2026-11-17' },
    ];
    expect(isInKeepWarmWindow(new Date('2026-11-15T12:00:00Z'), two)).toBe(true);
  });
});

describe('parseKeepWarmSchedule', () => {
  it('returns the windows for a valid body', () => {
    const windows = [
      { from: '2026-11-13', until: '2026-11-17' },
      { from: '2026-12-01', until: '2026-12-03' },
    ];
    expect(parseKeepWarmSchedule({ windows })).toEqual(windows);
  });

  it('returns [] for an empty windows array', () => {
    expect(parseKeepWarmSchedule({ windows: [] })).toEqual([]);
  });

  it.each([
    ['null', null],
    ['an empty object', {}],
    ['a non-array windows', { windows: 'x' }],
    ['a window with a non-ISO date', { windows: [{ from: 'Nov 13', until: '2026-11-17' }] }],
  ])('returns null for %s', (_label, body) => {
    expect(parseKeepWarmSchedule(body)).toBeNull();
  });
});

describe('isScheduleDue', () => {
  const now = Date.parse('2026-11-03T12:00:00Z');
  const HOUR = 60 * 60 * 1000;
  const MINUTE = 60 * 1000;

  it('is true for the empty schedule', () => {
    expect(isScheduleDue(now, EMPTY_SCHEDULE)).toBe(true);
  });

  it('is false when the last fetch was 1 hour ago', () => {
    expect(isScheduleDue(now, { windows: [], fetchedAt: now - HOUR, lastAttemptAt: now - HOUR })).toBe(false);
  });

  it('is true when the last fetch and attempt were both 25 hours ago', () => {
    expect(isScheduleDue(now, { windows: [], fetchedAt: now - 25 * HOUR, lastAttemptAt: now - 25 * HOUR })).toBe(true);
  });

  it('is false when the fetch is 25 hours old but an attempt was 10 minutes ago', () => {
    expect(isScheduleDue(now, { windows: [], fetchedAt: now - 25 * HOUR, lastAttemptAt: now - 10 * MINUTE })).toBe(false);
  });

  it('is true when never fetched and the last attempt was 2 hours ago', () => {
    expect(isScheduleDue(now, { windows: [], fetchedAt: null, lastAttemptAt: now - 2 * HOUR })).toBe(true);
  });
});

describe('parseRoute', () => {
  it('parses /health', () => {
    expect(parseRoute('/health')).toEqual({ kind: 'health' });
  });

  it('parses /keep-warm', () => {
    expect(parseRoute('/keep-warm')).toEqual({ kind: 'keepWarm' });
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
