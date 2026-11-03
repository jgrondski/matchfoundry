/** Origins allowed to open a socket. Vercel preview URLs are allowed when allowVercelPreviews is true. */
export function isAllowedOrigin(origin: string | null, allowedCsv: string, allowVercelPreviews: boolean): boolean {
  if (!origin) return false;
  const allowed = allowedCsv.split(',').map(s => s.trim()).filter(Boolean);
  if (allowed.includes(origin)) return true;
  if (allowVercelPreviews) {
    try {
      const url = new URL(origin);
      return url.protocol === 'https:' && url.hostname.endsWith('.vercel.app');
    } catch {
      return false;
    }
  }
  return false;
}

export interface KeepWarmWindow {
  from: string;
  until: string;
}

export interface StoredSchedule {
  windows: KeepWarmWindow[];
  /** When the last successful fetch happened (ms since epoch), or null if never. */
  fetchedAt: number | null;
  /** When the last fetch was attempted, successful or not (ms since epoch), or null if never. */
  lastAttemptAt: number | null;
}

export const EMPTY_SCHEDULE: StoredSchedule = { windows: [], fetchedAt: null, lastAttemptAt: null };
export const SCHEDULE_REFRESH_MS = 24 * 60 * 60 * 1000;
export const SCHEDULE_RETRY_MS = 60 * 60 * 1000;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** True when today's UTC date is inside any window, boundaries included. */
export function isInKeepWarmWindow(now: Date, windows: KeepWarmWindow[]): boolean {
  const today = now.toISOString().slice(0, 10);
  return windows.some(w => today >= w.from && today <= w.until);
}

/** The windows from a /api/keep-warm-schedule body, or null when the body is not in that shape. */
export function parseKeepWarmSchedule(body: unknown): KeepWarmWindow[] | null {
  if (!body || typeof body !== 'object' || !Array.isArray((body as { windows?: unknown }).windows)) return null;
  const windows: KeepWarmWindow[] = [];
  for (const w of (body as { windows: unknown[] }).windows) {
    if (!w || typeof w !== 'object') return null;
    const { from, until } = w as { from?: unknown; until?: unknown };
    if (typeof from !== 'string' || typeof until !== 'string' || !ISO_DATE.test(from) || !ISO_DATE.test(until)) return null;
    windows.push({ from, until });
  }
  return windows;
}

/** True when the stored schedule should be fetched again: never fetched or a day old, and no attempt in the last hour. */
export function isScheduleDue(now: number, schedule: StoredSchedule): boolean {
  const stale = schedule.fetchedAt === null || now - schedule.fetchedAt >= SCHEDULE_REFRESH_MS;
  const recentlyTried = schedule.lastAttemptAt !== null && now - schedule.lastAttemptAt < SCHEDULE_RETRY_MS;
  return stale && !recentlyTried;
}

export type Route =
  | { kind: 'ws'; tournamentId: string }
  | { kind: 'publish'; tournamentId: string }
  | { kind: 'health' }
  | { kind: 'keepWarm' }
  | { kind: 'notFound' };

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

export function parseRoute(pathname: string): Route {
  if (pathname === '/health') return { kind: 'health' };
  if (pathname === '/keep-warm') return { kind: 'keepWarm' };
  const m = pathname.match(/^\/t\/([^/]+)\/(ws|publish)$/);
  if (!m || !ID_RE.test(m[1])) return { kind: 'notFound' };
  return m[2] === 'ws' ? { kind: 'ws', tournamentId: m[1] } : { kind: 'publish', tournamentId: m[1] };
}

/** Constant-time string compare for the publish secret. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
