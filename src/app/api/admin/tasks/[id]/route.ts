import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { z } from 'zod'

const patchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).nullable().optional(),
  status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).optional(),
  dueAt: z.string().refine((v) => v === '' || !Number.isNaN(Date.parse(v)), 'Invalid due date').nullable().optional(),
  assignedTo: z.string().nullable().optional(),
})

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
    const data = patchSchema.parse(await req.json())

    const updateData: Record<string, unknown> = { ...data }
    if (data.dueAt !== undefined) {
      updateData.dueAt = data.dueAt ? new Date(data.dueAt) : null
    }
    if (data.status === 'COMPLETED') {
      updateData.completedAt = new Date()
    } else if (data.status) {
      updateData.completedAt = null
    }

    const task = await prisma.adminTask.update({
      where: { id },
      data: updateData,
    })

    await logAudit({
      userId: session.user.id,
      userEmail: session.user.email,
      action: 'task.update',
      entityType: 'AdminTask',
      entityId: id,
      metadata: data,
    })

    return NextResponse.json(task)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    }
    console.error('Update task error:', error)
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 })
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
    await prisma.adminTask.delete({ where: { id } })
    await logAudit({
      userId: session.user.id,
      userEmail: session.user.email,
      action: 'task.delete',
      entityType: 'AdminTask',
      entityId: id,
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Delete task error:', error)
    return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 })
  }
}
