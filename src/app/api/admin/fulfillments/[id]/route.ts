import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  shipFulfillment,
  updateFulfillmentStatus,
} from '@/lib/fulfillment'
import { z } from 'zod'
import { logAudit } from '@/lib/audit'
import type { FulfillmentStatus } from '@prisma/client'

const patchSchema = z.object({
  action: z.enum(['ship']).optional(),
  status: z.enum(['PENDING', 'ACCEPTED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'FAILED']).optional(),
  trackingNumber: z.string().optional(),
  trackingUrl: z.string().optional(),
  carrier: z.string().optional(),
  notes: z.string().optional(),
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

  let data: z.infer<typeof patchSchema>
  try {
    data = patchSchema.parse(await req.json())
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
  if (!(await prisma.fulfillment.findUnique({ where: { id }, select: { id: true } }))) {
    return NextResponse.json({ error: 'Fulfillment not found' }, { status: 404 })
  }

  const res = await applyPatch(id, data)
  // Ship / cancel / deliver / tracking edits move the order and email the
  // customer — they belong on the audit trail.
  if (res.ok) {
    await logAudit({
      userId: session.user.id,
      userEmail: session.user.email,
      action: data.action === 'ship' ? 'fulfillment.ship' : data.status ? `fulfillment.status.${data.status.toLowerCase()}` : 'fulfillment.update',
      entityType: 'Fulfillment',
      entityId: id,
      metadata: data,
    })
  }
  return res
}

async function applyPatch(id: string, data: z.infer<typeof patchSchema>): Promise<Response> {
  try {

    // Special "ship" action goes through helper that cascades to order + email
    if (data.action === 'ship') {
      if (!data.trackingNumber) {
        return NextResponse.json({ error: 'Tracking number required' }, { status: 400 })
      }
      const updated = await shipFulfillment(id, {
        number: data.trackingNumber,
        url: data.trackingUrl,
        carrier: data.carrier,
      })
      if (data.notes !== undefined) {
        await prisma.fulfillment.update({ where: { id }, data: { notes: data.notes } })
      }
      return NextResponse.json(updated)
    }

    // Status transition (non-ship)
    if (data.status) {
      if (data.status === 'SHIPPED') {
        // Prefer the dedicated action, but allow status-only if tracking already saved
        const existing = await prisma.fulfillment.findUnique({ where: { id } })
        if (!existing?.trackingNumber && !data.trackingNumber) {
          return NextResponse.json(
            { error: 'Use the Ship action with a tracking number' },
            { status: 400 }
          )
        }
        const updated = await shipFulfillment(id, {
          number: data.trackingNumber ?? existing!.trackingNumber!,
          url: data.trackingUrl ?? existing?.trackingUrl ?? undefined,
          carrier: data.carrier ?? existing?.carrier ?? undefined,
        })
        return NextResponse.json(updated)
      }
      const updated = await updateFulfillmentStatus(id, data.status as FulfillmentStatus)
      // Merge in any extra fields
      if (
        data.trackingNumber !== undefined ||
        data.trackingUrl !== undefined ||
        data.carrier !== undefined ||
        data.notes !== undefined
      ) {
        await prisma.fulfillment.update({
          where: { id },
          data: {
            trackingNumber: data.trackingNumber,
            trackingUrl: data.trackingUrl,
            carrier: data.carrier,
            notes: data.notes,
          },
        })
      }
      return NextResponse.json(updated)
    }

    // No status change — just update fields
    const updated = await prisma.fulfillment.update({
      where: { id },
      data: {
        trackingNumber: data.trackingNumber,
        trackingUrl: data.trackingUrl,
        carrier: data.carrier,
        notes: data.notes,
      },
    })
    return NextResponse.json(updated)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    }
    console.error('Fulfillment update error:', error)
    return NextResponse.json({ error: 'Failed to update fulfillment' }, { status: 500 })
  }
}
