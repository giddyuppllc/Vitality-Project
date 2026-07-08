import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { parseSegmentFilters, quickCount, stringifySegmentFilters } from '@/lib/segments'
import { z } from 'zod'

const filtersSchema = z
  .object({
    minSpent: z.number().int().optional(),
    maxSpent: z.number().int().optional(),
    minOrders: z.number().int().optional(),
    maxOrders: z.number().int().optional(),
    tier: z.enum(['BRONZE', 'SILVER', 'GOLD', 'PLATINUM']).optional(),
    tagIds: z.array(z.string()).optional(),
    registeredDays: z.number().int().optional(),
    lastOrderDays: z.number().int().optional(),
    neverOrdered: z.boolean().optional(),
    state: z.string().optional(),
    role: z.enum(['CUSTOMER', 'AFFILIATE', 'ADMIN']).optional(),
    isAffiliate: z.boolean().optional(),
    hasOrgMembership: z.boolean().optional(),
    emailVerified: z.boolean().optional(),
  })
  .passthrough()

const createSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional().nullable(),
  filters: filtersSchema,
})

async function guard() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') return null
  return session
}

export const dynamic = 'force-dynamic'

export async function GET() {
  if (!(await guard())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const segments = await prisma.savedSegment.findMany({
    orderBy: { createdAt: 'desc' },
  })

  // Attach live match counts + creator email for display.
  const creatorIds = Array.from(new Set(segments.map((s) => s.createdBy)))
  const creators = await prisma.user.findMany({
    where: { id: { in: creatorIds } },
    select: { id: true, email: true, name: true },
  })
  const creatorMap = new Map(creators.map((c) => [c.id, c]))

  const withCounts = await Promise.all(
    segments.map(async (s) => {
      const filters = parseSegmentFilters(s.filters)
      let count = 0
      try {
        count = await quickCount(filters)
      } catch (err) {
        console.error('[segments] count failed', s.id, err)
      }
      return {
        id: s.id,
        name: s.name,
        description: s.description,
        filters,
        createdBy: s.createdBy,
        createdByEmail: creatorMap.get(s.createdBy)?.email ?? null,
        createdByName: creatorMap.get(s.createdBy)?.name ?? null,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        customerCount: count,
      }
    }),
  )

  return NextResponse.json(withCounts)
}

export async function POST(req: NextRequest) {
  const session = await guard()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const data = createSchema.parse(await req.json())
    const created = await prisma.savedSegment.create({
      data: {
        name: data.name,
        description: data.description ?? null,
        filters: stringifySegmentFilters(data.filters),
        createdBy: session.user.id,
      },
    })

    await logAudit({
      userId: session.user.id,
      userEmail: session.user.email,
      action: 'segment.create',
      entityType: 'SavedSegment',
      entityId: created.id,
      metadata: { name: created.name },
    })

    return NextResponse.json(created, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues }, { status: 400 })
    }
    console.error('[segments] create error', err)
    return NextResponse.json({ error: 'Failed to create segment' }, { status: 500 })
  }
}
