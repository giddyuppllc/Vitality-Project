import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { checkRateLimitKey } from '@/lib/rate-limit'
import { vipJson } from './access'
import { RewardsError } from './rewards-errors'
import { requireStaffFor, type StaffContext } from './partners'

/** RewardsError → its status + {error, code}; anything else → 500 (logged). */
export function rewardsErrorResponse(e: unknown, admin = false) {
  if (e instanceof RewardsError) {
    const body = { error: e.message, code: e.code }
    return admin ? NextResponse.json(body, { status: e.status }) : vipJson(body, { status: e.status })
  }
  console.error('[vip rewards api]', e)
  const body = { error: 'Something went wrong. Please try again.' }
  return admin ? NextResponse.json(body, { status: 500 }) : vipJson(body, { status: 500 })
}

/** Seconds to wait, or 0 — per user and action. */
export function userRateLimit(kind: string, userId: string, limit: number, windowMs: number): number {
  const r = checkRateLimitKey(`vip-rewards:${kind}:${userId}`, { limit, windowMs })
  return r.allowed ? 0 : r.retryAfter
}

/**
 * Partner portal gate (/api/vip/partner-portal/*). Signed in + active staff of
 * the partner named in the request (or their only partner). Staff need not be
 * clubhouse members.
 */
export async function requirePartnerStaffApi(
  partnerId: string | null | undefined,
): Promise<{ staff: StaffContext; response?: undefined } | { staff?: undefined; response: NextResponse }> {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id
  if (!userId) return { response: vipJson({ error: 'unauthenticated' }, { status: 401 }) }
  try {
    return { staff: await requireStaffFor(userId, partnerId) }
  } catch (e) {
    if (e instanceof RewardsError) return { response: vipJson({ error: e.message, code: e.code }, { status: e.status }) }
    throw e
  }
}
