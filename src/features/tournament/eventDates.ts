const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** True for a real calendar date written YYYY-MM-DD (rejects 2026-02-30 and loose text). */
export function isIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** The validation message for an event date range, or null when valid. Empty strings mean "not set". */
export function validateEventDates(startDate: string, endDate: string): string | null {
  if (startDate && !isIsoDate(startDate)) return 'Start date must be a real date (YYYY-MM-DD).';
  if (endDate && !isIsoDate(endDate)) return 'End date must be a real date (YYYY-MM-DD).';
  if (endDate && !startDate) return 'Set a start date before an end date.';
  if (startDate && endDate && endDate < startDate) return 'End date cannot be before the start date.';
  return null;
}

const MONTH_DAY: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', timeZone: 'UTC' };
const FULL: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' };
const format = (iso: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('en-US', options).format(new Date(`${iso}T00:00:00Z`));

/**
 * Display text for an event's dates: "Nov 14, 2026", "Nov 14–16, 2026", "Nov 30 – Dec 2, 2026",
 * "Dec 30, 2026 – Jan 2, 2027", or "Date TBD" when there is no valid start date.
 * Dates are calendar days with no time zone, so they are formatted in UTC to avoid shifting a day.
 */
export function formatEventDates(startDate?: string | null, endDate?: string | null): string {
  if (!startDate || !isIsoDate(startDate)) return 'Date TBD';
  if (!endDate || !isIsoDate(endDate) || endDate <= startDate) return format(startDate, FULL);
  if (startDate.slice(0, 4) !== endDate.slice(0, 4)) return `${format(startDate, FULL)} – ${format(endDate, FULL)}`;
  if (startDate.slice(5, 7) !== endDate.slice(5, 7)) return `${format(startDate, MONTH_DAY)} – ${format(endDate, FULL)}`;
  return `${format(startDate, MONTH_DAY)}–${Number(endDate.slice(8, 10))}, ${endDate.slice(0, 4)}`;
}
