// Injected by vite.config.ts `define` at build time from REALTIME_URL.
declare const __REALTIME_URL__: string | undefined;

/** Base URL of the realtime worker, or '' when live updates are not configured. */
export const REALTIME_URL: string = typeof __REALTIME_URL__ === 'undefined' ? '' : __REALTIME_URL__;
