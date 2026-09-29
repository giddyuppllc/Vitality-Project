import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireVipApi, vipJson } from '@/lib/vip/access'
import { memberRateLimit } from '@/lib/vip/guard'
import { createAdminNotification } from '@/lib/notifications'

export const dynamic = 'force-dynamic'

const schema = z
  .object({
    postId: z.string().max(64).optional(),
    commentId: z.string().max(64).optional(),
    reason: z.string().trim().min(3).max(1000),
  })
  .refine((v) => !!v.postId !== !!v.commentId, 'Exactly one of postId / commentId')

/**
 * POST /api/vip/reports — flag a post or comment for the admin moderation
 * queue (/admin/vip). One report per member per item.
 */
export async function POST(req: NextRequest) {
  const gate = await requireVipApi('community')
  if (gate.response) return gate.response
  const { viewer } = gate

  const wait = memberRateLimit(req, 'report', viewer.userId)
  if (wait) return vipJson({ error: 'Too many reports. Try again later.', retryAfter: wait }, { status: 429 })

  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return vipJson({ error: 'Please say briefly what is wrong.' }, { status: 400 })
  const { postId, commentId, reason } = parsed.data

  const exists = postId
    ? await prisma.vipPost.findUnique({ where: { id: postId }, select: { id: true } })
    : await prisma.vipComment.findUnique({ where: { id: commentId! }, select: { id: true } })
  if (!exists) return vipJson({ error: 'Not found' }, { status: 404 })

  const already = await prisma.vipReport.findFirst({
    where: { reporterId: viewer.userId, ...(postId ? { postId } : { commentId }) },
    select: { id: true },
  })
  if (already) return vipJson({ ok: true, duplicate: true })

  const report = await prisma.vipReport.create({
    data: { reporterId: viewer.userId, postId: postId ?? null, commentId: commentId ?? null, reason },
    select: { id: true },
  })
  await createAdminNotification({
    type: 'SYSTEM',
    title: 'Clubhouse report',
    body: `A member reported a ${postId ? 'post' : 'comment'} in the clubhouse.`,
    link: '/admin/vip',
    entityType: 'VipReport',
    entityId: report.id,
  })
  return vipJson({ ok: true }, { status: 201 })
}
