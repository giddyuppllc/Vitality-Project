import { NextRequest } from 'next/server'
import { z } from 'zod'
import { vipJson } from '@/lib/vip/access'
import { checkRateLimitKey } from '@/lib/rate-limit'

/**
 * Shared bits for the /api/vip/fitness/* routes: JSON body parsing with zod,
 * a generous per-member write limit (a busy gym session logs a set every
 * minute or two; this only stops runaway clients), and error mapping.
 */

export const unitsSchema = z.enum(['IMPERIAL', 'METRIC']).default('IMPERIAL')
export const num = (max: number) => z.number().finite().min(0).max(max).nullish()

/** A logged set as the member enters it (weight in their own units). */
export const setSchema = z.object({
  weight: num(2000),
  units: unitsSchema,
  reps: num(1000),
  durationSec: num(24 * 3600),
  rpe: z.number().min(1).max(10).nullish(),
})

export async function readBody<T extends z.ZodTypeAny>(req: NextRequest, schema: T): Promise<{ data: z.infer<T> } | { error: Response }> {
  const raw = await req.json().catch(() => null)
  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return { error: vipJson({ error: issue ? `${issue.path.join('.') || 'body'}: ${issue.message}` : 'Invalid request' }, { status: 400 }) }
  }
  return { data: parsed.data }
}

export function fitnessRateLimit(userId: string): Response | null {
  const r = checkRateLimitKey(`vip:fitness:${userId}`, { limit: 600, windowMs: 10 * 60_000 })
  return r.allowed ? null : vipJson({ error: 'Too many requests. Try again shortly.', retryAfter: r.retryAfter }, { status: 429 })
}

/** Known domain errors carry a status; anything else is a 500 that leaks nothing. */
export function fitnessError(err: unknown, where: string): Response {
  const e = err as { status?: number; message?: string; openId?: string }
  if (typeof e?.status === 'number' && e.status >= 400 && e.status < 500) {
    return vipJson({ error: e.message, ...(e.openId ? { openId: e.openId } : {}) }, { status: e.status })
  }
  console.error(`[vip/fitness/${where}]`, err)
  return vipJson({ error: 'Something went wrong. Please try again.' }, { status: 500 })
}
