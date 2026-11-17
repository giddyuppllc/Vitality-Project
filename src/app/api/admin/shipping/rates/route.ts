import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { logAudit } from '@/lib/audit'

async function requireAdmin() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') return null
  return session
}

const createSchema = z.object({
  zoneId: z.string(),
  name: z.string().min(1).max(80),
  price: z.number().int().min(0),
  minWeight: z.number().min(0).nullable().optional(),
  maxWeight: z.number().min(0).nullable().optional(),
  minOrderValue: z.number().int().min(0).nullable().optional(),
})

export async function POST(req: NextRequest) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  try {
    const data = createSchema.parse(await req.json())
    const zone = await prisma.shippingZone.findUnique({ where: { id: data.zoneId } })
    if (!zone) return NextResponse.json({ error: 'Zone not found' }, { status: 404 })
    const rate = await prisma.shippingRate.create({
      data: {
        zoneId: data.zoneId,
        name: data.name.trim(),
        price: data.price,
        minWeight: data.minWeight ?? null,
        maxWeight: data.maxWeight ?? null,
        minOrderValue: data.minOrderValue ?? null,
      },
    })
    await logAudit({
      userId: session.user.id,
      userEmail: session.user.email,
      action: 'shipping.rate.create',
      entityType: 'ShippingRate',
      entityId: rate.id,
      metadata: data,
    })
    return NextResponse.json(rate, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0].message }, { status: 400 })
    }
    console.error('[admin/shipping/rates POST]', err)
    return NextResponse.json({ error: 'Create failed' }, { status: 500 })
  }
}
