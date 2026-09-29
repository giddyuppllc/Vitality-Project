import type { MembershipTier, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import type { VipViewer } from './access'

/**
 * Read models for the community, shared by the server pages and the JSON
 * APIs so both apply the same visibility rules:
 *  - hidden posts/comments never reach members (admins see them flagged)
 *  - everything is behind requireVipPage/requireVipApi — these helpers do
 *    NOT check access themselves, callers must.
 */

export const FEED_PAGE_SIZE = 20

const authorSelect = {
  id: true,
  name: true,
  username: true,
  role: true,
  vipProfile: { select: { displayName: true, avatarUrl: true } },
  membership: { select: { tier: true, status: true } },
} satisfies Prisma.UserSelect

type AuthorRow = Prisma.UserGetPayload<{ select: typeof authorSelect }>

export interface AuthorView {
  id: string
  displayName: string
  username: string | null
  avatarUrl: string | null
  tier: MembershipTier
  isAdmin: boolean
}

export function toAuthor(a: AuthorRow): AuthorView {
  const tier: MembershipTier =
    a.membership && a.membership.status === 'ACTIVE' ? a.membership.tier : 'NONE'
  return {
    id: a.id,
    displayName: a.vipProfile?.displayName || a.name || a.username || 'Member',
    username: a.username,
    avatarUrl: a.vipProfile?.avatarUrl ?? null,
    tier,
    isAdmin: a.role === 'ADMIN',
  }
}

export interface PostView {
  id: string
  body: string
  imageUrl: string | null
  pinned: boolean
  isAnnouncement: boolean
  hidden: boolean
  editedAt: string | null
  createdAt: string
  space: { slug: string; name: string } | null
  author: AuthorView
  likeCount: number
  commentCount: number
  likedByMe: boolean
}

const postInclude = (viewerId: string) =>
  ({
    author: { select: authorSelect },
    space: { select: { slug: true, name: true } },
    reactions: { where: { userId: viewerId, kind: 'LIKE' }, select: { id: true } },
    _count: { select: { reactions: true, comments: { where: { hiddenAt: null } } } },
  }) satisfies Prisma.VipPostInclude

type PostRow = Prisma.VipPostGetPayload<{ include: ReturnType<typeof postInclude> }>

function toPost(p: PostRow): PostView {
  return {
    id: p.id,
    body: p.body,
    imageUrl: p.imageUrl,
    pinned: p.pinned,
    isAnnouncement: p.isAnnouncement,
    hidden: !!p.hiddenAt,
    editedAt: p.editedAt?.toISOString() ?? null,
    createdAt: p.createdAt.toISOString(),
    space: p.space,
    author: toAuthor(p.author),
    likeCount: p._count.reactions,
    commentCount: p._count.comments,
    likedByMe: p.reactions.length > 0,
  }
}

export async function listFeed(args: {
  viewer: VipViewer
  space?: string | null
  q?: string | null
  cursor?: string | null
}): Promise<{ pinned: PostView[]; posts: PostView[]; nextCursor: string | null }> {
  const q = args.q?.trim().slice(0, 100) || null
  const where: Prisma.VipPostWhereInput = { hiddenAt: null }
  if (args.space) where.space = { slug: args.space, archived: false }
  if (q) where.body = { contains: q, mode: 'insensitive' }

  const include = postInclude(args.viewer.userId)
  const pinned =
    !args.cursor && !q
      ? await prisma.vipPost.findMany({
          where: { ...where, pinned: true },
          include,
          orderBy: { createdAt: 'desc' },
          take: 5,
        })
      : []

  const rows = await prisma.vipPost.findMany({
    where: q ? where : { ...where, pinned: false },
    include,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: FEED_PAGE_SIZE + 1,
    ...(args.cursor ? { cursor: { id: args.cursor }, skip: 1 } : {}),
  })
  const hasMore = rows.length > FEED_PAGE_SIZE
  const page = rows.slice(0, FEED_PAGE_SIZE)
  return {
    pinned: pinned.map(toPost),
    posts: page.map(toPost),
    nextCursor: hasMore ? page[page.length - 1].id : null,
  }
}

export interface CommentView {
  id: string
  body: string
  parentId: string | null
  hidden: boolean
  createdAt: string
  editedAt: string | null
  author: AuthorView
  likeCount: number
  likedByMe: boolean
  replies: CommentView[]
}

export async function getThread(
  viewer: VipViewer,
  postId: string,
): Promise<{ post: PostView; comments: CommentView[] } | null> {
  const include = postInclude(viewer.userId)
  const post = await prisma.vipPost.findUnique({ where: { id: postId }, include })
  if (!post) return null
  if (post.hiddenAt && !viewer.isAdmin) return null

  const rows = await prisma.vipComment.findMany({
    where: { postId, ...(viewer.isAdmin ? {} : { hiddenAt: null }) },
    include: {
      author: { select: authorSelect },
      reactions: { where: { userId: viewer.userId, kind: 'LIKE' }, select: { id: true } },
      _count: { select: { reactions: true } },
    },
    orderBy: { createdAt: 'asc' },
    take: 500,
  })
  const views = new Map<string, CommentView>()
  for (const c of rows) {
    views.set(c.id, {
      id: c.id,
      body: c.body,
      parentId: c.parentId,
      hidden: !!c.hiddenAt,
      createdAt: c.createdAt.toISOString(),
      editedAt: c.editedAt?.toISOString() ?? null,
      author: toAuthor(c.author),
      likeCount: c._count.reactions,
      likedByMe: c.reactions.length > 0,
      replies: [],
    })
  }
  const top: CommentView[] = []
  for (const v of views.values()) {
    const parent = v.parentId ? views.get(v.parentId) : null
    if (parent) parent.replies.push(v)
    else if (!v.parentId) top.push(v)
  }
  return { post: toPost(post), comments: top }
}

export async function listSpaces() {
  return prisma.vipSpace.findMany({
    where: { archived: false },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: { id: true, slug: true, name: true, description: true, adminOnly: true },
  })
}

export { authorSelect }
