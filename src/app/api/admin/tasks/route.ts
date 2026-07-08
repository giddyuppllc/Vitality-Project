import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { z } from 'zod'
import type { Prisma } from '@prisma/client'

const createSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).optional(),
  dueAt: z.string().datetime().optional().or(z.string().optional()),
  assignedTo: z.string().optional(),
  entityType: z.string().optional(),
  entityId: z.string().optional(),
})

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const priority = searchParams.get('priority')
  const assignee = searchParams.get('assignee')
  const entityType = searchParams.get('entityType')
  const entityId = searchParams.get('entityId')

  const where: Prisma.AdminTaskWhereInput = {}
  if (status) {
    where.status = status as Prisma.AdminTaskWhereInput['status']
  }
  if (priority) {
    where.priority = priority as Prisma.AdminTaskWhereInput['priority']
  }
  if (assignee === 'me') {
    where.assignedTo = session.user.id
  } else if (assignee) {
    where.assignedTo = assignee
  }
  if (entityType) where.entityType = entityType
  if (entityId) where.entityId = entityId

  const tasks = await prisma.adminTask.findMany({
    where,
    orderBy: [{ status: 'asc' }, { dueAt: 'asc' }, { createdAt: 'desc' }],
    take: 200,
  })

  return NextResponse.json(tasks)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const data = createSchema.parse(await req.json())

    const task = await prisma.adminTask.create({
      data: {
        title: data.title,
        description: data.description,
        priority: data.priority ?? 'NORMAL',
        dueAt: data.dueAt ? new Date(data.dueAt) : null,
        assignedTo: data.assignedTo || null,
        entityType: data.entityType || null,
        entityId: data.entityId || null,
        createdBy: session.user.id,
      },
    })

    await logAudit({
      userId: session.user.id,
      userEmail: session.user.email,
      action: 'task.create',
      entityType: 'AdminTask',
      entityId: task.id,
      metadata: {
        title: task.title,
        relatedTo: data.entityType
          ? `${data.entityType}:${data.entityId}`
          : null,
      },
    })

    return NextResponse.json(task, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    }
    console.error('Create task error:', error)
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 })
  }
}
