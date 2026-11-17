import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const patchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  email: z.string().email().optional(),
  contactName: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  addressLine1: z.string().min(1).optional(),
  addressLine2: z.string().optional().nullable(),
  city: z.string().min(1).optional(),
  state: z.string().min(1).optional(),
  zip: z.string().min(1).optional(),
  country: z.string().optional(),
  licenseNumber: z.string().optional().nullable(),
  apiEndpoint: z.string().optional().nullable(),
  apiKey: z.string().optional().nullable(),
  active: z.boolean().optional(),
  slaHours: z.number().int().min(1).optional(),
  notes: z.string().optional().nullable(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const data = patchSchema.parse(body)

    const updated = await prisma.facility.update({ where: { id }, data })

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        userEmail: session.user.email ?? null,
        action: 'facility.update',
        entityType: 'Facility',
        entityId: updated.id,
        // Never write the facility's API key into the audit trail (it is
        // readable on /admin/audit) — record only that it changed.
        metadata: JSON.stringify({
          ...data,
          ...(data.apiKey !== undefined ? { apiKey: data.apiKey ? '[changed]' : '[cleared]' } : {}),
        }),
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    }
    console.error('Facility update error:', error)
    return NextResponse.json({ error: 'Failed to update facility' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Soft refuse if there are active fulfillments (would orphan orders)
    const active = await prisma.fulfillment.count({
      where: { facilityId: id, status: { in: ['PENDING', 'ACCEPTED', 'PROCESSING', 'SHIPPED'] } },
    })
    if (active > 0) {
      return NextResponse.json(
        { error: `Cannot delete — ${active} active fulfillment(s) still assigned. Mark them complete first.` },
        { status: 400 }
      )
    }

    // Finished fulfillments still reference the facility (shipping history),
    // so the row can't be deleted — say so instead of a generic 500.
    const history = await prisma.fulfillment.count({ where: { facilityId: id } })
    if (history > 0) {
      return NextResponse.json(
        {
          error: `This facility has ${history} past fulfillment(s) on record, so it can't be deleted. Turn off "Active" instead to stop routing orders to it.`,
        },
        { status: 409 }
      )
    }

    await prisma.facility.delete({ where: { id } })

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        userEmail: session.user.email ?? null,
        action: 'facility.delete',
        entityType: 'Facility',
        entityId: id,
      },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Facility delete error:', error)
    return NextResponse.json({ error: 'Failed to delete facility' }, { status: 500 })
  }
}
