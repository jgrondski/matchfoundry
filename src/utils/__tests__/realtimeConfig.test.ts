import { afterEach, describe, expect, it, vi } from 'vitest';
import { isRealtimeUrl, resolveRealtimeUrl } from '../realtimeConfig';

describe('realtimeConfig', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('accepts absolute http(s) URLs', () => {
    expect(isRealtimeUrl('https://matchfoundry-realtime.example.workers.dev')).toBe(true);
    expect(isRealtimeUrl('http://localhost:8787')).toBe(true);
  });

  it('rejects the placeholder a build outside Vercel gets for a Sensitive variable', () => {
    expect(isRealtimeUrl('[SENSITIVE]')).toBe(false);
  });

  it('rejects relative values and other schemes', () => {
    expect(isRealtimeUrl('/realtime')).toBe(false);
    expect(isRealtimeUrl('localhost:8787')).toBe(false);
    expect(isRealtimeUrl('wss://matchfoundry-realtime.example.workers.dev')).toBe(false);
  });

  it('resolves a malformed value to empty and warns', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(resolveRealtimeUrl('[SENSITIVE]')).toBe('');
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('resolves valid and unset values without warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(resolveRealtimeUrl('https://rt.example.dev')).toBe('https://rt.example.dev');
    expect(resolveRealtimeUrl(undefined)).toBe('');
    expect(resolveRealtimeUrl('')).toBe('');
    expect(warn).not.toHaveBeenCalled();
  });
});
