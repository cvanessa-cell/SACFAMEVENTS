/**
 * In-memory sliding-window rate limiter.
 * Each unique key (typically IP) is tracked with a fixed-size circular buffer
 * of request timestamps. When the window fills, new requests are rejected.
 *
 * For production with multiple Vercel function instances, upgrade to an
 * external store (Upstash Redis, Vercel KV, etc.). This implementation
 * handles single-instance and dev use cases.
 */

interface RateLimitEntry {
  timestamps: number[];
  cursor: number;
}

const store = new Map<string, RateLimitEntry>();

const CLEANUP_INTERVAL_MS = 60_000;
let lastCleanup = Date.now();

function cleanup(windowMs: number) {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  const cutoff = now - windowMs;
  store.forEach((entry, key) => {
    const anyRecent = entry.timestamps.some((t: number) => t > cutoff);
    if (!anyRecent) store.delete(key);
  });
}

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetMs: number;
}

export function checkRateLimit(
  key: string,
  config: RateLimitConfig,
): RateLimitResult {
  cleanup(config.windowMs);
  const now = Date.now();
  const cutoff = now - config.windowMs;

  let entry = store.get(key);
  if (!entry) {
    entry = { timestamps: [], cursor: 0 };
    store.set(key, entry);
  }

  const recentCount = entry.timestamps.filter((t) => t > cutoff).length;

  if (recentCount >= config.maxRequests) {
    const oldest = Math.min(...entry.timestamps.filter((t) => t > cutoff));
    return {
      allowed: false,
      remaining: 0,
      resetMs: oldest + config.windowMs - now,
    };
  }

  if (entry.timestamps.length < config.maxRequests) {
    entry.timestamps.push(now);
  } else {
    entry.timestamps[entry.cursor] = now;
    entry.cursor = (entry.cursor + 1) % config.maxRequests;
  }

  return {
    allowed: true,
    remaining: config.maxRequests - recentCount - 1,
    resetMs: config.windowMs,
  };
}

export const API_RATE_LIMITS: Record<string, RateLimitConfig> = {
  default: { maxRequests: 60, windowMs: 60_000 },
  discover: { maxRequests: 5, windowMs: 60_000 },
  cron: { maxRequests: 10, windowMs: 60_000 },
  webhook: { maxRequests: 100, windowMs: 60_000 },
  admin: { maxRequests: 30, windowMs: 60_000 },
};
