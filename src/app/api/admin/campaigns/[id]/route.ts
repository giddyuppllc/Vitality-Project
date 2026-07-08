import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { z } from 'zod'

const patchSchema = z.object({
  name: z.string().min(1).max(160).optional(),
  channel: z.enum(['EMAIL', 'SMS']).optional(),
  subject: z.string().max(300).optional().nullable(),
  body: z.string().optional(),
  segmentId: z.string().optional().nullable(),
  scheduledAt: z.string().optional().nullable(),
  status: z
    .enum(['DRAFT', 'SCHEDULED', 'SENDING', 'SENT', 'PAUSED', 'CANCELLED'])
    .optional(),
})

async function guard() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') return null
  return session
}

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await guard())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params
  const c = await prisma.marketingCampaign.findUnique({
    where: { id },
    include: {
      segment: { select: { id: true, name: true } },
    },
  })
  if (!c) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(c)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await guard()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params

  try {
    const data = patchSchema.parse(await req.json())

    const existing = await prisma.marketingCampaign.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    if (existing.status === 'SENT') {
      return NextResponse.json(
        { error: 'Sent campaigns cannot be edited' },
        { status: 409 },
      )
    }

    const update: Record<string, unknown> = {}
    if (data.name !== undefined) update.name = data.name
    if (data.channel !== undefined) update.channel = data.channel
    if (data.subject !== undefined) update.subject = data.subject
    if (data.body !== undefined) update.body = data.body
    if (data.segmentId !== undefined) update.segmentId = data.segmentId || null
    if (data.scheduledAt !== undefined) {
      update.scheduledAt = data.scheduledAt ? new Date(data.scheduledAt) : null
    }
    if (data.status !== undefined) update.status = data.status

    const updated = await prisma.marketingCampaign.update({
      where: { id },
      data: update,
    })

    await logAudit({
      userId: session.user.id,
      userEmail: session.user.email,
      action: 'campaign.update',
      entityType: 'MarketingCampaign',
      entityId: id,
      metadata: { changes: Object.keys(data) },
    })

    return NextResponse.json(updated)
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues }, { status: 400 })
    }
    console.error('[campaigns] update error', err)
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await guard()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params
  try {
    await prisma.marketingCampaign.delete({ where: { id } })
    await logAudit({
      userId: session.user.id,
      userEmail: session.user.email,
      action: 'campaign.delete',
      entityType: 'MarketingCampaign',
      entityId: id,
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[campaigns] delete error', err)
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
  }
}
