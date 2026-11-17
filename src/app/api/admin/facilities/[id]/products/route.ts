import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { logAudit } from '@/lib/audit'

const assignSchema = z.object({
  productId: z.string().min(1),
  primary: z.boolean().optional(),
  cost: z.number().int().nullable().optional(),
  inventory: z.number().int().min(0).optional(),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: facilityId } = await params
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const data = assignSchema.parse(body)

    // If setting primary, clear any other primary for this product first
    if (data.primary === true) {
      await prisma.productFacility.updateMany({
        where: { productId: data.productId, facilityId: { not: facilityId } },
        data: { primary: false },
      })
    }

    const pf = await prisma.productFacility.upsert({
      where: { productId_facilityId: { productId: data.productId, facilityId } },
      update: {
        primary: data.primary,
        cost: data.cost ?? undefined,
        inventory: data.inventory,
      },
      create: {
        productId: data.productId,
        facilityId,
        primary: data.primary ?? false,
        cost: data.cost ?? null,
        inventory: data.inventory ?? 0,
      },
    })

    await logAudit({
      userId: session.user.id,
      userEmail: session.user.email,
      action: 'facility.product.assign',
      entityType: 'Facility',
      entityId: facilityId,
      metadata: data,
    })

    return NextResponse.json(pf)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    }
    console.error('Product-facility assign error:', error)
    return NextResponse.json({ error: 'Failed to assign product' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: facilityId } = await params
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const url = new URL(req.url)
    const productId = url.searchParams.get('productId')
    if (!productId) {
      return NextResponse.json({ error: 'productId required' }, { status: 400 })
    }

    await prisma.productFacility.delete({
      where: { productId_facilityId: { productId, facilityId } },
    })
    await logAudit({
      userId: session.user.id,
      userEmail: session.user.email,
      action: 'facility.product.unassign',
      entityType: 'Facility',
      entityId: facilityId,
      metadata: { productId },
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Product-facility delete error:', error)
    return NextResponse.json({ error: 'Failed to unassign product' }, { status: 500 })
  }
}
