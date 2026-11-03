import { describe, it, expect } from 'vitest';
import { isIsoDate, validateEventDates, formatEventDates } from '../eventDates';

describe('isIsoDate', () => {
  it('accepts real YYYY-MM-DD calendar dates', () => {
    expect(isIsoDate('2026-11-14')).toBe(true);
    expect(isIsoDate('2028-02-29')).toBe(true);
  });

  it('rejects impossible dates and loose text', () => {
    expect(isIsoDate('2026-02-30')).toBe(false);
    expect(isIsoDate('2027-02-29')).toBe(false);
    expect(isIsoDate('2026-2-3')).toBe(false);
    expect(isIsoDate('March 21')).toBe(false);
    expect(isIsoDate('')).toBe(false);
  });
});

describe('validateEventDates', () => {
  it('returns null for valid or empty ranges', () => {
    expect(validateEventDates('', '')).toBeNull();
    expect(validateEventDates('2026-11-14', '')).toBeNull();
    expect(validateEventDates('2026-11-14', '2026-11-16')).toBeNull();
  });

  it('returns the message for each invalid case', () => {
    expect(validateEventDates('Upcoming', '')).toBe('Start date must be a real date (YYYY-MM-DD).');
    expect(validateEventDates('2026-11-14', 'soon')).toBe('End date must be a real date (YYYY-MM-DD).');
    expect(validateEventDates('', '2026-11-16')).toBe('Set a start date before an end date.');
    expect(validateEventDates('2026-11-16', '2026-11-14')).toBe('End date cannot be before the start date.');
  });
});

describe('formatEventDates', () => {
  it('formats single days and ranges', () => {
    expect(formatEventDates('2026-11-14')).toBe('Nov 14, 2026');
    expect(formatEventDates('2026-11-14', '2026-11-16')).toBe('Nov 14–16, 2026');
    expect(formatEventDates('2026-11-30', '2026-12-02')).toBe('Nov 30 – Dec 2, 2026');
    expect(formatEventDates('2026-12-30', '2027-01-02')).toBe('Dec 30, 2026 – Jan 2, 2027');
    expect(formatEventDates('2026-11-14', '2026-11-14')).toBe('Nov 14, 2026');
  });

  it('shows Date TBD without a valid start date', () => {
    expect(formatEventDates('')).toBe('Date TBD');
    expect(formatEventDates(undefined)).toBe('Date TBD');
    expect(formatEventDates('Upcoming')).toBe('Date TBD');
  });
});
