import { describe, it, expect } from 'vitest';
import {
  RECONNECT_STEPS_MS,
  isStaleEvent,
  parseLiveMessage,
  reconnectDelayMs,
  refreshJitterMs,
  toWebSocketUrl,
} from '../live/liveScheduler';

describe('liveScheduler', () => {
  it('reconnectDelayMs follows the steps with ±20% jitter and caps at 30s', () => {
    RECONNECT_STEPS_MS.forEach((step, i) => {
      expect(reconnectDelayMs(i, () => 0.5)).toBe(step);
      expect(reconnectDelayMs(i, () => 0)).toBe(Math.round(step * 0.8));
      expect(reconnectDelayMs(i, () => 1)).toBe(Math.round(step * 1.2));
    });
    expect(reconnectDelayMs(99, () => 0.5)).toBe(30000);
  });

  it('refreshJitterMs is 0 for signed-in tabs and below 1500 for anonymous tabs', () => {
    expect(refreshJitterMs(true, () => 0.999)).toBe(0);
    expect(refreshJitterMs(false, () => 0.999)).toBeLessThan(1500);
  });

  it('isStaleEvent', () => {
    expect(isStaleEvent(3, 3)).toBe(true);
    expect(isStaleEvent(3, 4)).toBe(true);
    expect(isStaleEvent(4, 3)).toBe(false);
    expect(isStaleEvent(4, undefined)).toBe(false);
  });

  it('toWebSocketUrl', () => {
    expect(toWebSocketUrl('https://a.dev/', 'x y')).toBe('wss://a.dev/t/x%20y/ws');
    expect(toWebSocketUrl('http://localhost:8787', 'id')).toBe('ws://localhost:8787/t/id/ws');
  });

  it('parseLiveMessage', () => {
    expect(parseLiveMessage(JSON.stringify({ type: 'changed', tournamentId: 't1', revision: 4 }))).toEqual({
      type: 'changed',
      tournamentId: 't1',
      revision: 4,
    });
    expect(parseLiveMessage('pong')).toBeNull();
    expect(parseLiveMessage('{not json')).toBeNull();
    expect(parseLiveMessage(JSON.stringify({ type: 'other', tournamentId: 't1', revision: 4 }))).toBeNull();
    expect(parseLiveMessage(JSON.stringify({ type: 'changed', tournamentId: 't1' }))).toBeNull();
  });
});
