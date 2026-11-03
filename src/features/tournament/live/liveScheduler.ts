export const RECONNECT_STEPS_MS = [1000, 2000, 4000, 8000, 16000, 30000];
export const PING_INTERVAL_MS = 25_000;
export const PONG_TIMEOUT_MS = 10_000;
export const HIDDEN_DISCONNECT_MS = 60_000;
export const ANON_REFRESH_JITTER_MS = 1500;

/** Delay before reconnect attempt `attempt` (0-based), ±20% jitter. `random` is injectable for tests. */
export function reconnectDelayMs(attempt: number, random: () => number = Math.random): number {
  const base = RECONNECT_STEPS_MS[Math.min(Math.max(attempt, 0), RECONNECT_STEPS_MS.length - 1)];
  return Math.round(base * (0.8 + random() * 0.4));
}

/** Spreads anonymous refreshes so 1,000 viewers do not hit the CDN in the same millisecond. */
export function refreshJitterMs(isAuthenticated: boolean, random: () => number = Math.random): number {
  return isAuthenticated ? 0 : Math.floor(random() * ANON_REFRESH_JITTER_MS);
}

/** True when the tab already has this revision or newer. */
export function isStaleEvent(eventRevision: number, knownRevision: number | undefined): boolean {
  return typeof knownRevision === 'number' && eventRevision <= knownRevision;
}

/** https://x → wss://x/t/{id}/ws; http://x → ws://x/t/{id}/ws. */
export function toWebSocketUrl(baseUrl: string, tournamentId: string): string {
  const trimmed = baseUrl.replace(/\/+$/, '');
  const wsBase = trimmed.replace(/^https:/, 'wss:').replace(/^http:/, 'ws:');
  return `${wsBase}/t/${encodeURIComponent(tournamentId)}/ws`;
}

export interface LiveMessage { type: 'changed'; tournamentId: string; revision: number }

export function parseLiveMessage(data: unknown): LiveMessage | null {
  if (typeof data !== 'string' || data === 'pong') return null;
  try {
    const m = JSON.parse(data);
    if (m && m.type === 'changed' && typeof m.tournamentId === 'string' && typeof m.revision === 'number') return m;
  } catch {
    // ignore
  }
  return null;
}
