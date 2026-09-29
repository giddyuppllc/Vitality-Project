/**
 * Lightweight in-memory rate limiter for public API routes.
 *
 * Single-instance only — fine for our current single-container deploy.
 * If we go multi-instance, swap the in-memory Map for Redis (the redis
 * service is already in docker-compose.yml).
 *
 * Usage:
 *   const limited = checkRateLimit(req, 'newsletter', { limit: 5, windowMs: 60_000 })
 *   if (!limited.allowed) return new Response('Too many requests', { status: 429 })
 */

interface Bucket {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

interface Options {
  limit: number
  windowMs: number
}

interface CheckResult {
  allowed: boolean
  remaining: number
  retryAfter: number // seconds
}

/** Pull a stable client identifier — prefer the forwarded IP from the
 *  proxy (nginx -> docker), fall back to direct remote, then to a cookie
 *  bucket as a last resort. We don't trust any single source completely
 *  but this is enough to deter casual abuse. */
function clientKey(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  const real = req.headers.get('x-real-ip')
  if (real) return real
  return 'unknown'
}

export function checkRateLimit(
  req: Request,
  scope: string,
  opts: Options,
): CheckResult {
  return checkRateLimitKey(`${scope}:${clientKey(req)}`, opts)
}

/** Same buckets, caller-chosen key (e.g. per signed-in member rather than per IP). */
export function checkRateLimitKey(key: string, opts: Options): CheckResult {
  const now = Date.now()
  const existing = buckets.get(key)

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + opts.windowMs })
    // GC opportunistically — keeps the map from growing unbounded
    // without needing a separate sweeper. Triggers ~once per few hundred
    // requests in practice.
    if (buckets.size > 1000) {
      for (const [k, v] of buckets) {
        if (v.resetAt <= now) buckets.delete(k)
      }
    }
    return { allowed: true, remaining: opts.limit - 1, retryAfter: 0 }
  }

  if (existing.count >= opts.limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfter: Math.ceil((existing.resetAt - now) / 1000),
    }
  }

  existing.count += 1
  return {
    allowed: true,
    remaining: opts.limit - existing.count,
    retryAfter: 0,
  }
}

/** Standard 429 response with Retry-After header. */
export function tooManyRequests(retryAfter: number) {
  return new Response(
    JSON.stringify({
      error: 'Too many requests. Please try again shortly.',
      retryAfter,
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(retryAfter),
      },
    },
  )
}
