import { isNotNull, sql } from 'drizzle-orm';
import { getDb } from '../db';
import { tournaments } from '../db/schema';

/**
 * Days kept warm after an event's last day. Windows are UTC dates, and a US venue's evening is
 * already the next day in UTC (6 pm Pacific is 2 am UTC), so the last evening needs one more day.
 */
export const KEEP_WARM_DAYS_AFTER = 1;

/**
 * Longest event (in days, inclusive) that is kept warm. Longer events, such as month-long online
 * tournaments, are left out: warming them would keep the database awake for weeks.
 */
export const KEEP_WARM_MAX_EVENT_DAYS = 4;

export interface KeepWarmWindow {
  from: string;
  until: string;
}

interface EventDays {
  startDate: string | null;
  endDate: string | null;
  isTest: boolean;
}

/** Shifts a YYYY-MM-DD date by whole days. */
export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Days from start to end, both included (a one-day event is 1). */
export function eventLengthDays(startDate: string, endDate: string): number {
  const ms = Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`);
  return Math.round(ms / 86_400_000) + 1;
}

/**
 * One window per non-test event with a start date that lasts at most KEEP_WARM_MAX_EVENT_DAYS,
 * from its first day to KEEP_WARM_DAYS_AFTER past its last, keeping only windows that end today
 * (UTC) or later, sorted by start.
 */
export function buildKeepWarmWindows(events: EventDays[], today: string): KeepWarmWindow[] {
  return events
    .filter((e): e is EventDays & { startDate: string } => !e.isTest && Boolean(e.startDate))
    .filter(e => eventLengthDays(e.startDate, e.endDate || e.startDate) <= KEEP_WARM_MAX_EVENT_DAYS)
    .map(e => ({
      from: e.startDate,
      until: addDays(e.endDate || e.startDate, KEEP_WARM_DAYS_AFTER),
    }))
    .filter(w => w.until >= today)
    .sort((a, b) => a.from.localeCompare(b.from));
}

/** The schedule the realtime worker fetches once a day (GET /api/keep-warm-schedule). */
export async function getKeepWarmWindows(now: Date = new Date()): Promise<KeepWarmWindow[]> {
  const rows = await getDb()
    .select({
      startDate: tournaments.startDate,
      endDate: tournaments.endDate,
      isTest: sql<boolean | null>`${tournaments.metadata} -> 'isTest'`,
    })
    .from(tournaments)
    .where(isNotNull(tournaments.startDate));
  return buildKeepWarmWindows(
    rows.map((r: { startDate: string | null; endDate: string | null; isTest: boolean | null }) => ({ startDate: r.startDate, endDate: r.endDate, isTest: Boolean(r.isTest) })),
    now.toISOString().slice(0, 10)
  );
}
