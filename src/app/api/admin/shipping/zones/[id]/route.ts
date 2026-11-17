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
  countries: z.array(z.string().length(2)).min(1).optional(),
  active: z.boolean().optional(),
})

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await params
  try {
    const data = patchSchema.parse(await req.json())
    const updated = await prisma.shippingZone.update({
      where: { id },
      data: {
        ...(data.name != null ? { name: data.name.trim() } : {}),
        ...(data.countries
          ? { countries: data.countries.map((c) => c.toUpperCase()) }
          : {}),
        ...(data.active != null ? { active: data.active } : {}),
      },
    })
    await logAudit({
      userId: session.user.id,
      userEmail: session.user.email,
      action: 'shipping.zone.update',
      entityType: 'ShippingZone',
      entityId: id,
      metadata: data,
    })
    return NextResponse.json(updated)
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0].message }, { status: 400 })
    }
    console.error('[admin/shipping/zones PATCH]', err)
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await params
  try {
    const gone = await prisma.shippingZone.delete({ where: { id } })
    await logAudit({
      userId: session.user.id,
      userEmail: session.user.email,
      action: 'shipping.zone.delete',
      entityType: 'ShippingZone',
      entityId: id,
      metadata: { name: gone.name, countries: gone.countries },
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[admin/shipping/zones DELETE]', err)
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
  }
}
