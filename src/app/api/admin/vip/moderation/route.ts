import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAdminApi } from '@/lib/vip/access'
import { logAudit } from '@/lib/audit'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/vip/moderation — one endpoint for every moderation action:
 *   hide_post / restore_post / pin_post / unpin_post / announce_post / unannounce_post
 *   hide_comment / restore_comment
 *   resolve_report / dismiss_report
 *   suspend_member / unsuspend_member
 * Hide is reversible (nothing is deleted). Every action is audit-logged.
 */
const schema = z.discriminatedUnion('action', [
  z.object({
    action: z.enum(['hide_post', 'restore_post', 'pin_post', 'unpin_post', 'announce_post', 'unannounce_post']),
    postId: z.string().max(64),
    reason: z.string().trim().max(500).optional(),
  }),
  z.object({
    action: z.enum(['hide_comment', 'restore_comment']),
    commentId: z.string().max(64),
  }),
  z.object({
    action: z.enum(['resolve_report', 'dismiss_report']),
    reportId: z.string().max(64),
    resolution: z.string().trim().max(500).optional(),
  }),
  z.object({
    action: z.enum(['suspend_member', 'unsuspend_member']),
    userId: z.string().max(64),
    reason: z.string().trim().max(500).optional(),
  }),
])

export async function POST(req: NextRequest) {
  const gate = await requireAdminApi()
  if (gate.response) return gate.response
  const adminId = gate.userId
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 })
  const a = parsed.data
  const now = new Date()

  try {
    switch (a.action) {
      case 'hide_post':
        await prisma.vipPost.update({
          where: { id: a.postId },
          data: { hiddenAt: now, hiddenById: adminId, hiddenReason: a.reason || null, pinned: false },
        })
        break
      case 'restore_post':
        await prisma.vipPost.update({
          where: { id: a.postId },
          data: { hiddenAt: null, hiddenById: null, hiddenReason: null },
        })
        break
      case 'pin_post':
      case 'unpin_post':
        await prisma.vipPost.update({ where: { id: a.postId }, data: { pinned: a.action === 'pin_post' } })
        break
      case 'announce_post':
      case 'unannounce_post':
        await prisma.vipPost.update({
          where: { id: a.postId },
          data: { isAnnouncement: a.action === 'announce_post' },
        })
        break
      case 'hide_comment':
        await prisma.vipComment.update({ where: { id: a.commentId }, data: { hiddenAt: now, hiddenById: adminId } })
        break
      case 'restore_comment':
        await prisma.vipComment.update({ where: { id: a.commentId }, data: { hiddenAt: null, hiddenById: null } })
        break
      case 'resolve_report':
      case 'dismiss_report':
        await prisma.vipReport.update({
          where: { id: a.reportId },
          data: {
            status: a.action === 'resolve_report' ? 'RESOLVED' : 'DISMISSED',
            resolvedById: adminId,
            resolvedAt: now,
            resolution: a.resolution || null,
          },
        })
        break
      case 'suspend_member':
        await prisma.vipProfile.upsert({
          where: { userId: a.userId },
          update: { suspendedAt: now, suspendedReason: a.reason || null, suspendedById: adminId },
          create: { userId: a.userId, suspendedAt: now, suspendedReason: a.reason || null, suspendedById: adminId },
        })
        break
      case 'unsuspend_member':
        await prisma.vipProfile.updateMany({
          where: { userId: a.userId },
          data: { suspendedAt: null, suspendedReason: null, suspendedById: null },
        })
        break
    }
  } catch (err) {
    console.error('[admin/vip/moderation]', err)
    return NextResponse.json({ error: 'Not found or failed' }, { status: 404 })
  }

  await logAudit({
    userId: adminId,
    userEmail: null,
    action: `vip.moderation.${a.action}`,
    metadata: a,
  })
  return NextResponse.json({ ok: true })
}
