import { waitUntil } from '@vercel/functions';

/**
 * Tells the realtime worker that a tournament changed. Fire-and-forget: never throws, never delays
 * the response. Does nothing when REALTIME_URL or REALTIME_PUBLISH_SECRET is unset (local dev, tests).
 */
export function publishTournamentChanged(tournamentId: string, revision: number): void {
  const base = process.env.REALTIME_URL;
  const secret = process.env.REALTIME_PUBLISH_SECRET;
  if (!base || !secret || process.env.VITEST) return;
  const url = `${base.replace(/\/+$/, '')}/t/${encodeURIComponent(tournamentId)}/publish`;
  const task = fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ revision }),
    signal: AbortSignal.timeout(3000),
  }).then(
    r => { if (!r.ok) console.warn(`[realtime] publish ${tournamentId} -> ${r.status}`); },
    err => console.warn(`[realtime] publish ${tournamentId} failed:`, err?.message || err)
  );
  try {
    waitUntil(task);
  } catch {
    // Not on Vercel (Vite dev server): the promise still runs in the long-lived process.
  }
}
