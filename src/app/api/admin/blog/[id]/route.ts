import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const relatedLinkSchema = z.object({
  href: z.string().min(1),
  label: z.string().min(1),
})

const updateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  slug: z
    .string()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'lowercase words separated by hyphens')
    .optional(),
  excerpt: z.string().min(1).optional(),
  content: z.string().min(1).optional(),
  category: z.string().min(1).max(60).optional(),
  readTime: z.string().max(40).optional().nullable(),
  coverImage: z.string().url().optional().nullable().or(z.literal('')),
  relatedLinks: z.array(relatedLinkSchema).optional(),
  authorName: z.string().max(120).optional().nullable(),
  published: z.boolean().optional(),
})

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const post = await prisma.post.findUnique({ where: { id } })
  if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(post)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const data = updateSchema.parse(await req.json())
    const prev = await prisma.post.findUnique({ where: { id }, select: { published: true } })
    if (!prev) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Stamp publishedAt on the first false→true transition; clear on unpublish.
    let publishedAt: Date | null | undefined
    if (data.published === true && !prev.published) publishedAt = new Date()
    else if (data.published === false) publishedAt = null

    const post = await prisma.post.update({
      where: { id },
      data: {
        ...data,
        readTime: data.readTime === undefined ? undefined : data.readTime || null,
        coverImage: data.coverImage === undefined ? undefined : data.coverImage || null,
        authorName: data.authorName === undefined ? undefined : data.authorName || null,
        ...(publishedAt !== undefined ? { publishedAt } : {}),
      },
    })
    await logAudit({
      userId: session.user.id,
      userEmail: session.user.email,
      action: 'post.update',
      entityType: 'Post',
      entityId: id,
      metadata: data,
    })
    return NextResponse.json(post)
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      return NextResponse.json({ error: 'A post with that slug already exists.' }, { status: 409 })
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? 'Invalid data' }, { status: 400 })
    }
    console.error('Post update error:', error)
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const existing = await prisma.post.findUnique({ where: { id }, select: { id: true } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  await prisma.post.delete({ where: { id } })
  await logAudit({
    userId: session.user.id,
    userEmail: session.user.email,
    action: 'post.delete',
    entityType: 'Post',
    entityId: id,
  })
  return NextResponse.json({ ok: true })
}
