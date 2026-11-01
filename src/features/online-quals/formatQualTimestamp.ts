const formatter = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

/** Full date and time for qual review, e.g. "Nov 1, 2026, 3:42 PM" in en-US. */
export function formatQualTimestamp(ms: number): string {
  return formatter.format(new Date(ms));
}
