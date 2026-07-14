/**
 * Lightweight fixed-window rate limiter.
 *
 * In-memory implementation suitable for a single serverless instance and for
 * development. In production on Vercel (multiple isolates) swap the store for
 * Upstash Redis or similar — the call sites don't change.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  resetAt: number;
};

export function rateLimit(params: {
  /** Unique key, e.g. `upload:${userId}` */
  key: string;
  /** Max requests per window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
}): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(params.key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(params.key, { count: 1, resetAt: now + params.windowMs });
    return { ok: true, remaining: params.limit - 1, resetAt: now + params.windowMs };
  }

  bucket.count += 1;
  const ok = bucket.count <= params.limit;
  return {
    ok,
    remaining: Math.max(0, params.limit - bucket.count),
    resetAt: bucket.resetAt,
  };
}

// Prevent unbounded growth in long-lived processes.
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let lastCleanup = Date.now();
export function cleanupExpiredBuckets(now = Date.now()) {
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}
