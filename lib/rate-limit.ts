'use strict';

type RateLimitBucket = {
  tokens: number;
  lastRefill: number;
};

const buckets = new Map<string, RateLimitBucket>();

/**
 * Basic in-memory Token Bucket rate limiter.
 * Limits keys (e.g. client IP + endpoint) to a max capacity refilled over a window.
 */
export function isRateLimited(key: string, limit: number, windowSec: number): boolean {
  const now = Date.now();
  const refillRate = limit / (windowSec * 1000); // tokens per millisecond

  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { tokens: limit, lastRefill: now };
    buckets.set(key, bucket);
  } else {
    const elapsed = now - bucket.lastRefill;
    bucket.tokens = Math.min(limit, bucket.tokens + elapsed * refillRate);
    bucket.lastRefill = now;
  }

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    return false; // Not rate limited
  }

  return true; // Rate limited
}

/**
 * Resolves the client IP address from a request headers.
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.headers.get('x-real-ip') || '127.0.0.1';
}
