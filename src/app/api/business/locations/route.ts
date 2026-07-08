import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { slugify } from '@/lib/utils'

async function getOrgMembership(userId: string) {
  return prisma.orgMember.findFirst({
    where: { userId, role: { in: ['OWNER', 'ADMIN'] } },
    include: { organization: true },
  })
}

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const membership = await getOrgMembership(session.user.id)
  if (!membership) {
    return NextResponse.json({ error: 'No organization found' }, { status: 403 })
  }

  const locations = await prisma.location.findMany({
    where: { organizationId: membership.organizationId },
    include: {
      _count: { select: { devices: true, orders: true } },
    },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json(locations)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const membership = await getOrgMembership(session.user.id)
  if (!membership) {
    return NextResponse.json({ error: 'No organization found' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { name, addressLine1, addressLine2, city, state, zip, phone } = body

    if (!name) {
      return NextResponse.json({ error: 'Location name is required' }, { status: 400 })
    }

    // Generate unique slug within the org
    let slug = slugify(name)
    const existing = await prisma.location.findUnique({
      where: {
        organizationId_slug: {
          organizationId: membership.organizationId,
          slug,
        },
      },
    })
    if (existing) {
      slug = `${slug}-${Date.now().toString(36)}`
    }

    const location = await prisma.location.create({
      data: {
        organizationId: membership.organizationId,
        name,
        slug,
        addressLine1: addressLine1 || null,
        addressLine2: addressLine2 || null,
        city: city || null,
        state: state || null,
        zip: zip || null,
        phone: phone || null,
        commissionRate: 0.10, // Default 10%
      },
    })

    return NextResponse.json(location, { status: 201 })
  } catch (error) {
    console.error('Create location error:', error)
    return NextResponse.json({ error: 'Failed to create location' }, { status: 500 })
  }
}
