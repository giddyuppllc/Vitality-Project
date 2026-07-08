import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { parseSegmentFilters, stringifySegmentFilters } from '@/lib/segments'
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

const patchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(500).optional().nullable(),
  filters: filtersSchema.optional(),
})

async function guard() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') return null
  return session
}

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await guard())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params
  const seg = await prisma.savedSegment.findUnique({ where: { id } })
  if (!seg) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({
    ...seg,
    filters: parseSegmentFilters(seg.filters),
  })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await guard()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params
  try {
    const data = patchSchema.parse(await req.json())
    const update: Record<string, unknown> = {}
    if (data.name !== undefined) update.name = data.name
    if (data.description !== undefined) update.description = data.description
    if (data.filters !== undefined) {
      update.filters = stringifySegmentFilters(data.filters)
    }

    const updated = await prisma.savedSegment.update({
      where: { id },
      data: update,
    })

    await logAudit({
      userId: session.user.id,
      userEmail: session.user.email,
      action: 'segment.update',
      entityType: 'SavedSegment',
      entityId: id,
      metadata: { changes: Object.keys(data) },
    })

    return NextResponse.json(updated)
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues }, { status: 400 })
    }
    console.error('[segments] update error', err)
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await guard()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params
  try {
    await prisma.savedSegment.delete({ where: { id } })
    await logAudit({
      userId: session.user.id,
      userEmail: session.user.email,
      action: 'segment.delete',
      entityType: 'SavedSegment',
      entityId: id,
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[segments] delete error', err)
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
  }
}
