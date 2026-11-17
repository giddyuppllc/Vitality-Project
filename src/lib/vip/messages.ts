import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import type { VipViewer } from './access'
import { blockedIdSet, isBlockedBetween } from './blocks'
import { authorSelect, getPostView, toAuthor, type AuthorView, type PostView } from './feed'
import { MAX_LINKS, MAX_MESSAGE_CHARS } from './guard'
import { isVipMediaUrl } from './media'
import { memberWhere } from './members'
import { notifyMessage } from './notify'
import { countLinks } from './text'

/**
 * Direct messages: 1:1 conversations and small groups.
 *
 * Who may message whom (checked when a conversation starts, when a group is
 * created, and again on every 1:1 send):
 *   - both are members who can open the community (active, not suspended)
 *   - neither has blocked the other
 *   - the recipient's "who can message me" setting allows it:
 *       EVERYONE · FOLLOWING (only people the recipient follows) · NOBODY
 *
 * Only participants can read a conversation. The team cannot browse DMs:
 * the admin view (/admin/vip/conversations/[id]) opens a conversation only
 * after a participant has reported a message in it.
 *
 * Live updates are polling (no websocket infrastructure on the box): the
 * thread asks for messages after the newest one it has, the nav badge asks
 * for the unread count. Both are single indexed queries.
 */

export const MAX_GROUP_MEMBERS = 20 // including the creator
export const MESSAGE_PAGE = 50

type Fail = { ok: false; error: string; status: number }

export async function dmPermission(senderId: string, recipientId: string): Promise<{ ok: true } | Fail> {
  if (senderId === recipientId) return { ok: false, error: 'You can’t message yourself.', status: 400 }
  const recipient = await prisma.user.findFirst({
    where: { AND: [memberWhere, { id: recipientId }] },
    select: { id: true, vipProfile: { select: { dmPolicy: true } } },
  })
  if (!recipient) return { ok: false, error: 'That member isn’t available to message.', status: 404 }
  if (await isBlockedBetween(senderId, recipientId)) {
    return { ok: false, error: 'That member isn’t available to message.', status: 403 }
  }
  const policy = recipient.vipProfile?.dmPolicy
  if (policy === 'NOBODY') return { ok: false, error: 'This member has turned off direct messages.', status: 403 }
  if (policy === 'FOLLOWING') {
    const follows = await prisma.vipFollow.count({ where: { followerId: recipientId, followingId: senderId } })
    if (!follows) return { ok: false, error: 'This member only takes messages from people they follow.', status: 403 }
  }
  return { ok: true }
}

const directKey = (a: string, b: string) => [a, b].sort().join(':')

/** Open (or reuse) the one 1:1 conversation between the viewer and a member. */
export async function startDirect(viewer: VipViewer, recipientId: string): Promise<{ ok: true; id: string } | Fail> {
  const key = directKey(viewer.userId, recipientId)
  const existing = await prisma.vipConversation.findUnique({ where: { directKey: key }, select: { id: true } })
  // A 1:1 that already exists opens for its participants even when the other
  // side later turned DMs off — reading history is fine; sending re-checks.
  if (existing) {
    if (await isBlockedBetween(viewer.userId, recipientId)) {
      return { ok: false, error: 'That member isn’t available to message.', status: 403 }
    }
    await prisma.vipConversationParticipant.updateMany({
      where: { conversationId: existing.id, userId: viewer.userId },
      data: { leftAt: null },
    })
    return { ok: true, id: existing.id }
  }
  const perm = await dmPermission(viewer.userId, recipientId)
  if (!perm.ok) return perm
  try {
    const conv = await prisma.vipConversation.create({
      data: {
        directKey: key,
        createdById: viewer.userId,
        participants: { create: [{ userId: viewer.userId, lastReadAt: new Date() }, { userId: recipientId }] },
      },
      select: { id: true },
    })
    return { ok: true, id: conv.id }
  } catch {
    // Both sides opened it at the same moment: the unique key holds one row.
    const again = await prisma.vipConversation.findUnique({ where: { directKey: key }, select: { id: true } })
    if (again) return { ok: true, id: again.id }
    throw new Error('Could not open the conversation')
  }
}

export async function createGroup(
  viewer: VipViewer,
  memberIds: string[],
  title: string | null,
): Promise<{ ok: true; id: string } | Fail> {
  const others = [...new Set(memberIds.filter((id) => id !== viewer.userId))]
  if (others.length < 2) return { ok: false, error: 'A group needs at least two other members.', status: 400 }
  if (others.length + 1 > MAX_GROUP_MEMBERS) {
    return { ok: false, error: `Groups hold up to ${MAX_GROUP_MEMBERS} people.`, status: 400 }
  }
  for (const id of others) {
    const perm = await dmPermission(viewer.userId, id)
    if (!perm.ok) {
      const u = await prisma.user.findUnique({ where: { id }, select: { name: true, username: true, vipProfile: { select: { displayName: true } } } })
      const name = u?.vipProfile?.displayName || u?.name || u?.username || 'One member'
      return { ok: false, error: `${name} can’t be added: ${perm.error}`, status: perm.status }
    }
  }
  const now = new Date()
  const conv = await prisma.vipConversation.create({
    data: {
      isGroup: true,
      title: title?.trim().slice(0, 80) || null,
      createdById: viewer.userId,
      participants: { create: [{ userId: viewer.userId, lastReadAt: now }, ...others.map((userId) => ({ userId }))] },
    },
    select: { id: true },
  })
  return { ok: true, id: conv.id }
}

/** The viewer's active participation, or null (not a participant / left). */
export async function getParticipation(viewer: VipViewer, conversationId: string) {
  return prisma.vipConversationParticipant.findFirst({
    where: { conversationId, userId: viewer.userId, leftAt: null },
    select: { id: true, joinedAt: true, lastReadAt: true },
  })
}

// ─── Read models ────────────────────────────────────────────────────────────

export interface ParticipantView extends AuthorView {
  lastReadAt: string | null
  /** Blocked either way with the viewer (their messages are hidden). */
  blocked: boolean
}

export interface ConversationSummary {
  id: string
  isGroup: boolean
  title: string
  others: ParticipantView[]
  lastMessage: { preview: string; mine: boolean; createdAt: string } | null
  unread: number
  lastMessageAt: string
}

export interface SharedPostView {
  id: string
  available: boolean
  post: PostView | null
}

export interface MessageView {
  id: string
  senderId: string
  body: string
  imageUrl: string | null
  sharedPost: SharedPostView | null
  createdAt: string
}

export function conversationTitle(isGroup: boolean, title: string | null, others: { displayName: string }[]): string {
  if (title) return title
  if (!others.length) return isGroup ? 'Group' : 'Conversation'
  if (!isGroup) return others[0].displayName
  const names = others.slice(0, 3).map((o) => o.displayName.split(/\s+/)[0])
  return others.length > 3 ? `${names.join(', ')} +${others.length - 3}` : names.join(', ')
}

function preview(m: { body: string; imageUrl: string | null; sharedPostId: string | null }): string {
  const text = m.body.trim().replace(/\s+/g, ' ')
  if (text) return text.length > 90 ? `${text.slice(0, 90)}…` : text
  if (m.imageUrl) return 'Sent a photo'
  if (m.sharedPostId) return 'Shared a post'
  return ''
}

/**
 * Unread messages per conversation for a member: messages from other people
 * (not blocked) after the member's read receipt (or after they joined).
 */
async function unreadByConversation(
  userId: string,
  parts: { conversationId: string; lastReadAt: Date | null; joinedAt: Date }[],
  hidden: Set<string>,
): Promise<Map<string, number>> {
  if (!parts.length) return new Map()
  const rows = await prisma.vipMessage.groupBy({
    by: ['conversationId'],
    where: {
      senderId: { notIn: [userId, ...hidden] },
      OR: parts.map((p) => ({ conversationId: p.conversationId, createdAt: { gt: p.lastReadAt ?? p.joinedAt } })),
    },
    _count: { _all: true },
  })
  return new Map(rows.map((r) => [r.conversationId, r._count._all]))
}

/** Conversations with unread messages (the nav badge). */
export async function unreadConversationCount(userId: string): Promise<number> {
  const [parts, hidden] = await Promise.all([
    prisma.vipConversationParticipant.findMany({
      where: { userId, leftAt: null },
      select: { conversationId: true, lastReadAt: true, joinedAt: true },
    }),
    blockedIdSet(userId),
  ])
  const map = await unreadByConversation(userId, parts, hidden)
  return [...map.values()].filter((n) => n > 0).length
}

const participantInclude = {
  where: { leftAt: null },
  select: { userId: true, lastReadAt: true, user: { select: authorSelect } },
} satisfies Prisma.VipConversation$participantsArgs

export async function listConversations(viewer: VipViewer): Promise<ConversationSummary[]> {
  const hidden = await blockedIdSet(viewer.userId)
  const parts = await prisma.vipConversationParticipant.findMany({
    where: { userId: viewer.userId, leftAt: null },
    select: {
      conversationId: true,
      lastReadAt: true,
      joinedAt: true,
      conversation: {
        select: {
          id: true,
          isGroup: true,
          title: true,
          createdById: true,
          lastMessageAt: true,
          participants: participantInclude,
          messages: {
            where: hidden.size ? { senderId: { notIn: [...hidden] } } : {},
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { body: true, imageUrl: true, sharedPostId: true, senderId: true, createdAt: true },
          },
        },
      },
    },
    orderBy: { conversation: { lastMessageAt: 'desc' } },
    take: 100,
  })
  const unread = await unreadByConversation(viewer.userId, parts, hidden)
  const out: ConversationSummary[] = []
  for (const p of parts) {
    const c = p.conversation
    const last = c.messages[0]
    // A 1:1 someone else opened but never wrote in is not shown to the recipient.
    if (!last && c.createdById !== viewer.userId) continue
    const others = c.participants
      .filter((x) => x.userId !== viewer.userId)
      .map((x) => ({ ...toAuthor(x.user), lastReadAt: x.lastReadAt?.toISOString() ?? null, blocked: hidden.has(x.userId) }))
    // A 1:1 with someone blocked either way disappears from the list.
    if (!c.isGroup && others.some((o) => o.blocked)) continue
    out.push({
      id: c.id,
      isGroup: c.isGroup,
      title: conversationTitle(c.isGroup, c.title, others.filter((o) => !o.blocked)),
      others,
      lastMessage: last
        ? { preview: preview(last), mine: last.senderId === viewer.userId, createdAt: last.createdAt.toISOString() }
        : null,
      unread: unread.get(c.id) ?? 0,
      lastMessageAt: c.lastMessageAt.toISOString(),
    })
  }
  return out
}

export interface ConversationDetail {
  id: string
  isGroup: boolean
  title: string
  customTitle: string | null
  others: ParticipantView[]
  /** 1:1 only: why the viewer can't send right now, or null. */
  cannotSend: string | null
}

/** Conversation header data — null unless the viewer is an active participant. */
export async function getConversation(viewer: VipViewer, id: string): Promise<ConversationDetail | null> {
  const me = await getParticipation(viewer, id)
  if (!me) return null
  const c = await prisma.vipConversation.findUnique({
    where: { id },
    select: { id: true, isGroup: true, title: true, participants: participantInclude },
  })
  if (!c) return null
  const hidden = await blockedIdSet(viewer.userId)
  const others = c.participants
    .filter((x) => x.userId !== viewer.userId)
    .map((x) => ({ ...toAuthor(x.user), lastReadAt: x.lastReadAt?.toISOString() ?? null, blocked: hidden.has(x.userId) }))
  if (!c.isGroup && others.some((o) => o.blocked)) return null
  let cannotSend: string | null = null
  if (!c.isGroup && others[0]) {
    const perm = await dmPermission(viewer.userId, others[0].id)
    if (!perm.ok) cannotSend = perm.error
  } else if (!c.isGroup) {
    cannotSend = 'This conversation has ended.'
  }
  return {
    id: c.id,
    isGroup: c.isGroup,
    title: conversationTitle(c.isGroup, c.title, others.filter((o) => !o.blocked)),
    customTitle: c.title,
    others,
    cannotSend,
  }
}

async function toMessageViews(
  viewer: VipViewer,
  rows: { id: string; senderId: string; body: string; imageUrl: string | null; sharedPostId: string | null; createdAt: Date }[],
): Promise<MessageView[]> {
  const shared = new Map<string, PostView | null>()
  for (const r of rows) {
    if (r.sharedPostId && !shared.has(r.sharedPostId)) shared.set(r.sharedPostId, await getPostView(viewer, r.sharedPostId))
  }
  return rows.map((r) => ({
    id: r.id,
    senderId: r.senderId,
    body: r.body,
    imageUrl: r.imageUrl,
    sharedPost: r.sharedPostId
      ? { id: r.sharedPostId, available: !!shared.get(r.sharedPostId), post: shared.get(r.sharedPostId) ?? null }
      : null,
    createdAt: r.createdAt.toISOString(),
  }))
}

const messageSelect = { id: true, senderId: true, body: true, imageUrl: true, sharedPostId: true, createdAt: true } as const

/**
 * Messages, oldest → newest. `after` (ISO time of the newest message the
 * client has) returns only newer ones (inclusive of that instant — the
 * client de-duplicates by id); `before` (a message id) pages back in time.
 */
export async function listMessages(
  viewer: VipViewer,
  conversationId: string,
  opts: { after?: string | null; before?: string | null } = {},
): Promise<{ messages: MessageView[]; hasOlder: boolean } | null> {
  const me = await getParticipation(viewer, conversationId)
  if (!me) return null
  const hidden = await blockedIdSet(viewer.userId)
  const base: Prisma.VipMessageWhereInput = {
    conversationId,
    ...(hidden.size ? { senderId: { notIn: [...hidden] } } : {}),
  }
  const after = opts.after ? new Date(opts.after) : null
  if (after && !Number.isNaN(after.getTime())) {
    const rows = await prisma.vipMessage.findMany({
      where: { ...base, createdAt: { gte: after } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: 200,
      select: messageSelect,
    })
    return { messages: await toMessageViews(viewer, rows), hasOlder: false }
  }
  let beforeAt: Date | null = null
  if (opts.before) {
    const b = await prisma.vipMessage.findFirst({ where: { id: opts.before, conversationId }, select: { createdAt: true } })
    beforeAt = b?.createdAt ?? null
  }
  const rows = await prisma.vipMessage.findMany({
    where: { ...base, ...(beforeAt ? { createdAt: { lt: beforeAt } } : {}) },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: MESSAGE_PAGE + 1,
    select: messageSelect,
  })
  const hasOlder = rows.length > MESSAGE_PAGE
  return { messages: await toMessageViews(viewer, rows.slice(0, MESSAGE_PAGE).reverse()), hasOlder }
}

export async function sendMessage(
  viewer: VipViewer,
  conversationId: string,
  input: { body: string; imageUrl?: string | null; sharedPostId?: string | null },
): Promise<{ ok: true; message: MessageView } | Fail> {
  const me = await getParticipation(viewer, conversationId)
  if (!me) return { ok: false, error: 'Not found', status: 404 }
  const body = input.body.trim()
  const imageUrl = input.imageUrl || null
  const sharedPostId = input.sharedPostId || null
  if (!body && !imageUrl && !sharedPostId) return { ok: false, error: 'Write something first.', status: 400 }
  if (body.length > MAX_MESSAGE_CHARS) return { ok: false, error: `Keep it under ${MAX_MESSAGE_CHARS} characters.`, status: 400 }
  if (countLinks(body) > MAX_LINKS) return { ok: false, error: `Please include at most ${MAX_LINKS} links.`, status: 422 }
  if (imageUrl && !isVipMediaUrl(imageUrl)) {
    return { ok: false, error: 'Images must be uploaded through the clubhouse.', status: 400 }
  }
  if (sharedPostId && !(await getPostView(viewer, sharedPostId))) {
    return { ok: false, error: 'That post isn’t available to share.', status: 404 }
  }

  const conv = await prisma.vipConversation.findUnique({
    where: { id: conversationId },
    select: { isGroup: true, participants: { where: { leftAt: null }, select: { userId: true } } },
  })
  if (!conv) return { ok: false, error: 'Not found', status: 404 }
  const others = conv.participants.map((p) => p.userId).filter((id) => id !== viewer.userId)
  if (!conv.isGroup) {
    if (!others[0]) return { ok: false, error: 'This conversation has ended.', status: 403 }
    // Blocked either way: the 1:1 no longer exists for either side.
    if (await isBlockedBetween(viewer.userId, others[0])) return { ok: false, error: 'Not found', status: 404 }
    const perm = await dmPermission(viewer.userId, others[0])
    if (!perm.ok) return perm
  }

  const now = new Date()
  const [msg] = await prisma.$transaction([
    prisma.vipMessage.create({
      data: { conversationId, senderId: viewer.userId, body, imageUrl, sharedPostId },
      select: messageSelect,
    }),
    prisma.vipConversation.update({ where: { id: conversationId }, data: { lastMessageAt: now } }),
    prisma.vipConversationParticipant.update({ where: { id: me.id }, data: { lastReadAt: now } }),
  ])

  // Notify the others who can open the community and aren't blocked with the sender.
  const hidden = await blockedIdSet(viewer.userId)
  const reachable = await prisma.user.findMany({
    where: { AND: [memberWhere, { id: { in: others.filter((id) => !hidden.has(id)) } }] },
    select: { id: true },
  })
  await notifyMessage({ actorId: viewer.userId, conversationId, recipientIds: reachable.map((r) => r.id) })

  const [view] = await toMessageViews(viewer, [msg])
  return { ok: true, message: view }
}

/** Read receipt: everything up to now is seen; the conversation's notification is read. */
export async function markRead(viewer: VipViewer, conversationId: string): Promise<boolean> {
  const me = await getParticipation(viewer, conversationId)
  if (!me) return false
  const now = new Date()
  await prisma.vipConversationParticipant.update({ where: { id: me.id }, data: { lastReadAt: now } })
  await prisma.vipNotification.updateMany({
    where: { userId: viewer.userId, type: 'MESSAGE', conversationId, readAt: null },
    data: { readAt: now },
  })
  return true
}

export async function leaveGroup(viewer: VipViewer, conversationId: string): Promise<{ ok: true } | Fail> {
  const me = await getParticipation(viewer, conversationId)
  if (!me) return { ok: false, error: 'Not found', status: 404 }
  const conv = await prisma.vipConversation.findUnique({ where: { id: conversationId }, select: { isGroup: true } })
  if (!conv?.isGroup) return { ok: false, error: 'Only group conversations can be left.', status: 400 }
  await prisma.vipConversationParticipant.update({ where: { id: me.id }, data: { leftAt: new Date() } })
  return { ok: true }
}

export async function renameGroup(viewer: VipViewer, conversationId: string, title: string | null): Promise<{ ok: true } | Fail> {
  const me = await getParticipation(viewer, conversationId)
  if (!me) return { ok: false, error: 'Not found', status: 404 }
  const conv = await prisma.vipConversation.findUnique({ where: { id: conversationId }, select: { isGroup: true } })
  if (!conv?.isGroup) return { ok: false, error: 'Only group conversations have a name.', status: 400 }
  await prisma.vipConversation.update({ where: { id: conversationId }, data: { title: title?.trim().slice(0, 80) || null } })
  return { ok: true }
}

/** The 1:1 partner's id for a conversation, if it is a 1:1 the viewer is in. */
export async function directPartner(viewer: VipViewer, conversationId: string): Promise<string | null> {
  const c = await prisma.vipConversation.findUnique({
    where: { id: conversationId },
    select: { isGroup: true, participants: { select: { userId: true } } },
  })
  if (!c || c.isGroup) return null
  return c.participants.find((p) => p.userId !== viewer.userId)?.userId ?? null
}

/** Recent 1:1 / group conversations for the "share to a message" picker. */
export async function recentConversations(viewer: VipViewer, take = 8): Promise<ConversationSummary[]> {
  return (await listConversations(viewer)).slice(0, take)
}
