// Injected by vite.config.ts `define` at build time from REALTIME_URL.
declare const __REALTIME_URL__: string | undefined;

/** True for an absolute http(s) URL, the only form the realtime worker's address can take. */
export function isRealtimeUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === 'https:' || protocol === 'http:';
  } catch {
    return false;
  }
}

/** Returns the configured URL, or '' when it is unset or malformed (which warns: live updates are off). */
export function resolveRealtimeUrl(value: string | undefined): string {
  if (!value) return '';
  if (isRealtimeUrl(value)) return value;
  console.warn('[realtime] REALTIME_URL is not an http(s) URL; live updates are disabled.');
  return '';
}

/** Base URL of the realtime worker, or '' when live updates are not configured. */
export const REALTIME_URL: string = resolveRealtimeUrl(
  typeof __REALTIME_URL__ === 'undefined' ? undefined : __REALTIME_URL__
);
