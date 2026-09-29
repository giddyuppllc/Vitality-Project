import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireVipApi, vipJson } from '@/lib/vip/access'
import { getThread } from '@/lib/vip/feed'
import { MAX_POST_CHARS, spamCheck } from '@/lib/vip/guard'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/** GET /api/vip/posts/:id — a post and its (one-level) comment thread. */
export async function GET(_req: NextRequest, { params }: Ctx) {
  const gate = await requireVipApi('community')
  if (gate.response) return gate.response
  const { id } = await params
  const thread = await getThread(gate.viewer, id)
  if (!thread) return vipJson({ error: 'Not found' }, { status: 404 })
  return vipJson(thread)
}

const editSchema = z.object({ body: z.string().max(MAX_POST_CHARS) })

/** PATCH /api/vip/posts/:id — the author edits their own post. */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const gate = await requireVipApi('community')
  if (gate.response) return gate.response
  const { id } = await params
  const post = await prisma.vipPost.findUnique({ where: { id }, select: { authorId: true, hiddenAt: true } })
  if (!post || post.hiddenAt) return vipJson({ error: 'Not found' }, { status: 404 })
  if (post.authorId !== gate.viewer.userId) return vipJson({ error: 'Forbidden' }, { status: 403 })

  const parsed = editSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return vipJson({ error: 'Invalid post' }, { status: 400 })
  const body = parsed.data.body.trim()
  const spam = await spamCheck({ kind: 'post', userId: gate.viewer.userId, body })
  if (spam) return vipJson({ error: spam }, { status: 422 })
  await prisma.vipPost.update({ where: { id }, data: { body, editedAt: new Date() } })
  return vipJson({ ok: true })
}

/** DELETE /api/vip/posts/:id — the author removes their own post. */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const gate = await requireVipApi('community')
  if (gate.response) return gate.response
  const { id } = await params
  const post = await prisma.vipPost.findUnique({ where: { id }, select: { authorId: true } })
  if (!post) return vipJson({ error: 'Not found' }, { status: 404 })
  if (post.authorId !== gate.viewer.userId) return vipJson({ error: 'Forbidden' }, { status: 403 })
  await prisma.vipPost.delete({ where: { id } })
  return vipJson({ ok: true })
}
