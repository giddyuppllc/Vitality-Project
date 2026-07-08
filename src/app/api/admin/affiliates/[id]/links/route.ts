import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const createSchema = z.object({
  name: z.string().min(1).max(120),
  url: z.string().url(),
  /** Optional admin-chosen slug; otherwise generated from name. */
  slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/i).optional(),
})

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50)

/**
 * GET  /api/admin/affiliates/[id]/links — list links for an affiliate
 * POST /api/admin/affiliates/[id]/links — create one
 *
 * Generated trackable URL has the format:
 *   {APP_URL}/r/{affiliate.code}/{link.slug}
 * which is resolved by /r/[code]/[slug] (existing redirect route, if any
 * — otherwise lands at link.url with the affiliate cookie set).
 */

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params
  const links = await prisma.affiliateLink.findMany({
    where: { affiliateId: id },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({ links })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id: affiliateId } = await params
  let body: z.infer<typeof createSchema>
  try {
    body = createSchema.parse(await req.json())
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof z.ZodError ? e.issues : 'Invalid body' },
      { status: 400 },
    )
  }

  const affiliate = await prisma.affiliate.findUnique({
    where: { id: affiliateId },
    select: { id: true, code: true },
  })
  if (!affiliate) {
    return NextResponse.json({ error: 'Affiliate not found' }, { status: 404 })
  }

  // Slug must be globally unique on AffiliateLink. If admin-supplied slug
  // is taken or absent, derive from name + suffix until we find a free one.
  let slug = body.slug ? slugify(body.slug) : slugify(body.name)
  if (!slug) slug = `link-${Date.now().toString(36)}`
  let suffix = 0
  while (await prisma.affiliateLink.findUnique({ where: { slug } })) {
    suffix += 1
    slug = `${slugify(body.slug ?? body.name)}-${suffix}`
  }

  const link = await prisma.affiliateLink.create({
    data: { affiliateId, name: body.name, url: body.url, slug },
  })

  return NextResponse.json({ link, trackableUrl: `/r/${affiliate.code}/${link.slug}` }, { status: 201 })
}
