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

const patchSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  price: z.number().int().min(0).optional(),
  minWeight: z.number().min(0).nullable().optional(),
  maxWeight: z.number().min(0).nullable().optional(),
  minOrderValue: z.number().int().min(0).nullable().optional(),
})

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await params
  try {
    const data = patchSchema.parse(await req.json())
    const updated = await prisma.shippingRate.update({
      where: { id },
      data: {
        ...(data.name != null ? { name: data.name.trim() } : {}),
        ...(data.price != null ? { price: data.price } : {}),
        ...(data.minWeight !== undefined ? { minWeight: data.minWeight } : {}),
        ...(data.maxWeight !== undefined ? { maxWeight: data.maxWeight } : {}),
        ...(data.minOrderValue !== undefined ? { minOrderValue: data.minOrderValue } : {}),
      },
    })
    await logAudit({
      userId: session.user.id,
      userEmail: session.user.email,
      action: 'shipping.rate.update',
      entityType: 'ShippingRate',
      entityId: id,
      metadata: data,
    })
    return NextResponse.json(updated)
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0].message }, { status: 400 })
    }
    console.error('[admin/shipping/rates PATCH]', err)
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await params
  try {
    const gone = await prisma.shippingRate.delete({ where: { id } })
    await logAudit({
      userId: session.user.id,
      userEmail: session.user.email,
      action: 'shipping.rate.delete',
      entityType: 'ShippingRate',
      entityId: id,
      metadata: { name: gone.name, price: gone.price, zoneId: gone.zoneId },
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[admin/shipping/rates DELETE]', err)
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
  }
}
