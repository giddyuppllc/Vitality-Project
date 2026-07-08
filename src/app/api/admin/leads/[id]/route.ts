import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import type { LeadPriority, LeadStage, Prisma } from '@prisma/client'

const VALID_STAGES: LeadStage[] = [
  'NEW',
  'CONTACTED',
  'QUALIFIED',
  'PROPOSAL',
  'NEGOTIATION',
  'CLOSED_WON',
  'CLOSED_LOST',
]
const VALID_PRIORITIES: LeadPriority[] = ['LOW', 'NORMAL', 'HIGH', 'URGENT']

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params
  const lead = await prisma.salesLead.findUnique({ where: { id } })
  if (!lead) {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
  }
  return NextResponse.json(lead)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  try {
    const existing = await prisma.salesLead.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }

    const body = await req.json()
    const data: Prisma.SalesLeadUpdateInput = {}
    let stageChanged = false
    let oldStage: LeadStage | null = null
    let newStage: LeadStage | null = null

    if (typeof body.businessName === 'string') data.businessName = body.businessName
    if (typeof body.contactName === 'string') data.contactName = body.contactName
    if (typeof body.contactEmail === 'string') {
      data.contactEmail = body.contactEmail.toLowerCase()
    }
    if ('contactPhone' in body) data.contactPhone = body.contactPhone || null
    if ('source' in body) data.source = body.source || null
    if ('notes' in body) data.notes = body.notes || null
    if ('nextAction' in body) data.nextAction = body.nextAction || null
    if ('nextActionDue' in body) {
      data.nextActionDue = body.nextActionDue ? new Date(body.nextActionDue) : null
    }
    if ('estimatedValue' in body) {
      data.estimatedValue =
        body.estimatedValue === null || body.estimatedValue === ''
          ? null
          : typeof body.estimatedValue === 'number'
            ? body.estimatedValue
            : parseInt(body.estimatedValue, 10) || null
    }
    if ('probability' in body) {
      data.probability =
        body.probability === null || body.probability === ''
          ? null
          : typeof body.probability === 'number'
            ? body.probability
            : parseInt(body.probability, 10) || null
    }
    if ('assignedTo' in body) data.assignedTo = body.assignedTo || null
    if ('closedReason' in body) data.closedReason = body.closedReason || null

    if (
      body.priority &&
      VALID_PRIORITIES.includes(body.priority as LeadPriority)
    ) {
      data.priority = body.priority as LeadPriority
    }

    if (body.stage && VALID_STAGES.includes(body.stage as LeadStage)) {
      const nextStage = body.stage as LeadStage
      if (nextStage !== existing.stage) {
        stageChanged = true
        oldStage = existing.stage
        newStage = nextStage
        data.stage = nextStage
        if (nextStage === 'CLOSED_WON' || nextStage === 'CLOSED_LOST') {
          data.closedAt = new Date()
        } else {
          data.closedAt = null
        }
      }
    }

    const updated = await prisma.salesLead.update({ where: { id }, data })

    if (stageChanged) {
      await logAudit({
        userId: session.user.id,
        userEmail: session.user.email,
        action: 'lead.stage.change',
        entityType: 'SalesLead',
        entityId: id,
        metadata: { from: oldStage, to: newStage },
      })
    } else {
      await logAudit({
        userId: session.user.id,
        userEmail: session.user.email,
        action: 'lead.update',
        entityType: 'SalesLead',
        entityId: id,
        metadata: { keys: Object.keys(data) },
      })
    }

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Update lead error:', error)
    return NextResponse.json({ error: 'Failed to update lead' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  try {
    await prisma.salesLead.delete({ where: { id } })

    await logAudit({
      userId: session.user.id,
      userEmail: session.user.email,
      action: 'lead.delete',
      entityType: 'SalesLead',
      entityId: id,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete lead error:', error)
    return NextResponse.json({ error: 'Failed to delete lead' }, { status: 500 })
  }
}
