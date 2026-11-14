/**
 * The one rule for every game score (qualifier attempts and bracket games):
 * a whole number from 0 to 99,999,999. Commas are accepted while typing and
 * always shown, but never stored. Shared by the inputs, the API and the data
 * layer; the database enforces the same range with CHECK constraints.
 */
export const MAX_SCORE = 99_999_999;

export const SCORE_FORMAT_MESSAGE = 'Whole numbers only';
export const SCORE_MAX_MESSAGE = `Max ${MAX_SCORE.toLocaleString('en-US')}`;

export class InvalidScoreError extends Error {}

export function isValidScore(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= MAX_SCORE;
}

/** Throws InvalidScoreError (mapped to HTTP 400) unless every score is valid. */
export function assertValidScores(scores: unknown[], label = 'Score'): void {
  for (const score of scores) {
    if (!isValidScore(score)) {
      throw new InvalidScoreError(
        `${label} ${JSON.stringify(score)} is not allowed. Scores must be whole numbers from 0 to ${MAX_SCORE.toLocaleString('en-US')}.`
      );
    }
  }
}

/** Formats a score for display: 1234567 -> "1,234,567". */
export function formatScore(value: number): string {
  return value.toLocaleString('en-US');
}

/** Formats a digit string for an input: "1234567" -> "1,234,567", "" stays "". */
export function formatScoreDigits(digits: string): string {
  return digits === '' ? '' : formatScore(Number(digits));
}

export type ScoreKeystroke = { digits: string; rejection: string | null };

/**
 * Applies what the user typed or pasted to a score input. Commas are dropped;
 * anything else that is not a digit (decimals, letters, spaces, minus signs)
 * rejects the change, as does a value above MAX_SCORE. A rejected change keeps
 * the previous digits and reports why, so nothing is silently rewritten.
 */
export function applyScoreKeystroke(previousDigits: string, raw: string): ScoreKeystroke {
  const withoutCommas = raw.replace(/,/g, '');
  if (withoutCommas === '') return { digits: '', rejection: null };
  if (!/^\d+$/.test(withoutCommas)) return { digits: previousDigits, rejection: SCORE_FORMAT_MESSAGE };
  const digits = withoutCommas.replace(/^0+(?=\d)/, '');
  if (digits.length > String(MAX_SCORE).length || Number(digits) > MAX_SCORE) {
    return { digits: previousDigits, rejection: SCORE_MAX_MESSAGE };
  }
  return { digits, rejection: null };
}
