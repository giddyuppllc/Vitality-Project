import { prisma } from '@/lib/prisma'
import { checkRateLimitKey } from '@/lib/rate-limit'
import { countLinks } from './text'

/**
 * Community abuse guards: per-member rate limits (reusing lib/rate-limit's
 * in-memory buckets, keyed by member id rather than IP) and a basic spam
 * check. Limits are technical defaults, not business rules.
 */

export const LIMITS = {
  post: { limit: 5, windowMs: 10 * 60_000 },
  comment: { limit: 20, windowMs: 10 * 60_000 },
  reaction: { limit: 120, windowMs: 60_000 },
  report: { limit: 10, windowMs: 60 * 60_000 },
  upload: { limit: 10, windowMs: 60 * 60_000 },
  profile: { limit: 20, windowMs: 60 * 60_000 },
} as const

export const MAX_POST_CHARS = 5000
export const MAX_COMMENT_CHARS = 2000
export const MAX_LINKS = 5
const DUPLICATE_WINDOW_MS = 10 * 60_000

export type LimitKind = keyof typeof LIMITS

/**
 * Returns seconds to wait, or 0 if allowed. Keyed by MEMBER, not IP — a
 * member hopping networks (phone ↔ wifi) shares one bucket.
 */
export function memberRateLimit(_req: Request, kind: LimitKind, userId: string): number {
  const r = checkRateLimitKey(`vip:${kind}:${userId}`, LIMITS[kind])
  return r.allowed ? 0 : r.retryAfter
}

/**
 * Basic spam guard. Returns a user-facing reason string, or null if OK.
 *  - empty / over-length
 *  - more than MAX_LINKS links
 *  - the same member posting the identical text again within 10 minutes
 */
export async function spamCheck(args: {
  kind: 'post' | 'comment'
  userId: string
  body: string
}): Promise<string | null> {
  const body = args.body.trim()
  const max = args.kind === 'post' ? MAX_POST_CHARS : MAX_COMMENT_CHARS
  if (!body) return 'Write something first.'
  if (body.length > max) return `Keep it under ${max} characters.`
  if (countLinks(body) > MAX_LINKS) return `Please include at most ${MAX_LINKS} links.`
  const since = new Date(Date.now() - DUPLICATE_WINDOW_MS)
  const dup =
    args.kind === 'post'
      ? await prisma.vipPost.findFirst({
          where: { authorId: args.userId, body, createdAt: { gte: since } },
          select: { id: true },
        })
      : await prisma.vipComment.findFirst({
          where: { authorId: args.userId, body, createdAt: { gte: since } },
          select: { id: true },
        })
  if (dup) return 'That looks like a duplicate of something you just posted.'
  return null
}
