import { prisma } from '@/lib/prisma'
import { blockedIdSet } from './blocks'
import { extractMentions } from './text'

/**
 * In-app clubhouse notifications only — nothing here sends email or SMS
 * (the daily digest in lib/vip/mailer.ts reads these rows and honours each
 * member's email preferences). Failures are swallowed: a notification must
 * never fail the post/comment/follow/message that caused it.
 *
 * Nobody is notified about a member they blocked or who blocked them.
 */

type NotifyType = 'COMMENT' | 'REPLY' | 'MENTION'

interface Target {
  userId: string
  type: NotifyType
}

/** Users who can actually open the clubhouse community (ACTIVE membership or admin, not suspended). */
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
  /** Editing: @usernames already in the previous version (not notified again). */
  previousBody?: string
}): Promise<number> {
  try {
    const targets: Target[] = []
    if (args.parentAuthorId) targets.push({ userId: args.parentAuthorId, type: 'REPLY' })
    if (args.postAuthorId) targets.push({ userId: args.postAuthorId, type: 'COMMENT' })

    const before = new Set(args.previousBody ? extractMentions(args.previousBody) : [])
    const usernames = extractMentions(args.body).filter((u) => !before.has(u))
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
    const [allowed, blocked] = await Promise.all([
      filterToMembers(unique.map((t) => t.userId)),
      unique.length ? blockedIdSet(args.actorId) : Promise.resolve(new Set<string>()),
    ])
    const data = unique
      .filter((t) => allowed.has(t.userId) && !blocked.has(t.userId))
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

/** "X started following you" — at most one unread per follower. */
export async function notifyFollow(args: { actorId: string; userId: string }): Promise<boolean> {
  try {
    const dup = await prisma.vipNotification.findFirst({
      where: { userId: args.userId, type: 'FOLLOW', actorId: args.actorId, readAt: null },
      select: { id: true },
    })
    if (dup) return false
    await prisma.vipNotification.create({ data: { userId: args.userId, type: 'FOLLOW', actorId: args.actorId } })
    return true
  } catch (err) {
    console.error('[vip/notify] follow failed:', err)
    return false
  }
}

/**
 * "X sent you a message" — one unread notification per conversation per
 * recipient (a burst of messages is one line, not twenty). Reading the
 * conversation marks it read (lib/vip/messages.ts markRead).
 */
export async function notifyMessage(args: {
  actorId: string
  conversationId: string
  recipientIds: string[]
}): Promise<number> {
  try {
    const ids = args.recipientIds.filter((id) => id !== args.actorId)
    if (!ids.length) return 0
    const existing = await prisma.vipNotification.findMany({
      where: { userId: { in: ids }, type: 'MESSAGE', conversationId: args.conversationId, readAt: null },
      select: { userId: true },
    })
    const have = new Set(existing.map((e) => e.userId))
    const data = ids
      .filter((id) => !have.has(id))
      .map((userId) => ({ userId, type: 'MESSAGE', actorId: args.actorId, conversationId: args.conversationId }))
    if (data.length) await prisma.vipNotification.createMany({ data })
    return data.length
  } catch (err) {
    console.error('[vip/notify] message failed:', err)
    return 0
  }
}
