import { describe, it, expect, beforeEach } from 'vitest';
import { downloadRateLimiter, rateLimitStore, LIMIT, WINDOW_MS } from './downloadRateLimiter.js';

// Helper to create mock req/res/next
function createMocks(userId = 'user-123') {
  const req = { user: { id: userId } };
  const headers = {};
  const res = {
    status(code) {
      res.statusCode = code;
      return res;
    },
    json(body) {
      res.body = body;
      return res;
    },
    set(key, value) {
      headers[key] = value;
    },
    statusCode: null,
    body: null,
    headers
  };
  let nextCalled = false;
  const next = () => { nextCalled = true; };

  return { req, res, next, wasNextCalled: () => nextCalled, getHeaders: () => headers };
}

describe('downloadRateLimiter', () => {
  beforeEach(() => {
    rateLimitStore.clear();
  });

  it('allows first request and sets count to 1', () => {
    const { req, res, next, wasNextCalled, getHeaders } = createMocks();

    downloadRateLimiter(req, res, next);

    expect(wasNextCalled()).toBe(true);
    expect(getHeaders()['X-RateLimit-Limit']).toBe('10');
    expect(getHeaders()['X-RateLimit-Remaining']).toBe('9');
    expect(getHeaders()['X-RateLimit-Reset']).toBeDefined();
  });

  it('allows up to 10 requests within the window', () => {
    const userId = 'user-456';

    for (let i = 0; i < LIMIT; i++) {
      const { req, res, next, wasNextCalled, getHeaders } = createMocks(userId);
      downloadRateLimiter(req, res, next);
      expect(wasNextCalled()).toBe(true);
      expect(getHeaders()['X-RateLimit-Remaining']).toBe(String(LIMIT - (i + 1)));
    }
  });

  it('rejects the 11th request with 429', () => {
    const userId = 'user-789';

    // Exhaust the limit
    for (let i = 0; i < LIMIT; i++) {
      const { req, res, next } = createMocks(userId);
      downloadRateLimiter(req, res, next);
    }

    // 11th request should be rejected
    const { req, res, next, wasNextCalled, getHeaders } = createMocks(userId);
    downloadRateLimiter(req, res, next);

    expect(wasNextCalled()).toBe(false);
    expect(res.statusCode).toBe(429);
    expect(res.body.error).toMatch(/Przekroczono limit 10 pobrań\/h/);
    expect(res.body.retryAfterMinutes).toBeGreaterThan(0);
    expect(getHeaders()['X-RateLimit-Remaining']).toBe('0');
  });

  it('resets count after window expires', () => {
    const userId = 'user-reset';

    // Exhaust the limit
    for (let i = 0; i < LIMIT; i++) {
      const { req, res, next } = createMocks(userId);
      downloadRateLimiter(req, res, next);
    }

    // Simulate window expiration
    const entry = rateLimitStore.get(userId);
    entry.resetAt = Date.now() - 1; // expired

    // Next request should succeed
    const { req, res, next, wasNextCalled, getHeaders } = createMocks(userId);
    downloadRateLimiter(req, res, next);

    expect(wasNextCalled()).toBe(true);
    expect(getHeaders()['X-RateLimit-Remaining']).toBe('9');
  });

  it('tracks different users independently', () => {
    const { req: req1, res: res1, next: next1, wasNextCalled: wasNext1 } = createMocks('user-a');
    const { req: req2, res: res2, next: next2, wasNextCalled: wasNext2 } = createMocks('user-b');

    downloadRateLimiter(req1, res1, next1);
    downloadRateLimiter(req2, res2, next2);

    expect(wasNext1()).toBe(true);
    expect(wasNext2()).toBe(true);
    expect(rateLimitStore.get('user-a').count).toBe(1);
    expect(rateLimitStore.get('user-b').count).toBe(1);
  });

  it('sets X-RateLimit-Reset as Unix seconds', () => {
    const { req, res, next, getHeaders } = createMocks();

    downloadRateLimiter(req, res, next);

    const resetValue = Number(getHeaders()['X-RateLimit-Reset']);
    // Should be roughly now + 1 hour in seconds (not milliseconds)
    const nowSeconds = Math.ceil(Date.now() / 1000);
    expect(resetValue).toBeGreaterThan(nowSeconds);
    expect(resetValue).toBeLessThanOrEqual(nowSeconds + 3601);
  });
});
