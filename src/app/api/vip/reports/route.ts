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
    messageId: z.string().max(64).optional(),
    reason: z.string().trim().min(3).max(1000),
  })
  .refine((v) => [v.postId, v.commentId, v.messageId].filter(Boolean).length === 1, 'Exactly one of postId / commentId / messageId')

/**
 * POST /api/vip/reports — flag a post, comment or direct message for the
 * admin moderation queue (/admin/vip). One report per member per item. A
 * message can only be reported by someone in its conversation (not its
 * sender); reporting it lets the team open that one conversation.
 */
export async function POST(req: NextRequest) {
  const gate = await requireVipApi('community')
  if (gate.response) return gate.response
  const { viewer } = gate

  const wait = memberRateLimit(req, 'report', viewer.userId)
  if (wait) return vipJson({ error: 'Too many reports. Try again later.', retryAfter: wait }, { status: 429 })

  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return vipJson({ error: 'Please say briefly what is wrong.' }, { status: 400 })
  const { postId, commentId, messageId, reason } = parsed.data

  let conversationId: string | null = null
  if (messageId) {
    const msg = await prisma.vipMessage.findUnique({
      where: { id: messageId },
      select: { senderId: true, conversationId: true },
    })
    const member = msg
      ? await prisma.vipConversationParticipant.findFirst({
          where: { conversationId: msg.conversationId, userId: viewer.userId, leftAt: null },
          select: { id: true },
        })
      : null
    if (!msg || !member) return vipJson({ error: 'Not found' }, { status: 404 })
    if (msg.senderId === viewer.userId) return vipJson({ error: 'You can’t report your own message.' }, { status: 400 })
    conversationId = msg.conversationId
  } else {
    const exists = postId
      ? await prisma.vipPost.findUnique({ where: { id: postId }, select: { id: true } })
      : await prisma.vipComment.findUnique({ where: { id: commentId! }, select: { id: true } })
    if (!exists) return vipJson({ error: 'Not found' }, { status: 404 })
  }

  const already = await prisma.vipReport.findFirst({
    where: {
      reporterId: viewer.userId,
      ...(postId ? { postId } : commentId ? { commentId } : { messageId }),
    },
    select: { id: true },
  })
  if (already) return vipJson({ ok: true, duplicate: true })

  const report = await prisma.vipReport.create({
    data: {
      reporterId: viewer.userId,
      postId: postId ?? null,
      commentId: commentId ?? null,
      messageId: messageId ?? null,
      conversationId,
      reason,
    },
    select: { id: true },
  })
  const kind = postId ? 'post' : commentId ? 'comment' : 'direct message'
  await createAdminNotification({
    type: 'SYSTEM',
    title: 'Clubhouse report',
    body: `A member reported a ${kind} in the clubhouse.`,
    link: '/admin/vip',
    entityType: 'VipReport',
    entityId: report.id,
  })
  return vipJson({ ok: true }, { status: 201 })
}
