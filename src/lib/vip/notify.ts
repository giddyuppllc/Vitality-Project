import { prisma } from '@/lib/prisma'
import { extractMentions } from './text'

/**
 * In-app clubhouse notifications only — nothing here sends email or SMS.
 * Failures are swallowed: a notification must never fail the post/comment.
 */

type NotifyType = 'COMMENT' | 'REPLY' | 'MENTION'

interface Target {
  userId: string
  type: NotifyType
}

/** Users who can actually open the clubhouse (ACTIVE membership or admin). */
async function filterToMembers(userIds: string[]): Promise<Set<string>> {
  if (!userIds.length) return new Set()
  const rows = await prisma.user.findMany({
    where: {
      id: { in: userIds },
      OR: [
        { role: 'ADMIN' },
        { membership: { status: 'ACTIVE', tier: { not: 'NONE' } } },
      ],
    },
    select: { id: true },
  })
  return new Set(rows.map((r) => r.id))
}

export async function notifyForContent(args: {
  actorId: string
  body: string
  postId: string
  commentId?: string
  postAuthorId?: string // notify on a new comment on their post
  parentAuthorId?: string // notify on a reply to their comment
}): Promise<number> {
  try {
    const targets: Target[] = []
    if (args.parentAuthorId) targets.push({ userId: args.parentAuthorId, type: 'REPLY' })
    if (args.postAuthorId) targets.push({ userId: args.postAuthorId, type: 'COMMENT' })

    const usernames = extractMentions(args.body)
    if (usernames.length) {
      const mentioned = await prisma.user.findMany({
        where: { username: { in: usernames } },
        select: { id: true },
      })
      for (const m of mentioned) targets.push({ userId: m.id, type: 'MENTION' })
    }

    // One notification per recipient per action; never notify yourself.
    const seen = new Set<string>([args.actorId])
    const unique = targets.filter((t) => (seen.has(t.userId) ? false : (seen.add(t.userId), true)))
    const allowed = await filterToMembers(unique.map((t) => t.userId))
    const data = unique
      .filter((t) => allowed.has(t.userId))
      .map((t) => ({
        userId: t.userId,
        type: t.type,
        actorId: args.actorId,
        postId: args.postId,
        commentId: args.commentId ?? null,
      }))
    if (data.length) await prisma.vipNotification.createMany({ data })
    return data.length
  } catch (err) {
    console.error('[vip/notify] failed:', err)
    return 0
  }
}
