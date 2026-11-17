import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { z } from 'zod'
import { zodMessage } from '@/lib/zod-message'

const schema = z.object({
  status: z
    .enum(['OPEN', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'RESOLVED', 'CLOSED'])
    .optional(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).optional(),
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
    const data = schema.parse(await req.json())

    const updated = await prisma.supportTicket.update({
      where: { id },
      data,
    })

    await logAudit({
      userId: session.user.id,
      userEmail: session.user.email,
      action: 'support.ticket.update',
      entityType: 'SupportTicket',
      entityId: id,
      metadata: data,
    })

    return NextResponse.json(updated)
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json({ error: zodMessage(error), issues: error.issues }, { status: 400 })
    console.error('Ticket update error:', error)
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }
}
