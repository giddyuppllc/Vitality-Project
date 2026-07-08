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

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url)
  const stage = url.searchParams.get('stage')
  const assignee = url.searchParams.get('assignee')
  const priority = url.searchParams.get('priority')
  const source = url.searchParams.get('source')
  const q = url.searchParams.get('q')

  const where: Prisma.SalesLeadWhereInput = {}

  if (stage && VALID_STAGES.includes(stage as LeadStage)) {
    where.stage = stage as LeadStage
  }
  if (assignee) where.assignedTo = assignee === 'unassigned' ? null : assignee
  if (priority && VALID_PRIORITIES.includes(priority as LeadPriority)) {
    where.priority = priority as LeadPriority
  }
  if (source) where.source = source
  if (q) {
    where.OR = [
      { businessName: { contains: q, mode: 'insensitive' } },
      { contactName: { contains: q, mode: 'insensitive' } },
      { contactEmail: { contains: q, mode: 'insensitive' } },
    ]
  }

  const leads = await prisma.salesLead.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    take: 500,
  })

  return NextResponse.json(leads)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const {
      businessName,
      contactName,
      contactEmail,
      contactPhone,
      source,
      estimatedValue,
      probability,
      assignedTo,
      notes,
      nextAction,
      nextActionDue,
      priority,
      stage,
    } = body

    if (!businessName || !contactName || !contactEmail) {
      return NextResponse.json(
        { error: 'businessName, contactName and contactEmail are required' },
        { status: 400 },
      )
    }

    const lead = await prisma.salesLead.create({
      data: {
        businessName,
        contactName,
        contactEmail: String(contactEmail).toLowerCase(),
        contactPhone: contactPhone || null,
        source: source || null,
        stage:
          stage && VALID_STAGES.includes(stage as LeadStage)
            ? (stage as LeadStage)
            : 'NEW',
        priority:
          priority && VALID_PRIORITIES.includes(priority as LeadPriority)
            ? (priority as LeadPriority)
            : 'NORMAL',
        estimatedValue:
          typeof estimatedValue === 'number'
            ? estimatedValue
            : estimatedValue
              ? parseInt(estimatedValue, 10) || null
              : null,
        probability:
          typeof probability === 'number'
            ? probability
            : probability
              ? parseInt(probability, 10) || null
              : null,
        assignedTo: assignedTo || null,
        notes: notes || null,
        nextAction: nextAction || null,
        nextActionDue: nextActionDue ? new Date(nextActionDue) : null,
      },
    })

    await logAudit({
      userId: session.user.id,
      userEmail: session.user.email,
      action: 'lead.create',
      entityType: 'SalesLead',
      entityId: lead.id,
      metadata: { businessName, contactEmail, stage: lead.stage },
    })

    return NextResponse.json(lead, { status: 201 })
  } catch (error) {
    console.error('Create lead error:', error)
    return NextResponse.json({ error: 'Failed to create lead' }, { status: 500 })
  }
}
