import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { z } from 'zod'
import { zodMessage } from '@/lib/zod-message'

const patchSchema = z.object({
  approved: z.boolean().optional(),
})

async function guard() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') return null
  return session
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await guard()
  if (!session)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  try {
    const data = patchSchema.parse(await req.json())
    const review = await prisma.review.update({ where: { id }, data })

    await logAudit({
      userId: session.user.id,
      userEmail: session.user.email,
      action: data.approved ? 'review.approve' : 'review.unapprove',
      entityType: 'Review',
      entityId: id,
    })

    return NextResponse.json(review)
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json({ error: zodMessage(error), issues: error.issues }, { status: 400 })
    console.error('Review update error:', error)
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await guard()
  if (!session)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  try {
    await prisma.review.delete({ where: { id } })
    await logAudit({
      userId: session.user.id,
      userEmail: session.user.email,
      action: 'review.delete',
      entityType: 'Review',
      entityId: id,
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Review delete error:', error)
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
  }
}
