let offsetMs = 0;

/** Records the server's clock from a response header. Ignores missing or invalid values. */
export function recordServerTime(headerValue: string | null, receivedAtMs: number = Date.now()): void {
  const server = Number(headerValue);
  if (!headerValue || !Number.isFinite(server) || server <= 0) return;
  offsetMs = server - receivedAtMs;
}

/** The current time on the server's clock (falls back to the device clock until a response arrives). */
export function serverNow(): number {
  return Date.now() + offsetMs;
}

/** Test helper. */
export function resetServerClock(): void {
  offsetMs = 0;
}
