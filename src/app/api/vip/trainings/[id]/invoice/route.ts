import { NextRequest } from 'next/server'
import { checkRateLimitKey } from '@/lib/rate-limit'
import { requireVipApi, vipJson } from '@/lib/vip/access'
import { createTrainingInvoice, TrainingInvoiceError } from '@/lib/vip/training-invoice'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/**
 * POST /api/vip/trainings/:courseId/invoice — buy a training with money:
 * creates (or returns the open) Zelle invoice on vitalityproject.global,
 * tagged TRAINING:<courseId>:<userId>. Marking it paid opens the course.
 */
export async function POST(_req: NextRequest, { params }: Ctx) {
  const gate = await requireVipApi('member')
  if (gate.response) return gate.response
  const { id } = await params
  const v = gate.viewer
  const limit = checkRateLimitKey(`vip:invoice:${v.userId}`, { limit: 10, windowMs: 60 * 60_000 })
  if (!limit.allowed) return vipJson({ error: 'Too many requests. Try again later.', retryAfter: limit.retryAfter }, { status: 429 })
  try {
    const r = await createTrainingInvoice({ id: v.userId, email: v.email, name: v.name }, id)
    return vipJson({ ok: true, ...r }, { status: r.already || r.reused ? 200 : 201 })
  } catch (e) {
    if (e instanceof TrainingInvoiceError) return vipJson({ error: e.message }, { status: e.status })
    console.error('[vip/trainings/invoice]', e)
    return vipJson({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
