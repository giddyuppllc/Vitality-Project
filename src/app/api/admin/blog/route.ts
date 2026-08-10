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

const createSchema = z.object({
  title: z.string().min(1).max(200),
  slug: z
    .string()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'lowercase words separated by hyphens'),
  excerpt: z.string().min(1),
  content: z.string().min(1),
  category: z.string().min(1).max(60).default('Research'),
  readTime: z.string().max(40).optional().nullable(),
  coverImage: z.string().url().optional().nullable().or(z.literal('')),
  relatedLinks: z.array(relatedLinkSchema).default([]),
  authorName: z.string().max(120).optional().nullable(),
  published: z.boolean().default(false),
})

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const posts = await prisma.post.findMany({
    orderBy: [{ createdAt: 'desc' }],
  })
  return NextResponse.json(posts)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const data = createSchema.parse(await req.json())
    const post = await prisma.post.create({
      data: {
        title: data.title,
        slug: data.slug,
        excerpt: data.excerpt,
        content: data.content,
        category: data.category,
        readTime: data.readTime || null,
        coverImage: data.coverImage || null,
        relatedLinks: data.relatedLinks,
        authorName: data.authorName || null,
        published: data.published,
        publishedAt: data.published ? new Date() : null,
      },
    })
    await logAudit({
      userId: session.user.id,
      userEmail: session.user.email,
      action: 'post.create',
      entityType: 'Post',
      entityId: post.id,
      metadata: { slug: post.slug, published: post.published },
    })
    return NextResponse.json(post, { status: 201 })
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      return NextResponse.json({ error: 'A post with that slug already exists.' }, { status: 409 })
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? 'Invalid data' }, { status: 400 })
    }
    console.error('Post create error:', error)
    return NextResponse.json({ error: 'Create failed' }, { status: 500 })
  }
}
