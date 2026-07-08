import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { slugify } from '@/lib/utils'
import { z } from 'zod'

const createSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
  contactName: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  addressLine1: z.string().min(1),
  addressLine2: z.string().optional().nullable(),
  city: z.string().min(1),
  state: z.string().min(1).default('FL'),
  zip: z.string().min(1),
  country: z.string().optional().default('US'),
  licenseNumber: z.string().optional().nullable(),
  apiEndpoint: z.string().optional().nullable(),
  apiKey: z.string().optional().nullable(),
  active: z.boolean().optional().default(true),
  slaHours: z.number().int().min(1).optional().default(48),
  notes: z.string().optional().nullable(),
})

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const facilities = await prisma.facility.findMany({
    orderBy: [{ active: 'desc' }, { name: 'asc' }],
    include: { _count: { select: { products: true, fulfillments: true } } },
  })
  return NextResponse.json(facilities)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const body = await req.json()
    const data = createSchema.parse(body)

    // Generate a unique slug
    const baseSlug = slugify(data.name)
    let slug = baseSlug
    let suffix = 1
    while (await prisma.facility.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${suffix++}`
    }

    const facility = await prisma.facility.create({
      data: {
        ...data,
        slug,
      },
    })

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        userEmail: session.user.email ?? null,
        action: 'facility.create',
        entityType: 'Facility',
        entityId: facility.id,
        metadata: JSON.stringify({ name: facility.name }),
      },
    })

    return NextResponse.json(facility, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    }
    console.error('Facility create error:', error)
    return NextResponse.json({ error: 'Failed to create facility' }, { status: 500 })
  }
}
