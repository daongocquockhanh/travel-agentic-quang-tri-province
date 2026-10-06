import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/**
 * Per-IP rate limits (SYSTEM_DESIGN §8.2). Upstash Redis when configured,
 * so limits hold across serverless instances; otherwise an in-process
 * sliding window, which is enough for local dev and a single server.
 */
export const LIMITS = {
  chat: { requests: 30, windowSec: 60 },
  voice: { requests: 10, windowSec: 60 },
  tts: { requests: 20, windowSec: 60 },
  // Cheap, read-only endpoints still get a ceiling against scraping loops.
  route: { requests: 60, windowSec: 60 },
  recommend: { requests: 120, windowSec: 60 },
} as const;

export type LimitName = keyof typeof LIMITS;

export interface LimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  /** Unix ms when the window frees up a slot. */
  reset: number;
}

// ── Upstash ──────────────────────────────────────────────────────

let upstash: Partial<Record<LimitName, Ratelimit>> | null | undefined;

function upstashLimiter(name: LimitName): Ratelimit | null {
  if (upstash === undefined) {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    upstash = url && token ? {} : null;
    if (upstash) {
      const redis = new Redis({ url: url!, token: token! });
      for (const key of Object.keys(LIMITS) as LimitName[]) {
        const { requests, windowSec } = LIMITS[key];
        upstash[key] = new Ratelimit({
          redis,
          prefix: `qt:rl:${key}`,
          limiter: Ratelimit.slidingWindow(requests, `${windowSec} s`),
          analytics: false,
        });
      }
    }
  }
  return upstash?.[name] ?? null;
}

// ── in-memory fallback ───────────────────────────────────────────

const hits = new Map<string, number[]>();
const MAX_KEYS = 10_000;

function memoryLimit(name: LimitName, id: string, now: number): LimitResult {
  const { requests, windowSec } = LIMITS[name];
  const windowMs = windowSec * 1000;
  const key = `${name}:${id}`;
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  const success = recent.length < requests;
  if (success) recent.push(now);
  hits.delete(key); // re-insert to keep Map order ≈ least recently used
  hits.set(key, recent);
  if (hits.size > MAX_KEYS) hits.delete(hits.keys().next().value!);
  return {
    success,
    limit: requests,
    remaining: Math.max(0, requests - recent.length),
    reset: (recent[0] ?? now) + windowMs,
  };
}

/** Test helper. */
export function resetMemoryLimits() {
  hits.clear();
}

// ── public API ───────────────────────────────────────────────────

/** Best-effort client IP from the proxy headers Vercel and most hosts set. */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

export async function checkLimit(name: LimitName, request: Request, now = Date.now()): Promise<LimitResult> {
  if (process.env.RATE_LIMIT === "off") {
    return { success: true, limit: Infinity, remaining: Infinity, reset: now };
  }
  const id = clientIp(request);
  const limiter = upstashLimiter(name);
  if (limiter) {
    try {
      const r = await limiter.limit(id);
      return { success: r.success, limit: r.limit, remaining: r.remaining, reset: r.reset };
    } catch (err) {
      // Never take the app down because Redis is unreachable.
      console.warn("[rate-limit] upstash failed, using memory:", err);
    }
  }
  return memoryLimit(name, id, now);
}

/**
 * Returns a 429 response when the caller is over the limit, otherwise null.
 * Usage: `const limited = await rateLimited("chat", request); if (limited) return limited;`
 */
export async function rateLimited(name: LimitName, request: Request): Promise<Response | null> {
  const r = await checkLimit(name, request);
  if (r.success) return null;
  const retryAfter = Math.max(1, Math.ceil((r.reset - Date.now()) / 1000));
  return Response.json(
    { error: "Too many requests", code: "rate_limited", retry_after: retryAfter },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfter),
        "X-RateLimit-Limit": String(r.limit),
        "X-RateLimit-Remaining": "0",
      },
    },
  );
}
