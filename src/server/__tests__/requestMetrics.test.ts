import { describe, it, expect } from 'vitest';
import { Readable } from 'node:stream';
import { createApiMiddleware } from '../api';
import {
  runWithRequestMetrics,
  recordQuery,
  getRequestMetrics,
  formatServerTiming,
} from '../requestMetrics';

function createMockReq(options: { url: string; method?: string }) {
  const req = Readable.from([]) as any;
  req.url = options.url;
  req.method = options.method || 'GET';
  req.headers = {};
  return req;
}

function createMockRes() {
  let statusCode = 200;
  const headers = new Map<string, string>();
  return {
    headers,
    setHeader(name: string, val: string) {
      headers.set(name.toLowerCase(), val);
    },
    getHeader(name: string) {
      return headers.get(name.toLowerCase());
    },
    set statusCode(code: number) {
      statusCode = code;
    },
    get statusCode() {
      return statusCode;
    },
    end() {},
  };
}

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe('requestMetrics', () => {
  it('returns null outside a request and recordQuery is a no-op there', () => {
    expect(getRequestMetrics()).toBeNull();
    expect(() => recordQuery()).not.toThrow();
  });

  it('counts queries inside runWithRequestMetrics', async () => {
    const count = await runWithRequestMetrics(async () => {
      recordQuery();
      recordQuery();
      recordQuery();
      return getRequestMetrics()?.queryCount;
    });
    expect(count).toBe(3);
  });

  it('keeps separate counts for concurrent requests', async () => {
    const [a, b] = await Promise.all([
      runWithRequestMetrics(async () => {
        await tick();
        recordQuery();
        await tick();
        return getRequestMetrics()?.queryCount;
      }),
      runWithRequestMetrics(async () => {
        recordQuery();
        await tick();
        recordQuery();
        await tick();
        return getRequestMetrics()?.queryCount;
      }),
    ]);
    expect(a).toBe(1);
    expect(b).toBe(2);
  });

  it('formats the Server-Timing header', () => {
    expect(formatServerTiming({ elapsedMs: 12, queryCount: 4 })).toBe('app;dur=12, db;desc="4 queries"');
  });

  it('sets a Server-Timing header on GET /api', async () => {
    const middleware = createApiMiddleware();
    const res = createMockRes();
    await middleware(createMockReq({ url: '/api' }), res as any, () => {});
    expect(res.headers.get('server-timing')).toMatch(/^app;dur=\d+, db;desc="\d+ queries"$/);
  });
});
