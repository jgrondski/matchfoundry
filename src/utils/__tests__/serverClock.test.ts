import { describe, it, expect, afterEach } from 'vitest';
import { recordServerTime, resetServerClock, serverNow } from '../serverClock';
import { getQualTimerRemainingSeconds } from '../../features/tournament/qualTimer';

describe('serverClock', () => {
  afterEach(() => {
    resetServerClock();
  });

  it('records the offset between server and device clocks', () => {
    recordServerTime('10000', 4000);
    expect(Math.abs(serverNow() - Date.now() - 6000)).toBeLessThanOrEqual(5);
  });

  it('ignores missing or invalid header values', () => {
    recordServerTime('10000', 4000);
    for (const value of [null, '', 'abc', '-1']) {
      recordServerTime(value, 0);
      expect(Math.abs(serverNow() - Date.now() - 6000)).toBeLessThanOrEqual(5);
    }
  });

  it('the qual timer counts from the server clock', () => {
    const now = Date.now();
    recordServerTime(String(now + 60_000), now);
    const remaining = getQualTimerRemainingSeconds(
      { durationMinutes: 10, elapsedSeconds: 0, isRunning: true, lastResumedAt: Date.now(), startedAt: Date.now() },
      10
    );
    expect(Math.abs(remaining - (600 - 60))).toBeLessThanOrEqual(1);
  });
});
