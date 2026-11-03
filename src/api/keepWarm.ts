import { isNotNull, sql } from 'drizzle-orm';
import { getDb } from '../db';
import { tournaments } from '../db/schema';

/** Days added before and after each event, so venue time zones never fall outside the UTC window. */
export const KEEP_WARM_PADDING_DAYS = 1;

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

/** One padded window per non-test event with a start date whose window ends today (UTC) or later, sorted by start. */
export function buildKeepWarmWindows(events: EventDays[], today: string): KeepWarmWindow[] {
  return events
    .filter((e): e is EventDays & { startDate: string } => !e.isTest && Boolean(e.startDate))
    .map(e => ({
      from: addDays(e.startDate, -KEEP_WARM_PADDING_DAYS),
      until: addDays(e.endDate || e.startDate, KEEP_WARM_PADDING_DAYS),
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
