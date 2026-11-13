import { describe, expect, it } from 'vitest';
import {
  MAX_SCORE,
  SCORE_FORMAT_MESSAGE,
  SCORE_MAX_MESSAGE,
  InvalidScoreError,
  applyScoreKeystroke,
  assertValidScores,
  formatScore,
  formatScoreDigits,
  isValidScore,
} from '../scores';

describe('score rule', () => {
  it('allows whole numbers from 0 to 99,999,999 only', () => {
    expect(MAX_SCORE).toBe(99_999_999);
    expect(isValidScore(0)).toBe(true);
    expect(isValidScore(99_999_999)).toBe(true);
    expect(isValidScore(100_000_000)).toBe(false);
    expect(isValidScore(-1)).toBe(false);
    expect(isValidScore(1.5)).toBe(false);
    expect(isValidScore(Number.NaN)).toBe(false);
    expect(isValidScore('100')).toBe(false);
    expect(isValidScore(null)).toBe(false);
  });

  it('assertValidScores throws InvalidScoreError naming the bad value', () => {
    expect(() => assertValidScores([1, 2, 3])).not.toThrow();
    expect(() => assertValidScores([1, 555_555_555], 'Game score')).toThrow(InvalidScoreError);
    expect(() => assertValidScores([555_555_555], 'Game score')).toThrow(/Game score 555555555/);
  });

  it('formats with commas', () => {
    expect(formatScore(1_234_567)).toBe('1,234,567');
    expect(formatScore(0)).toBe('0');
    expect(formatScoreDigits('')).toBe('');
    expect(formatScoreDigits('99999999')).toBe('99,999,999');
  });
});

describe('applyScoreKeystroke', () => {
  it('accepts digits and drops commas', () => {
    expect(applyScoreKeystroke('', '1,234,567')).toEqual({ digits: '1234567', rejection: null });
    expect(applyScoreKeystroke('12', '123')).toEqual({ digits: '123', rejection: null });
  });

  it('treats clearing the field as empty, not zero', () => {
    expect(applyScoreKeystroke('5', '')).toEqual({ digits: '', rejection: null });
  });

  it('strips leading zeros but keeps a lone zero', () => {
    expect(applyScoreKeystroke('', '0')).toEqual({ digits: '0', rejection: null });
    expect(applyScoreKeystroke('0', '05')).toEqual({ digits: '5', rejection: null });
  });

  it.each(['1.5', '12a', '1 000', '-5', '1e5', '$100'])('rejects %s and keeps the previous value', raw => {
    expect(applyScoreKeystroke('12', raw)).toEqual({ digits: '12', rejection: SCORE_FORMAT_MESSAGE });
  });

  it('rejects anything above 99,999,999 and keeps the previous value', () => {
    expect(applyScoreKeystroke('99999999', '999999999')).toEqual({ digits: '99999999', rejection: SCORE_MAX_MESSAGE });
    expect(applyScoreKeystroke('', '100,000,000')).toEqual({ digits: '', rejection: SCORE_MAX_MESSAGE });
    expect(applyScoreKeystroke('', '99,999,999')).toEqual({ digits: '99999999', rejection: null });
  });
});
