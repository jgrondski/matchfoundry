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

/** True when `now` falls on or between the inclusive UTC dates (YYYY-MM-DD). Empty or invalid dates mean false. */
export function shouldKeepWarm(now: Date, fromDate: string, untilDate: string): boolean {
  const re = /^\d{4}-\d{2}-\d{2}$/;
  if (!re.test(fromDate) || !re.test(untilDate)) return false;
  const today = now.toISOString().slice(0, 10);
  return today >= fromDate && today <= untilDate;
}

export type Route =
  | { kind: 'ws'; tournamentId: string }
  | { kind: 'publish'; tournamentId: string }
  | { kind: 'health' }
  | { kind: 'notFound' };

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

export function parseRoute(pathname: string): Route {
  if (pathname === '/health') return { kind: 'health' };
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
